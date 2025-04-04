import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TwoFactorService } from './two-factor.service';
import { VerifyCodeDto } from './dto/verify-code.dto';

@Controller('api/auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateCode(@Request() req) {
    try {
      // En producción, no devolver el código, solo enviarlo
      const code = await this.twoFactorService.generateVerificationCode(
        req.user.id,
      );

      return {
        message: 'Código de verificación enviado',
        // Solo para desarrollo/pruebas:
        code,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al generar código de verificación: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyCode(@Request() req, @Body() verifyCodeDto: VerifyCodeDto) {
    const isValid = this.twoFactorService.verifyCode(
      req.user.id,
      verifyCodeDto.code,
    );

    if (!isValid) {
      throw new BadRequestException(
        'Código de verificación inválido o expirado',
      );
    }

    return {
      message: 'Verificación exitosa',
      verified: true,
    };
  }
}
