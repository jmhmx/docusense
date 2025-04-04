import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly keyStorePath = process.env.KEY_STORE_PATH || 'keys';

  constructor() {
    // Asegurar que existe el directorio para almacenar las claves
    if (!fs.existsSync(this.keyStorePath)) {
      fs.mkdirSync(this.keyStorePath, { recursive: true });
      this.logger.log(`Directorio de claves creado: ${this.keyStorePath}`);
    }
  }

  /**
   * Genera un par de claves RSA
   */
  generateKeyPair(userId: string): Promise<KeyPair> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            this.logger.error(
              `Error generando claves para userId=${userId}: ${err.message}`,
            );
            return reject(err);
          }

          // Guardar las claves en el almacén
          this.storeKeyPair(userId, { publicKey, privateKey })
            .then(() => {
              this.logger.log(`Par de claves generado para userId=${userId}`);
              resolve({ publicKey, privateKey });
            })
            .catch(reject);
        },
      );
    });
  }

  /**
   * Almacena un par de claves para un usuario
   */
  async storeKeyPair(userId: string, keyPair: KeyPair): Promise<void> {
    const userKeyDir = path.join(this.keyStorePath, userId);

    if (!fs.existsSync(userKeyDir)) {
      fs.mkdirSync(userKeyDir, { recursive: true });
    }

    // Guardar clave pública
    await fs.promises.writeFile(
      path.join(userKeyDir, 'public.pem'),
      keyPair.publicKey,
      'utf8',
    );

    // Guardar clave privada (en un entorno real, debería estar cifrada)
    await fs.promises.writeFile(
      path.join(userKeyDir, 'private.pem'),
      keyPair.privateKey,
      'utf8',
    );

    this.logger.log(`Claves almacenadas para userId=${userId}`);
  }

  /**
   * Recupera el par de claves de un usuario
   */
  async getUserKeyPair(userId: string): Promise<KeyPair | null> {
    const userKeyDir = path.join(this.keyStorePath, userId);

    if (!fs.existsSync(userKeyDir)) {
      return null;
    }

    try {
      const publicKey = await fs.promises.readFile(
        path.join(userKeyDir, 'public.pem'),
        'utf8',
      );
      const privateKey = await fs.promises.readFile(
        path.join(userKeyDir, 'private.pem'),
        'utf8',
      );

      return { publicKey, privateKey };
    } catch (error) {
      this.logger.error(
        `Error recuperando claves para userId=${userId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Recupera solo la clave pública de un usuario
   */
  async getUserPublicKey(userId: string): Promise<string | null> {
    const userKeyDir = path.join(this.keyStorePath, userId);
    const publicKeyPath = path.join(userKeyDir, 'public.pem');

    if (!fs.existsSync(publicKeyPath)) {
      return null;
    }

    try {
      return await fs.promises.readFile(publicKeyPath, 'utf8');
    } catch (error) {
      this.logger.error(
        `Error recuperando clave pública para userId=${userId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Firma un mensaje o documento con la clave privada del usuario
   */
  async signData(
    userId: string,
    data: string | Buffer,
  ): Promise<string | null> {
    const keyPair = await this.getUserKeyPair(userId);

    if (!keyPair) {
      this.logger.warn(`No hay claves disponibles para userId=${userId}`);
      return null;
    }

    try {
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      const signature = sign.sign(keyPair.privateKey, 'base64');

      this.logger.log(`Datos firmados correctamente para userId=${userId}`);
      return signature;
    } catch (error) {
      this.logger.error(
        `Error firmando datos para userId=${userId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Verifica la firma de un mensaje o documento
   */
  async verifySignature(
    userId: string,
    data: string | Buffer,
    signature: string,
  ): Promise<boolean> {
    const publicKey = await this.getUserPublicKey(userId);

    if (!publicKey) {
      this.logger.warn(`No hay clave pública disponible para userId=${userId}`);
      return false;
    }

    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      const isValid = verify.verify(publicKey, signature, 'base64');

      this.logger.log(
        `Verificación de firma para userId=${userId}: ${isValid ? 'válida' : 'inválida'}`,
      );
      return isValid;
    } catch (error) {
      this.logger.error(
        `Error verificando firma para userId=${userId}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Cifra datos usando la clave pública del usuario (para uso entre usuarios)
   */
  async encryptForUser(
    targetUserId: string,
    data: string,
  ): Promise<string | null> {
    const publicKey = await this.getUserPublicKey(targetUserId);

    if (!publicKey) {
      this.logger.warn(
        `No hay clave pública disponible para userId=${targetUserId}`,
      );
      return null;
    }

    try {
      // RSA solo puede cifrar datos limitados, en producción se usaría cifrado híbrido
      const encryptedData = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(data, 'utf8'),
      );

      return encryptedData.toString('base64');
    } catch (error) {
      this.logger.error(
        `Error cifrando datos para userId=${targetUserId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Descifra datos usando la clave privada del usuario
   */
  async decryptForUser(
    userId: string,
    encryptedData: string,
  ): Promise<string | null> {
    const keyPair = await this.getUserKeyPair(userId);

    if (!keyPair) {
      this.logger.warn(`No hay claves disponibles para userId=${userId}`);
      return null;
    }

    try {
      const decryptedData = crypto.privateDecrypt(
        {
          key: keyPair.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(encryptedData, 'base64'),
      );

      return decryptedData.toString('utf8');
    } catch (error) {
      this.logger.error(
        `Error descifrando datos para userId=${userId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Cifra datos con AES para documentos grandes
   * Retorna la clave y los datos cifrados
   */
  encryptDocument(data: Buffer): {
    encryptedData: Buffer;
    key: Buffer;
    iv: Buffer;
  } {
    // Generar clave aleatoria y vector de inicialización
    const key = crypto.randomBytes(32); // AES-256
    const iv = crypto.randomBytes(16); // Vector de inicialización

    // Crear cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    // Cifrar datos
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);

    return { encryptedData, key, iv };
  }

  /**
   * Descifra datos AES
   */
  decryptDocument(encryptedData: Buffer, key: Buffer, iv: Buffer): Buffer {
    // Crear decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    // Descifrar datos
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }

  /**
   * Genera un hash SHA-256 de los datos
   */
  generateHash(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
