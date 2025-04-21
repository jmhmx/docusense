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
import { SharingService } from '../sharing/sharing.service';
import { DocumentsService } from './documents.service';

@Controller('api/documents')
export class DocumentPermissionsController {
  constructor(
    private readonly sharingService: SharingService,
    private readonly documentsService: DocumentsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id/permissions')
  async getDocumentPermissions(@Param('id') id: string, @Request() req) {
    try {
      // Primero verificar que el documento existe y el usuario tiene acceso
      await this.documentsService.findOne(id, req.user.id);

      // Luego obtener los permisos
      return await this.sharingService.getDocumentPermissions(id, req.user.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener permisos: ${error.message}`,
      );
    }
  }
}
