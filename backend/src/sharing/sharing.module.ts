// backend/src/sharing/sharing.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { CommentsService } from './comments.service';
import { DocumentPermission } from './entities/document-permission.entity';
import { ShareLink } from './entities/share-link.entity';
import { DocumentComment } from './entities/document-comment.entity';
import { Document } from '../documents/entities/document.entity';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuditModule } from '../audit/audit.module';
import { CommentsModule } from '../comments/comments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

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
    forwardRef(() => CommentsModule),
    forwardRef(() => NotificationsModule),
    EmailModule,
  ],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
