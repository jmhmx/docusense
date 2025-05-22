import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { SharingService } from '../sharing/sharing.service';
import * as fs from 'fs';
import * as path from 'path';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import { Signature } from '../signatures/entities/signature.entity';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
    private readonly sharingService: SharingService,
    private readonly blockchainService: BlockchainService,
  ) {
    // Verificar servicios
    console.log('CryptoService disponible:', !!this.cryptoService);
    console.log('AuditLogService disponible:', !!this.auditLogService);
    console.log('SharingService disponible:', !!this.sharingService);
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
        const { encryptedData, key, iv, authTag } =
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
            keyBase64: key.toString('base64'),
            ivBase64: iv.toString('base64'),
            authTagBase64: authTag.toString('base64'), // Añade esto
            encryptedAt: new Date().toISOString(),
          },
          originalFilePath: createDocumentDto.filePath,
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
      let filePath = document.filePath;

      // Si el documento está cifrado, usar la ruta encriptada
      if (document.metadata?.isEncrypted) {
        const { encryptionDetails } = document.metadata;

        // Para lectura/visualización, usar ruta cifrada
        if (encryptionDetails.encryptedFilePath) {
          filePath = encryptionDetails.encryptedFilePath;
        }

        // Verificar que el archivo existe
        if (!fs.existsSync(filePath)) {
          throw new Error(`Archivo no encontrado: ${filePath}`);
        }

        // Leer el archivo cifrado
        const fileData = fs.readFileSync(filePath);

        // Descifrar
        const key = Buffer.from(encryptionDetails.keyBase64, 'base64');
        const iv = Buffer.from(encryptionDetails.ivBase64, 'base64');
        const authTag = encryptionDetails.authTagBase64
          ? Buffer.from(encryptionDetails.authTagBase64, 'base64')
          : undefined;

        return this.cryptoService.decryptDocument(fileData, key, iv, authTag);
      }

      // Si no está cifrado, devolver el contenido tal cual
      return fs.readFileSync(filePath);
    } catch (error) {
      throw new Error(`Error al obtener contenido: ${error.message}`);
    }
  }

  private async renderAutografaWithSeal(
    page: PDFPage,
    base64Image: string,
    x: number,
    y: number,
    width: number,
    height: number,
    signature: Signature,
  ): Promise<void> {
    try {
      const pdfDoc = page.doc;

      // Validar coordenadas y ajustar si están fuera del documento
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();

      // Si la firma está fuera de los límites, posicionarla en la esquina inferior derecha
      if (x < 0 || y < 0 || x + width > pageWidth || y + height > pageHeight) {
        this.logger.warn(
          `Firma fuera de límites, reposicionando a esquina inferior derecha`,
        );
        x = pageWidth - width - 20; // 20px de margen
        y = 20; // 20px desde abajo (sistema PDF)

        // Asegurar que no sea negativo
        x = Math.max(20, x);
        y = Math.max(20, y);
      }

      // 1. Renderizar directamente la imagen de la firma autógrafa SIN fondo
      await this.renderAutografaImageOnly(
        page,
        base64Image,
        x,
        y,
        width,
        height,
      );

      // 2. Añadir información textual ENCIMA de la imagen
      const font = await pdfDoc.embedFont('Helvetica-Bold');
      const fontRegular = await pdfDoc.embedFont('Helvetica');

      // Área de texto en la parte superior de la firma
      const textY = y + height - 15;

      // Nombre del firmante (más pequeño y transparente)
      page.drawText(signature.user?.name || 'Usuario', {
        x: x + 5,
        y: textY,
        size: 8,
        color: rgb(0.2, 0.2, 0.2),
        font: font,
        opacity: 0.7,
      });

      // Fecha de firma
      page.drawText(new Date(signature.signedAt).toLocaleDateString(), {
        x: x + 5,
        y: textY - 10,
        size: 7,
        color: rgb(0.3, 0.3, 0.3),
        font: fontRegular,
        opacity: 0.7,
      });

      this.logger.log(
        `Firma autógrafa renderizada en (${x}, ${y}) con tamaño ${width}x${height}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al renderizar firma autógrafa: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async renderAutografaImageOnly(
    page: PDFPage,
    base64Image: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void> {
    try {
      // Limpiar y validar datos base64
      let imageData: string;
      if (base64Image.startsWith('data:image/')) {
        const parts = base64Image.split(',');
        if (parts.length !== 2) {
          throw new Error('Formato base64 inválido');
        }
        imageData = parts[1];
      } else {
        imageData = base64Image;
      }

      // Convertir a Buffer
      const imageBytes = Buffer.from(imageData, 'base64');

      if (imageBytes.length === 0) {
        throw new Error('Datos de imagen vacíos');
      }

      this.logger.log(`Procesando imagen de ${imageBytes.length} bytes`);

      // Detectar tipo de imagen por magic bytes
      const pdfDoc = page.doc;
      let embeddedImage;

      // PNG: 89 50 4E 47
      if (
        imageBytes[0] === 0x89 &&
        imageBytes[1] === 0x50 &&
        imageBytes[2] === 0x4e &&
        imageBytes[3] === 0x47
      ) {
        this.logger.log('Detectado formato PNG');
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      }
      // JPEG: FF D8
      else if (imageBytes[0] === 0xff && imageBytes[1] === 0xd8) {
        this.logger.log('Detectado formato JPEG');
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      }
      // Si comienza con "<svg" (SVG como texto)
      else if (imageData.startsWith('PHN2Zw==') || imageData.includes('svg')) {
        throw new Error('SVG no soportado directamente. Convierte a PNG/JPEG.');
      } else {
        // Intentar PNG por defecto
        this.logger.log('Tipo desconocido, intentando PNG');
        try {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } catch {
          this.logger.log('PNG falló, intentando JPEG');
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        }
      }

      // Obtener dimensiones originales y mantener aspect ratio
      const imgDims = embeddedImage.scale(1);
      const aspectRatio = imgDims.width / imgDims.height;

      let finalWidth = width;
      let finalHeight = height;

      // Ajustar manteniendo proporción
      if (width / height > aspectRatio) {
        finalWidth = height * aspectRatio;
      } else {
        finalHeight = width / aspectRatio;
      }

      // Centrar en el área asignada
      const offsetX = (width - finalWidth) / 2;
      const offsetY = (height - finalHeight) / 2;

      // Dibujar imagen
      page.drawImage(embeddedImage, {
        x: x + offsetX,
        y: y + offsetY,
        width: finalWidth,
        height: finalHeight,
        opacity: 1.0, // Opacidad completa
      });

      this.logger.log(
        `Imagen renderizada en (${x + offsetX}, ${y + offsetY}) con tamaño ${finalWidth}x${finalHeight}`,
      );
    } catch (error) {
      this.logger.error(
        `Error crítico al renderizar imagen: ${error.message}`,
        error.stack,
      );

      // Como fallback, dibujar un rectángulo con texto
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0.5, 0.5, 0.5),
        borderWidth: 1,
      });

      page.drawText('Firma autógrafa', {
        x: x + 10,
        y: y + height / 2,
        size: 10,
        color: rgb(0, 0, 0),
      });
    }
  }

  // Actualizar el método generateSignedPdf para usar el nuevo renderizado
  async generateSignedPdf(
    document: Document,
    signatures: Signature[],
  ): Promise<Buffer> {
    const fileData = await this.getDocumentContent(document, document.userId);
    const pdfDoc = await PDFDocument.load(fileData);

    this.logger.log(`=== GENERANDO PDF FIRMADO ===`);
    this.logger.log(`Documento: ${document.title}`);
    this.logger.log(`Páginas PDF: ${pdfDoc.getPageCount()}`);
    this.logger.log(`Firmas a procesar: ${signatures.length}`);

    for (const signature of signatures) {
      try {
        let position;
        try {
          position =
            typeof signature.position === 'string'
              ? JSON.parse(signature.position)
              : signature.position;
        } catch (e) {
          this.logger.error(`Error al parsear posición de firma: ${e.message}`);
          continue;
        }

        this.logger.log(`=== PROCESANDO FIRMA ${signature.id} ===`);
        this.logger.log(
          `Tipo: ${signature.metadata?.signatureType || 'standard'}`,
        );
        this.logger.log(`Posición raw:`, position);

        if (
          !position ||
          !position.page ||
          position.x === undefined ||
          position.y === undefined ||
          position.width === undefined ||
          position.height === undefined
        ) {
          this.logger.warn(
            `Firma ${signature.id} sin información de posición válida`,
          );
          continue;
        }

        const pageIndex = position.page - 1;
        if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) {
          this.logger.warn(
            `Página ${position.page} no válida para firma ${signature.id}`,
          );
          continue;
        }

        const page = pdfDoc.getPages()[pageIndex];
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        let x = position.x;
        let y = position.y;
        let width = position.width;
        let height = position.height;

        this.logger.log(`Dimensiones página PDF: ${pageWidth} x ${pageHeight}`);
        this.logger.log(
          `Coordenadas recibidas: x=${x}, y=${y}, w=${width}, h=${height}`,
        );

        // Validar y ajustar coordenadas si están fuera de límites
        if (
          x < 0 ||
          y < 0 ||
          x + width > pageWidth ||
          y + height > pageHeight
        ) {
          this.logger.warn(`COORDENADAS FUERA DE LÍMITES - Reposicionando`);
          this.logger.warn(`Original: x=${x}, y=${y}, w=${width}, h=${height}`);
          this.logger.warn(`Límites página: w=${pageWidth}, h=${pageHeight}`);

          // Reposicionar en esquina inferior derecha
          x = Math.max(20, pageWidth - width - 20);
          y = Math.max(20, 20); // 20pts desde abajo

          this.logger.log(
            `Nueva posición: x=${x}, y=${y}, w=${width}, h=${height}`,
          );
        }

        if (signature.metadata?.signatureType === 'autografa') {
          if (signature.signatureData && signature.signatureData.length > 10) {
            this.logger.log(`Renderizando FIRMA AUTÓGRAFA:`);
            this.logger.log(
              `- Datos imagen: ${signature.signatureData.length} caracteres`,
            );
            this.logger.log(
              `- Posición final: (${x}, ${y}) ${width}x${height}`,
            );

            await this.renderAutografaWithSeal(
              page,
              signature.signatureData,
              x,
              y,
              width,
              height,
              signature,
            );

            this.logger.log(`✓ Firma autógrafa renderizada`);
          } else {
            this.logger.error(
              `Firma autógrafa ${signature.id} sin datos válidos`,
            );
          }
        } else {
          this.logger.log(`Renderizando FIRMA ESTÁNDAR en (${x}, ${y})`);

          // Firmas regulares
          page.drawRectangle({
            x,
            y,
            width,
            height,
            color: rgb(0.95, 0.95, 1),
            borderColor: rgb(0.2, 0.4, 0.8),
            borderWidth: 1.5,
            opacity: 0.9,
          });

          const font = await pdfDoc.embedFont('Helvetica-Bold');
          page.drawText(`Firmado por: ${signature.user?.name || 'Usuario'}`, {
            x: x + 10,
            y: y + height - 20,
            size: 11,
            color: rgb(0, 0, 0.7),
            font,
          });

          page.drawText(
            `Fecha: ${new Date(signature.signedAt).toLocaleDateString()}`,
            {
              x: x + 10,
              y: y + height - 35,
              size: 10,
              color: rgb(0.1, 0.1, 0.7),
            },
          );

          if (signature.reason) {
            page.drawText(`Motivo: ${signature.reason}`, {
              x: x + 10,
              y: y + height - 50,
              size: 10,
              color: rgb(0.1, 0.1, 0.7),
            });
          }

          this.logger.log(`✓ Firma estándar renderizada`);
        }
      } catch (error) {
        this.logger.error(
          `❌ Error procesando firma ${signature.id}:`,
          error.message,
        );
      }
    }

    this.logger.log(`=== PDF GENERADO EXITOSAMENTE ===`);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
