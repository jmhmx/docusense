import { IsOptional, IsString, IsObject, IsNumber } from 'class-validator';

export class SignaturePositionDto {
  @IsNumber()
  page: number;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class CreateSignatureDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  position?: SignaturePositionDto;
}
