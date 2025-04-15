import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CryptoService } from './crypto.service';
import { CertificateService } from './certificate.service';

/**
 * Service for handling secure end-to-end encrypted communication between client and server
 */
@Injectable()
export class SecureCommunicationService {
  private readonly logger = new Logger(SecureCommunicationService.name);

  // Server-side keypair for communication encryption
  private serverPublicKey: string;
  private serverPrivateKey: string;
  private serverKeyId: string;

  // Configuration
  private readonly sessionKeyExpiryMinutes: number;
  private readonly maxCiphertextSize: number;
  private readonly enableStrictVerification: boolean;

  // Cache for session keys to prevent unnecessary re-encryption for short time periods
  private sessionKeyCache: Map<
    string,
    {
      key: Buffer;
      iv: Buffer;
      expiresAt: Date;
    }
  > = new Map();

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly certificateService: CertificateService,
    private readonly configService: ConfigService,
  ) {
    // Initialize configuration
    this.sessionKeyExpiryMinutes = parseInt(
      this.configService.get('SESSION_KEY_EXPIRY_MINUTES', '15'),
    );
    this.maxCiphertextSize = parseInt(
      this.configService.get('MAX_CIPHERTEXT_SIZE', '1048576'),
    ); // 1MB default
    this.enableStrictVerification =
      this.configService.get('ENABLE_STRICT_VERIFICATION', 'true') === 'true';

    // Initialize server keys for communication
    this.initializeServerKeys().catch((err) => {
      this.logger.error('Failed to initialize server communication keys', err);
    });
  }

  /**
   * Initialize server-side keys for secure communication
   */
  private async initializeServerKeys(): Promise<void> {
    try {
      // Check if keys are already defined in environment variables
      const envPubKey = this.configService.get('COMM_SERVER_PUBLIC_KEY');
      const envPrivKey = this.configService.get('COMM_SERVER_PRIVATE_KEY');

      if (envPubKey && envPrivKey) {
        this.serverPublicKey = envPubKey;
        this.serverPrivateKey = envPrivKey;
        this.serverKeyId = this.generateKeyId(this.serverPublicKey);
        this.logger.log('Loaded server communication keys from environment');
        return;
      }

      // Otherwise, generate new keys
      const { publicKey, privateKey } = await this.generateServerKeyPair();
      this.serverPublicKey = publicKey;
      this.serverPrivateKey = privateKey;
      this.serverKeyId = this.generateKeyId(this.serverPublicKey);

      this.logger.log('Generated new server communication keys');

      // Log key info for configuration (only in development, not recommended for production)
      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.debug(`Server public key: ${this.serverPublicKey}`);
        this.logger.debug(`Server key ID: ${this.serverKeyId}`);
      }
    } catch (error) {
      this.logger.error(
        `Error initializing server communication keys: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate a new server key pair for secure communication
   */
  private async generateServerKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    return new Promise<{ publicKey: string; privateKey: string }>(
      (resolve, reject) => {
        crypto.generateKeyPair(
          'rsa',
          {
            modulusLength: 4096,
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
      },
    );
  }

  /**
   * Generate a key ID from a public key
   */
  private generateKeyId(publicKey: string): string {
    return crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get server public key for client-side encryption
   * @returns The server public key and key ID
   */
  getServerPublicKey(): { publicKey: string; keyId: string } {
    return {
      publicKey: this.serverPublicKey,
      keyId: this.serverKeyId,
    };
  }

  /**
   * Encrypt a message for secure transmission to a specific user
   * @param userId User ID to encrypt message for
   * @param message Message content to encrypt
   * @returns Encrypted message package with all necessary metadata
   */
  async encryptForUser(
    userId: string,
    message: string | object,
  ): Promise<{
    encryptedData: string;
    keyId: string;
    sessionId: string;
    timestamp: number;
    algorithm: string;
    iv: string;
  }> {
    try {
      // Convert message to string if it's an object
      const messageStr =
        typeof message === 'object'
          ? JSON.stringify(message)
          : message.toString();

      // Get public key
      const userPublicKey = await this.cryptoService.getUserPublicKey(userId);
      if (!userPublicKey) {
        throw new BadRequestException('User does not have a public key');
      }

      // If strict verification is enabled, verify the user certificate
      if (this.enableStrictVerification) {
        const publicKeyHash = crypto
          .createHash('sha256')
          .update(userPublicKey)
          .digest('hex');

        const certVerification =
          await this.certificateService.verifyUserCertificate(
            userId,
            publicKeyHash,
          );

        if (!certVerification.valid) {
          throw new UnauthorizedException(
            `User certificate is not valid: ${certVerification.reason}`,
          );
        }
      }

      // Generate a unique session ID
      const sessionId = crypto.randomBytes(16).toString('hex');

      // Create a one-time AES session key for this message
      const sessionKey = crypto.randomBytes(32); // 256 bits
      const iv = crypto.randomBytes(16);

      // Encrypt the message content with AES
      const cipher = crypto.createCipheriv('aes-256-cbc', sessionKey, iv);
      const encryptedContent = Buffer.concat([
        cipher.update(messageStr, 'utf8'),
        cipher.final(),
      ]);

      // Encrypt the session key with the user's public key
      const encryptedSessionKey = crypto.publicEncrypt(
        {
          key: userPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        sessionKey,
      );

      // Create the final encrypted package
      const encryptedPackage = {
        version: '1.0',
        encryptedSessionKey: encryptedSessionKey.toString('base64'),
        encryptedContent: encryptedContent.toString('base64'),
        iv: iv.toString('base64'),
        sessionId,
        timestamp: Date.now(),
        keyId: this.generateKeyId(userPublicKey),
        algorithm: 'RSA-OAEP/AES-256-CBC',
      };

      // Encode the entire package as base64
      const encryptedData = Buffer.from(
        JSON.stringify(encryptedPackage),
      ).toString('base64');

      return {
        encryptedData,
        keyId: encryptedPackage.keyId,
        sessionId: encryptedPackage.sessionId,
        timestamp: encryptedPackage.timestamp,
        algorithm: encryptedPackage.algorithm,
        iv: encryptedPackage.iv,
      };
    } catch (error) {
      this.logger.error(
        `Error encrypting message for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to encrypt message: ${error.message}`,
      );
    }
  }

  /**
   * Decrypt a message received from a client
   * @param encryptedData Encrypted message data
   * @param userId ID of user who sent the message
   * @returns Decrypted message content
   */
  async decryptFromClient(
    encryptedData: string,
    userId: string,
  ): Promise<string> {
    try {
      // Check size constraints
      if (encryptedData.length > this.maxCiphertextSize) {
        throw new BadRequestException(
          'Encrypted data exceeds maximum allowed size',
        );
      }

      // Decode the encrypted package
      let encryptedPackage;
      try {
        const packageStr = Buffer.from(encryptedData, 'base64').toString(
          'utf8',
        );
        encryptedPackage = JSON.parse(packageStr);
      } catch (error) {
        throw new BadRequestException('Invalid encrypted data format');
      }

      // Validate package structure
      if (
        !encryptedPackage.encryptedSessionKey ||
        !encryptedPackage.encryptedContent ||
        !encryptedPackage.iv
      ) {
        throw new BadRequestException('Incomplete encrypted package');
      }

      // Verify timestamp to prevent replay attacks
      const messageTime = new Date(encryptedPackage.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - messageTime.getTime()) / (1000 * 60);

      if (diffMinutes > 10) {
        // 10 minutes allowed time difference
        throw new UnauthorizedException(
          'Message timestamp too old, possible replay attack',
        );
      }

      // If strict verification is enabled, verify the user certificate
      if (this.enableStrictVerification) {
        // Get user's public key
        const userPublicKey = await this.cryptoService.getUserPublicKey(userId);
        if (!userPublicKey) {
          throw new BadRequestException('User does not have a public key');
        }

        const publicKeyHash = crypto
          .createHash('sha256')
          .update(userPublicKey)
          .digest('hex');

        const certVerification =
          await this.certificateService.verifyUserCertificate(
            userId,
            publicKeyHash,
          );

        if (!certVerification.valid) {
          throw new UnauthorizedException(
            `User certificate is not valid: ${certVerification.reason}`,
          );
        }
      }

      // Decrypt session key with server private key
      const encryptedSessionKey = Buffer.from(
        encryptedPackage.encryptedSessionKey,
        'base64',
      );

      const sessionKey = crypto.privateDecrypt(
        {
          key: this.serverPrivateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        encryptedSessionKey,
      );

      // Decrypt content with session key
      const iv = Buffer.from(encryptedPackage.iv, 'base64');
      const encryptedContent = Buffer.from(
        encryptedPackage.encryptedContent,
        'base64',
      );

      const decipher = crypto.createDecipheriv('aes-256-cbc', sessionKey, iv);
      const decryptedContent = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
      ]).toString('utf8');

      return decryptedContent;
    } catch (error) {
      this.logger.error(
        `Error decrypting message from user ${userId}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to decrypt message: ${error.message}`,
      );
    }
  }

  /**
   * Create a secure session for a user
   * Session keys are cached and reused for a short time to optimize performance
   * @param userId User ID to create session for
   * @returns Session key details for encrypted communication
   */
  async createSecureSession(userId: string): Promise<{
    sessionId: string;
    publicKey: string;
    keyId: string;
    encryptedSessionKey: string;
    iv: string;
    expiresAt: number;
  }> {
    try {
      // Check if there's a valid cached session
      const cacheKey = `session_${userId}`;
      const cachedSession = this.sessionKeyCache.get(cacheKey);

      if (cachedSession && cachedSession.expiresAt > new Date()) {
        // Use cached session
        const userPublicKey = await this.cryptoService.getUserPublicKey(userId);
        const encryptedSessionKey = crypto.publicEncrypt(
          {
            key: userPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          },
          cachedSession.key,
        );

        const sessionId = crypto.randomBytes(16).toString('hex');
        const expiresAt = cachedSession.expiresAt.getTime();

        return {
          sessionId,
          publicKey: this.serverPublicKey,
          keyId: this.serverKeyId,
          encryptedSessionKey: encryptedSessionKey.toString('base64'),
          iv: cachedSession.iv.toString('base64'),
          expiresAt,
        };
      }

      // Create a new session
      const sessionKey = crypto.randomBytes(32); // 256 bits
      const iv = crypto.randomBytes(16);
      const sessionId = crypto.randomBytes(16).toString('hex');

      // Calculate expiry time
      const expiresAt = new Date();
      expiresAt.setMinutes(
        expiresAt.getMinutes() + this.sessionKeyExpiryMinutes,
      );

      // Cache the session
      this.sessionKeyCache.set(cacheKey, {
        key: sessionKey,
        iv,
        expiresAt,
      });

      // Schedule cleanup after expiry
      setTimeout(
        () => {
          this.sessionKeyCache.delete(cacheKey);
        },
        this.sessionKeyExpiryMinutes * 60 * 1000,
      );

      // Get user's public key
      const userPublicKey = await this.cryptoService.getUserPublicKey(userId);
      if (!userPublicKey) {
        throw new BadRequestException('User does not have a public key');
      }

      // Encrypt session key with user's public key
      const encryptedSessionKey = crypto.publicEncrypt(
        {
          key: userPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        sessionKey,
      );

      return {
        sessionId,
        publicKey: this.serverPublicKey,
        keyId: this.serverKeyId,
        encryptedSessionKey: encryptedSessionKey.toString('base64'),
        iv: iv.toString('base64'),
        expiresAt: expiresAt.getTime(),
      };
    } catch (error) {
      this.logger.error(
        `Error creating secure session for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create secure session: ${error.message}`,
      );
    }
  }

  /**
   * Generate a signed challenge for client authentication
   * @param userId User ID requesting authentication
   * @returns Signed challenge for the client to verify
   */
  async generateAuthChallenge(userId: string): Promise<{
    challenge: string;
    signature: string;
    timestamp: number;
    expiresAt: number;
  }> {
    try {
      // Generate a random challenge
      const challenge = crypto.randomBytes(32).toString('hex');

      // Create challenge payload
      const timestamp = Date.now();
      const expiresAt = timestamp + 5 * 60 * 1000; // 5 minutes

      const payload = JSON.stringify({
        userId,
        challenge,
        timestamp,
        expiresAt,
      });

      // Sign the challenge with server private key
      const sign = crypto.createSign('SHA256');
      sign.update(payload);
      sign.end();
      const signature = sign.sign(this.serverPrivateKey, 'base64');

      return {
        challenge,
        signature,
        timestamp,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(
        `Error generating auth challenge for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate auth challenge: ${error.message}`,
      );
    }
  }

  /**
   * Verify a client's response to an authentication challenge
   * @param userId User ID to verify
   * @param challenge The original challenge
   * @param response Client's signed response
   * @returns Whether the verification was successful
   */
  async verifyAuthChallengeResponse(
    userId: string,
    challenge: string,
    response: string,
  ): Promise<boolean> {
    try {
      // Get user's public key
      const userPublicKey = await this.cryptoService.getUserPublicKey(userId);
      if (!userPublicKey) {
        throw new BadRequestException('User does not have a public key');
      }

      // If strict verification is enabled, verify the user certificate
      if (this.enableStrictVerification) {
        const publicKeyHash = crypto
          .createHash('sha256')
          .update(userPublicKey)
          .digest('hex');

        const certVerification =
          await this.certificateService.verifyUserCertificate(
            userId,
            publicKeyHash,
          );

        if (!certVerification.valid) {
          throw new UnauthorizedException(
            `User certificate is not valid: ${certVerification.reason}`,
          );
        }
      }

      // Verify the challenge response
      const verify = crypto.createVerify('SHA256');
      verify.update(challenge);
      verify.end();

      return verify.verify(userPublicKey, response, 'base64');
    } catch (error) {
      this.logger.error(
        `Error verifying auth challenge for user ${userId}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to verify auth challenge response: ${error.message}`,
      );
    }
  }

  /**
   * Perform a secure handshake with a client
   * This establishes encryption parameters for the session
   * @param userId User ID for the handshake
   * @returns Handshake parameters for client communication
   */
  async performSecureHandshake(userId: string): Promise<{
    sessionId: string;
    encryptionParams: {
      serverKeyId: string;
      algorithm: string;
      sessionKey: string; // Encrypted session key
      iv: string;
    };
    authChallenge: {
      challenge: string;
      signature: string;
      timestamp: number;
    };
  }> {
    // Create a secure session
    const session = await this.createSecureSession(userId);

    // Generate an auth challenge
    const challenge = await this.generateAuthChallenge(userId);

    return {
      sessionId: session.sessionId,
      encryptionParams: {
        serverKeyId: this.serverKeyId,
        algorithm: 'AES-256-CBC',
        sessionKey: session.encryptedSessionKey,
        iv: session.iv,
      },
      authChallenge: {
        challenge: challenge.challenge,
        signature: challenge.signature,
        timestamp: challenge.timestamp,
      },
    };
  }
}
