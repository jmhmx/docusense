import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Notification } from './entities/notification.entity';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
@WebSocketGateway({ cors: true })
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    private emailService: EmailService,
    private usersService: UsersService,
    private documentsService: DocumentsService,
  ) {}

  // Obtener notificaciones de un usuario
  async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      return this.notificationsRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 50, // Limitar a las 50 más recientes
      });
    } catch (error) {
      this.logger.error(`Error fetching notifications: ${error.message}`);
      return [];
    }
  }

  // Marcar notificación como leída
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const notification = await this.notificationsRepository.findOne({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        return false;
      }

      notification.isRead = true;
      await this.notificationsRepository.save(notification);
      return true;
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error.message}`);
      return false;
    }
  }

  // Marcar todas las notificaciones de un usuario como leídas
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      await this.notificationsRepository.update(
        { userId, isRead: false },
        { isRead: true },
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error marking all notifications as read: ${error.message}`,
      );
      return false;
    }
  }

  // Crear notificación para mención en comentario
  async createMentionNotification(
    documentId: string,
    commentId: string,
    mentionedUserIds: string[],
    commentAuthorId: string,
  ) {
    try {
      // Obtener información del documento y autor
      const document = await this.documentsService.findOne(documentId);
      const author = await this.usersService.findOne(commentAuthorId);

      // Para cada usuario mencionado, crear una notificación
      for (const userId of mentionedUserIds) {
        // Verificar que el usuario existe
        const user = await this.usersService.findOne(userId);

        if (!user) continue;

        // Crear la notificación en BD
        const notification = await this.notificationsRepository.save({
          userId,
          type: 'comment_mention',
          title: `${author.name} te ha mencionado en un comentario`,
          message: `Has sido mencionado en un comentario del documento "${document.title}"`,
          data: {
            documentId,
            commentId,
          },
          isRead: false,
        });

        // Enviar notificación en tiempo real si el usuario está conectado
        this.server.to(userId).emit('notification', notification);

        // Enviar email (opcional)
        try {
          this.emailService.sendMentionNotification(user.email, {
            userName: user.name,
            mentionedBy: author.name,
            documentTitle: document.title,
            documentUrl: `${process.env.FRONTEND_URL}/documents/${documentId}`,
          });
        } catch (emailError) {
          this.logger.error(
            `Error sending email notification: ${emailError.message}`,
          );
          // Continuar aunque falle el envío de email
        }
      }
    } catch (error) {
      this.logger.error(
        `Error creating mention notifications: ${error.message}`,
      );
    }
  }
}
