import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface GeoLocation {
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
}

@Injectable()
export class GeoLocationService {
  private readonly logger = new Logger(GeoLocationService.name);
  private readonly defaultTimeout = 3000; // 3 segundos para evitar retardos en el flujo principal

  constructor(private configService: ConfigService) {}

  /**
   * Obtiene información de geolocalización basada en una dirección IP
   * Usa un servicio gratuito, pero en producción podría usarse un servicio pago más preciso
   * @param ipAddress Dirección IP
   * @returns Información de geolocalización o null si ocurre un error
   */
  async getLocationFromIp(ipAddress: string): Promise<GeoLocation | null> {
    // No procesar IPs locales/privadas
    if (
      !ipAddress ||
      ipAddress === '127.0.0.1' ||
      ipAddress === 'localhost' ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('172.16.')
    ) {
      return {
        country: 'Local',
        city: 'Local',
        regionName: 'Local Network',
      };
    }

    try {
      // Usar un servicio gratuito para geolocalización de IP
      // En producción, recomendaría un servicio comercial como MaxMind o IPstack
      const apiKey = this.configService.get<string>('GEOLOCATION_API_KEY');

      // Si hay un API key configurado, usamos un servicio premium
      if (apiKey) {
        const response = await axios.get(
          `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${ipAddress}`,
          { timeout: this.defaultTimeout },
        );

        if (response.status === 200 && response.data) {
          return {
            country: response.data.country_name,
            countryCode: response.data.country_code2,
            region: response.data.state_prov,
            regionName: response.data.state_prov,
            city: response.data.city,
            zip: response.data.zipcode,
            lat: response.data.latitude,
            lon: response.data.longitude,
            timezone: response.data.time_zone?.name,
            isp: response.data.isp,
            org: response.data.organization,
          };
        }
      } else {
        // Fallback a un servicio gratuito sin API key
        const response = await axios.get(
          `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org`,
          { timeout: this.defaultTimeout },
        );

        if (
          response.status === 200 &&
          response.data &&
          response.data.status === 'success'
        ) {
          return response.data;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Error obteniendo geolocalización para IP ${ipAddress}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Versión más básica para desarrollo/testing que no hace peticiones externas
   * @param ipAddress Dirección IP
   * @returns Información aproximada basada en rangos de IP conocidos
   */
  getBasicLocationFromIp(ipAddress: string): GeoLocation {
    // Implementación simplificada para desarrollo/testing
    // En un sistema real, se usaría la API de geolocalización

    if (
      !ipAddress ||
      ipAddress === '127.0.0.1' ||
      ipAddress.startsWith('192.168.')
    ) {
      return {
        country: 'Local',
        countryCode: 'LO',
        city: 'Local',
        regionName: 'Development',
      };
    }

    // Simular algunos rangos conocidos (esto es sólo para ejemplificar)
    if (ipAddress.startsWith('189.')) {
      return {
        country: 'México',
        countryCode: 'MX',
        regionName: 'Ciudad de México',
        city: 'Ciudad de México',
        timezone: 'America/Mexico_City',
      };
    }

    if (ipAddress.startsWith('74.')) {
      return {
        country: 'United States',
        countryCode: 'US',
        regionName: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      };
    }

    // Información genérica si no coincide con ningún rango conocido
    return {
      country: 'Unknown',
      countryCode: 'XX',
      regionName: 'Unknown',
      city: 'Unknown',
    };
  }
}
