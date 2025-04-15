import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
  HttpStatus,
  HttpCode,
  Delete,
  Query,
  Headers,
  Ip,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CertificateService } from './certificate.service';
import { Certificate, RevocationReason } from './entities/certificate.entity';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { RevokeCertificateDto } from './dto/revoke-certificate.dto';
import { VerifyCertificateDto } from './dto/verify-certificate.dto';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

@Controller('api/certificates')
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get all certificates for the authenticated user
   */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyCertificates(@Request() req) {
    return this.certificateService.getUserCertificates(req.user.id);
  }

  /**
   * Get all certificates for a specified user
   * Admin only endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async getUserCertificates(@Param('userId') userId: string, @Request() req) {
    // Only admins can see certificates for other users
    if (userId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to view these certificates',
      );
    }

    return this.certificateService.getUserCertificates(userId);
  }

  /**
   * Get a specific certificate by ID
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getCertificate(@Param('id') id: string, @Request() req) {
    const certificate = await this.certificateService.findCertificateById(id);

    // Users can only see their own certificates unless they're an admin
    if (certificate.userId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to view this certificate',
      );
    }

    return certificate;
  }

  /**
   * Issue a new certificate
   */
  @UseGuards(JwtAuthGuard)
  @Post('issue')
  async issueCertificate(
    @Body() issueCertificateDto: IssueCertificateDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    // Users can only issue certificates for themselves unless they're an admin
    if (issueCertificateDto.userId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to issue certificates for other users',
      );
    }

    const certificate = await this.certificateService.issueCertificate(
      issueCertificateDto.userId,
      issueCertificateDto.validityPeriodDays,
      {
        metadata: {
          ...issueCertificateDto.metadata,
          issuedByUserId: req.user.id,
          issuedByUsername: req.user.name,
          issuedFromIp: ip,
          userAgent,
        },
        canSign: issueCertificateDto.canSign,
        canEncrypt: issueCertificateDto.canEncrypt,
        canAuthenticate: issueCertificateDto.canAuthenticate,
        securityLevel: issueCertificateDto.securityLevel,
      },
    );

    // Log the certificate issuance
    await this.auditLogService.log(
      AuditAction.USER_UPDATE,
      req.user.id,
      issueCertificateDto.userId,
      {
        action: 'certificate_issue',
        certificateId: certificate.id,
        validityPeriodDays: issueCertificateDto.validityPeriodDays,
      },
      ip,
      userAgent,
    );

    return certificate;
  }

  /**
   * Revoke a certificate
   */
  @UseGuards(JwtAuthGuard)
  @Post('revoke/:id')
  @HttpCode(HttpStatus.OK)
  async revokeCertificate(
    @Param('id') id: string,
    @Body() revokeCertificateDto: RevokeCertificateDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    // Find the certificate to check ownership
    const certificate = await this.certificateService.findCertificateById(id);

    // Users can only revoke their own certificates unless they're an admin
    if (certificate.userId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to revoke this certificate',
      );
    }

    // If certificate is owned by an admin, only that admin or a super admin can revoke it
    if (
      certificate.metadata?.issuedByIsAdmin &&
      !req.user.isSuperAdmin &&
      certificate.metadata.issuedByUserId !== req.user.id
    ) {
      throw new ForbiddenException(
        'Only the issuing admin or a super admin can revoke this certificate',
      );
    }

    // Validate revocation reason
    if (
      !Object.values(RevocationReason).includes(revokeCertificateDto.reason)
    ) {
      throw new BadRequestException('Invalid revocation reason');
    }

    const revokedCertificate = await this.certificateService.revokeCertificate(
      id,
      revokeCertificateDto.reason,
      revokeCertificateDto.details || 'No details provided',
      req.user.id,
    );

    // Log certificate revocation in audit
    await this.auditLogService.log(
      AuditAction.USER_UPDATE,
      req.user.id,
      certificate.userId,
      {
        action: 'certificate_revoke',
        certificateId: id,
        reason: revokeCertificateDto.reason,
        details: revokeCertificateDto.details,
      },
      ip,
      userAgent,
    );

    return revokedCertificate;
  }

  /**
   * Verify a certificate
   */
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyCertificate(@Body() verifyCertificateDto: VerifyCertificateDto) {
    return this.certificateService.verifyCertificate(
      verifyCertificateDto.certificateId,
    );
  }

  /**
   * Get the Certificate Revocation List (CRL)
   * Public endpoint - no authentication required
   */
  @Get('crl')
  async getCRL() {
    return this.certificateService.getCRL();
  }

  /**
   * Get certificate statistics
   * Admin only endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getCertificateStats(@Request() req) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to view certificate statistics',
      );
    }

    return this.certificateService.getCertificateStats();
  }

  /**
   * Force cleanup of expired certificates
   * Admin only endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Post('cleanup/expired')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredCertificates(@Request() req) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to perform this action',
      );
    }

    const count = await this.certificateService.cleanupExpiredCertificates();
    return {
      success: true,
      message: `Marked ${count} certificates as expired`,
    };
  }
}
