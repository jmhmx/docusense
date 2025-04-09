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
    @InjectRepository(Document) // Add this line
    private documentsRepository: Repository<Document>, // Add this line
    private readonly cryptoService: CryptoService,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Signs a document with additional validation and security
   */
  async signDocument(
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
    }[];
    verifiedAt: Date;
  }> {
    // Input validation
    if (!documentId) {
      throw new BadRequestException('Document ID is required');
    }

    // Find document
    const document = await this.documentsService.findOne(documentId);
    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Get signatures
    const signatures = await this.getDocumentSignatures(documentId);
    if (signatures.length === 0) {
      return {
        intact: true, // No signatures to verify against
        signatures: [],
        verifiedAt: new Date(),
      };
    }

    // Calculate current hash
    const currentHash = this.cryptoService.generateHash(document.filePath);
    let intact = true;

    // Check each signature
    const verifiedSignatures = await Promise.all(
      signatures.map(async (signature) => {
        const isHashValid = signature.documentHash === currentHash;

        // If hash doesn't match, document has been modified
        if (!isHashValid) {
          intact = false;
        }

        // Also verify the signature itself
        let isSignatureValid = false;
        try {
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
            `Error verifying signature ${signature.id}: ${error.message}`,
            error.stack,
          );
        }

        // Update signature validity if needed
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
        };
      }),
    );

    return {
      intact,
      signatures: verifiedSignatures,
      verifiedAt: new Date(),
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
}
