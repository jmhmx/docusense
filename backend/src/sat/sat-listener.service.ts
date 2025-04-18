// backend/src/sat/sat-listener.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { SatResponse } from './entities/sat-response.entity';
import { SatNotificationService } from './sat-notification.service';

@Injectable()
export class SatListenerService {
  private readonly logger = new Logger(SatListenerService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(SatResponse)
    private satResponseRepository: Repository<SatResponse>,
    private satNotificationService: SatNotificationService,
  ) {
    this.apiUrl = this.configService.get<string>('SAT_API_URL');
    this.apiKey = this.configService.get<string>('SAT_API_KEY');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkPendingResponses() {
    this.logger.log('Verificando respuestas pendientes del SAT');

    try {
      const response = await axios.get(`${this.apiUrl}/pendingResponses`, {
        headers: { 'X-API-Key': this.apiKey },
      });

      const pendingResponses = response.data;

      for (const pendingResponse of pendingResponses) {
        await this.processSatResponse(pendingResponse);
      }

      this.logger.log(
        `Procesadas ${pendingResponses.length} respuestas del SAT`,
      );
    } catch (error) {
      this.logger.error(
        `Error al verificar respuestas del SAT: ${error.message}`,
      );
    }
  }

  private async processSatResponse(responseData: any) {
    try {
      // Guardar la respuesta en la base de datos
      const satResponse = this.satResponseRepository.create({
        uuid: responseData.uuid,
        folio: responseData.folio,
        status: responseData.status,
        documentType: responseData.documentType,
        responseData: responseData,
        processedAt: null,
        userId: responseData.userId,
      });

      await this.satResponseRepository.save(satResponse);

      // Notificar al usuario
      await this.satNotificationService.notifyUser(satResponse);

      return true;
    } catch (error) {
      this.logger.error(
        `Error al procesar respuesta del SAT: ${error.message}`,
      );
      return false;
    }
  }
}
