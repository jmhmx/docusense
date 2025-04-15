import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * DTO for verifying a certificate
 */
export class VerifyCertificateDto {
  @IsNotEmpty()
  @IsUUID()
  certificateId: string;
}
