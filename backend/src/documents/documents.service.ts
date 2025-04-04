import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
  ) {
    // Verificar servicios
    console.log('CryptoService disponible:', !!this.cryptoService);
    console.log('AuditLogService disponible:', !!this.auditLogService);
  }

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

    return savedDocument;
  }

  async findAll(userId?: string, searchQuery?: string): Promise<Document[]> {
    let whereCondition: any = {};

    if (userId) {
      whereCondition.userId = userId;
    }

    // Añadir búsqueda si hay una consulta
    if (searchQuery && searchQuery.trim().length > 0) {
      whereCondition = [
        { ...whereCondition, title: ILike(`%${searchQuery}%`) },
        { ...whereCondition, filename: ILike(`%${searchQuery}%`) },
        { ...whereCondition, description: ILike(`%${searchQuery}%`) },
      ];
    }

    return this.documentsRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    id: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Document> {
    const queryOptions: any = { where: { id } };

    if (userId) {
      queryOptions.where.userId = userId;
    }

    const document = await this.documentsRepository.findOne(queryOptions);

    if (!document) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado`);
    }

    // Si se proporciona userId, registrar acceso en log de auditoría
    if (userId && this.auditLogService) {
      try {
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
      } catch (error) {
        console.error('Error al registrar acción en log de auditoría:', error);
      }
    }

    return document;
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
