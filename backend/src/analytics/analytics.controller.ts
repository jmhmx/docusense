// backend/src/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
  BadRequestException,
  Header,
  Logger
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService, DashboardMetrics } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);
  constructor(private readonly analyticsService: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboardData(
    @Request() req,
    @Query('range') range: 'week' | 'month' | 'year' = 'month',
    @Query('userId') userId?: string,
  ): Promise<DashboardMetrics> {
    this.logger.log('getDashboardData iniciado');
    try {
      // Solo administradores pueden ver datos de otros usuarios
      if (userId && userId !== req.user.id && !req.user.isAdmin) {
        throw new BadRequestException(
          'No tienes permisos para ver datos de otros usuarios',
        );
      }

      // Si no se especifica userId o el usuario no es admin, usar el ID del usuario actual
      const targetUserId = !userId || !req.user.isAdmin ? req.user.id : userId;
      
      this.logger.log('getDashboardData finalizado correctamente');
      return await this.analyticsService.getDashboardMetrics(range);
    } catch (error) {
      this.logger.error(`Error en getDashboardData: ${error.message}`);
      throw new BadRequestException(
        `Error al obtener datos del dashboard: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('export')
  @Header('Content-Type', 'application/pdf')
  async exportReport(
    @Res() res: Response,
    @Query('range') range: 'week' | 'month' | 'year',
  ): Promise<void> {
    this.logger.log('exportReport iniciado');
    try {
      const report = await this.analyticsService.generateReport(range);
      res.setHeader('Content-Disposition', `attachment; filename=report.pdf`);
      this.logger.log('exportReport finalizado correctamente');
      res.send(report);
    } catch (error) {
      this.logger.error(`Error en exportReport: ${error.message}`);
      throw new BadRequestException(
        `Error al exportar el reporte: ${error.message}`,
      );
    }
  }
}
