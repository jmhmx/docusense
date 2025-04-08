import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { AuditLogService, AuditAction } from '../../audit/audit-log.service';

@Controller('api/auth/2fa')
export class TwoFactorController {
  constructor(
    private readonly twoFactorAuthService: TwoFactorService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateCode(@Request() req, @Ip() ip: string, @Headers() headers) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';
      const { code, expiresAt } =
        await this.twoFactorAuthService.generateOneTimeCode(req.user.id);

      // Log the 2FA code request
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_REQUEST,
        req.user.id,
        null,
        {
          expiresAt,
        },
        ip,
        userAgent,
      );

      return {
        message: 'Verification code sent',
        // Only for development/testing:
        code,
        expiresAt,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error generating verification code: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyCode(
    @Request() req,
    @Body() body: { code: string },
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    if (!body.code) {
      throw new BadRequestException('Verification code is required');
    }

    const isValid = await this.twoFactorAuthService.verifyOneTimeCode(
      req.user.id,
      body.code,
    );

    // Log the verification attempt
    await this.auditLogService.log(
      AuditAction.AUTH_2FA_VERIFY,
      req.user.id,
      null,
      {
        success: isValid,
      },
      ip,
      userAgent,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    return {
      message: 'Verification successful',
      verified: true,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getTwoFactorStatus(@Request() req) {
    try {
      const isEnabled = await this.twoFactorAuthService.isTwoFactorEnabled(
        req.user.id,
      );

      return {
        enabled: isEnabled,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error checking 2FA status: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup')
  async setupTOTP(@Request() req, @Ip() ip: string, @Headers() headers) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';
      const setup = await this.twoFactorAuthService.setupTOTP(req.user.id);

      // Log TOTP setup initiation
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_SETUP,
        req.user.id,
        null,
        {
          step: 'initiate',
        },
        ip,
        userAgent,
      );

      return {
        message: 'TOTP setup initiated',
        ...setup,
      };
    } catch (error) {
      throw new BadRequestException(`Error setting up TOTP: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup/verify')
  async verifyAndEnableTOTP(
    @Request() req,
    @Body() body: { token: string },
    @Ip() ip: string,
    @Headers() headers,
  ) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';

      if (!body.token) {
        throw new BadRequestException('TOTP token is required');
      }

      const isValid = await this.twoFactorAuthService.verifyAndEnableTOTP(
        req.user.id,
        body.token,
      );

      // Log TOTP setup completion
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_SETUP,
        req.user.id,
        null,
        {
          step: 'complete',
          success: isValid,
        },
        ip,
        userAgent,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid TOTP token');
      }

      // Generate recovery codes after successful setup
      const recoveryCodes =
        await this.twoFactorAuthService.generateRecoveryCodes(req.user.id);

      return {
        message: 'TOTP setup completed successfully',
        enabled: true,
        recoveryCodes,
      };
    } catch (error) {
      throw new BadRequestException(`Error enabling TOTP: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('disable')
  async disableTwoFactor(@Request() req, @Ip() ip: string, @Headers() headers) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';
      const success = await this.twoFactorAuthService.disableTwoFactor(
        req.user.id,
      );

      // Log 2FA disabling
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_DISABLE,
        req.user.id,
        null,
        {
          success,
        },
        ip,
        userAgent,
      );

      return {
        message: 'Two-factor authentication disabled',
        enabled: false,
      };
    } catch (error) {
      throw new BadRequestException(`Error disabling 2FA: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('recovery')
  async verifyRecoveryCode(
    @Request() req,
    @Body() body: { code: string },
    @Ip() ip: string,
    @Headers() headers,
  ) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';

      if (!body.code) {
        throw new BadRequestException('Recovery code is required');
      }

      const isValid = await this.twoFactorAuthService.verifyRecoveryCode(
        req.user.id,
        body.code,
      );

      // Log recovery code usage
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_RECOVERY,
        req.user.id,
        null,
        {
          success: isValid,
        },
        ip,
        userAgent,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid recovery code');
      }

      return {
        message: 'Recovery successful',
        verified: true,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error verifying recovery code: ${error.message}`,
      );
    }
  }
}
