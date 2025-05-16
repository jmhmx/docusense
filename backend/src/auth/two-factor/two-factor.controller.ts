import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Headers,
  Ip,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IsNotEmpty, IsString, Length } from 'class-validator';

// DTO para generar código de verificación
export class GenerateVerificationDto {
  @IsString()
  @IsNotEmpty()
  action: string;
}

// DTO para verificar código
export class VerifyCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'El código debe tener 6 caracteres' })
  code: string;

  @IsString()
  @IsNotEmpty()
  action: string;
}

@Controller('api/auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateVerificationCode(
    @Body(new ValidationPipe()) generateDto: GenerateVerificationDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';
      const result =
        await this.twoFactorService.generateAndSendVerificationCode(
          req.user.id,
          generateDto.action,
          ip,
          userAgent,
        );

      return {
        success: true,
        expiresAt: result.expiresAt,
        message: 'Código de verificación enviado por email',
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Error generando código de verificación',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verifyCode(
    @Body(new ValidationPipe()) verifyDto: VerifyCodeDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';
      const verified = await this.twoFactorService.verifyCode(
        req.user.id,
        verifyDto.code,
        verifyDto.action,
        ip,
        userAgent,
      );

      return {
        success: verified,
        message: verified
          ? 'Código verificado correctamente'
          : 'Código inválido',
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Error verificando código',
      );
    }
  }
}
