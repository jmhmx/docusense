import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { UpdateSystemConfigurationDto } from './dto/system-configuration.dto';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';

@Controller('api/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private adminService: AdminService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  @Post('setup/initial-admin')
  async createInitialAdmin(
    @Body()
    setupDto: {
      email: string;
      name: string;
      password: string;
      setupKey: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log('Intento de creación de administrador inicial');

    // Verificar clave de configuración
    const setupKey = this.configService.get<string>('ADMIN_SETUP_KEY');

    if (!setupKey || setupDto.setupKey !== setupKey) {
      this.logger.warn('Intento de configuración con clave inválida');
      throw new UnauthorizedException('Clave de configuración inválida');
    }

    const user = await this.adminService.createInitialAdmin(
      setupDto.email,
      setupDto.name,
      setupDto.password,
    );

    // Generar token para el administrador
    const token = this.jwtService.sign({
      sub: user.id,
      isAdmin: true,
    });

    // Establecer cookie
    response.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      ...user,
      token, // Devolvemos el token para mantener compatibilidad
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('configuration')
  async getConfiguration(@Request() req) {
    this.logger.log(
      `Admin ${req.user.id} solicitó la configuración del sistema`,
    );

    const config = await this.adminService.getConfiguration();

    // Formatear la respuesta al formato esperado por el frontend
    return {
      email: config.emailConfig,
      security: config.securityConfig,
      storage: config.storageConfig,
      blockchain: config.blockchainConfig,
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('configuration')
  async updateConfiguration(
    @Body() updateConfigDto: UpdateSystemConfigurationDto,
    @Request() req,
  ) {
    this.logger.log(
      `Admin ${req.user.id} actualizando configuración del sistema`,
    );

    const config = await this.adminService.updateConfiguration(
      updateConfigDto,
      req.user.id,
    );

    // Formatear la respuesta al formato esperado por el frontend
    return {
      email: config.emailConfig,
      security: config.securityConfig,
      storage: config.storageConfig,
      blockchain: config.blockchainConfig,
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('configuration/reset/:section')
  async resetSectionToDefault(
    @Param('section') section: string,
    @Request() req,
  ) {
    this.logger.log(
      `Admin ${req.user.id} restableciendo sección ${section} a valores predeterminados`,
    );

    // Validar sección
    if (!['email', 'security', 'storage', 'blockchain'].includes(section)) {
      throw new BadRequestException('Sección no válida');
    }

    const config = await this.adminService.resetSectionToDefault(
      section as 'email' | 'security' | 'storage' | 'blockchain',
      req.user.id,
    );

    // Formatear la respuesta al formato esperado por el frontend
    return {
      email: config.emailConfig,
      security: config.securityConfig,
      storage: config.storageConfig,
      blockchain: config.blockchainConfig,
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('configuration/test-email')
  async testEmailConfiguration(@Request() req) {
    this.logger.log(`Admin ${req.user.id} probando configuración de correo`);

    try {
      const result = await this.adminService.testEmailConfiguration(
        req.user.email,
      );

      return {
        success: result,
        message: result
          ? 'Correo de prueba enviado correctamente'
          : 'Error al enviar correo de prueba',
      };
    } catch (error) {
      this.logger.error(`Error en prueba de correo: ${error.message}`);
      return {
        success: false,
        message: `Error al enviar correo de prueba: ${error.message}`,
      };
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('configuration/test-blockchain')
  async testBlockchainConnection(@Request() req) {
    this.logger.log(`Admin ${req.user.id} probando conexión con blockchain`);

    try {
      const result = await this.adminService.testBlockchainConnection(
        req.user.id,
      );

      return {
        success: result,
        message: result
          ? 'Conexión con blockchain establecida correctamente'
          : 'Error al conectar con blockchain',
      };
    } catch (error) {
      this.logger.error(`Error en prueba de blockchain: ${error.message}`);
      return {
        success: false,
        message: `Error al conectar con blockchain: ${error.message}`,
      };
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats')
  async getSystemStats(@Request() req) {
    this.logger.log(`Admin ${req.user.id} solicitó estadísticas del sistema`);
    return this.adminService.getSystemStats();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('recent-users')
  async getRecentUsers(@Request() req) {
    this.logger.log(`Admin ${req.user.id} solicitó usuarios recientes`);
    return this.adminService.getRecentUsers();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('security-events')
  async getSecurityEvents(@Request() req) {
    this.logger.log(`Admin ${req.user.id} solicitó eventos de seguridad`);
    return this.adminService.getSecurityEvents();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users')
  async getAllUsers(@Request() req) {
    this.logger.log(`Admin ${req.user.id} solicitó lista de usuarios`);
    // Esta ruta debe delegarse a un servicio de usuarios
    const users = await this.adminService.getRecentUsers();
    return users;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('system-health')
  async getSystemHealth(@Request() req) {
    this.logger.log(
      `Admin ${req.user.id} solicitó estado de salud del sistema`,
    );

    // Verificar servicios esenciales
    const emailStatus = await this.adminService.checkEmailServiceStatus();
    const blockchainStatus =
      await this.adminService.checkBlockchainServiceStatus();

    // Obtener estadísticas de almacenamiento
    const stats = await this.adminService.getSystemStats();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        email: {
          status: emailStatus ? 'up' : 'down',
          lastChecked: new Date().toISOString(),
        },
        blockchain: {
          status: blockchainStatus ? 'up' : 'down',
          lastChecked: new Date().toISOString(),
        },
        database: {
          status: 'up',
          lastChecked: new Date().toISOString(),
        },
      },
      resources: {
        storage: {
          total: stats.storageUsed,
          used: stats.storageUsed,
          available:
            stats.totalDocuments > 0
              ? stats.totalDocuments * 10 * 1024 * 1024 - stats.storageUsed
              : 10 * 1024 * 1024 * 1024,
        },
        users: {
          total: stats.totalUsers,
          active: stats.activeUsers,
        },
      },
    };
  }
}
