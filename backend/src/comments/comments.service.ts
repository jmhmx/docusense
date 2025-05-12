// backend/src/comments/comments.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { SharingService } from '../sharing/sharing.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @Inject(forwardRef(() => SharingService))
    private readonly sharingService: SharingService,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Crea un nuevo comentario en un documento
   */
  async create(
    createCommentDto: CreateCommentDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Comment> {
    try {
      this.logger.log(
        `Creando comentario para usuario ${userId} en documento ${createCommentDto.documentId}`,
      );

      const {
        documentId,
        content,
        parentId,
        position,
        mentions,
        isPrivate,
        attachmentUrl,
      } = createCommentDto;

      // Verificar permisos para comentar
      const canComment = await this.sharingService.canUserCommentDocument(
        userId,
        documentId,
      );

      if (!canComment) {
        this.logger.warn(
          `Usuario ${userId} no tiene permisos para comentar en documento ${documentId}`,
        );
        throw new ForbiddenException(
          'No tiene permiso para comentar en este documento',
        );
      }

      // Si es una respuesta, verificar que el comentario padre existe
      if (parentId) {
        const parentComment = await this.commentsRepository.findOne({
          where: { id: parentId },
        });

        if (!parentComment) {
          throw new NotFoundException(
            `Comentario padre con ID ${parentId} no encontrado`,
          );
        }

        // Verificar que el comentario padre pertenece al mismo documento
        if (parentComment.documentId !== documentId) {
          throw new BadRequestException(
            'El comentario padre no pertenece al mismo documento',
          );
        }
      }

      // Crear el comentario
      const comment = this.commentsRepository.create({
        documentId,
        userId,
        content,
        parentId,
        position,
        mentions,
        isPrivate: isPrivate || false,
        hasAttachment: !!attachmentUrl,
        attachmentUrl,
        readBy: [userId], // Marcar como leído por el autor
      });

      const savedComment = await this.commentsRepository.save(comment);
      this.logger.log(`Comentario creado con éxito: ${savedComment.id}`);

      // Registrar en log de auditoría
      await this.auditLogService.log(
        AuditAction.COMMENT_CREATE,
        userId,
        documentId,
        {
          commentId: savedComment.id,
          content: savedComment.content.substring(0, 100), // Truncar contenido largo
          isReply: !!parentId,
          hasMentions: mentions && mentions.length > 0,
        },
        ipAddress,
        userAgent,
      );

      // Procesar menciones y enviar notificaciones
      if (mentions && mentions.length > 0 && this.notificationsService) {
        try {
          this.logger.log(
            `Procesando menciones para el comentario ${savedComment.id}`,
          );
          // Solo pasamos los datos necesarios para evitar dependencia circular
          this.notificationsService
            .createMentionNotification(
              documentId,
              savedComment.id,
              mentions,
              userId,
            )
            .catch((error) => {
              this.logger.error(
                `Error enviando notificaciones de mención: ${error.message}`,
              );
            });
        } catch (error) {
          this.logger.error(`Error procesando menciones: ${error.message}`);
          // Continuamos aunque falle el envío de notificaciones
        }
      }

      // Retornar el comentario creado
      return savedComment;
    } catch (error) {
      this.logger.error(
        `Error al crear comentario: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Encuentra un comentario por ID con verificación de acceso
   */
  async findOne(id: string, userId: string): Promise<Comment> {
    try {
      const comment = await this.commentsRepository.findOne({
        where: { id },
        relations: ['user', 'replies', 'replies.user'],
      });

      if (!comment) {
        throw new NotFoundException(`Comentario con ID ${id} no encontrado`);
      }

      // Verificar acceso al documento
      const canAccess = await this.sharingService.canUserAccessDocument(
        userId,
        comment.documentId,
      );

      if (!canAccess) {
        throw new ForbiddenException(
          'No tiene permiso para ver este comentario',
        );
      }

      return comment;
    } catch (error) {
      this.logger.error(
        `Error al buscar comentario ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Actualiza un comentario
   */
  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Comment> {
    try {
      // Buscar el comentario
      const comment = await this.commentsRepository.findOne({
        where: { id },
      });

      if (!comment) {
        throw new NotFoundException(`Comentario con ID ${id} no encontrado`);
      }

      // Solo el autor del comentario o alguien con permisos de editor puede modificarlo
      if (
        comment.userId !== userId &&
        !(await this.sharingService.canUserModifyDocument(
          userId,
          comment.documentId,
        ))
      ) {
        throw new ForbiddenException(
          'No tiene permiso para modificar este comentario',
        );
      }

      // Si se está marcando como resuelto, registrar quién lo resolvió
      if (
        updateCommentDto.isResolved === true &&
        comment.isResolved === false
      ) {
        comment.resolvedBy = userId;
        comment.resolvedAt = new Date();
      }

      // Si se está marcando como no resuelto, eliminar datos de resolución
      if (
        updateCommentDto.isResolved === false &&
        comment.isResolved === true
      ) {
        comment.resolvedBy = null;
        comment.resolvedAt = null;
      }

      // Actualizar el comentario
      Object.assign(comment, updateCommentDto);
      const updatedComment = await this.commentsRepository.save(comment);

      // Registrar en log de auditoría
      await this.auditLogService.log(
        AuditAction.COMMENT_UPDATE,
        userId,
        comment.documentId,
        {
          commentId: comment.id,
          changes: updateCommentDto,
        },
        ipAddress,
        userAgent,
      );

      return updatedComment;
    } catch (error) {
      this.logger.error(
        `Error al actualizar comentario ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Elimina un comentario
   */
  async remove(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Buscar el comentario
      const comment = await this.commentsRepository.findOne({
        where: { id },
      });

      if (!comment) {
        throw new NotFoundException(`Comentario con ID ${id} no encontrado`);
      }

      // Solo el autor o alguien con permisos de editor puede eliminar el comentario
      if (
        comment.userId !== userId &&
        !(await this.sharingService.canUserModifyDocument(
          userId,
          comment.documentId,
        ))
      ) {
        throw new ForbiddenException(
          'No tiene permiso para eliminar este comentario',
        );
      }

      // Guardar datos para el log antes de eliminar
      const documentId = comment.documentId;
      const commentContent = comment.content.substring(0, 100);

      // Eliminar el comentario
      await this.commentsRepository.remove(comment);

      // Registrar en log de auditoría
      await this.auditLogService.log(
        AuditAction.COMMENT_DELETE,
        userId,
        documentId,
        {
          commentId: id,
          content: commentContent,
        },
        ipAddress,
        userAgent,
      );
    } catch (error) {
      this.logger.error(
        `Error al eliminar comentario ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene los comentarios de un documento
   */
  async getDocumentComments(
    documentId: string,
    userId: string,
    includeReplies: boolean = true,
  ): Promise<Comment[]> {
    try {
      this.logger.log(
        `Obteniendo comentarios del documento ${documentId} para usuario ${userId}`,
      );

      // Verificar acceso al documento
      const canAccess = await this.sharingService.canUserAccessDocument(
        userId,
        documentId,
      );

      if (!canAccess) {
        this.logger.warn(
          `Usuario ${userId} no tiene acceso al documento ${documentId}`,
        );
        throw new ForbiddenException(
          'No tiene permiso para ver los comentarios de este documento',
        );
      }

      // Construir la consulta
      const queryBuilder = this.commentsRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .where('comment.documentId = :documentId', { documentId })
        .select(['comment', 'user.id', 'user.name', 'user.email']);

      // Si no incluimos respuestas, filtrar solo comentarios principales
      if (!includeReplies) {
        queryBuilder.andWhere('comment.parentId IS NULL');
      } else {
        // Si incluimos respuestas, cargar también las respuestas
        queryBuilder
          .leftJoinAndSelect('comment.replies', 'replies')
          .leftJoinAndSelect('replies.user', 'replyUser');

        // Ordenar para que los padres vengan primero
        queryBuilder.orderBy('COALESCE(comment.parentId, comment.id)', 'ASC');
        // Y luego por fecha de creación
        queryBuilder.addOrderBy('comment.createdAt', 'ASC');
      }

      // Ejecutar consulta
      const comments = await queryBuilder.getMany();
      this.logger.log(
        `${comments.length} comentarios encontrados para el documento ${documentId}`,
      );

      // Marcar como leídos
      try {
        await this.markDocumentCommentsAsRead(documentId, userId);
      } catch (error) {
        this.logger.error(
          `Error marcando comentarios como leídos: ${error.message}`,
        );
      }

      return comments;
    } catch (error) {
      this.logger.error(
        `Error obteniendo comentarios del documento ${documentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene las respuestas a un comentario
   */
  async getCommentReplies(
    commentId: string,
    userId: string,
  ): Promise<Comment[]> {
    try {
      // Buscar el comentario para verificar acceso
      const comment = await this.commentsRepository.findOne({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException(
          `Comentario con ID ${commentId} no encontrado`,
        );
      }

      // Verificar acceso al documento
      const canAccess = await this.sharingService.canUserAccessDocument(
        userId,
        comment.documentId,
      );

      if (!canAccess) {
        throw new ForbiddenException(
          'No tiene permiso para ver las respuestas a este comentario',
        );
      }

      // Obtener respuestas
      return this.commentsRepository.find({
        where: { parentId: commentId },
        relations: ['user'],
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error(
        `Error obteniendo respuestas del comentario ${commentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Marca como leídos todos los comentarios de un documento para un usuario
   */
  async markDocumentCommentsAsRead(
    documentId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Verificar acceso al documento
      const canAccess = await this.sharingService.canUserAccessDocument(
        userId,
        documentId,
      );

      if (!canAccess) {
        throw new ForbiddenException(
          'No tiene permiso para acceder a este documento',
        );
      }

      // Buscar todos los comentarios no leídos del documento
      const unreadComments = await this.commentsRepository
        .createQueryBuilder('comment')
        .where('comment.documentId = :documentId', { documentId })
        .andWhere(
          'comment.readBy IS NULL OR NOT(:userId = ANY(comment.readBy))',
          { userId },
        )
        .getMany();

      if (unreadComments.length === 0) {
        return;
      }

      // Actualizar el arreglo de lectores de cada comentario
      for (const comment of unreadComments) {
        comment.readBy = [...(comment.readBy || []), userId];
      }

      // Guardar todos los comentarios actualizados
      await this.commentsRepository.save(unreadComments);
      this.logger.log(
        `${unreadComments.length} comentarios marcados como leídos para el usuario ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error marcando comentarios como leídos: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cuenta los comentarios no leídos de un documento para un usuario
   */
  async countUnreadDocumentComments(
    documentId: string,
    userId: string,
  ): Promise<number> {
    try {
      // Verificar acceso al documento
      const canAccess = await this.sharingService.canUserAccessDocument(
        userId,
        documentId,
      );

      if (!canAccess) {
        throw new ForbiddenException(
          'No tiene permiso para acceder a este documento',
        );
      }

      // Contar comentarios no leídos
      const count = await this.commentsRepository
        .createQueryBuilder('comment')
        .where('comment.documentId = :documentId', { documentId })
        .andWhere('comment.userId != :userId', { userId }) // No contar comentarios propios
        .andWhere(
          'comment.readBy IS NULL OR NOT(:userId = ANY(comment.readBy))',
          { userId },
        )
        .getCount();

      return count;
    } catch (error) {
      this.logger.error(
        `Error contando comentarios no leídos: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
