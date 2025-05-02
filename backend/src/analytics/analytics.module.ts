// backend/src/analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Document } from '../documents/entities/document.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Signature } from '../signatures/entities/signature.entity';
import { DocumentsModule } from '../documents/documents.module';
import { AuditModule } from '../audit/audit.module';
import { SignaturesModule } from '../signatures/signatures.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, AuditLog, Signature]),
    DocumentsModule,
    AuditModule,
    SignaturesModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}