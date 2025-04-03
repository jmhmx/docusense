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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { DocumentProcessorService } from './processors/document-processor.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { createReadStream } from 'fs';

const UPLOAD_DIR = 'uploads';

// Asegurar que el directorio de carga existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, callback) => {
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    callback(null, `${uniqueSuffix}${extension}`);
  },
});

@Controller('api/documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentProcessorService: DocumentProcessorService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage }))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createDocumentDto: CreateDocumentDto,
    @Request() req,
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

    return this.documentsService.create(document, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req) {
    return this.documentsService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.documentsService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/view')
  async viewDocument(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findOne(id, req.user.id);

    // Verificar que el archivo existe
    if (!fs.existsSync(document.filePath)) {
      throw new BadRequestException('El archivo no se encuentra disponible');
    }

    // Para imágenes y PDFs, servir directamente el archivo
    if (
      document.mimeType.includes('image') ||
      document.mimeType.includes('pdf')
    ) {
      const file = createReadStream(document.filePath);
      res.set({
        'Content-Type': document.mimeType,
        'Content-Disposition': `inline; filename="${document.filename}"`,
      });
      file.pipe(res);
    } else {
      // Para otros tipos de archivos, redirigir a la descarga
      res.redirect(`/api/documents/${id}/download`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  async downloadDocument(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const document = await this.documentsService.findOne(id, req.user.id);

    // Verificar que el archivo existe
    if (!fs.existsSync(document.filePath)) {
      throw new BadRequestException('El archivo no se encuentra disponible');
    }

    const file = createReadStream(document.filePath);
    res.set({
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${document.filename}"`,
    });

    return new StreamableFile(file);
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
}
