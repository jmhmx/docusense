import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty({ message: 'El contenido es requerido' })
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsObject()
  position?: Record<string, any>;

  @IsOptional()
  @IsArray()
  mentions?: string[]; // IDs de usuarios mencionados

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}
