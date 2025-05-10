import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { SharingService } from '../sharing/sharing.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    private readonly sharingService: SharingService,
    private readonly auditLogService: AuditLogService,
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

    // Retornar el comentario creado
    return savedComment;
  }

  /**
   * Encuentra un comentario por ID con verificación de acceso
   */
  async findOne(id: string, userId: string): Promise<Comment> {
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
      throw new ForbiddenException('No tiene permiso para ver este comentario');
    }

    return comment;
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
    if (updateCommentDto.isResolved === true && comment.isResolved === false) {
      comment.resolvedBy = userId;
      comment.resolvedAt = new Date();
    }

    // Si se está marcando como no resuelto, eliminar datos de resolución
    if (updateCommentDto.isResolved === false && comment.isResolved === true) {
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
  }

  /**
   * Obtiene los comentarios de un documento
   */
  async getDocumentComments(
    documentId: string,
    userId: string,
    includeReplies: boolean = true,
  ): Promise<Comment[]> {
    // Verificar acceso al documento
    const canAccess = await this.sharingService.canUserAccessDocument(
      userId,
      documentId,
    );
    if (!canAccess) {
      throw new ForbiddenException(
        'No tiene permiso para ver los comentarios de este documento',
      );
    }

    // Consulta base
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

    // Marcar como leídos
    try {
      await this.markDocumentCommentsAsRead(documentId, userId);
    } catch (error) {
      this.logger.error(`Error marking comments as read: ${error.message}`);
    }

    return comments;
  }

  /**
   * Obtiene las respuestas a un comentario
   */
  async getCommentReplies(
    commentId: string,
    userId: string,
  ): Promise<Comment[]> {
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
  }

  /**
   * Marca como leídos todos los comentarios de un documento para un usuario
   */
  async markDocumentCommentsAsRead(
    documentId: string,
    userId: string,
  ): Promise<void> {
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

    // Actualizar el arreglo de lectores de cada comentario
    for (const comment of unreadComments) {
      comment.readBy = [...(comment.readBy || []), userId];
    }

    // Guardar todos los comentarios actualizados
    if (unreadComments.length > 0) {
      await this.commentsRepository.save(unreadComments);
    }
  }

  /**
   * Cuenta los comentarios no leídos de un documento para un usuario
   */
  async countUnreadDocumentComments(
    documentId: string,
    userId: string,
  ): Promise<number> {
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
    const queryBuilder = this.commentsRepository
      .createQueryBuilder('comment')
      .where('comment.documentId = :documentId', { documentId })
      .andWhere('comment.userId != :userId', { userId }) // No contar comentarios propios
      .andWhere(
        'comment.readBy IS NULL OR NOT(:userId = ANY(comment.readBy))',
        { userId },
      );

    return queryBuilder.getCount();
  }
}
