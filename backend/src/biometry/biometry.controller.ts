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
  BadRequestException,
  UnauthorizedException,
  Query,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BiometryService } from './biometry.service';
import { RegisterBiometryDto } from './dto/register-biometry.dto';
import { VerifyBiometryDto } from './dto/verify-biometry.dto';
import { LivenessCheckDto } from './dto/liveness-check.dto';

@Controller('api/biometry')
export class BiometryController {
  private readonly logger = new Logger(BiometryController.name);

  constructor(private readonly biometryService: BiometryService) {}

  /**
   * Registra datos biométricos para un usuario
   */
  @Post('register')
  async register(
    @Body() registerDto: RegisterBiometryDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';
      const biometricData = await this.biometryService.register(
        registerDto,
        ip,
        userAgent,
      );

      return {
        success: true,
        message: 'Datos biométricos registrados correctamente',
        timestamp: new Date().toISOString(),
        id: biometricData.id,
        type: biometricData.type,
      };
    } catch (error) {
      this.logger.error(
        `Error en registro biométrico: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error interno al registrar datos biométricos`,
      );
    }
  }

  /**
   * Verifica la identidad de un usuario usando sus datos biométricos
   */
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
    this.logger.log(
      `Solicitud de verificación biométrica para usuario ${verifyDto.userId}`,
    );

    // Solo permitir verificar datos propios o con rol admin
    if (req.user.id !== verifyDto.userId && !req.user.isAdmin) {
      this.logger.warn(
        `Intento no autorizado de verificación biométrica del usuario ${req.user.id} para ${verifyDto.userId}`,
      );
      throw new UnauthorizedException(
        'No tiene permisos para verificar datos biométricos de otro usuario',
      );
    }

    try {
      const isVerified = await this.biometryService.verify(
        verifyDto,
        ip,
        userAgent,
      );

      return {
        verified: isVerified,
        timestamp: new Date().toISOString(),
        userId: verifyDto.userId,
      };
    } catch (error) {
      this.logger.error(`Error en verificación biométrica: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica la prueba de vida de una imagen facial
   */
  @UseGuards(JwtAuthGuard)
  @Post('liveness')
  @HttpCode(HttpStatus.OK)
  async checkLiveness(
    @Body() livenessDto: LivenessCheckDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    this.logger.log('Solicitud de verificación de prueba de vida');

    try {
      const result = await this.biometryService.checkLiveness(livenessDto);

      // Registrar resultado en logs
      if (result.live) {
        this.logger.log(
          `Verificación de vida exitosa (score: ${result.score})`,
        );
      } else {
        this.logger.warn(
          `Verificación de vida fallida (score: ${result.score})`,
        );
      }

      return {
        live: result.live,
        score: result.score,
        timestamp: new Date().toISOString(),
        ...(req.user.isAdmin ? { details: result.details } : {}), // Solo incluir detalles para administradores
      };
    } catch (error) {
      this.logger.error(
        `Error en verificación de prueba de vida: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Obtiene el estado de registro biométrico de un usuario
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getBiometricStatus(@Request() req, @Query('userId') userId?: string) {
    const targetUserId = userId || req.user.id;

    // Solo permitir ver datos propios o con rol admin
    if (targetUserId !== req.user.id && !req.user.isAdmin) {
      throw new UnauthorizedException(
        'No tiene permisos para acceder a información biométrica de otro usuario',
      );
    }

    try {
      // Consultar repositorio para verificar si existe un registro activo
      const biometricData =
        await this.biometryService.getUserBiometricStatus(targetUserId);

      return {
        userId: targetUserId,
        registered: biometricData.registered,
        registrationType: biometricData.type,
        lastVerified: biometricData.lastVerified,
        registrationDate: biometricData.registrationDate,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener estado biométrico: ${error.message}`,
      );
    }
  }

  /**
   * Elimina los datos biométricos de un usuario
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':userId')
  async removeBiometricData(
    @Param('userId') userId: string,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    this.logger.log(
      `Solicitud de eliminación de datos biométricos para usuario ${userId}`,
    );

    // Solo permitir eliminar datos propios o con rol admin
    if (req.user.id !== userId && !req.user.isAdmin) {
      this.logger.warn(
        `Intento no autorizado de eliminación biométrica del usuario ${req.user.id} para ${userId}`,
      );
      throw new UnauthorizedException(
        'No tiene permisos para eliminar datos biométricos de otro usuario',
      );
    }

    try {
      await this.biometryService.removeUserBiometricData(userId, ip, userAgent);

      return {
        success: true,
        message: 'Datos biométricos eliminados correctamente',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error en eliminación biométrica: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ruta para depuración y diagnóstico (solo admin)
   */
  @UseGuards(JwtAuthGuard)
  @Get('admin/diagnostics')
  async getDiagnostics(@Request() req) {
    // Verificar que sea admin
    if (!req.user.isAdmin) {
      throw new UnauthorizedException(
        'Sólo los administradores pueden acceder a diagnósticos',
      );
    }

    // Este endpoint es solo para depuración en desarrollo, proporciona estadísticas
    return this.biometryService.getSystemDiagnostics();
  }
}
