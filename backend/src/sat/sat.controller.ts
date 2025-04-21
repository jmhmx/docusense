// backend/src/sat/sat.controller.ts - Actualizado
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
  Param,
  Delete,
  UnauthorizedException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SatService } from './sat.service';
import { EfirmaService } from './efirma.service';
import { TokenService } from './token.service';
import { SatTransactionService } from './sat-transaction.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SatResponse } from './entities/sat-response.entity';
import { SatAcuse } from './entities/sat-acuse.entity';

@Controller('api/sat')
export class SatController {
  constructor(
    @InjectRepository(SatResponse)
    private satResponseRepository: Repository<SatResponse>,
    @InjectRepository(SatAcuse)
    private satAcuseRepository: Repository<SatAcuse>,
    private readonly satService: SatService,
    private readonly efirmaService: EfirmaService,
    private readonly tokenService: TokenService,
    private readonly satTransactionService: SatTransactionService,
  ) {}

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

      // Validar extensión
      if (!file.originalname.toLowerCase().endsWith('.cer')) {
        throw new BadRequestException('El archivo debe tener extensión .cer');
      }

      // Validar tamaño
      if (file.size > 1024 * 1024) {
        // Máx 1MB
        throw new BadRequestException(
          'El archivo excede el tamaño máximo permitido (1MB)',
        );
      }

      // Procesar certificado
      const result = await this.efirmaService.cargarCertificado(
        userId,
        file.buffer,
        file.originalname,
      );

      return {
        success: true,
        nombreCertificado: result.nombreCertificado,
        rfc: result.rfc,
        fechaVigenciaInicio: result.vigenciaInicio,
        fechaVigenciaFin: result.vigenciaFin,
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
  async subirLlave(
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password: string,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se ha subido ningún archivo de llave privada',
      );
    }

