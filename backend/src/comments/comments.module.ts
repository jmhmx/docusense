import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Comment } from './entities/comment.entity';
import { SharingModule } from '../sharing/sharing.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Comment]),
    forwardRef(() => SharingModule), // Usar forwardRef para evitar dependencia circular
    forwardRef(() => DocumentsModule), // También para documentos
    AuditModule,
    forwardRef(() => NotificationsModule), // También para notificaciones
    UsersModule,
    EmailModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
