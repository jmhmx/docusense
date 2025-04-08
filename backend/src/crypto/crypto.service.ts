import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { KeyStorageService } from './key-storage.service';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly MIN_KEY_SIZE = 2048; // Minimum acceptable key size
  private readonly MAX_SIGN_DATA_SIZE = 10 * 1024 * 1024; // 10MB limit for data to sign
  private readonly CRYPTO_TIMEOUT = 60000; // 60 seconds max for crypto operations

  constructor(private readonly keyStorageService: KeyStorageService) {}

  /**
   * Generates an RSA key pair with robust error handling
   * @param userId User ID to associate with the key pair
   * @returns Promise with the generated key pair
   * @throws BadRequestException if the user ID is invalid or generation fails
   */
  generateKeyPair(userId: string): Promise<KeyPair> {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new BadRequestException('Invalid user ID provided');
    }

    return new Promise((resolve, reject) => {
      // Set timeout for the operation
      const timeout = setTimeout(() => {
        reject(new Error('Key pair generation timed out'));
      }, this.CRYPTO_TIMEOUT);

      try {
        crypto.generateKeyPair(
          'rsa',
          {
            modulusLength: this.MIN_KEY_SIZE,
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem',
            },
          },
          async (err, publicKey, privateKey) => {
            clearTimeout(timeout);

            if (err) {
              this.logger.error(
                `Error generating keys for userId=${userId}: ${err.message}`,
                err.stack,
              );
              return reject(
                new BadRequestException(
                  `Failed to generate key pair: ${err.message}`,
                ),
              );
            }

            // Store the keys using the secure key storage service
            try {
              await this.keyStorageService.storePublicKey(userId, publicKey);
              await this.keyStorageService.storePrivateKey(userId, privateKey);

              this.logger.log(`Key pair generated for userId=${userId}`);
              resolve({ publicKey, privateKey });
            } catch (storeErr) {
              this.logger.error(
                `Error storing keys for userId=${userId}: ${storeErr.message}`,
                storeErr.stack,
              );
              reject(
                new BadRequestException(
                  `Failed to store key pair: ${storeErr.message}`,
                ),
              );
            }
          },
        );
      } catch (error) {
        clearTimeout(timeout);
        this.logger.error(
          `Unexpected error during key generation for userId=${userId}: ${error.message}`,
          error.stack,
        );
        reject(
          new BadRequestException(
            `Failed to generate key pair: ${error.message}`,
          ),
        );
      }
    });
  }

  /**
   * Retrieves a user's key pair using the secure storage service
   */
  async getUserKeyPair(userId: string): Promise<KeyPair | null> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new BadRequestException('Invalid user ID provided');
    }

    try {
      // Check if user has keys
      const hasKeys = await this.keyStorageService.userHasKeys(userId);
      if (!hasKeys) {
        return null;
      }

      // Get public and private keys
      const publicKey = await this.keyStorageService.getPublicKey(userId);
      const privateKey = await this.keyStorageService.getPrivateKey(userId);

      if (!publicKey || !privateKey) {
        this.logger.warn(`Incomplete key pair for userId=${userId}`);
        return null;
      }

      return { publicKey, privateKey };
    } catch (error) {
      this.logger.error(
        `Error retrieving keys for userId=${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to retrieve keys: ${error.message}`,
      );
    }
  }

  /**
   * Retrieves only a user's public key
   */
  async getUserPublicKey(userId: string): Promise<string | null> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new BadRequestException('Invalid user ID provided');
    }

    try {
      return await this.keyStorageService.getPublicKey(userId);
    } catch (error) {
      this.logger.error(
        `Error retrieving public key for userId=${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to retrieve public key: ${error.message}`,
      );
    }
  }

  /**
   * Signs data with a user's private key
   * @param userId User ID to sign data with
   * @param data Data to sign
   * @returns Base64 encoded signature or null if signing fails
   */
  async signData(
    userId: string,
    data: string | Buffer,
  ): Promise<string | null> {
    // Validate inputs
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new BadRequestException('Invalid user ID provided');
    }

    if (!data) {
      throw new BadRequestException('No data provided for signing');
    }

    // Convert string to Buffer if needed
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;

    // Check data size
    if (dataBuffer.length > this.MAX_SIGN_DATA_SIZE) {
      throw new BadRequestException(
        `Data too large for signing (max: ${this.MAX_SIGN_DATA_SIZE} bytes)`,
      );
    }

    // Get private key
    const privateKey = await this.keyStorageService.getPrivateKey(userId);
    if (!privateKey) {
      this.logger.warn(`No private key available for userId=${userId}`);
      return null;
    }

    try {
      // Set timeout for the operation
      const signPromise = new Promise<string>((resolve, reject) => {
        try {
          const sign = crypto.createSign('SHA256');
          sign.update(dataBuffer);
          const signature = sign.sign(privateKey, 'base64');

          resolve(signature);
        } catch (error) {
          reject(error);
        }
      });

      // Add timeout to the promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Signing operation timed out'));
        }, this.CRYPTO_TIMEOUT);
      });

      // Race the signing against the timeout
      const signature = (await Promise.race([
        signPromise,
        timeoutPromise,
      ])) as string;

      this.logger.log(`Data signed successfully for userId=${userId}`);
      return signature;
    } catch (error) {
      this.logger.error(
        `Error signing data for userId=${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Failed to sign data: ${error.message}`);
    }
  }

  /**
   * Verifies the signature of data
   * @param userId User ID that signed the data
   * @param data Data that was signed
   * @param signature Base64 encoded signature to verify
   * @returns True if signature is valid, false otherwise
   */
  async verifySignature(
    userId: string,
    data: string | Buffer,
    signature: string,
  ): Promise<boolean> {
    // Validate inputs
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new BadRequestException('Invalid user ID provided');
    }

    if (!data) {
      throw new BadRequestException('No data provided for verification');
    }

    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Invalid signature format');
    }

    // Validate signature format (Base64)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(signature)) {
      throw new BadRequestException('Signature is not valid Base64 format');
    }

    // Get public key
    const publicKey = await this.keyStorageService.getPublicKey(userId);
    if (!publicKey) {
      this.logger.warn(`No public key available for userId=${userId}`);
      return false;
    }

    // Convert string to Buffer if needed
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;

    try {
      // Set timeout for the operation
      const verifyPromise = new Promise<boolean>((resolve, reject) => {
        try {
          const verify = crypto.createVerify('SHA256');
          verify.update(dataBuffer);
          const isValid = verify.verify(publicKey, signature, 'base64');
          resolve(isValid);
        } catch (error) {
          reject(error);
        }
      });

      // Add timeout to the promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Verification operation timed out'));
        }, this.CRYPTO_TIMEOUT);
      });

      // Race the verification against the timeout
      const isValid = (await Promise.race([
        verifyPromise,
        timeoutPromise,
      ])) as boolean;

      this.logger.log(
        `Signature verification for userId=${userId}: ${isValid ? 'valid' : 'invalid'}`,
      );
      return isValid;
    } catch (error) {
      this.logger.error(
        `Error verifying signature for userId=${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to verify signature: ${error.message}`,
      );
    }
  }

  /**
   * Encrypts a document with AES-256
   * @param data Document data to encrypt
   * @returns Encrypted data and encryption keys
   */
  encryptDocument(data: Buffer): {
    encryptedData: Buffer;
    key: Buffer;
    iv: Buffer;
  } {
    // Validate input
    if (!data || !Buffer.isBuffer(data)) {
      throw new BadRequestException(
        'Invalid document data provided for encryption',
      );
    }

    if (data.length === 0) {
      throw new BadRequestException(
        'Empty document data provided for encryption',
      );
    }

    try {
      // Generate random key and initialization vector
      const key = crypto.randomBytes(32); // AES-256
      const iv = crypto.randomBytes(16); // Initialization vector

      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      // Encrypt data
      const encryptedData = Buffer.concat([
        cipher.update(data),
        cipher.final(),
      ]);

      return { encryptedData, key, iv };
    } catch (error) {
      this.logger.error(
        `Error encrypting document: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to encrypt document: ${error.message}`,
      );
    }
  }

  /**
   * Decrypts AES encrypted data
   * @param encryptedData Encrypted document data
   * @param key Encryption key
   * @param iv Initialization vector
   * @returns Decrypted document data
   */
  decryptDocument(encryptedData: Buffer, key: Buffer, iv: Buffer): Buffer {
    // Validate inputs
    if (!encryptedData || !Buffer.isBuffer(encryptedData)) {
      throw new BadRequestException('Invalid encrypted data provided');
    }

    if (!key || !Buffer.isBuffer(key) || key.length !== 32) {
      throw new BadRequestException('Invalid encryption key provided');
    }

    if (!iv || !Buffer.isBuffer(iv) || iv.length !== 16) {
      throw new BadRequestException('Invalid initialization vector provided');
    }

    try {
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      // Decrypt data
      return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    } catch (error) {
      this.logger.error(
        `Error decrypting document: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to decrypt document: ${error.message}`,
      );
    }
  }

  /**
   * Generates a SHA-256 hash of data
   * @param data Data to hash
   * @returns Hexadecimal hash string
   */
  generateHash(data: string | Buffer): string {
    // Validate input
    if (!data) {
      throw new BadRequestException('No data provided for hashing');
    }

    try {
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      this.logger.error(`Error generating hash: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Failed to generate hash: ${error.message}`,
      );
    }
  }

  /**
   * Rotates a user's key pair (generates a new pair and replaces the old one)
   */
  async rotateUserKeys(userId: string): Promise<KeyPair> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new BadRequestException('Invalid user ID provided');
    }

    try {
      // Generate new key pair
      const newKeyPair = await new Promise<KeyPair>((resolve, reject) => {
        crypto.generateKeyPair(
          'rsa',
          {
            modulusLength: this.MIN_KEY_SIZE,
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem',
            },
          },
          (err, publicKey, privateKey) => {
            if (err) {
              return reject(err);
            }
            resolve({ publicKey, privateKey });
          },
        );
      });

      // Use the key storage service to rotate keys
      await this.keyStorageService.rotateUserKeys(
        userId,
        newKeyPair.publicKey,
        newKeyPair.privateKey,
      );

      return newKeyPair;
    } catch (error) {
      this.logger.error(
        `Error rotating keys for userId=${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Failed to rotate keys: ${error.message}`);
    }
  }
}
