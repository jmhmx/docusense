import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PacService {
  private readonly logger = new Logger(PacService.name);
  private readonly pacUrl: string;
  private readonly pacUser: string;
  private readonly pacPassword: string;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    // Configuración para ambiente de pruebas (sandbox)
    this.isProduction =
      this.configService.get<string>('PAC_ENV', 'sandbox') === 'production';
    this.pacUrl = this.configService.get<string>(
      'PAC_URL',
      'https://sandbox.facturacion.example.com/api',
    );
    this.pacUser = this.configService.get<string>('PAC_USER', 'usuario_prueba');
    this.pacPassword = this.configService.get<string>(
      'PAC_PASSWORD',
      'password_prueba',
    );

    this.logger.log(
      `Inicializando servicio PAC en modo ${this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS'}`,
    );
  }

  /**
   * Realiza la autenticación con el servicio del PAC
   */
  async authenticate(): Promise<string> {
    try {
      const response = await axios.post(`${this.pacUrl}/auth`, {
        username: this.pacUser,
        password: this.pacPassword,
      });

      if (response.data?.token) {
        return response.data.token;
      }
      throw new BadRequestException(
        'No se recibió token de autenticación del PAC',
      );
    } catch (error) {
      this.logger.error(
        `Error de autenticación con PAC: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al autenticar con el PAC: ${error.message}`,
      );
    }
  }

  /**
   * Valida si el servicio PAC está disponible
   */
  async checkStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.pacUrl}/status`);
      return response.status === 200;
    } catch (error) {
      this.logger.error(
        `Error al verificar estatus del PAC: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Timbra un CFDI (versión prueba)
   */
  async timbrarCFDI(xmlContent: string): Promise<{
    success: boolean;
    uuid?: string;
    timbradoXml?: string;
    error?: string;
  }> {
    try {
      const token = await this.authenticate();

      const response = await axios.post(
        `${this.pacUrl}/timbrar`,
        { xml: xmlContent },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data?.success) {
        return {
          success: true,
          uuid: response.data.uuid,
          timbradoXml: response.data.xml,
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Error desconocido al timbrar CFDI',
      };
    } catch (error) {
      this.logger.error(`Error al timbrar CFDI: ${error.message}`, error.stack);
      return {
        success: false,
        error: `Error al timbrar CFDI: ${error.message}`,
      };
    }
  }

  /**
   * Cancela un CFDI previamente timbrado
   */
  async cancelarCFDI(uuid: string, motivo: string): Promise<boolean> {
    try {
      const token = await this.authenticate();

      const response = await axios.post(
        `${this.pacUrl}/cancelar`,
        {
          uuid,
          motivo,
          ambiente: this.isProduction ? 'produccion' : 'pruebas',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return response.data?.success === true;
    } catch (error) {
      this.logger.error(
        `Error al cancelar CFDI: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
