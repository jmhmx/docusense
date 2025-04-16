// backend/src/sat/sat.controller.ts (actualizado)
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SatService } from './sat.service';
import { PacService } from './pac.service';
import { EfirmaService } from './efirma.service';
import { CreateCfdiDto } from './dto/cfdi.dto';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api/sat')
export class SatController {
  constructor(
    private readonly satService: SatService,
    private readonly pacService: PacService,
    private readonly efirmaService: EfirmaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('cfdi/generar')
  async generarCFDI(@Body() createCfdiDto: CreateCfdiDto) {
    try {
      const xmlContent = await this.satService.generarXML(createCfdiDto);

      return {
        success: true,
        xml: xmlContent,
      };
    } catch (error) {
      throw new BadRequestException(`Error al generar CFDI: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('cfdi/timbrar')
  async timbrarCFDI(@Body() { xml }: { xml: string }) {
    try {
      const resultado = await this.pacService.timbrarCFDI(xml);
      return resultado;
    } catch (error) {
      throw new BadRequestException(`Error al timbrar CFDI: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('efirma/subir-certificado')
  @UseInterceptors(FileInterceptor('certificado'))
  async subirCertificado(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se ha subido ningún archivo de certificado',
      );
    }

    try {
      const userId = req.user.id;
      const fileName = `${Date.now()}_${file.originalname}`;
      const savePath = path.join('efirma', userId, fileName);
      const dir = path.dirname(savePath);

      // Crear directorio si no existe
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Guardar el archivo
      fs.writeFileSync(savePath, file.buffer);

      // Validar el certificado
      const validacionResult =
        await this.satService.validarCertificadoSAT(savePath);

      return {
        success: validacionResult.valido,
        fileName,
        ...validacionResult,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al subir certificado: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('efirma/subir-llave')
  @UseInterceptors(FileInterceptor('llave'))
  async subirLlave(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException(
        'No se ha subido ningún archivo de llave privada',
      );
    }

    try {
      const userId = req.user.id;
      const fileName = `${Date.now()}_${file.originalname}`;
      const savePath = path.join('efirma', userId, fileName);
      const dir = path.dirname(savePath);

      // Crear directorio si no existe
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Guardar el archivo
      fs.writeFileSync(savePath, file.buffer);

      return {
        success: true,
        fileName,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al subir llave privada: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('efirma/firmar')
  async firmarConEfirma(
    @Body()
    {
      xml,
      certificadoNombre,
      llaveNombre,
      password,
    }: {
      xml: string;
      certificadoNombre: string;
      llaveNombre: string;
      password: string;
    },
    @Request() req,
  ) {
    try {
      const userId = req.user.id;

      // Cargar certificado y llave privada
      const certificado = await this.efirmaService.cargarCertificado(
        userId,
        certificadoNombre,
      );
      const llavePrivada = await this.efirmaService.cargarLlavePrivada(
        userId,
        llaveNombre,
        password,
      );

      // Firmar el XML
      const xmlFirmado = await this.efirmaService.firmarCFDI(
        xml,
        certificado,
        llavePrivada,
      );

      return {
        success: true,
        xmlFirmado,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al firmar con e.firma: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('pac/status')
  async verificarStatusPAC() {
    const status = await this.pacService.checkStatus();
    return {
      status: status ? 'online' : 'offline',
      timestamp: new Date().toISOString(),
    };
  }
}
