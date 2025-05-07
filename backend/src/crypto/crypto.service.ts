import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { KeyStorageService } from './key-storage.service';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
  salt: Buffer;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly MIN_KEY_SIZE = 2048; // Minimum acceptable key size
  private readonly MAX_SIGN_DATA_SIZE = 10 * 1024 * 1024; // 10MB limit for data to sign
  private readonly CRYPTO_TIMEOUT = 60000; // 60 seconds max for crypto operations
  private readonly AES_KEY_LENGTH = 32; // 256 bits

  constructor(private readonly keyStorageService: KeyStorageService) {}

  // Método especializado para datos biométricos con mayor seguridad
  encryptBiometricData(data: Buffer): EncryptionResult {
    // Generar una sal consistente
    const salt = crypto.randomBytes(16);

    const key = crypto.pbkdf2Sync(
      process.env.MASTER_KEY || 'default-key-should-be-replaced-in-production',
      salt,
      10000,
      this.AES_KEY_LENGTH,
      'sha256',
    );

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv,
      authTag: authTag,
      salt: salt,
    };
  }

  decryptBiometricData(
    encryptedData: Buffer,
    iv: Buffer,
    authTag: Buffer,
    salt?: Buffer,
  ): Buffer {
    try {
      const usedSalt = salt || iv.slice(0, Math.min(16, iv.length));

      const key = crypto.pbkdf2Sync(
        process.env.MASTER_KEY ||
          'default-key-should-be-replaced-in-production',
        usedSalt,
        10000,
        this.AES_KEY_LENGTH,
        'sha256',
      );

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    } catch (error) {
      console.error('Error detallado al descifrar:', error);
      throw new BadRequestException(
        'Error al descifrar los datos: ' + error.message,
      );
    }
  }

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
            modulusLength: 4096, // Incrementado desde 2048 para mayor seguridad
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem',
              cipher: 'aes-256-cbc', // Cifrado adicional para la clave privada
              passphrase: this.generateSecurePassphrase(userId),
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
   * Genera una contraseña segura utilizando información específica del usuario
   * combinada con factores aleatorios
   */
  private generateSecurePassphrase(userId: string): string {
    // Combinar un identificador con una salt aleatoria
    const seedData = userId + process.env.JWT_SECRET;
    // Crear un hash como base para la contraseña
    const hash = crypto.createHash('sha256').update(seedData).digest('hex');
    // Añadir complejidad con caracteres especiales
    return hash.substring(0, 32) + '#!$%&-_';
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
          // Usar SHA-256 para la firma
          const sign = crypto.createSign('SHA256');
          sign.update(dataBuffer);
          const signature = sign.sign(
            {
              key: privateKey,
              passphrase: this.generateSecurePassphrase(userId),
            },
            'base64',
          );

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
   * Encrypts a document with AES-256-GCM
   * @param data Document data to encrypt
   * @returns Encrypted data, key, IV and auth tag
   */
  encryptDocument(data: Buffer): {
    encryptedData: Buffer;
    key: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    // Generar clave aleatoria y vector de inicialización
    const key = crypto.randomBytes(32); // AES-256
    const iv = crypto.randomBytes(12); // GCM recomienda 12 bytes

    // Crear cipher con modo GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Cifrar datos
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);

    // Obtener tag de autenticación
    const authTag = cipher.getAuthTag();

    return { encryptedData, key, iv, authTag };
  }

  /**
   * Decrypts AES-GCM encrypted data
   * @param encryptedData Encrypted document data
   * @param key Encryption key
   * @param iv Initialization vector
   * @param authTag Authentication tag
   * @returns Decrypted document data
   */
  decryptDocument(
    encryptedData: Buffer,
    key: Buffer,
    iv: Buffer,
    authTag?: Buffer,
  ): Buffer {
    try {
      // Si authTag está presente, usar GCM (método más seguro)
      if (authTag && Buffer.isBuffer(authTag)) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([
          decipher.update(encryptedData),
          decipher.final(),
        ]);
      }
      // Sin authTag, usar CBC para compatibilidad
      else {
        // Asegurar que el IV es de 16 bytes para CBC
        let cbcIv = iv;
        if (iv.length !== 16) {
          cbcIv = Buffer.alloc(16);
          iv.copy(cbcIv);
        }
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, cbcIv);
        return Buffer.concat([
          decipher.update(encryptedData),
          decipher.final(),
        ]);
      }
    } catch (error) {
      console.error(
        `Error detallado de descifrado: ${error.message}`,
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
      // Generate new key pair with enhanced security
      const newKeyPair = await new Promise<KeyPair>((resolve, reject) => {
        crypto.generateKeyPair(
          'rsa',
          {
            modulusLength: 4096, // Incrementado para mayor seguridad
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem',
              cipher: 'aes-256-cbc',
              passphrase: this.generateSecurePassphrase(userId),
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

  // Método para detección avanzada de manipulación
  async detectDocumentManipulation(
    originalHash: string,
    currentFileData: Buffer,
  ): Promise<{
    manipulated: boolean;
    manipulationScore: number;
    detectedChanges?: string[];
  }> {
    try {
      // Generar hash actual
      const currentHash = crypto
        .createHash('sha256')
        .update(currentFileData)
        .digest('hex');

      // Verificación básica por hash
      if (originalHash === currentHash) {
        return {
          manipulated: false,
          manipulationScore: 0,
        };
      }

      // Detección avanzada para PDFs
      const fileSignature = currentFileData.slice(0, 4).toString('hex');
      const isPdf = fileSignature === '25504446'; // Signature de PDF (%PDF)

      const detectedChanges = [];
      let manipulationScore = 0.5; // Puntuación inicial si los hashes son diferentes

      if (isPdf) {
        // Detectar firmas de manipulación común en PDFs
        const fileStr = currentFileData.toString();

        // Buscar herramientas de edición comunes
        if (fileStr.includes('/Producer(Adobe PDF Library')) {
          detectedChanges.push('Editado con Adobe');
          manipulationScore += 0.1;
        }

        // Verificar timestamps inconsistentes
        const modDateMatches = /\/ModDate\((D:[^)]+)\)/.exec(fileStr);
        const createDateMatches = /\/CreationDate\((D:[^)]+)\)/.exec(fileStr);

        if (modDateMatches && createDateMatches) {
          const modDate = new Date(
            modDateMatches[1].replace('D:', '').replace(/'/g, ''),
          );
          const createDate = new Date(
            createDateMatches[1].replace('D:', '').replace(/'/g, ''),
          );

          // Si fecha de modificación es muy reciente
          const now = new Date();
          if (now.getTime() - modDate.getTime() < 24 * 60 * 60 * 1000) {
            detectedChanges.push('Modificado recientemente');
            manipulationScore += 0.2;
          }
        }
      }

      return {
        manipulated: true,
        manipulationScore: Math.min(manipulationScore, 1.0),
        detectedChanges:
          detectedChanges.length > 0 ? detectedChanges : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Error detectando manipulación: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error en análisis de integridad: ${error.message}`,
      );
    }
  }

  /**
   * Calcula un token de verificación de integridad para un documento
   * Combina hash, timestamp y firma para asegurar integridad
   */
  async generateIntegrityToken(
    documentId: string,
    userId: string,
    fileData: Buffer,
  ): Promise<string> {
    // Crear payload con información de integridad
    const timestamp = Date.now();
    const documentHash = this.generateHash(fileData);

    const payload = JSON.stringify({
      documentId,
      hash: documentHash,
      timestamp,
      userId,
    });

    // Firmar el payload
    const signature = await this.signData(userId, payload);
    if (!signature) {
      throw new BadRequestException('Failed to sign integrity token');
    }

    // Combinar en token único (formato JSON para facilitar verificación)
    return Buffer.from(
      JSON.stringify({
        payload: payload,
        signature: signature,
      }),
    ).toString('base64');
  }

  /**
   * Verifica un token de integridad y devuelve los datos originales
   */
  async verifyIntegrityToken(
    token: string,
    fileData: Buffer,
  ): Promise<{
    isValid: boolean;
    documentId?: string;
    userId?: string;
    timestamp?: number;
    reason?: string;
  }> {
    try {
      // Decodificar token
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      const { payload, signature } = tokenData;

      if (!payload || !signature) {
        return { isValid: false, reason: 'Invalid token format' };
      }

      // Extraer información del payload
      const payloadData = JSON.parse(payload);
      const { documentId, hash, timestamp, userId } = payloadData;

      // Verificar que no falten campos
      if (!documentId || !hash || !timestamp || !userId) {
        return { isValid: false, reason: 'Missing fields in integrity token' };
      }

      // Verificar firma
      const isSignatureValid = await this.verifySignature(
        userId,
        payload,
        signature,
      );
      if (!isSignatureValid) {
        return { isValid: false, reason: 'Invalid signature' };
      }

      // Verificar hash del documento
      const currentHash = this.generateHash(fileData);
      if (currentHash !== hash) {
        return {
          isValid: false,
          reason: 'Document has been modified',
          documentId,
          userId,
          timestamp,
        };
      }

      // Todo correcto
      return {
        isValid: true,
        documentId,
        userId,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Error verifying integrity token: ${error.message}`);
      return {
        isValid: false,
        reason: `Error verifying token: ${error.message}`,
      };
    }
  }
}
