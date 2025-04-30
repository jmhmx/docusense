import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { SharingService } from '../sharing/sharing.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class DocumentsService {
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

  async create(
    createDocumentDto: CreateDocumentDto,
    userId: string,
    encryptContent: boolean = false,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Document> {
    // Verificar que el archivo existe
    if (!fs.existsSync(createDocumentDto.filePath)) {
      throw new Error(`Archivo no encontrado: ${createDocumentDto.filePath}`);
    }

    let filePath = createDocumentDto.filePath;
    let metadata = createDocumentDto.metadata || {};

    // Si se solicita cifrado, cifrar el documento
    if (encryptContent && this.cryptoService) {
      console.log('Cifrando documento...');
      const fileData = fs.readFileSync(filePath);

      try {
        const { encryptedData, key, iv } =
          this.cryptoService.encryptDocument(fileData);

        // Guardar el archivo cifrado
        const encryptedFilePath = `${filePath}.encrypted`;
        fs.writeFileSync(encryptedFilePath, encryptedData);

        // Actualizar la ruta y metadatos
        filePath = encryptedFilePath;
        metadata = {
          ...metadata,
          isEncrypted: true,
          encryptionDetails: {
            // En un entorno real, estas claves deberían almacenarse de forma segura
            // o cifradas con la clave pública del usuario
            keyBase64: key.toString('base64'),
            ivBase64: iv.toString('base64'),
          },
        };

        console.log('Documento cifrado correctamente');
      } catch (error) {
        console.error('Error al cifrar documento:', error);
        throw new Error(`Error al cifrar documento: ${error.message}`);
      }
    } else if (encryptContent) {
      console.error('CryptoService no disponible');
      throw new Error('Servicio de cifrado no disponible');
    }

    // Crear documento
    const document = this.documentsRepository.create({
      ...createDocumentDto,
      filePath,
      metadata,
      userId,
    });

    const savedDocument = await this.documentsRepository.save(document);

    // Registrar acción en log de auditoría
    if (this.auditLogService) {
      try {
        await this.auditLogService.log(
          AuditAction.DOCUMENT_UPLOAD,
          userId,
          savedDocument.id,
          {
            title: savedDocument.title,
            filename: savedDocument.filename,
            encrypted: encryptContent,
          },
          ipAddress,
          userAgent,
        );
      } catch (error) {
        console.error('Error al registrar acción en log de auditoría:', error);
      }
    }

    try {
      const documentHash = this.cryptoService.generateHash(document.filePath);
      await this.blockchainService.registerDocument(
        document.id,
        documentHash,
        {
          title: document.title,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
        },
        userId,
      );
    } catch (blockchainError) {
      this.logger.error(
        `Failed to register document on blockchain: ${blockchainError.message}`,
        blockchainError.stack,
      );
      // Continue anyway, blockchain registration is not critical
    }

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
    let whereCondition: any = {};
    let sharedDocuments: Document[] = [];

    if (userId) {
      whereCondition.userId = userId;

      // Si el servicio de compartición está disponible, obtener también documentos compartidos
      if (this.sharingService) {
        try {
          sharedDocuments =
            await this.sharingService.getSharedWithMeDocuments(userId);
        } catch (error) {
          console.error('Error al obtener documentos compartidos:', error);
          // No fallamos la búsqueda si esto falla
        }
      }
    }

    // Añadir búsqueda si hay una consulta
    if (searchQuery && searchQuery.trim().length > 0) {
      whereCondition = [
        { ...whereCondition, title: ILike(`%${searchQuery}%`) },
        { ...whereCondition, filename: ILike(`%${searchQuery}%`) },
        { ...whereCondition, description: ILike(`%${searchQuery}%`) },
      ];
    }

    // Obtener documentos del usuario
    const userDocuments = await this.documentsRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });

    // Si no hay documentos compartidos, retornar solo los documentos del usuario
    if (sharedDocuments.length === 0) {
      return userDocuments;
    }

    // Combinar documentos propios y compartidos
    // Eliminar duplicados (podría ocurrir si un documento fue compartido por el propietario)
    const allDocuments = [...userDocuments];

    // Añadir documentos compartidos que no estén ya incluidos
    for (const sharedDoc of sharedDocuments) {
      if (!allDocuments.find((doc) => doc.id === sharedDoc.id)) {
        allDocuments.push(sharedDoc);
      }
    }

    // Ordenar por fecha de creación
    return allDocuments.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async findOne(
    id: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    console.log('Buscando documento con ID:', id);
    console.log('ID de usuario:', userId);

    try {
      // Usar findOneBy en lugar de findOne con opciones
      const document = await this.documentsRepository.findOneBy({ id });

      console.log('Documento encontrado:', document);

      if (!document) {
        console.error('Documento no encontrado');
        throw new NotFoundException(`Documento con ID ${id} no encontrado`);
      }

      // Verificar permisos si se proporciona userId
      if (userId && this.sharingService) {
        const hasAccess = await this.sharingService.canUserAccessDocument(
          userId,
          id,
        );
        console.log('¿Usuario tiene acceso?:', hasAccess);

        if (!hasAccess && document.userId !== userId) {
          console.error('Acceso denegado');
          throw new NotFoundException(`Documento con ID ${id} no encontrado`);
        }
      }

      // Registrar la visualización si hay información de IP y userAgent
      if (userId && ipAddress && userAgent && this.auditLogService) {
        await this.auditLogService.log(
          AuditAction.DOCUMENT_VIEW,
          userId,
          document.id,
          {
            title: document.title,
            filename: document.filename,
          },
          ipAddress,
          userAgent,
        );
      }

      return document;
    } catch (error) {
      console.error('Error al buscar documento:', error);
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

  async updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    const document = await this.findOne(id);
    document.status = status;
    return this.documentsRepository.save(document);
  }

  async remove(id: string, userId?: string): Promise<void> {
    const document = await this.findOne(id, userId);

    // Si hay servicio de compartición y userId, verificar permisos de eliminación
    // Solo el propietario puede eliminar el documento
    if (this.sharingService && userId && document.userId !== userId) {
      // Verificar si es propietario a nivel de permisos (podría ser diferente del creador)
      const permission = await this.sharingService.getUserPermissionForDocument(
        userId,
        id,
      );
      if (!permission || permission.permissionLevel !== 'owner') {
        throw new NotFoundException(
          `Documento con ID ${id} no encontrado o no tienes permisos para eliminarlo`,
        );
      }
    }

    // Eliminar archivo físico si existe
    if (document.filePath) {
      try {
        const filePath = path.resolve(document.filePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Error al eliminar archivo: ${error.message}`);
      }
    }

    await this.documentsRepository.remove(document);
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
