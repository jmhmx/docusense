import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';

export class VerifyBiometryDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  descriptorData: string; // Base64 encoded

  @IsObject()
  @IsOptional()
  livenessProof?: Record<string, any>;
}
