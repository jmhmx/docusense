import { IsNotEmpty, IsNumber, IsObject, IsString } from 'class-validator';

export class CreateAnnotationDto {
  @IsNotEmpty()
  @IsString()
  type: string;

  @IsNotEmpty()
  @IsNumber()
  page: number;

  @IsNotEmpty()
  @IsObject()
  position: { x: number; y: number };

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsString()
  color: string;
}