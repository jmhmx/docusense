import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from '../entities/document.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as langDetect from 'langdetect';
import { exec as execCallback } from 'child_process';

// Promisify exec
const exec = util.promisify(execCallback);

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {}

  /**
   * Procesa documentos pendientes cada minuto
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingDocuments() {
    this.logger.log('Buscando documentos pendientes para procesar...');

    try {
      // Buscar documentos pendientes
      const pendingDocuments = await this.documentsRepository.find({
        where: { status: DocumentStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: 5, // Procesar en lotes para no sobrecargar el sistema
      });

      if (pendingDocuments.length === 0) {
        this.logger.debug('No hay documentos pendientes para procesar');
        return;
      }

      this.logger.log(
        `Procesando ${pendingDocuments.length} documento(s) pendiente(s)`,
      );

      // Procesar cada documento
      for (const document of pendingDocuments) {
        await this.processDocument(document);
      }
    } catch (error) {
      this.logger.error(
        `Error procesando documentos pendientes: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Procesa un documento específico
   */
  async processDocument(document: Document) {
    this.logger.log(`Procesando documento: ${document.id} - ${document.title}`);

    try {
      // Actualizar estado a "Procesando"
      document.status = DocumentStatus.PROCESSING;
      await this.documentsRepository.save(document);

      // Determinar qué ruta usar para procesamiento
      let filePath = document.filePath;
      if (
        document.metadata?.isEncrypted &&
        document.metadata.encryptionDetails?.originalFilePath
      ) {
        filePath = document.metadata.encryptionDetails.originalFilePath;
      }

      // Verificar que el archivo existe
      if (!fs.existsSync(document.filePath)) {
        throw new Error(`Archivo no encontrado: ${document.filePath}`);
      }

      // Extraer información según el tipo MIME
      let extractedContent: Record<string, any> = {};
      let metadata: Record<string, any> = {};

      if (document.mimeType) {
        if (document.mimeType.includes('pdf')) {
          // Procesar PDF
          extractedContent = await this.extractTextFromPdf(document.filePath);
        } else if (document.mimeType.includes('image')) {
          // Procesar imagen
          extractedContent = await this.extractTextFromImage(document.filePath);
        } else if (
          document.mimeType.includes('word') ||
          document.mimeType.includes('document')
        ) {
          // Procesar documento Word
          extractedContent = await this.extractTextFromWord(document.filePath);
        } else if (
          document.mimeType.includes('excel') ||
          document.mimeType.includes('sheet')
        ) {
          // Procesar Excel
          extractedContent = await this.extractTextFromExcel(document.filePath);
        } else {
          // Intentar extraer como texto plano
          extractedContent = await this.extractTextFromPlainText(
            document.filePath,
          );
        }
      } else {
        // Intentar extraer como texto plano si no hay tipo MIME
        extractedContent = await this.extractTextFromPlainText(
          document.filePath,
        );
      }

      // Obtener metadatos básicos del archivo
      const stats = fs.statSync(document.filePath);
      metadata = {
        fileSize: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        extension: path.extname(document.filePath),
      };

      // Actualizar documento con el contenido extraído y metadatos
      document.extractedContent = extractedContent;
      document.metadata = {
        ...document.metadata,
        ...metadata,
      };
      document.status = DocumentStatus.COMPLETED;

      await this.documentsRepository.save(document);
      this.logger.log(`Documento procesado exitosamente: ${document.id}`);
    } catch (error) {
      this.logger.error(
        `Error procesando documento ${document.id}: ${error.message}`,
        error.stack,
      );

      // Actualizar estado a "Error"
      document.status = DocumentStatus.ERROR;
      document.metadata = {
        ...document.metadata,
        error: error.message,
      };

      await this.documentsRepository.save(document);
    }
  }

  /**
   * Extrae texto de un archivo PDF
   */
  private async extractTextFromPdf(
    filePath: string,
  ): Promise<Record<string, any>> {
    try {
      // Utilizar la biblioteca pdf-parse
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);

      const data = await pdfParse(dataBuffer);

      // Detectar idioma del texto
      const detectedLang = langDetect.detect(data.text);

      // Análisis adicional para detectar tipo de documento
      const documentType = this.detectDocumentType(data.text);

      return {
        content: data.text,
        pageCount: data.numpages,
        metadata: {
          language: detectedLang,
          documentType: documentType,
        },
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error extrayendo texto de PDF: ${error.message}`);
      return {
        error: error.message,
        success: false,
      };
    }
  }

  private detectDocumentType(text: string): string {
    // Detectar patrones específicos para diferentes tipos de documentos
    if (
      text.includes('CONTRATO DE ARRENDAMIENTO') ||
      text.includes('LEASING AGREEMENT')
    ) {
      return 'contract';
    } else if (
      text.includes('FACTURA') ||
      text.includes('INVOICE') ||
      /Total[\s]*:[\s]*\$[\d,.]+/.test(text)
    ) {
      return 'invoice';
    } else if (
      text.includes('CURRICULUM VITAE') ||
      text.includes('RESUME') ||
      text.includes('EXPERIENCIA PROFESIONAL')
    ) {
      return 'cv';
    }

    return 'unknown';
  }

  /**
   * Extrae texto de una imagen usando OCR
   */
  private async extractTextFromImage(
    filePath: string,
  ): Promise<Record<string, any>> {
    try {
      // Nota: En un entorno real, usaríamos Tesseract OCR
      // Para este ejemplo, simulamos la extracción

      return {
        text: `Texto extraído simulado de imagen: ${path.basename(filePath)}`,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error extrayendo texto de imagen: ${error.message}`);
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Extrae texto de un documento Word
   */
  private async extractTextFromWord(
    filePath: string,
  ): Promise<Record<string, any>> {
    try {
      // Nota: En un entorno real, usaríamos mammoth.js o similar
      // Para este ejemplo, simulamos la extracción

      return {
        text: `Texto extraído simulado de Word: ${path.basename(filePath)}`,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Error extrayendo texto de documento Word: ${error.message}`,
      );
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Extrae datos de un archivo Excel
   */
  private async extractTextFromExcel(
    filePath: string,
  ): Promise<Record<string, any>> {
    try {
      // Nota: En un entorno real, usaríamos una librería como xlsx
      // Para este ejemplo, simulamos la extracción

      return {
        sheets: ['Hoja1', 'Hoja2'],
        data: {
          Hoja1: [
            ['Dato1', 'Dato2'],
            ['Valor1', 'Valor2'],
          ],
        },
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error extrayendo datos de Excel: ${error.message}`);
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Extrae texto de un archivo de texto plano
   */
  private async extractTextFromPlainText(
    filePath: string,
  ): Promise<Record<string, any>> {
    try {
      // Leer el archivo como texto plano
      const text = fs.readFileSync(filePath, 'utf8');

      return {
        text: text.substring(0, 5000), // Limitar a 5000 caracteres
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error extrayendo texto plano: ${error.message}`);
      return {
        error: error.message,
        success: false,
      };
    }
  }
}
