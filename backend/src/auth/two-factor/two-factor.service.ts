import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EmailService } from '../../email/email.service';
import { AuditLogService, AuditAction } from '../../audit/audit-log.service';
import * as crypto from 'crypto';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly CODE_EXPIRY_MINUTES = 15; // Tiempo de expiración del código en minutos
  private readonly CODE_LENGTH = 6; // Longitud del código

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Genera un código de verificación para un usuario y lo envía por correo electrónico
   */
  async generateAndSendVerificationCode(
    userId: string,
    action: string = 'firma',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; expiresAt: Date }> {
    // Buscar el usuario
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Generar un código alfanumérico único
    const verificationCode = this.generateVerificationCode();

    // Calcular fecha de expiración
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES);

    // Almacenar el código en el usuario (con hash para seguridad)
    user.twoFactorTempSecret = this.hashVerificationCode(verificationCode);
    user.twoFactorTempSecretExpires = expiresAt;

    await this.userRepository.save(user);

    // Registro en log de auditoría
    await this.auditLogService.log(
      AuditAction.AUTH_2FA_REQUEST,
      userId,
      null,
      {
        action: action,
        expiresAt: expiresAt.toISOString(),
      },
      ipAddress,
      userAgent,
    );

    // Enviar correo con el código de verificación
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    try {
      await this.emailService.sendTemplateEmail({
        to: user.email,
        subject: 'Código de verificación para firma de documento',
        template: 'verification-code',
        context: {
          userName: user.name,
          verificationCode,
          expiresAt: expiresAt.toLocaleString(),
          action,
          frontendUrl,
        },
      });

      this.logger.log(
        `Código de verificación enviado a ${user.email} para ${action}`,
      );
      return { success: true, expiresAt };
    } catch (error) {
      this.logger.error(
        `Error enviando código de verificación por email: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Error enviando código de verificación');
    }
  }

  /**
   * Verifica un código de verificación ingresado por el usuario
   */
  async verifyCode(
    userId: string,
    code: string,
    action: string = 'firma',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    // Validar entradas
    if (!userId || !code) {
      throw new BadRequestException('Usuario y código son requeridos');
    }

    // Normalizar código (eliminar espacios y convertir a mayúsculas)
    const normalizedCode = code.replace(/\s/g, '').toUpperCase();

    // Buscar el usuario
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar que exista un código temporal
    if (!user.twoFactorTempSecret || !user.twoFactorTempSecretExpires) {
      throw new BadRequestException(
        'No hay un código de verificación pendiente',
      );
    }

    // Verificar si el código ha expirado
    const now = new Date();
    if (now > user.twoFactorTempSecretExpires) {
      // Limpiar código expirado
      user.twoFactorTempSecret = null;
      user.twoFactorTempSecretExpires = null;
      await this.userRepository.save(user);

      // Registrar intento fallido en auditoría
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_VERIFY,
        userId,
        null,
        {
          success: false,
          reason: 'expired_code',
          action,
        },
        ipAddress,
        userAgent,
      );

      throw new BadRequestException('El código de verificación ha expirado');
    }

    // Verificar el código (comparando los hashes)
    const inputCodeHash = this.hashVerificationCode(normalizedCode);
    const isValid = inputCodeHash === user.twoFactorTempSecret;

    // Si es válido, limpiar el código temporal
    if (isValid) {
      user.twoFactorTempSecret = null;
      user.twoFactorTempSecretExpires = null;
      await this.userRepository.save(user);

      // Registrar verificación exitosa
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_VERIFY,
        userId,
        null,
        {
          success: true,
          action,
        },
        ipAddress,
        userAgent,
      );
    } else {
      // Registrar intento fallido
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_VERIFY,
        userId,
        null,
        {
          success: false,
          reason: 'invalid_code',
          action,
        },
        ipAddress,
        userAgent,
      );

      throw new UnauthorizedException('Código de verificación inválido');
    }

    return isValid;
  }

  /**
   * Genera un código alfanumérico aleatorio
   */
  private generateVerificationCode(): string {
    // Caracteres permitidos (sin caracteres ambiguos como 0, O, 1, I, etc.)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    // Generar código aleatorio de la longitud especificada
    const randomBytes = crypto.randomBytes(this.CODE_LENGTH);
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      const randomIndex = randomBytes[i] % chars.length;
      code += chars.charAt(randomIndex);
    }

    return code;
  }

  /**
   * Crea un hash del código de verificación para almacenamiento seguro
   */
  private hashVerificationCode(code: string): string {
    // Usar un salt específico para los códigos de verificación
    const salt =
      this.configService.get<string>('TWO_FACTOR_SALT') ||
      'default-salt-change-in-production';

    // Crear hash con HMAC SHA-256
    return crypto
      .createHmac('sha256', salt)
      .update(code.toUpperCase())
      .digest('hex');
  }
}
