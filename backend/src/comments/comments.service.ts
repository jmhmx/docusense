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
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from 'src/documents/documents.service';

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
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly documentsService: DocumentsService,
  ) {}

  /**
   * Obtiene los usuarios con permiso para un documento
   */
  async getUsersWithAccessToDocument(documentId: string): Promise<string[]> {
    try {
      const users = await this.sharingService.getDocumentUsers(
        documentId,
        null,
      );
      return users.map((user) => user.id);
    } catch (error) {
      this.logger.error(
        `Error obteniendo usuarios con acceso: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Valida que los usuarios mencionados tengan acceso al documento
   */
  async validateMentions(
    documentId: string,
    mentions: string[],
  ): Promise<string[]> {
    if (!mentions || mentions.length === 0) return [];

    // Obtener usuarios con acceso al documento
    const usersWithAccess = await this.getUsersWithAccessToDocument(documentId);

    // Filtrar solo usuarios con acceso
    const validMentions = mentions.filter((mention) =>
      usersWithAccess.includes(mention),
    );

    if (validMentions.length < mentions.length) {
      this.logger.warn(
        `Se eliminaron ${mentions.length - validMentions.length} menciones a usuarios sin acceso al documento`,
      );
    }

    return validMentions;
  }

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

      // Verificar permisos para comentar - comprobar diferentes casos
      let canComment = false;
      try {
        canComment = await this.sharingService.canUserCommentDocument(
          userId,
          documentId,
        );
      } catch (err) {
        this.logger.warn(`Error verificando permisos: ${err.message}`);
        // Intentar con acceso básico en caso de error
        try {
          const canAccess = await this.sharingService.canUserAccessDocument(
            userId,
            documentId,
          );
          canComment = canAccess; // Si al menos puede acceder, le permitimos comentar temporalmente
        } catch (accessErr) {
          this.logger.error(`Error verificando acceso: ${accessErr.message}`);
          canComment = false;
        }
      }

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
        const parentComment = await this.commentsRepository.findOneBy({
          id: parentId,
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

      // Validar menciones antes de crear el comentario
      if (createCommentDto.mentions && createCommentDto.mentions.length > 0) {
        createCommentDto.mentions = await this.validateMentions(
          createCommentDto.documentId,
          createCommentDto.mentions,
        );
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
      try {
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
      } catch (auditError) {
        this.logger.error(
          `Error en registro de auditoría: ${auditError.message}`,
        );
        // Continuamos aunque falle la auditoría
      }

      // Procesar menciones y enviar notificaciones
      if (mentions && mentions.length > 0 && this.notificationsService) {
        try {
          this.logger.log(
            `Procesando menciones para el comentario ${savedComment.id}`,
          );
          // Solo pasamos los datos necesarios para evitar dependencia circular
          await this.notificationsService
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

      //Enviar notificaciones por correo a los usuarios con acceso al documento
      await this.notifyUsersAboutComment(savedComment, userId, parentId);

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

  // Método para notificar a usuarios sobre un nuevo comentario
  private async notifyUsersAboutComment(
    comment: Comment,
    authorId: string,
    parentId?: string,
  ): Promise<void> {
    try {
      // Obtener el documento
      const document = await this.documentsService.findOne(comment.documentId);
      if (!document) {
        throw new Error(`Documento ${comment.documentId} no encontrado`);
      }

      // Obtener el autor del comentario
      const author = await this.usersService.findOne(authorId);
      if (!author) {
        throw new Error(`Usuario ${authorId} no encontrado`);
      }

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const documentUrl = `${frontendUrl}/documents/${comment.documentId}`;

      if (parentId) {
        // Si es una respuesta a un comentario, notificar al autor del comentario original
        const parentComment = await this.commentsRepository.findOne({
          where: { id: parentId },
        });

        if (parentComment && parentComment.userId !== authorId) {
          const parentAuthor = await this.usersService.findOne(
            parentComment.userId,
          );

          if (parentAuthor) {
            await this.emailService.sendCommentReplyEmail(parentAuthor.email, {
              userName: parentAuthor.name,
              responderName: author.name,
              documentTitle: document.title,
              documentUrl: documentUrl,
              originalComment: parentComment.content,
              replyContent: comment.content,
            });
            this.logger.log(
              `Notificación de respuesta enviada a ${parentAuthor.email}`,
            );
          }
        }
      } else {
        // Si es un comentario nuevo, notificar a todos los usuarios con acceso
        try {
          // Obtener usuarios con acceso al documento
          const usersWithAccess = await this.sharingService.getDocumentUsers(
            comment.documentId,
            authorId,
          );

          // Filtrar al autor del comentario para no enviarle notificación
          const usersToNotify = usersWithAccess.filter(
            (user) => user.id !== authorId,
          );

          for (const user of usersToNotify) {
            await this.emailService.sendNewCommentEmail(user.email, {
              userName: user.name,
              commenterName: author.name,
              documentTitle: document.title,
              documentUrl: documentUrl,
              commentContent: comment.content,
            });
            this.logger.log(
              `Notificación de nuevo comentario enviada a ${user.email}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error al obtener usuarios para notificar: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error enviando notificaciones de comentario: ${error.message}`,
      );
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
      let canAccess = false;
      try {
        canAccess = await this.sharingService.canUserAccessDocument(
          userId,
          comment.documentId,
        );
      } catch (err) {
        this.logger.warn(`Error verificando acceso: ${err.message}`);
        // Por defecto, si es el autor del comentario, darle acceso
        canAccess = comment.userId === userId;
      }

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
      const comment = await this.commentsRepository.findOneBy({
        id,
      });

      if (!comment) {
        throw new NotFoundException(`Comentario con ID ${id} no encontrado`);
      }

      // Si trata de resolver un comentario, verificar si es el propietario del comentario padre
      if (updateCommentDto.isResolved !== undefined) {
        // Si es un comentario principal, solo el autor puede resolverlo
        if (!comment.parentId && comment.userId !== userId) {
          throw new ForbiddenException(
            'Solo el autor del comentario puede marcarlo como resuelto',
          );
        }

        // Si es una respuesta, verificar el comentario padre
        if (comment.parentId) {
          const parentComment = await this.commentsRepository.findOneBy({
            id: comment.parentId,
          });

          if (parentComment && parentComment.userId !== userId) {
            throw new ForbiddenException(
              'Solo el autor del comentario principal puede marcar como resuelto',
            );
          }
        }
      } else {
        // Para otras actualizaciones, comprobar permisos normales: el autor siempre puede modificar su comentario
        let canModify = comment.userId === userId;

        // Si no es el autor, verificar si tiene permisos de edición en el documento
        if (!canModify) {
          try {
            canModify = await this.sharingService.canUserModifyDocument(
              userId,
              comment.documentId,
            );
          } catch (err) {
            this.logger.warn(
              `Error verificando permisos de modificación: ${err.message}`,
            );
            canModify = false;
          }
        }

        if (!canModify) {
          throw new ForbiddenException(
            'No tiene permiso para modificar este comentario',
          );
        }
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
      try {
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
      } catch (auditError) {
        this.logger.error(
          `Error en registro de auditoría: ${auditError.message}`,
        );
        // Continuamos aunque falle la auditoría
      }

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
      const comment = await this.commentsRepository.findOneBy({
        id,
      });

      if (!comment) {
        throw new NotFoundException(`Comentario con ID ${id} no encontrado`);
      }

      // Comprobar permisos: el autor siempre puede eliminar su comentario
      let canDelete = comment.userId === userId;

      // Si no es el autor, verificar si tiene permisos de edición en el documento
      if (!canDelete) {
        try {
          canDelete = await this.sharingService.canUserModifyDocument(
            userId,
            comment.documentId,
          );
        } catch (err) {
          this.logger.warn(
            `Error verificando permisos de modificación: ${err.message}`,
          );
          canDelete = false;
        }
      }

      if (!canDelete) {
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
      try {
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
      } catch (auditError) {
        this.logger.error(
          `Error en registro de auditoría: ${auditError.message}`,
        );
      }
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
      let canAccess = false;
      try {
        canAccess = await this.sharingService.canUserAccessDocument(
          userId,
          documentId,
        );
      } catch (err) {
        this.logger.warn(`Error verificando acceso: ${err.message}`);
        // Intentar recuperación del error - permitimos acceso temporal
        canAccess = true;
      }

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
        queryBuilder.orderBy('comment.parentId', 'ASC');
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
      const comment = await this.commentsRepository.findOneBy({
        id: commentId,
      });

      if (!comment) {
        throw new NotFoundException(
          `Comentario con ID ${commentId} no encontrado`,
        );
      }

      // Verificar acceso al documento (o si es el autor del comentario)
      let canAccess = comment.userId === userId;

      if (!canAccess) {
        try {
          canAccess = await this.sharingService.canUserAccessDocument(
            userId,
            comment.documentId,
          );
        } catch (err) {
          this.logger.warn(`Error verificando acceso: ${err.message}`);
          canAccess = false;
        }
      }

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
      let canAccess = false;
      try {
        canAccess = await this.sharingService.canUserAccessDocument(
          userId,
          documentId,
        );
      } catch (err) {
        this.logger.warn(`Error verificando acceso: ${err.message}`);
        // Por seguridad, permitimos la operación ya que solo afecta al estado de lectura
        canAccess = true;
      }

      if (!canAccess) {
        throw new ForbiddenException(
          'No tiene permiso para acceder a este documento',
        );
      }

      // Buscar todos los comentarios no leídos del documento
      const unreadComments = await this.commentsRepository
        .createQueryBuilder('comment')
        .where('comment.documentId = :documentId', { documentId })
        .getMany();

      if (unreadComments.length === 0) {
        return;
      }

      // Iterar y actualizar cada comentario, manejando correctamente el array readBy
      let updatedCount = 0;
      for (const comment of unreadComments) {
        // Si el usuario ya está en readBy, omitimos este comentario
        if (comment.readBy && comment.readBy.includes(userId)) {
          continue;
        }

        // Actualizar el arreglo readBy, asegurando que sea un array
        comment.readBy = Array.isArray(comment.readBy)
          ? [...comment.readBy, userId]
          : [userId];

        updatedCount++;
      }

      // Solo guardar si hubo cambios
      if (updatedCount > 0) {
        await this.commentsRepository.save(unreadComments);
        this.logger.log(
          `${updatedCount} comentarios marcados como leídos para el usuario ${userId}`,
        );
      } else {
        this.logger.log(
          `No hubo comentarios para marcar como leídos para el usuario ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error marcando comentarios como leídos: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al marcar comentarios como leídos: ${error.message}`,
      );
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
      let canAccess = false;
      try {
        canAccess = await this.sharingService.canUserAccessDocument(
          userId,
          documentId,
        );
      } catch (err) {
        this.logger.warn(`Error verificando acceso: ${err.message}`);
        // Por seguridad, permitimos la operación ya que solo afecta al conteo
        canAccess = true;
      }

      if (!canAccess) {
        throw new ForbiddenException(
          'No tiene permiso para acceder a este documento',
        );
      }

      // Contar comentarios no leídos - CORREGIDO
      // Problema: El error "op ANY/ALL (array) requires array on right side"
      // se produce porque estamos usando readBy que puede ser null
      const comments = await this.commentsRepository
        .createQueryBuilder('comment')
        .where('comment.documentId = :documentId', { documentId })
        .andWhere('comment.userId != :userId', { userId }) // No contar comentarios propios
        .getMany();

      // Filtramos manualmente los que no están leídos por el usuario
      const unreadCount = comments.filter((comment) => {
        // Si readBy es null o no incluye el userId, es no leído
        return !comment.readBy || !comment.readBy.includes(userId);
      }).length;

      return unreadCount;
    } catch (error) {
      this.logger.error(
        `Error contando comentarios no leídos: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al contar comentarios no leídos: ${error.message}`,
      );
    }
  }
}
