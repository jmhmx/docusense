// backend/src/documents/document-signature.controller.ts
import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SignaturesService } from '../signatures/signatures.service';
import { DocumentsService } from './documents.service';

@Controller('api/documents')
export class DocumentSignatureController {
  constructor(
    private readonly signaturesService: SignaturesService,
    private readonly documentsService: DocumentsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id/signature-status')
  async getDocumentSignatureStatus(@Param('id') id: string, @Request() req) {
    try {
      // Primero verificar que el documento existe y el usuario tiene acceso
      await this.documentsService.findOne(id, req.user.id);

      // Luego obtener el estado de las firmas
      return await this.signaturesService.getDocumentSignatureStatus(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener estado de firmas: ${error.message}`,
      );
    }
  }
}
