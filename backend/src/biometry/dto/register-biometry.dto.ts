// src/biometry/dto/register-biometry.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsObject,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class RegisterBiometryDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  descriptorData: string; // Base64 encoded

  @IsEnum(['face', 'fingerprint'])
  type: string;

  @IsObject()
  @IsOptional()
  livenessProof?: Record<string, any>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
