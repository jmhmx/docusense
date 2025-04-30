import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DecryptDocumentDto } from './dto/decrypt-document.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentEncryptionController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post(':id/decrypt')
  @HttpCode(HttpStatus.OK)
  async decryptDocument(
    @Param('id') id: string,
    @Body() decryptDocumentDto: DecryptDocumentDto,
    @Req() req: Request,
  ) {
    const shouldDecrypt = decryptDocumentDto.decrypt;
    return await this.documentsService.decryptDocument(id, shouldDecrypt);
  }
}