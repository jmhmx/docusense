// backend/src/sat/sat-transaction.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SatTransaction,
  TransactionStatus,
} from './entities/sat-transaction.entity';
import { SatNotificationService } from './sat-notification.service';

@Injectable()
export class SatTransactionService {
  private readonly logger = new Logger(SatTransactionService.name);

  constructor(
    @InjectRepository(SatTransaction)
    private satTransactionRepository: Repository<SatTransaction>,
    private satNotificationService: SatNotificationService,
  ) {}

  async createTransaction(
    userId: string,
    type: string,
    data: Record<string, any>,
  ): Promise<SatTransaction> {
    const transaction = this.satTransactionRepository.create({
      tramiteId: this.generateTramiteId(),
      type,
      userId,
      data,
      status: TransactionStatus.CREATED,
      statusHistory: [
        {
          status: TransactionStatus.CREATED,
          timestamp: new Date().toISOString(),
          message: 'Trámite creado',
        },
      ],
    });

    return this.satTransactionRepository.save(transaction);
  }

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    message?: string,
    additionalData?: Record<string, any>,
  ): Promise<SatTransaction> {
    const transaction = await this.satTransactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Actualizar estado
    transaction.status = status;

    // Agregar al historial
    transaction.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      message: message || `Estado actualizado a ${status}`,
    });

    // Actualizar datos adicionales si se proporcionaron
    if (additionalData) {
      if (status === TransactionStatus.SUBMITTED) {
        transaction.submissionData = {
          ...transaction.submissionData,
          ...additionalData,
        };
      } else if (
        status === TransactionStatus.COMPLETED ||
        status === TransactionStatus.REJECTED
      ) {
        transaction.responseData = {
          ...transaction.responseData,
          ...additionalData,
        };

        if (additionalData.folio) {
          transaction.folio = additionalData.folio;
        }

        if (additionalData.acuseId) {
          transaction.acuseId = additionalData.acuseId;
        }
      }
    }

    // Guardar cambios
    const updatedTransaction =
      await this.satTransactionRepository.save(transaction);

    // Enviar notificación si es un estado terminal
    if (
      status === TransactionStatus.COMPLETED ||
      status === TransactionStatus.REJECTED ||
      status === TransactionStatus.ERROR
    ) {
      await this.satNotificationService.notifyTransactionUpdate(
        updatedTransaction,
      );
    }

    return updatedTransaction;
  }

  async getTransactionsByUser(userId: string): Promise<SatTransaction[]> {
    return this.satTransactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionById(id: string): Promise<SatTransaction> {
    return this.satTransactionRepository.findOne({
      where: { id },
    });
  }

  async getTransactionByTramiteId(tramiteId: string): Promise<SatTransaction> {
    return this.satTransactionRepository.findOne({
      where: { tramiteId },
    });
  }

  private generateTramiteId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `SAT-${timestamp}-${randomStr}`;
  }
}
