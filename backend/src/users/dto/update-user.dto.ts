import {
  IsEmail,
  IsOptional,
  MinLength,
  IsBoolean,
  IsString,
} from 'class-validator';
export class UpdateUserDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email?: string;

  @IsOptional()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsBoolean()
  biometricAuthEnabled?: boolean;

  @IsOptional()
  @IsString()
  biometricAuthMethod?: string;

  @IsOptional()
  biometricAuthSetupAt?: Date;
}
