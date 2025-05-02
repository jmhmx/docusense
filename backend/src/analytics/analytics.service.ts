// backend/src/analytics/analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Document } from '../documents/entities/document.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Signature } from '../signatures/entities/signature.entity';
import { AuditAction } from '../audit/audit-log.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Signature)
    private signaturesRepository: Repository<Signature>,
  ) {}

  async getDashboardData(range: 'week' | 'month' | 'year' = 'month', userId?: string): Promise<any> {
    // Definir fechas para el filtro
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    
    switch (range) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(startDate.getDate() - 7);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        previousStartDate = new Date(startDate);
        previousStartDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'month':
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    // Construir filtros comunes
    const dateFilter = { createdAt: MoreThanOrEqual(startDate) };
    const previousDateFilter = { 
      createdAt: Between(previousStartDate, startDate) 
    };
    
    const userFilter = userId ? { userId } : {};
    
    try {
      // 1. Obtener métricas principales
      const [
        totalDocuments,
        previousTotalDocuments,
        signedDocuments,
        previousSignedDocuments,
        encryptedDocuments,
        previousEncryptedDocuments,
        sharedDocuments,
        previousSharedDocuments,
      ] = await Promise.all([
        // Documentos totales en el periodo actual
        this.documentsRepository.count({
          where: {
            ...dateFilter,
            ...userFilter,
          },
        }),
        // Documentos totales en el periodo anterior
        this.documentsRepository.count({
          where: {
            ...previousDateFilter,
            ...userFilter,
          },
        }),
        // Documentos firmados
        this.documentsRepository.count({
          where: {
            ...dateFilter,
            ...userFilter,
            metadata: { isSigned: true },
          },
        }),
        // Documentos firmados periodo anterior
        this.documentsRepository.count({
          where: {
            ...previousDateFilter,
            ...userFilter,
            metadata: { isSigned: true },
          },
        }),
        // Documentos cifrados
        this.documentsRepository.count({
          where: {
            ...dateFilter,
            ...userFilter,
            metadata: { isEncrypted: true },
          },
        }),
        // Documentos cifrados periodo anterior
        this.documentsRepository.count({
          where: {
            ...previousDateFilter,
            ...userFilter,
            metadata: { isEncrypted: true },
          },
        }),
        // Documentos compartidos
        this.auditLogRepository.count({
          where: {
            ...dateFilter,
            ...userFilter,
            action: AuditAction.DOCUMENT_SHARE,
          },
        }),
        // Documentos compartidos periodo anterior
        this.auditLogRepository.count({
          where: {
            ...previousDateFilter,
            ...userFilter,
            action: AuditAction.DOCUMENT_SHARE,
          },
        }),
      ]);

      // 2. Calcular cambios porcentuales
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      // 3. Datos para gráfico de estado de documentos
      const documentStatusData = await this.getDocumentStatusData(startDate, userFilter);

      // 4. Datos para gráfico de progreso de firmas
      const signatureProgressData = await this.getSignatureProgressData(startDate, range, userFilter);

      // 5. Actividad reciente
      const recentActivity = await this.getRecentActivity(startDate, userFilter);

      // 6. Documentos más vistos
      const topDocuments = await this.getTopDocuments(startDate, userFilter);

      return {
        // Métricas principales
        totalDocuments,
        documentChange: calculateChange(totalDocuments, previousTotalDocuments),
        signedDocuments,
        signedChange: calculateChange(signedDocuments, previousSignedDocuments),
        encryptedDocuments,
        encryptedChange: calculateChange(encryptedDocuments, previousEncryptedDocuments),
        sharedDocuments,
        sharedChange: calculateChange(sharedDocuments, previousSharedDocuments),
        
        // Datos para gráficos
        documentStatusData,
        signatureProgressData,
        
        // Actividad y documentos
        recentActivity,
        topDocuments,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo datos del dashboard: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async getDocumentStatusData(startDate: Date, userFilter: any): Promise<any[]> {
    const statusCounts = await this.documentsRepository
      .createQueryBuilder('document')
      .select('document.status, COUNT(document.id) as count')
      .where('document.createdAt >= :startDate', { startDate })
      .andWhere(userFilter.userId ? 'document.userId = :userId' : '1=1', userFilter)
      .groupBy('document.status')
      .getRawMany();

    // Asegurar que todos los estados tengan un valor
    const statusData = [
      { status: 'pending', count: 0 },
      { status: 'processing', count: 0 },
      { status: 'completed', count: 0 },
      { status: 'error', count: 0 },
    ];

    statusCounts.forEach(item => {
      const index = statusData.findIndex(s => s.status === item.status);
      if (index !== -1) {
        statusData[index].count = parseInt(item.count);
      }
    });

    return statusData;
  }

  private async getSignatureProgressData(startDate: Date, range: string, userFilter: any): Promise<any[]> {
    const now = new Date();
    const dateIntervals = [];
    
    // Crear intervalos de fechas según el rango
    if (range === 'week') {
      // Intervalos diarios para una semana
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        dateIntervals.push(date);
      }
    } else if (range === 'year') {
      // Intervalos mensuales para un año
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(now.getMonth() - i);
        dateIntervals.push(date);
      }
    } else {
      // Intervalos de ~3 días para un mes
      for (let i = 9; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - (i * 3));
        dateIntervals.push(date);
      }
    }

    // Formato para agrupar por día o mes según corresponda
    const formatDate = (date: Date) => {
      return range === 'year' 
        ? `${date.getFullYear()}-${date.getMonth() + 1}` 
        : date.toISOString().split('T')[0];
    };

    // Preparar datos de firmas
    const signatureData = [];
    
    // Para cada intervalo, obtener firmas completadas y pendientes
    for (let i = 0; i < dateIntervals.length - 1; i++) {
      const startInterval = dateIntervals[i];
      const endInterval = i < dateIntervals.length - 1 
        ? dateIntervals[i + 1] 
        : new Date(now.getTime() + 86400000); // Añadir un día al final
      
      const completedSignatures = await this.signaturesRepository.count({
        where: {
          ...userFilter,
          signedAt: Between(startInterval, endInterval),
          valid: true,
        },
      });
      
      // Obtener firmas pendientes (documentos que requieren firma pero aún no están firmados)
      // Este es un ejemplo simplificado, ajustar según la estructura real de datos
      const pendingSignatures = await this.documentsRepository.count({
        where: {
          ...userFilter,
          createdAt: Between(startInterval, endInterval),
          metadata: { 
            multiSignatureProcess: true, 
            processCompleted: false 
          },
        },
      });
      
      signatureData.push({
        date: formatDate(startInterval),
        completed: completedSignatures,
        pending: pendingSignatures,
      });
    }
    
    return signatureData;
  }

  private async getRecentActivity(startDate: Date, userFilter: any): Promise<any[]> {
    // Obtener los últimos registros de auditoría
    const recentLogs = await this.auditLogRepository.find({
      where: {
        ...userFilter,
        timestamp: MoreThanOrEqual(startDate),
      },
      order: { timestamp: 'DESC' },
      take: 10,
      relations: ['user'],
    });

    // Mapear logs a formato de actividad
    const activities = await Promise.all(recentLogs.map(async (log) => {
      // Obtener nombre del recurso (documento)
      let resourceName = '';
      if (log.resourceId) {
        try {
          const document = await this.documentsRepository.findOne({
            where: { id: log.resourceId },
          });
          resourceName = document ? document.title : 'Documento desconocido';
        } catch (error) {
          resourceName = 'Documento desconocido';
        }
      }

      return {
        id: log.id,
        action: log.action,
        user: {
          id: log.userId,
          name: log.user?.name || 'Usuario',
        },
        resourceId: log.resourceId || '',
        resourceType: 'document',
        resourceName: resourceName,
        timestamp: log.timestamp.toISOString(),
        details: log.details,
      };
    }));

    return activities;
  }

  private async getTopDocuments(startDate: Date, userFilter: any): Promise<any[]> {
    // Contar visualizaciones de documentos
    const viewCounts = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.resourceId, COUNT(audit.id) as views')
      .where('audit.timestamp >= :startDate', { startDate })
      .andWhere('audit.action = :action', { action: AuditAction.DOCUMENT_VIEW })
      .andWhere(userFilter.userId ? 'audit.userId = :userId' : '1=1', userFilter)
      .groupBy('audit.resourceId')
      .orderBy('views', 'DESC')
      .limit(5)
      .getRawMany();

    // Obtener detalles de los documentos más vistos
    const topDocs = await Promise.all(viewCounts.map(async (item) => {
      try {
        const document = await this.documentsRepository.findOne({
          where: { id: item.resourceId },
        });

        // Obtener la fecha de última visualización
        const lastView = await this.auditLogRepository.findOne({
          where: {
            resourceId: item.resourceId,
            action: AuditAction.DOCUMENT_VIEW,
          },
          order: { timestamp: 'DESC' },
        });

        return {
          id: item.resourceId,
          title: document ? document.title : 'Documento desconocido',
          views: parseInt(item.views),
          lastViewed: lastView ? lastView.timestamp.toISOString() : new Date().toISOString(),
        };
      } catch (error) {
        return {
          id: item.resourceId,
          title: 'Documento desconocido',
          views: parseInt(item.views),
          lastViewed: new Date().toISOString(),
        };
      }
    }));

    return topDocs;
  }

  async generateReportPdf(range: string, userId?: string): Promise<Buffer> {
    // Simulación de generación de PDF
    // En una implementación real, usaríamos una biblioteca como PDFKit
    const dashboardData = await this.getDashboardData(range as any, userId);
    
    // Aquí implementarías la generación real del PDF
    // Por ahora devolvemos un buffer simple como simulación
    return Buffer.from(`Reporte Analítico - Rango: ${range}\n\nTotal documentos: ${dashboardData.totalDocuments}\nDocumentos firmados: ${dashboardData.signedDocuments}\nDocumentos cifrados: ${dashboardData.encryptedDocuments}`);
  }
}