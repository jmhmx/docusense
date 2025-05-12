import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    EmailModule,
    UsersModule,
    forwardRef(() => DocumentsModule), // Usar forwardRef para evitar la dependencia circular
    WebsocketModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
