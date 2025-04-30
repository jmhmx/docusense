import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { DocumentStatus } from './entities/document.entity';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ShareDocumentDto } from '../sharing/dto/share.dto';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un nuevo documento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename: string =
            path.parse(file.originalname).name.replace(/\s/g, '') + uuidv4();
          const extension: string = path.parse(file.originalname).ext;

          cb(null, `${filename}${extension}`);
        },
      }),
    }),
  )
  @ApiResponse({
    status: 201,
    description: 'Documento creado exitosamente',
    type: CreateDocumentDto,
  })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createDocumentDto: CreateDocumentDto,
    @Req() req: Request,
  ) {
    const document = await this.documentsService.create(
      {
        ...createDocumentDto,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
      req.user.id,
    );
    return document;
  }

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los documentos del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Lista de documentos',
    type: [CreateDocumentDto],
  })
  async findAll(@Req() req: Request, @Query('search') searchQuery?: string) {
    return await this.documentsService.findAll(req.user.id, searchQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un documento por ID' })
  @ApiResponse({
    status: 200,
    description: 'Documento encontrado',
    type: CreateDocumentDto,
  })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.documentsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un documento' })
  @ApiResponse({
    status: 200,
    description: 'Documento actualizado',
    type: UpdateDocumentDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Req() req: Request,
  ) {
    return await this.documentsService.update(
      id,
      updateDocumentDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un documento' })
  @ApiResponse({ status: 204, description: 'Documento eliminado' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    await this.documentsService.remove(id, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualiza el estado de un documento' })
  @ApiResponse({
    status: 200,
    description: 'Estado del documento actualizado',
    type: CreateDocumentDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @Req() req: Request,
  ) {
    const status =
      updateStatusDto.status === 'COMPLETED'
        ? DocumentStatus.COMPLETED
        : DocumentStatus.PENDING;
    return await this.documentsService.updateStatus(id, status);
  }

  @Get('/completed/documents')
  @ApiOperation({ summary: 'Obtiene todos los documentos completados' })
  @ApiResponse({
    status: 200,
    description: 'Documentos completados',
    type: [CreateDocumentDto],
  })
  async getCompletedDocuments(@Req() req: Request) {
    return await this.documentsService.findCompletedDocuments();
  }
}