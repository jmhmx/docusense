import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlockchainService } from './blockchain.service';
import { AuditLogService } from 'src/audit/audit-log.service';
import { AdminService } from 'src/admin/admin.service';
import { AuditAction } from '../audit/audit-log.service';

@Controller('api/blockchain')
export class BlockchainController {
  private readonly logger = new Logger(BlockchainController.name);
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly auditLogService: AuditLogService,
    private readonly adminService: AdminService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('register/:documentId')
  async registerDocument(
    @Param('documentId') documentId: string,
    @Body() registerData: { hash: string; metadata: any },
    @Request() req,
  ) {
    if (!documentId || !registerData.hash) {
      throw new BadRequestException('Document ID and hash are required');
    }

    const result = await this.blockchainService.registerDocument(
      documentId,
      registerData.hash,
      registerData.metadata || {},
      req.user.id,
    );

    return {
      success: result,
      documentId,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify/:documentId')
  async verifyDocument(
    @Param('documentId') documentId: string,
    @Body() verifyData: { hash: string },
  ) {
    if (!documentId || !verifyData.hash) {
      throw new BadRequestException('Document ID and hash are required');
    }

    return await this.blockchainService.verifyDocument(
      documentId,
      verifyData.hash,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('update/:documentId')
  async updateDocumentRecord(
    @Param('documentId') documentId: string,
    @Body() updateData: { hash: string; action: string; metadata?: any },
    @Request() req,
  ) {
    if (!documentId || !updateData.hash || !updateData.action) {
      throw new BadRequestException(
        'Document ID, hash, and action are required',
      );
    }

    const result = await this.blockchainService.updateDocumentRecord(
      documentId,
      updateData.hash,
      updateData.action,
      req.user.id,
      updateData.metadata,
    );

    return {
      success: result,
      documentId,
      action: updateData.action,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('certificate/:documentId')
  async getVerificationCertificate(@Param('documentId') documentId: string) {
    if (!documentId) {
      throw new BadRequestException('Document ID is required');
    }

    return await this.blockchainService.getVerificationCertificate(documentId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getSystemStats(@Request() req) {
    this.logger.log(
      `Usuario ${req.user.id} solicitando estadísticas del sistema`,
    );

    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      this.logger.warn(
        `Usuario ${req.user.id} sin permisos de administrador intentó acceder a estadísticas`,
      );
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    try {
      const stats = await this.adminService.getSystemStats();

      // Registro en auditoría
      await this.auditLogService.log(
        AuditAction.PERMISSION_UPDATE,
        req.user.id,
        null,
        {
          action: 'view_system_stats',
        },
      );

      return stats;
    } catch (error) {
      this.logger.error(
        `Error obteniendo estadísticas: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener estadísticas del sistema',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('health')
  async getSystemHealth(@Request() req) {
    this.logger.log(`Usuario ${req.user.id} verificando estado del sistema`);

    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      this.logger.warn(
        `Usuario ${req.user.id} sin permisos de administrador intentó verificar estado del sistema`,
      );
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    // Verificar estado de servicios principales
    try {
      // Verificar servicios básicos (simulación)
      const dbStatus = true;
      const redisStatus = true;
      const storageStatus = true;

      // Verificar conexión con servicios externos
      const emailStatus = await this.adminService.checkEmailServiceStatus();
      const blockchainStatus =
        await this.adminService.checkBlockchainServiceStatus();

      // Calcular estado general
      const systemStatus = dbStatus && storageStatus ? 'healthy' : 'degraded';

      // Registro en auditoría
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'check_system_health',
          status: systemStatus,
        },
      );

      return {
        status: systemStatus,
        timestamp: new Date().toISOString(),
        services: {
          database: { status: dbStatus ? 'online' : 'offline' },
          redis: { status: redisStatus ? 'online' : 'offline' },
          storage: { status: storageStatus ? 'online' : 'offline' },
          email: { status: emailStatus ? 'online' : 'offline' },
          blockchain: { status: blockchainStatus ? 'online' : 'offline' },
        },
      };
    } catch (error) {
      this.logger.error(
        `Error verificando salud del sistema: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al verificar el estado del sistema',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('recent-users')
  async getRecentUsers(@Request() req) {
    this.logger.log(`Usuario ${req.user.id} solicitando usuarios recientes`);

    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      this.logger.warn(
        `Usuario ${req.user.id} sin permisos de administrador intentó acceder a usuarios recientes`,
      );
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    try {
      const recentUsers = await this.adminService.getRecentUsers();

      // Registro en auditoría
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'view_recent_users',
        },
      );

      return recentUsers;
    } catch (error) {
      this.logger.error(
        `Error obteniendo usuarios recientes: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener usuarios recientes',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('security-events')
  async getSecurityEvents(@Request() req) {
    this.logger.log(`Usuario ${req.user.id} solicitando eventos de seguridad`);

    // Verificar que el usuario tiene permisos de administrador
    if (!req.user.isAdmin) {
      this.logger.warn(
        `Usuario ${req.user.id} sin permisos de administrador intentó acceder a eventos de seguridad`,
      );
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información',
      );
    }

    try {
      const securityEvents = await this.adminService.getSecurityEvents();

      // Registro en auditoría
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'view_security_events',
        },
      );

      return securityEvents;
    } catch (error) {
      this.logger.error(
        `Error obteniendo eventos de seguridad: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener eventos de seguridad',
      );
    }
  }
}
