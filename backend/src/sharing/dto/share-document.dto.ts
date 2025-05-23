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
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PermissionLevel } from '../entities/document-permission.entity';

// Validador personalizado para fechas futuras
@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(dateString: string, args: ValidationArguments) {
    if (!dateString) return true; // Opcional, será manejado por @IsOptional()

    const date = new Date(dateString);
    const now = new Date();

    // Debe ser al menos 1 hora en el futuro
    const minFutureTime = new Date(now.getTime() + 60 * 60 * 1000);

    return date > minFutureTime;
  }

  defaultMessage(args: ValidationArguments) {
    return 'La fecha de expiración debe ser al menos 1 hora en el futuro';
  }
}

// Validador para límite máximo de expiración
@ValidatorConstraint({ name: 'isWithinMaxDays', async: false })
export class IsWithinMaxDaysConstraint implements ValidatorConstraintInterface {
  validate(dateString: string, args: ValidationArguments) {
    if (!dateString) return true;

    const date = new Date(dateString);
    const now = new Date();

    // Máximo 1 año en el futuro
    const maxFutureTime = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return date <= maxFutureTime;
  }

  defaultMessage(args: ValidationArguments) {
    return 'La fecha de expiración no puede ser mayor a 1 año';
  }
}

export class ShareDocumentDto {
  @IsUUID()
  documentId: string;

  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido' })
  email: string;

  @IsEnum(PermissionLevel, {
    message: 'El nivel de permiso debe ser: viewer, commenter, editor, o owner',
  })
  permissionLevel: any;

  @IsOptional()
  @IsDateString()
  @Validate(IsFutureDateConstraint)
  @Validate(IsWithinMaxDaysConstraint)
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
  @Validate(IsFutureDateConstraint)
  @Validate(IsWithinMaxDaysConstraint)
  expiresAt: string;

  @IsOptional()
  @IsBoolean()
  requiresPassword?: boolean;

  @ValidateIf((o) => o.requiresPassword === true)
  @IsString()
  @Min(4, { message: 'La contraseña debe tener al menos 4 caracteres' })
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
