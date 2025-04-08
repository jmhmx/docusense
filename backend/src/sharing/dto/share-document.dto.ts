import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsDateString,
  ValidateIf,
  IsNumber,
  Min,
} from 'class-validator';
import { PermissionLevel } from '../entities/document-permission.entity';

export class ShareDocumentDto {
  @IsUUID()
  documentId: string;

  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido' })
  email: string;

  @IsEnum(PermissionLevel, {
    message: 'El nivel de permiso debe ser: viewer, commenter, editor, o owner',
  })
  permissionLevel: PermissionLevel;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

export class CreateShareLinkDto {
  @IsUUID()
  documentId: string;

  @IsEnum(PermissionLevel, {
    message: 'El nivel de permiso debe ser: viewer, commenter, editor, o owner',
  })
  permissionLevel: PermissionLevel;

  @IsDateString()
  expiresAt: string;

  @IsOptional()
  @IsBoolean()
  requiresPassword?: boolean;

  @ValidateIf((o) => o.requiresPassword === true)
  @IsString()
  password?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;
}

export class AccessShareLinkDto {
  @IsString()
  token: string;

  @ValidateIf((o) => o.password !== undefined)
  @IsString()
  password?: string;
}

export class UpdatePermissionDto {
  @IsEnum(PermissionLevel, {
    message: 'El nivel de permiso debe ser: viewer, commenter, editor, o owner',
  })
  permissionLevel: PermissionLevel;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
