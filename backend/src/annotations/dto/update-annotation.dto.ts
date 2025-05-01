import {
  IsOptional,
  IsEnum,
  IsString,
  IsObject,
} from 'class-validator';
import { AnnotationType } from '../entities/annotation.entity';

export class UpdateAnnotationDto {
  @IsOptional()
  @IsEnum(AnnotationType)
  type?: AnnotationType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  position?: Record<string, any>;

  @IsOptional()
  @IsString()
  color?: string;
}