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
  Logger
} from '@nestjs/common';
import { AnnotationsService } from './annotations.service';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/annotations')
export class AnnotationsController {
  private readonly logger = new Logger(AnnotationsController.name);

  constructor(private readonly annotationsService: AnnotationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('document/:documentId')
  create(
    @Param('documentId') documentId: string,
    @Body() createAnnotationDto: CreateAnnotationDto,
    @Request() req,
  ) {
    this.logger.log('create iniciado');
    try {
      const result = this.annotationsService.create(
        createAnnotationDto,
        documentId,
        req.user.id,
      );
      this.logger.log(`Finaliza creación de anotación en el documento ${documentId}`)
      return result;
    } catch (error) {
      this.logger.error(`Error en create: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/:documentId/batch')
  createBatch(
    @Param('documentId') documentId: string,
    @Body() createAnnotationDtos: CreateAnnotationDto[],
    @Request() req,
  ) {
    this.logger.log('createBatch iniciado');
    try {
      if (!Array.isArray(createAnnotationDtos)) {
        throw new BadRequestException('Expected an array of annotations');
      }
      const result = this.annotationsService.saveMultiple(
        createAnnotationDtos,
        documentId,
        req.user.id,
      );
      this.logger.log(`Finaliza creación de anotaciones en el documento ${documentId}`)
      return result;
    } catch (error) {
      this.logger.error(`Error en createBatch: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId')
  findAll(@Param('documentId') documentId: string, @Request() req) {
    this.logger.log('findAll iniciado');
    try {
      const result = this.annotationsService.findAll(documentId, req.user.id);
      this.logger.log(`Finaliza consulta de anotaciones en el documento ${documentId}`)
      return result;      
    } catch (error) {
      this.logger.error(`Error en findAll: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.log('findOne iniciado');
    try {
      const result = this.annotationsService.findOne(id);
      this.logger.log(`Finaliza consulta de anotación ${id}`)
      return result;
    } catch (error) {
      this.logger.error(`Error en findOne: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnnotationDto: UpdateAnnotationDto,
    @Request() req,
  ) {
    this.logger.log('update iniciado');
    try {
      const result = this.annotationsService.update(
        id,
        updateAnnotationDto,
      );
      this.logger.log(`Finaliza actualización de anotación ${id}`)
      return result;
    }catch (error) {
      this.logger.error(`Error en update: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    this.logger.log('remove iniciado');
    try{
      const result = this.annotationsService.remove(id);
      this.logger.log(`Finaliza eliminación de anotación ${id}`)
      return result;
    }catch (error) {
      this.logger.error(`Error en remove: ${error.message}`);
      throw error;
    }
  }
}