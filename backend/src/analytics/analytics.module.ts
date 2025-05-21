// backend/src/analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Document } from '../documents/entities/document.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Signature } from '../signatures/entities/signature.entity';
import { User } from '../users/entities/user.entity';
import { DocumentsModule } from '../documents/documents.module';
import { AuditModule } from '../audit/audit.module';
import { SignaturesModule } from '../signatures/signatures.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, AuditLog, Signature, User]),
    DocumentsModule,
    AuditModule,
    SignaturesModule,
    UsersModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
