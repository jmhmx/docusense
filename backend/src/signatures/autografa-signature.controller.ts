import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  Ip,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AutografaSignatureService } from './autografa-signature.service';

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
export class AutografaSignatureController {
  constructor(
    private readonly autografaSignatureService: AutografaSignatureService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/autografa')
  async signDocumentWithAutografa(
    @Param('documentId') documentId: string,
    @Body() signatureDto: AutografaSignatureDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      if (!signatureDto.firmaAutografaSvg) {
        throw new BadRequestException(
          'La imagen de la firma autógrafa es requerida',
        );
      }

      const signature =
        await this.autografaSignatureService.signDocumentWithAutografa(
          documentId,
          req.user.id,
          signatureDto.firmaAutografaSvg,
          signatureDto.position,
          signatureDto.reason,
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
  @Get(':signatureId/verify-autografa')
  async verifyAutografaSignature(@Param('signatureId') signatureId: string) {
    try {
      const validationResult =
        await this.autografaSignatureService.verifyAutografaSignature(
          signatureId,
        );

      return {
        signatureId,
        valid: validationResult.isValid,
        reason: validationResult.reason,
        verifiedAt: validationResult.verifiedAt.toISOString(),
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al verificar firma autógrafa: ${error.message}`,
      );
    }
  }
}
