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
  NotFoundException,
} from '@nestjs/common';
import { DocumentAnnotationService } from './document-annotation.service';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentAnnotation } from './entities/document-annotation.entity';

@Controller('api/documents/:documentId/annotations')
export class DocumentAnnotationController {
  constructor(private readonly documentAnnotationService: DocumentAnnotationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Param('documentId') documentId: string,
    @Request() req,
  ): Promise<DocumentAnnotation[]> {
    return this.documentAnnotationService.findAll(documentId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Param('documentId') documentId: string,
    @Request() req,
    @Body() createAnnotationDto: CreateAnnotationDto,
  ): Promise<DocumentAnnotation> {
    return this.documentAnnotationService.create(
      documentId,
      req.user.id,
      createAnnotationDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':annotationId')
  update(
    @Param('annotationId') id: string,
    @Body() updateAnnotationDto: UpdateAnnotationDto,
    @Request() req,
    @Param('documentId') documentId: string,
  ): Promise<DocumentAnnotation> {
    return this.documentAnnotationService.update(id, updateAnnotationDto, req.user.id, documentId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':annotationId')
  remove(
    @Param('annotationId') id: string,
    @Request() req,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    return this.documentAnnotationService.remove(id, req.user.id, documentId);
  }
}