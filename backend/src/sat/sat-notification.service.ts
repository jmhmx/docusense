// backend/src/sat/sat-notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SatResponse } from './entities/sat-response.entity';
import { EmailService } from '../email/email.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { UsersService } from '../users/users.service';

@Injectable()
export class SatNotificationService {
  private readonly logger = new Logger(SatNotificationService.name);

  constructor(
    @InjectRepository(SatResponse)
    private satResponseRepository: Repository<SatResponse>,
    private emailService: EmailService,
    private websocketGateway: WebsocketGateway,
    private usersService: UsersService,
  ) {}

  async notifyUser(satResponse: SatResponse): Promise<boolean> {
    try {
      // Obtener información del usuario
      const user = await this.usersService.findOne(satResponse.userId);
      if (!user) {
        this.logger.warn(
          `No se encontró el usuario ${satResponse.userId} para notificación SAT`,
        );
        return false;
      }

      // Enviar notificación por email
      await this.sendEmailNotification(user, satResponse);

      // Enviar notificación en tiempo real
      await this.sendRealtimeNotification(user.id, satResponse);

      // Actualizar estado de la respuesta
      await this.satResponseRepository.update(
        { id: satResponse.id },
        { processedAt: new Date() },
      );

      return true;
    } catch (error) {
      this.logger.error(`Error al notificar respuesta SAT: ${error.message}`);
      return false;
    }
  }

  private async sendEmailNotification(
    user: any,
    satResponse: SatResponse,
  ): Promise<void> {
    const templateData = {
      userName: user.name,
      responseType: this.getResponseTypeName(satResponse.documentType),
      folio: satResponse.folio || 'Sin folio',
      status: this.getStatusTranslation(satResponse.status),
      date: new Date().toLocaleDateString('es-MX'),
      dashboardUrl: `${process.env.FRONTEND_URL}/sat/responses/${satResponse.id}`,
    };

    await this.emailService.sendTemplateEmail({
      to: user.email,
      subject: `Respuesta del SAT - ${templateData.responseType}`,
      template: 'sat-response',
      context: templateData,
    });
  }

  private async sendRealtimeNotification(
    userId: string,
    satResponse: SatResponse,
  ): Promise<void> {
    const notificationData = {
      type: 'SAT_RESPONSE',
      title: 'Nueva respuesta del SAT',
      message: `Has recibido una respuesta del SAT para tu trámite de ${this.getResponseTypeName(satResponse.documentType)}`,
      data: {
        responseId: satResponse.id,
        status: satResponse.status,
        documentType: satResponse.documentType,
        folio: satResponse.folio,
      },
      time: new Date().toISOString(),
    };

    this.websocketGateway.sendNotificationToUser(userId, notificationData);
  }

  private getResponseTypeName(documentType: string): string {
    const types = {
      cfdi: 'Comprobante Fiscal',
      declaracion: 'Declaración',
      constancia: 'Constancia',
      opinion: 'Opinión de Cumplimiento',
    };

    return types[documentType] || documentType;
  }

  private getStatusTranslation(status: string): string {
    const statusMap = {
      received: 'Recibido',
      processing: 'En Procesamiento',
      accepted: 'Aceptado',
      rejected: 'Rechazado',
      cancelled: 'Cancelado',
    };

    return statusMap[status] || status;
  }

  async notifyTransactionUpdate(transaction: SatTransaction): Promise<boolean> {
    try {
      // Obtener información del usuario
      const user = await this.usersService.findOne(transaction.userId);
      if (!user) {
        this.logger.warn(
          `No se encontró el usuario ${transaction.userId} para notificación de trámite`,
        );
        return false;
      }

      // Enviar notificación por email
      await this.sendTransactionEmailNotification(user, transaction);

      // Enviar notificación en tiempo real
      await this.sendTransactionRealtimeNotification(user.id, transaction);

      return true;
    } catch (error) {
      this.logger.error(
        `Error al notificar actualización de trámite: ${error.message}`,
      );
      return false;
    }
  }

  private async sendTransactionEmailNotification(
    user: any,
    transaction: SatTransaction,
  ): Promise<void> {
    const templateData = {
      userName: user.name,
      tramiteId: transaction.tramiteId,
      tramiteType: this.getTransactionTypeName(transaction.type),
      status: this.getTransactionStatusTranslation(transaction.status),
      date: new Date().toLocaleDateString('es-MX'),
      dashboardUrl: `${process.env.FRONTEND_URL}/sat/tramites/${transaction.id}`,
      additionalInfo: transaction.responseData?.message || '',
    };

    await this.emailService.sendTemplateEmail({
      to: user.email,
      subject: `Actualización de trámite SAT - ${templateData.tramiteType}`,
      template: 'sat-transaction-update',
      context: templateData,
    });
  }

  private async sendTransactionRealtimeNotification(
    userId: string,
    transaction: SatTransaction,
  ): Promise<void> {
    const notificationData = {
      type: 'SAT_TRANSACTION_UPDATE',
      title: 'Actualización de trámite SAT',
      message: `Su trámite ${transaction.tramiteId} ha cambiado a estado: ${this.getTransactionStatusTranslation(transaction.status)}`,
      data: {
        transactionId: transaction.id,
        tramiteId: transaction.tramiteId,
        status: transaction.status,
        type: transaction.type,
      },
      time: new Date().toISOString(),
    };

    this.websocketGateway.sendNotificationToUser(userId, notificationData);
  }

  private getTransactionTypeName(type: string): string {
    const types = {
      cfdi: 'Comprobante Fiscal',
      declaracion: 'Declaración',
      constancia: 'Constancia',
      opinion: 'Opinión de Cumplimiento',
    };

    return types[type] || type;
  }

  private getTransactionStatusTranslation(status: string): string {
    const statusMap = {
      created: 'Creado',
      submitted: 'Enviado',
      processing: 'En Procesamiento',
      completed: 'Completado',
      rejected: 'Rechazado',
      error: 'Error',
    };

    return statusMap[status] || status;
  }
}
