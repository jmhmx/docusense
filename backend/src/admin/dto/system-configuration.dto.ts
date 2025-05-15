// backend/src/admin/dto/system-configuration.dto.ts
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EmailConfigDto {
  fromEmail: string;
  smtpServer: string;
  smtpPort: number;
  useSSL: boolean;
  username: string;
  password?: string;
}

export class SecurityConfigDto {
  jwtExpirationHours: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  requireStrongPasswords: boolean;
  twoFactorAuthEnabled: boolean;
  keyRotationDays: number;
}

export class StorageConfigDto {
  maxFileSizeMB: number;
  totalStorageGB: number;
  allowedFileTypes: string[];
  documentExpirationDays: number;
}

export class BlockchainConfigDto {
  enabled: boolean;
  provider: string;
  apiKey?: string;
  networkId: string;
}

export class UpdateSystemConfigurationDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EmailConfigDto)
  email?: EmailConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SecurityConfigDto)
  security?: SecurityConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StorageConfigDto)
  storage?: StorageConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BlockchainConfigDto)
  blockchain?: BlockchainConfigDto;
}
