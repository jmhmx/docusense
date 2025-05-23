import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { SignaturesService } from './signatures.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { DocumentsService } from '../documents/documents.service';

@Controller('api/admin/multi-signature')
@UseGuards(JwtAuthGuard, AdminGuard)
export class MultiSignatureManagementController {
  constructor(
    private readonly signaturesService: SignaturesService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly documentsService: DocumentsService,
  ) {}

  /**
   * Obtiene estadísticas de procesos de firmas múltiples
   */
  @Get('stats')
  async getMultiSignatureStats() {
    try {
      // Esta lógica necesitaría implementarse en el servicio
      const stats = await this.signaturesService.getMultiSignatureStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error obteniendo estadísticas: ${error.message}`,
      );
    }
  }

  /**
   * Lista todos los procesos de firmas múltiples activos
   */
  @Get('active-processes')
  async getActiveProcesses(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    try {
      const processes =
        await this.signaturesService.getActiveMultiSignatureProcesses(
          page,
          limit,
        );
      return {
        success: true,
        data: processes,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error obteniendo procesos activos: ${error.message}`,
      );
    }
  }

  /**
   * Envía recordatorios masivos a firmantes pendientes
   */
  @Post('send-bulk-reminders')
  async sendBulkReminders(@Request() req) {
    try {
      const result = await this.signaturesService.sendBulkSignatureReminders();
      return {
        success: true,
        message: 'Recordatorios enviados exitosamente',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error enviando recordatorios: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene detalles de un proceso específico
   */
  @Get('process/:documentId')
  async getProcessDetails(@Param('documentId') documentId: string) {
    try {
      const details =
        await this.signaturesService.getMultiSignatureProcessDetails(
          documentId,
        );
      return {
        success: true,
        data: details,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error obteniendo detalles: ${error.message}`,
      );
    }
  }
}
