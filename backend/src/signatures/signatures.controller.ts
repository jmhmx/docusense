import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SignaturesService } from './signatures.service';
import { CreateSignatureDto } from './dto/create-signature.dto';

@Controller('api/signatures')
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':documentId')
  async signDocument(
    @Param('documentId') documentId: string,
    @Body() createSignatureDto: CreateSignatureDto,
    @Request() req,
  ) {
    try {
      const signature = await this.signaturesService.signDocument(
        documentId,
        req.user.id,
        createSignatureDto.position,
        createSignatureDto.reason,
      );

      return {
        message: 'Documento firmado correctamente',
        signatureId: signature.id,
        documentId: signature.documentId,
        timestamp: signature.signedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `No se pudo firmar el documento: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId')
  async getDocumentSignatures(@Param('documentId') documentId: string) {
    try {
      const signatures =
        await this.signaturesService.getDocumentSignatures(documentId);
      return signatures;
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener firmas del documento: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  async getUserSignatures(@Request() req) {
    try {
      const signatures = await this.signaturesService.getUserSignatures(
        req.user.id,
      );
      return signatures;
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener firmas del usuario: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':signatureId/verify')
  async verifySignature(@Param('signatureId') signatureId: string) {
    try {
      const isValid = await this.signaturesService.verifySignature(signatureId);
      return {
        signatureId,
        valid: isValid,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al verificar firma: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/integrity')
  async verifyDocumentIntegrity(@Param('documentId') documentId: string) {
    try {
      const isIntact =
        await this.signaturesService.verifyDocumentIntegrity(documentId);
      return {
        documentId,
        intact: isIntact,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al verificar integridad del documento: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('can-sign/:documentId')
  async canSignDocument(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    try {
      const result = await this.signaturesService.canUserSignDocument(
        documentId,
        req.user.id,
      );
      return result;
    } catch (error) {
      throw new BadRequestException(
        `Error checking signature permissions: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':signatureId/risk')
  async getSignatureRisk(@Param('signatureId') signatureId: string) {
    return this.signaturesService.getSignatureRiskAssessment(signatureId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/biometric')
  async signDocumentWithBiometric(
    @Param('documentId') documentId: string,
    @Body() createSignatureDto: CreateSignatureWithBiometricDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      // Extraer la información biométrica
      const { position, reason, biometricVerification } = createSignatureDto;

      // Realizar validaciones adicionales de seguridad
      if (!biometricVerification || !biometricVerification.timestamp) {
        throw new BadRequestException(
          'Información de verificación biométrica incompleta',
        );
      }

      // Verificar que la verificación biométrica sea reciente (máximo 5 minutos)
      const verificationTime = new Date(biometricVerification.timestamp);
      const now = new Date();
      const timeDifference = now.getTime() - verificationTime.getTime();
      const maxDifference = 5 * 60 * 1000; // 5 minutos en milisegundos

      if (timeDifference > maxDifference) {
        throw new BadRequestException('La verificación biométrica ha expirado');
      }

      // Crear firma con verificación biométrica
      const signature = await this.signaturesService.signDocumentWithBiometric(
        documentId,
        req.user.id,
        position,
        reason,
        biometricVerification,
        ip,
        headers['user-agent'] || 'Unknown',
      );

      return {
        message: 'Documento firmado correctamente con verificación biométrica',
        signatureId: signature.id,
        documentId: signature.documentId,
        timestamp: signature.signedAt,
        verificationMethod: 'biometric',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `No se pudo firmar el documento: ${error.message}`,
      );
    }
  }
}
