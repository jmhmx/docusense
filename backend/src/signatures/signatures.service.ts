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
import { EfirmaService } from '../sat/efirma.service';
import { TokenService } from '../sat/token.service';
import { log } from 'console';
export interface SignatureVerificationResult {
  isValid: boolean;
  reason?: string;
  verifiedAt: Date;
}

@Injectable()
export class SignaturesService {
  private readonly logger = new Logger(SignaturesService.name);

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
    private readonly efirmaService: EfirmaService,
    private readonly tokenService: TokenService,
  ) {}

  async signDocumentWithEfirma(
    documentId: string,
    userId: string,
    tokenId: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
  ): Promise<Signature> {
    // Verificar documento
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Verificar token y obtener datos de certificado/llave
    let tokenData: any;
    try {
      tokenData = await this.tokenService.getTokenData(tokenId);
    } catch (error) {
      throw new BadRequestException(`Error al validar token: ${error.message}`);
    }

    if (tokenData.userId !== userId) {
      throw new UnauthorizedException('Token no pertenece al usuario');
    }

    // Generar hash del documento para integridad
    let documentHash: string;
    try {
      documentHash = this.cryptoService.generateHash(document.filePath);
    } catch (error) {
      throw new BadRequestException(
        `Error generando hash del documento: ${error.message}`,
      );
    }

    // Preparar datos para firmar con formato para el SAT
    const dataToSign = JSON.stringify({
      documentId,
      documentHash,
      userId,
      timestamp: new Date().toISOString(),
      reason,
      position,
    });

    // Firmar con la llave privada del token
    let signatureData: string;
    try {
      // Asegurarse de que recibimos el certificado y llave del tokenData
      if (!tokenData.certificado || !tokenData.llave) {
        throw new BadRequestException(
          'Token no contiene datos válidos de certificado o llave',
        );
      }

      this.logger.log('Iniciando proceso de firma con e.firma');

      // Crear firma con estándares SAT (PKCS#7)
      signatureData = await this.efirmaService.firmarConEfirma(
        tokenData.certificado,
        tokenData.llave,
        dataToSign,
      );

      this.logger.log('Firma con e.firma completada exitosamente');
    } catch (error) {
      this.logger.error(
        `Error firmando con e.firma: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error firmando con e.firma: ${error.message}`,
      );
    }

    // Crear registro de firma con metadatos adicionales de e.firma
    const signatureEntity = this.signaturesRepository.create({
      id: uuidv4(),
      documentId: document.id,
      userId,
      signatureData,
      documentHash,
      signedAt: new Date(),
      reason: reason || 'Firma con e.firma',
      position: position ? JSON.stringify(position) : null,
      valid: true,
      metadata: {
        signatureType: 'efirma',
        certificateData: {
          issuer: 'SAT',
          serialNumber: tokenData.certificado.serialNumber,
          rfc: tokenData.certificado.rfc,
        },
        documentMetadata: {
          title: document.title,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
        },
      },
    });

    // Guardar firma
    try {
      const savedSignature =
        await this.signaturesRepository.save(signatureEntity);

      // Actualizar metadata del documento
      document.metadata = {
        ...document.metadata,
        isSigned: true,
        lastSignedAt: new Date().toISOString(),
        signaturesCount: (document.metadata?.signaturesCount || 0) + 1,
        hasEfirmaSignatures: true,
      };

      await this.documentsService.update(documentId, document);

      // Registrar en blockchain si está disponible
      try {
        await this.blockchainService.updateDocumentRecord(
          documentId,
          documentHash,
          'SIGNATURE_EFIRMA',
          userId,
          {
            signatureId: savedSignature.id,
            timestamp: savedSignature.signedAt.toISOString(),
          },
        );
      } catch (blockchainError) {
        this.logger.warn(
          `No se pudo registrar en blockchain: ${blockchainError.message}`,
        );
        // Continuamos a pesar del error de blockchain
      }

      return savedSignature;
    } catch (error) {
      throw new BadRequestException(`Error guardando firma: ${error.message}`);
    }
  }

  /**
   * Signs a document with additional validation and security
   */
  async originalSignDocument(
    documentId: string,
    userId: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Signature> {
    // Input validation
    if (!documentId || !userId) {
      throw new BadRequestException('Document ID and User ID are required');
    }

    // Problema 1: Las consultas a la BD pueden estar fallando
    // Asegurarse de que la consulta está correcta
    try {
      // Verify document exists - ARREGLO: Comprobar que la consulta es correcta
      // Imprimir el ID para depuración
      console.log(`Buscando documento con ID: ${documentId}`);

      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        console.error(`Documento no encontrado con ID: ${documentId}`);
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Verify user exists - ARREGLO: Comprobar que la consulta es correcta
      console.log(`Buscando usuario con ID: ${userId}`);

      const user = await this.usersService.findOne(userId);
      if (!user) {
        console.error(`Usuario no encontrado con ID: ${userId}`);
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Check document status - only allow signing if processed
      if (document.status !== 'completed' && document.status !== 'pending') {
        throw new BadRequestException(
          `Document is not ready for signing. Current status: ${document.status}`,
        );
      }

      // Verify the user has permission to sign this document
      if (document.userId !== userId) {
        // Check if document is shared with this user (placeholder - implement based on your sharing model)
        const hasAccess = true; // Replace with actual permission check
        if (!hasAccess) {
          throw new UnauthorizedException(
            'You do not have permission to sign this document',
          );
        }
      }

      // Check if the document already has signatures from this user
      const existingSignatures = await this.signaturesRepository.find({
        where: { documentId, userId },
      });

      if (existingSignatures.length > 0) {
        this.logger.warn(
          `User ${userId} already has ${existingSignatures.length} signatures on document ${documentId}`,
        );
        // Optional: decide if multiple signatures are allowed
      }

      // Generate document hash for integrity checking
      let documentHash: string;
      try {
        documentHash = this.cryptoService.generateHash(document.filePath);
      } catch (error) {
        throw new BadRequestException(
          `Failed to hash document: ${error.message}`,
        );
      }

      // Prepare data to sign (includes all relevant metadata)
      const timestamp = new Date().toISOString();
      const dataToSign = JSON.stringify({
        documentId,
        documentHash,
        userId,
        timestamp,
        reason,
        position,
      });

      // Check if the user has a key pair, generate if not
      let keyPair = await this.cryptoService.getUserKeyPair(userId);
      if (!keyPair) {
        this.logger.log(
          `Generating new key pair for user ${user.name} (${userId})`,
        );
        try {
          keyPair = await this.cryptoService.generateKeyPair(userId);
        } catch (error) {
          throw new BadRequestException(
            `Failed to generate key pair: ${error.message}`,
          );
        }
      }

      // Sign the data
      let signatureData: string;
      try {
        const signResult = await this.cryptoService.signData(
          userId,
          dataToSign,
        );
        if (!signResult) {
          throw new BadRequestException('Failed to generate digital signature');
        }
        signatureData = signResult;
      } catch (error) {
        throw new BadRequestException(
          `Error signing document: ${error.message}`,
        );
      }

      // Create signature record
      const signatureEntity = this.signaturesRepository.create({
        id: uuidv4(),
        documentId: document.id,
        userId,
        signatureData,
        documentHash,
        signedAt: new Date(),
        reason: reason || 'Document signature',
        position: position ? JSON.stringify(position) : null,
        valid: true, // Initially valid
        metadata: {
          userAgent: userAgent || 'Unknown',
          ipAddress: ipAddress || 'Unknown',
          dataToSign,
          documentMetadata: {
            title: document.title,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
          },
        },
      });

      // Save signature
      try {
        const savedSignature =
          await this.signaturesRepository.save(signatureEntity);

        // Update document metadata to mark as signed
        document.metadata = {
          ...document.metadata,
          isSigned: true,
          lastSignedAt: new Date().toISOString(),
          signaturesCount: (document.metadata?.signaturesCount || 0) + 1,
        };

        await this.documentsService.update(documentId, document);

        // Record audit log
        try {
          await this.auditLogService.log(
            AuditAction.DOCUMENT_SIGN,
            userId,
            documentId,
            {
              title: document.title,
              signatureId: savedSignature.id,
            },
            ipAddress,
            userAgent,
          );
        } catch (error) {
          this.logger.error(
            `Failed to record audit log: ${error.message}`,
            error.stack,
          );
          // Continue even if audit log fails
        }

        try {
          await this.blockchainService.updateDocumentRecord(
            documentId,
            documentHash,
            'SIGNATURE',
            userId,
            {
              signatureId: savedSignature.id,
              timestamp: savedSignature.signedAt.toISOString(),
            },
          );
        } catch (blockchainError) {
          this.logger.error(
            `Failed to register signature on blockchain: ${blockchainError.message}`,
            blockchainError.stack,
          );
          // Continue anyway, blockchain registration is not critical for functionality
        }

        this.logger.log(`Document ${documentId} signed by user ${userId}`);
        return savedSignature;
      } catch (error) {
        this.logger.error(
          `Error saving signature: ${error.message}`,
          error.stack,
        );
        throw new BadRequestException(
          `Failed to save signature: ${error.message}`,
        );
      }
    } catch (error) {
      console.error(`Error en proceso de firma: ${error.message}`, error.stack);
      throw error; // Re-lanzamos el error para que se maneje en el controlador
    }
  }

  /**
   * Verifies a specific signature with detailed diagnostics
   */
  async verifySignature(
    signatureId: string,
  ): Promise<SignatureVerificationResult> {
    // Find the signature
    const signature = await this.signaturesRepository.findOne({
      where: { id: signatureId },
    });

    if (!signature) {
      throw new NotFoundException(`Signature with ID ${signatureId} not found`);
    }

    const verificationResult: SignatureVerificationResult = {
      isValid: false,
      verifiedAt: new Date(),
    };

    try {
      // Recreate the original signed data
      const dataToSign = signature.metadata?.dataToSign;

      if (!dataToSign) {
        verificationResult.reason = 'Missing original signed data';
        await this.updateSignatureValidity(
          signature,
          false,
          verificationResult.reason,
        );
        return verificationResult;
      }

      // Verify the signature cryptographically
      const isSignatureValid = await this.cryptoService.verifySignature(
        signature.userId,
        dataToSign,
        signature.signatureData,
      );

      if (!isSignatureValid) {
        verificationResult.reason = 'Digital signature verification failed';
        await this.updateSignatureValidity(
          signature,
          false,
          verificationResult.reason,
        );
        return verificationResult;
      }

      // Get the current document to verify hash integrity
      let document;
      try {
        document = await this.documentsService.findOne(signature.documentId);
      } catch (error) {
        verificationResult.reason = 'Document not found or access denied';
        await this.updateSignatureValidity(
          signature,
          false,
          verificationResult.reason,
        );
        return verificationResult;
      }

      // Calculate current document hash
      const currentHash = this.cryptoService.generateHash(document.filePath);

      // Compare with the hash at signing time
      if (signature.documentHash !== currentHash) {
        verificationResult.reason = 'Document has been modified since signing';
        await this.updateSignatureValidity(
          signature,
          false,
          verificationResult.reason,
        );
        return verificationResult;
      }

      // Additional checks can be added here:
      // - Certificate validity period
      // - Certificate revocation status
      // - Timestamp validation

      // All checks passed
      verificationResult.isValid = true;
      await this.updateSignatureValidity(signature, true);

      return verificationResult;
    } catch (error) {
      this.logger.error(
        `Error verifying signature ${signatureId}: ${error.message}`,
        error.stack,
      );
      verificationResult.reason = `Verification error: ${error.message}`;
      await this.updateSignatureValidity(
        signature,
        false,
        verificationResult.reason,
      );
      return verificationResult;
    }
  }

  /**
   * Updates the validity status of a signature
   */
  private async updateSignatureValidity(
    signature: Signature,
    isValid: boolean,
    reason?: string,
  ): Promise<void> {
    try {
      // Only update if status has changed
      if (signature.valid !== isValid) {
        signature.valid = isValid;

        // Update metadata
        signature.metadata = {
          ...signature.metadata,
          validationHistory: [
            ...(signature.metadata?.validationHistory || []),
            {
              timestamp: new Date().toISOString(),
              isValid,
              reason:
                reason ||
                (isValid
                  ? 'Signature verified successfully'
                  : 'Signature verification failed'),
            },
          ],
        };

        await this.signaturesRepository.save(signature);

        this.logger.log(
          `Signature ${signature.id} validity updated to ${isValid}${reason ? ': ' + reason : ''}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update signature validity: ${error.message}`,
        error.stack,
      );
      // We don't throw here to not disrupt the verification result
    }
  }

  /**
   * Gets all signatures for a document with enhanced security checks
   */
  async getDocumentSignatures(
    documentId: string,
    requestUserId?: string,
  ): Promise<Signature[]> {
    // Input validation
    if (!documentId) {
      throw new BadRequestException('Document ID is required');
    }

    // If requestUserId is provided, check document access
    if (requestUserId) {
      try {
        // This will throw if user doesn't have access
        await this.documentsService.findOne(documentId, requestUserId);
      } catch (error) {
        throw new UnauthorizedException('Access to document signatures denied');
      }
    }

    try {
      const signatures = await this.signaturesRepository.find({
        where: { documentId },
        order: { signedAt: 'DESC' },
        relations: ['user'], // Include user information
      });

      // Optionally enrich with user information or sanitize sensitive data
      return signatures.map((signature) => {
        // Remove sensitive data
        const sanitizedSignature = { ...signature };
        if (sanitizedSignature.metadata) {
          delete sanitizedSignature.metadata.ipAddress;
          // Keep other metadata that might be useful for the client
        }
        return sanitizedSignature;
      });
    } catch (error) {
      this.logger.error(
        `Error retrieving signatures for document ${documentId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to retrieve signatures: ${error.message}`,
      );
    }
  }

  /**
   * Gets all signatures by a specific user
   */
  async getUserSignatures(userId: string, limit = 100): Promise<Signature[]> {
    // Input validation
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      return this.signaturesRepository.find({
        where: { userId },
        order: { signedAt: 'DESC' },
        take: limit,
        relations: ['document'], // Include document information
      });
    } catch (error) {
      this.logger.error(
        `Error retrieving signatures for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to retrieve user signatures: ${error.message}`,
      );
    }
  }

  /**
   * Verifies the integrity of a document - checks if it has been modified since any signatures
   */
  async verifyDocumentIntegrity(documentId: string): Promise<{
    intact: boolean;
    signatures: {
      id: string;
      isValid: boolean;
      signedAt: Date;
      userId: string;
      userName?: string; // Añadimos nombre de usuario para mejor display
    }[];
    verifiedAt: Date;
    hashAlgorithm: string; // Añadimos información sobre el algoritmo
    blockchainVerified?: boolean | null;
    blockchainDetails?: any;
  }> {
    // Validación de entrada
    if (!documentId) {
      throw new BadRequestException('Document ID is required');
    }

    // Encontrar documento
    const document = await this.documentsService.findOne(documentId);
    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Obtener firmas
    const signatures = await this.getDocumentSignatures(documentId);
    if (signatures.length === 0) {
      return {
        intact: true, // No hay firmas para verificar
        signatures: [],
        verifiedAt: new Date(),
        hashAlgorithm: 'SHA-256',
      };
    }

    // Calcular hash actual
    const currentHash = this.cryptoService.generateHash(document.filePath);
    let intact = true;

    // Verificar cada firma con información de usuario
    const verifiedSignatures = await Promise.all(
      signatures.map(async (signature) => {
        // Verificar hash del documento
        const isHashValid = signature.documentHash === currentHash;

        // Si el hash no coincide, el documento ha sido modificado
        if (!isHashValid) {
          intact = false;
        }

        // Verificar también la firma digital
        let isSignatureValid = false;
        let userName = 'Usuario desconocido';

        try {
          // Obtener datos del usuario
          const user = await this.usersService.findOne(signature.userId);
          if (user) {
            userName = user.name;
          }

          // Verificar firma criptográfica
          const dataToSign = signature.metadata?.dataToSign;
          if (dataToSign) {
            isSignatureValid = await this.cryptoService.verifySignature(
              signature.userId,
              dataToSign,
              signature.signatureData,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error verificando firma ${signature.id}: ${error.message}`,
            error.stack,
          );
        }

        // Actualizar estado de validez si es necesario
        if (signature.valid !== (isHashValid && isSignatureValid)) {
          await this.updateSignatureValidity(
            signature,
            isHashValid && isSignatureValid,
            isHashValid
              ? 'Signature verification failed'
              : 'Document has been modified',
          );
        }

        return {
          id: signature.id,
          isValid: isHashValid && isSignatureValid,
          signedAt: signature.signedAt,
          userId: signature.userId,
          userName, // Incluir nombre del usuario
        };
      }),
    );

    let blockchainVerification = null;
    try {
      const documentHash = this.cryptoService.generateHash(document.filePath);
      blockchainVerification = await this.blockchainService.verifyDocument(
        documentId,
        documentHash,
      );

      if (blockchainVerification && !blockchainVerification.verified) {
        intact = false; // Document has been modified according to blockchain
      }
    } catch (blockchainError) {
      this.logger.error(
        `Failed to verify document on blockchain: ${blockchainError.message}`,
        blockchainError.stack,
      );
      // Continue anyway, blockchain verification is not critical
    }

    // Registrar verificación de integridad en auditoría
    await this.auditLogService.log(
      AuditAction.DOCUMENT_SIGN,
      'system',
      documentId,
      {
        action: 'integrity_verification',
        status: intact ? 'intact' : 'modified',
        signatures: verifiedSignatures.length,
      },
    );

    return {
      intact,
      signatures: verifiedSignatures,
      verifiedAt: new Date(),
      hashAlgorithm: 'SHA-256',
      blockchainVerified: blockchainVerification
        ? blockchainVerification.verified
        : null,
      blockchainDetails: blockchainVerification,
    };
  }

  /**
   * Checks if a document can be signed by a specific user
   */
  async canUserSignDocument(
    documentId: string,
    userId: string,
  ): Promise<{ canSign: boolean; reason?: string }> {
    try {
      // Log attempts for debugging
      this.logger.log(
        `Checking if user ${userId} can sign document ${documentId}`,
      );

      // Check document exists and user has access
      try {
        const document = await this.documentsRepository.findOne({
          where: { id: documentId },
        });

        if (!document) {
          this.logger.warn(
            `Document ${documentId} not found when checking signing permissions`,
          );
          return {
            canSign: false,
            reason: 'Document not found',
          };
        }

        // Check document status
        if (document.status !== 'completed' && document.status !== 'pending') {
          return {
            canSign: false,
            reason: `Document is not ready for signing. Current status: ${document.status}`,
          };
        }

        // If user is the document owner, they can sign
        if (document.userId === userId) {
          return { canSign: true };
        }

        // Otherwise check if document is shared with proper permissions
        // This would depend on your sharing implementation
        return { canSign: true }; // Default to allowing for now
      } catch (error) {
        this.logger.error(
          `Error checking document access: ${error.message}`,
          error.stack,
        );
        return {
          canSign: false,
          reason: `Error checking document access: ${error.message}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error in canUserSignDocument: ${error.message}`,
        error.stack,
      );
      return {
        canSign: false,
        reason: error.message,
      };
    }
  }

  /**
   * Gets counterfeit risk assessment for a signature
   * This evaluates various risk factors for signature validity
   */
  async getSignatureRiskAssessment(signatureId: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
  }> {
    const signature = await this.signaturesRepository.findOne({
      where: { id: signatureId },
    });

    if (!signature) {
      throw new NotFoundException(`Signature with ID ${signatureId} not found`);
    }

    const factors: string[] = [];
    let riskPoints = 0;

    // Check basic signature validity
    try {
      const verificationResult = await this.verifySignature(signatureId);
      if (!verificationResult.isValid) {
        factors.push(`Invalid signature: ${verificationResult.reason}`);
        riskPoints += 10; // Major risk factor
      }
    } catch (error) {
      factors.push(`Error verifying signature: ${error.message}`);
      riskPoints += 5;
    }

    // Check user authentication method at signing time
    if (
      !signature.metadata?.authMethod ||
      signature.metadata.authMethod === 'basic'
    ) {
      factors.push('Basic authentication used for signing (no 2FA)');
      riskPoints += 3;
    }

    // Check time of signing
    const signedAt = new Date(signature.signedAt);
    const now = new Date();
    const daysSinceSigned = Math.floor(
      (now.getTime() - signedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceSigned > 365) {
      factors.push('Signature is over a year old');
      riskPoints += 1;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskPoints >= 10) {
      riskLevel = 'high';
    } else if (riskPoints >= 5) {
      riskLevel = 'medium';
    }

    return {
      riskLevel,
      factors,
    };
  }

  /**
   * Firma un documento con verificación biométrica
   */
  async signDocumentWithBiometric(
    documentId: string,
    userId: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
    biometricVerification?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Signature> {
    // Verificación básica de entradas con logs detallados
    if (!documentId || !userId) {
      this.logger.error('Faltan ID de documento o usuario');
      throw new BadRequestException('Document ID and User ID are required');
    }

    try {
      this.logger.log(
        `Iniciando firma biométrica: documento=${documentId}, usuario=${userId}`,
      );

      // Verificar documento
      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        this.logger.warn(`Documento no encontrado: ${documentId}`);
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Verificar usuario
      const user = await this.usersService.findOne(userId);
      if (!user) {
        this.logger.warn(`Usuario no encontrado: ${userId}`);
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Verificar estado del documento
      if (document.status !== 'completed' && document.status !== 'pending') {
        this.logger.warn(`Documento en estado incorrecto: ${document.status}`);
        throw new BadRequestException(
          `Document is not ready for signing. Current status: ${document.status}`,
        );
      }

      // Verificar permisos
      const canSign = await this.canUserSignDocument(documentId, userId);
      if (!canSign.canSign) {
        this.logger.warn(
          `Usuario ${userId} no tiene permisos para firmar ${documentId}`,
        );
        throw new UnauthorizedException(
          canSign.reason || 'No autorizado para firmar',
        );
      }

      // Generar hash del documento para integridad
      this.logger.log(`Generando hash para documento ${document.filePath}`);
      const documentHash = this.cryptoService.generateHash(document.filePath);

      // Datos para firmar (incluye verificación biométrica)
      const timestamp = new Date().toISOString();
      const dataToSign = JSON.stringify({
        documentId,
        documentHash,
        userId,
        timestamp,
        reason,
        position,
        biometricVerification: {
          method: biometricVerification?.method || 'facial-recognition',
          challenge: biometricVerification?.challenge || 'head-turn', // Usamos giro como predeterminado
          timestamp: biometricVerification?.timestamp,
        },
      });

      // Verificar claves del usuario o generar nuevas
      let keyPair = await this.cryptoService.getUserKeyPair(userId);
      if (!keyPair) {
        this.logger.log(`Generando nuevas claves para usuario ${userId}`);
        keyPair = await this.cryptoService.generateKeyPair(userId);
      }

      // Firmar datos
      this.logger.log('Firmando datos con clave privada del usuario');
      const signatureData = await this.cryptoService.signData(
        userId,
        dataToSign,
      );

      if (!signatureData) {
        throw new BadRequestException('Error al generar firma digital');
      }

      // Crear registro de firma con metadatos biométricos
      const signatureEntity = this.signaturesRepository.create({
        id: uuidv4(),
        documentId: document.id,
        userId,
        signatureData,
        documentHash,
        signedAt: new Date(),
        reason: reason || 'Firma con verificación biométrica',
        position: position ? JSON.stringify(position) : null,
        valid: true,
        metadata: {
          userAgent: userAgent || 'Unknown',
          ipAddress: ipAddress || 'Unknown',
          dataToSign,
          biometricVerification: {
            method: biometricVerification?.method || 'facial-recognition',
            challenge: biometricVerification?.challenge || 'head-turn',
            score: biometricVerification?.score || 0.9,
            timestamp: biometricVerification?.timestamp
              ? new Date(biometricVerification.timestamp).toISOString()
              : new Date().toISOString(),
          },
          documentMetadata: {
            title: document.title,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
          },
          securityLevel: 'high',
        },
      });

      // Guardar firma
      this.logger.log('Guardando firma en base de datos');
      const savedSignature =
        await this.signaturesRepository.save(signatureEntity);

      // Actualizar metadatos del documento
      this.logger.log(`Actualizando metadatos del documento ${documentId}`);
      document.metadata = {
        ...document.metadata,
        isSigned: true,
        lastSignedAt: new Date().toISOString(),
        signaturesCount: (document.metadata?.signaturesCount || 0) + 1,
        hasBiometricSignatures: true,
      };

      await this.documentsRepository.save(document);

      // Registrar en log de auditoría
      this.logger.log('Registrando en auditoría');
      await this.auditLogService.log(
        AuditAction.DOCUMENT_SIGN,
        userId,
        documentId,
        {
          title: document.title,
          signatureId: savedSignature.id,
          signatureMethod: 'biometric',
          biometricMethod:
            biometricVerification?.method || 'facial-recognition',
          challenge: biometricVerification?.challenge || 'head-turn',
        },
        ipAddress,
        userAgent,
      );

      // Actualizar en blockchain si está disponible
      try {
        await this.blockchainService.updateDocumentRecord(
          documentId,
          documentHash,
          'SIGNATURE_BIOMETRIC',
          userId,
          {
            signatureId: savedSignature.id,
            timestamp: savedSignature.signedAt.toISOString(),
            method: biometricVerification?.method || 'facial-recognition',
          },
        );
      } catch (blockchainError) {
        this.logger.warn(
          `No se pudo registrar en blockchain: ${blockchainError.message}`,
        );
      }

      this.logger.log(`Firma biométrica completada: ${savedSignature.id}`);
      return savedSignature;
    } catch {
      this.logger.log(`error:`);
    }
  }

  async initMultiSignatureProcess(
    documentId: string,
    ownerUserId: string,
    signerIds: string[],
    requiredSigners?: number,
  ): Promise<void> {
    const document = await this.documentsRepository.findOneBy({
      id: documentId,
    });

    if (!document) {
      throw new NotFoundException(`Documento no encontrado: ${documentId}`);
    }

    // Verificar que el solicitante es el dueño
    if (document.userId !== ownerUserId) {
      throw new UnauthorizedException(
        'Solo el propietario puede iniciar firmas múltiples',
      );
    }

    // Actualizar metadatos del documento
    document.metadata = {
      ...document.metadata,
      multiSignatureProcess: true,
      pendingSigners: signerIds,
      requiredSigners: requiredSigners || signerIds.length, // Por defecto, todos deben firmar
      initiatedAt: new Date().toISOString(),
    };

    await this.documentsService.update(documentId, document);

    // Registrar en blockchain
    await this.blockchainService.updateDocumentRecord(
      documentId,
      this.cryptoService.generateHash(document.filePath),
      'MULTI_SIGNATURE_INIT',
      ownerUserId,
      {
        signerIds,
        requiredSigners,
      },
    );
  }

  async validateSignatureQuorum(documentId: string): Promise<boolean> {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document?.metadata?.multiSignatureProcess) {
      return true; // No es proceso multi-firma
    }

    const signatures = await this.signaturesRepository.find({
      where: { documentId, valid: true },
    });

    const requiredSigners = document.metadata.requiredSigners || 0;

    return signatures.length >= requiredSigners;
  }

  /**
   * Cancela un proceso de firmas múltiples
   */
  async cancelMultiSignatureProcess(
    documentId: string,
    userId: string,
  ): Promise<void> {
    // Verificar documento
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Documento no encontrado: ${documentId}`);
    }

    // Verificar que el solicitante es el dueño
    if (document.userId !== userId) {
      throw new UnauthorizedException(
        'Solo el propietario puede cancelar firmas múltiples',
      );
    }

    // Verificar que existe un proceso activo
    if (!document.metadata?.multiSignatureProcess) {
      throw new BadRequestException(
        'No hay un proceso de firmas múltiples activo para este documento',
      );
    }

    // Actualizar metadatos del documento
    const updatedMetadata = { ...document.metadata };
    delete updatedMetadata.multiSignatureProcess;
    delete updatedMetadata.pendingSigners;
    delete updatedMetadata.requiredSigners;
    delete updatedMetadata.initiatedAt;
    delete updatedMetadata.completedSigners;

    document.metadata = updatedMetadata;

    await this.documentsService.update(documentId, document);

    // Registrar en blockchain
    await this.blockchainService.updateDocumentRecord(
      documentId,
      this.cryptoService.generateHash(document.filePath),
      'MULTI_SIGNATURE_CANCELLED',
      userId,
      {
        timestamp: new Date().toISOString(),
      },
    );

    // Registrar en auditoría
    await this.auditLogService.log(
      AuditAction.DOCUMENT_UPDATE,
      userId,
      documentId,
      {
        action: 'multi_signature_cancel',
        title: document.title,
      },
    );
  }

  /**
   * Obtiene el estado actual del proceso de firmas de un documento
   */
  async getDocumentSignatureStatus(documentId: string): Promise<any> {
    // Obtener documento
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Documento no encontrado: ${documentId}`);
    }

    // Obtener todas las firmas del documento
    const signatures = await this.signaturesRepository.find({
      where: { documentId, valid: true },
    });

    // Si no es un proceso de firmas múltiples, devolver info básica
    if (!document.metadata?.multiSignatureProcess) {
      return {
        multiSignatureProcess: false,
        signatureCount: signatures.length,
        isSigned: signatures.length > 0,
      };
    }

    // Procesar datos de firmas múltiples
    const pendingSigners = document.metadata.pendingSigners || [];
    const requiredSigners = document.metadata.requiredSigners || 0;

    // Determinar quiénes han completado su firma
    const completedSigners = signatures
      .map((sig) => sig.userId)
      .filter((userId) => pendingSigners.includes(userId));

    // Verificar si el proceso está completo (quórum alcanzado)
    const isComplete = completedSigners.length >= requiredSigners;

    // Si el proceso está completo pero no se ha marcado como tal en el documento
    if (isComplete && !document.metadata.processCompleted) {
      // Actualizar documento
      document.metadata = {
        ...document.metadata,
        processCompleted: true,
        completedAt: new Date().toISOString(),
      };

      await this.documentsService.update(documentId, document);

      // Registrar en blockchain
      await this.blockchainService.updateDocumentRecord(
        documentId,
        this.cryptoService.generateHash(document.filePath),
        'MULTI_SIGNATURE_COMPLETED',
        'system',
        {
          completedSigners,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return {
      multiSignatureProcess: true,
      initiatedAt: document.metadata.initiatedAt,
      pendingSigners,
      completedSigners,
      requiredSigners,
      totalSigners: pendingSigners.length,
      isComplete,
      processCompleted: document.metadata.processCompleted || false,
      completedAt: document.metadata.completedAt,
    };
  }

  /**
   * Método sobrecargado para firmar que verifica si el documento está en un proceso
   * de firmas múltiples y actualiza el estado del proceso
   */
  async signDocument(
    documentId: string,
    userId: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Signature> {
    // Firma normal del documento (usando código existente)
    const signature = await this.originalSignDocument(
      documentId,
      userId,
      position,
      reason,
      ipAddress,
      userAgent,
    );

    // Verificar si el documento está en un proceso de firmas múltiples
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (document?.metadata?.multiSignatureProcess) {
      // Actualizar estado del proceso
      const pendingSigners = document.metadata.pendingSigners || [];

      // Verificar si este usuario está en la lista de firmantes pendientes
      if (pendingSigners.includes(userId)) {
        // Obtener lista actual de completados o crear una nueva
        const completedSigners = document.metadata.completedSigners || [];

        // Añadir este firmante si no está ya
        if (!completedSigners.includes(userId)) {
          completedSigners.push(userId);

          // Actualizar documento
          document.metadata = {
            ...document.metadata,
            completedSigners,
          };

          await this.documentsService.update(documentId, document);

          // Verificar si se ha alcanzado el quórum
          const requiredSigners =
            document.metadata.requiredSigners || pendingSigners.length;
          if (
            completedSigners.length >= requiredSigners &&
            !document.metadata.processCompleted
          ) {
            // Marcar proceso como completo
            document.metadata = {
              ...document.metadata,
              processCompleted: true,
              completedAt: new Date().toISOString(),
            };

            await this.documentsService.update(documentId, document);

            // Registrar en blockchain
            await this.blockchainService.updateDocumentRecord(
              documentId,
              this.cryptoService.generateHash(document.filePath),
              'MULTI_SIGNATURE_QUORUM_REACHED',
              'system',
              {
                requiredSigners,
                totalSigners: completedSigners.length,
                timestamp: new Date().toISOString(),
              },
            );

            // Notificar al dueño del documento
            this.notifyDocumentOwner(
              documentId,
              completedSigners.length,
              requiredSigners,
            );
          }
        }
      }
    }

    return signature;
  }

  /**
   * Notifica al propietario del documento que se ha alcanzado el quórum de firmas
   */
  private async notifyDocumentOwner(
    documentId: string,
    completedSignatures: number,
    requiredSignatures: number,
  ): Promise<void> {
    try {
      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
      });

      if (!document) return;

      // Aquí implementaríamos la notificación
      // Podría ser por email, push notification, o un registro en el sistema
      this.logger.log(
        `Notificando al propietario ${document.userId} que su documento ${documentId} 
      ha alcanzado el quórum de firmas (${completedSignatures}/${requiredSignatures})`,
      );

      // Registrar en la auditoría
      await this.auditLogService.log(
        AuditAction.DOCUMENT_UPDATE,
        'system',
        documentId,
        {
          action: 'quorum_reached_notification',
          completedSignatures,
          requiredSignatures,
        },
      );
    } catch (error) {
      this.logger.error(
        `Error al notificar al propietario del documento: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Verifica todas las firmas de un documento y evalúa si se cumple el quórum
   */
  async verifyAllSignatures(documentId: string): Promise<{
    verifiedCount: number;
    invalidCount: number;
    totalCount: number;
    quorumReached: boolean;
    requiredSigners: number;
    signatures: Array<{
      id: string;
      userId: string;
      userName?: string;
      signedAt: Date;
      isValid: boolean;
      reason?: string;
    }>;
  }> {
    // Verificar que el documento existe
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Documento no encontrado: ${documentId}`);
    }

    // Obtener todas las firmas
    const signatures = await this.signaturesRepository.find({
      where: { documentId },
      relations: ['user'],
    });

    if (signatures.length === 0) {
      return {
        verifiedCount: 0,
        invalidCount: 0,
        totalCount: 0,
        quorumReached: false,
        requiredSigners: document.metadata?.requiredSigners || 0,
        signatures: [],
      };
    }

    // Verificar cada firma
    const verificationResults = await Promise.all(
      signatures.map(async (signature) => {
        try {
          const verificationResult = await this.verifySignature(signature.id);

          return {
            id: signature.id,
            userId: signature.userId,
            userName: signature.user?.name,
            signedAt: signature.signedAt,
            isValid: verificationResult.isValid,
            reason: verificationResult.reason,
          };
        } catch (error) {
          this.logger.error(
            `Error verificando firma ${signature.id}: ${error.message}`,
            error.stack,
          );

          return {
            id: signature.id,
            userId: signature.userId,
            userName: signature.user?.name,
            signedAt: signature.signedAt,
            isValid: false,
            reason: `Error en verificación: ${error.message}`,
          };
        }
      }),
    );

    // Contar firmas válidas e inválidas
    const verifiedCount = verificationResults.filter((r) => r.isValid).length;
    const invalidCount = verificationResults.length - verifiedCount;

    // Determinar si se cumple el quórum
    let requiredSigners = 0;
    let quorumReached = false;

    if (document.metadata?.multiSignatureProcess) {
      requiredSigners = document.metadata.requiredSigners || 0;

      // En proceso multifirma, el quórum se basa en el número de firmas requeridas
      quorumReached = verifiedCount >= requiredSigners;

      // Si se ha alcanzado el quórum pero no está marcado como completado, actualizarlo
      if (quorumReached && !document.metadata.processCompleted) {
        document.metadata = {
          ...document.metadata,
          processCompleted: true,
          completedAt: new Date().toISOString(),
        };

        await this.documentsService.update(documentId, document);

        // Registrar en blockchain
        await this.blockchainService.updateDocumentRecord(
          documentId,
          this.cryptoService.generateHash(document.filePath),
          'SIGNATURES_VERIFIED_QUORUM_REACHED',
          'system',
          {
            verifiedSignatures: verifiedCount,
            requiredSigners,
          },
        );
      }
    } else {
      // En firma única, cualquier firma válida es suficiente
      quorumReached = verifiedCount > 0;
    }

    return {
      verifiedCount,
      invalidCount,
      totalCount: verificationResults.length,
      quorumReached,
      requiredSigners,
      signatures: verificationResults,
    };
  }
}
