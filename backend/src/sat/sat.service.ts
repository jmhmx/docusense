import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateCfdiDto, TipoCFDI } from './dto/cfdi.dto';
import { CryptoService } from '../crypto/crypto.service';
import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';

@Injectable()
export class SatService {
  private readonly logger = new Logger(SatService.name);
  private readonly certificadosPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {
    this.certificadosPath = this.configService.get<string>(
      'SAT_CERTIFICADOS_PATH',
      path.join(process.cwd(), 'certificados'),
    );

    // Asegurar que el directorio existe
    if (!fs.existsSync(this.certificadosPath)) {
      fs.mkdirSync(this.certificadosPath, { recursive: true });
    }
  }

  /**
   * Convierte un objeto CFDI a XML según las especificaciones del SAT
   */
  async generarXML(cfdiData: CreateCfdiDto): Promise<string> {
    try {
      // Crear estructura XML base para CFDI 4.0
      const cfdi = {
        'cfdi:Comprobante': {
          $: {
            'xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:schemaLocation':
              'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
            Version: '4.0',
            Serie: cfdiData.serie,
            Folio: cfdiData.folio,
            Fecha: cfdiData.fecha,
            FormaPago: cfdiData.formaPago,
            MetodoPago: cfdiData.metodoPago,
            TipoDeComprobante: cfdiData.tipoCFDI,
            SubTotal: cfdiData.subtotal.toFixed(2),
            Moneda: cfdiData.moneda,
            Total: cfdiData.total.toFixed(2),
            Exportacion: '01', // No aplica (valor por defecto)
            LugarExpedicion: this.configService.get<string>(
              'SAT_LUGAR_EXPEDICION',
              '12345',
            ), // Código postal emisor
          },
          'cfdi:Emisor': {
            $: {
              Rfc: cfdiData.emisor.rfc,
              Nombre: cfdiData.emisor.nombre,
              RegimenFiscal: cfdiData.emisor.regimenFiscal,
            },
          },
          'cfdi:Receptor': {
            $: {
              Rfc: cfdiData.receptor.rfc,
              Nombre: cfdiData.receptor.nombre,
              UsoCFDI: cfdiData.receptor.usoCFDI,
              DomicilioFiscalReceptor:
                cfdiData.receptor.domicilioFiscalReceptor || '12345',
              RegimenFiscalReceptor:
                cfdiData.receptor.regimenFiscalReceptor || '601',
            },
          },
          'cfdi:Conceptos': {
            'cfdi:Concepto': cfdiData.conceptos.map((concepto) => {
              const conceptoXml: any = {
                $: {
                  ClaveProdServ: concepto.claveProdServ,
                  Cantidad: concepto.cantidad.toString(),
                  ClaveUnidad: concepto.claveUnidad,
                  Descripcion: concepto.descripcion,
                  ValorUnitario: concepto.valorUnitario.toFixed(2),
                  Importe: concepto.importe.toFixed(2),
                  ObjetoImp: '02', // Objeto de impuesto (sí es objeto de impuesto)
                },
              };

              if (concepto.noIdentificacion) {
                conceptoXml.$.NoIdentificacion = concepto.noIdentificacion;
              }

              if (concepto.unidad) {
                conceptoXml.$.Unidad = concepto.unidad;
              }

              // Agregar impuestos al concepto si existen
              if (concepto.impuestos && concepto.impuestos.length > 0) {
                conceptoXml['cfdi:Impuestos'] = {
                  'cfdi:Traslados': {
                    'cfdi:Traslado': concepto.impuestos.map((impuesto) => ({
                      $: {
                        Base: concepto.importe.toFixed(2),
                        Impuesto: impuesto.impuesto,
                        TipoFactor: impuesto.tipoFactor,
                        TasaOCuota: impuesto.tasaOCuota,
                        Importe: impuesto.importe.toFixed(2),
                      },
                    })),
                  },
                };
              }

              return conceptoXml;
            }),
          },
        },
      };

      // Calcular impuestos totales si hay conceptos con impuestos
      const conceptosConImpuestos = cfdiData.conceptos.filter(
        (c) => c.impuestos && c.impuestos.length > 0,
      );

      if (conceptosConImpuestos.length > 0) {
        const impuestosTotales: any = {
          'cfdi:Traslados': {
            'cfdi:Traslado': [],
          },
        };

        // Agregar impuestos agrupados por tipo
        const impuestosPorTipo = new Map();

        for (const concepto of cfdiData.conceptos) {
          if (concepto.impuestos) {
            for (const impuesto of concepto.impuestos) {
              const key = `${impuesto.impuesto}_${impuesto.tipoFactor}_${impuesto.tasaOCuota}`;
              const importeActual = impuestosPorTipo.get(key)?.importe || 0;

              impuestosPorTipo.set(key, {
                impuesto: impuesto.impuesto,
                tipoFactor: impuesto.tipoFactor,
                tasaOCuota: impuesto.tasaOCuota,
                importe: importeActual + impuesto.importe,
              });
            }
          }
        }

        // Convertir mapa a array para el XML
        for (const [_, impuesto] of impuestosPorTipo.entries()) {
          impuestosTotales['cfdi:Traslados']['cfdi:Traslado'].push({
            $: {
              Impuesto: impuesto.impuesto,
              TipoFactor: impuesto.tipoFactor,
              TasaOCuota: impuesto.tasaOCuota,
              Importe: impuesto.importe.toFixed(2),
              Base: cfdiData.subtotal.toFixed(2),
            },
          });
        }

        cfdi['cfdi:Comprobante']['cfdi:Impuestos'] = impuestosTotales;
      }

      // Crear el XML
      const builder = new xml2js.Builder({
        renderOpts: { pretty: true, indent: '  ', newline: '\n' },
        xmldec: { version: '1.0', encoding: 'UTF-8' },
      });

      return builder.buildObject(cfdi);
    } catch (error) {
      this.logger.error(
        `Error al generar XML para CFDI: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al generar XML para CFDI: ${error.message}`,
      );
    }
  }

  /**
   * Valida un certificado del SAT
   */
  async validarCertificadoSAT(certificadoPath: string): Promise<{
    valido: boolean;
    rfc?: string;
    fechaVigenciaInicio?: Date;
    fechaVigenciaFin?: Date;
    error?: string;
  }> {
    try {
      // Aquí irían las validaciones de certificados .cer del SAT
      // Para pruebas retornamos resultados simulados
      return {
        valido: true,
        rfc: 'TEST010101ABC',
        fechaVigenciaInicio: new Date('2023-01-01'),
        fechaVigenciaFin: new Date('2027-01-01'),
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
