import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CryptoService } from './crypto.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

/**
 * Service responsible for handling automatic key rotation based on security policies
 */
@Injectable()
export class KeyRotationService {
  private readonly logger = new Logger(KeyRotationService.name);

  // Key rotation configuration (configurable via environment variables)
  private readonly keyRotationFrequency: number; // In days
  private readonly keyRotationBatchSize: number;
  private readonly forceRotationOnBreaches: boolean;
  private readonly rotationIsActive: boolean;

  // Tracking for security incidents
  private securityBreachDetected = false;

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    // Initialize configuration from environment variables
    this.keyRotationFrequency = parseInt(
      this.configService.get('KEY_ROTATION_FREQUENCY_DAYS', '90'),
    );
    this.keyRotationBatchSize = parseInt(
      this.configService.get('KEY_ROTATION_BATCH_SIZE', '20'),
    );
    this.forceRotationOnBreaches =
      this.configService.get('FORCE_ROTATION_ON_BREACHES', 'true') === 'true';
    this.rotationIsActive =
      this.configService.get('ENABLE_KEY_ROTATION', 'true') === 'true';

    this.logger.log(
      `Key rotation service initialized with: frequency=${this.keyRotationFrequency} days, ` +
        `batchSize=${this.keyRotationBatchSize}, active=${this.rotationIsActive}`,
    );
  }

  /**
   * Triggers a security breach alert that will force key rotation
   * for all users on next scheduled rotation
   */
  triggerSecurityBreachAlert(): void {
    this.securityBreachDetected = true;
    this.logger.warn(
      'Security breach alert triggered - forcing key rotation for all users',
    );

    // Log to audit system
    this.auditLogService.log(AuditAction.PERMISSION_UPDATE, 'system', null, {
      action: 'security_breach_alert',
      forceRotation: true,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Manually trigger key rotation for a specific user
   * @param userId ID of user whose keys should be rotated
   * @param reason Reason for the rotation
   * @param adminId ID of admin requesting the rotation (if applicable)
   */
  async rotateUserKeys(
    userId: string,
    reason: string,
    adminId?: string,
  ): Promise<boolean> {
    this.logger.log(`Manual key rotation requested for user ${userId}`);

    try {
      // Generate new key pair
      await this.cryptoService.rotateUserKeys(userId);

      // Log the rotation in audit system
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        adminId || 'system',
        userId,
        {
          action: 'key_rotation',
          manual: true,
          reason,
        },
      );

      this.logger.log(`Successfully rotated keys for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to rotate keys for user ${userId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Scheduled job that runs periodically to rotate keys that are due for rotation
   * Runs daily at 3 AM to minimize system impact
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledKeyRotation() {
    if (!this.rotationIsActive) {
      this.logger.log('Scheduled key rotation skipped - rotation is disabled');
      return;
    }

    this.logger.log('Starting scheduled key rotation');

    try {
      // Calculate the date threshold for rotation
      const rotationThreshold = new Date();
      rotationThreshold.setDate(
        rotationThreshold.getDate() - this.keyRotationFrequency,
      );

      // Find users whose keys need to be rotated based on key age
      // or force all users if security breach detected
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      if (this.securityBreachDetected && this.forceRotationOnBreaches) {
        // If breach detected, get all users with keys
        this.logger.warn(
          'Processing forced key rotation due to security breach',
        );
      } else {
        // Otherwise, only get users whose keys are older than threshold
        queryBuilder.where('user.keyCreatedAt <= :threshold', {
          threshold: rotationThreshold,
        });
      }

      // Get users in batches to avoid overloading the system
      const usersToRotate = await queryBuilder
        .limit(this.keyRotationBatchSize)
        .getMany();

      this.logger.log(
        `Found ${usersToRotate.length} users requiring key rotation`,
      );

      // Process each user
      let successCount = 0;
      let failureCount = 0;

      for (const user of usersToRotate) {
        try {
          // Rotate the user's keys
          await this.cryptoService.rotateUserKeys(user.id);

          // Update the key rotation date
          await this.userRepository.update(
            { id: user.id },
            {
              keyCreatedAt: new Date(),
              keyRotationCount: () => 'key_rotation_count + 1',
            },
          );

          // Log the rotation in audit system
          await this.auditLogService.log(
            AuditAction.USER_UPDATE,
            'system',
            user.id,
            {
              action: 'key_rotation',
              scheduled: true,
              forcedByBreach:
                this.securityBreachDetected && this.forceRotationOnBreaches,
            },
          );

          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to rotate keys for user ${user.id}: ${error.message}`,
            error.stack,
          );
          failureCount++;
        }
      }

      this.logger.log(
        `Completed key rotation: ${successCount} successful, ${failureCount} failed`,
      );

      // Reset security breach flag if all users have been processed
      if (
        this.securityBreachDetected &&
        usersToRotate.length < this.keyRotationBatchSize
      ) {
        this.securityBreachDetected = false;
        this.logger.log('Security breach alert cleared - all users processed');
      }
    } catch (error) {
      this.logger.error(
        `Error during scheduled key rotation: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Provides a health check and statistics for the key rotation system
   */
  async getKeyRotationStats(): Promise<any> {
    try {
      const totalUsers = await this.userRepository.count();

      const overdueQuery = this.userRepository.createQueryBuilder('user');
      const rotationThreshold = new Date();
      rotationThreshold.setDate(
        rotationThreshold.getDate() - this.keyRotationFrequency,
      );
      overdueQuery.where('user.keyCreatedAt <= :threshold', {
        threshold: rotationThreshold,
      });
      const overdueUsers = await overdueQuery.getCount();

      // Get average rotation age
      const avgRotationQuery = await this.userRepository
        .createQueryBuilder('user')
        .select(
          'AVG(EXTRACT(EPOCH FROM (NOW() - user.keyCreatedAt)))/86400',
          'avgAge',
        )
        .getRawOne();

      const avgKeyAge = avgRotationQuery
        ? Math.round(parseFloat(avgRotationQuery.avgAge) || 0)
        : 0;

      return {
        isActive: this.rotationIsActive,
        securityBreachDetected: this.securityBreachDetected,
        keyRotationFrequency: this.keyRotationFrequency,
        totalUsers,
        overdueUsers,
        averageKeyAgeDays: avgKeyAge,
        nextScheduledRotation: 'Daily at 3 AM',
      };
    } catch (error) {
      this.logger.error(
        `Error retrieving key rotation stats: ${error.message}`,
        error.stack,
      );
      return {
        error: 'Failed to retrieve key rotation statistics',
        isActive: this.rotationIsActive,
      };
    }
  }
}
