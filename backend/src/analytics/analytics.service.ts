// backend/src/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from '../documents/entities/document.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Repository, Between } from 'typeorm';
import { format, subWeeks, subMonths, subYears } from 'date-fns';
import * as PDFDocument from 'pdfkit';
import { AuditAction } from '../audit/audit-log.service';

export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export interface DocumentStatusData {
  status: string;
  count: number;
}

export interface SignatureProgressData {
  date: string;
  completed: number;
  pending: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  user: {
    id: string;
    name: string;
  };
  resourceId: string;
  resourceType: string;
  resourceName: string;
  timestamp: string;
  details?: any;
}

export interface TopDocument {
  id: string;
  title: string;
  views: number;
  lastViewed: string;
}

export interface DashboardMetrics {
  totalDocuments: number;
  signedDocuments: number;
  encryptedDocuments: number;
  sharedDocuments: number;
  documentChange: number;
  signedChange: number;
  encryptedChange: number;
  sharedChange: number;
  documentStatusData: DocumentStatusData[];
  signatureProgressData: SignatureProgressData[];
  recentActivity: RecentActivity[];
  topDocuments: TopDocument[];
}

@Injectable()
export class AnalyticsService {
  public metrics: DashboardMetrics = {
    totalDocuments: 0,
    signedDocuments: 0,
    encryptedDocuments: 0,
    sharedDocuments: 0,
    documentChange: 0,
    signedChange: 0,
    encryptedChange: 0,
    sharedChange: 0,
    documentStatusData: [],
    signatureProgressData: [],
    recentActivity: [],
    topDocuments: [],
  };

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async getDashboardMetrics(
    range: 'week' | 'month' | 'year',
  ): Promise<DashboardMetrics> {
    const now = new Date();
    let startDate = new Date();
    switch (range) {
      case 'week':
        startDate = subWeeks(now, 1);
        break;
      case 'month':
        startDate = subMonths(now, 1);
        break;
      case 'year':
        startDate = subYears(now, 1);
        break;
    }

    const totalDocuments = await this.documentRepository.count();
    const signedDocuments = await this.documentRepository.count({
      where: { status: DocumentStatus.COMPLETED },
    });
    const encryptedDocuments = await this.documentRepository.count({
      where: {
        metadata: { isEncrypted: true },
      },
    });
    const sharedDocuments = 0;

    const previousDocuments = await this.documentRepository.count({
      where: { createdAt: Between(subMonths(startDate, 1), startDate) },
    });
    const documentChange = totalDocuments - previousDocuments;
    const previousSignedDocuments = await this.documentRepository.count({
      where: {
        status: DocumentStatus.COMPLETED,
        createdAt: Between(subMonths(startDate, 1), startDate),
      },
    });
    const signedChange = signedDocuments - previousSignedDocuments;
    const previousEncryptedDocuments = await this.documentRepository.count({
      where: {
        metadata: { isEncrypted: true },
        createdAt: Between(subMonths(startDate, 1), startDate),
      },
    });
    const encryptedChange = encryptedDocuments - previousEncryptedDocuments;
    const previousSharedDocuments = 0;
    const sharedChange = sharedDocuments - previousSharedDocuments;

    const documentStatusData = await this.getDocumentStatusData(startDate, now);
    const signatureProgressData = await this.getSignatureProgressData(
      startDate,
      now,
    );
    const recentActivity = await this.getRecentActivity(startDate, now);
    const topDocuments = await this.getTopDocuments(startDate, now);

    this.metrics = {
      totalDocuments,
      signedDocuments,
      encryptedDocuments,
      sharedDocuments,
      documentChange,
      signedChange,
      encryptedChange,
      sharedChange,
      documentStatusData,
      signatureProgressData,
      recentActivity,
      topDocuments,
    };

    return this.metrics;
  }

