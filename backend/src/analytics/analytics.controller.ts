import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
  BadRequestException,
  StreamableFile,
  Header,
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
        throw new BadRequestException(
          'No tienes permisos para ver datos de otros usuarios',
        );
      }

      // Si no se especifica userId o el usuario no es admin, usar el ID del usuario actual
      const targetUserId = !userId || !req.user.isAdmin ? req.user.id : userId;

      return await this.analyticsService.getDashboardMetrics(range);
    } catch (error) {
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
    const report = await this.analyticsService.generateReport(range);
    res.setHeader('Content-Disposition', `attachment; filename=report.pdf`);
    res.send(report);
  }
}
