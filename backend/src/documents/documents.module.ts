import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentEncryptionController } from './document-encryption.controller';
import { Document } from './entities/document.entity';
import { DocumentProcessorService } from './processors/document-processor.service';
import { DocumentAnalyzerService } from '../analyzers/document-analyzer.service';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { SharingModule } from '../sharing/sharing.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    ScheduleModule.forRoot(),
    CryptoModule,
    AuditModule,
    forwardRef(() => SharingModule), // Usar forwardRef para evitar dependencia circular
    forwardRef(() => BlockchainModule),
  ],
  controllers: [DocumentsController, DocumentEncryptionController],
  providers: [
    DocumentsService,
    DocumentProcessorService,
    DocumentAnalyzerService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