  private async getDocumentStatusData(
    startDate: Date,
    endDate: Date,
  ): Promise<DocumentStatusData[]> {
    const documents = await this.documentRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });
    const statusCounts: { [key: string]: number } = {};
    documents.forEach((doc) => {
      statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
    });
    return Object.keys(statusCounts).map((status) => ({
      status,
      count: statusCounts[status],
    }));
  }

  private async getSignatureProgressData(
    startDate: Date,
    endDate: Date,
  ): Promise<SignatureProgressData[]> {
    // Agrupar datos por fecha
    const dateGroups: {
      [key: string]: { completed: number; pending: number };
    } = {};
    const dateRange = this.generateDateRange(startDate, endDate);

    dateRange.forEach((date) => {
      const formattedDate = format(date, 'yyyy-MM-dd');
      dateGroups[formattedDate] = { completed: 0, pending: 0 };
    });

    const documents = await this.documentRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    documents.forEach((doc) => {
      const dateStr = format(doc.createdAt, 'yyyy-MM-dd');
      if (dateGroups[dateStr]) {
        if (doc.status === DocumentStatus.COMPLETED) {
          dateGroups[dateStr].completed++;
        } else if (doc.status === DocumentStatus.PENDING) {
          dateGroups[dateStr].pending++;
        }
      }
    });

    return Object.keys(dateGroups).map((date) => ({
      date,
      completed: dateGroups[date].completed,
      pending: dateGroups[date].pending,
    }));
  }

  private generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  private async getRecentActivity(
    startDate: Date,
    endDate: Date,
  ): Promise<RecentActivity[]> {
    const logs = await this.auditLogRepository.find({
      where: { timestamp: Between(startDate, endDate) },
      order: { timestamp: 'DESC' },
      take: 10,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      user: {
        id: log.userId,
        name: 'Usuario ' + log.userId.substring(0, 5), // Nombre simplificado para el ejemplo
      },
      resourceId: log.resourceId || '',
      resourceType: 'document',
      resourceName: log.details?.title || 'Documento',
      timestamp: log.timestamp.toISOString(),
      details: log.details,
    }));
  }

  private async getTopDocuments(
    startDate: Date,
    endDate: Date,
  ): Promise<TopDocument[]> {
    // Como no tenemos viewCount, usaremos los registros de auditoría para contar vistas
    const viewLogs = await this.auditLogRepository.find({
      where: {
        action: AuditAction.DOCUMENT_VIEW,
        timestamp: Between(startDate, endDate),
      },
    });

    // Contar vistas por documento
    const docViews: Record<string, number> = {};
    const docLastViewed: Record<string, Date> = {};

    viewLogs.forEach((log) => {
      if (log.resourceId) {
        docViews[log.resourceId] = (docViews[log.resourceId] || 0) + 1;

        // Actualizar última vista
        if (
          !docLastViewed[log.resourceId] ||
          log.timestamp > docLastViewed[log.resourceId]
        ) {
          docLastViewed[log.resourceId] = log.timestamp;
        }
      }
    });

    // Obtener IDs de documentos ordenados por vistas
    const sortedDocIds = Object.keys(docViews)
      .sort((a, b) => docViews[b] - docViews[a])
      .slice(0, 5);

    if (sortedDocIds.length === 0) {
      return [];
    }

    // Obtener los documentos
    const documents = await this.documentRepository.findByIds(sortedDocIds);

    // Mapear los documentos con sus vistas
    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      views: docViews[doc.id] || 0,
      lastViewed:
        docLastViewed[doc.id]?.toISOString() || doc.updatedAt.toISOString(),
    }));
  }

  async generateReport(range: 'week' | 'month' | 'year'): Promise<Buffer> {
    // Asegurarse de tener datos actualizados
    await this.getDashboardMetrics(range);

    const doc = new PDFDocument();

    doc
      .fontSize(20)
      .text(`Reporte de Analíticas (${range})`, { align: 'center' });
    doc
      .fontSize(14)
      .text(`Documentos Totales: ${this.metrics.totalDocuments}`, {
        align: 'left',
      });
    doc
      .fontSize(14)
      .text(`Documentos Firmados: ${this.metrics.signedDocuments}`, {
        align: 'left',
      });
    doc
      .fontSize(14)
      .text(`Documentos Encriptados: ${this.metrics.encryptedDocuments}`, {
        align: 'left',
      });
    doc
      .fontSize(14)
      .text(`Documentos Compartidos: ${this.metrics.sharedDocuments}`, {
        align: 'left',
      });

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', (err) => reject(err));
    });
  }
}
