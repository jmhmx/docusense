import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from '../documents/entities/document.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Repository, Between } from 'typeorm';
import { format, subWeeks, subMonths, subYears } from 'date-fns';
import * as PDFDocument from 'pdfkit';

interface DashboardMetrics {
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

interface DocumentStatusData {
  status: string;
  count: number;
}

interface SignatureProgressData {
  status: string;
  count: number;
}

interface RecentActivity {
  date: string;
  activity: string;
  user: string;
}

interface TopDocument {
  title: string;
  views: number;
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
      where: { status: 'completed' },
    });
    const encryptedDocuments = await this.documentRepository.count();
    const sharedDocuments = 0;

    const previousDocuments = await this.documentRepository.count({
      where: { createdAt: Between(subMonths(startDate, 1), startDate) },
    });
    const documentChange = totalDocuments - previousDocuments;
    const previousSignedDocuments = await this.documentRepository.count({
      where: {
        status: 'completed',
        createdAt: Between(subMonths(startDate, 1), startDate),
      },
    });
    const signedChange = signedDocuments - previousSignedDocuments;
    const previousEncryptedDocuments = await this.documentRepository.count({
      where: { createdAt: Between(subMonths(startDate, 1), startDate) },
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
    const signatureCounts: { [key: string]: number } = {};
    const documents = await this.documentRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });
    documents.forEach((doc) => {
      if (doc.status === 'completed') {
        signatureCounts['signed'] = (signatureCounts['signed'] || 0) + 1;
      } else if (doc.status === 'pending') {
        signatureCounts['pending'] = (signatureCounts['pending'] || 0) + 1;
      } else if (doc.status === 'error') {
        signatureCounts['error'] = (signatureCounts['error'] || 0) + 1;
      }
    });
    return Object.keys(signatureCounts).map((status) => ({
      status,
      count: signatureCounts[status],
    }));
  }

  private async getRecentActivity(
    startDate: Date,
    endDate: Date,
  ): Promise<RecentActivity[]> {
    const logs = await this.auditLogRepository.find({
      where: { createdAt: Between(startDate, endDate) },
      order: { createdAt: 'DESC' },
    });
    return logs.map((log) => ({
      date: format(log.createdAt, 'dd/MM/yyyy HH:mm'),
      activity: log.description,
      user: 'Usuario',
    }));
  }

  private async getTopDocuments(
    startDate: Date,
    endDate: Date,
  ): Promise<TopDocument[]> {
    const documents = await this.documentRepository.find({
      where: { createdAt: Between(startDate, endDate) },
      order: { views: 'DESC' },
      take: 5,
    });
    return documents.map((doc) => ({
      title: doc.title,
      views: doc.views,
    }));
  }

  async generateReport(range: 'week' | 'month' | 'year'): Promise<Buffer> {
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
