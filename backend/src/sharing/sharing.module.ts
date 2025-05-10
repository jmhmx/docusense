import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { DocumentPermission } from './entities/document-permission.entity';
import { ShareLink } from './entities/share-link.entity';
import { DocumentComment } from './entities/document-comment.entity';
import { Document } from '../documents/entities/document.entity';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentPermission,
      ShareLink,
      Document,
      DocumentComment,
    ]),
    UsersModule,
    forwardRef(() => DocumentsModule), // Usar forwardRef para evitar dependencia circular
    AuditModule,
    NotificationsModule, // Importamos el módulo de notificaciones
  ],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
