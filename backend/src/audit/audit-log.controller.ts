import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLogService, AuditAction } from './audit-log.service';

@Controller('api/audit')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Request() req,
    @Query('userId') userId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('action') action?: AuditAction,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      // Verificar si el usuario es administrador (solo admins pueden ver logs de otros usuarios)
      if (userId && userId !== req.user.id && !req.user.isAdmin) {
        throw new ForbiddenException(
          'No tiene permisos para ver logs de otros usuarios',
        );
      }

      // Parsear fechas
      const startDateTime = startDate ? new Date(startDate) : undefined;
      const endDateTime = endDate ? new Date(endDate) : undefined;

      // Si no se especifica usuario y no es admin, usar el ID del usuario actual
      const userIdToUse = !userId && !req.user.isAdmin ? req.user.id : userId;

      const result = await this.auditLogService.findLogs(
        userIdToUse,
        resourceId,
        action as AuditAction,
        startDateTime,
        endDateTime,
        limit ? parseInt(limit as unknown as string, 10) : 100,
        offset ? parseInt(offset as unknown as string, 10) : 0,
      );

      return result;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al consultar logs: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('resource/:resourceId')
  async getResourceLogs(
    @Request() req,
    @Param('resourceId') resourceId: string,
  ) {
    try {
      const logs = await this.auditLogService.getResourceLogs(resourceId);

      // Si no es admin, filtrar logs para mostrar solo los propios
      if (!req.user.isAdmin) {
        return logs.filter((log) => log.userId === req.user.id);
      }

      return logs;
    } catch (error) {
      throw new BadRequestException(
        `Error al consultar logs del recurso: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  async getUserLogs(@Request() req) {
    try {
      return await this.auditLogService.getUserLogs(req.user.id);
    } catch (error) {
      throw new BadRequestException(
        `Error al consultar logs del usuario: ${error.message}`,
      );
    }
  }
}
