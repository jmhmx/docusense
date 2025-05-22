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
      return {
        isValid: false,
        message: 'El formato del correo electrónico no es válido',
      };
    }

    if (email.length > 255) {
      return {
        isValid: false,
        message: 'El correo electrónico es demasiado largo',
      };
    }

    // Verificar dominios sospechosos
    const suspiciousDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    if (suspiciousDomains.includes(domain)) {
      return {
        isValid: false,
        message: 'No se permiten correos electrónicos temporales',
      };
    }

    return { isValid: true };
  }

  // Validación de nombre
  static validateName(name: string): ValidationResult {
    if (!name.trim()) {
      return { isValid: false, message: 'El nombre es requerido' };
    }

    if (name.trim().length < 2) {
      return {
        isValid: false,
        message: 'El nombre debe tener al menos 2 caracteres',
      };
    }

    if (name.length > 100) {
      return {
        isValid: false,
        message: 'El nombre es demasiado largo (máximo 100 caracteres)',
      };
    }

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9]+$/;
    if (!nameRegex.test(name)) {
      return {
        isValid: false,
        message: 'El nombre solo puede contener letras, números y espacios',
      };
    }

    return { isValid: true };
  }

  // Validación de contraseña
  static validatePassword(password: string): ValidationResult {
    if (!password) {
      return { isValid: false, message: 'La contraseña es requerida' };
    }

    if (password.length < 6) {
      return {
        isValid: false,
        message: 'La contraseña debe tener al menos 6 caracteres',
      };
    }

    if (password.length > 128) {
      return {
        isValid: false,
        message: 'La contraseña es demasiado larga (máximo 128 caracteres)',
      };
    }

    // Verificar complejidad
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase) {
      return {
        isValid: false,
        message: 'La contraseña debe contener al menos una letra mayúscula',
      };
    }

    if (!hasLowerCase) {
      return {
        isValid: false,
        message: 'La contraseña debe contener al menos una letra minúscula',
      };
    }

    if (!hasNumbers) {
      return {
        isValid: false,
        message: 'La contraseña debe contener al menos un número',
      };
    }

    if (!hasSpecialChar) {
      return {
        isValid: false,
        message: 'La contraseña debe contener al menos un carácter especial',
      };
    }

    // Verificar contraseñas comunes
    const commonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      '12345678',
      'welcome',
      'letmein',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      return {
        isValid: false,
        message: 'La contraseña es demasiado común, elija una más segura',
      };
    }

    return { isValid: true };
  }

  // Validación de confirmación de contraseña
  static validatePasswordConfirmation(
    password: string,
    confirmPassword: string,
  ): ValidationResult {
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
    else if (password.length >= 6)
      suggestions.push('Considere usar 8 o más caracteres');

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
        label: 'Muy débil',
        color: 'red',
        suggestions,
      };
    }

    if (score <= 3) {
      return {
        strength: strengthPercentage,
        label: 'Débil',
        color: 'orange',
        suggestions,
      };
    }

    if (score <= 4) {
      return {
        strength: strengthPercentage,
        label: 'Regular',
        color: 'yellow',
        suggestions,
      };
    }

    if (score <= 5) {
      return {
        strength: strengthPercentage,
        label: 'Fuerte',
        color: 'green',
        suggestions,
      };
    }

    return {
      strength: 100,
      label: 'Muy fuerte',
      color: 'green',
      suggestions: [],
    };
  }

  // Validación de documento/título
  static validateDocumentTitle(title: string): ValidationResult {
    if (!title.trim()) {
      return { isValid: false, message: 'El título es requerido' };
    }

    if (title.trim().length < 3) {
      return {
        isValid: false,
        message: 'El título debe tener al menos 3 caracteres',
      };
    }

    if (title.length > 255) {
      return {
        isValid: false,
        message: 'El título es demasiado largo (máximo 255 caracteres)',
      };
    }

    // Verificar caracteres no permitidos en nombres de archivo
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(title)) {
      return {
        isValid: false,
        message: 'El título contiene caracteres no permitidos',
      };
    }

    return { isValid: true };
  }

  // Validación de URL
  static validateUrl(url: string): ValidationResult {
    if (!url.trim()) {
      return { isValid: false, message: 'La URL es requerida' };
    }

    try {
      new URL(url);
      return { isValid: true };
    } catch {
      return { isValid: false, message: 'La URL no es válida' };
    }
  }

  // Validación de teléfono
  static validatePhone(phone: string): ValidationResult {
    if (!phone.trim()) {
      return { isValid: false, message: 'El teléfono es requerido' };
    }

    // Formato mexicano básico
    const phoneRegex = /^(\+?52)?[\s\-]?(\d{2,3})[\s\-]?\d{3,4}[\s\-]?\d{4}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      return {
        isValid: false,
        message: 'El formato del teléfono no es válido',
      };
    }

    return { isValid: true };
  }

  // Validación de fecha
  static validateDate(
    date: string,
    options?: {
      minDate?: Date;
      maxDate?: Date;
      allowPast?: boolean;
      allowFuture?: boolean;
    },
  ): ValidationResult {
    if (!date.trim()) {
      return { isValid: false, message: 'La fecha es requerida' };
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return { isValid: false, message: 'La fecha no es válida' };
    }

    if (options) {
      const now = new Date();

      if (options.minDate && parsedDate < options.minDate) {
        return {
          isValid: false,
          message: `La fecha debe ser posterior a ${options.minDate.toLocaleDateString()}`,
        };
      }

      if (options.maxDate && parsedDate > options.maxDate) {
        return {
          isValid: false,
          message: `La fecha debe ser anterior a ${options.maxDate.toLocaleDateString()}`,
        };
      }

      if (options.allowPast === false && parsedDate < now) {
        return {
          isValid: false,
          message: 'La fecha no puede ser en el pasado',
        };
      }

      if (options.allowFuture === false && parsedDate > now) {
        return {
          isValid: false,
          message: 'La fecha no puede ser en el futuro',
        };
      }
    }

    return { isValid: true };
  }

  // Validación de archivo
  static validateFile(
    file: File,
    options?: {
      maxSize?: number; // en bytes
      allowedTypes?: string[];
      allowedExtensions?: string[];
    },
  ): ValidationResult {
    if (!file) {
      return { isValid: false, message: 'Debe seleccionar un archivo' };
    }

    if (options) {
      if (options.maxSize && file.size > options.maxSize) {
        const maxSizeMB = (options.maxSize / (1024 * 1024)).toFixed(1);
        return {
          isValid: false,
          message: `El archivo no puede ser mayor a ${maxSizeMB}MB`,
        };
      }

      if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
        return {
          isValid: false,
          message: `Tipo de archivo no permitido. Tipos permitidos: ${options.allowedTypes.join(
            ', ',
          )}`,
        };
      }

      if (options.allowedExtensions) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (
          !extension ||
          !options.allowedExtensions.includes(`.${extension}`)
        ) {
          return {
            isValid: false,
            message: `Extensión no permitida. Extensiones permitidas: ${options.allowedExtensions.join(
              ', ',
            )}`,
          };
        }
      }
    }

    return { isValid: true };
  }

  // Validación personalizada con reglas
  static validateField(
    value: string,
    rules: FormValidationRules,
  ): ValidationResult {
    if (rules.required && !value.trim()) {
      return { isValid: false, message: 'Este campo es requerido' };
    }

    if (rules.minLength && value.length < rules.minLength) {
      return {
        isValid: false,
        message: `Debe tener al menos ${rules.minLength} caracteres`,
      };
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return {
        isValid: false,
        message: `No puede exceder ${rules.maxLength} caracteres`,
      };
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return { isValid: false, message: 'El formato no es válido' };
    }

    if (rules.customValidator) {
      return rules.customValidator(value);
    }

    return { isValid: true };
  }

  // Validar múltiples campos de un formulario
  static validateForm<T extends Record<string, any>>(
    formData: T,
    validationRules: Record<keyof T, FormValidationRules>,
  ): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
    const errors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    for (const [field, rules] of Object.entries(validationRules)) {
      const value = formData[field as keyof T];
      const result = this.validateField(String(value || ''), rules);

      if (!result.isValid) {
        errors[field as keyof T] = result.message;
        isValid = false;
      }
    }

    return { isValid, errors };
  }

  // Sanitizar entrada de texto
  static sanitizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
      .replace(/[<>]/g, ''); // Remover caracteres potencialmente peligrosos
  }

  // Verificar si un email es empresarial (no proveedores gratuitos)
  static isBusinessEmail(email: string): boolean {
    const freeProviders = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'icloud.com',
      'aol.com',
      'live.com',
      'msn.com',
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? !freeProviders.includes(domain) : false;
  }

  // Validar RFC mexicano
  static validateRFC(rfc: string): ValidationResult {
    if (!rfc.trim()) {
      return { isValid: false, message: 'El RFC es requerido' };
    }

    // RFC persona física: 4 letras + 6 números + 3 caracteres
    // RFC persona moral: 3 letras + 6 números + 3 caracteres
    const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

    if (!rfcRegex.test(rfc.toUpperCase())) {
      return { isValid: false, message: 'El formato del RFC no es válido' };
    }

    return { isValid: true };
  }

  // Validar CURP
  static validateCURP(curp: string): ValidationResult {
    if (!curp.trim()) {
      return { isValid: false, message: 'La CURP es requerida' };
    }

    const curpRegex =
      /^[A-Z]{1}[AEIOUX]{1}[A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM]{1}(AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}$/;

    if (!curpRegex.test(curp.toUpperCase())) {
      return { isValid: false, message: 'El formato de la CURP no es válido' };
    }

    return { isValid: true };
  }
}
