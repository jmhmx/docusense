import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for securely storing and retrieving cryptographic keys
 */
@Injectable()
export class KeyStorageService {
  private readonly logger = new Logger(KeyStorageService.name);
  private readonly keyStorePath: string;
  private readonly masterKey: Buffer;
  private readonly keyEncryptionAlgorithm = 'aes-256-gcm';

  constructor(private configService: ConfigService) {
    // Get key store path from config
    this.keyStorePath =
      this.configService.get<string>('KEY_STORE_PATH') || 'keys';

    // Ensure key store directory exists
    if (!fs.existsSync(this.keyStorePath)) {
      fs.mkdirSync(this.keyStorePath, { recursive: true });
      this.logger.log(`Key store directory created: ${this.keyStorePath}`);
    }

    // Initialize master key from environment or generate one
    // In production, this should come from a secure vault or HSM
    this.masterKey = this.initializeMasterKey();
  }

  /**
   * Initialize the master key used for key encryption
   */
  private initializeMasterKey(): Buffer {
    // In production, retrieve from secure storage (vault, HSM)
    // For development, use environment variable or generate one
    const masterKeyHex = this.configService.get<string>('MASTER_KEY');

    if (masterKeyHex && /^[0-9a-f]{64}$/i.test(masterKeyHex)) {
      return Buffer.from(masterKeyHex, 'hex');
    }

    // If no master key or invalid format, generate one for development
    // WARNING: In production, generating a random master key on startup
    // would make all previously stored keys unreadable!
    this.logger.warn(
      'No valid MASTER_KEY found in environment. Generating a temporary one. ' +
        'This is NOT SECURE for production use. All keys will be lost on restart!',
    );

    const newMasterKey = crypto.randomBytes(32);
    this.logger.log(
      `Temporary master key generated: ${newMasterKey.toString('hex')}`,
    );
    return newMasterKey;
  }

  /**
   * Stores a private key securely with encryption
   */
  async storePrivateKey(userId: string, privateKey: string): Promise<void> {
    if (!userId || !privateKey) {
      throw new BadRequestException('User ID and private key are required');
    }

    const userKeyDir = path.join(this.keyStorePath, userId);

    try {
      if (!fs.existsSync(userKeyDir)) {
        fs.mkdirSync(userKeyDir, { recursive: true });
      }

      // Encrypt the private key before storing
      const { encryptedData, iv, authTag } = this.encryptKey(privateKey);

      // Store the key with its encryption metadata
      const keyData = {
        encryptedKey: encryptedData.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: this.keyEncryptionAlgorithm,
        userId,
        createdAt: new Date().toISOString(),
      };

      await fs.promises.writeFile(
        path.join(userKeyDir, 'private.key'),
        JSON.stringify(keyData),
        { mode: 0o600 }, // Highly restrict file permissions
      );

      this.logger.log(`Private key securely stored for userId=${userId}`);
    } catch (error) {
      this.logger.error(
        `Error storing private key: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to store private key: ${error.message}`,
      );
    }
  }

  /**
   * Stores a public key
   */
  async storePublicKey(userId: string, publicKey: string): Promise<void> {
    if (!userId || !publicKey) {
      throw new BadRequestException('User ID and public key are required');
    }

    const userKeyDir = path.join(this.keyStorePath, userId);

    try {
      if (!fs.existsSync(userKeyDir)) {
        fs.mkdirSync(userKeyDir, { recursive: true });
      }

      await fs.promises.writeFile(
        path.join(userKeyDir, 'public.key'),
        publicKey,
        { mode: 0o644 }, // Public keys can have more permissive mode
      );

      this.logger.log(`Public key stored for userId=${userId}`);
    } catch (error) {
      this.logger.error(
        `Error storing public key: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to store public key: ${error.message}`,
      );
    }
  }

  /**
   * Retrieves a private key, decrypting it first
   */
  async getPrivateKey(userId: string): Promise<string | null> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const userKeyDir = path.join(this.keyStorePath, userId);
    const privateKeyPath = path.join(userKeyDir, 'private.key');

    if (!fs.existsSync(privateKeyPath)) {
      this.logger.warn(`No private key found for userId=${userId}`);
      return null;
    }

    try {
      // Read encrypted key data
      const keyDataJson = await fs.promises.readFile(privateKeyPath, 'utf8');
      const keyData = JSON.parse(keyDataJson);

      // Validate key data
      if (!keyData.encryptedKey || !keyData.iv || !keyData.authTag) {
        throw new BadRequestException('Invalid key data format');
      }

      // Decrypt the private key
      const decryptedKey = this.decryptKey(
        Buffer.from(keyData.encryptedKey, 'base64'),
        Buffer.from(keyData.iv, 'base64'),
        Buffer.from(keyData.authTag, 'base64'),
      );

      return decryptedKey;
    } catch (error) {
      this.logger.error(
        `Error retrieving private key: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to retrieve private key: ${error.message}`,
      );
    }
  }

  /**
   * Retrieves a public key
   */
  async getPublicKey(userId: string): Promise<string | null> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const userKeyDir = path.join(this.keyStorePath, userId);
    const publicKeyPath = path.join(userKeyDir, 'public.key');

    if (!fs.existsSync(publicKeyPath)) {
      this.logger.warn(`No public key found for userId=${userId}`);
      return null;
    }

    try {
      return await fs.promises.readFile(publicKeyPath, 'utf8');
    } catch (error) {
      this.logger.error(
        `Error retrieving public key: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to retrieve public key: ${error.message}`,
      );
    }
  }

  /**
   * Deletes a user's keys
   */
  async deleteUserKeys(userId: string): Promise<boolean> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const userKeyDir = path.join(this.keyStorePath, userId);

    if (!fs.existsSync(userKeyDir)) {
      return false; // No keys to delete
    }

    try {
      // Remove key files - explicit paths for safety
      const privateKeyPath = path.join(userKeyDir, 'private.key');
      const publicKeyPath = path.join(userKeyDir, 'public.key');

      if (fs.existsSync(privateKeyPath)) {
        await fs.promises.unlink(privateKeyPath);
      }

      if (fs.existsSync(publicKeyPath)) {
        await fs.promises.unlink(publicKeyPath);
      }

      // Try to remove directory - will fail if not empty, which is good
      try {
        await fs.promises.rmdir(userKeyDir);
      } catch (e) {
        // Directory not empty or other error, log and continue
        this.logger.warn(`Could not remove key directory: ${e.message}`);
      }

      this.logger.log(`Keys deleted for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting keys: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to delete keys: ${error.message}`);
    }
  }

  /**
   * Rotates a user's keys (generates new ones and replaces old ones)
   */
  async rotateUserKeys(
    userId: string,
    publicKey: string,
    privateKey: string,
  ): Promise<void> {
    try {
      // Store with temporary names first
      const userKeyDir = path.join(this.keyStorePath, userId);

      if (!fs.existsSync(userKeyDir)) {
        fs.mkdirSync(userKeyDir, { recursive: true });
      }

      // Encrypt and store new private key with temporary name
      const { encryptedData, iv, authTag } = this.encryptKey(privateKey);
      const keyData = {
        encryptedKey: encryptedData.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: this.keyEncryptionAlgorithm,
        userId,
        createdAt: new Date().toISOString(),
      };

      const tempPrivateKeyPath = path.join(userKeyDir, 'private.key.new');
      const tempPublicKeyPath = path.join(userKeyDir, 'public.key.new');

      await fs.promises.writeFile(tempPrivateKeyPath, JSON.stringify(keyData), {
        mode: 0o600,
      });

      await fs.promises.writeFile(tempPublicKeyPath, publicKey, {
        mode: 0o644,
      });

      // Now rename to replace old keys - this is more atomic
      const finalPrivateKeyPath = path.join(userKeyDir, 'private.key');
      const finalPublicKeyPath = path.join(userKeyDir, 'public.key');

      if (fs.existsSync(finalPrivateKeyPath)) {
        await fs.promises.rename(
          finalPrivateKeyPath,
          `${finalPrivateKeyPath}.bak`,
        );
      }

      if (fs.existsSync(finalPublicKeyPath)) {
        await fs.promises.rename(
          finalPublicKeyPath,
          `${finalPublicKeyPath}.bak`,
        );
      }

      await fs.promises.rename(tempPrivateKeyPath, finalPrivateKeyPath);
      await fs.promises.rename(tempPublicKeyPath, finalPublicKeyPath);

      // Clean up old backups
      try {
        if (fs.existsSync(`${finalPrivateKeyPath}.bak`)) {
          await fs.promises.unlink(`${finalPrivateKeyPath}.bak`);
        }

        if (fs.existsSync(`${finalPublicKeyPath}.bak`)) {
          await fs.promises.unlink(`${finalPublicKeyPath}.bak`);
        }
      } catch (e) {
        // Log but don't fail if cleanup fails
        this.logger.warn(`Failed to clean up key backups: ${e.message}`);
      }

      this.logger.log(`Keys rotated for userId=${userId}`);
    } catch (error) {
      this.logger.error(`Error rotating keys: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to rotate keys: ${error.message}`);
    }
  }

  /**
   * Encrypts a key using AES-GCM with authentication
   */
  private encryptKey(keyString: string): {
    encryptedData: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    try {
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(16);

      // Create cipher with master key and IV
      const cipher = crypto.createCipheriv(
        this.keyEncryptionAlgorithm,
        this.masterKey,
        iv,
        { authTagLength: 16 },
      );

      // Encrypt the key
      const encryptedData = Buffer.concat([
        cipher.update(keyString, 'utf8'),
        cipher.final(),
      ]);

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      return { encryptedData, iv, authTag };
    } catch (error) {
      this.logger.error(`Encryption error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Key encryption failed');
    }
  }

  /**
   * Decrypts a key using AES-GCM with authentication verification
   */
  private decryptKey(
    encryptedData: Buffer,
    iv: Buffer,
    authTag: Buffer,
  ): string {
    try {
      // Create decipher with master key and IV
      const decipher = crypto.createDecipheriv(
        this.keyEncryptionAlgorithm,
        this.masterKey,
        iv,
        { authTagLength: 16 },
      );

      // Set auth tag for verification
      decipher.setAuthTag(authTag);

      // Decrypt the key
      const decryptedKey = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]);

      return decryptedKey.toString('utf8');
    } catch (error) {
      // Authentication failure or decryption error
      this.logger.error(`Decryption error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Key decryption failed - possible tampering detected',
      );
    }
  }

  /**
   * Checks if keys exist for a user
   */
  async userHasKeys(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const userKeyDir = path.join(this.keyStorePath, userId);
    const privateKeyPath = path.join(userKeyDir, 'private.key');
    const publicKeyPath = path.join(userKeyDir, 'public.key');

    return fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath);
  }
}
