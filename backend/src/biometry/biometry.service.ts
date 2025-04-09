// src/biometry/biometry.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BiometricData } from './entities/biometric-data.entity';
import { CryptoService } from '../crypto/crypto.service';
import { UsersService } from '../users/users.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { RegisterBiometryDto } from './dto/register-biometry.dto';
import { VerifyBiometryDto } from './dto/verify-biometry.dto';
import { LivenessCheckDto } from './dto/liveness-check.dto';

@Injectable()
export class BiometryService {
  private readonly logger = new Logger(BiometryService.name);

  constructor(
    @InjectRepository(BiometricData)
    private biometricDataRepository: Repository<BiometricData>,
    private readonly cryptoService: CryptoService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async register(
    registerDto: RegisterBiometryDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BiometricData> {
    // Verificar usuario
    const user = await this.usersService.findOne(registerDto.userId);
    if (!user) {
      throw new NotFoundException(
        `Usuario con ID ${registerDto.userId} no encontrado`,
      );
    }

    // Verificar prueba de vida
    if (!this.verifyLiveness(registerDto.livenessProof)) {
      throw new BadRequestException('La prueba de vida falló');
    }

    // Decodificar datos biométricos
    const descriptorBuffer = Buffer.from(registerDto.descriptorData, 'base64');

    // Cifrar datos biométricos
    const { encryptedData, iv } =
      this.cryptoService.encryptDocument(descriptorBuffer);

    // Crear registro
    const biometricData = this.biometricDataRepository.create({
      userId: registerDto.userId,
      descriptorData: encryptedData,
      iv,
      type: registerDto.type,
      metadata: registerDto.metadata,
      active: true,
    });

    const savedData = await this.biometricDataRepository.save(biometricData);

    // Registrar en auditoría
    await this.auditLogService.log(
      AuditAction.USER_UPDATE,
      registerDto.userId,
      null,
      {
        action: 'biometric_registration',
        type: registerDto.type,
      },
      ipAddress,
      userAgent,
    );

    return savedData;
  }

  async verify(
    verifyDto: VerifyBiometryDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    // Verificar usuario
    const user = await this.usersService.findOne(verifyDto.userId);
    if (!user) {
      throw new NotFoundException(
        `Usuario con ID ${verifyDto.userId} no encontrado`,
      );
    }

    // Buscar datos biométricos almacenados
    const storedBiometricData = await this.biometricDataRepository.findOne({
      where: { userId: verifyDto.userId, active: true },
    });

    if (!storedBiometricData) {
      throw new NotFoundException(
        'No se encontraron datos biométricos registrados para este usuario',
      );
    }

    // Verificar prueba de vida
    if (!this.verifyLiveness(verifyDto.livenessProof)) {
      throw new BadRequestException('La prueba de vida falló');
    }

    // Decodificar datos biométricos actuales
    const currentDescriptor = Buffer.from(verifyDto.descriptorData, 'base64');

    // Descifrar datos biométricos almacenados
    const storedDescriptor = this.cryptoService.decryptDocument(
      storedBiometricData.descriptorData,
      storedBiometricData.iv,
    );

    // Comparar descriptores (simplificado - en producción usar algoritmo de matching)
    const similarity = this.compareFaceDescriptors(
      currentDescriptor,
      storedDescriptor,
    );
    const isMatch = similarity > 0.8; // Umbral de similitud

    // Actualizar fecha de última verificación
    if (isMatch) {
      storedBiometricData.lastVerifiedAt = new Date();
      await this.biometricDataRepository.save(storedBiometricData);
    }

    // Registrar en auditoría
    await this.auditLogService.log(
      AuditAction.AUTH_2FA_VERIFY,
      verifyDto.userId,
      null,
      {
        action: 'biometric_verification',
        success: isMatch,
        similarity,
      },
      ipAddress,
      userAgent,
    );

    return isMatch;
  }

  async checkLiveness(checkDto: LivenessCheckDto): Promise<boolean> {
    // Implementar verificación de prueba de vida
    // En producción, esto sería mucho más complejo

    // Verificación básica simulada
    const imageData = Buffer.from(checkDto.imageData, 'base64');

    // Aquí iría la lógica de detección de vida real
    // Por ahora, simulamos una verificación simple
    const isLive = imageData.length > 1000; // Verificación ficticia

    return isLive;
  }

  private verifyLiveness(livenessProof?: Record<string, any>): boolean {
    // En producción, implementar verificación robusta de liveness
    // Por ahora, aceptamos cualquier prueba
    return true;
  }

  private compareFaceDescriptors(
    descriptor1: Buffer,
    descriptor2: Buffer,
  ): number {
    // Implementación simplificada - En producción usar distancia euclidiana u otra métrica
    // Simulamos una comparación
    return 0.9; // Valor alto = alta similitud
  }

  async removeUserBiometricData(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const result = await this.biometricDataRepository.delete({ userId });

    if (result.affected > 0) {
      // Registrar en auditoría
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        userId,
        null,
        {
          action: 'biometric_data_removal',
          count: result.affected,
        },
        ipAddress,
        userAgent,
      );
    }
  }
}
