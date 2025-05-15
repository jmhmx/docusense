// backend/src/admin/admin.controller.ts
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
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { UpdateSystemConfigurationDto } from './dto/system-configuration.dto';
import { ConfigService } from '@nestjs/config';

// Guard personalizado para verificar permisos de administrador
@Controller('api/admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private configService: ConfigService,
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
  ) {
    console.log(
      'ADMIN_SETUP_KEY:',
      this.configService.get<string>('ADMIN_SETUP_KEY'),
    );
    console.log('Received setupKey:', setupDto.setupKey);
    // Usar el servicio inyectado
    const setupKey = this.configService.get<string>('ADMIN_SETUP_KEY');

    debugger;

    if (!setupKey || setupDto.setupKey !== setupKey) {
      throw new UnauthorizedException('Clave de configuración inválida');
    }

    return this.adminService.createInitialAdmin(
      setupDto.email,
      setupDto.name,
      setupDto.password,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('configuration')
  async getConfiguration(@Request() req) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    const config = await this.adminService.getConfiguration();

    // Formatear la respuesta al formato esperado por el frontend
    return {
      email: config.emailConfig,
      security: config.securityConfig,
      storage: config.storageConfig,
      blockchain: config.blockchainConfig,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('configuration')
  async updateConfiguration(
    @Body() updateConfigDto: UpdateSystemConfigurationDto,
    @Request() req,
  ) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para modificar esta configuración',
      );
    }

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

  @UseGuards(JwtAuthGuard)
  @Post('configuration/reset/:section')
  async resetSectionToDefault(
    @Param('section') section: string,
    @Request() req,
  ) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }

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

  @UseGuards(JwtAuthGuard)
  @Post('configuration/test-email')
  async testEmailConfiguration(@Request() req) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }

    const result = await this.adminService.testEmailConfiguration(
      req.user.email,
    );

    return {
      success: result,
      message: result
        ? 'Correo de prueba enviado correctamente'
        : 'Error al enviar correo de prueba',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('configuration/test-blockchain')
  async testBlockchainConnection(@Request() req) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }

    const result = await this.adminService.testBlockchainConnection(
      req.user.id,
    );

    return {
      success: result,
      message: result
        ? 'Conexión con blockchain establecida correctamente'
        : 'Error al conectar con blockchain',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getSystemStats(@Request() req) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    return this.adminService.getSystemStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('recent-users')
  async getRecentUsers(@Request() req) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    // Aquí implementarías la lógica para obtener usuarios recientes
    // Este es un ejemplo con datos simulados
    return [
      {
        id: '1',
        name: 'María López',
        email: 'maria@example.com',
        lastActivity: new Date().toISOString(),
        documentsCount: 12,
      },
      {
        id: '2',
        name: 'Pedro García',
        email: 'pedro@example.com',
        lastActivity: new Date(Date.now() - 86400000).toISOString(), // 1 día atrás
        documentsCount: 5,
      },
      {
        id: '3',
        name: 'Ana Rodríguez',
        email: 'ana@example.com',
        lastActivity: new Date(Date.now() - 172800000).toISOString(), // 2 días atrás
        documentsCount: 8,
      },
    ];
  }

  @UseGuards(JwtAuthGuard)
  @Get('security-events')
  async getSecurityEvents(@Request() req) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    // Aquí implementarías la lógica para obtener eventos de seguridad
    // Este es un ejemplo con datos simulados
    return [
      {
        id: '1',
        type: 'Intento de acceso fallido',
        severity: 'medium',
        description: 'Múltiples intentos fallidos desde IP 192.168.1.1',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'Documento firmado',
        severity: 'low',
        description:
          'Documento "Contrato de servicios" firmado por Ana Rodríguez',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 día atrás
      },
      {
        id: '3',
        type: 'Acceso no autorizado',
        severity: 'high',
        description:
          'Intento de acceso a documento protegido desde IP desconocida',
        timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 días atrás
      },
    ];
  }

  @UseGuards(JwtAuthGuard)
  @Get('users')
  async getAllUsers(@Request() req) {
    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    // Aquí implementarías la lógica para obtener todos los usuarios
    // Este es un ejemplo con datos simulados
    return [
      {
        id: '1',
        name: 'María López',
        email: 'maria@example.com',
        isAdmin: false,
        twoFactorEnabled: true,
        biometricAuthEnabled: false,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), // 30 días atrás
      },
      {
        id: '2',
        name: 'Pedro García',
        email: 'pedro@example.com',
        isAdmin: true,
        twoFactorEnabled: true,
        biometricAuthEnabled: true,
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), // 60 días atrás
      },
    ];
  }
}
