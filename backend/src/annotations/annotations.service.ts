import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation } from './entities/annotation.entity';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';

@Injectable()
export class AnnotationsService {
  private readonly logger = new Logger(AnnotationsService.name);
  constructor(
    @InjectRepository(Annotation)
    private annotationsRepository: Repository<Annotation>,
  ) {}

  async create(
    createAnnotationDto: CreateAnnotationDto,
    documentId: string,
    userId: string,
  ): Promise<Annotation> {
    this.logger.log(`Iniciando creación de anotación en el documento ${documentId}`);
    try {
      const annotation = this.annotationsRepository.create({
        ...createAnnotationDto,
        documentId,
        userId,
      });
      return this.annotationsRepository.save(annotation);
      
    } catch (error) {
      this.logger.error(`Error al crear la anotación: ${error.message}`);
      throw error;
    }
  }

  async findAll(documentId: string, userId?: string): Promise<Annotation[]> {
    this.logger.log(`Iniciando búsqueda de anotaciones en el documento ${documentId}`);
    try{
      const queryOptions: any = { where: { documentId } };

      if (userId) {
        queryOptions.where.userId = userId;
      }

      return this.annotationsRepository.find(queryOptions);
    }catch(error){
      this.logger.error(`Error al buscar las anotaciones: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<Annotation> {
    this.logger.log(`Iniciando búsqueda de anotación con ID ${id}`);
    try{
      const annotation = await this.annotationsRepository.findOne({
        where: { id },
      });
      if (!annotation) {
        throw new NotFoundException(`Annotation with ID ${id} not found`);
      }
      return annotation;
    }catch(error){
      this.logger.error(`Error al buscar la anotación: ${error.message}`);
      throw error;
    }
  }

  async update(
    id: string,
    updateAnnotationDto: UpdateAnnotationDto,
  ): Promise<Annotation> {
    this.logger.log(`Iniciando actualización de anotación con ID ${id}`);
    try{
      const annotation = await this.findOne(id);
      Object.assign(annotation, updateAnnotationDto);
      return this.annotationsRepository.save(annotation);
    }catch(error){
      this.logger.error(`Error al actualizar la anotación: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Iniciando eliminación de anotación con ID ${id}`);
    try{
      const annotation = await this.findOne(id);
      await this.annotationsRepository.remove(annotation);
    }catch(error){
      this.logger.error(`Error al eliminar la anotación: ${error.message}`);
      throw error;
    }
  }

  // Método para guardar múltiples anotaciones
  async saveMultiple(annotations: CreateAnnotationDto[], documentId: string, userId: string): Promise<Annotation[]> {
    this.logger.log(`Iniciando guardado de múltiples anotaciones en el documento ${documentId}`);
    try{
      // Crear entidades de anotación
      const annotationEntities = annotations.map(dto => 
        this.annotationsRepository.create({
          ...dto,
          documentId,
          userId,
        })
      );
      // Guardar todas las anotaciones en la base de datos
      return this.annotationsRepository.save(annotationEntities);
    }catch(error){
      this.logger.error(`Error al guardar las anotaciones: ${error.message}`);
      throw error;
    }
  }
}