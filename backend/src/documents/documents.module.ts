// backend/src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentEncryptionController } from './document-encryption.controller';
import { DocumentPermissionsController } from './document-permissions.controller';
import { DocumentSignatureController } from './document-signature.controller';
import { Document } from './entities/document.entity';
import { DocumentProcessorService } from './processors/document-processor.service';
import { DocumentAnalyzerService } from '../analyzers/document-analyzer.service';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { SharingModule } from '../sharing/sharing.module';
import { BlockchainModule } from '../blockchain/blockchain.module'; // Import BlockchainModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    ScheduleModule.forRoot(),
    CryptoModule,
    AuditModule,
    SharingModule,
    BlockchainModule, // Add BlockchainModule to imports
  ],
  providers: [
    DocumentsService,
    DocumentProcessorService,
    DocumentAnalyzerService,
  ],
  controllers: [
    DocumentsController,
    DocumentEncryptionController,
    DocumentPermissionsController,
    DocumentSignatureController,
  ],
})
export class DocumentsModule {}
