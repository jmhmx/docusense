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
import { DocumentComment } from './entities/document-comment.entity';
import { SharingService } from './sharing.service';
import { DocumentsService } from '../documents/documents.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentFilterDto,
} from './dto/comment.dto';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(DocumentComment)
    private readonly commentsRepository: Repository<DocumentComment>,
    private readonly sharingService: SharingService,
    @Inject(forwardRef(() => DocumentsService))
    private readonly documentsService: DocumentsService,
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
  ): Promise<DocumentComment> {
    const { documentId, content, parentId, position, metadata } =
      createCommentDto;

    // Verificar si el documento existe
    const document = await this.documentsService.findOne(documentId);
    if (!document) {
      throw new NotFoundException(
        `Documento con ID ${documentId} no encontrado`,
      );
    }

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
      metadata: {
        ...metadata,
        createdFrom: ipAddress,
        userAgent,
      },
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
      },
      ipAddress,
      userAgent,
    );

    // Retornar el comentario creado
    return savedComment;
  }

  /**
   * Obtiene todos los comentarios de un documento
   */
  async findAll(
    filters: CommentFilterDto,
    userId: string,
  ): Promise<DocumentComment[]> {
    const {
      documentId,
      onlyResolved,
      onlyUnresolved,
      includeReplies = true,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortDirection = 'DESC',
    } = filters;

    // Si se especifica un documento, verificar acceso
    if (documentId) {
      const canAccess = await this.sharingService.canUserAccessDocument(
        userId,
        documentId,
      );
      if (!canAccess) {
        throw new ForbiddenException(
          'No tiene permiso para ver los comentarios de este documento',
        );
      }
    }

    // Construir la consulta base
    const queryBuilder = this.commentsRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .select(['comment', 'user.id', 'user.name', 'user.email']);

    // Aplicar filtros
    if (documentId) {
      queryBuilder.andWhere('comment.documentId = :documentId', { documentId });
    }

    if (filters.userId) {
      queryBuilder.andWhere('comment.userId = :userId', {
        userId: filters.userId,
      });
    }

    if (onlyResolved) {
      queryBuilder.andWhere('comment.isResolved = :isResolved', {
        isResolved: true,
      });
    }

    if (onlyUnresolved) {
      queryBuilder.andWhere('comment.isResolved = :isResolved', {
        isResolved: false,
      });
    }

    // Solo comentarios principales (no respuestas) a menos que se solicite incluir respuestas
    if (!includeReplies) {
      queryBuilder.andWhere('comment.parentId IS NULL');
    }

    // Aplicar ordenamiento
    queryBuilder.orderBy(`comment.${sortBy}`, sortDirection);

    // Aplicar paginación
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const comments = await queryBuilder.getMany();

    return comments;
  }

  /**
   * Encuentra un comentario por ID con verificación de acceso
   */
  async findOne(id: string, userId: string): Promise<DocumentComment> {
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
  ): Promise<DocumentComment> {
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
  ): Promise<DocumentComment[]> {
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
      // Si incluimos respuestas, ordenar para que los padres vengan primero
      queryBuilder.orderBy('COALESCE(comment.parentId, comment.id)', 'ASC');
      // Y luego por fecha de creación
      queryBuilder.addOrderBy('comment.createdAt', 'ASC');
    }

    return queryBuilder.getMany();
  }

  /**
   * Obtiene las respuestas a un comentario
   */
  async getCommentReplies(
    commentId: string,
    userId: string,
  ): Promise<DocumentComment[]> {
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
    const unreadComments = await this.commentsRepository.find({
      where: {
        documentId,
        'metadata->readBy': null, // Comentarios que no tienen al usuario en readBy
      },
    });

    // Actualizar el arreglo de lectores de cada comentario
    for (const comment of unreadComments) {
      comment.metadata = {
        ...comment.metadata,
        readBy: [...(comment.metadata?.readBy || []), userId],
      };
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
      .andWhere('comment.userId != :userId', { userId }); // No contar comentarios propios

    // Esta parte depende de cómo almacenes los lectores, ajustar según implementación
    queryBuilder.andWhere(`NOT(comment.metadata->>'readBy' @> :userIdJson)`, {
      userIdJson: JSON.stringify([userId]),
    });

    return queryBuilder.getCount();
  }
}
