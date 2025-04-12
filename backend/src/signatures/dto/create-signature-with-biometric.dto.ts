import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
} from 'class-validator';
import { SignaturePositionDto } from './create-signature.dto';

export class CreateSignatureWithBiometricDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  position?: SignaturePositionDto;

  @IsNotEmpty()
  @IsObject()
  biometricVerification: {
    timestamp: number;
    challenge: string;
    score: number;
    method: string;
  };
}
