import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentAnnotationService } from './document-annotation.service';
import { DocumentAnnotationController } from './document-annotation.controller';
import { DocumentAnnotation } from './entities/document-annotation.entity';
import { Document } from './entities/document.entity';
import { DocumentsService } from './documents.service';
import { CryptoService } from 'src/crypto/crypto.service';
import { AuditLogService } from 'src/audit/audit-log.service';
import { SharingService } from 'src/sharing/sharing.service';
import { BlockchainService } from 'src/blockchain/blockchain.service';
import { DocumentProcessorService } from './processors/document-processor.service';
import { DocumentAnalyzerService } from 'src/analyzers/document-analyzer.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentAnnotation, Document])],
  controllers: [DocumentAnnotationController],
  providers: [DocumentAnnotationService, DocumentsService, CryptoService, AuditLogService, SharingService, BlockchainService, DocumentProcessorService, DocumentAnalyzerService],
})
export class DocumentAnnotationModule {}