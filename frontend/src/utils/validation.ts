// utils/validation.ts

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface FormValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => ValidationResult;
}

export class FormValidator {
  // Validación de email
  static validateEmail(email: string): ValidationResult {
    if (!email.trim()) {
      return { isValid: false, message: 'El correo electrónico es requerido' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'El formato del correo electrónico no es válido' };
    }

    if (email.length > 255) {
      return { isValid: false, message: 'El correo electrónico es demasiado largo' };
    }

    // Verificar dominios sospechosos
    const suspiciousDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (suspiciousDomains.includes(domain)) {
      return { isValid: false, message: 'No se permiten correos electrónicos temporales' };
    }

    return { isValid: true };
  }

  // Validación de nombre
  static validateName(name: string): ValidationResult {
    if (!name.trim()) {
      return { isValid: false, message: 'El nombre es requerido' };
    }

    if (name.trim().length < 2) {
      return { isValid: false, message: 'El nombre debe tener al menos 2 caracteres' };
    }

    if (name.length > 100) {
      return { isValid: false, message: 'El nombre es demasiado largo (máximo 100 caracteres)' };
    }

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9]+$/;
    if (!nameRegex.test(name)) {
      return { isValid: false, message: 'El nombre solo puede contener letras, números y espacios' };
    }

    return { isValid: true };
  }

  // Validación de contraseña
  static validatePassword(password: string): ValidationResult {
    if (!password) {
      return { isValid: false, message: 'La contraseña es requerida' };
    }

    if (password.length < 6) {
      return { isValid: false, message: 'La contraseña debe tener al menos 6 caracteres' };
    }

    if (password.length > 128) {
      return { isValid: false, message: 'La contraseña es demasiado larga (máximo 128 caracteres)' };
    }

    // Verificar complejidad
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase) {
      return { isValid: false, message: 'La contraseña debe contener al menos una letra mayúscula' };
    }

    if (!hasLowerCase) {
      return { isValid: false, message: 'La contraseña debe contener al menos una letra minúscula' };
    }

    if (!hasNumbers) {
      return { isValid: false, message: 'La contraseña debe contener al menos un número' };
    }

    if (!hasSpecialChar) {
      return { isValid: false, message: 'La contraseña debe contener al menos un carácter especial' };
    }

    // Verificar contraseñas comunes
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', '12345678', 'welcome', 'letmein'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      return { isValid: false, message: 'La contraseña es demasiado común, elija una más segura' };
    }

    return { isValid: true };
  }

  // Validación de confirmación de contraseña
  static validatePasswordConfirmation(password: string, confirmPassword: string): ValidationResult {
    if (!confirmPassword) {
      return { isValid: false, message: 'Debe confirmar la contraseña' };
    }

    if (password !== confirmPassword) {
      return { isValid: false, message: 'Las contraseñas no coinciden' };
    }

    return { isValid: true };
  }

  // Obtener fuerza de contraseña
  static getPasswordStrength(password: string): {
    strength: number;
    label: string;
    color: string;
    suggestions: string[];
  } {
    if (!password) {
      return { strength: 0, label: '', color: '', suggestions: [] };
    }

    let score = 0;
    const suggestions: string[] = [];

    // Longitud
    if (password.length >= 6) score++;
    else suggestions.push('Use al menos 6 caracteres');

    if (password.length >= 8) score++;
    else if (password.length >= 6) suggestions.push('Considere usar 8 o más caracteres');

    // Mayúsculas
    if (/[A-Z]/.test(password)) score++;
    else suggestions.push('Agregue al menos una letra mayúscula');

    // Minúsculas
    if (/[a-z]/.test(password)) score++;
    else suggestions.push('Agregue al menos una letra minúscula');

    // Números
    if (/\d/.test(password)) score++;
    else suggestions.push('Agregue al menos un número');

    // Caracteres especiales
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    else suggestions.push('Agregue al menos un carácter especial');

    // Evaluar fortaleza
    const strengthPercentage = (score / 6) * 100;

    if (score <= 2) {
      return {
        strength: strengthPercentage,
        label: