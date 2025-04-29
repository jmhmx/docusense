import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentAnnotation } from './entities/document-annotation.entity';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { Document } from './entities/document.entity';
import { DocumentsService } from './documents.service';

@Injectable()
export class DocumentAnnotationService {
  constructor(
    @InjectRepository(DocumentAnnotation)
    private readonly documentAnnotationRepository: Repository<DocumentAnnotation>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly documentsService: DocumentsService,
  ) {}

  async findAll(documentId: string): Promise<DocumentAnnotation[]> {
    const document = await this.documentRepository.findOneBy({ id: documentId });
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }
    return this.documentAnnotationRepository.find({
      where: { documentId },
    });
  }

  async create(
    documentId: string,
    userId: string,
    createAnnotationDto: CreateAnnotationDto,
  ): Promise<DocumentAnnotation> {
    const document = await this.documentRepository.findOneBy({ id: documentId });
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }
    const annotation = this.documentAnnotationRepository.create({
      ...createAnnotationDto,
      documentId,
      userId,
    });
    return this.documentAnnotationRepository.save(annotation);
  }

  async update(
    id: string,
    updateAnnotationDto: UpdateAnnotationDto,
    userId: string,
    documentId: string
  ): Promise<DocumentAnnotation> {
    const document = await this.documentRepository.findOneBy({ id: documentId });
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }
    const annotation = await this.documentAnnotationRepository.findOneBy({ id });
    if (!annotation) {
      throw new NotFoundException(`Annotation with id ${id} not found`);
    }
    if (annotation.userId !== userId) {
        throw new NotFoundException(`Annotation with id ${id} not found`);
    }
    Object.assign(annotation, updateAnnotationDto);
    return this.documentAnnotationRepository.save(annotation);
  }

  async remove(id: string, userId: string, documentId: string): Promise<void> {
    const document = await this.documentRepository.findOneBy({ id: documentId });
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }
    const annotation = await this.documentAnnotationRepository.findOneBy({ id });
    if (!annotation) {
      throw new NotFoundException(`Annotation with id ${id} not found`);
    }
    if (annotation.userId !== userId) {
        throw new NotFoundException(`Annotation with id ${id} not found`);
    }
    await this.documentAnnotationRepository.remove(annotation);
  }
}