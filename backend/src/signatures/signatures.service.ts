import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CryptoService } from '../crypto/crypto.service';
import { DocumentsService } from '../documents/documents.service';
import { UsersService } from '../users/users.service';
import { Signature } from './entities/signature.entity';

@Injectable()
export class SignaturesService {
  private readonly logger = new Logger(SignaturesService.name);

  constructor(
    @InjectRepository(Signature)
    private signaturesRepository: Repository<Signature>,
    private readonly cryptoService: CryptoService,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Firma un documento
   */
  async signDocument(
    documentId: string,
    userId: string,
    position?: { page: number; x: number; y: number },
    reason?: string,
  ): Promise<Signature> {
    // Buscar documento
    const document = await this.documentsService.findOne(documentId);

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

    // Obtener hash del documento
    const documentHash = this.cryptoService.generateHash(document.filePath);

    // Generar datos para firmar
    const dataToSign = JSON.stringify({
      documentId,
      documentHash,
      userId,
      timestamp: new Date().toISOString(),
      reason,
    });

    // Obtener o generar par de claves para el usuario
    let keyPair = await this.cryptoService.getUserKeyPair(userId);

    if (!keyPair) {
      this.logger.log(
        `Generando nuevo par de claves para usuario ${user.name} (${userId})`,
      );
      keyPair = await this.cryptoService.generateKeyPair(userId);
    }

    // Firmar datos
    const signature = await this.cryptoService.signData(userId, dataToSign);

    if (!signature) {
      throw new Error('Error al generar la firma digital');
    }

    // Crear registro de firma
    const signatureEntity = this.signaturesRepository.create({
      id: uuidv4(),
      documentId: document.id,
      userId,
      signatureData: signature,
      documentHash,
      signedAt: new Date(),
      reason,
      position: position ? JSON.stringify(position) : null,
      valid: true, // Inicialmente válida
      metadata: {
        userAgent: 'DocuSense Signature Service',
        dataToSign,
      },
    });

    // Guardar firma
    await this.signaturesRepository.save(signatureEntity);

    // Actualizar documento para marcarlo como firmado
    document.metadata = {
      ...document.metadata,
      isSigned: true,
      lastSignedAt: new Date().toISOString(),
      signaturesCount: (document.metadata?.signaturesCount || 0) + 1,
    };

    await this.documentsService.update(documentId, document);

    this.logger.log(`Documento ${documentId} firmado por usuario ${userId}`);

    return signatureEntity;
  }

  /**
   * Verifica una firma específica
   */
  async verifySignature(signatureId: string): Promise<boolean> {
    const signature = await this.signaturesRepository.findOne({
      where: { id: signatureId },
    });

    if (!signature) {
      throw new NotFoundException(`Firma con ID ${signatureId} no encontrada`);
    }

    // Recrear datos originales
    const dataToSign = signature.metadata.dataToSign;

    // Verificar firma
    const isValid = await this.cryptoService.verifySignature(
      signature.userId,
      dataToSign,
      signature.signatureData,
    );

    // Actualizar estado de validez si ha cambiado
    if (signature.valid !== isValid) {
      signature.valid = isValid;
      await this.signaturesRepository.save(signature);
    }

    return isValid;
  }

  /**
   * Obtiene todas las firmas de un documento
   */
  async getDocumentSignatures(documentId: string): Promise<Signature[]> {
    return this.signaturesRepository.find({
      where: { documentId },
      order: { signedAt: 'DESC' },
    });
  }

  /**
   * Obtiene todas las firmas realizadas por un usuario
   */
  async getUserSignatures(userId: string): Promise<Signature[]> {
    return this.signaturesRepository.find({
      where: { userId },
      order: { signedAt: 'DESC' },
    });
  }

  /**
   * Verifica la integridad del documento (si ha sido modificado desde la firma)
   */
  async verifyDocumentIntegrity(documentId: string): Promise<boolean> {
    // Buscar documento
    const document = await this.documentsService.findOne(documentId);

    if (!document) {
      throw new NotFoundException(
        `Documento con ID ${documentId} no encontrado`,
      );
    }

    // Obtener firmas del documento
    const signatures = await this.getDocumentSignatures(documentId);

    if (signatures.length === 0) {
      return true; // No hay firmas que verificar
    }

    // Calcular hash actual del documento
    const currentHash = this.cryptoService.generateHash(document.filePath);

    // Comparar con los hashes almacenados en las firmas
    for (const signature of signatures) {
      if (signature.documentHash !== currentHash) {
        this.logger.warn(
          `Integridad del documento ${documentId} comprometida. Hash actual no coincide con el almacenado en firma ${signature.id}`,
        );
        return false;
      }
    }

    return true;
  }
}
