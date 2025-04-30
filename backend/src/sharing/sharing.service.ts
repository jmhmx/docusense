import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

import {
  DocumentPermission,
  PermissionLevel,
} from './entities/document-permission.entity';
import { ShareLink } from './entities/share-link.entity';
import { Document } from '../documents/entities/document.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { DocumentsService } from '../documents/documents.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

import {
  ShareDocumentDto,
  CreateShareLinkDto,
  AccessShareLinkDto,
} from './dto/share-document.dto';

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    @InjectRepository(DocumentPermission)
    private readonly documentPermissionRepository: Repository<DocumentPermission>,
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => DocumentsService)) //Add forward ref here
    private readonly documentsService: DocumentsService,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Comparte un documento con otro usuario por email
   */
  async shareDocumentWithUser(
    sharerUserId: string,
    shareDocumentDto: ShareDocumentDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DocumentPermission> {
    const {
      documentId,
      email,
      permissionLevel,
      expiresAt,
      notifyUser = true,
    } = shareDocumentDto;

    // Verificar si el documento existe
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(
        `Documento con ID ${documentId} no encontrado`,
      );
    }

    // Verificar si el usuario que comparte tiene permiso de editor u owner
    const sharerPermission = await this.permissionsRepository.findOne({
      where: {
        documentId,
        userId: sharerUserId,
        permissionLevel:
          permissionLevel === PermissionLevel.OWNER
            ? PermissionLevel.OWNER
            : In([PermissionLevel.OWNER, PermissionLevel.EDITOR]),
      },
    });

    // Si no hay permisos explícitos, verificar si es el propietario del documento
    if (!sharerPermission && document.userId !== sharerUserId) {
      throw new ForbiddenException(
        'No tiene permiso para compartir este documento',
      );
    }

    // Encontrar o crear el usuario destinatario
    let targetUser: User;
    try {
      targetUser = await this.usersService.findByEmail(email);

      if (!targetUser) {
        // Si estamos en modo desarrollo, podemos crear usuarios automáticamente
        // En producción probablemente querrías enviar una invitación por email
        if (this.configService.get('NODE_ENV') === 'development') {
          // Generar contraseña temporal
          const tempPassword = crypto.randomBytes(8).toString('hex');

          // Crear usuario con contraseña temporal
          targetUser = await this.usersService.create({
            email,
            name: email.split('@')[0],
            password: tempPassword,
          });

          this.logger.log(
            `Usuario creado automáticamente: ${email} con contraseña: ${tempPassword}`,
          );
        } else {
          // En producción, enviar invitación por email
          throw new BadRequestException(
            `El usuario con email ${email} no existe. Se debe enviar una invitación primero.`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error al buscar/crear usuario para compartir: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `No se pudo compartir con el usuario: ${error.message}`,
      );
    }

    // Verificar si ya existe un permiso para este usuario y documento
    const existingPermission = await this.permissionsRepository.findOne({
      where: { documentId, userId: targetUser.id },
    });

    // Si existe, actualizar el permiso
    if (existingPermission) {
      // No permitir degradar a un owner
      if (
        existingPermission.permissionLevel === PermissionLevel.OWNER &&
        permissionLevel !== PermissionLevel.OWNER &&
        document.userId !== sharerUserId
      ) {
        throw new ForbiddenException(
          'No puede degradar los permisos del propietario del documento',
        );
      }

      // Actualizar el permiso existente
      existingPermission.permissionLevel = permissionLevel;
      existingPermission.isActive = true;

      if (expiresAt) {
        existingPermission.expiresAt = new Date(expiresAt);
      } else {
        existingPermission.expiresAt = null;
      }

      const updatedPermission =
        await this.permissionsRepository.save(existingPermission);

      // Registrar en log de auditoría
      await this.auditLogService.log(
        AuditAction.DOCUMENT_SHARE,
        sharerUserId,
        documentId,
        {
          targetUserId: targetUser.id,
          targetEmail: email,
          permissionLevel,
          action: 'update',
        },
        ipAddress,
        userAgent,
      );

      // Notificar al usuario si se solicitó
      if (notifyUser) {
        // Aquí iría la lógica para enviar una notificación por email
        this.logger.log(
          `Notificación enviada a ${email} por actualización de permisos`,
        );
      }

      return updatedPermission;
    }

    // Crear un nuevo permiso
    const newPermission = this.permissionsRepository.create({
      documentId,
      userId: targetUser.id,
      permissionLevel,
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: sharerUserId,
      metadata: {
        sharedVia: 'email',
        message: shareDocumentDto.message,
      },
    });

    const savedPermission =
      await this.permissionsRepository.save(newPermission);

    // Registrar en log de auditoría
    await this.auditLogService.log(
      AuditAction.DOCUMENT_SHARE,
      sharerUserId,
      documentId,
      {
        targetUserId: targetUser.id,
        targetEmail: email,
        permissionLevel,
        action: 'create',
      },
      ipAddress,
      userAgent,
    );

    // Notificar al usuario si se solicitó
    if (notifyUser) {
      // Aquí iría la lógica para enviar una notificación por email
      this.logger.log(`Notificación enviada a ${email} por nuevo permiso`);
    }

    return savedPermission;
  }

  /**
   * Crea un enlace de compartición para un documento
   */
  async createShareLink(
    userId: string,
    createShareLinkDto: CreateShareLinkDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ShareLink> {
    const {
      documentId,
      permissionLevel,
      expiresAt,
      requiresPassword = false,
      password,
      maxUses,
    } = createShareLinkDto;

    // Verificar si el documento existe
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(
        `Documento con ID ${documentId} no encontrado`,
      );
    }

    // Verificar si el usuario tiene permiso para compartir
    const hasPermission = await this.canUserShareDocument(userId, documentId);

    if (!hasPermission) {
      throw new ForbiddenException(
        'No tiene permiso para compartir este documento',
      );
    }

    // Generar token único para el enlace
    const token = this.generateUniqueToken();

    // Si requiere contraseña, hashearla
    let passwordHash = null;
    if (requiresPassword && password) {
      passwordHash = await this.hashPassword(password);
    }

    // Crear el enlace de compartición
    const shareLink = this.shareLinksRepository.create({
      token,
      documentId,
      createdBy: userId,
      permissionLevel,
      expiresAt: new Date(expiresAt),
      requiresPassword,
      passwordHash,
      maxUses,
      isActive: true,
      metadata: {
        createdFrom: ipAddress,
        userAgent,
      },
    });

    const savedLink = await this.shareLinksRepository.save(shareLink);

    // Registrar en log de auditoría
    await this.auditLogService.log(
      AuditAction.SHARE_LINK_CREATE,
      userId,
      documentId,
      {
        shareLink: savedLink.id,
        permissionLevel,
        expiresAt,
        requiresPassword,
      },
      ipAddress,
      userAgent,
    );

    // Retornar el enlace pero sin el hash de la contraseña
    const { passwordHash: _, ...linkWithoutPasswordHash } = savedLink;
    return linkWithoutPasswordHash as ShareLink;
  }

  /**
   * Accede a un documento mediante un enlace de compartición
   */
  async accessShareLink(
    accessShareLinkDto: AccessShareLinkDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ document: Document; permissionLevel: PermissionLevel }> {
    const { token, password } = accessShareLinkDto;

    // Buscar el enlace
    const shareLink = await this.shareLinksRepository.findOne({
      where: { token },
      relations: ['document'],
    });

    if (!shareLink || !shareLink.isActive) {
      throw new NotFoundException(
        'Enlace de compartición no válido o inactivo',
      );
    }

    // Verificar si el enlace ha expirado
    if (new Date() > shareLink.expiresAt) {
      // Desactivar el enlace
      shareLink.isActive = false;
      await this.shareLinksRepository.save(shareLink);

      throw new BadRequestException('El enlace de compartición ha expirado');
    }

    // Verificar si se ha alcanzado el número máximo de usos
    if (shareLink.maxUses && shareLink.accessCount >= shareLink.maxUses) {
      // Desactivar el enlace
      shareLink.isActive = false;
      await this.shareLinksRepository.save(shareLink);

      throw new BadRequestException(
        'El enlace ha alcanzado su número máximo de usos',
      );
    }

    // Verificar la contraseña si es necesario
    if (shareLink.requiresPassword) {
      if (!password) {
        throw new UnauthorizedException('Este enlace requiere contraseña');
      }

      const passwordMatches = await this.verifyPassword(
        password,
        shareLink.passwordHash,
      );
      if (!passwordMatches) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }
    }

    // Si el usuario está autenticado, crear o actualizar su permiso
    if (userId) {
      const existingPermission = await this.permissionsRepository.findOne({
        where: { documentId: shareLink.documentId, userId },
      });

      if (existingPermission) {
        // Solo actualizar si el nuevo nivel es mayor
        const permissionLevels = Object.values(PermissionLevel);
        const currentIndex = permissionLevels.indexOf(
          existingPermission.permissionLevel,
        );
        const newIndex = permissionLevels.indexOf(shareLink.permissionLevel);

        if (newIndex > currentIndex) {
          existingPermission.permissionLevel = shareLink.permissionLevel;
          existingPermission.isActive = true;
          await this.permissionsRepository.save(existingPermission);
        }
      } else {
        // Crear nuevo permiso
        const newPermission = this.permissionsRepository.create({
          documentId: shareLink.documentId,
          userId,
          permissionLevel: shareLink.permissionLevel,
          isActive: true,
          createdBy: shareLink.createdBy,
          metadata: {
            sharedVia: 'link',
            shareLinkId: shareLink.id,
          },
        });
        await this.permissionsRepository.save(newPermission);
      }
    }

    // Incrementar contador de accesos
    shareLink.accessCount += 1;
    await this.shareLinksRepository.save(shareLink);

    // Registrar en log de auditoría
    await this.auditLogService.log(
      AuditAction.SHARE_LINK_ACCESS,
      userId || 'anonymous',
      shareLink.documentId,
      {
        shareLink: shareLink.id,
        accessCount: shareLink.accessCount,
      },
      ipAddress,
      userAgent,
    );

    return {
      document: shareLink.document,
      permissionLevel: shareLink.permissionLevel,
    };
  }

  /**
   * Obtiene todos los permisos de un documento
   */
  async getDocumentPermissions(
    documentId: string,
    requestUserId: string,
  ): Promise<DocumentPermission[]> {
    // Verificar si el documento existe
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(
        `Documento con ID ${documentId} no encontrado`,
      );
    }

    // Verificar si el usuario tiene permiso para ver los permisos
    const canAccess = await this.canUserAccessDocumentPermissions(
      requestUserId,
      documentId,
    );

    if (!canAccess) {
      throw new ForbiddenException(
        'No tiene permiso para ver los permisos de este documento',
      );
    }

    // Obtener todos los permisos del documento
    return this.permissionsRepository.find({
      where: { documentId },
      relations: ['user'],
      order: {
        permissionLevel: 'DESC',
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Actualiza el permiso de un usuario sobre un documento
   */
  async updatePermission(
    permissionId: string,
    updatePermissionDto: UpdatePermissionDto,
    requestUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DocumentPermission> {
    // Buscar el permiso
    const permission = await this.permissionsRepository.findOne({
      where: { id: permissionId },
      relations: ['document', 'user'],
    });

    if (!permission) {
      throw new NotFoundException(
        `Permiso con ID ${permissionId} no encontrado`,
      );
    }

    // Verificar si el usuario tiene permiso para actualizar permisos
    const canManage = await this.canUserManageDocumentPermissions(
      requestUserId,
      permission.documentId,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'No tiene permiso para actualizar los permisos de este documento',
      );
    }

    // No permitir degradar a un owner si no eres el dueño del documento
    if (
      permission.permissionLevel === PermissionLevel.OWNER &&
      updatePermissionDto.permissionLevel !== PermissionLevel.OWNER &&
      permission.document.userId !== requestUserId
    ) {
      throw new ForbiddenException(
        'No puede degradar los permisos del propietario del documento',
      );
    }

    // Actualizar el permiso
    Object.assign(permission, updatePermissionDto);
    const updatedPermission = await this.permissionsRepository.save(permission);

    // Registrar en log de auditoría
    await this.auditLogService.log(
      AuditAction.PERMISSION_UPDATE,
      requestUserId,
      permission.documentId,
      {
        permissionId,
        targetUserId: permission.userId,
        targetUserEmail: permission.user?.email,
        changes: updatePermissionDto,
      },
      ipAddress,
      userAgent,
    );

    return updatedPermission;
  }

  /**
   * Revoca el permiso de un usuario sobre un documento
   */
  async revokePermission(
    permissionId: string,
    requestUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Buscar el permiso
    const permission = await this.permissionsRepository.findOne({
      where: { id: permissionId },
      relations: ['document', 'user'],
    });

    if (!permission) {
      throw new NotFoundException(
        `Permiso con ID ${permissionId} no encontrado`,
      );
    }

    // No se puede revocar el permiso al propietario del documento
    if (
      permission.permissionLevel === PermissionLevel.OWNER &&
      permission.userId === permission.document.userId
    ) {
      throw new ForbiddenException(
        'No se puede revocar el permiso al propietario del documento',
      );
    }

    // Verificar si el usuario tiene permiso para revocar permisos
    const canManage = await this.canUserManageDocumentPermissions(
      requestUserId,
      permission.documentId,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'No tiene permiso para revocar los permisos de este documento',
      );
    }

    // Registrar en log de auditoría antes de eliminar
    await this.auditLogService.log(
      AuditAction.PERMISSION_REVOKE,
      requestUserId,
      permission.documentId,
      {
        permissionId,
        targetUserId: permission.userId,
        targetUserEmail: permission.user?.email,
        permissionLevel: permission.permissionLevel,
      },
      ipAddress,
      userAgent,
    );

    // Eliminar el permiso
    await this.permissionsRepository.remove(permission);
  }

  /**
   * Obtiene los documentos compartidos con un usuario
   */
  async getSharedWithMeDocuments(userId: string): Promise<Document[]> {
    // Buscar todos los permisos activos del usuario
    const permissions = await this.permissionsRepository.find({
      where: {
        userId,
        isActive: true,
      },
      relations: ['document'],
    });

    // Filtrar documentos válidos y activos
    return permissions
      .filter((p) => p.document && p.document.id)
      .map((p) => p.document);
  }

  /**
   * Desactiva un enlace de compartición
   */
  async deactivateShareLink(
    linkId: string,
    requestUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Buscar el enlace
    const shareLink = await this.shareLinksRepository.findOne({
      where: { id: linkId },
    });

    if (!shareLink) {
      throw new NotFoundException(
        `Enlace de compartición con ID ${linkId} no encontrado`,
      );
    }

    // Verificar si el usuario tiene permiso para desactivar el enlace
    const canAccess = await this.canUserManageDocumentPermissions(
      requestUserId,
      shareLink.documentId,
    );

    if (!canAccess && shareLink.createdBy !== requestUserId) {
      throw new ForbiddenException(
        'No tiene permiso para desactivar este enlace de compartición',
      );
    }

    // Desactivar el enlace
    shareLink.isActive = false;
    await this.shareLinksRepository.save(shareLink);

    // Registrar en log de auditoría
    await this.auditLogService.log(
      AuditAction.SHARE_LINK_DEACTIVATE,
      requestUserId,
      shareLink.documentId,
      {
        shareLink: shareLink.id,
        token: shareLink.token,
      },
      ipAddress,
      userAgent,
    );
  }

  /**
   * Obtiene todos los enlaces de compartición de un documento
   */
  async getDocumentShareLinks(
    documentId: string,
    requestUserId: string,
  ): Promise<ShareLink[]> {
    // Verificar si el documento existe
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(
        `Documento con ID ${documentId} no encontrado`,
      );
    }

    // Verificar si el usuario tiene permiso para ver los enlaces
    const canAccess = await this.canUserManageDocumentPermissions(
      requestUserId,
      documentId,
    );

    if (!canAccess) {
      throw new ForbiddenException(
        'No tiene permiso para ver los enlaces de compartición de este documento',
      );
    }

    // Obtener todos los enlaces de compartición del documento
    const shareLinks = await this.shareLinksRepository.find({
      where: { documentId },
      order: {
        createdAt: 'DESC',
      },
    });

    // Eliminar los hashes de contraseña por seguridad
    return shareLinks.map((link) => {
      const { passwordHash, ...linkWithoutPasswordHash } = link;
      return linkWithoutPasswordHash as ShareLink;
    });
  }

  /**
   * Verifica si un usuario puede acceder a un documento
   */
  async canUserAccessDocument(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    // Verificar usuario propietario
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) return false;
    if (document.userId === userId) return true;

    // Verificar permiso explícito
    const permission = await this.permissionsRepository.findOne({
      where: {
        documentId,
        userId,
        isActive: true,
      },
    });

    // Verificar expiración
    if (
      permission &&
      permission.expiresAt &&
      new Date() > permission.expiresAt
    ) {
      permission.isActive = false;
      await this.permissionsRepository.save(permission);

      // Registrar en auditoría
      await this.auditLogService.log(
        AuditAction.PERMISSION_UPDATE,
        userId,
        documentId,
        {
          action: 'permission_expired',
          permissionId: permission.id,
        },
      );

      return false;
    }

    return !!permission;
  }

  /**
   * Verifica si un usuario puede modificar un documento
   */
  async canUserModifyDocument(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    // Verificar si el usuario es el propietario del documento
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      return false;
    }

    if (document.userId === userId) {
      return true;
    }

    // Verificar si el usuario tiene permiso de editor o propietario
    const permission = await this.permissionsRepository.findOne({
      where: {
        documentId,
        userId,
        isActive: true,
        permissionLevel: In([PermissionLevel.EDITOR, PermissionLevel.OWNER]),
      },
    });

    // Verificar si el permiso ha expirado
    if (
      permission &&
      permission.expiresAt &&
      new Date() > permission.expiresAt
    ) {
      // Desactivar el permiso expirado
      permission.isActive = false;
      await this.permissionsRepository.save(permission);
      return false;
    }

    return !!permission;
  }

  /**
   * Verifica si un usuario puede comentar en un documento
   */
  async canUserCommentDocument(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    // Verificar si el usuario es el propietario del documento
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      return false;
    }

    if (document.userId === userId) {
      return true;
    }

    // Verificar si el usuario tiene permiso de comentarista, editor o propietario
    const permission = await this.permissionsRepository.findOne({
      where: {
        documentId,
        userId,
        isActive: true,
        permissionLevel: In([
          PermissionLevel.COMMENTER,
          PermissionLevel.EDITOR,
          PermissionLevel.OWNER,
        ]),
      },
    });

    // Verificar si el permiso ha expirado
    if (
      permission &&
      permission.expiresAt &&
      new Date() > permission.expiresAt
    ) {
      // Desactivar el permiso expirado
      permission.isActive = false;
      await this.permissionsRepository.save(permission);
      return false;
    }

    return !!permission;
  }

  /**
   * Verifica si un usuario puede compartir un documento
   */
  async canUserShareDocument(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    // Verificar si el usuario es el propietario del documento
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      return false;
    }

    if (document.userId === userId) {
      return true;
    }

    // Verificar si el usuario tiene permiso de propietario
    const permission = await this.permissionsRepository.findOne({
      where: {
        documentId,
        userId,
        isActive: true,
        permissionLevel: PermissionLevel.OWNER,
      },
    });

    // Verificar si el permiso ha expirado
    if (
      permission &&
      permission.expiresAt &&
      new Date() > permission.expiresAt
    ) {
      // Desactivar el permiso expirado
      permission.isActive = false;
      await this.permissionsRepository.save(permission);
      return false;
    }

    return !!permission;
  }

  /**
   * Verifica si un usuario puede ver los permisos de un documento
   */
  async canUserAccessDocumentPermissions(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    return this.canUserShareDocument(userId, documentId);
  }

  /**
   * Verifica si un usuario puede administrar los permisos de un documento
   */
  async canUserManageDocumentPermissions(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    return this.canUserShareDocument(userId, documentId);
  }

  /**
   * Genera un token único para compartir enlaces
   */
  private generateUniqueToken(): string {
    // Generar un token con formato 'xxxx-xxxx-xxxx-xxxx'
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(crypto.randomBytes(2).toString('hex'));
    }
    return segments.join('-');
  }

  /**
   * Hashea una contraseña para enlaces compartidos
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(8).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
      .toString('hex');

    return `${salt}:${hash}`;
  }

  /**
   * Verifica si una contraseña coincide con el hash almacenado
   */
  private async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    const calculatedHash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
      .toString('hex');

    return hash === calculatedHash;
  }

  /**
   * Crear permiso de propietario para el creador del documento
   */
  async createOwnerPermission(
    documentId: string,
    userId: string,
  ): Promise<void> {
    // Verificar si ya existe un permiso de propietario
    const existingPermission = await this.permissionsRepository.findOne({
      where: {
        documentId,
        userId,
        permissionLevel: PermissionLevel.OWNER,
      },
    });

    if (!existingPermission) {
      // Crear permiso de propietario
      const ownerPermission = this.permissionsRepository.create({
        documentId,
        userId,
        permissionLevel: PermissionLevel.OWNER,
        isActive: true,
        createdBy: userId,
      });

      await this.permissionsRepository.save(ownerPermission);
    }
  }

  /**
   * Obtiene una lista de usuarios con quienes el usuario ha compartido documentos
   */
  async getSharedWithUsers(userId: string): Promise<any[]> {
    // Obtener documentos del usuario
    const userDocuments = await this.documentsRepository.find({
      where: { userId },
      select: ['id'],
    });

    const documentIds = userDocuments.map((doc) => doc.id);

    if (documentIds.length === 0) {
      return [];
    }

    // Obtener permisos para esos documentos
    const permissions = await this.permissionsRepository.find({
      where: {
        documentId: In(documentIds),
        userId: Not(userId), // Excluir al propio usuario
        isActive: true,
      },
      relations: ['user', 'document'],
      order: {
        updatedAt: 'DESC',
      },
    });

    // Agrupar por usuario
    const userMap = new Map();

    for (const permission of permissions) {
      if (!permission.user) continue;

      const userId = permission.user.id;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId: userId,
          email: permission.user.email,
          name: permission.user.name,
          sharedDocuments: [],
        });
      }

      userMap.get(userId).sharedDocuments.push({
        documentId: permission.documentId,
        title: permission.document?.title || 'Documento sin título',
        permissionLevel: permission.permissionLevel,
        sharedAt: permission.createdAt,
      });
    }

    return Array.from(userMap.values());
  }

  /**
   * Busca un enlace de compartición por su token
   */
  async findShareLinkByToken(token: string): Promise<ShareLink> {
    const shareLink = await this.shareLinksRepository.findOne({
      where: { token, isActive: true },
      relations: ['document'],
    });

    if (!shareLink) {
      throw new NotFoundException(
        'Enlace de compartición no encontrado o inactivo',
      );
    }

    // Verificar si el enlace ha expirado
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      // Desactivar el enlace
      shareLink.isActive = false;
      await this.shareLinksRepository.save(shareLink);

      throw new BadRequestException('El enlace de compartición ha expirado');
    }

    // Verificar si se ha alcanzado el número máximo de usos
    if (shareLink.maxUses && shareLink.accessCount >= shareLink.maxUses) {
      // Desactivar el enlace
      shareLink.isActive = false;
      await this.shareLinksRepository.save(shareLink);

      throw new BadRequestException(
        'El enlace ha alcanzado su número máximo de usos',
      );
    }

    // Eliminar el hash de la contraseña por seguridad
    const { passwordHash, ...linkWithoutPasswordHash } = shareLink;
    return linkWithoutPasswordHash as ShareLink;
  }

  /**
   * Obtiene los permisos de un usuario para un documento
   */
  async getUserPermissionForDocument(
    userId: string,
    documentId: string,
  ): Promise<DocumentPermission | null> {
    // Verificar si el usuario es el propietario del documento
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      return null;
    }

    // Si es el propietario, crear un permiso virtual
    if (document.userId === userId) {
      const virtualPermission = new DocumentPermission();
      virtualPermission.documentId = documentId;
      virtualPermission.userId = userId;
      virtualPermission.permissionLevel = PermissionLevel.OWNER;
      virtualPermission.isActive = true;
      return virtualPermission;
    }

    // Buscar permiso explícito
    const permission = await this.permissionsRepository.findOne({
      where: {
        documentId,
        userId,
        isActive: true,
      },
    });

    // Verificar si el permiso ha expirado
    if (
      permission &&
      permission.expiresAt &&
      new Date() > permission.expiresAt
    ) {
      // Desactivar el permiso expirado
      permission.isActive = false;
      await this.permissionsRepository.save(permission);
      return null;
    }

    return permission;
  }

  /**
   * Obtiene todos los usuarios con permiso a un documento
   */
  async getDocumentUsers(
    documentId: string,
    requestUserId: string,
  ): Promise<any[]> {
    // Verificar si el documento existe
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
      relations: ['user'],
    });

    if (!document) {
      throw new NotFoundException(
        `Documento con ID ${documentId} no encontrado`,
      );
    }

    // Verificar si el usuario tiene permiso para ver los colaboradores
    const canAccess = await this.canUserAccessDocumentPermissions(
      requestUserId,
      documentId,
    );

    if (!canAccess) {
      throw new ForbiddenException(
        'No tiene permiso para ver los colaboradores de este documento',
      );
    }

    // Obtener todos los permisos del documento
    const permissions = await this.permissionsRepository.find({
      where: { documentId, isActive: true },
      relations: ['user'],
      order: {
        permissionLevel: 'ASC',
        createdAt: 'DESC',
      },
    });

    // Incluir al propietario del documento si no está ya en la lista
    const users = permissions.map((permission) => ({
      id: permission.userId,
      name: permission.user?.name || 'Usuario desconocido',
      email: permission.user?.email || 'correo@desconocido.com',
      permissionLevel: permission.permissionLevel,
      isOwner: permission.userId === document.userId,
      sharedAt: permission.createdAt,
      expiresAt: permission.expiresAt,
    }));

    // Verificar si el propietario ya está en la lista
    const ownerIncluded = users.some((user) => user.id === document.userId);

    // Si no está, agregarlo al principio
    if (!ownerIncluded && document.user) {
      users.unshift({
        id: document.userId,
        name: document.user.name,
        email: document.user.email,
        permissionLevel: PermissionLevel.OWNER,
        isOwner: true,
        sharedAt: document.createdAt,
        expiresAt: null,
      });
    }

    return users;
  }
}
