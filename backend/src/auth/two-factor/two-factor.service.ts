import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

interface TOTPSetup {
  secret: string;
  otpauth_url: string;
  qrCode: string;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a one-time code for the user
   */
  async generateOneTimeCode(
    userId: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    try {
      // Generate a random 6-digit code
      const code = crypto.randomInt(100000, 999999).toString();

      // Set expiration time (10 minutes)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // Store the code in the user's record
      await this.userRepository.update(
        { id: userId },
        {
          twoFactorTempSecret: code,
          twoFactorTempSecretExpires: expiresAt,
        },
      );

      this.logger.log(`Generated one-time code for user ${userId}`);

      // In a real system, you would send this via email/SMS instead of returning it
      return { code, expiresAt };
    } catch (error) {
      this.logger.error(
        `Error generating one-time code: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to generate authentication code');
    }
  }

  /**
   * Verifies a one-time code
   */
  async verifyOneTimeCode(userId: string, code: string): Promise<boolean> {
    try {
      // Get user with code info
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'twoFactorTempSecret', 'twoFactorTempSecretExpires'],
      });

      if (
        !user ||
        !user.twoFactorTempSecret ||
        !user.twoFactorTempSecretExpires
      ) {
        this.logger.warn(`No active verification code for user ${userId}`);
        return false;
      }

      // Check if code has expired
      if (new Date() > user.twoFactorTempSecretExpires) {
        this.logger.warn(`Code expired for user ${userId}`);

        // Clean up the expired code
        await this.userRepository.update(
          { id: userId },
          {
            twoFactorTempSecret: null,
            twoFactorTempSecretExpires: null,
          },
        );

        return false;
      }

      // Compare code
      const isValid = user.twoFactorTempSecret === code;

      if (isValid) {
        // Clean up after successful verification
        await this.userRepository.update(
          { id: userId },
          {
            twoFactorTempSecret: null,
            twoFactorTempSecretExpires: null,
          },
        );

        this.logger.log(`Successfully verified code for user ${userId}`);
      } else {
        this.logger.warn(`Invalid code attempt for user ${userId}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error verifying one-time code: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to verify authentication code');
    }
  }

  /**
   * Sets up TOTP (Time-based One-Time Password) for a user
   */
  async setupTOTP(userId: string): Promise<TOTPSetup> {
    try {
      // Get user
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Generate a new secret
      const secret = speakeasy.generateSecret({
        length: 20,
        name: `DocuSense:${user.email}`,
        issuer: 'DocuSense',
      });

      // Store the secret temporarily
      await this.userRepository.update(
        { id: userId },
        {
          twoFactorTempSecret: secret.base32,
          twoFactorTempSecretExpires: null, // Not using expiration for TOTP setup
        },
      );

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      this.logger.log(`TOTP setup initiated for user ${userId}`);

      return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
        qrCode: qrCodeUrl,
      };
    } catch (error) {
      this.logger.error(`Error setting up TOTP: ${error.message}`, error.stack);
      throw new BadRequestException(
        'Failed to set up two-factor authentication',
      );
    }
  }

