// backend/src/annotations/annotations.controller.ts
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
  BadRequestException,
} from '@nestjs/common';
import { AnnotationsService } from './annotations.service';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
//import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/annotations')
export class AnnotationsController {
  constructor(private readonly annotationsService: AnnotationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('document/:documentId')
  create(
    @Param('documentId') documentId: string,
    @Body() createAnnotationDto: CreateAnnotationDto,
    @Request() req,
  ) {
    return this.annotationsService.create(
      createAnnotationDto,
      documentId,
      req.user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId')
  findAll(@Param('documentId') documentId: string, @Request() req) {
    return this.annotationsService.findAll(documentId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.annotationsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnnotationDto: UpdateAnnotationDto,
    @Request() req,
  ) {
    return this.annotationsService.update(id, updateAnnotationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.annotationsService.remove(id);
  }
}