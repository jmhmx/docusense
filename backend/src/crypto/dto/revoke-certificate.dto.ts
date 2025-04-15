import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { RevocationReason } from '../entities/certificate.entity';

/**
 * DTO for revoking a certificate
 */
export class RevokeCertificateDto {
  @IsNotEmpty()
  @IsEnum(RevocationReason)
  reason: RevocationReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
