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
  UpdatePermissionDto,
} from './dto/share.dto';

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
    @Inject(forwardRef(() => DocumentsService))
    private readonly documentsService: DocumentsService,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async findOne(id: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async findOnePermission(documentId: string, userId: string): Promise<DocumentPermission> {
    const sharerPermission = await this.documentPermissionRepository.findOne({
      where: {
        documentId,
        userId,
      },
      relations: ['document', 'user'],
    });

    if (!sharerPermission) {
      throw new NotFoundException('Permiso no encontrado');
    }
    return sharerPermission;
  }

  async findOneDocumentPermission(documentId: string, userId: string): Promise<DocumentPermission> {
    const existingPermission = await this.documentPermissionRepository.findOne({
      where: { documentId, userId },
    });
    if (!existingPermission) {
      throw new NotFoundException('Permission not found');
    }
    return existingPermission;
  }

  async update(id: string, updatePermissionDto: UpdatePermissionDto, userId: string, documentId: string): Promise<DocumentPermission> {
    const existingPermission = await this.findOneDocumentPermission(documentId, userId);
    const permission = {
      ...existingPermission,
      ...updatePermissionDto,
    };
    await this.documentPermissionRepository.save(permission);

    return permission;
  }

  async createPermission(documentId: string, userId: string, permissionLevel: PermissionLevel): Promise<DocumentPermission> {
    const existingPermission = await this.findOneDocumentPermission(documentId, userId);

    if (existingPermission) {
      throw new ForbiddenException(
        `Ya tienes permisos para este documento`,
      );
    }

    const newPermission = this.documentPermissionRepository.create({
      documentId: documentId as unknown as string,
      userId: userId as unknown as string,
      level: permissionLevel as unknown as PermissionLevel,
    });

    await this.documentPermissionRepository.save(newPermission);

    return newPermission;
  }

  async findOneShareLink(shareLinkId: string): Promise<ShareLink> {
    const shareLink = await this.shareLinkRepository.findOne({
      where: { id: shareLinkId },
      relations: ['document'],
    });

    if (!shareLink) {
      throw new NotFoundException('Share link not found');
    }
    return shareLink;
  }

  async createShareLink(
    documentId: string,
    userId: string,
    dto: CreateShareLinkDto,
  ): Promise<ShareLink> {
    const shareLink = this.shareLinkRepository.create({
      ...dto,
      id: uuidv4() as unknown as string,
      documentId: documentId as unknown as string,
      userId: userId as unknown as string,
    });

    const savedLink = await this.shareLinkRepository.save(shareLink);

    return savedLink;
  }

  async findOneShareLinkByCode(code: string): Promise<ShareLink> {
    const shareLink = await this.shareLinkRepository.findOne({ where: { code: code } });

    if (!shareLink) {
      throw new NotFoundException('Invalid share code');
    }

    return shareLink;
  }
  async accessLink(accessShareLinkDto: AccessShareLinkDto): Promise<ShareLink> {
    let shareLink = await this.findOneShareLinkByCode(accessShareLinkDto);
    shareLink.lastAccessAt = new Date();
    shareLink.accessCount = shareLink.accessCount + 1;
    await this.shareLinkRepository.save(shareLink);
    return shareLink;
  }

  async disableLink(shareLinkId: string): Promise<ShareLink> {
    let shareLink = await this.findOneShareLink(shareLinkId);
    shareLink.disabled = true;
    await this.shareLinkRepository.save(shareLink);
    return shareLink;
  }

  async enableLink(shareLinkId: string): Promise<ShareLink> {
    let shareLink = await this.findOneShareLink(shareLinkId);
    shareLink.disabled = false;
    await this.shareLinkRepository.save(shareLink);

    return shareLink;
  }

  async createPermissionByShareLink(shareLinkId: string, userId: string): Promise<DocumentPermission> {
    const shareLink = await this.findOneShareLink(shareLinkId);

    const document = shareLink.document;

    const existingPermission = await this.documentPermissionRepository.findOne({
      where: { documentId: document.id, userId },
    });
    if (existingPermission) {
      throw new ForbiddenException(
        `Ya tienes permisos para este documento`,
      );
    }

    const ownerPermission = this.documentPermissionRepository.create({
      documentId: document.id as unknown as string,
      userId: userId as unknown as string,
      level: PermissionLevel.READ as unknown as PermissionLevel,
    });

    await this.documentPermissionRepository.save(ownerPermission);

    return ownerPermission;
  }
  async findAllByDocument(documentId: string): Promise<DocumentPermission[]> {
    const permissions = await this.documentPermissionRepository.find({
      where: { documentId },
      relations: ['user'],
    });

    return permissions;
  }
  async createShareDocument(documentId: string, shareDocumentDto: ShareDocumentDto): Promise<void> {
    const document = await this.findOne(documentId);
    const shareLink = await this.findOneShareLinkByCode(shareDocumentDto);

    const existingPermission = await this.documentPermissionRepository.findOne({
      where: {
        documentId: document.id,
        userId: shareLink.userId,
      }
    });
    if (existingPermission) {
      throw new ForbiddenException(`The user has already permission for this document`);
    }
    const newPermission = this.documentPermissionRepository.create({
      documentId: document.id as unknown as string,
      userId: userId as unknown as string,
      level: PermissionLevel.READ as unknown as PermissionLevel,
    });

    await this.documentPermissionRepository.save(newPermission);

  }

  async deleteShareLink(shareLinkId: string): Promise<void> {
    let shareLink = await this.findOneShareLink(shareLinkId);
    await this.shareLinkRepository.save(shareLink);
  }

  async findOneByCode(code: string): Promise<ShareLink> {
    const shareLink = await this.shareLinkRepository.findOne({ where: { code: code } });

    if (!shareLink) {
      throw new NotFoundException('Invalid share code');
    }

    return shareLink;
  }

  async findAllShareLinksByDocument(documentId: string): Promise<ShareLink[]> {
    const shareLinks = await this.shareLinkRepository.find({
      where: { documentId },
      relations: ['user'],
    });

    return shareLinks;
  }
  async findOneByShareLink(shareLinkId: string): Promise<Document> {
    const shareLink = await this.findOneShareLink(shareLinkId);
    return shareLink.document;
  }

  async getOnePermission(documentId: string, userId: string): Promise<DocumentPermission> {
    const permission = await this.documentPermissionRepository.findOne({
      where: { documentId, userId },
      relations: ['document', 'user'],
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async updatePermission(documentId: string, userId: string, level: PermissionLevel): Promise<DocumentPermission> {
    const permission = await this.documentPermissionRepository.findOne({
      where: { documentId, userId },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    permission.level = level as unknown as PermissionLevel;
    await this.documentPermissionRepository.save(permission);

    return permission;
  }
  async findOneByUserIdAndDocumentId(documentId: string, userId: string): Promise<DocumentPermission> {
    const document = await this.findOne(documentId);
    const permission = await this.documentPermissionRepository.findOne({
      where: {
        documentId: document.id,
        userId
      }
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async deletePermission(documentId: string, userId: string): Promise<void> {
    const permission = await this.getOnePermission(documentId, userId);
    await this.documentPermissionRepository.remove(permission);
  }
  async findAllPermissionsByDocument(documentId: string): Promise<DocumentPermission[]> {
    const permissions = await this.documentPermissionRepository.find({
      where: { documentId },
      relations: ['document', 'user'],
    });

    return permissions;
  }

  async deletePermissionByDocumentId(documentId: string, userId: string): Promise<void> {
    const permission = await this.findOneByUserIdAndDocumentId(documentId, userId);
    await this.documentPermissionRepository.remove(permission);
  }

  async findOneShareLinkByDocumentId(documentId: string): Promise<ShareLink> {
    const shareLink = await this.shareLinkRepository.findOne({
      where: { documentId },
      relations: ['document', 'user'],
    });

    if (!shareLink) {
      throw new NotFoundException('Invalid share code');
    }

    return shareLink;
  }

  async updateShareLink(id: string, dto: CreateShareLinkDto): Promise<ShareLink> {
    const shareLink = await this.findOneShareLink(id);
    shareLink.name = dto.name as unknown as string;
    shareLink.accessCount = dto.accessCount as unknown as number;
    await this.shareLinkRepository.save(shareLink);
    return shareLink
  }

  async findOneByShareLinkId(shareLinkId: string): Promise<Document> {
    const shareLink = await this.findOneShareLink(shareLinkId);
    return shareLink.document;
  }

  async getPermissionByDocumentIdAndUserId(documentId: string, userId: string): Promise<DocumentPermission> {
    const permission = await this.documentPermissionRepository.findOne({
      where: { documentId, userId },
      relations: ['user'],
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }
}