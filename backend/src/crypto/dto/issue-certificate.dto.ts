import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsObject,
  IsIn,
} from 'class-validator';

/**
 * DTO for issuing a new certificate
 */
export class IssueCertificateDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650) // Maximum 10 years
  validityPeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  canSign?: boolean;

  @IsOptional()
  @IsBoolean()
  canEncrypt?: boolean;

  @IsOptional()
  @IsBoolean()
  canAuthenticate?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'high', 'highest'])
  securityLevel?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