  /**
   * Verifies TOTP token and completes setup if valid
   */
  async verifyAndEnableTOTP(userId: string, token: string): Promise<boolean> {
    try {
      // Get user with temporary secret
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          'id',
          'twoFactorTempSecret',
          'twoFactorEnabled',
          'twoFactorSecret',
        ],
      });

      if (!user || !user.twoFactorTempSecret) {
        this.logger.warn(`No temporary secret found for user ${userId}`);
        return false;
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorTempSecret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 periods before and after for clock drift
      });

      if (verified) {
        // Complete setup by moving temp secret to permanent secret
        await this.userRepository.update(
          { id: userId },
          {
            twoFactorSecret: user.twoFactorTempSecret,
            twoFactorEnabled: true,
            twoFactorTempSecret: null,
            twoFactorTempSecretExpires: null,
          },
        );

        this.logger.log(`TOTP setup completed for user ${userId}`);
        return true;
      } else {
        this.logger.warn(
          `Invalid TOTP verification attempt for user ${userId}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`Error verifying TOTP: ${error.message}`, error.stack);
      throw new BadRequestException(
        'Failed to verify and enable two-factor authentication',
      );
    }
  }

  /**
   * Verifies a TOTP token for login
   */
  async verifyTOTP(userId: string, token: string): Promise<boolean> {
    try {
      // Get user with TOTP secret
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'twoFactorEnabled', 'twoFactorSecret'],
      });

      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        this.logger.warn(`TOTP not enabled for user ${userId}`);
        return false;
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 periods before and after for clock drift
      });

      if (verified) {
        this.logger.log(`Successful TOTP verification for user ${userId}`);
      } else {
        this.logger.warn(`Failed TOTP verification for user ${userId}`);
      }

      return verified;
    } catch (error) {
      this.logger.error(`Error verifying TOTP: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to verify authentication token');
    }
  }

  /**
   * Disables 2FA for a user
   */
  async disableTwoFactor(userId: string): Promise<boolean> {
    try {
      await this.userRepository.update(
        { id: userId },
        {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorTempSecret: null,
          twoFactorTempSecretExpires: null,
        },
      );

      this.logger.log(`Two-factor authentication disabled for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error disabling 2FA: ${error.message}`, error.stack);
      throw new BadRequestException(
        'Failed to disable two-factor authentication',
      );
    }
  }

  /**
   * Checks if 2FA is enabled for a user
   */
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'twoFactorEnabled'],
      });

      return user?.twoFactorEnabled || false;
    } catch (error) {
      this.logger.error(
        `Error checking 2FA status: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Failed to check two-factor authentication status',
      );
    }
  }

  /**
   * Generates recovery codes for a user
   */
  async generateRecoveryCodes(userId: string): Promise<string[]> {
    try {
      // Generate 8 recovery codes
      const recoveryCodes = Array(8)
        .fill(0)
        .map(
          () =>
            `${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`,
        );

      // Hash the recovery codes for storage
      const hashedCodes = recoveryCodes.map((code) =>
        crypto.createHash('sha256').update(code).digest('hex'),
      );

      // Store the hashed recovery codes
      await this.userRepository.update(
        { id: userId },
        { twoFactorRecoveryCodes: hashedCodes },
      );

      this.logger.log(`Recovery codes generated for user ${userId}`);

      // Return the plain text codes to show to the user
      // These should be shown only once and never stored in plain text
      return recoveryCodes;
    } catch (error) {
      this.logger.error(
        `Error generating recovery codes: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to generate recovery codes');
    }
  }

  /**
   * Verifies a recovery code and disables 2FA if valid
   */
  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    try {
      // Get user with recovery codes
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'twoFactorEnabled', 'twoFactorRecoveryCodes'],
      });

      if (
        !user ||
        !user.twoFactorEnabled ||
        !user.twoFactorRecoveryCodes ||
        user.twoFactorRecoveryCodes.length === 0
      ) {
        this.logger.warn(`No recovery codes found for user ${userId}`);
        return false;
      }

      // Hash the provided code
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

      // Check if the code exists
      const index = user.twoFactorRecoveryCodes.indexOf(hashedCode);

      if (index !== -1) {
        // Remove the used recovery code
        const updatedCodes = [...user.twoFactorRecoveryCodes];
        updatedCodes.splice(index, 1);

        // If this was the last recovery code, disable 2FA
        if (updatedCodes.length === 0) {
          await this.disableTwoFactor(userId);
        } else {
          // Otherwise just update the recovery codes
          await this.userRepository.update(
            { id: userId },
            { twoFactorRecoveryCodes: updatedCodes },
          );
        }

        this.logger.log(`Recovery code used successfully for user ${userId}`);
        return true;
      } else {
        this.logger.warn(`Invalid recovery code attempt for user ${userId}`);
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Error verifying recovery code: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to verify recovery code');
    }
  }
}
