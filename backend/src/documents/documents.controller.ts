import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  StreamableFile,
  Query,
  Header,
  Headers,
  Ip,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { DocumentProcessorService } from './processors/document-processor.service';
import {
  DocumentAnalyzerService,
  AnalysisResult,
} from 'src/analyzers/document-analyzer.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { SignaturesService } from '../signatures/signatures.service';

const UPLOAD_DIR = 'uploads';
// Asegurar que el directorio de carga existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Asegurar que el directorio de carga existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = diskStorage({
  destination: (req, file, callback) => {
    const uploadPath = path.resolve(process.cwd(), 'uploads');
    fs.mkdirSync(uploadPath, { recursive: true });
    callback(null, uploadPath);
  },
  filename: (req, file, callback) => {
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    callback(null, `${uniqueSuffix}${extension}`);
  },
});

@Controller('api/documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentProcessorService: DocumentProcessorService,
    private readonly documentAnalyzerService: DocumentAnalyzerService,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
    private readonly signaturesService: SignaturesService,
  ) {
    // Verificar que el servicio se está inyectando correctamente
    console.log(
      'DocumentsService:',
      typeof this.documentsService,
      this.documentsService,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage }))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createDocumentDto: CreateDocumentDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
    @Query('encrypt') encrypt?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se ha subido ningún archivo');
    }

    const document = {
      ...createDocumentDto,
      filename: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
    };

    // Determinar si se debe cifrar el documento
    const shouldEncrypt = encrypt === 'true' || encrypt === '1';
    const userAgent = headers['user-agent'] || 'Unknown';
    console.log('Upload directory:', process.cwd());
    console.log('File uploaded:', file);
    return this.documentsService.create(
      document,
      req.user.id,
      shouldEncrypt,
      ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req, @Query() query) {
    // Soporte para búsqueda por texto
    const searchQuery = query.search;
    return this.documentsService.findAll(req.user.id, searchQuery);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    return this.documentsService.findOne(id, req.user.id, ip, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/view')
  async viewDocument(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findOne(id, req.user.id);

    // Obtener firmas del documento
    const signatures = await this.signaturesService.getDocumentSignatures(id);

    // Si hay firmas Y es un PDF, generar y servir PDF con firmas integradas
    if (
      signatures &&
      signatures.length > 0 &&
      document.mimeType?.includes('pdf')
    ) {
      try {
        const pdfWithSignatures = await this.documentsService.generateSignedPdf(
          document,
          signatures,
        );

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${document.filename}"`,
          'Cache-Control': 'private, no-cache', // Evitar cache para siempre mostrar versión actualizada
        });

        return res.send(pdfWithSignatures);
      } catch (error) {
        this.logger.error(`Error generando PDF con firmas: ${error.message}`);
        // Si falla, continúa para mostrar el PDF original
      }
    }

    // Mostrar documento original (sin firmas o no es PDF)
    if (document.metadata?.isEncrypted) {
      try {
        const fileData = await this.documentsService.getDocumentContent(
          document,
          req.user.id,
        );

        const file = new Readable();
        file._read = () => {};
        file.push(fileData);
        file.push(null);

        res.set({
          'Content-Type': document.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${document.filename}"`,
        });

        file.pipe(res);
      } catch (error) {
        console.error('Error detallado:', error);
        throw new BadRequestException(
          `No se pudo descifrar el documento: ${error.message}`,
        );
      }
    } else {
      // Documentos no cifrados
      const file = createReadStream(document.filePath);
      res.set({
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${document.filename}"`,
      });
      file.pipe(res);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  async downloadDocument(
    @Param('id') id: string,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userAgent = headers['user-agent'] || 'Unknown';
    const document = await this.documentsService.findOne(
      id,
      req.user.id,
      ip,
      userAgent,
    );

    // Registrar la descarga en el log de auditoría
    await this.auditLogService.log(
      AuditAction.DOCUMENT_DOWNLOAD,
      req.user.id,
      document.id,
      {
        title: document.title,
        filename: document.filename,
      },
      ip,
      userAgent,
    );

    // Verificar si el documento está cifrado y obtener el contenido
    let fileData: Buffer;
    if (document.metadata?.isEncrypted) {
      fileData = await this.documentsService.getDocumentContent(
        document,
        req.user.id,
      );
    } else {
      // Verificar que el archivo existe
      if (!fs.existsSync(document.filePath)) {
        throw new BadRequestException('El archivo no se encuentra disponible');
      }
      fileData = fs.readFileSync(document.filePath);
    }

    res.set({
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${document.filename}"`,
    });

    // Crear un stream a partir del buffer
    const readableStream = new Readable();
    readableStream.push(fileData);
    readableStream.push(null);

    return new StreamableFile(readableStream);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Request() req,
  ) {
    return this.documentsService.update(id, updateDocumentDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.documentsService.remove(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/process')
  async processDocument(@Param('id') id: string, @Request() req) {
    const document = await this.documentsService.findOne(id, req.user.id);
    await this.documentProcessorService.processDocument(document);
    return { message: 'Documento enviado a procesamiento' };
  }

  // NUEVOS ENDPOINTS PARA ANÁLISIS

  @UseGuards(JwtAuthGuard)
  @Get(':id/analyze')
  async analyzeDocument(
    @Param('id') id: string,
    @Request() req,
  ): Promise<AnalysisResult> {
    const document = await this.documentsService.findOne(id, req.user.id);

    // Verificar que el documento ya ha sido procesado
    if (document.status !== 'completed') {
      throw new BadRequestException(
        'El documento debe estar procesado para poder analizarlo',
      );
    }

    // Realizar análisis
    const analysisResult =
      await this.documentAnalyzerService.analyzeDocument(document);

    // Guardar resultado del análisis en el documento
    document.metadata = {
      ...document.metadata,
      analysis: analysisResult,
      analyzedAt: new Date().toISOString(),
    };

    await this.documentsService.update(id, document, req.user.id);

    return analysisResult;
  }

  @UseGuards(JwtAuthGuard)
  @Get('search/content')
  async searchByContent(@Query('q') query: string, @Request() req) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('La consulta de búsqueda es requerida');
    }

    return this.documentsService.searchByContent(query, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/encrypt')
  async encryptDocument(
    @Param('id') id: string,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      const userAgent = headers['user-agent'] || 'Unknown';

      // Obtener documento
      const document = await this.documentsService.findOne(
        id,
        req.user.id,
        ip,
        userAgent,
      );

      // Verificar que no esté ya cifrado
      if (document.metadata?.isEncrypted) {
        throw new BadRequestException('El documento ya está cifrado');
      }

      // Leer archivo original
      const fileData = await this.documentsService.getDocumentContent(
        document,
        req.user.id,
      );

      // Cifrar el documento
      const { encryptedData, key, iv, authTag } =
        this.cryptoService.encryptDocument(fileData);

      // Guardar versión cifrada
      const encryptedFilePath = `${document.filePath}.encrypted`;
      fs.writeFileSync(encryptedFilePath, encryptedData);

      // Actualizar metadata del documento
      const updatedDoc = await this.documentsService.update(
        id,
        {
          filePath: encryptedFilePath,
          metadata: {
            ...document.metadata,
            isEncrypted: true,
            encryptionDetails: {
              keyBase64: key.toString('base64'),
              ivBase64: iv.toString('base64'),
              authTagBase64: authTag.toString('base64'), // Añade el authTag aquí
              encryptedAt: new Date().toISOString(),
            },
            originalFilePath: document.filePath,
          },
        },
        req.user.id,
      );

      // Registrar acción en log de auditoría
      await this.auditLogService.log(
        AuditAction.DOCUMENT_ENCRYPT,
        req.user.id,
        document.id,
        {
          title: document.title,
          filename: document.filename,
        },
        ip,
        userAgent,
      );

      return {
        message: 'Documento cifrado correctamente',
        documentId: updatedDoc.id,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al cifrar documento: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/blockchain/verify')
  async verifyDocumentOnBlockchain(@Param('id') id: string, @Request() req) {
    return this.documentsService.verifyDocumentOnBlockchain(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/blockchain/certificate')
  async getBlockchainCertificate(@Param('id') id: string, @Request() req) {
    return this.documentsService.getBlockchainCertificate(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/metadata')
  async getDocumentMetadata(@Param('id') id: string, @Request() req) {
    const document = await this.documentsService.findOne(id, req.user.id);
    return {
      pageCount: document.metadata?.pageCount || 1,
      // otros metadatos relevantes
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download-signed')
  async downloadSignedDocument(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const document = await this.documentsService.findOne(id, req.user.id);

    // Obtener firmas del documento
    const signatures = await this.signaturesService.getDocumentSignatures(id);

    // Generar PDF con firmas integradas
    const pdfWithSignatures = await this.documentsService.generateSignedPdf(
      document,
      signatures,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="signed_${document.filename}"`,
    });

    return new StreamableFile(pdfWithSignatures);
  }
}
