import { IsOptional, IsString } from 'class-validator';

export class UpdateAnnotationDto {
  @IsOptional()
  @IsString()
  content?: string;
}