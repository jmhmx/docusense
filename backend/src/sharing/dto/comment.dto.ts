import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsNumber,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CommentPositionSelectionDto {
  @IsNumber()
  start: number;

  @IsNumber()
  end: number;

  @IsString()
  text: string;
}

export class CommentPositionDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommentPositionSelectionDto)
  selection?: CommentPositionSelectionDto;
}

export class CreateCommentDto {
  @IsUUID()
  documentId: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CommentPositionDto)
  position?: CommentPositionDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;
}

export class CommentFilterDto {
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  onlyResolved?: boolean;

  @IsOptional()
  @IsBoolean()
  onlyUnresolved?: boolean;

  @IsOptional()
  @IsBoolean()
  includeReplies?: boolean;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDirection?: 'ASC' | 'DESC';
}
