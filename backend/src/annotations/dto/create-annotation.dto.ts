// backend/src/annotations/dto/create-annotation.dto.ts
import {
  IsNotEmpty,
  IsEnum,
  IsString,
  IsObject,
  IsOptional,
} from 'class-validator';
import { AnnotationType } from '../entities/annotation.entity';

export class CreateAnnotationDto {
  @IsNotEmpty()
  @IsEnum(AnnotationType)
  type: AnnotationType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsNotEmpty()
  @IsObject()
  position: Record<string, any>;

  @IsNotEmpty()
  @IsString()
  color: string;
}