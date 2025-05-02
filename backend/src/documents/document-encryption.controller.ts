import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Headers,
  Ip,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import * as fs from 'fs';

@Controller('api/documents')
export class DocumentEncryptionController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
  ) {}

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

      // Comprobar si ya está cifrado
      if (document.metadata?.isEncrypted) {
        throw new BadRequestException('Documento ya cifrado');
      }

      // Leer archivo original
      const fileData = fs.readFileSync(document.filePath);

      // Cifrar el documento
      const { encryptedData, key, iv, authTag } =
        this.cryptoService.encryptDocument(fileData);

      // Guardar versión cifrada conservando la original
      const encryptedFilePath = `${document.filePath}.encrypted`;
      fs.writeFileSync(encryptedFilePath, encryptedData);

      // Actualizar metadata manteniendo ruta original
      const updatedDoc = await this.documentsService.update(
        id,
        {
          metadata: {
            ...document.metadata,
            isEncrypted: true,
            encryptionDetails: {
              keyBase64: key.toString('base64'),
              ivBase64: iv.toString('base64'),
              authTagBase64: authTag.toString('base64'),
              encryptedAt: new Date().toISOString(),
              // Almacenar ambas rutas
              encryptedFilePath: encryptedFilePath,
              originalFilePath: document.filePath,
            },
          },
        },
        req.user.id,
      );

      // Registro en auditoría
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
      throw new BadRequestException(`Error al cifrar: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/encryption-status')
  async getEncryptionStatus(@Param('id') id: string, @Request() req) {
    try {
      const document = await this.documentsService.findOne(id, req.user.id);

      return {
        isEncrypted: !!document.metadata?.isEncrypted,
        encryptedAt: document.metadata?.encryptionDetails?.encryptedAt || null,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error checking encryption status: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/can-encrypt')
  async canEncryptDocument(@Param('id') id: string, @Request() req) {
    try {
      const document = await this.documentsService.findOne(id, req.user.id);

      const isOwner = document.userId === req.user.id;
      const isAdmin = req.user.isAdmin === true;
      const isAlreadyEncrypted = !!document.metadata?.isEncrypted;

      return {
        canEncrypt: (isOwner || isAdmin) && !isAlreadyEncrypted,
        reason: isAlreadyEncrypted
          ? 'Document is already encrypted'
          : !isOwner && !isAdmin
            ? 'Only document owner or admin can encrypt documents'
            : null,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error checking encryption permissions: ${error.message}`,
      );
    }
  }
}
