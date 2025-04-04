import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { UsersService } from '../../users/users.service';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly codeExpirationMs = 10 * 60 * 1000; // 10 minutos
  private readonly verificationCodes: Map<
    string,
    { code: string; expiresAt: Date }
  > = new Map();

  constructor(private readonly usersService: UsersService) {}

  /**
   * Genera un código de verificación para el usuario
   */
  async generateVerificationCode(userId: string): Promise<string> {
    // Obtener usuario
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }

    // Generar código de 6 dígitos
    const code = this.generateRandomCode();
    const expiresAt = new Date(Date.now() + this.codeExpirationMs);

    // Almacenar código (en un sistema real, se enviaría por SMS o email)
    this.verificationCodes.set(userId, { code, expiresAt });

    this.logger.log(
      `Código de verificación generado para ${user.email} (${userId}): ${code}`,
    );

    // En un entorno real, enviar el código al usuario
    // this.notificationsService.sendSms(user.phone, `Tu código de verificación es: ${code}`);
    // O
    // this.notificationsService.sendEmail(user.email, 'Código de verificación', `Tu código es: ${code}`);

    return code;
  }

  /**
   * Verifica el código proporcionado
   */
  verifyCode(userId: string, code: string): boolean {
    const verificationData = this.verificationCodes.get(userId);

    if (!verificationData) {
      this.logger.warn(`No hay código de verificación para userId=${userId}`);
      return false;
    }

    // Verificar expiración
    if (new Date() > verificationData.expiresAt) {
      this.logger.warn(`Código de verificación expirado para userId=${userId}`);
      this.verificationCodes.delete(userId);
      return false;
    }

    // Verificar código
    const isValid = verificationData.code === code;

    if (isValid) {
      // Eliminar código usado
      this.verificationCodes.delete(userId);
      this.logger.log(`Código de verificación válido para userId=${userId}`);
    } else {
      this.logger.warn(`Código de verificación inválido para userId=${userId}`);
    }

    return isValid;
  }

  /**
   * Genera un código aleatorio de 6 dígitos
   */
  private generateRandomCode(): string {
    // Generar número aleatorio de 6 dígitos
    return crypto.randomInt(100000, 999999).toString();
  }
}