    if (!password || password.length < 6) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 6 caracteres',
      );
    }

    try {
      const userId = req.user.id;

      // Validar extensión
      if (!file.originalname.toLowerCase().endsWith('.key')) {
        throw new BadRequestException('El archivo debe tener extensión .key');
      }

      // Validar tamaño
      if (file.size > 1024 * 1024) {
        // Máx 1MB
        throw new BadRequestException(
          'El archivo excede el tamaño máximo permitido (1MB)',
        );
      }

      // Procesar llave privada
      const result = await this.efirmaService.cargarLlavePrivada(
        userId,
        file.buffer,
        password,
        file.originalname,
      );

      return {
        success: true,
        nombreLlave: result.nombreLlave,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al subir llave privada: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('efirma/certificados')
  async listarCertificados(@Request() req) {
    try {
      const userId = req.user.id;
      // Implementar lógica para listar certificados del usuario
      // Ejemplo simulado
      return [
        {
          id: 1,
          nombre: 'certificado_ejemplo.cer',
          rfc: 'TEST010101ABC',
          vigenciaInicio: new Date('2023-01-01').toISOString(),
          vigenciaFin: new Date('2026-01-01').toISOString(),
        },
      ];
    } catch (error) {
      throw new BadRequestException(
        `Error al listar certificados: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('efirma/llaves')
  async listarLlaves(@Request() req) {
    try {
      const userId = req.user.id;
      // Implementar lógica para listar llaves del usuario
      // Ejemplo simulado
      return [
        {
          id: 1,
          nombre: 'llave_ejemplo.key',
          fechaSubida: new Date().toISOString(),
        },
      ];
    } catch (error) {
      throw new BadRequestException(`Error al listar llaves: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('efirma/crear-token')
  async crearToken(
    @Body() datos: { certificadoNombre: string; llaveNombre: string },
    @Request() req,
  ) {
    try {
      const userId = req.user.id;

      // Implementar: Obtener certificado y llave del almacenamiento temporal
      const certificado = 'CERT_PLACEHOLDER'; // Simulado, en realidad cargaría el archivo
      const llave = 'KEY_PLACEHOLDER'; // Simulado, en realidad cargaría el archivo

      // Crear token de sesión
      const tokenId = await this.tokenService.createToken(
        userId,
        certificado,
        llave,
      );

      return {
        success: true,
        tokenId,
        expiresInMinutes: 30, // Tiempo configurado en TokenService
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al crear token de sesión: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('efirma/token/:tokenId')
  async invalidarToken(@Param('tokenId') tokenId: string, @Request() req) {
    try {
      // Seguridad: Verificar que el token pertenece al usuario
      const tokenData = await this.tokenService.getTokenData(tokenId);

      if (tokenData.userId !== req.user.id) {
        throw new UnauthorizedException(
          'No tiene permisos para invalidar este token',
        );
      }

      await this.tokenService.invalidateToken(tokenId);

      return {
        success: true,
        message: 'Token invalidado correctamente',
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al invalidar token: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('efirma/validar-certificado')
  async validarCertificado(
    @Body() data: { certificadoNombre: string },
    @Request() req,
  ) {
    if (!data.certificadoNombre) {
      throw new BadRequestException('Nombre de certificado es requerido');
    }

    try {
      const userId = req.user.id;

      // Obtener certificado del almacenamiento
      // En producción, extraeríamos el certificado del almacenamiento temporal
      const certificadoPEM = '...'; // Simulado

      // Validar el certificado
      const resultado =
        await this.efirmaService.validarCertificado(certificadoPEM);

      return {
        success: resultado.valido,
        certificado: {
          rfc: resultado.rfc,
          razonSocial: resultado.razonSocial,
          vigenciaInicio: resultado.vigenciaInicio,
          vigenciaFin: resultado.vigenciaFin,
          estado: resultado.noRevocado ? 'Válido' : 'Revocado',
        },
        detalles: resultado.detalles,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al validar certificado: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('respuestas')
  async getResponses(@Request() req) {
    try {
      const responses = await this.satResponseRepository.find({
        where: { userId: req.user.id },
        order: { createdAt: 'DESC' },
      });

      return responses;
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener respuestas: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('respuestas/:id')
  async getResponseById(@Param('id') id: string, @Request() req) {
    try {
      const response = await this.satResponseRepository.findOne({
        where: { id, userId: req.user.id },
      });

      if (!response) {
        throw new NotFoundException('Respuesta no encontrada');
      }

      // Obtener acuses relacionados
      const acuses = await this.satAcuseRepository.find({
        where: { responseId: id },
      });

      return {
        ...response,
        acuses,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener respuesta: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('acuses/:id/download')
  async downloadAcuse(@Param('id') id: string, @Request() req, @Res() res) {
    try {
      const acuse = await this.satAcuseRepository.findOne({
        where: { id },
        relations: ['response'],
      });

      if (!acuse) {
        throw new NotFoundException('Acuse no encontrado');
      }

      // Verificar que el acuse pertenezca al usuario
      if (acuse.response.userId !== req.user.id) {
        throw new UnauthorizedException(
          'No tiene permisos para descargar este acuse',
        );
      }

      // Enviar el archivo
      return res.download(acuse.filePath, acuse.filename);
    } catch (error) {
      throw new BadRequestException(
        `Error al descargar acuse: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('tramites')
  async getTransactions(@Request() req) {
    try {
      return this.satTransactionService.getTransactionsByUser(req.user.id);
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener trámites: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('tramites/:id')
  async getTransactionById(@Param('id') id: string, @Request() req) {
    try {
      const transaction =
        await this.satTransactionService.getTransactionById(id);

      if (!transaction) {
        throw new NotFoundException('Trámite no encontrado');
      }

      // Verificar que el trámite pertenezca al usuario
      if (transaction.userId !== req.user.id) {
        throw new UnauthorizedException(
          'No tiene permisos para ver este trámite',
        );
      }

      return transaction;
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener trámite: ${error.message}`,
      );
    }
  }
}
