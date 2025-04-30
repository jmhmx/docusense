import { Module, forwardRef } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentPermission } from './entities/document-permission.entity';
import { ShareLink } from './entities/share-link.entity';
import { DocumentsModule } from '../documents/documents.module'; // Import DocumentsModule
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { Document } from '../documents/entities/document.entity'; // Import Document

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentPermission, ShareLink, Document]), // Import Document repository here
    UsersModule,
    AuditModule,
    forwardRef(() => DocumentsModule), // Import DocumentsModule with forwardRef
  ],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
