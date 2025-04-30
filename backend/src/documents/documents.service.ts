import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  private readonly logger = new Logger(DocumentsService.name); // Add logger

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => SharingService))
    private readonly sharingService: SharingService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {}

  async create(createDocumentDto: CreateDocumentDto, userId: string): Promise<Document> {
    const document = this.documentRepository.create({ // Correct name
      ...createDocumentDto,
      userId,
    });
    const savedDocument = await this.documentRepository.save(document); // Correct name
    return savedDocument;
  }

  async verifyDocumentOnBlockchain(id: string, userId: string): Promise<any> {
    const document = await this.findOne(id, userId);

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    try {
      const documentHash = this.cryptoService.generateHash(document.filePath);
      return await this.blockchainService.verifyDocument(id, documentHash);
    } catch (error) {
      this.logger.error(
        `Error verifying document ${id} on blockchain: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to verify document on blockchain: ${error.message}`,
      );
    }
  }

  async getBlockchainCertificate(id: string, userId: string): Promise<any> {
    const document = await this.findOne(id, userId);

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    try {
      return await this.blockchainService.getVerificationCertificate(id);
    } catch (error) {
      this.logger.error(
        `Error getting blockchain certificate for document ${id}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get blockchain certificate: ${error.message}`,
      );
    }
  }

  async updateDocumentOnBlockchain(
    id: string,
    userId: string,
    action: string,
    metadata?: any,
  ): Promise<boolean> {
    const document = await this.findOne(id, userId);

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    try {
      const documentHash = this.cryptoService.generateHash(document.filePath);
      return await this.blockchainService.updateDocumentRecord(
        id,
        documentHash,
        action,
        userId,
        metadata,
      );
    } catch (error) {
      this.logger.error(
        `Error updating document ${id} on blockchain: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to update document on blockchain: ${error.message}`,
      );
    }
  }

  async findAll(userId?: string, searchQuery?: string): Promise<Document[]> {
    let whereCondition = {};
    if (userId) {
      whereCondition = { userId };
    }

    if (searchQuery) {
      const documents = await this.documentRepository.find({ // Correct name
        where: [
          { ...whereCondition, title: ILike(`%${searchQuery}%`) }, // Correct import
          { ...whereCondition, filename: ILike(`%${searchQuery}%`) }, // Correct import
          { ...whereCondition, description: ILike(`%${searchQuery}%`) }, // Correct import
        ],
        order: { createdAt: 'DESC' },
      });

      return documents;
    } else {
      const userDocuments = await this.documentRepository.find({ // Correct name
        where: whereCondition,
        order: { createdAt: 'DESC' },
      });
      return userDocuments;
    }
  }

  async findOne(id: string, userId?: string): Promise<Document> {
    try {
      const document = await this.documentRepository.findOneBy({ id }); // Correct name
      if (!document) {
        throw new NotFoundException('Documento no encontrado');
      }
      return document;
    } catch (error) {
      this.logger.error('Error al buscar el documento', error.stack); // Add logger
      throw error;
    }
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    userId?: string,
  ): Promise<Document> {
    const document = await this.findOne(id, userId);
    Object.assign(document, updateDocumentDto);
    return this.documentsRepository.save(document);
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<Document> { //Correct import
    const document = await this.findOne(id);
    document.status = status;
    return this.documentRepository.save(document); // Correct name
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      const document = await this.findOne(id);
      await this.documentRepository.remove(document); // Correct name
    } catch (error) {
      this.logger.error('Error al eliminar el documento', error.stack); // Add logger
      throw error;
    }
  }

  async findCompletedDocuments(): Promise<Document[]> {
    try {
      const queryBuilder = this.documentRepository // Correct name
        .createQueryBuilder('document')
        .where('document.status = :status', { status: DocumentStatus.COMPLETED }); // Correct import

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error('Error al buscar los documentos completados', error.stack); // Add logger
      throw error;
    }
  }

  /**
   * Busca documentos por contenido extraído
   */
  async searchByContent(query: string, userId?: string): Promise<Document[]> {
    // Consulta SQL directa para buscar en el contenido JSON
    const queryBuilder = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.status = :status', { status: DocumentStatus.COMPLETED });

    // Restricción por usuario si se proporciona
    if (userId) {
      queryBuilder.andWhere('document.userId = :userId', { userId });
    }

    // Búsqueda en el contenido extraído (esto varía según la base de datos)
    // Esta implementación es para PostgreSQL con columnas JSONB
    queryBuilder.andWhere(
      "CAST(document.extractedContent ->> 'text' AS TEXT) ILIKE :query",
      { query: `%${query}%` },
    );

    return queryBuilder.orderBy('document.createdAt', 'DESC').getMany();
  }

  /**
   * Obtiene el contenido de un documento, descifrándolo si es necesario
   */
  async getDocumentContent(
    document: Document,
    userId: string,
  ): Promise<Buffer> {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(document.filePath)) {
        throw new Error(`Archivo no encontrado: ${document.filePath}`);
      }

      // Leer el archivo
      const fileData = fs.readFileSync(document.filePath);

      // Si el documento está cifrado, descifrarlo
      if (document.metadata?.isEncrypted && this.cryptoService) {
        const { encryptionDetails } = document.metadata;

        if (
          !encryptionDetails ||
          !encryptionDetails.keyBase64 ||
          !encryptionDetails.ivBase64
        ) {
          throw new Error('Faltan detalles de cifrado para el documento');
        }

        try {
          // Convertir de base64 a Buffer
          const key = Buffer.from(encryptionDetails.keyBase64, 'base64');
          const iv = Buffer.from(encryptionDetails.ivBase64, 'base64');

          // Descifrar el contenido
          return this.cryptoService.decryptDocument(fileData, key, iv);
        } catch (error) {
          console.error('Error al descifrar documento:', error);
          throw new Error(`Error al descifrar documento: ${error.message}`);
        }
      } else if (document.metadata?.isEncrypted) {
        throw new Error('Servicio de cifrado no disponible');
      }

      // Si no está cifrado, devolver el contenido tal cual
      return fileData;
    } catch (error) {
      throw new Error(
        `Error al obtener contenido del documento: ${error.message}`,
      );
    }
  }
}
