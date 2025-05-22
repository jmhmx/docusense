import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

interface LoginAttempt {
  attempts: number;
  lastAttempt: Date;
  blockedUntil?: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginAttempts = new Map<string, LoginAttempt>();
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly BLOCK_DURATION_MINUTES = 15;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    // Limpiar intentos de login expirados cada hora
    setInterval(() => this.cleanupExpiredAttempts(), 60 * 60 * 1000);
  }

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
      .toString('hex');
    return `${salt}:${hash}`;
  }

  async verifyPassword(
    storedPassword: string,
    suppliedPassword: string,
  ): Promise<boolean> {
    const [salt, storedHash] = storedPassword.split(':');
    const hash = crypto
      .pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512')
      .toString('hex');
    return storedHash === hash;
  }

  /**
   * Validaciones adicionales para el registro
   */
  private async validateRegistration(registerDto: RegisterDto): Promise<void> {
    const { name, email, password } = registerDto;

    // Validar nombre
    if (name.trim().length < 2) {
      throw new BadRequestException(
        'El nombre debe tener al menos 2 caracteres',
      );
    }

    if (name.length > 100) {
      throw new BadRequestException('El nombre es demasiado largo');
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException(
        'El formato del correo electrónico no es válido',
      );
    }

    // Validar que no sea un email temporal o sospechoso
    const suspiciousDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
    ];

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (suspiciousDomains.includes(emailDomain)) {
      throw new BadRequestException(
        'No se permiten correos electrónicos temporales',
      );
    }

    // Validar contraseña segura
    if (password.length < 6) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 6 caracteres',
      );
    }

    if (password.length > 128) {
      throw new BadRequestException('La contraseña es demasiado larga');
    }

    // Verificar complejidad de contraseña
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new BadRequestException(
        'La contraseña debe contener al menos: una mayúscula, una minúscula, un número y un carácter especial',
      );
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
      throw new BadRequestException(
        'La contraseña es demasiado común, elija una más segura',
      );
    }
  }

  /**
   * Verificar intentos de login fallidos
   */
  private checkLoginAttempts(email: string): void {
    const key = email.toLowerCase();
    const attempt = this.loginAttempts.get(key);
    const now = new Date();

    if (attempt?.blockedUntil && now < attempt.blockedUntil) {
      const remainingMinutes = Math.ceil(
        (attempt.blockedUntil.getTime() - now.getTime()) / (1000 * 60),
      );

      this.logger.warn(
        `Login bloqueado para ${email} por ${remainingMinutes} minutos`,
      );
      throw new BadRequestException(
        `Demasiados intentos fallidos. Intente nuevamente en ${remainingMinutes} minutos`,
      );
    }
  }

  /**
   * Registrar intento de login fallido
   */
  private recordFailedLoginAttempt(email: string): void {
    const key = email.toLowerCase();
    const attempt = this.loginAttempts.get(key);
    const now = new Date();

    if (attempt) {
      attempt.attempts++;
      attempt.lastAttempt = now;

      if (attempt.attempts >= this.MAX_LOGIN_ATTEMPTS) {
        attempt.blockedUntil = new Date(
          now.getTime() + this.BLOCK_DURATION_MINUTES * 60 * 1000,
        );
        this.logger.warn(
          `Usuario ${email} bloqueado por ${this.BLOCK_DURATION_MINUTES} minutos`,
        );
      }
    } else {
      this.loginAttempts.set(key, {
        attempts: 1,
        lastAttempt: now,
      });
    }
  }

  /**
   * Limpiar intento exitoso
   */
  private clearLoginAttempts(email: string): void {
    this.loginAttempts.delete(email.toLowerCase());
  }

  /**
   * Limpiar intentos expirados
   */
  private cleanupExpiredAttempts(): void {
    const now = new Date();
    const expiredThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 horas

    for (const [key, attempt] of this.loginAttempts.entries()) {
      // Limpiar si el bloqueo ha expirado y no hay intentos recientes
      if (
        (!attempt.blockedUntil || now > attempt.blockedUntil) &&
        attempt.lastAttempt < expiredThreshold
      ) {
        this.loginAttempts.delete(key);
      }
    }
  }

  async register(registerDto: RegisterDto, response: Response) {
    this.logger.log(`Intento de registro para: ${registerDto.email}`);

    // Validaciones adicionales
    await this.validateRegistration(registerDto);

    const { email, password, name } = registerDto;
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();

    // Verificar si el usuario ya existe
    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      this.logger.warn(
        `Intento de registro con email existente: ${normalizedEmail}`,
      );
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Hashear contraseña
    const hashedPassword = await this.hashPassword(password);

    try {
      // Crear usuario
      const user = await this.usersService.create({
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
      });

      // Generar token
      const keyRotationCount = user.keyRotationCount || 0;
      const token = this.generateToken(user.id, user.isAdmin, keyRotationCount);

      // Establecer cookie HTTP
      this.setAuthCookie(response, token);

      // Enviar email de bienvenida de forma asíncrona
      this.sendWelcomeEmail(user.email, user.name).catch((error) => {
        this.logger.error(
          `Error enviando email de bienvenida: ${error.message}`,
        );
      });

      this.logger.log(`Usuario registrado exitosamente: ${normalizedEmail}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error en registro para ${normalizedEmail}: ${error.message}`,
      );
      throw new BadRequestException(
        'Error al crear la cuenta. Intente nuevamente.',
      );
    }
  }

  async login(loginDto: LoginDto, response: Response) {
    const { email, password } = loginDto;
    const normalizedEmail = email.toLowerCase().trim();

    this.logger.log(`Intento de login para: ${normalizedEmail}`);

    // Verificar límite de intentos
    this.checkLoginAttempts(normalizedEmail);

    // Buscar usuario
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      this.recordFailedLoginAttempt(normalizedEmail);
      this.logger.warn(
        `Intento de login con email inexistente: ${normalizedEmail}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña
    const isPasswordValid = await this.verifyPassword(user.password, password);
    if (!isPasswordValid) {
      this.recordFailedLoginAttempt(normalizedEmail);
      this.logger.warn(
        `Intento de login con contraseña incorrecta: ${normalizedEmail}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Login exitoso - limpiar intentos fallidos
    this.clearLoginAttempts(normalizedEmail);

    // Generar token
    const keyRotationCount = user.keyRotationCount || 0;
    const token = this.generateToken(user.id, user.isAdmin, keyRotationCount);

    // Establecer cookie HTTP
    this.setAuthCookie(response, token);

    this.logger.log(`Login exitoso para: ${normalizedEmail}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
    };
  }

  private generateToken(
    userId: string,
    isAdmin: boolean,
    keyRotationCount: number,
  ) {
    const payload = {
      sub: userId,
      isAdmin,
      keyRotation: keyRotationCount,
    };
    return this.jwtService.sign(payload);
  }

  private setAuthCookie(response: Response, token: string) {
    const expirationHours = this.configService.get<number>(
      'JWT_EXPIRATION_HOURS',
      4,
    );
    response.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expirationHours * 60 * 60 * 1000,
      path: '/',
    });
  }

  private async sendWelcomeEmail(email: string, name: string): Promise<void> {
    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';

      await this.emailService.sendWelcomeEmail(
        email,
        name,
        `${frontendUrl}/dashboard`,
      );
    } catch (error) {
      this.logger.error(`Error enviando email de bienvenida: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de seguridad (para administradores)
   */
  getSecurityStats(): {
    blockedUsers: number;
    totalAttempts: number;
    recentAttempts: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let blockedUsers = 0;
    let totalAttempts = 0;
    let recentAttempts = 0;

    for (const attempt of this.loginAttempts.values()) {
      totalAttempts += attempt.attempts;

      if (attempt.blockedUntil && now < attempt.blockedUntil) {
        blockedUsers++;
      }

      if (attempt.lastAttempt > oneHourAgo) {
        recentAttempts++;
      }
    }

    return {
      blockedUsers,
      totalAttempts,
      recentAttempts,
    };
  }

  /**
   * Desbloquear usuario (para administradores)
   */
  unblockUser(email: string): boolean {
    const key = email.toLowerCase();
    return this.loginAttempts.delete(key);
  }
}
