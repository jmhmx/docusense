// backend/src/sat/efirma.service.ts - Versión mejorada
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class EfirmaService {
  private readonly logger = new Logger(EfirmaService.name);
  private readonly efirmaPath: string;
  private readonly tempPath: string;
  private readonly keyExpirationHours: number;

  constructor(private readonly configService: ConfigService) {
    this.efirmaPath = this.configService.get<string>(
      'EFIRMA_PATH',
      path.join(process.cwd(), 'efirma'),
    );
    this.tempPath = path.join(this.efirmaPath, 'temp');
    this.keyExpirationHours = this.configService.get<number>(
      'KEY_EXPIRATION_HOURS',
      24,
    );

    // Asegurar que los directorios existen
    if (!fs.existsSync(this.efirmaPath)) {
      fs.mkdirSync(this.efirmaPath, { recursive: true });
    }
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true });
    }
  }

  async firmarConEfirma(
    certificadoPEM: any,
    llavePEM: string,
    dataToSign: string,
  ): Promise<string> {
    try {
      // Validaciones de entrada
      if (!certificadoPEM) {
        throw new BadRequestException('Certificado no proporcionado');
      }

      if (!llavePEM || typeof llavePEM !== 'string') {
        throw new BadRequestException('Llave privada no válida');
      }

      if (!dataToSign) {
        throw new BadRequestException('No hay datos para firmar');
      }

      this.logger.log('Iniciando proceso de firma con e.firma');

      // Crear objeto de llave RSA con la llave privada
      let signingKey;
      try {
        signingKey = crypto.createPrivateKey({
          key: llavePEM,
          format: 'pem',
          type: 'pkcs8',
        });
      } catch (keyError) {
        this.logger.error(
          `Error al preparar llave privada: ${keyError.message}`,
        );
        throw new BadRequestException(
          'La llave privada no es válida o está dañada',
        );
      }

      // Firmar los datos usando algoritmo SHA-256 con RSA (estándar SAT)
      const sign = crypto.createSign('SHA256');
      sign.update(Buffer.from(dataToSign));
      sign.end();

      // Generar firma
      let signature;
      try {
        signature = sign.sign(signingKey, 'base64');
      } catch (signError) {
        this.logger.error(
          `Error durante el proceso de firma: ${signError.message}`,
        );
        throw new BadRequestException(
          `Error al generar firma: ${signError.message}`,
        );
      }

      this.logger.log('Firma generada exitosamente');
      return signature;
    } catch (error) {
      this.logger.error(
        `Error al firmar con e.firma: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Error al firmar con e.firma: ${error.message}`,
      );
    }
  }

  /**
   * Carga un certificado .cer y lo convierte a formato PEM
   */
  async cargarCertificado(
    userId: string,
    certificadoBuffer: Buffer,
    nombreOriginal: string,
  ): Promise<{
    certificadoPEM: string;
    rfc: string;
    nombreCertificado: string;
    vigenciaInicio: Date;
    vigenciaFin: Date;
  }> {
    try {
      // Crear carpeta para el usuario si no existe
      const userDir = path.join(this.tempPath, userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      // Crear nombre único para el archivo
      const timestamp = Date.now();
      const nombreCertificado = `${timestamp}_${path.basename(nombreOriginal)}`;
      const certificadoPath = path.join(userDir, nombreCertificado);

      // Guardar el archivo
      fs.writeFileSync(certificadoPath, certificadoBuffer);

      // Verificar que sea un archivo .cer válido (header DER)
      if (!this.verificarArchivoCer(certificadoBuffer)) {
        // Eliminar archivo inválido
        fs.unlinkSync(certificadoPath);
        throw new BadRequestException(
          'El archivo no es un certificado .cer válido',
        );
      }

      // Convertir DER a PEM
      const certificadoPEM = this.convertirDerAPem(certificadoBuffer);

      // Extraer información del certificado
      const infoCertificado = this.extraerInfoCertificado(certificadoPEM);

      // Programar eliminación del archivo después del tiempo configurado
      this.programarEliminacion(certificadoPath);

      return {
        certificadoPEM,
        rfc: infoCertificado.rfc,
        nombreCertificado,
        vigenciaInicio: infoCertificado.vigenciaInicio,
        vigenciaFin: infoCertificado.vigenciaFin,
      };
    } catch (error) {
      this.logger.error(
        `Error al cargar certificado: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al cargar certificado: ${error.message}`,
      );
    }
  }

  /**
   * Carga una llave privada .key y la desencripta con la contraseña
   */
  async cargarLlavePrivada(
    userId: string,
    llaveBuffer: Buffer,
    password: string,
    nombreOriginal: string,
  ): Promise<{
    llavePEM: string;
    nombreLlave: string;
  }> {
    try {
      // Validar contraseña
      if (!password || password.length < 6) {
        throw new BadRequestException(
          'La contraseña debe tener al menos 6 caracteres',
        );
      }

      // Crear carpeta para el usuario si no existe
      const userDir = path.join(this.tempPath, userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      // Crear nombre único para el archivo
      const timestamp = Date.now();
      const nombreLlave = `${timestamp}_${path.basename(nombreOriginal)}`;
      const llavePath = path.join(userDir, nombreLlave);

      // Guardar el archivo
      fs.writeFileSync(llavePath, llaveBuffer);

      // Verificar que sea un archivo .key válido (verificar firma PKCS#8)
      if (!this.verificarArchivoKey(llaveBuffer)) {
        // Eliminar archivo inválido
        fs.unlinkSync(llavePath);
        throw new BadRequestException('El archivo no es una llave .key válida');
      }

      // Desencriptar la llave con la contraseña
      const llavePEM = this.desencriptarLlave(llaveBuffer, password);

      // Verificar que la llave desencriptada sea válida
      if (!this.validarLlaveDesencriptada(llavePEM)) {
        throw new BadRequestException(
          'La contraseña proporcionada no es correcta',
        );
      }

      // Programar eliminación del archivo después del tiempo configurado
      this.programarEliminacion(llavePath);

      return {
        llavePEM,
        nombreLlave,
      };
    } catch (error) {
      this.logger.error(
        `Error al cargar llave privada: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al cargar llave privada: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si el archivo es un certificado .cer válido
   */
  private verificarArchivoCer(buffer: Buffer): boolean {
    // Verificar que comience con la secuencia DER correcta (30 82)
    if (buffer.length < 2) return false;

    // Verificar cabecera ASN.1 DER para certificados X.509
    return buffer[0] === 0x30 && buffer.length > 10;
  }

  /**
   * Verifica si el archivo es una llave .key válida
   */
  private verificarArchivoKey(buffer: Buffer): boolean {
    // Verificar tamaño mínimo
    if (buffer.length < 10) return false;

    // Las llaves PKCS#8 comienzan con secuencias específicas
    return true; // Implementación simplificada
  }

  /**
   * Convierte un certificado en formato DER a PEM
   */
  private convertirDerAPem(certificadoDER: Buffer): string {
    // Codificar a base64
    const base64 = certificadoDER.toString('base64');

    // Formatear como PEM con saltos de línea cada 64 caracteres
    const pemLines = [];
    for (let i = 0; i < base64.length; i += 64) {
      pemLines.push(base64.substring(i, i + 64));
    }

    return (
      '-----BEGIN CERTIFICATE-----\n' +
      pemLines.join('\n') +
      '\n-----END CERTIFICATE-----'
    );
  }

  /**
   * Desencripta una llave privada con la contraseña proporcionada
   */
  private desencriptarLlave(llaveEncriptada: Buffer, password: string): string {
    try {
      // Para el SAT (FIEL), las llaves están encriptadas con PKCS#8 usando algoritmo DES3
      // Implementación simplificada: en producción usar bibliotecas específicas para e.firma

      // 1. Extraer información de la llave encriptada
      // (En producción, extraer salt, IV, y determinar algoritmo)

      // 2. Derivar clave a partir de la contraseña
      const salt = llaveEncriptada.slice(16, 24); // Simplificado, extraer el salt real
      const derivedKey = crypto.pbkdf2Sync(password, salt, 2000, 24, 'sha1');

      // 3. Desencriptar usando DES3-CBC
      // Nota: En producción, usar ASN.1 decoder para extraer los parámetros reales
      try {
        const decipher = crypto.createDecipheriv(
          'des-ede3-cbc',
          derivedKey,
          salt.slice(0, 8),
        );

        // El offset 26 es aproximado, en producción debe analizarse la estructura ASN.1
        const dataEncriptada = llaveEncriptada.slice(26);

        // Desencriptar
        const desencriptado = Buffer.concat([
          decipher.update(dataEncriptada),
          decipher.final(),
        ]);

        // Convertir a formato PEM
        // (añadir encabezados PKCS#8)
        return (
          '-----BEGIN PRIVATE KEY-----\n' +
          desencriptado
            .toString('base64')
            .match(/.{1,64}/g)
            .join('\n') +
          '\n-----END PRIVATE KEY-----'
        );
      } catch (err) {
        this.logger.error(`Error en desencriptación: ${err.message}`);
        throw new BadRequestException(
          'Contraseña incorrecta o formato de llave inválido',
        );
      }
    } catch (error) {
      this.logger.error(`Error desencriptando llave: ${error.message}`);
      throw new BadRequestException(
        'No se pudo desencriptar la llave. Verifique la contraseña.',
      );
    }
  }

  /**
   * Extrae información de un certificado PEM
   */
  private extraerInfoCertificado(certificadoPEM: string): {
    rfc: string;
    vigenciaInicio: Date;
    vigenciaFin: Date;
  } {
    // Esta función debe extraer información del certificado PEM
    // En implementación real, usar node-forge, openssl o similar para parsear el certificado X.509

    // Simulación: En producción, extraer realmente estos datos
    return {
      rfc: 'XAXX010101000', // Placeholder
      vigenciaInicio: new Date(),
      vigenciaFin: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año (simulado)
    };
  }

  /**
   * Valida que la llave privada desencriptada sea correcta
   */
  private validarLlaveDesencriptada(llavePEM: string): boolean {
    try {
      // Verificar que la llave tenga el formato correcto de una llave RSA
      if (
        !llavePEM.includes('BEGIN PRIVATE KEY') ||
        !llavePEM.includes('END PRIVATE KEY')
      ) {
        return false;
      }

      // En producción, verificar si es posible crear un objeto de llave con crypto
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Programa la eliminación de un archivo después del tiempo configurado
   */
  private programarEliminacion(filePath: string): void {
    // Programar la eliminación del archivo
    setTimeout(
      () => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            this.logger.log(`Archivo temporal eliminado: ${filePath}`);
          }
        } catch (error) {
          this.logger.error(
            `Error al eliminar archivo temporal: ${error.message}`,
          );
        }
      },
      this.keyExpirationHours * 60 * 60 * 1000,
    ); // Convertir horas a milisegundos
  }

  /**
   * Verifica si un certificado y una llave privada corresponden entre sí
   */
  async verificarParCertificadoLlave(
    certificadoPEM: string,
    llavePEM: string,
  ): Promise<boolean> {
    try {
      // En producción, extraer la clave pública del certificado y verificar que corresponda a la llave privada
      // Implementación simplificada
      return true;
    } catch (error) {
      this.logger.error(`Error verificando par cert/llave: ${error.message}`);
      return false;
    }
  }

  /**
   * Limpia los archivos temporales más antiguos que el tiempo de expiración
   */
  async limpiarArchivosExpirados(): Promise<number> {
    try {
      let contadorEliminados = 0;
      const tiempoExpiracion =
        Date.now() - this.keyExpirationHours * 60 * 60 * 1000;

      // Recorrer directorios de usuarios
      const userDirs = fs.readdirSync(this.tempPath);
      for (const userId of userDirs) {
        const userPath = path.join(this.tempPath, userId);

        // Verificar que sea un directorio
        if (fs.statSync(userPath).isDirectory()) {
          const files = fs.readdirSync(userPath);

          for (const file of files) {
            const filePath = path.join(userPath, file);
            const stats = fs.statSync(filePath);

            // Si el archivo es más antiguo que el tiempo de expiración, eliminarlo
            if (stats.mtimeMs < tiempoExpiracion) {
              fs.unlinkSync(filePath);
              contadorEliminados++;
            }
          }

          // Eliminar directorio si está vacío
          if (fs.readdirSync(userPath).length === 0) {
            fs.rmdirSync(userPath);
          }
        }
      }

      return contadorEliminados;
    } catch (error) {
      this.logger.error(`Error limpiando archivos expirados: ${error.message}`);
      return 0;
    }
  }

  /**
   * Valida un certificado .cer verificando vigencia y revocación
   */
  async validarCertificado(certificadoPEM: string): Promise<{
    valido: boolean;
    rfc: string;
    razonSocial: string;
    vigenciaInicio: Date;
    vigenciaFin: Date;
    noRevocado: boolean;
    detalles?: string;
  }> {
    try {
      // 1. Extraer información del certificado
      const infoExtraida =
        await this.extraerInfoCertificadoDetallada(certificadoPEM);

      // 2. Verificar fechas de vigencia
      const ahora = new Date();
      const vigenciaInvalida =
        ahora < infoExtraida.vigenciaInicio || ahora > infoExtraida.vigenciaFin;

      if (vigenciaInvalida) {
        return {
          valido: false,
          rfc: infoExtraida.rfc,
          razonSocial: infoExtraida.razonSocial,
          vigenciaInicio: infoExtraida.vigenciaInicio,
          vigenciaFin: infoExtraida.vigenciaFin,
          noRevocado: false,
          detalles: 'Certificado fuera de vigencia',
        };
      }

      // 3. Verificar revocación
      const noRevocado = await this.verificarCertificadoNoRevocado(
        infoExtraida.serialNumber,
      );

      return {
        valido: noRevocado,
        rfc: infoExtraida.rfc,
        razonSocial: infoExtraida.razonSocial,
        vigenciaInicio: infoExtraida.vigenciaInicio,
        vigenciaFin: infoExtraida.vigenciaFin,
        noRevocado,
        detalles: noRevocado ? undefined : 'Certificado revocado',
      };
    } catch (error) {
      this.logger.error(
        `Error validando certificado: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error validando certificado: ${error.message}`,
      );
    }
  }

  /**
   * Extrae información detallada de un certificado PEM
   */
  private async extraerInfoCertificadoDetallada(
    certificadoPEM: string,
  ): Promise<{
    rfc: string;
    razonSocial: string;
    vigenciaInicio: Date;
    vigenciaFin: Date;
    serialNumber: string;
    issuer: string;
  }> {
    try {
      // En una implementación real, usaríamos node-forge o similar
      // para extraer todos los detalles del certificado X.509

      // Extraer Subject del certificado - donde está el RFC
      const certificado = crypto.createPublicKey({
        key: certificadoPEM,
        format: 'pem',
      });

      // Convertir a DER para manipularlo
      const derBuffer = certificado.export({ format: 'der', type: 'spki' });

      // Aquí insertaríamos código para analizar ASN.1 y extraer campos específicos
      // En este ejemplo simulado, extraemos valores fijos

      return {
        rfc: 'ABC010101XYZ', // En realidad extraído del subject
        razonSocial: 'EMPRESA DE PRUEBAS SA DE CV', // Del subject CN
        vigenciaInicio: new Date('2023-01-01'), // notBefore
        vigenciaFin: new Date('2027-01-01'), // notAfter
        serialNumber: '12345678', // Número de serie
        issuer: 'AC del SAT', // Emisor del certificado
      };
    } catch (error) {
      this.logger.error(
        `Error extrayendo información del certificado: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al extraer información del certificado: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si un certificado está revocado consultando la LCR del SAT
   */
  private async verificarCertificadoNoRevocado(
    serialNumber: string,
  ): Promise<boolean> {
    try {
      // En producción, esta función consultaría la Lista de Certificados Revocados (LCR)
      // del SAT, ya sea descargando la LCR o usando un servicio OCSP

      // Ejemplo simulado: consultar API de SAT para verificar revocación
      // const response = await axios.get(`https://www.sat.gob.mx/lcrapi/check?sn=${serialNumber}`);
      // return response.data.status === 'valid';

      // Para desarrollo, siempre devuelve válido
      return true;
    } catch (error) {
      this.logger.error(
        `Error verificando revocación: ${error.message}`,
        error.stack,
      );
      // En caso de error, asumimos que no podemos verificar, así que rechazamos
      return false;
    }
  }
}
