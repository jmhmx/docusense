import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CryptoService } from '../crypto/crypto.service';
import { Signature } from './entities/signature.entity';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { Document } from '../documents/entities/document.entity';
import { DocumentsService } from '../documents/documents.service';
import { UsersService } from '../users/users.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { User } from '../users/entities/user.entity';
import { GeoLocationService } from '../shared/geo-location.service';
import { SharingService } from '../sharing/sharing.service';
import { SignaturesService } from './signatures.service';

@Injectable()
export class SignatureService2FAExtension {
  private readonly logger = new Logger(SignatureService2FAExtension.name);

  constructor(
    @InjectRepository(Signature)
    private signaturesRepository: Repository<Signature>,
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly cryptoService: CryptoService,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
    private readonly blockchainService: BlockchainService,
    private readonly geoLocationService: GeoLocationService,
    private readonly sharingService: SharingService,
    private readonly signaturesService: SignaturesService,
  ) {}

  /**
   * Verifica si un usuario ha completado 2FA para firmar un documento
   */
  async verifyUser2FAStatus(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Verificar si el usuario tiene habilitado 2FA
    return user.twoFactorEnabled;
  }

  /**
   * Firma un documento después de verificación 2FA
   * Incluye datos detallados de geolocalización, dispositivo, etc.
   */
  async signDocumentAfter2FA(
    documentId: string,
    userId: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Signature> {
    // Validación de entradas
    if (!documentId || !userId) {
      throw new BadRequestException(
        'Se requieren ID del documento y del usuario',
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

      // Verificar permisos (sólo el propietario o usuarios con permiso pueden firmar)
      if (document.userId !== userId) {
        // Verificar si el usuario puede firmar el documento
        const canSignResult = await this.signaturesService.canUserSignDocument(
          documentId,
          userId,
        );

        if (!canSignResult.canSign) {
          throw new UnauthorizedException(
            canSignResult.reason ||
              'No tienes permiso para firmar este documento',
          );
        }
      }

      // Obtener información de geolocalización aproximada basada en la IP
      let geoLocation = null;
      try {
        if (ipAddress) {
          geoLocation =
            await this.geoLocationService.getLocationFromIp(ipAddress);
        }
      } catch (error) {
        this.logger.warn(
          `No se pudo obtener geolocalización para IP ${ipAddress}: ${error.message}`,
        );
      }

      // Extraer información del dispositivo del User-Agent
      const deviceInfo = this.extractDeviceInfo(userAgent);

      // Calcular hash del documento para integridad
      const documentHash = this.cryptoService.generateHash(document.filePath);

      // Timestamp preciso de la firma
      const timestamp = new Date();

      // Preparar datos que se incluirán en la firma
      const dataToSign = JSON.stringify({
        documentId,
        documentHash,
        userId,
        timestamp: timestamp.toISOString(),
        reason,
        position,
        ipAddress,
        geoLocation,
        deviceInfo,
        authMethod: '2FA',
      });

      // Firmar con la clave privada del usuario
      let keyPair = await this.cryptoService.getUserKeyPair(userId);
      if (!keyPair) {
        this.logger.log(
          `Generando par de claves para usuario ${user.name} (${userId})`,
        );
        keyPair = await this.cryptoService.generateKeyPair(userId);
      }

      const signatureData = await this.cryptoService.signData(
        userId,
        dataToSign,
      );
      if (!signatureData) {
        throw new BadRequestException('Error al generar firma digital');
      }

      // Crear registro de firma con metadatos detallados
      const signatureEntity = this.signaturesRepository.create({
        id: uuidv4(),
        documentId: document.id,
        userId,
        signatureData,
        documentHash,
        signedAt: timestamp,
        reason: reason || 'Firma con verificación 2FA',
        position: position ? JSON.stringify(position) : null,
        valid: true,
        metadata: {
          // Información de autenticación
          authMethod: '2FA',
          verifiedAt: timestamp.toISOString(),

          // Información de ubicación
          ipAddress,
          geoLocation,

          // Información del dispositivo
          deviceInfo,
          userAgent,

          // Datos técnicos de la firma
          signatureAlgorithm: 'RSA-SHA256',
          hashAlgorithm: 'SHA-256',
          dataToSign,

          // Información del documento
          documentMetadata: {
            title: document.title,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
            status: document.status,
          },

          // Datos de seguridad adicionales
          securityLevel: 'high',
          authenticationStrength: '2FA',
        },
      });

      // Guardar firma en base de datos
      const savedSignature =
        await this.signaturesRepository.save(signatureEntity);

      // Actualizar metadatos del documento
      document.metadata = {
        ...document.metadata,
        isSigned: true,
        lastSignedAt: timestamp.toISOString(),
        signaturesCount: (document.metadata?.signaturesCount || 0) + 1,
        hasVerified2FASignatures: true,
      };

      await this.documentsService.update(document.id, document);

      // Registrar en auditoría con detalles completos
      await this.auditLogService.log(
        AuditAction.DOCUMENT_SIGN,
        userId,
        documentId,
        {
          title: document.title,
          signatureId: savedSignature.id,
          signatureMethod: '2FA',
          position: position ? JSON.stringify(position) : 'No especificada',
          reason: reason || 'Firma estándar con 2FA',
          ipAddress,
          geoLocation,
          deviceInfo,
          timestamp: timestamp.toISOString(),
        },
        ipAddress,
        userAgent,
      );

      // Registrar en blockchain (si está habilitado)
      try {
        await this.blockchainService.updateDocumentRecord(
          documentId,
          documentHash,
          'SIGNATURE_2FA',
          userId,
          {
            signatureId: savedSignature.id,
            timestamp: timestamp.toISOString(),
            authMethod: '2FA',
          },
        );
      } catch (blockchainError) {
        this.logger.error(
          `Error al registrar firma en blockchain: ${blockchainError.message}`,
          blockchainError.stack,
        );
        // Continuamos con el proceso aunque falle la blockchain
      }

      this.logger.log(
        `Documento ${documentId} firmado con 2FA por usuario ${userId}`,
      );
      return savedSignature;
    } catch (error) {
      this.logger.error(
        `Error al firmar documento con 2FA: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Extrae información del dispositivo del User-Agent
   */
  private extractDeviceInfo(userAgent?: string): Record<string, any> {
    if (!userAgent) {
      return { type: 'unknown' };
    }

    try {
      const deviceInfo: Record<string, any> = {
        browser: 'unknown',
        os: 'unknown',
        device: 'unknown',
        mobile: false,
      };

      // Browser detection
      if (userAgent.includes('Chrome')) {
        deviceInfo.browser = 'Chrome';
      } else if (userAgent.includes('Firefox')) {
        deviceInfo.browser = 'Firefox';
      } else if (
        userAgent.includes('Safari') &&
        !userAgent.includes('Chrome')
      ) {
        deviceInfo.browser = 'Safari';
      } else if (userAgent.includes('Edge') || userAgent.includes('Edg')) {
        deviceInfo.browser = 'Edge';
      } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
        deviceInfo.browser = 'Internet Explorer';
      }

      // OS detection
      if (userAgent.includes('Windows')) {
        deviceInfo.os = 'Windows';
      } else if (userAgent.includes('Mac OS')) {
        deviceInfo.os = 'MacOS';
      } else if (userAgent.includes('Linux')) {
        deviceInfo.os = 'Linux';
      } else if (userAgent.includes('Android')) {
        deviceInfo.os = 'Android';
        deviceInfo.mobile = true;
      } else if (
        userAgent.includes('iOS') ||
        userAgent.includes('iPhone') ||
        userAgent.includes('iPad')
      ) {
        deviceInfo.os = 'iOS';
        deviceInfo.mobile = true;
      }

      // Device type detection
      if (userAgent.includes('Mobile')) {
        deviceInfo.device = 'Mobile';
        deviceInfo.mobile = true;
      } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
        deviceInfo.device = 'Tablet';
        deviceInfo.mobile = true;
      } else {
        deviceInfo.device = 'Desktop';
      }

      return deviceInfo;
    } catch (error) {
      this.logger.warn(`Error al analizar User-Agent: ${error.message}`);
      return { type: 'unknown', parseError: true };
    }
  }
}
