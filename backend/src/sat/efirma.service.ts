import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class EfirmaService {
  private readonly logger = new Logger(EfirmaService.name);
  private readonly efirmaPath: string;

  constructor(private readonly configService: ConfigService) {
    this.efirmaPath = this.configService.get<string>(
      'EFIRMA_PATH',
      path.join(process.cwd(), 'efirma'),
    );

    // Asegurar que el directorio existe
    if (!fs.existsSync(this.efirmaPath)) {
      fs.mkdirSync(this.efirmaPath, { recursive: true });
    }
  }

  /**
   * Carga un certificado .cer y lo convierte a formato PEM
   */
  async cargarCertificado(
    userId: string,
    certificadoNombre: string,
  ): Promise<string> {
    try {
      const userEfirmaPath = path.join(this.efirmaPath, userId);

      if (!fs.existsSync(userEfirmaPath)) {
        fs.mkdirSync(userEfirmaPath, { recursive: true });
      }

      const certificadoPath = path.join(userEfirmaPath, certificadoNombre);

      if (!fs.existsSync(certificadoPath)) {
        throw new BadRequestException(
          `El certificado ${certificadoNombre} no existe`,
        );
      }

      // Leer certificado y convertir a PEM
      const certificadoDER = fs.readFileSync(certificadoPath);
      const certificadoPEM =
        '-----BEGIN CERTIFICATE-----\n' +
        certificadoDER
          .toString('base64')
          .match(/.{1,64}/g)
          .join('\n') +
        '\n-----END CERTIFICATE-----';

      return certificadoPEM;
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
    llaveNombre: string,
    password: string,
  ): Promise<string> {
    try {
      const userEfirmaPath = path.join(this.efirmaPath, userId);

      if (!fs.existsSync(userEfirmaPath)) {
        fs.mkdirSync(userEfirmaPath, { recursive: true });
      }

      const llavePath = path.join(userEfirmaPath, llaveNombre);

      if (!fs.existsSync(llavePath)) {
        throw new BadRequestException(
          `La llave privada ${llaveNombre} no existe`,
        );
      }

      // Leer llave encriptada
      const llaveEncriptada = fs.readFileSync(llavePath);

      // Desencriptar llave (en producción, usar bibliotecas específicas para e.firma)
      // Esto es solo una simulación
      const llaveDesencriptada = crypto
        .createHmac('sha256', password)
        .update(llaveEncriptada)
        .digest('base64');

      // En un caso real, se desencriptaría la llave y se convertiría a formato PEM
      const llavePEM =
        '-----BEGIN PRIVATE KEY-----\n' +
        llaveDesencriptada.match(/.{1,64}/g).join('\n') +
        '\n-----END PRIVATE KEY-----';

      return llavePEM;
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
   * Firma un XML de CFDI con la e.firma
   */
  async firmarCFDI(
    xml: string,
    certificado: string,
    llavePrivada: string,
  ): Promise<string> {
    try {
      // Extraer la cadena original del CFDI (simulado)
      const cadenaOriginal = `||4.0|${Date.now()}|I|...||`;

      // Firmar la cadena original con la llave privada
      const sign = crypto.createSign('sha256');
      sign.update(cadenaOriginal);
      const firma = sign.sign({ key: llavePrivada }, 'base64');

      // En un caso real, se insertaría la firma en el XML
      // Este es un ejemplo simplificado
      const xmlConFirma = xml.replace(
        '</cfdi:Comprobante>',
        `  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
      xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      xsi:schemaLocation="http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd"
      Version="1.1"
      UUID="12345678-1234-1234-1234-123456789012"
      FechaTimbrado="${new Date().toISOString()}"
      SelloCFD="${firma.substring(0, 100)}..."
      NoCertificadoSAT="00001000000501234567"
      SelloSAT="SIMULACION_SELLO_SAT" />
  </cfdi:Complemento>
</cfdi:Comprobante>`,
      );

      return xmlConFirma;
    } catch (error) {
      this.logger.error(`Error al firmar CFDI: ${error.message}`, error.stack);
      throw new BadRequestException(`Error al firmar CFDI: ${error.message}`);
    }
  }

  /**
   * Valida un certificado e.firma (CSD)
   */
  async validarCertificado(certificado: string): Promise<{
    valido: boolean;
    rfc?: string;
    nombre?: string;
    vigenciaInicio?: Date;
    vigenciaFin?: Date;
    error?: string;
  }> {
    try {
      // Extraer información del certificado (simulado)
      // En un caso real, se extraería la información del certificado X509

      return {
        valido: true,
        rfc: 'TEST010101ABC',
        nombre: 'CERTIFICADO DE PRUEBA',
        vigenciaInicio: new Date('2023-01-01'),
        vigenciaFin: new Date('2027-01-01'),
      };
    } catch (error) {
      this.logger.error(
        `Error al validar certificado: ${error.message}`,
        error.stack,
      );
      return {
        valido: false,
        error: `Error al validar certificado: ${error.message}`,
      };
    }
  }
}
