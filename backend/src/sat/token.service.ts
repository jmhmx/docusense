import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface TokenData {
  userId: string;
  certificado: {
    serialNumber: string;
    rfc: string;
  };
  llave: string;
  expiresAt: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly tokensPath: string;
  private readonly secretKey: Buffer;
  private readonly tokenExpirationMinutes: number;

  constructor(private readonly configService: ConfigService) {
    this.tokensPath = this.configService.get<string>(
      'TOKENS_PATH',
      path.join(process.cwd(), 'tokens'),
    );

    this.tokenExpirationMinutes = this.configService.get<number>(
      'TOKEN_EXPIRATION_MINUTES',
      60,
    );

    // Obtener clave secreta para cifrar tokens
    const secretKeyStr = this.configService.get<string>('TOKEN_SECRET_KEY');
    if (secretKeyStr) {
      this.secretKey = Buffer.from(secretKeyStr, 'hex');
    } else {
      // Generar clave aleatoria (solo para desarrollo)
      this.secretKey = crypto.randomBytes(32);
      this.logger.warn(
        'ADVERTENCIA: No se ha configurado TOKEN_SECRET_KEY, usando clave aleatoria temporal',
      );
    }

    // Crear directorio de tokens si no existe
    this.ensureTokenDirectory();
  }

  /**
   * Asegura que el directorio de tokens existe con los permisos adecuados
   */
  private ensureTokenDirectory(): void {
    try {
      if (!fs.existsSync(this.tokensPath)) {
        fs.mkdirSync(this.tokensPath, { recursive: true, mode: 0o700 });
        this.logger.log(`Directorio de tokens creado: ${this.tokensPath}`);
      }

      // Verificar permisos del directorio
      const stats = fs.statSync(this.tokensPath);
      if (!stats.isDirectory()) {
        throw new Error(
          `La ruta de tokens existe pero no es un directorio: ${this.tokensPath}`,
        );
      }

      // Log de verificación
      this.logger.log(`Directorio de tokens verificado: ${this.tokensPath}`);
    } catch (error) {
      this.logger.error(
        `Error al verificar/crear directorio de tokens: ${error.message}`,
        error.stack,
      );
      // No lanzar excepción para permitir que el servicio inicie, pero loguear el error
    }
  }

  /**
   * Crea un token de sesión para uso de e.firma
   */
  async createToken(
    userId: string,
    certificado: string,
    llave: string,
  ): Promise<string> {
    try {
      if (!userId || !certificado || !llave) {
        throw new BadRequestException(
          'userId, certificado y llave son requeridos',
        );
      }

      // Datos a cifrar
      const tokenData: TokenData = {
        userId,
        certificado: {
          serialNumber: '123456',
          rfc: 'ABC123456XYZ',
        },
        llave,
        expiresAt: Date.now() + this.tokenExpirationMinutes * 60 * 1000,
      };

      // Generar token
      const tokenId = crypto.randomBytes(16).toString('hex');

      // Cifrar datos
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.secretKey, iv);

      const encryptedData = Buffer.concat([
        cipher.update(JSON.stringify(tokenData), 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      // Asegurar que el directorio existe
      this.ensureTokenDirectory();

      // Guardar token cifrado
      const tokenFile = path.join(this.tokensPath, `${tokenId}.token`);

      // Formato: iv + authTag + encryptedData
      const tokenBuffer = Buffer.concat([iv, authTag, encryptedData]);

      fs.writeFileSync(tokenFile, tokenBuffer, { mode: 0o600 });
      this.logger.log(`Token creado para usuario ${userId}: ${tokenId}`);

      // Programar eliminación del token
      this.scheduleTokenDeletion(tokenId);

      return tokenId;
    } catch (error) {
      this.logger.error(`Error creando token: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('No se pudo crear el token de sesión');
    }
  }

  /**
   * Obtiene los datos de un token
   */
  async getTokenData(tokenId: string): Promise<TokenData> {
    if (!tokenId) {
      throw new BadRequestException('Se requiere tokenId');
    }

    try {
      // Validar formato de tokenId para evitar path traversal
      if (!/^[a-f0-9]+$/.test(tokenId)) {
        throw new BadRequestException('Formato de token inválido');
      }

      const tokenFile = path.join(this.tokensPath, `${tokenId}.token`);

      // Verificar que existe con mensaje detallado
      if (!fs.existsSync(tokenFile)) {
        this.logger.warn(`Token no encontrado: ${tokenId}`);
        throw new UnauthorizedException(
          'Token no encontrado. Genera un nuevo token.',
        );
      }

      // Leer y descifrar
      const tokenBuffer = fs.readFileSync(tokenFile);

      // Verificar tamaño mínimo del buffer
      if (tokenBuffer.length < 32) {
        // 16 bytes IV + 16 bytes authTag mínimo
        throw new BadRequestException('Archivo de token corrupto');
      }

      // Extraer iv, authTag y datos cifrados
      const iv = tokenBuffer.slice(0, 16);
      const authTag = tokenBuffer.slice(16, 32);
      const encryptedData = tokenBuffer.slice(32);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.secretKey,
        iv,
      );

      try {
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
          decipher.update(encryptedData),
          decipher.final(),
        ]).toString('utf8');

        const tokenData: TokenData = JSON.parse(decrypted);

        // Verificar expiración con mensaje más específico
        if (tokenData.expiresAt < Date.now()) {
          // Calcular cuánto tiempo ha pasado
          const expirationTime = new Date(tokenData.expiresAt);
          const currentTime = new Date();
          const minutesExpired = Math.floor(
            (currentTime.getTime() - expirationTime.getTime()) / 60000,
          );

          // Eliminar token expirado
          fs.unlinkSync(tokenFile);
          this.logger.warn(
            `Token expirado hace ${minutesExpired} minutos: ${tokenId}`,
          );
          throw new UnauthorizedException(
            `Token expirado hace ${minutesExpired} minutos. Por favor genera un nuevo token.`,
          );
        }

        return tokenData;
      } catch (cryptoError) {
        throw new BadRequestException(
          `Error al descifrar token: ${cryptoError.message}`,
        );
      }
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error obteniendo datos del token: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException(
        'Token inválido. Por favor genera un nuevo token.',
      );
    }
  }

  /**
   * Invalida un token
   */
  async invalidateToken(tokenId: string): Promise<void> {
    if (!tokenId) {
      throw new BadRequestException('Se requiere tokenId');
    }

    try {
      // Validar formato de tokenId para evitar path traversal
      if (!/^[a-f0-9]+$/.test(tokenId)) {
        throw new BadRequestException('Formato de token inválido');
      }

      const tokenFile = path.join(this.tokensPath, `${tokenId}.token`);

      if (fs.existsSync(tokenFile)) {
        fs.unlinkSync(tokenFile);
        this.logger.log(`Token invalidado: ${tokenId}`);
      } else {
        this.logger.warn(
          `Intento de invalidar un token inexistente: ${tokenId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error invalidando token: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al invalidar token: ${error.message}`,
      );
    }
  }

  /**
   * Programa eliminación de token
   */
  private scheduleTokenDeletion(tokenId: string): void {
    setTimeout(
      () => {
        this.invalidateToken(tokenId).catch((err) =>
          this.logger.error(
            `Error en eliminación programada de token: ${err.message}`,
          ),
        );
      },
      this.tokenExpirationMinutes * 60 * 1000,
    );
  }

  /**
   * Limpia tokens expirados
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      let deletedCount = 0;

      // Verificar que el directorio existe
      if (!fs.existsSync(this.tokensPath)) {
        return 0;
      }

      const files = fs.readdirSync(this.tokensPath);

      for (const file of files) {
        if (file.endsWith('.token')) {
          const tokenId = file.replace('.token', '');

          try {
            // Intentar obtener los datos (esto eliminará tokens expirados)
            await this.getTokenData(tokenId);
          } catch (error) {
            // Si hay error, el token fue eliminado o es inválido
            deletedCount++;
          }
        }
      }

      this.logger.log(`Limpieza completada: ${deletedCount} tokens eliminados`);
      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Error limpiando tokens expirados: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }
}
