import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {}

  async create(
    createDocumentDto: CreateDocumentDto,
    userId: string,
  ): Promise<Document> {
    const document = this.documentsRepository.create({
      ...createDocumentDto,
      userId,
    });
    return this.documentsRepository.save(document);
  }

  async findAll(userId?: string, searchQuery?: string): Promise<Document[]> {
    let whereCondition: any = {};

    if (userId) {
      whereCondition.userId = userId;
    }

    // Añadir búsqueda si hay una consulta
    if (searchQuery && searchQuery.trim().length > 0) {
      whereCondition = [
        { ...whereCondition, title: ILike(`%${searchQuery}%`) },
        { ...whereCondition, filename: ILike(`%${searchQuery}%`) },
        { ...whereCondition, description: ILike(`%${searchQuery}%`) },
      ];
    }

    return this.documentsRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId?: string): Promise<Document> {
    const queryOptions: any = { where: { id } };

    if (userId) {
      queryOptions.where.userId = userId;
    }

    const document = await this.documentsRepository.findOne(queryOptions);

    if (!document) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado`);
    }

    return document;
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    userId?: string,
  ): Promise<Document> {
    const document = await this.findOne(id, userId);
    Object.assign(document, updateDocumentDto);
    return this.documentsRepository.save(document);
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    const document = await this.findOne(id);
    document.status = status;
    return this.documentsRepository.save(document);
  }

  async remove(id: string, userId?: string): Promise<void> {
    const document = await this.findOne(id, userId);

    // Eliminar archivo físico si existe
    if (document.filePath) {
      try {
        const filePath = path.resolve(document.filePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Error al eliminar archivo: ${error.message}`);
      }
    }

    await this.documentsRepository.remove(document);
  }

  /**
   * Busca documentos por contenido extraído
   */
  async searchByContent(query: string, userId?: string): Promise<Document[]> {
    // Consulta SQL directa para buscar en el contenido JSON
    const queryBuilder = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.status = :status', { status: DocumentStatus.COMPLETED });

    // Restricción por usuario si se proporciona
    if (userId) {
      queryBuilder.andWhere('document.userId = :userId', { userId });
    }

    // Búsqueda en el contenido extraído (esto varía según la base de datos)
    // Esta implementación es para PostgreSQL con columnas JSONB
    queryBuilder.andWhere(
      "CAST(document.extractedContent ->> 'text' AS TEXT) ILIKE :query",
      { query: `%${query}%` },
    );

    return queryBuilder.orderBy('document.createdAt', 'DESC').getMany();
  }
}
