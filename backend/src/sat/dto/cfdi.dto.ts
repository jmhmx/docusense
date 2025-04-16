// backend/src/sat/dto/cfdi.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoCFDI {
  INGRESO = 'I',
  EGRESO = 'E',
  TRASLADO = 'T',
  NOMINA = 'N',
  PAGO = 'P',
}

export enum MetodoPago {
  PUE = 'PUE', // Pago en una sola exhibición
  PPD = 'PPD', // Pago en parcialidades o diferido
}

export enum FormaPago {
  EFECTIVO = '01',
  CHEQUE = '02',
  TRANSFERENCIA = '03',
  TARJETA_CREDITO = '04',
  // Agregar más formas de pago según el catálogo del SAT
}

export enum UsoCFDI {
  GASTOS_GENERAL = 'G03',
  ADQUISICION_MERCANCIAS = 'G01',
  // Agregar más usos según el catálogo del SAT
}

export class ConceptoDto {
  @IsNotEmpty()
  @IsString()
  claveProdServ: string;

  @IsOptional()
  @IsString()
  noIdentificacion: string;

  @IsNotEmpty()
  @IsNumber()
  cantidad: number;

  @IsNotEmpty()
  @IsString()
  claveUnidad: string;

  @IsOptional()
  @IsString()
  unidad: string;

  @IsNotEmpty()
  @IsString()
  descripcion: string;

  @IsNotEmpty()
  @IsNumber()
  valorUnitario: number;

  @IsNotEmpty()
  @IsNumber()
  importe: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpuestoConceptoDto)
  impuestos?: ImpuestoConceptoDto[];
}

export class ImpuestoConceptoDto {
  @IsNotEmpty()
  @IsString()
  impuesto: string; // IVA, ISR, IEPS

  @IsNotEmpty()
  @IsString()
  tipoFactor: string; // Tasa, Cuota, Exento

  @IsNotEmpty()
  @IsString()
  tasaOCuota: string;

  @IsNotEmpty()
  @IsNumber()
  importe: number;
}

export class EmisorDto {
  @IsNotEmpty()
  @IsString()
  rfc: string;

  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  regimenFiscal: string;
}

export class ReceptorDto {
  @IsNotEmpty()
  @IsString()
  rfc: string;

  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  usoCFDI: string;

  @IsOptional()
  @IsString()
  domicilioFiscalReceptor?: string;

  @IsOptional()
  @IsString()
  regimenFiscalReceptor?: string;
}

export class CreateCfdiDto {
  @IsNotEmpty()
  @IsEnum(TipoCFDI)
  tipoCFDI: TipoCFDI;

  @IsNotEmpty()
  @IsString()
  serie: string;

  @IsNotEmpty()
  @IsString()
  folio: string;

  @IsNotEmpty()
  @IsString()
  fecha: string; // Formato: YYYY-MM-DDThh:mm:ss

  @IsNotEmpty()
  @IsEnum(FormaPago)
  formaPago: FormaPago;

  @IsNotEmpty()
  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNotEmpty()
  @IsString()
  moneda: string;

  @IsOptional()
  @IsNumber()
  tipoCambio?: number;

  @IsNotEmpty()
  @IsNumber()
  subtotal: number;

  @IsNotEmpty()
  @IsNumber()
  total: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => EmisorDto)
  emisor: EmisorDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ReceptorDto)
  receptor: ReceptorDto;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConceptoDto)
  conceptos: ConceptoDto[];
}
