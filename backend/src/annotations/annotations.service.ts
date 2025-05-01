import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation } from './entities/annotation.entity';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private annotationsRepository: Repository<Annotation>,
  ) {}

  async create(
    createAnnotationDto: CreateAnnotationDto,
    documentId: string,
    userId: string,
  ): Promise<Annotation> {
    const annotation = this.annotationsRepository.create({
      ...createAnnotationDto,
      documentId,
      userId,
    });
    return this.annotationsRepository.save(annotation);
  }

  async findAll(documentId: string, userId?: string): Promise<Annotation[]> {
    const queryOptions: any = { where: { documentId } };

    if (userId) {
      queryOptions.where.userId = userId;
    }

    return this.annotationsRepository.find(queryOptions);
  }

  async findOne(id: string): Promise<Annotation> {
    const annotation = await this.annotationsRepository.findOne({
      where: { id },
    });
    if (!annotation) {
      throw new NotFoundException(`Annotation with ID ${id} not found`);
    }
    return annotation;
  }

  async update(
    id: string,
    updateAnnotationDto: UpdateAnnotationDto,
  ): Promise<Annotation> {
    const annotation = await this.findOne(id);
    Object.assign(annotation, updateAnnotationDto);
    return this.annotationsRepository.save(annotation);
  }

  async remove(id: string): Promise<void> {
    const annotation = await this.findOne(id);
    await this.annotationsRepository.remove(annotation);
  }

  // Método para guardar múltiples anotaciones
  async saveMultiple(annotations: CreateAnnotationDto[], documentId: string, userId: string): Promise<Annotation[]> {
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
  }
}