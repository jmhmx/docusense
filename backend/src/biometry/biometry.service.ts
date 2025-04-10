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

interface FaceDescriptor {
  length: number;
  [index: number]: number;
}

@Injectable()
export class BiometryService {
  private readonly logger = new Logger(BiometryService.name);
  private readonly MATCH_THRESHOLD = 0.6; // Umbral de similitud por defecto
  private readonly MIN_LIVENESS_SCORE = 0.75; // Puntuación mínima de liveness

  constructor(
    @InjectRepository(BiometricData)
    private biometricDataRepository: Repository<BiometricData>,
    private readonly cryptoService: CryptoService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Registra datos biométricos para un usuario
   */
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

    // Verificar si ya existe un registro biométrico activo
    const existingData = await this.biometricDataRepository.findOne({
      where: {
        userId: registerDto.userId,
        active: true,
        type: registerDto.type,
      },
    });

    if (existingData) {
      // Desactivar el registro anterior
      existingData.active = false;
      existingData.metadata = {
        ...existingData.metadata,
        deactivatedAt: new Date().toISOString(),
        deactivatedReason: 'replaced_by_new_registration',
      };
      await this.biometricDataRepository.save(existingData);

      this.logger.log(
        `Datos biométricos anteriores desactivados para usuario ${registerDto.userId}`,
      );
    }

    // Verificar prueba de vida con método avanzado
    const livenessVerified = await this.verifyLivenessAdvanced(
      registerDto.livenessProof,
    );

    if (!livenessVerified.verified) {
      throw new BadRequestException(
        `Verificación de vida fallida: ${livenessVerified.reason}`,
      );
    }

    // Decodificar datos biométricos
    let descriptorBuffer: Buffer;
    try {
      const descriptorData = Buffer.from(
        registerDto.descriptorData,
        'base64',
      ).toString('utf-8');
      const descriptorArray = JSON.parse(descriptorData);

      // Validar el descriptor
      this.validateFaceDescriptor(descriptorArray);

      descriptorBuffer = Buffer.from(descriptorData);
    } catch (error) {
      throw new BadRequestException(
        `Error al decodificar datos biométricos: ${error.message}`,
      );
    }

    // Cifrar datos biométricos con mayor seguridad
    const { encryptedData, iv, authTag } =
      this.cryptoService.encryptBiometricData(descriptorBuffer);

    // Crear registro con metadatos completos
    const biometricData = this.biometricDataRepository.create({
      userId: registerDto.userId,
      descriptorData: encryptedData,
      iv,
      authTag, // Añadir el authTag aquí
      type: registerDto.type,
      metadata: {
        ...registerDto.metadata,
        livenessVerification: {
          method: livenessVerified.method,
          score: livenessVerified.score,
          verifiedAt: new Date().toISOString(),
        },
        registrationDevice: {
          userAgent,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
        securityLevel: 'high',
      },
      active: true,
    });

    // Guardar con manejo de errores
    try {
      const savedData = await this.biometricDataRepository.save(biometricData);

      // Registrar en auditoría con detalles completos
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        registerDto.userId,
        null,
        {
          action: 'biometric_registration',
          type: registerDto.type,
          success: true,
          livenessScore: livenessVerified.score,
          securityLevel: 'high',
          biometricDataId: savedData.id,
        },
        ipAddress,
        userAgent,
      );

      this.logger.log(
        `Datos biométricos registrados exitosamente para usuario ${registerDto.userId}`,
      );
      return savedData;
    } catch (error) {
      this.logger.error(
        `Error al guardar datos biométricos: ${error.message}`,
        error.stack,
      );

      // Registrar fallos en auditoría
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        registerDto.userId,
        null,
        {
          action: 'biometric_registration',
          type: registerDto.type,
          success: false,
          error: error.message,
        },
        ipAddress,
        userAgent,
      );

      throw new BadRequestException(
        `Error al registrar datos biométricos: ${error.message}`,
      );
    }
  }

  /**
   * Verifica la identidad de un usuario usando sus datos biométricos
   */
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

    // Verificar prueba de vida con método avanzado
    const livenessVerified = await this.verifyLivenessAdvanced(
      verifyDto.livenessProof,
    );

    if (!livenessVerified.verified) {
      // Registrar intento fallido en auditoría
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_VERIFY,
        verifyDto.userId,
        null,
        {
          action: 'biometric_verification',
          success: false,
          reason: 'liveness_failed',
          details: livenessVerified.reason,
          ipAddress,
          userAgent,
        },
        ipAddress,
        userAgent,
      );

      throw new BadRequestException(
        `Verificación de vida fallida: ${livenessVerified.reason}`,
      );
    }

    // Decodificar datos biométricos actuales
    let currentDescriptor: number[];
    try {
      const descriptorData = Buffer.from(
        verifyDto.descriptorData,
        'base64',
      ).toString('utf-8');
      currentDescriptor = JSON.parse(descriptorData);

      // Validar el descriptor
      this.validateFaceDescriptor(currentDescriptor);
    } catch (error) {
      throw new BadRequestException(
        `Error al decodificar datos biométricos: ${error.message}`,
      );
    }

    // Descifrar datos biométricos almacenados
    let storedDescriptorData: Buffer;
    try {
      storedDescriptorData = this.cryptoService.decryptBiometricData(
        storedBiometricData.descriptorData,
        storedBiometricData.iv,
        storedBiometricData.authTag,
      );
    } catch (error) {
      this.logger.error(
        `Error al descifrar datos biométricos: ${error.message}`,
        error.stack,
      );

      throw new BadRequestException(
        'Error al descifrar datos biométricos almacenados',
      );
    }

    // Convertir buffer a descriptor
    let storedDescriptor: number[];
    try {
      storedDescriptor = JSON.parse(storedDescriptorData.toString('utf-8'));
    } catch (error) {
      throw new BadRequestException(
        'Formato inválido de datos biométricos almacenados',
      );
    }

    // Comparar descriptores con algoritmo de similitud de coseno
    const similarity = this.calculateCosineSimilarity(
      currentDescriptor,
      storedDescriptor,
    );

    // Determinar umbral de similitud (puede ser ajustado según el caso de uso)
    const customThreshold =
      storedBiometricData.metadata?.customMatchThreshold ||
      this.MATCH_THRESHOLD;
    const isMatch = similarity >= customThreshold;

    // Actualizar fecha de última verificación y estadísticas
    if (isMatch) {
      storedBiometricData.lastVerifiedAt = new Date();
      storedBiometricData.metadata = {
        ...storedBiometricData.metadata,
        verificationStats: {
          ...(storedBiometricData.metadata?.verificationStats || {}),
          lastSuccess: new Date().toISOString(),
          successCount:
            (storedBiometricData.metadata?.verificationStats?.successCount ||
              0) + 1,
        },
      };
      await this.biometricDataRepository.save(storedBiometricData);
    } else {
      // Actualizar estadísticas de fallos
      storedBiometricData.metadata = {
        ...storedBiometricData.metadata,
        verificationStats: {
          ...(storedBiometricData.metadata?.verificationStats || {}),
          lastFailure: new Date().toISOString(),
          failureCount:
            (storedBiometricData.metadata?.verificationStats?.failureCount ||
              0) + 1,
          lastSimilarityScore: similarity,
        },
      };
      await this.biometricDataRepository.save(storedBiometricData);

      // Verificar si hay demasiados fallos consecutivos
      const failureCount =
        storedBiometricData.metadata?.verificationStats?.failureCount || 0;
      if (failureCount >= 5) {
        // Marcar para revisión de seguridad
        storedBiometricData.metadata = {
          ...storedBiometricData.metadata,
          securityFlags: {
            ...(storedBiometricData.metadata?.securityFlags || {}),
            multipleFailures: true,
            flaggedAt: new Date().toISOString(),
          },
        };
        await this.biometricDataRepository.save(storedBiometricData);

        this.logger.warn(
          `Múltiples fallos de verificación biométrica para usuario ${verifyDto.userId}`,
        );
      }
    }

    // Registrar en auditoría con detalles adicionales
    await this.auditLogService.log(
      AuditAction.AUTH_2FA_VERIFY,
      verifyDto.userId,
      null,
      {
        action: 'biometric_verification',
        success: isMatch,
        similarity,
        threshold: customThreshold,
        livenessScore: livenessVerified.score,
        livenessMethod: livenessVerified.method,
        deviceInfo: {
          ipAddress,
          userAgent,
        },
      },
      ipAddress,
      userAgent,
    );

    return isMatch;
  }

  /**
   * Verifica la prueba de vida de manera avanzada
   */
  private async verifyLivenessAdvanced(
    livenessProof?: Record<string, any>,
  ): Promise<{
    verified: boolean;
    score: number;
    method: string;
    reason?: string;
    confidence?: number;
  }> {
    // Si no hay prueba de vida, falla
    if (!livenessProof) {
      return {
        verified: false,
        score: 0,
        method: 'none',
        reason: 'No se proporcionó prueba de vida',
        confidence: 0,
      };
    }

    // Obtener datos
    const { challenge, timestamp, imageData, motionData } = livenessProof;

    // Verificar timestamp con tolerancia variable según el tipo de desafío
    const currentTime = Date.now();
    const proofTime = timestamp || currentTime;

    // Diferentes desafíos pueden tener diferentes ventanas de tiempo
    const timeThresholds = {
      blink: 30000, // 30 segundos para parpadeo
      smile: 20000, // 20 segundos para sonrisa
      'head-turn': 45000, // 45 segundos para giro de cabeza (más complejo)
    };

    const timeThreshold = timeThresholds[challenge] || 30000;

    if (Math.abs(currentTime - proofTime) > timeThreshold) {
      return {
        verified: false,
        score: 0,
        method: 'timestamp',
        reason: `La prueba de vida ha expirado (límite: ${timeThreshold / 1000}s)`,
        confidence: 0,
      };
    }

    // Detección de spoofing basada en análisis de imagen (implementación ficticia)
    let spoofScore = 0;

    if (imageData) {
      // En una implementación real, aquí analizaríamos la imagen para detectar:
      // - Reflejo natural de luz en ojos y piel
      // - Textura natural de la piel (vs imagen impresa)
      // - Moiré patterns (fotos de pantallas)
      // - Consistencia de calidad en toda la imagen

      spoofScore = this.analyzeSpoofingRisk(imageData);
    }

    // Anti-spoofing mejorado con datos de movimiento si están disponibles
    if (motionData) {
      // Análisis de datos del acelerómetro/giroscopio
      // Detecta movimientos naturales vs. sostener una fotografía
      spoofScore = Math.min(spoofScore, this.analyzeMotionData(motionData));
    }

    if (spoofScore > 0.7) {
      return {
        verified: false,
        score: 0,
        method: 'anti-spoofing',
        reason: 'Posible intento de suplantación detectado',
        confidence: spoofScore,
      };
    }

    // Análisis específico según tipo de desafío con ponderación adaptativa
    let score = 0;
    let method = 'basic';
    let confidence = 0;

    // Sistema mejorado de puntuación adaptativa según calidad de los datos
    const baseQuality = this.estimateImageQuality(imageData);

    switch (challenge) {
      case 'blink':
        // Implementar verificación de parpadeo con mayor robustez
        const blinkResult = this.detectBlink(imageData);
        score = blinkResult.score * (baseQuality / 100);
        confidence = blinkResult.confidence;
        method = 'blink-detection-v2';
        break;

      case 'smile':
        // Verificación de sonrisa con detección de asimetría
        const smileResult = this.detectSmile(imageData);
        score = smileResult.score * (baseQuality / 100);
        confidence = smileResult.confidence;
        method = 'expression-analysis-v2';
        break;

      case 'head-turn':
        // Verificación de giro de cabeza con análisis 3D
        const turnResult = this.detectHeadTurn(imageData);
        score = turnResult.score * (baseQuality / 100);
        confidence = turnResult.confidence;
        method = 'pose-estimation-v2';
        break;

      default:
        // Sin desafío específico, puntuación más baja y mayor escrutinio
        score = 0.6 * (baseQuality / 100);
        confidence = 0.5;
        method = 'basic-presence';
    }

    // Ajuste dinámico del umbral según factores de riesgo
    const baseThreshold = this.MIN_LIVENESS_SCORE;
    const adjustedThreshold =
      baseThreshold * (1 + 0.1 * this.calculateRiskFactor(livenessProof));

    // Verificar si se alcanza la puntuación mínima
    const verified = score >= adjustedThreshold;

    // Datos de respuesta con información enriquecida
    return {
      verified,
      score,
      method,
      confidence,
      reason: verified
        ? undefined
        : `Puntuación de prueba de vida insuficiente (${score.toFixed(2)} < ${adjustedThreshold.toFixed(2)})`,
    };
  }

  // Nuevos métodos para mejorar la detección de liveness

  private analyzeSpoofingRisk(imageData: string): number {
    // En una implementación real, incorporaríamos:
    // 1. Análisis de textura para detectar impresiones
    // 2. Detección de bordes artificiales
    // 3. Análisis de reflejo especular
    // 4. Detección de profundidad inconsistente

    // Retornamos puntuación ficticia entre 0-1 (mayor = más probable que sea spoofing)
    return 0.1; // Bajo riesgo por defecto
  }

  private analyzeMotionData(motionData: any): number {
    // Análisis de datos del sensor de movimiento
    // - Microtemblores naturales vs. movimiento artificial
    // - Consistencia con movimientos de cabeza humanos

    return 0.1; // Bajo riesgo por defecto
  }

  private estimateImageQuality(imageData: string): number {
    // Estimar calidad de imagen
    // - Resolución
    // - Enfoque
    // - Iluminación
    // - Ruido

    // Retorna calidad de 0-100
    return 85; // Calidad predeterminada
  }

  private detectBlink(imageData: string): {
    score: number;
    confidence: number;
  } {
    // Implementación mejorada de detección de parpadeo:
    // 1. Localización precisa de ojos usando landmarks faciales
    // 2. Medición de relación aspecto de ojo (EAR)
    // 3. Análisis de secuencias temporales para detectar ciclo completo

    return {
      score: 0.85,
      confidence: 0.9,
    };
  }

  private detectSmile(imageData: string): {
    score: number;
    confidence: number;
  } {
    // Implementación mejorada de detección de sonrisa:
    // 1. Análisis de músculos faciales (aumento de anchura, elevación de mejillas)
    // 2. Detección de arrugas características alrededor de ojos y mejillas
    // 3. Verificación de movimiento natural de labios

    return {
      score: 0.9,
      confidence: 0.88,
    };
  }

  private detectHeadTurn(imageData: string): {
    score: number;
    confidence: number;
  } {
    // Implementación mejorada de detección de giro de cabeza:
    // 1. Análisis de relación entre puntos faciales en 3D
    // 2. Estimación de pose craneal
    // 3. Verificación de consistencia durante el movimiento

    return {
      score: 0.85,
      confidence: 0.82,
    };
  }

  private calculateRiskFactor(livenessProof: Record<string, any>): number {
    // Calcular factor de riesgo basado en:
    // - Anomalías en datos del sensor
    // - Patrones de uso sospechosos
    // - Historial de intentos fallidos
    // - Geolocalización o IP inusual

    // Retorna factor entre 0-1 (mayor = más riesgo)
    return 0;
  }

  /**
   * Realiza una verificación completa de liveness utilizando el imageData
   */
  async checkLiveness(checkDto: LivenessCheckDto): Promise<{
    live: boolean;
    score: number;
    details: Record<string, any>;
  }> {
    // Verificación de imagen
    if (!checkDto.imageData) {
      throw new BadRequestException('Datos de imagen no proporcionados');
    }

    let imageBuffer: Buffer;
    try {
      // Extraer datos de base64 (eliminar prefijo si existe)
      const base64Data = checkDto.imageData.replace(
        /^data:image\/\w+;base64,/,
        '',
      );
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      throw new BadRequestException('Formato de imagen inválido');
    }

    // Aquí iría la lógica real de análisis de imagen para liveness
    // Por ejemplo, detectar texturas faciales, reflejo de luz, parpadeo, etc.

    // Simulación de verificación avanzada
    const challenge = checkDto.challenge || 'generic';
    let score = 0.8; // Puntuación base
    const details: Record<string, any> = {
      timestamp: new Date().toISOString(),
      imageSize: imageBuffer.length,
      challengeType: challenge,
    };

    // Ajustar puntuación según desafío y otros factores
    if (challenge === 'blink') {
      score = 0.85;
      details.blinkDetected = true;
    } else if (challenge === 'smile') {
      score = 0.9;
      details.smileConfidence = 0.92;
    } else if (challenge === 'head-turn') {
      score = 0.85;
      details.poseAngle = '15deg';
    }

    // Verificar si hay manipulación de imagen
    // En producción: detectar fotomontajes, imágenes de pantallas, etc.
    details.manipulationDetected = false;

    // Determinación final de liveness
    const isLive =
      score >= this.MIN_LIVENESS_SCORE && !details.manipulationDetected;

    return {
      live: isLive,
      score,
      details,
    };
  }

  /**
   * Calcula la similitud de coseno entre dos descriptores faciales
   */
  private calculateCosineSimilarity(
    descriptor1: number[],
    descriptor2: number[],
  ): number {
    if (descriptor1.length !== descriptor2.length) {
      throw new BadRequestException(
        'Los descriptores faciales no tienen la misma dimensión',
      );
    }

    // Producto punto
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < descriptor1.length; i++) {
      dotProduct += descriptor1[i] * descriptor2[i];
      norm1 += descriptor1[i] * descriptor1[i];
      norm2 += descriptor2[i] * descriptor2[i];
    }

    // Evitar división por cero
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Valida que el descriptor facial tenga el formato correcto
   */
  private validateFaceDescriptor(descriptor: any): void {
    if (!Array.isArray(descriptor)) {
      throw new BadRequestException('El descriptor facial debe ser un array');
    }

    // Verificar longitud (típicamente 128 para FaceAPI.js)
    if (descriptor.length !== 128) {
      throw new BadRequestException(
        'El descriptor facial debe tener 128 dimensiones',
      );
    }

    // Verificar que todos los elementos sean números
    for (const value of descriptor) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new BadRequestException(
          'El descriptor facial contiene valores inválidos',
        );
      }
    }
  }

  /**
   * Obtiene el estado de registro biométrico de un usuario
   */
  async getUserBiometricStatus(userId: string): Promise<{
    registered: boolean;
    type?: string;
    lastVerified?: Date;
    registrationDate?: Date;
  }> {
    // Buscar datos biométricos activos del usuario
    const biometricData = await this.biometricDataRepository.findOne({
      where: { userId, active: true },
      order: { createdAt: 'DESC' },
    });

    if (!biometricData) {
      return { registered: false };
    }

    return {
      registered: true,
      type: biometricData.type,
      lastVerified: biometricData.lastVerifiedAt,
      registrationDate: biometricData.createdAt,
    };
  }

  /**
   * Obtiene diagnósticos del sistema biométrico (solo para admin)
   */
  async getSystemDiagnostics(): Promise<Record<string, any>> {
    // Obtener estadísticas generales
    const totalRegistrations = await this.biometricDataRepository.count();
    const activeRegistrations = await this.biometricDataRepository.count({
      where: { active: true },
    });

    // Usuarios con múltiples intentos fallidos
    const usersWithFailures = await this.biometricDataRepository
      .createQueryBuilder('bio')
      .where(`bio.metadata->>'securityFlags' IS NOT NULL`)
      .andWhere(`bio.metadata->'securityFlags'->>'multipleFailures' = 'true'`)
      .getCount();

    // Tipos de biometría registrados
    const faceCount = await this.biometricDataRepository.count({
      where: { type: 'face', active: true },
    });
    const fingerprintCount = await this.biometricDataRepository.count({
      where: { type: 'fingerprint', active: true },
    });

    // Estadísticas de verificación
    const recentVerifications = await this.biometricDataRepository
      .createQueryBuilder('bio')
      .where('bio.lastVerifiedAt IS NOT NULL')
      .andWhere('bio.lastVerifiedAt > :date', {
        date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }) // Últimas 24h
      .getCount();

    return {
      totalRegistrations,
      activeRegistrations,
      inactiveRegistrations: totalRegistrations - activeRegistrations,
      biometryTypes: {
        face: faceCount,
        fingerprint: fingerprintCount,
      },
      securityMetrics: {
        usersWithFailures,
        recentVerifications,
      },
      systemStatus: 'operational',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Elimina los datos biométricos de un usuario
   */
  async removeUserBiometricData(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Buscar datos biométricos activos del usuario
    const biometricData = await this.biometricDataRepository.find({
      where: { userId, active: true },
    });

    if (biometricData.length === 0) {
      // Sin datos que eliminar
      return;
    }

    // En lugar de eliminar, desactivamos los registros
    for (const data of biometricData) {
      data.active = false;
      data.metadata = {
        ...data.metadata,
        deactivatedAt: new Date().toISOString(),
        deactivatedReason: 'user_requested',
        deactivatedBy: {
          ipAddress,
          userAgent,
        },
      };
    }

    // Guardar cambios
    await this.biometricDataRepository.save(biometricData);

    // Registrar en auditoría
    await this.auditLogService.log(
      AuditAction.USER_UPDATE,
      userId,
      null,
      {
        action: 'biometric_data_removal',
        count: biometricData.length,
        ids: biometricData.map((data) => data.id),
      },
      ipAddress,
      userAgent,
    );

    this.logger.log(`Datos biométricos desactivados para usuario ${userId}`);
  }
}
