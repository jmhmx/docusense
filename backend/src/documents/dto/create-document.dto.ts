import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsObject,
} from 'class-validator';
import { DocumentStatus } from '../entities/document.entity';

export class CreateDocumentDto {
  @IsNotEmpty({ message: 'El título es requerido' })
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty({ message: 'El nombre del archivo es requerido' })
  @IsString()
  filename: string;

  @IsNotEmpty({ message: 'La ruta del archivo es requerida' })
  @IsString()
  filePath: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  extractedContent?: Record<string, any>;
}
