import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import {
  Certificate,
  CertificateStatus,
  RevocationReason,
} from './entities/certificate.entity';
import { CryptoService } from './crypto.service';
import { KeyStorageService } from './key-storage.service';
import { KeyRotationService } from './key-rotation.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);
  private readonly crlRefreshInterval: number; // in minutes
  private crlCache: {
    serialNumber: string;
    revokedAt: Date;
    reason: string;
  }[] = [];
  private crlLastUpdate: Date = new Date(0); // Initialize with epoch

  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly cryptoService: CryptoService,
    private readonly keyStorageService: KeyStorageService,
    private readonly keyRotationService: KeyRotationService,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.crlRefreshInterval = parseInt(
      this.configService.get('CRL_REFRESH_INTERVAL_MINUTES', '15'),
    );
    // Initialize CRL
    this.refreshCRL().catch((err) =>
      this.logger.error('Failed to initialize CRL', err),
    );
  }

  /**
   * Issues a new certificate for a user
   * @param userId User ID to issue certificate for
   * @param validityPeriodDays How long the certificate should be valid for
   * @param options Additional certificate options
   * @returns The newly issued certificate
   */
  async issueCertificate(
    userId: string,
    validityPeriodDays: number = 365,
    options: {
      metadata?: Record<string, any>;
      canSign?: boolean;
      canEncrypt?: boolean;
      canAuthenticate?: boolean;
      securityLevel?: string;
    } = {},
  ): Promise<Certificate> {
    // Verify user exists
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get user's public key
    const publicKey = await this.keyStorageService.getPublicKey(userId);
    if (!publicKey) {
      // Generate keys if they don't exist
      await this.cryptoService.generateKeyPair(userId);
      const newPublicKey = await this.keyStorageService.getPublicKey(userId);
      if (!newPublicKey) {
        throw new BadRequestException('Failed to generate keys for user');
      }
    }

    // Get the public key (again) to ensure it's the latest
    const userPublicKey = await this.keyStorageService.getPublicKey(userId);

    // Calculate certificate properties
    const keyId = this.generateKeyId(userPublicKey);
    const publicKeyHash = this.hashPublicKey(userPublicKey);
    const fingerprint = this.generateFingerprint(userPublicKey, userId);

    // Set validity period
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityPeriodDays);

    // Check if a certificate with this fingerprint already exists
    const existingCert = await this.certificateRepository.findOne({
      where: { fingerprint },
    });

    if (existingCert) {
      throw new ConflictException(
        'A certificate with the same key already exists for this user',
      );
    }

    // Create certificate record
    const certificate = this.certificateRepository.create({
      userId,
      publicKeyHash,
      keyId,
      validFrom,
      validUntil,
      status: CertificateStatus.ACTIVE,
      fingerprint,
      canSign: options.canSign !== undefined ? options.canSign : true,
      canEncrypt: options.canEncrypt !== undefined ? options.canEncrypt : true,
      canAuthenticate:
        options.canAuthenticate !== undefined ? options.canAuthenticate : true,
      securityLevel: options.securityLevel || 'standard',
      rotationGeneration: 0,
      metadata: {
        ...options.metadata,
        issuer: 'DocuSense Internal CA',
        issuedAt: new Date().toISOString(),
        algorithm: 'RSA-4096',
      },
    });

    // Save the certificate
    const savedCertificate = await this.certificateRepository.save(certificate);

    // Log certificate issuance in audit system
    await this.auditLogService.log(AuditAction.USER_UPDATE, 'system', userId, {
      action: 'certificate_issuance',
      certificateId: savedCertificate.id,
      validFrom: validFrom.toISOString(),
      validUntil: validUntil.toISOString(),
    });

    this.logger.log(
      `Certificate issued for user ${userId}: ${savedCertificate.id}`,
    );

    return savedCertificate;
  }

  /**
   * Revokes a certificate
   * @param certificateId ID of certificate to revoke
   * @param reason Reason for revocation
   * @param details Additional details about revocation
   * @param revokedBy ID of user revoking the certificate (or 'system')
   * @returns The revoked certificate
   */
  async revokeCertificate(
    certificateId: string,
    reason: RevocationReason,
    details: string,
    revokedBy: string,
  ): Promise<Certificate> {
    // Find the certificate
    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId },
    });

    if (!certificate) {
      throw new NotFoundException(
        `Certificate with ID ${certificateId} not found`,
      );
    }

    // Check if certificate is already revoked
    if (certificate.status === CertificateStatus.REVOKED) {
      throw new BadRequestException(`Certificate is already revoked`);
    }

    // Check if certificate is expired
    if (certificate.status === CertificateStatus.EXPIRED) {
      throw new BadRequestException(`Cannot revoke expired certificate`);
    }

    // Update certificate status
    certificate.status = CertificateStatus.REVOKED;
    certificate.revokedAt = new Date();
    certificate.revocationReason = reason;
    certificate.revocationDetails = details;
    certificate.revokedBy = revokedBy;

    // Save updates
    const updatedCertificate =
      await this.certificateRepository.save(certificate);

    // Refresh CRL
    await this.refreshCRL();

    // Log certificate revocation in audit system
    await this.auditLogService.log(
      AuditAction.USER_UPDATE,
      revokedBy,
      certificate.userId,
      {
        action: 'certificate_revocation',
        certificateId,
        reason,
        details,
      },
    );

    // If revocation is due to key compromise, trigger key rotation
    if (
      reason === RevocationReason.KEY_COMPROMISE ||
      reason === RevocationReason.SECURITY_INCIDENT
    ) {
      this.logger.warn(
        `Security incident detected for user ${certificate.userId}. Triggering key rotation.`,
      );

      // Rotate user keys immediately
      await this.keyRotationService.rotateUserKeys(
        certificate.userId,
        `Certificate revoked due to ${reason}`,
        revokedBy,
      );

      // If it's a serious security incident, consider forcing rotation for all users
      if (reason === RevocationReason.SECURITY_INCIDENT) {
        this.keyRotationService.triggerSecurityBreachAlert();
      }
    }

    this.logger.log(
      `Certificate ${certificateId} revoked by ${revokedBy} due to ${reason}: ${details}`,
    );

    return updatedCertificate;
  }

  /**
   * Verifies if a certificate is valid and not revoked
   * @param certificateId ID of certificate to verify
   * @returns Verification result with details
   */
  async verifyCertificate(certificateId: string): Promise<{
    valid: boolean;
    status: CertificateStatus;
    reason?: string;
    details?: Record<string, any>;
  }> {
    // Find the certificate
    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId },
    });

    if (!certificate) {
      return {
        valid: false,
        status: null,
        reason: 'Certificate not found',
      };
    }

    // Get current date
    const now = new Date();

    // Check if certificate is expired
    if (certificate.validUntil < now) {
      // Mark as expired if not already
      if (certificate.status !== CertificateStatus.EXPIRED) {
        certificate.status = CertificateStatus.EXPIRED;
        await this.certificateRepository.save(certificate);
      }

      return {
        valid: false,
        status: CertificateStatus.EXPIRED,
        reason: 'Certificate has expired',
        details: {
          validUntil: certificate.validUntil.toISOString(),
          currentTime: now.toISOString(),
        },
      };
    }

    // Check if certificate is revoked
    if (certificate.status === CertificateStatus.REVOKED) {
      return {
        valid: false,
        status: CertificateStatus.REVOKED,
        reason: `Certificate was revoked: ${certificate.revocationReason}`,
        details: {
          revokedAt: certificate.revokedAt?.toISOString(),
          reason: certificate.revocationReason,
          details: certificate.revocationDetails,
        },
      };
    }

    // Check if certificate is in pending state
    if (certificate.status === CertificateStatus.PENDING) {
      return {
        valid: false,
        status: CertificateStatus.PENDING,
        reason: 'Certificate is pending activation',
      };
    }

    // Certificate is valid
    return {
      valid: true,
      status: certificate.status,
      details: {
        validFrom: certificate.validFrom.toISOString(),
        validUntil: certificate.validUntil.toISOString(),
        canSign: certificate.canSign,
        canEncrypt: certificate.canEncrypt,
        canAuthenticate: certificate.canAuthenticate,
      },
    };
  }

  /**
   * Verifies a user's certificate based on the public key hash
   * Useful for verifying signatures
   * @param userId User ID to check
   * @param publicKeyHash Hash of the public key to verify
   * @returns Verification result with details
   */
  async verifyUserCertificate(
    userId: string,
    publicKeyHash: string,
  ): Promise<{
    valid: boolean;
    certificateId?: string;
    status?: CertificateStatus;
    reason?: string;
  }> {
    // Find certificate by user ID and public key hash
    const certificate = await this.certificateRepository.findOne({
      where: {
        userId,
        publicKeyHash,
        status: CertificateStatus.ACTIVE,
      },
    });

    if (!certificate) {
      // Check if it's revoked
      const revokedCert = await this.certificateRepository.findOne({
        where: {
          userId,
          publicKeyHash,
          status: CertificateStatus.REVOKED,
        },
      });

      if (revokedCert) {
        return {
          valid: false,
          certificateId: revokedCert.id,
          status: CertificateStatus.REVOKED,
          reason: `Certificate was revoked: ${revokedCert.revocationReason}`,
        };
      }

      // Check if it's expired
      const expiredCert = await this.certificateRepository.findOne({
        where: {
          userId,
          publicKeyHash,
          status: CertificateStatus.EXPIRED,
        },
      });

      if (expiredCert) {
        return {
          valid: false,
          certificateId: expiredCert.id,
          status: CertificateStatus.EXPIRED,
          reason: 'Certificate has expired',
        };
      }

      return {
        valid: false,
        reason: 'No valid certificate found for this key',
      };
    }

    // Check if certificate is still valid (not expired)
    const now = new Date();
    if (certificate.validUntil < now) {
      // Mark as expired
      certificate.status = CertificateStatus.EXPIRED;
      await this.certificateRepository.save(certificate);

      return {
        valid: false,
        certificateId: certificate.id,
        status: CertificateStatus.EXPIRED,
        reason: 'Certificate has expired',
      };
    }

    // Check if certificate is in the CRL
    if (await this.isCertificateRevoked(certificate.id)) {
      return {
        valid: false,
        certificateId: certificate.id,
        status: CertificateStatus.REVOKED,
        reason: 'Certificate is in the revocation list',
      };
    }

    // Certificate is valid
    return {
      valid: true,
      certificateId: certificate.id,
      status: CertificateStatus.ACTIVE,
    };
  }

  /**
   * Gets the Certificate Revocation List (CRL)
   * @returns Array of revoked certificate information
   */
  async getCRL(): Promise<
    { serialNumber: string; revokedAt: Date; reason: string }[]
  > {
    // Refresh CRL if needed
    const now = new Date();
    const elapsedMinutes =
      (now.getTime() - this.crlLastUpdate.getTime()) / (1000 * 60);

    if (elapsedMinutes > this.crlRefreshInterval) {
      await this.refreshCRL();
    }

    return this.crlCache;
  }

  /**
   * Refreshes the Certificate Revocation List cache
   */
  private async refreshCRL(): Promise<void> {
    try {
      // Get all revoked certificates
      const revokedCertificates = await this.certificateRepository.find({
        where: {
          status: CertificateStatus.REVOKED,
          revokedAt: Not(IsNull()),
        },
        select: ['id', 'revokedAt', 'revocationReason'],
      });

      // Update cache
      this.crlCache = revokedCertificates.map((cert) => ({
        serialNumber: cert.id,
        revokedAt: cert.revokedAt,
        reason: cert.revocationReason,
      }));

      this.crlLastUpdate = new Date();
      this.logger.log(
        `CRL refreshed: ${this.crlCache.length} certificates in revocation list`,
      );
    } catch (error) {
      this.logger.error(`Error refreshing CRL: ${error.message}`, error.stack);
    }
  }

  /**
   * Checks if a certificate is in the revocation list
   * @param certificateId ID of certificate to check
   * @returns True if the certificate is revoked
   */
  private async isCertificateRevoked(certificateId: string): Promise<boolean> {
    // First check the cache
    const cachedEntry = this.crlCache.find(
      (entry) => entry.serialNumber === certificateId,
    );
    if (cachedEntry) {
      return true;
    }

    // If not in cache, check the database directly
    // This is a safeguard in case the CRL cache is not up to date
    const revokedCert = await this.certificateRepository.findOne({
      where: {
        id: certificateId,
        status: CertificateStatus.REVOKED,
      },
    });

    return !!revokedCert;
  }

  /**
   * Automatically cleanups expired certificates
   * Sets their status to EXPIRED
   */
  async cleanupExpiredCertificates(): Promise<number> {
    const now = new Date();

    // Find all active certificates that have expired
    const expiredCertificates = await this.certificateRepository.find({
      where: {
        status: CertificateStatus.ACTIVE,
        validUntil: LessThan(now),
      },
    });

    // Update them to expired status
    if (expiredCertificates.length > 0) {
      await this.certificateRepository.update(
        expiredCertificates.map((cert) => cert.id),
        { status: CertificateStatus.EXPIRED },
      );
    }

    this.logger.log(
      `Marked ${expiredCertificates.length} certificates as expired`,
    );
    return expiredCertificates.length;
  }

  /**
   * Gets all certificates for a user
   * @param userId User ID to get certificates for
   * @returns Array of user certificates
   */
  async getUserCertificates(userId: string): Promise<Certificate[]> {
    return this.certificateRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Finds a certificate by its ID
   * @param id Certificate ID
   * @returns The certificate or throws NotFoundException
   */
  async findCertificateById(id: string): Promise<Certificate> {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
    });

    if (!certificate) {
      throw new NotFoundException(`Certificate with ID ${id} not found`);
    }

    return certificate;
  }

  /**
   * Gets all active certificates for a user
   * @param userId User ID to get certificates for
   * @returns Array of active user certificates
   */
  async getActiveUserCertificates(userId: string): Promise<Certificate[]> {
    return this.certificateRepository.find({
      where: {
        userId,
        status: CertificateStatus.ACTIVE,
        validUntil: LessThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Generates a key ID from a public key
   * @param publicKey PEM encoded public key
   * @returns Key ID string
   */
  private generateKeyId(publicKey: string): string {
    return crypto
      .createHash('sha256')
      .update(
        publicKey.replace(
          /-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g,
          '',
        ),
      )
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Hashes a public key for storage and comparison
   * @param publicKey PEM encoded public key
   * @returns Hash of the public key
   */
  private hashPublicKey(publicKey: string): string {
    return crypto
      .createHash('sha256')
      .update(
        publicKey.replace(
          /-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g,
          '',
        ),
      )
      .digest('hex');
  }

  /**
   * Generates a certificate fingerprint
   * @param publicKey PEM encoded public key
   * @param userId User ID
   * @returns Certificate fingerprint
   */
  private generateFingerprint(publicKey: string, userId: string): string {
    const data = `${publicKey}${userId}${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Gets statistics about certificates in the system
   * @returns Statistical data about certificates
   */
  async getCertificateStats(): Promise<Record<string, any>> {
    try {
      const totalCertificates = await this.certificateRepository.count();

      const activeCertificates = await this.certificateRepository.count({
        where: { status: CertificateStatus.ACTIVE },
      });

      const revokedCertificates = await this.certificateRepository.count({
        where: { status: CertificateStatus.REVOKED },
      });

      const expiredCertificates = await this.certificateRepository.count({
        where: { status: CertificateStatus.EXPIRED },
      });

      const pendingCertificates = await this.certificateRepository.count({
        where: { status: CertificateStatus.PENDING },
      });

      // Calculate expiring soon certificates (within 30 days)
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + 30);

      const expiringCertificates = await this.certificateRepository.count({
        where: {
          status: CertificateStatus.ACTIVE,
          validUntil: LessThan(expiringDate),
        },
      });

      // Revocation reasons breakdown
      const revocationReasons = await this.certificateRepository
        .createQueryBuilder('cert')
        .select('cert.revocationReason', 'reason')
        .addSelect('COUNT(*)', 'count')
        .where('cert.status = :status', { status: CertificateStatus.REVOKED })
        .groupBy('cert.revocationReason')
        .getRawMany();

      // Security levels breakdown
      const securityLevels = await this.certificateRepository
        .createQueryBuilder('cert')
        .select('cert.securityLevel', 'level')
        .addSelect('COUNT(*)', 'count')
        .groupBy('cert.securityLevel')
        .getRawMany();

      return {
        totalCertificates,
        activeCertificates,
        revokedCertificates,
        expiredCertificates,
        pendingCertificates,
        expiringCertificates,
        revocationReasons: revocationReasons.reduce((acc, item) => {
          acc[item.reason || 'unspecified'] = parseInt(item.count);
          return acc;
        }, {}),
        securityLevels: securityLevels.reduce((acc, item) => {
          acc[item.level || 'standard'] = parseInt(item.count);
          return acc;
        }, {}),
        crlLastUpdate: this.crlLastUpdate,
        crlSize: this.crlCache.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting certificate stats: ${error.message}`,
        error.stack,
      );
      return {
        error: 'Failed to retrieve certificate statistics',
      };
    }
  }
}
