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
  Headers,
  Ip,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SignaturesService } from './signatures.service';
import { CreateSignatureDto } from './dto/create-signature.dto';
import { CreateSignatureWithBiometricDto } from './dto/create-signature-with-biometric.dto';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

// Nueva clase DTO para firma autógrafa
class AutografaSignatureDto {
  position?: {
    page: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  reason?: string;
  firmaAutografaSvg: string;
}

@Controller('api/signatures')
export class SignaturesController {
  constructor(
    private readonly signaturesService: SignaturesService,
    private readonly auditLogService: AuditLogService,
  ) {}

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

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/multi-init')
  async initMultiSignatureProcess(
    @Param('documentId') documentId: string,
    @Body() initDto: { signerIds: string[]; requiredSigners?: number },
    @Request() req,
  ) {
    try {
      await this.signaturesService.initMultiSignatureProcess(
        documentId,
        req.user.id,
        initDto.signerIds,
        initDto.requiredSigners,
      );

      return {
        success: true,
        message: 'Proceso de firmas múltiples iniciado correctamente',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al iniciar proceso de firmas múltiples: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/multi-cancel')
  async cancelMultiSignatureProcess(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    try {
      await this.signaturesService.cancelMultiSignatureProcess(
        documentId,
        req.user.id,
      );

      return {
        success: true,
        message: 'Proceso de firmas múltiples cancelado correctamente',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al cancelar proceso de firmas múltiples: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/signature-status')
  async getDocumentSignatureStatus(@Param('documentId') documentId: string) {
    try {
      return await this.signaturesService.getDocumentSignatureStatus(
        documentId,
      );
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener estado de firmas: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/verify-all')
  async verifyAllSignatures(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    try {
      const result =
        await this.signaturesService.verifyAllSignatures(documentId);

      // Registrar en auditoría
      await this.auditLogService.log(
        AuditAction.DOCUMENT_VIEW,
        req.user.id,
        documentId,
        {
          action: 'verify_all_signatures',
          verifiedCount: result.verifiedCount,
          totalCount: result.totalCount,
          quorumReached: result.quorumReached,
        },
      );

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error verificando firmas: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/efirma')
  async signDocumentWithEfirma(
    @Param('documentId') documentId: string,
    @Body() signData: { tokenId: string; position?: any; reason?: string },
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      const signature = await this.signaturesService.signDocumentWithEfirma(
        documentId,
        req.user.id,
        signData.tokenId,
        signData.position,
        signData.reason,
      );

      return {
        message: 'Documento firmado correctamente con e.firma',
        signatureId: signature.id,
        documentId: signature.documentId,
        timestamp: signature.signedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `No se pudo firmar el documento con e.firma: ${error.message}`,
      );
    }
  }

  /**
   * Nuevo endpoint para manejar firma autógrafa con 2FA
   */
  @UseGuards(JwtAuthGuard)
  @Post(':documentId/autografa')
  async signDocumentWithAutografa(
    @Param('documentId') documentId: string,
    @Body() autografaDto: AutografaSignatureDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      if (!autografaDto.firmaAutografaSvg) {
        throw new BadRequestException(
          'La imagen de la firma autógrafa es requerida',
        );
      }

      // Usar el servicio de firmas existente, que ha sido ampliado para manejar firmas autógrafas
      const signature = await this.signaturesService.signDocumentWithAutografa(
        documentId,
        req.user.id,
        autografaDto.firmaAutografaSvg,
        autografaDto.position,
        autografaDto.reason,
        ip,
        headers['user-agent'] || 'Unknown',
      );

      return {
        message: 'Documento firmado correctamente con firma autógrafa',
        signatureId: signature.id,
        documentId: signature.documentId,
        timestamp: signature.signedAt,
        signatureType: 'autografa',
      };
    } catch (error) {
      throw new BadRequestException(
        `No se pudo firmar el documento: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync-all-processes')
  async syncAllMultiSignatureProcesses(@Request() req) {
    // Solo admins pueden ejecutar sincronización masiva
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'Solo administradores pueden ejecutar sincronización',
      );
    }

    try {
      await this.signaturesService.syncAllMultiSignatureProcesses();
      return {
        success: true,
        message: 'Sincronización de procesos de firma múltiple completada',
      };
    } catch (error) {
      throw new BadRequestException(
        `Error en sincronización: ${error.message}`,
      );
    }
  }
}
