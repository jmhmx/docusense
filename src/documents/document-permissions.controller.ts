import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  Query,
  Put,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit/audit-log.service';

import { DocumentsService } from './documents.service';
import {
  CreateDocumentDto,
  EncryptDocumentDto,
  UpdateDocumentDto,
  UpdateDocumentStatusDto,
} from './dto/create-document.dto';

import { Document, DocumentStatus } from './entities/document.entity';
import { CryptoService } from '../crypto/crypto.service';
import { CreatePermissionDto } from '../sharing/dto/share.dto';
import { SharingService } from '../sharing/sharing.service';
import { UsersService } from '../users/users.service';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
    private readonly sharingService: SharingService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async create(
    @Body() createDocumentDto: CreateDocumentDto,
    @Req() req: Request,
  ): Promise<Document> {
    const shouldEncrypt =
      createDocumentDto.shouldEncrypt ??
      this.configService.get<boolean>('ENCRYPT_DOCUMENTS');

    const document = await this.documentsService.create(
      createDocumentDto,
      req.user.id,
    );

    if (shouldEncrypt) {
      const encryptedDocument = await this.cryptoService.encryptDocument(
        document,
        req.user.id,
      );

      return encryptedDocument;
    }
    return document;
  }

  @Post('encrypt')
  async encrypt(
    @Body() encryptDocumentDto: EncryptDocumentDto,
    @Req() req: Request,
  ): Promise<Document> {
    const document = await this.documentsService.findOne(
      encryptDocumentDto.id,
    );
    const encryptedDocument = await this.cryptoService.encryptDocument(
      document,
      req.user.id,
    );
    return encryptedDocument;
  }

  @Post('decrypt/:id')
  async decryptDocument(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ): Promise<Document> {
    const shouldDecrypt = body.shouldDecrypt;

    const document = await this.documentsService.findOne(id);
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const decryptedDocument = await this.cryptoService.decryptDocument(
      document,
      req.user.id
    );
    return decryptedDocument;
  }

  @Get()
  async findAll(
    @Req() req: Request,
    @Query('search') search: string,
  ): Promise<Document[]> {
    return await this.documentsService.findAll(req.user.id, search);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Document> {
    return this.documentsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Req() req: Request,
  ): Promise<Document> {
    return this.documentsService.update(id, updateDocumentDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    return await this.documentsService.remove(id, req.user.id);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDocumentStatusDto: UpdateDocumentStatusDto,
    @Req() req: Request,
  ): Promise<Document> {
    return await this.documentsService.updateStatus(
      id,
      updateDocumentStatusDto.status,
    );
  }

  @Post(':id/share')
  async createPermission(
    @Param('id') id: string,
    @Body() createPermissionDto: CreatePermissionDto,
    @Req() req: Request,
  ): Promise<Document> {
    const { userId, level } = createPermissionDto;
    return await this.documentsService.shareDocument(
      id,
      userId,
      level,
      req.user.id,
    );
  }

  @Get(':id/share')
  async findPermissions(@Param('id') id: string, @Req() req: Request) {
    return await this.sharingService.findAllPermissionsByDocument(id);
  }

  @Get('completed/documents')
  async findCompletedDocuments(@Req() req: Request): Promise<Document[]> {
    return await this.documentsService.findCompletedDocuments();
  }
}