import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CryptoService } from '../crypto/crypto.service';
import { DocumentsService } from '../documents/documents.service';
import { UsersService } from '../users/users.service';
import { Signature } from './entities/signature.entity';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { Document } from '../documents/entities/document.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AutografaSignatureService {
  private readonly logger = new Logger(AutografaSignatureService.name);

  constructor(
    @InjectRepository(Signature)
    private signaturesRepository: Repository<Signature>,
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private readonly cryptoService: CryptoService,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
    private readonly blockchainService: BlockchainService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Firma un documento con firma autógrafa
   */
  async signDocumentWithAutografa(
    documentId: string,
    userId: string,
    firmaAutografaSvg: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Signature> {
    // Validación de entradas
    if (!documentId || !userId || !firmaAutografaSvg) {
      throw new BadRequestException(
        'Faltan datos necesarios para la firma (documento, usuario, o imagen de firma)',
      );
    }

    try {
      // Verificar documento
      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new NotFoundException(
          `Documento con ID ${documentId} no encontrado`,
        );
      }

      // Verificar usuario
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      // Verificar estado del documento
      if (document.status !== 'completed' && document.status !== 'pending') {
        throw new BadRequestException(
          `El documento no está listo para firma. Estado actual: ${document.status}`,
        );
      }

      // Verificar permisos
      if (document.userId !== userId) {
        // Aquí iría la lógica para verificar permisos adicionales
        // como por ejemplo, verificar si el documento ha sido compartido con este usuario
        const hasPermission = true; // Reemplazar con la lógica real

        if (!hasPermission) {
          throw new UnauthorizedException(
            'No tienes permiso para firmar este documento',
          );
        }
      }

      // Generar hash del documento para integridad
      const documentHash = this.cryptoService.generateHash(document.filePath);

      // Crear registro de firma
      const signatureEntity = this.signaturesRepository.create({
        id: uuidv4(),
        documentId: document.id,
        userId,
        signatureData: firmaAutografaSvg, // Guardar la imagen SVG de la firma
        documentHash,
        signedAt: new Date(),
        reason: reason || 'Firma autógrafa',
        position: position ? JSON.stringify(position) : null,
        valid: true,
        metadata: {
          signatureType: 'autografa',
          verificationMethod: '2FA',
          userAgent,
          ipAddress,
          authenticatedAt: new Date().toISOString(),
          documentMetadata: {
            title: document.title,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
          },
        },
      });

      // Guardar firma
      const savedSignature =
        await this.signaturesRepository.save(signatureEntity);

      // Actualizar metadatos del documento
      document.metadata = {
        ...document.metadata,
        isSigned: true,
        lastSignedAt: new Date().toISOString(),
        signaturesCount: (document.metadata?.signaturesCount || 0) + 1,
        hasAutografaSignatures: true,
      };

      await this.documentsService.update(documentId, document);

      // Registrar en log de auditoría
      await this.auditLogService.log(
        AuditAction.DOCUMENT_SIGN,
        userId,
        documentId,
        {
          title: document.title,
          signatureId: savedSignature.id,
          signatureType: 'autografa',
        },
        ipAddress,
        userAgent,
      );

      // Registrar en blockchain si está disponible
      try {
        await this.blockchainService.updateDocumentRecord(
          documentId,
          documentHash,
          'SIGNATURE_AUTOGRAFA',
          userId,
          {
            signatureId: savedSignature.id,
            timestamp: savedSignature.signedAt.toISOString(),
          },
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo registrar en blockchain: ${error.message}`,
        );
        // Continuar aunque falle el registro en blockchain
      }

      // Notificar al propietario del documento si es diferente del firmante
      if (document.userId !== userId) {
        try {
          const owner = await this.usersService.findOne(document.userId);
          if (owner && owner.email) {
            // Aquí iría el código para enviar la notificación por email
            this.logger.log(`Notificando firma autógrafa a ${owner.email}`);
          }
        } catch (error) {
          this.logger.warn(`Error al enviar notificación: ${error.message}`);
        }
      }

      return savedSignature;
    } catch (error) {
      this.logger.error(
        `Error en proceso de firma autógrafa: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Verifica una firma autógrafa específica
   */
  async verifyAutografaSignature(signatureId: string): Promise<{
    isValid: boolean;
    reason?: string;
    verifiedAt: Date;
  }> {
    // Buscar firma
    const signature = await this.signaturesRepository.findOne({
      where: { id: signatureId },
    });

    if (!signature) {
      throw new NotFoundException(`Firma con ID ${signatureId} no encontrada`);
    }

    // Verificar que sea una firma autógrafa
    if (signature.metadata?.signatureType !== 'autografa') {
      return {
        isValid: false,
        reason: 'No es una firma autógrafa',
        verifiedAt: new Date(),
      };
    }

    try {
      // Verificar integridad del documento
      const document = await this.documentsService.findOne(
        signature.documentId,
      );
      if (!document) {
        return {
          isValid: false,
          reason: 'El documento asociado no existe',
          verifiedAt: new Date(),
        };
      }

      // Calcular hash actual del documento
      const currentHash = this.cryptoService.generateHash(document.filePath);

      // Comparar con el hash almacenado al momento de la firma
      if (currentHash !== signature.documentHash) {
        // Actualizar estado de la firma
        signature.valid = false;
        signature.metadata = {
          ...signature.metadata,
          validationHistory: [
            ...(signature.metadata?.validationHistory || []),
            {
              timestamp: new Date().toISOString(),
              isValid: false,
              reason: 'El documento ha sido modificado después de la firma',
            },
          ],
        };

        await this.signaturesRepository.save(signature);

        return {
          isValid: false,
          reason: 'El documento ha sido modificado después de la firma',
          verifiedAt: new Date(),
        };
      }

      // Si todo está correcto, mantener o actualizar el estado a válido
      if (!signature.valid) {
        signature.valid = true;
        signature.metadata = {
          ...signature.metadata,
          validationHistory: [
            ...(signature.metadata?.validationHistory || []),
            {
              timestamp: new Date().toISOString(),
              isValid: true,
              reason: 'Firma verificada correctamente',
            },
          ],
        };

        await this.signaturesRepository.save(signature);
      }

      return {
        isValid: true,
        verifiedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error verificando firma autógrafa ${signatureId}: ${error.message}`,
        error.stack,
      );

      return {
        isValid: false,
        reason: `Error en verificación: ${error.message}`,
        verifiedAt: new Date(),
      };
    }
  }
}
