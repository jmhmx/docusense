import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class LivenessCheckDto {
  @IsNotEmpty()
  @IsString()
  imageData: string; // Base64 encoded image

  @IsOptional()
  @IsString()
  challenge?: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
