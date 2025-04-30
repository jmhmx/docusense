import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

import { Document, DocumentStatus } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { SharingService } from '../sharing/sharing.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => SharingService))
    private readonly sharingService: SharingService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService
  ) {}

  async create(createDocumentDto: CreateDocumentDto, userId: string): Promise<Document> {
    const document = this.documentRepository.create({
      ...createDocumentDto,
      userId,
    });
    const savedDocument = await this.documentRepository.save(document);
    return savedDocument;
  }

  async findAll(userId?: string, searchQuery?: string): Promise<Document[]> {
    let whereCondition = {};
    if (userId) {
      whereCondition = { userId };
    }

    if (searchQuery) {
      const documents = await this.documentRepository.find({
        where: [
          { ...whereCondition, title: ILike(`%${searchQuery}%`) },
          { ...whereCondition, filename: ILike(`%${searchQuery}%`) },
          { ...whereCondition, description: ILike(`%${searchQuery}%`) },
        ],
        order: { createdAt: 'DESC' },
      });

      return documents;
    } else {
      const userDocuments = await this.documentRepository.find({
        where: whereCondition,
        order: { createdAt: 'DESC' },
      });
      return userDocuments;
    }
  }

  async findOne(id: string, userId?: string): Promise<Document> {
    try {
      const document = await this.documentRepository.findOneBy({ id });
      if (!document) {
        throw new NotFoundException('Documento no encontrado');
      }
      return document;
    } catch (error) {
      this.logger.error('Error al buscar el documento', error.stack);
      throw error;
    }
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    const document = await this.findOne(id);
    document.status = status;
    return this.documentRepository.save(document);
  }
  async remove(id: string, userId: string): Promise<void> {
    try {
      const document = await this.findOne(id);
      await this.documentRepository.remove(document);
    } catch (error) {
      this.logger.error('Error al eliminar el documento', error.stack);
      throw error;
    }
  }

    async findCompletedDocuments(): Promise<Document[]> {
    try {
      const queryBuilder = this.documentRepository
        .createQueryBuilder('document')
        .where('document.status = :status', { status: DocumentStatus.COMPLETED });

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error('Error al buscar los documentos completados', error.stack);
      throw error;
    }
  }
}