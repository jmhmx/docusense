import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { DocumentPermission } from './entities/document-permission.entity';
import { ShareLink } from './entities/share-link.entity';
import { DocumentComment } from './entities/document-comment.entity';
import { Document } from '../documents/entities/document.entity';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentPermission,
      ShareLink,
      Document,
      DocumentComment,
    ]),
    UsersModule,
    forwardRef(() => DocumentsModule),
    AuditModule,
  ],
  controllers: [SharingController, CommentsController],
  providers: [SharingService, CommentsService],
  exports: [SharingService, CommentsService],
})
export class SharingModule {}
