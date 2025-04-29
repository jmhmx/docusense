import { Module } from '@nestjs/common';
import { DocumentAnnotationService } from './document-annotation.service';
import { DocumentAnnotationController } from './document-annotation.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentAnnotation } from './entities/document-annotation.entity';
import { Document } from './entities/document.entity';
import { DocumentsService } from './documents.service';
import { CryptoModule } from 'src/crypto/crypto.module';
import { AuditModule } from 'src/audit/audit.module';
import { SharingModule } from '../sharing/sharing.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentAnnotation, Document]),
    CryptoModule,
    AuditModule,
    SharingModule,
    BlockchainModule, // Añadir el módulo aquí
  ],
  providers: [DocumentAnnotationService, DocumentsService],
  controllers: [DocumentAnnotationController],
  exports: [DocumentAnnotationService],
})
export class DocumentAnnotationModule {}
