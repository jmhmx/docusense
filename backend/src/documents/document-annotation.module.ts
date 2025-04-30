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

@Module({
  imports: [TypeOrmModule.forFeature([DocumentAnnotation, Document]), CryptoModule, AuditModule, SharingModule],
  providers: [DocumentAnnotationService, DocumentsService], // DocumentsService is needed by DocumentAnnotationService
  controllers: [DocumentAnnotationController],
  exports: [DocumentAnnotationService, DocumentAnnotationController], // Export the controller and service
})
export class DocumentAnnotationModule {}
