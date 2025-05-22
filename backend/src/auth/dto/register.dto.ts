import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Validador personalizado para contraseñas seguras
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint
  implements ValidatorConstraintInterface
{
  validate(password: string, args: ValidationArguments) {
    if (!password) return false;

    // Al menos una mayúscula
    const hasUpperCase = /[A-Z]/.test(password);
    // Al menos una minúscula
    const hasLowerCase = /[a-z]/.test(password);
    // Al menos un número
    const hasNumbers = /\d/.test(password);
    // Al menos un carácter especial
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
  }

  defaultMessage(args: ValidationArguments) {
    return 'La contraseña debe contener al menos: una mayúscula, una minúscula, un número y un carácter especial';
  }
}

// Validador personalizado para nombres
@ValidatorConstraint({ name: 'isValidName', async: false })
export class IsValidNameConstraint implements ValidatorConstraintInterface {
  validate(name: string, args: ValidationArguments) {
    if (!name) return false;

    // Solo letras, espacios, acentos y números
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9]+$/;
    return nameRegex.test(name.trim());
  }

  defaultMessage(args: ValidationArguments) {
    return 'El nombre solo puede contener letras, números y espacios';
  }
}

export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  @Validate(IsValidNameConstraint)
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  @MaxLength(255, { message: 'El correo electrónico es demasiado largo' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(128, { message: 'La contraseña no puede exceder 128 caracteres' })
  @Validate(IsStrongPasswordConstraint)
  password: string;
}
