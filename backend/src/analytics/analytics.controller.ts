// backend/src/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboardData(
    @Request() req,
    @Query('range') range: 'week' | 'month' | 'year' = 'month',
    @Query('userId') userId?: string,
  ) {
    try {
      // Solo administradores pueden ver datos de otros usuarios
      if (userId && userId !== req.user.id && !req.user.isAdmin) {
        throw new BadRequestException('No tienes permisos para ver datos de otros usuarios');
      }

      // Si no se especifica userId o el usuario no es admin, usar el ID del usuario actual
      const targetUserId = !userId || !req.user.isAdmin ? req.user.id : userId;

      return await this.analyticsService.getDashboardData(range, targetUserId);
    } catch (error) {
      throw new BadRequestException(`Error al obtener datos del dashboard: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('export')
  async exportReport(
    @Request() req,
    @Query('range') range: string = 'month',
    @Query('userId') userId?: string,
    @Res() res: Response,
  ) {
    try {
      // Solo administradores pueden exportar datos de otros usuarios
      if (userId && userId !== req.user.id && !req.user.isAdmin) {
        throw new BadRequestException('No tienes permisos para exportar datos de otros usuarios');
      }

      // Si no se especifica userId o el usuario no es admin, usar el ID del usuario actual
      const targetUserId = !userId || !req.user.isAdmin ? req.user.id : userId;

      const pdfBuffer = await this.analyticsService.generateReportPdf(range, targetUserId);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="dashboard_report_${range}_${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      
      res.end(pdfBuffer);
    } catch (error) {
      throw new BadRequestException(`Error al exportar reporte: ${error.message}`);
    }
  }
}