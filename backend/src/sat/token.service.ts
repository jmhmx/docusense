// backend/src/sat/token.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface TokenData {
  userId: string;
  certificado: string;
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
      30,
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
    if (!fs.existsSync(this.tokensPath)) {
      fs.mkdirSync(this.tokensPath, { recursive: true });
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
      // Datos a cifrar
      const tokenData: TokenData = {
        userId,
        certificado,
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

      // Guardar token cifrado
      const tokenFile = path.join(this.tokensPath, `${tokenId}.token`);

      // Formato: iv + authTag + encryptedData
      const tokenBuffer = Buffer.concat([iv, authTag, encryptedData]);

      fs.writeFileSync(tokenFile, tokenBuffer);

      // Programar eliminación del token
      this.scheduleTokenDeletion(tokenId);

      return tokenId;
    } catch (error) {
      this.logger.error(`Error creando token: ${error.message}`, error.stack);
      throw new Error('No se pudo crear el token de sesión');
    }
  }

  /**
   * Obtiene los datos de un token
   */
  async getTokenData(tokenId: string): Promise<TokenData> {
    try {
      const tokenFile = path.join(this.tokensPath, `${tokenId}.token`);

      // Verificar que existe
      if (!fs.existsSync(tokenFile)) {
        throw new UnauthorizedException('Token no válido o expirado');
      }

      // Leer y descifrar
      const tokenBuffer = fs.readFileSync(tokenFile);

      // Extraer iv, authTag y datos cifrados
      const iv = tokenBuffer.slice(0, 16);
      const authTag = tokenBuffer.slice(16, 32);
      const encryptedData = tokenBuffer.slice(32);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.secretKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]).toString('utf8');

      const tokenData: TokenData = JSON.parse(decrypted);

      // Verificar expiración
      if (tokenData.expiresAt < Date.now()) {
        // Eliminar token expirado
        fs.unlinkSync(tokenFile);
        throw new UnauthorizedException('Token expirado');
      }

      return tokenData;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `Error obteniendo datos del token: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException('Token inválido');
    }
  }

  /**
   * Invalida un token
   */
  async invalidateToken(tokenId: string): Promise<void> {
    try {
      const tokenFile = path.join(this.tokensPath, `${tokenId}.token`);

      if (fs.existsSync(tokenFile)) {
        fs.unlinkSync(tokenFile);
        this.logger.log(`Token invalidado: ${tokenId}`);
      }
    } catch (error) {
      this.logger.error(
        `Error invalidando token: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Programa eliminación de token
   */
  private scheduleTokenDeletion(tokenId: string): void {
    setTimeout(
      () => {
        this.invalidateToken(tokenId);
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
