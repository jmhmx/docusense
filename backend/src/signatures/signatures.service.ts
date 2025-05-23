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
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { SharingService } from '../sharing/sharing.service';

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
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly sharingService: SharingService,
  ) {}

  async signDocumentWithEfirma(
    documentId: string,
    userId: string,
    tokenId: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
  ): Promise<Signature> {
    // Verificar documento
    const document = await this.documentsRepository.findOneBy({
      id: documentId,
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Verificar token y obtener certificado/llave
    const tokenData = await this.tokenService.getTokenData(tokenId);

    if (tokenData.userId !== userId) {
      throw new UnauthorizedException('Token no pertenece al usuario');
    }

    // Generar hash del documento para integridad
    const documentHash = this.cryptoService.generateHash(document.filePath);

    // Preparar datos para firmar con formato PKCS#7/CMS para el SAT
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
      // Crear firma con estándares SAT (PKCS#7)
      signatureData = await this.efirmaService.firmarConEfirma(
        tokenData.certificado,
        tokenData.llave,
        dataToSign,
      );
    } catch (error) {
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

    // Registrar en blockchain
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

    return savedSignature;
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
    // Validar el objeto biometricVerification
    if (!biometricVerification || !biometricVerification.timestamp) {
      throw new BadRequestException(
        'Información de verificación biométrica incompleta',
      );
    }

    // Verificación básica de entradas
    if (!documentId || !userId) {
      throw new BadRequestException('Document ID and User ID are required');
    }

    try {
      // Verificar documento
      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Verificar usuario
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Verificar estado del documento
      if (document.status !== 'completed' && document.status !== 'pending') {
        throw new BadRequestException(
          `Document is not ready for signing. Current status: ${document.status}`,
        );
      }

      // Verificar permisos
      if (document.userId !== userId) {
        const hasAccess = await this.canUserSignDocument(userId, documentId);
        if (!hasAccess.canSign) {
          throw new UnauthorizedException(
            hasAccess.reason ||
              'You do not have permission to sign this document',
          );
        }
      }

      // Generar hash del documento para integridad
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
          method: biometricVerification?.method,
          challenge: biometricVerification?.challenge,
          timestamp: biometricVerification?.timestamp,
        },
      });

      // Verificar claves del usuario
      let keyPair = await this.cryptoService.getUserKeyPair(userId);
      if (!keyPair) {
        this.logger.log(
          `Generating new key pair for user ${user.name} (${userId})`,
        );
        keyPair = await this.cryptoService.generateKeyPair(userId);
      }

      // Firmar datos con seguridad adicional para biometría
      const signatureData = await this.cryptoService.signData(
        userId,
        dataToSign,
      );

      if (!signatureData) {
        throw new BadRequestException('Failed to generate digital signature');
      }

      // Crear registro de firma con metadatos biométricos
      const signatureEntity = this.signaturesRepository.create({
        id: uuidv4(),
        documentId: document.id,
        userId,
        signatureData,
        documentHash,
        signedAt: new Date(),
        reason: reason || 'Document signature with biometric verification',
        position: position ? JSON.stringify(position) : null,
        valid: true,
        metadata: {
          userAgent: userAgent || 'Unknown',
          ipAddress: ipAddress || 'Unknown',
          dataToSign,
          biometricVerification: {
            method: biometricVerification?.method || 'unknown',
            challenge: biometricVerification?.challenge || 'unknown',
            score: biometricVerification?.score || 0,
            timestamp: biometricVerification?.timestamp
              ? new Date(biometricVerification.timestamp).toISOString()
              : new Date().toISOString(),
          },
          documentMetadata: {
            title: document.title,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
          },
          securityLevel: 'high', // Mayor nivel de seguridad con biometría
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
        hasBiometricSignatures: true,
      };

      await this.documentsService.update(documentId, document);

      // Registrar en log de auditoría con detalles biométricos
      await this.auditLogService.log(
        AuditAction.DOCUMENT_SIGN,
        userId,
        documentId,
        {
          title: document.title,
          signatureId: savedSignature.id,
          signatureMethod: 'biometric',
          biometricMethod: biometricVerification?.method || 'unknown',
        },
        ipAddress,
        userAgent,
      );

      this.logger.log(
        `Document ${documentId} signed with biometrics by user ${userId}`,
      );
      return savedSignature;
    } catch (error) {
      this.logger.error(
        `Error en proceso de firma biométrica: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async initMultiSignatureProcess(
    documentId: string,
    ownerUserId: string,
    signerIds: string[],
    requiredSigners?: number,
    options?: {
      customMessage?: string;
      dueDate?: string;
      initiatorInfo?: {
        ipAddress?: string;
        userAgent?: string;
      };
    },
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

    // Obtener información del propietario
    const owner = await this.usersService.findOne(ownerUserId);
    if (!owner) {
      throw new NotFoundException('Propietario del documento no encontrado');
    }

    // Calcular fecha límite si no se proporciona
    const dueDate = options?.dueDate || this.calculateDueDate();

    // Actualizar metadatos del documento con información adicional
    document.metadata = {
      ...document.metadata,
      multiSignatureProcess: true,
      pendingSigners: signerIds,
      requiredSigners: requiredSigners || signerIds.length,
      initiatedAt: new Date().toISOString(),
      initiatedBy: ownerUserId,
      customMessage: options?.customMessage,
      dueDate: dueDate,
      notificationStatus: {
        emailsSent: 0,
        documentsShared: 0,
        totalSigners: signerIds.length,
        lastNotificationSent: new Date().toISOString(),
      },
      completedSigners: [], // Inicializar array de firmantes completados
    };

    await this.documentsService.update(documentId, document);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const documentUrl = `${frontendUrl}/documents/${documentId}`;

    let emailsSent = 0;
    let documentsShared = 0;
    let emailPromises = [];

    // 1. COMPARTIR DOCUMENTO Y ENVIAR NOTIFICACIONES
    for (const signerId of signerIds) {
      try {
        // Obtener información del firmante
        const signer = await this.usersService.findOne(signerId);
        if (!signer) {
          this.logger.warn(`Firmante no encontrado: ${signerId}`);
          continue;
        }

        // Compartir documento con permisos de comentario
        await this.sharingService.shareDocumentWithUser(
          ownerUserId,
          {
            documentId,
            email: signer.email,
            permissionLevel: 'commenter',
            notifyUser: false, // No enviar notificación estándar
          },
          'system',
          'multi-signature-process',
        );
        documentsShared++;

        // Crear promesa de envío de email
        const emailPromise = this.emailService
          .sendTemplateEmail({
            to: signer.email,
            subject: `Solicitud de firma: "${document.title}"`,
            template: 'multi-signature-request',
            context: {
              signerName: signer.name,
              ownerName: owner.name,
              documentTitle: document.title,
              documentUrl: documentUrl,
              requiredSigners: requiredSigners || signerIds.length,
              totalSigners: signerIds.length,
              dueDate: dueDate,
              instructions:
                options?.customMessage || this.getSigningInstructions(),
              customMessage: options?.customMessage,
            },
          })
          .catch((error) => {
            this.logger.error(
              `Error enviando correo a ${signer.email}: ${error.message}`,
            );
            return false; // Devolver false en caso de error para contabilizar correctamente
          });

        emailPromises.push(emailPromise);
        this.logger.log(`Documento compartido con ${signer.email}`);
      } catch (error) {
        this.logger.error(
          `Error procesando firmante ${signerId}: ${error.message}`,
        );
      }
    }

    // Esperar a que todos los correos sean enviados
    try {
      const emailResults = await Promise.allSettled(emailPromises);
      emailsSent = emailResults.filter(
        (result) => result.status === 'fulfilled' && result.value !== false,
      ).length;

      this.logger.log(
        `Se enviaron ${emailsSent} de ${emailPromises.length} correos electrónicos`,
      );
    } catch (error) {
      this.logger.error(`Error enviando notificaciones: ${error.message}`);
    }

    // Actualizar estadísticas de notificaciones en el documento
    document.metadata.notificationStatus = {
      ...document.metadata.notificationStatus,
      emailsSent,
      documentsShared,
      lastNotificationSent: new Date().toISOString(),
    };

    await this.documentsService.update(documentId, document);

    // Registrar en blockchain con información completa
    await this.blockchainService.updateDocumentRecord(
      documentId,
      this.cryptoService.generateHash(document.filePath),
      'MULTI_SIGNATURE_INIT',
      ownerUserId,
      {
        signerIds,
        requiredSigners: requiredSigners || signerIds.length,
        notificationsSent: emailsSent,
        documentsShared: documentsShared,
        customMessage: !!options?.customMessage,
        dueDate: dueDate,
      },
    );

    this.logger.log(
      `Proceso de firmas múltiples iniciado para documento ${documentId}: 
      ${emailsSent}/${signerIds.length} notificaciones enviadas, 
      ${documentsShared}/${signerIds.length} documentos compartidos`,
    );
  }

  /**
   * Obtener estado de notificaciones del proceso de firmas múltiples
   */
  async getMultiSignatureNotificationStatus(documentId: string): Promise<{
    notificationsSent: boolean;
    emailCount: number;
    documentsShared: number;
    lastNotificationDate: string;
    pendingNotifications: string[];
    failedNotifications: string[];
  }> {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document || !document.metadata?.multiSignatureProcess) {
      throw new NotFoundException('Proceso de firmas múltiples no encontrado');
    }

    const notificationStatus = document.metadata.notificationStatus || {};
    const pendingSigners = document.metadata.pendingSigners || [];
    const completedSigners = document.metadata.completedSigners || [];

    // Determinar firmantes que aún no han firmado (notificaciones pendientes)
    const pendingNotifications = pendingSigners.filter(
      (id: string) => !completedSigners.includes(id),
    );

    return {
      notificationsSent: (notificationStatus.emailsSent || 0) > 0,
      emailCount: notificationStatus.emailsSent || 0,
      documentsShared: notificationStatus.documentsShared || 0,
      lastNotificationDate:
        notificationStatus.lastNotificationSent ||
        document.metadata.initiatedAt,
      pendingNotifications,
      failedNotifications: [], // Implementar seguimiento de fallos si es necesario
    };
  }

  /**
   * Validar que todos los firmantes tienen acceso al documento
   */
  async validateSignersAccess(
    documentId: string,
    signerIds: string[],
  ): Promise<{
    validSigners: string[];
    invalidSigners: string[];
    missingUsers: string[];
  }> {
    const validSigners: string[] = [];
    const invalidSigners: string[] = [];
    const missingUsers: string[] = [];

    for (const signerId of signerIds) {
      try {
        // Verificar que el usuario existe
        const user = await this.usersService.findOne(signerId);
        if (!user) {
          missingUsers.push(signerId);
          continue;
        }

        // Verificar que puede acceder al documento
        const canAccess = await this.sharingService.canUserAccessDocument(
          signerId,
          documentId,
        );
        if (canAccess) {
          validSigners.push(signerId);
        } else {
          invalidSigners.push(signerId);
        }
      } catch (error) {
        this.logger.error(
          `Error validating signer ${signerId}: ${error.message}`,
        );
        invalidSigners.push(signerId);
      }
    }

    return {
      validSigners,
      invalidSigners,
      missingUsers,
    };
  }

  /**
   * Obtener estadísticas de rendimiento de notificaciones
   */
  async getNotificationPerformanceStats(): Promise<{
    totalProcessesInitiated: number;
    totalNotificationsSent: number;
    averageNotificationsPerProcess: number;
    successRate: number;
  }> {
    const documentsWithMultiSig = await this.documentsRepository
      .createQueryBuilder('doc')
      .where("doc.metadata->>'multiSignatureProcess' = 'true'")
      .getMany();

    let totalNotificationsSent = 0;
    let totalProcessesInitiated = documentsWithMultiSig.length;

    for (const doc of documentsWithMultiSig) {
      const notificationStatus = doc.metadata?.notificationStatus;
      if (notificationStatus) {
        totalNotificationsSent += notificationStatus.emailsSent || 0;
      }
    }

    const averageNotificationsPerProcess =
      totalProcessesInitiated > 0
        ? Math.round(totalNotificationsSent / totalProcessesInitiated)
        : 0;

    // Calcular tasa de éxito (simplificado - asumiendo que si se enviaron notificaciones, fueron exitosas)
    const successRate =
      totalProcessesInitiated > 0
        ? Math.round(
            (totalNotificationsSent / (totalProcessesInitiated * 10)) * 100,
          ) // Asumiendo promedio de 10 firmantes
        : 0;

    return {
      totalProcessesInitiated,
      totalNotificationsSent,
      averageNotificationsPerProcess,
      successRate: Math.min(successRate, 100),
    };
  }

  /**
   * Reenviar notificaciones a firmantes específicos
   */
  async resendMultiSignatureNotifications(
    documentId: string,
    ownerUserId: string,
    signerIds?: string[],
    customMessage?: string,
  ): Promise<{
    sent: number;
    failed: number;
    details: string[];
  }> {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document || !document.metadata?.multiSignatureProcess) {
      throw new NotFoundException('Proceso de firmas múltiples no encontrado');
    }

    if (document.userId !== ownerUserId) {
      throw new UnauthorizedException(
        'Solo el propietario puede reenviar notificaciones',
      );
    }

    const owner = await this.usersService.findOne(ownerUserId);
    const pendingSigners = document.metadata.pendingSigners || [];
    const completedSigners = document.metadata.completedSigners || [];

    // Determinar a quién enviar: IDs específicos o todos los pendientes
    const targetSigners =
      signerIds ||
      pendingSigners.filter((id: string) => !completedSigners.includes(id));

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const documentUrl = `${frontendUrl}/documents/${documentId}`;

    let sent = 0;
    let failed = 0;
    const details: string[] = [];

    for (const signerId of targetSigners) {
      try {
        const signer = await this.usersService.findOne(signerId);
        if (!signer) {
          failed++;
          details.push(`Firmante no encontrado: ${signerId}`);
          continue;
        }

        await this.emailService.sendTemplateEmail({
          to: signer.email,
          subject: `Recordatorio de firma: "${document.title}"`,
          template: 'signature-reminder',
          context: {
            signerName: signer.name,
            ownerName: owner.name,
            documentTitle: document.title,
            documentUrl: documentUrl,
            recentSignerName: 'Sistema (Recordatorio)',
            completedSigners: completedSigners.length,
            requiredSigners: document.metadata.requiredSigners,
            progress: Math.round(
              (completedSigners.length / document.metadata.requiredSigners) *
                100,
            ),
            customMessage:
              customMessage ||
              'Este es un recordatorio para firmar el documento.',
          },
        });

        sent++;
        details.push(`Recordatorio enviado a ${signer.email}`);
      } catch (error) {
        failed++;
        details.push(`Error enviando a ${signerId}: ${error.message}`);
      }
    }

    // Actualizar estadísticas de notificaciones
    if (document.metadata.notificationStatus) {
      document.metadata.notificationStatus.lastNotificationSent =
        new Date().toISOString();
    }

    await this.documentsService.update(documentId, document);

    this.logger.log(
      `Recordatorios reenviados: ${sent} exitosos, ${failed} fallidos`,
    );

    return { sent, failed, details };
  }

  /**
   * Envía notificaciones por email a todos los firmantes del proceso de firmas múltiples
   */
  private async notifySignersForMultiSignatureProcess(
    document: Document,
    owner: any,
    signerIds: string[],
    requiredSigners: number,
    documentUrl: string,
  ): Promise<void> {
    const notifications = [];

    for (const signerId of signerIds) {
      try {
        const signer = await this.usersService.findOne(signerId);
        if (!signer) {
          this.logger.warn(
            `Firmante no encontrado para notificación: ${signerId}`,
          );
          continue;
        }

        // Crear promesa de envío de email
        const emailPromise = this.emailService.sendTemplateEmail({
          to: signer.email,
          subject: `Solicitud de firma: "${document.title}"`,
          template: 'multi-signature-request',
          context: {
            signerName: signer.name,
            ownerName: owner.name,
            documentTitle: document.title,
            documentUrl: documentUrl,
            requiredSigners: requiredSigners,
            totalSigners: signerIds.length,
            dueDate: this.calculateDueDate(), // 7 días por defecto
            instructions: this.getSigningInstructions(),
          },
        });

        notifications.push(emailPromise);
      } catch (error) {
        this.logger.error(
          `Error preparando notificación para ${signerId}: ${error.message}`,
        );
      }
    }

    // Enviar todas las notificaciones en paralelo
    try {
      const results = await Promise.allSettled(notifications);

      let successCount = 0;
      let failedCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          this.logger.log(
            `Notificación enviada exitosamente al firmante ${signerIds[index]}`,
          );
        } else {
          failedCount++;
          this.logger.error(
            `Error enviando notificación al firmante ${signerIds[index]}: ${result.reason}`,
          );
        }
      });

      this.logger.log(
        `Notificaciones de firma múltiple: ${successCount} exitosas, ${failedCount} fallidas`,
      );
    } catch (error) {
      this.logger.error(
        `Error enviando notificaciones masivas: ${error.message}`,
      );
    }
  }

  /**
   * Calcula fecha límite para firmar (7 días por defecto)
   */
  private calculateDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 días para firmar
    return dueDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Obtiene instrucciones para el proceso de firma
   */
  private getSigningInstructions(): string {
    return 'Para firmar el documento, haga clic en el enlace anterior, inicie sesión en su cuenta y siga las instrucciones en pantalla. Si necesita ayuda, contacte al administrador del sistema.';
  }

  /**
   * Notifica cuando un firmante completa su firma en proceso múltiple
   */
  private async notifyMultiSignatureProgress(
    document: Document,
    signer: any,
    signature: Signature,
    completedSigners: number,
    requiredSigners: number,
    remainingSigners: string[],
  ): Promise<void> {
    try {
      // Obtener usuarios con acceso al documento (incluyendo propietario)
      const usersWithAccess = await this.sharingService.getDocumentUsers(
        document.id,
        signer.id,
      );

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const documentUrl = `${frontendUrl}/documents/${document.id}`;

      // Notificar al propietario del documento
      const owner = usersWithAccess.find((user) => user.id === document.userId);
      if (owner) {
        await this.emailService.sendTemplateEmail({
          to: owner.email,
          subject: `Progreso de firmas: "${document.title}"`,
          template: 'multi-signature-progress',
          context: {
            ownerName: owner.name,
            signerName: signer.name,
            documentTitle: document.title,
            documentUrl: documentUrl,
            completedSigners: completedSigners,
            requiredSigners: requiredSigners,
            remainingSigners: remainingSigners.length,
            progress: Math.round((completedSigners / requiredSigners) * 100),
            isComplete: completedSigners >= requiredSigners,
          },
        });
      }

      // Si quedan firmantes pendientes, recordarles
      if (remainingSigners.length > 0 && completedSigners < requiredSigners) {
        for (const remainingSignerId of remainingSigners) {
          try {
            const remainingSigner =
              await this.usersService.findOne(remainingSignerId);
            if (remainingSigner) {
              await this.emailService.sendTemplateEmail({
                to: remainingSigner.email,
                subject: `Recordatorio de firma: "${document.title}"`,
                template: 'signature-reminder',
                context: {
                  signerName: remainingSigner.name,
                  documentTitle: document.title,
                  documentUrl: documentUrl,
                  recentSignerName: signer.name,
                  completedSigners: completedSigners,
                  requiredSigners: requiredSigners,
                  progress: Math.round(
                    (completedSigners / requiredSigners) * 100,
                  ),
                },
              });
            }
          } catch (error) {
            this.logger.error(
              `Error enviando recordatorio a ${remainingSignerId}: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error enviando notificaciones de progreso: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si se ha alcanzado el quorum basándose en firmas reales
   */
  async validateSignatureQuorum(documentId: string): Promise<boolean> {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (!document?.metadata?.multiSignatureProcess) {
      return true; // No es proceso multi-firma
    }

    // Obtener firmas válidas reales
    const signatures = await this.signaturesRepository.find({
      where: { documentId, valid: true },
    });

    const pendingSigners = document.metadata.pendingSigners || [];
    const requiredSigners = document.metadata.requiredSigners || 0;

    // Contar firmas de usuarios que están en la lista de firmantes pendientes
    const validCompletedSigners = signatures
      .map((sig) => sig.userId)
      .filter((userId) => pendingSigners.includes(userId));

    const quorumReached = validCompletedSigners.length >= requiredSigners;

    // Si el quorum se alcanzó pero no está marcado en la BD, actualizar
    if (quorumReached && !document.metadata.processCompleted) {
      document.metadata = {
        ...document.metadata,
        completedSigners: validCompletedSigners,
        processCompleted: true,
        completedAt: new Date().toISOString(),
      };

      await this.documentsService.update(documentId, document);

      this.logger.log(
        `Firmas Completadas para documento ${documentId}: ${validCompletedSigners.length}/${requiredSigners}`,
      );
    }

    return quorumReached;
  }

  /**
   * Método para sincronizar el estado de todos los documentos con procesos de firmas múltiples
   * Útil para ejecutar al iniciar el servicio o periódicamente
   */
  async syncAllMultiSignatureProcesses(): Promise<void> {
    try {
      // Buscar todos los documentos con procesos de firmas múltiples activos
      const documentsWithMultiSig = await this.documentsRepository
        .createQueryBuilder('doc')
        .where("doc.metadata->>'multiSignatureProcess' = 'true'")
        .andWhere("doc.metadata->>'processCompleted' != 'true'")
        .getMany();

      this.logger.log(
        `Sincronizando ${documentsWithMultiSig.length} documentos con procesos de firma múltiple`,
      );

      for (const document of documentsWithMultiSig) {
        try {
          await this.getDocumentSignatureStatus(document.id);
        } catch (error) {
          this.logger.error(
            `Error sincronizando documento ${document.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        'Sincronización de procesos de firma múltiple completada',
      );
    } catch (error) {
      this.logger.error(`Error en sincronización masiva: ${error.message}`);
    }
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

    // Obtener todas las firmas válidas del documento
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

    // CORRECCIÓN: Calcular completedSigners basándose en las firmas reales
    const actualCompletedSigners = signatures
      .map((sig) => sig.userId)
      .filter((userId) => pendingSigners.includes(userId));

    // Verificar si el proceso está completo (quórum alcanzado)
    const isComplete = actualCompletedSigners.length >= requiredSigners;

    // CORRECCIÓN: Verificar y actualizar el estado si es necesario
    const storedCompletedSigners = document.metadata.completedSigners || [];
    const processCompletedInDB = document.metadata.processCompleted || false;

    // Si el estado calculado no coincide con el almacenado, actualizar
    if (
      isComplete !== processCompletedInDB ||
      actualCompletedSigners.length !== storedCompletedSigners.length
    ) {
      this.logger.log(`Sincronizando estado del documento ${documentId}: 
        Calculado: ${isComplete}, BD: ${processCompletedInDB}
        Firmas calculadas: ${actualCompletedSigners.length}, BD: ${storedCompletedSigners.length}`);

      // Actualizar documento con el estado real
      document.metadata = {
        ...document.metadata,
        completedSigners: actualCompletedSigners,
        processCompleted: isComplete,
        completedAt:
          isComplete && !processCompletedInDB
            ? new Date().toISOString()
            : document.metadata.completedAt,
      };

      await this.documentsService.update(documentId, document);

      // Si se completó el proceso y no estaba marcado antes, registrar en blockchain
      if (isComplete && !processCompletedInDB) {
        try {
          await this.blockchainService.updateDocumentRecord(
            documentId,
            this.cryptoService.generateHash(document.filePath),
            'MULTI_SIGNATURE_COMPLETED_SYNC',
            'system',
            {
              completedSigners: actualCompletedSigners,
              timestamp: new Date().toISOString(),
              reason: 'quorum_sync',
            },
          );
        } catch (error) {
          this.logger.error(
            `Error registrando sincronización en blockchain: ${error.message}`,
          );
        }
      }
    }

    return {
      multiSignatureProcess: true,
      initiatedAt: document.metadata.initiatedAt,
      pendingSigners,
      completedSigners: actualCompletedSigners, // Usar los calculados
      requiredSigners,
      totalSigners: pendingSigners.length,
      isComplete,
      processCompleted: isComplete, // Usar el estado calculado
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
    // Firma normal del documento
    const signature = await this.originalSignDocument(
      documentId,
      userId,
      position,
      reason,
      ipAddress,
      userAgent,
    );

    // Verificar si es proceso de firmas múltiples
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
    });

    if (document?.metadata?.multiSignatureProcess) {
      const pendingSigners = document.metadata.pendingSigners || [];
      const completedSigners = document.metadata.completedSigners || [];

      if (
        pendingSigners.includes(userId) &&
        !completedSigners.includes(userId)
      ) {
        const newCompletedSigners = [...completedSigners, userId];
        const requiredSigners =
          document.metadata.requiredSigners || pendingSigners.length;
        const remainingSigners = pendingSigners.filter(
          (id) => !newCompletedSigners.includes(id),
        );

        // Actualizar documento
        document.metadata = {
          ...document.metadata,
          completedSigners: newCompletedSigners,
        };

        const isProcessComplete = newCompletedSigners.length >= requiredSigners;

        if (isProcessComplete && !document.metadata.processCompleted) {
          document.metadata.processCompleted = true;
          document.metadata.completedAt = new Date().toISOString();

          // Registrar completitud en blockchain
          await this.blockchainService.updateDocumentRecord(
            documentId,
            this.cryptoService.generateHash(document.filePath),
            'MULTI_SIGNATURE_QUORUM_REACHED',
            'system',
            {
              requiredSigners,
              totalSigners: newCompletedSigners.length,
              completedAt: new Date().toISOString(),
            },
          );

          // Notificar completitud
          await this.notifySignaturesCompleted(
            documentId,
            document,
            await this.usersService.findOne(userId),
          );
        } else {
          // Notificar progreso si no está completo
          const signer = await this.usersService.findOne(userId);
          await this.notifyMultiSignatureProgress(
            document,
            signer,
            signature,
            newCompletedSigners.length,
            requiredSigners,
            remainingSigners,
          );
        }

        await this.documentsService.update(documentId, document);
      }
    }

    return signature;
  }

  // Método auxiliar para obtener nombres de firmantes pendientes
  private async getPendingSignersNames(
    pendingSigners: string[],
    completedSigners: string[],
  ): Promise<string> {
    const stillPendingIds = pendingSigners.filter(
      (id) => !completedSigners.includes(id),
    );

    if (stillPendingIds.length === 0) return '';

    try {
      const pendingUsers = await Promise.all(
        stillPendingIds.map((id) => this.usersService.findOne(id)),
      );

      return pendingUsers
        .filter((user) => user)
        .map((user) => user.name)
        .join(', ');
    } catch (error) {
      this.logger.error(
        `Error obteniendo nombres de firmantes: ${error.message}`,
      );
      return '';
    }
  }

  // Método para notificar a todos los usuarios con acceso al documento sobre una firma
  private async notifyDocumentSigned(
    documentId: string,
    document: Document,
    signer: any,
    signature: Signature,
    pendingSigners: string,
    completedSigners: number,
    totalRequiredSigners: number,
    isMultiSignatureProcess: boolean,
  ): Promise<void> {
    try {
      // Obtener usuarios con acceso al documento
      const usersWithAccess = await this.sharingService.getDocumentUsers(
        documentId,
        signer.id,
      );

      // Filtrar al firmante para no enviarle notificación
      const usersToNotify = usersWithAccess.filter(
        (user) => user.id !== signer.id,
      );

      // Obtener URL del frontend
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const documentUrl = `${frontendUrl}/documents/${documentId}`;

      for (const user of usersToNotify) {
        await this.emailService.sendDocumentSignedEmail(user.email, {
          userName: user.name,
          signerName: signer.name,
          documentTitle: document.title,
          documentUrl: documentUrl,
          signatureDate: signature.signedAt.toLocaleString(),
          signatureReason: signature.reason,
          pendingSigners:
            isMultiSignatureProcess && pendingSigners
              ? pendingSigners
              : undefined,
          completedSigners: isMultiSignatureProcess
            ? completedSigners
            : undefined,
          totalRequiredSigners: isMultiSignatureProcess
            ? totalRequiredSigners
            : undefined,
        });
        this.logger.log(`Notificación de firma enviada a ${user.email}`);
      }
    } catch (error) {
      this.logger.error(
        `Error enviando notificaciones de firma: ${error.message}`,
      );
    }
  }

  private async notifySignaturesCompleted(
    documentId: string,
    document: Document,
    lastSigner: any,
  ): Promise<void> {
    try {
      // Obtener todas las firmas del documento
      const signatures = await this.getDocumentSignatures(documentId);

      // Obtener usuarios con acceso al documento
      const usersWithAccess = await this.sharingService.getDocumentUsers(
        documentId,
        null,
      );

      // Obtener URL del frontend
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const documentUrl = `${frontendUrl}/documents/${documentId}`;

      // Preparar datos de firmantes para la plantilla
      const signers = await Promise.all(
        signatures.map(async (signature) => {
          const user = await this.usersService.findOne(signature.userId);
          return {
            name: user
              ? user.name
              : `Usuario ${signature.userId.substring(0, 6)}...`,
            date: signature.signedAt.toLocaleString(),
          };
        }),
      );

      // Enviar notificación a todos los usuarios con acceso
      for (const user of usersWithAccess) {
        await this.emailService.sendSignaturesCompletedEmail(user.email, {
          userName: user.name,
          documentTitle: document.title,
          documentUrl: documentUrl,
          signers: signers,
        });
        this.logger.log(
          `Notificación de proceso completado enviada a ${user.email}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error enviando notificaciones de proceso completado: ${error.message}`,
      );
    }
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

    // Obtener el usuario que cancela el proceso
    const canceler = await this.usersService.findOne(userId);

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

    // Notificar a todos los participantes que se ha cancelado el proceso
    await this.notifySignaturesCancelled(documentId, document, canceler);
  }

  // Método para notificar a todos cuando se cancela un proceso de firmas
  private async notifySignaturesCancelled(
    documentId: string,
    document: Document,
    canceler: any,
  ): Promise<void> {
    try {
      // Obtener usuarios con acceso al documento
      const usersWithAccess = await this.sharingService.getDocumentUsers(
        documentId,
        null,
      );

      // Obtener URL del frontend
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const documentUrl = `${frontendUrl}/documents/${documentId}`;

      // Enviar notificación a todos los usuarios con acceso
      for (const user of usersWithAccess) {
        // Evitar enviar notificación al usuario que cancela el proceso
        if (user.id !== canceler.id) {
          await this.emailService.sendSignaturesCancelledEmail(user.email, {
            userName: user.name,
            cancelerName: canceler.name,
            documentTitle: document.title,
            documentUrl: documentUrl,
          });
          this.logger.log(
            `Notificación de cancelación enviada a ${user.email}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error enviando notificaciones de cancelación: ${error.message}`,
      );
    }
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

  /**
   * Método para firmar un documento con firma autógrafa después de verificación 2FA
   */
  async signDocumentWithAutografa(
    documentId: string,
    userId: string,
    firmaAutografaSvg: string,
    position?: {
      page: number;
      x: number;
      y: number;
      width?: number;
      height?: number;
    },
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Signature> {
    // Validación básica
    if (!documentId || !userId || !firmaAutografaSvg) {
      throw new BadRequestException('Faltan datos necesarios para la firma');
    }

    // Debug: Verificar datos de imagen
    console.log('=== DEBUG FIRMA AUTÓGRAFA ===');
    console.log('Longitud de imagen:', firmaAutografaSvg.length);
    console.log('Prefijo de imagen:', firmaAutografaSvg.substring(0, 100));
    console.log('Posición recibida:', position);

    // Validar formato de imagen
    if (!firmaAutografaSvg.startsWith('data:image/')) {
      console.error(
        'Formato de imagen inválido:',
        firmaAutografaSvg.substring(0, 50),
      );
      throw new BadRequestException('Formato de imagen inválido');
    }

    // Verificar que hay datos base64
    const base64Part = firmaAutografaSvg.split(',')[1];
    if (!base64Part || base64Part.length < 100) {
      console.error('Datos base64 insuficientes:', base64Part?.length || 0);
      throw new BadRequestException('Datos de imagen insuficientes');
    }

    try {
      // Verificar documento y usuario
      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
      });
      if (!document) {
        throw new NotFoundException(`Documento no encontrado: ${documentId}`);
      }

      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`Usuario no encontrado: ${userId}`);
      }

      // Verificar permisos
      const canSignResult = await this.canUserSignDocument(documentId, userId);
      if (!canSignResult.canSign) {
        throw new UnauthorizedException(
          canSignResult.reason || 'Sin permisos para firmar',
        );
      }

      // Generar hash del documento
      const documentHash = this.cryptoService.generateHash(document.filePath);

      // Crear entidad de firma con debug
      const signatureEntity = this.signaturesRepository.create({
        id: uuidv4(),
        documentId: document.id,
        userId,
        signatureData: firmaAutografaSvg, // Guardar imagen completa
        documentHash,
        signedAt: new Date(),
        reason: reason || 'Firma autógrafa con verificación 2FA',
        position: position ? JSON.stringify(position) : null,
        valid: true,
        metadata: {
          signatureType: 'autografa',
          authMethod: '2FA',
          userAgent,
          ipAddress,
          imageDataLength: firmaAutografaSvg.length,
          positionData: position,
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

      // Debug: Verificar lo que se guardó
      console.log('Firma guardada con ID:', savedSignature.id);
      console.log(
        'Datos guardados - longitud:',
        savedSignature.signatureData.length,
      );
      console.log(
        'Metadatos:',
        JSON.stringify(savedSignature.metadata, null, 2),
      );

      // Actualizar documento
      document.metadata = {
        ...document.metadata,
        isSigned: true,
        lastSignedAt: new Date().toISOString(),
        signaturesCount: (document.metadata?.signaturesCount || 0) + 1,
        hasAutografaSignatures: true,
      };

      await this.documentsService.update(documentId, document);

      // Registrar en auditoría
      await this.auditLogService.log(
        AuditAction.DOCUMENT_SIGN,
        userId,
        documentId,
        {
          title: document.title,
          signatureId: savedSignature.id,
          signatureType: 'autografa',
          imageDataLength: firmaAutografaSvg.length,
        },
        ipAddress,
        userAgent,
      );

      console.log('=== FIN DEBUG FIRMA AUTÓGRAFA ===');
      return savedSignature;
    } catch (error) {
      console.error('Error en firma autógrafa:', error.message, error.stack);
      throw error;
    }
  }

  // Método auxiliar para actualizar estado de firmas múltiples
  private async updateMultiSignatureStatus(
    document: Document,
    userId: string,
  ): Promise<void> {
    if (!document.metadata?.multiSignatureProcess) {
      return; // No es un proceso de firmas múltiples
    }

    // Obtener lista actual de firmantes completados
    const completedSigners = document.metadata.completedSigners || [];

    // Añadir este usuario si no está ya en la lista
    if (!completedSigners.includes(userId)) {
      completedSigners.push(userId);

      // Actualizar metadatos del documento
      document.metadata = {
        ...document.metadata,
        completedSigners,
      };

      // Verificar si se ha alcanzado el quórum
      const requiredSigners = document.metadata.requiredSigners || 0;
      if (completedSigners.length >= requiredSigners) {
        document.metadata.processCompleted = true;
        document.metadata.completedAt = new Date().toISOString();
      }

      await this.documentsService.update(document.id, document);

      // Si se completó el proceso, registrar en blockchain
      if (document.metadata.processCompleted) {
        try {
          await this.blockchainService.updateDocumentRecord(
            document.id,
            this.cryptoService.generateHash(document.filePath),
            'MULTI_SIGNATURE_COMPLETED',
            'system',
            {
              completedSigners,
              timestamp: new Date().toISOString(),
            },
          );
        } catch (error) {
          this.logger.error(
            `Error al registrar completitud en blockchain: ${error.message}`,
            error.stack,
          );
        }
      }
    }
  }

  /**
   * Obtiene estadísticas de procesos de firmas múltiples
   */
  async getMultiSignatureStats(): Promise<{
    activeProcesses: number;
    completedProcesses: number;
    pendingSignatures: number;
    averageCompletionTime: number;
  }> {
    try {
      // Consultar documentos con procesos de firmas múltiples
      const activeProcesses = await this.documentsRepository
        .createQueryBuilder('doc')
        .where("doc.metadata->>'multiSignatureProcess' = 'true'")
        .andWhere("doc.metadata->>'processCompleted' != 'true'")
        .getCount();

      const completedProcesses = await this.documentsRepository
        .createQueryBuilder('doc')
        .where("doc.metadata->>'multiSignatureProcess' = 'true'")
        .andWhere("doc.metadata->>'processCompleted' = 'true'")
        .getCount();

      // Calcular firmas pendientes
      const activeDocuments = await this.documentsRepository
        .createQueryBuilder('doc')
        .where("doc.metadata->>'multiSignatureProcess' = 'true'")
        .andWhere("doc.metadata->>'processCompleted' != 'true'")
        .getMany();

      let pendingSignatures = 0;
      for (const doc of activeDocuments) {
        const pendingSigners = doc.metadata?.pendingSigners || [];
        const completedSigners = doc.metadata?.completedSigners || [];
        pendingSignatures += pendingSigners.length - completedSigners.length;
      }

      // Calcular tiempo promedio de completitud (simplificado)
      const completedDocs = await this.documentsRepository
        .createQueryBuilder('doc')
        .where("doc.metadata->>'multiSignatureProcess' = 'true'")
        .andWhere("doc.metadata->>'processCompleted' = 'true'")
        .andWhere("doc.metadata->>'initiatedAt' IS NOT NULL")
        .andWhere("doc.metadata->>'completedAt' IS NOT NULL")
        .getMany();

      let totalTime = 0;
      for (const doc of completedDocs) {
        const initiated = new Date(doc.metadata.initiatedAt);
        const completed = new Date(doc.metadata.completedAt);
        totalTime += completed.getTime() - initiated.getTime();
      }

      const averageCompletionTime =
        completedDocs.length > 0
          ? Math.round(totalTime / completedDocs.length / (1000 * 60 * 60 * 24)) // días
          : 0;

      return {
        activeProcesses,
        completedProcesses,
        pendingSignatures,
        averageCompletionTime,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene procesos activos de firmas múltiples con paginación
   */
  async getActiveMultiSignatureProcesses(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    processes: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      const [documents, total] = await this.documentsRepository
        .createQueryBuilder('doc')
        .leftJoinAndSelect('doc.user', 'user')
        .where("doc.metadata->>'multiSignatureProcess' = 'true'")
        .andWhere("doc.metadata->>'processCompleted' != 'true'")
        .orderBy('doc.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      const processes = await Promise.all(
        documents.map(async (doc) => {
          const pendingSigners = doc.metadata?.pendingSigners || [];
          const completedSigners = doc.metadata?.completedSigners || [];
          const requiredSigners =
            doc.metadata?.requiredSigners || pendingSigners.length;

          // Obtener información de firmantes
          const signerDetails = await Promise.all(
            pendingSigners.map(async (signerId: string) => {
              try {
                const user = await this.usersService.findOne(signerId);
                return {
                  id: signerId,
                  name: user.name,
                  email: user.email,
                  hasSigned: completedSigners.includes(signerId),
                };
              } catch {
                return {
                  id: signerId,
                  name: 'Usuario no encontrado',
                  email: 'N/A',
                  hasSigned: completedSigners.includes(signerId),
                };
              }
            }),
          );

          return {
            documentId: doc.id,
            title: doc.title,
            owner: {
              name: doc.user?.name || 'N/A',
              email: doc.user?.email || 'N/A',
            },
            initiatedAt: doc.metadata?.initiatedAt,
            requiredSigners,
            completedSigners: completedSigners.length,
            pendingSigners: pendingSigners.length - completedSigners.length,
            progress: Math.round(
              (completedSigners.length / requiredSigners) * 100,
            ),
            signers: signerDetails,
          };
        }),
      );

      return {
        processes,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error obteniendo procesos activos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envía recordatorios masivos a firmantes pendientes
   */
  async sendBulkSignatureReminders(): Promise<{
    sent: number;
    failed: number;
    details: string[];
  }> {
    try {
      const activeDocuments = await this.documentsRepository
        .createQueryBuilder('doc')
        .where("doc.metadata->>'multiSignatureProcess' = 'true'")
        .andWhere("doc.metadata->>'processCompleted' != 'true'")
        .getMany();

      let sent = 0;
      let failed = 0;
      const details: string[] = [];

      for (const doc of activeDocuments) {
        const pendingSigners = doc.metadata?.pendingSigners || [];
        const completedSigners = doc.metadata?.completedSigners || [];
        const remainingSigners = pendingSigners.filter(
          (id: string) => !completedSigners.includes(id),
        );

        for (const signerId of remainingSigners) {
          try {
            const signer = await this.usersService.findOne(signerId);
            const owner = await this.usersService.findOne(doc.userId);

            if (signer && owner) {
              const frontendUrl =
                this.configService.get<string>('FRONTEND_URL') ||
                'http://localhost:3001';

              await this.emailService.sendSignatureReminderEmail(signer.email, {
                signerName: signer.name,
                documentTitle: doc.title,
                documentUrl: `${frontendUrl}/documents/${doc.id}`,
                recentSignerName: 'Sistema',
                completedSigners: completedSigners.length,
                requiredSigners:
                  doc.metadata?.requiredSigners || pendingSigners.length,
                progress: Math.round(
                  (completedSigners.length /
                    (doc.metadata?.requiredSigners || pendingSigners.length)) *
                    100,
                ),
              });

              sent++;
              details.push(
                `Recordatorio enviado a ${signer.email} para documento "${doc.title}"`,
              );
            }
          } catch (error) {
            failed++;
            details.push(
              `Error enviando recordatorio para documento "${doc.title}": ${error.message}`,
            );
          }
        }
      }

      this.logger.log(
        `Recordatorios masivos: ${sent} enviados, ${failed} fallidos`,
      );

      return {
        sent,
        failed,
        details,
      };
    } catch (error) {
      this.logger.error(`Error en recordatorios masivos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene detalles completos de un proceso de firmas múltiples
   */
  async getMultiSignatureProcessDetails(documentId: string): Promise<any> {
    try {
      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
      });

      if (!document || !document.metadata?.multiSignatureProcess) {
        throw new NotFoundException(
          'Proceso de firmas múltiples no encontrado',
        );
      }

      const owner = await this.usersService.findOne(document.userId);
      const signatures = await this.getDocumentSignatures(documentId);

      const pendingSigners = document.metadata?.pendingSigners || [];
      const completedSigners = document.metadata?.completedSigners || [];
      const requiredSigners =
        document.metadata?.requiredSigners || pendingSigners.length;

      // Obtener detalles de todos los firmantes
      const signerDetails = await Promise.all(
        pendingSigners.map(async (signerId: string) => {
          const user = await this.usersService.findOne(signerId);
          const signature = signatures.find((s) => s.userId === signerId);

          return {
            id: signerId,
            name: user?.name || 'Usuario no encontrado',
            email: user?.email || 'N/A',
            hasSigned: completedSigners.includes(signerId),
            signedAt: signature?.signedAt || null,
            signatureValid: signature?.valid || false,
          };
        }),
      );

      return {
        documentId: document.id,
        title: document.title,
        owner: {
          id: owner?.id,
          name: owner?.name || 'N/A',
          email: owner?.email || 'N/A',
        },
        initiatedAt: document.metadata.initiatedAt,
        completedAt: document.metadata.completedAt,
        isCompleted: document.metadata.processCompleted || false,
        requiredSigners,
        totalSigners: pendingSigners.length,
        completedSignatures: completedSigners.length,
        pendingSignatures: pendingSigners.length - completedSigners.length,
        progress: Math.round((completedSigners.length / requiredSigners) * 100),
        signers: signerDetails,
        signatures: signatures.map((sig) => ({
          id: sig.id,
          userId: sig.userId,
          signedAt: sig.signedAt,
          valid: sig.valid,
          reason: sig.reason,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error obteniendo detalles del proceso: ${error.message}`,
      );
      throw error;
    }
  }
}
