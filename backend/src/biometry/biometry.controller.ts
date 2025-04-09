// src/biometry/biometry.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BiometryService } from './biometry.service';
import { RegisterBiometryDto } from './dto/register-biometry.dto';
import { VerifyBiometryDto } from './dto/verify-biometry.dto';
import { LivenessCheckDto } from './dto/liveness-check.dto';

@Controller('api/biometry')
export class BiometryController {
  constructor(private readonly biometryService: BiometryService) {}

  @UseGuards(JwtAuthGuard)
  @Post('register')
  async register(
    @Body() registerDto: RegisterBiometryDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    // Solo permitir registrar datos propios o con rol admin
    if (req.user.id !== registerDto.userId && !req.user.isAdmin) {
      return {
        success: false,
        message:
          'No tiene permisos para registrar datos biométricos de otro usuario',
      };
    }

    await this.biometryService.register(registerDto, ip, userAgent);

    return {
      success: true,
      message: 'Datos biométricos registrados correctamente',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() verifyDto: VerifyBiometryDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    // Solo permitir verificar datos propios o con rol admin
    if (req.user.id !== verifyDto.userId && !req.user.isAdmin) {
      return {
        verified: false,
        message:
          'No tiene permisos para verificar datos biométricos de otro usuario',
      };
    }

    const isVerified = await this.biometryService.verify(
      verifyDto,
      ip,
      userAgent,
    );

    return {
      verified: isVerified,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('liveness')
  @HttpCode(HttpStatus.OK)
  async checkLiveness(@Body() livenessDto: LivenessCheckDto) {
    const isLive = await this.biometryService.checkLiveness(livenessDto);

    return {
      live: isLive,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':userId')
  async removeBiometricData(
    @Param('userId') userId: string,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    // Solo permitir eliminar datos propios o con rol admin
    if (req.user.id !== userId && !req.user.isAdmin) {
      return {
        success: false,
        message:
          'No tiene permisos para eliminar datos biométricos de otro usuario',
      };
    }

    await this.biometryService.removeUserBiometricData(userId, ip, userAgent);

    return {
      success: true,
      message: 'Datos biométricos eliminados correctamente',
    };
  }
}
