import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
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

// Interfaces mejoradas para mayor tipado y seguridad
interface FaceDescriptor {
  length: number;
  [index: number]: number;
}

interface LivenessResult {
  verified: boolean;
  score: number;
  method: string;
  reason?: string;
  confidence?: number;
  details?: Record<string, any>;
}

interface BiometricVerificationResult {
  verified: boolean;
  score: number;
  timestamp: string;
  faceMatchScore?: number;
  livenessScore?: number;
  securityScore?: number;
  confidence?: number;
  method?: string;
  analysisDetails?: Record<string, any>;
}

interface TextureAnalysisResult {
  isRealFace: boolean;
  confidence: number;
  textureScore: number;
  noisePatternScore: number;
  depthConsistencyScore: number;
  details?: Record<string, any>;
}

interface MotionAnalysisResult {
  isNaturalMotion: boolean;
  confidence: number;
  microMovementScore: number;
  accelerationPatternScore: number;
  details?: Record<string, any>;
}

@Injectable()
export class BiometryService {
  private readonly logger = new Logger(BiometryService.name);
  
  // Umbrales configurables para permitir ajustes de seguridad
  private readonly MATCH_THRESHOLD = 0.6; // Umbral de similitud por defecto
  private readonly MIN_LIVENESS_SCORE = 0.75; // Puntuación mínima de liveness
  private readonly TEXTURE_THRESHOLD = 0.7; // Umbral para análisis de textura
  private readonly SPOOFING_THRESHOLD = 0.65; // Umbral para detección de spoofing
  private readonly MICROMOVEMENT_THRESHOLD = 0.6; // Umbral para micromovimientos naturales
  
  // Cache para optimización de rendimiento
  private modelCache: Map<string, any> = new Map();

  constructor(
    @InjectRepository(BiometricData)
    private biometricDataRepository: Repository<BiometricData>,
    private readonly cryptoService: CryptoService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {
    // Inicializar modelos en memoria para análisis facial
    this.initializeModels();
  }
  
  /**
   * Inicializa modelos de IA para análisis facial
   * Esta función precarga modelos para optimizar rendimiento
   */
  private async initializeModels(): Promise<void> {
    try {
      // En un entorno real, aquí cargaríamos modelos TensorFlow/ONNX 
      // para análisis facial, detección de spoofing, etc.
      this.logger.log('Inicializando modelos de análisis biométrico...');
      
      // Simulamos carga de modelos
      this.modelCache.set('faceDetection', { loaded: true, version: '1.0.0' });
      this.modelCache.set('livenessDetection', { loaded: true, version: '2.1.0' });
      this.modelCache.set('antispoofing', { loaded: true, version: '3.0.0' });
      
      this.logger.log('Modelos de análisis biométrico cargados correctamente');
    } catch (error) {
      this.logger.error(`Error inicializando modelos: ${error.message}`, error.stack);
    }
  }

  /**
   * Registra datos biométricos para un usuario con verificación avanzada
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
      // Registrar intento fallido en auditoría
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        registerDto.userId,
        null,
        {
          action: 'biometric_registration_failed',
          reason: 'liveness_verification_failed',
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
      this.logger.error(
        `Error decodificando datos biométricos: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Error al decodificar datos biométricos: ${error.message}`,
      );
    }

    // Cifrar datos biométricos con mayor seguridad
    let encryptedData: Buffer, iv: Buffer, authTag: Buffer;
    try {
      const encryptionResult = this.cryptoService.encryptBiometricData(descriptorBuffer);
      encryptedData = encryptionResult.encryptedData;
      iv = encryptionResult.iv;
      authTag = encryptionResult.authTag;
    } catch (error) {
      this.logger.error(
        `Error cifrando datos biométricos: ${error.message}`,
        error.stack
      );
      throw new InternalServerErrorException(
        'Error al cifrar datos biométricos',
      );
    }

    // Calcular calidad biométrica
    const qualityScore = this.calculateBiometricQuality(
      JSON.parse(descriptorBuffer.toString('utf-8'))
    );

    // Crear registro con metadatos completos
    const biometricData = this.biometricDataRepository.create({
      userId: registerDto.userId,
      descriptorData: encryptedData,
      iv,
      authTag,
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
        biometricQuality: qualityScore,
        antispoofingChecks: livenessVerified.details || {},
        registrationVersion: '2.0',
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
          qualityScore,
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
   * Verifica la identidad de un usuario usando sus datos biométricos con sistema avanzado
   */
  async verify(
    verifyDto: VerifyBiometryDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BiometricVerificationResult> {
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

    // Verificar prueba de vida con método avanzado multinivel
    const livenessVerified = await this.verifyLivenessAdvanced(
      verifyDto.livenessProof,
    );

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
      this.logger.error(`Error al decodificar datos biométricos: ${error.message}`);
      
      // Registrar intento fallido en auditoría
      await this.auditLogService.log(
        AuditAction.AUTH_2FA_VERIFY,
        verifyDto.userId,
        null,
        {
          action: 'biometric_verification',
          success: false,
          reason: 'invalid_descriptor',
          details: error.message,
          ipAddress,
          userAgent,
        },
        ipAddress,
        userAgent,
      );
      
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

      throw new InternalServerErrorException(
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

    // Sistema de verificación multifactorial
    // 1. Comparar descriptores con algoritmo de similitud de coseno mejorado
    const similarity = this.calculateEnhancedCosineSimilarity(
      currentDescriptor,
      storedDescriptor,
    );

    // 2. Verificar datos de textura facial para anti-spoofing avanzado
    const textureAnalysis = await this.analyzeTexturePatterns(
      verifyDto.livenessProof?.imageData,
    );

    // 3. Verificar movimientos naturales (si hay datos disponibles)
    const motionAnalysis = this.analyzeMotionData(
      verifyDto.livenessProof?.motionData,
    );

    // 4. Verificar consistencia entre las diferentes métricas
    const consistencyScore = this.checkMetricsConsistency(
      similarity,
      livenessVerified.score,
      textureAnalysis.confidence,
      motionAnalysis.confidence,
    );

    // 5. Calcular puntuación final ponderada
    const weightedScores = {
      faceMatch: similarity * 0.40,
      liveness: livenessVerified.score * 0.25,
      texture: textureAnalysis.confidence * 0.15,
      motion: motionAnalysis.confidence * 0.10,
      consistency: consistencyScore * 0.10,
    };
    
    const finalScore = Object.values(weightedScores).reduce((a, b) => a + b, 0);

    // Determinar umbral de similitud (puede ser ajustado según el caso de uso)
    const customThreshold =
      storedBiometricData.metadata?.customMatchThreshold ||
      this.MATCH_THRESHOLD;
    
    // 6. Evaluación de contexto de seguridad (análisis de riesgo adaptativo)
    const riskFactor = this.calculateRiskFactor(
      verifyDto.userId,
      ipAddress,
      userAgent,
      finalScore,
    );
    
    // Ajustar umbral según nivel de riesgo
    const adjustedThreshold = customThreshold * (1 + (riskFactor * 0.2));
    
    // Decisión final
    const isMatch = finalScore >= adjustedThreshold && 
                    livenessVerified.verified &&
                    textureAnalysis.isRealFace;

    // Actualizar fecha de última verificación y estadísticas
    try {
      if (isMatch) {
        // Éxito: actualizar estadísticas positivas
        storedBiometricData.lastVerifiedAt = new Date();
        storedBiometricData.metadata = {
          ...storedBiometricData.metadata,
          verificationStats: {
            ...(storedBiometricData.metadata?.verificationStats || {}),
            lastSuccess: new Date().toISOString(),
            successCount:
              (storedBiometricData.metadata?.verificationStats?.successCount ||
                0) + 1,
            lastScores: {
              similarity,
              liveness: livenessVerified.score,
              texture: textureAnalysis.confidence,
              motion: motionAnalysis.confidence,
              final: finalScore,
            },
          },
        };
      } else {
        // Fallo: actualizar estadísticas negativas y evaluar posibles amenazas
        storedBiometricData.metadata = {
          ...storedBiometricData.metadata,
          verificationStats: {
            ...(storedBiometricData.metadata?.verificationStats || {}),
            lastFailure: new Date().toISOString(),
            failureCount:
              (storedBiometricData.metadata?.verificationStats?.failureCount ||
                0) + 1,
            lastFailureDetails: {
              similarity,
              liveness: livenessVerified.score,
              texture: textureAnalysis.confidence,
              motion: motionAnalysis.confidence,
              final: finalScore,
              threshold: adjustedThreshold,
              livenessReason: livenessVerified.reason,
              ipAddress,
              userAgent,
            },
          },
        };
        
        // Verificar umbrales de seguridad adicionales
        const failedAttempts = (storedBiometricData.metadata?.verificationStats?.failureCount || 0) + 1;
        
        if (failedAttempts >= 5) {
          // Posible ataque - implementar bloqueo temporal
          storedBiometricData.metadata = {
            ...storedBiometricData.metadata,
            securityFlags: {
              ...(storedBiometricData.metadata?.securityFlags || {}),
              multipleFailures: true,
              temporaryLock: true,
              lockUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
              flaggedAt: new Date().toISOString(),
            },
          };
          
          // Alerta de seguridad en log
          this.logger.warn(
            `ALERTA DE SEGURIDAD: Múltiples fallos de verificación biométrica para usuario ${verifyDto.userId}`,
          );
        }
        
        // Análisis de anomalías
        if (finalScore < 0.3 && livenessVerified.score > 0.7) {
          // Posible ataque con foto
          storedBiometricData.metadata = {
            ...storedBiometricData.metadata,
            securityFlags: {
              ...(storedBiometricData.metadata?.securityFlags || {}),
              possibleSpoofingAttempt: true,
              anomalyType: 'photo_attack',
              flaggedAt: new Date().toISOString(),
            },
          };
        }
      }
      
      // Guardar las actualizaciones
      await this.biometricDataRepository.save(storedBiometricData);
    } catch (error) {
      this.logger.error(
        `Error al actualizar estadísticas biométricas: ${error.message}`,
        error.stack,
      );
    }

    // Registrar en auditoría con detalles forenses completos
    await this.auditLogService.log(
      AuditAction.AUTH_2FA_VERIFY,
      verifyDto.userId,
      null,
      {
        action: 'biometric_verification',
        success: isMatch,
        scores: {
          similarity,
          liveness: livenessVerified.score,
          texture: textureAnalysis.confidence,
          motion: motionAnalysis.confidence,
          consistency: consistencyScore,
          final: finalScore,
          threshold: adjustedThreshold,
        },
        methods: {
          faceComparison: 'enhanced-cosine-similarity',
          livenessMethod: livenessVerified.method,
          textureAnalysis: textureAnalysis.isRealFace ? 'passed' : 'failed',
          motionAnalysis: motionAnalysis.isNaturalMotion ? 'passed' : 'failed',
        },
        contextualFactors: {
          riskFactor,
          deviceInfo: {
            ipAddress,
            userAgent,
          },
        },
      },
      ipAddress,
      userAgent,
    );

    // Respuesta estructurada
    return {
      verified: isMatch,
      score: finalScore,
      timestamp: new Date().toISOString(),
      faceMatchScore: similarity,
      livenessScore: livenessVerified.score,
      securityScore: 1 - riskFactor,
      confidence: Math.min(similarity, livenessVerified.score),
      method: 'multifactor-v2',
      analysisDetails: isMatch ? undefined : {
        livenessVerification: livenessVerified.verified ? 'passed' : 'failed',
        faceMatching: similarity >= customThreshold ? 'passed' : 'failed',
        textureAnalysis: textureAnalysis.isRealFace ? 'passed' : 'failed',
        reasons: [
          ...(livenessVerified.verified ? [] : ['liveness_verification_failed']),
          ...(similarity >= customThreshold ? [] : ['face_matching_failed']),
          ...(textureAnalysis.isRealFace ? [] : ['texture_analysis_failed']),
        ]
      }
    };
  }

  /**
   * Verifica la prueba de vida de manera avanzada con múltiples desafíos
   */
  private async verifyLivenessAdvanced(
    livenessProof?: Record<string, any>,
  ): Promise<LivenessResult> {
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
    const { challenge, timestamp, imageData, motionData, textureData } = livenessProof;

    // Verificar timestamp con tolerancia variable según el tipo de desafío
    const currentTime = Date.now();
    const proofTime = timestamp || currentTime;

    // Diferentes desafíos pueden tener diferentes ventanas de tiempo
    const timeThresholds = {
      blink: this.getTimeThresholdForChallenge('blink'),
      smile: this.getTimeThresholdForChallenge('smile'),
      'head-turn': this.getTimeThresholdForChallenge('head-turn'),
      nod: this.getTimeThresholdForChallenge('nod'),
      'mouth-open': this.getTimeThresholdForChallenge('mouth-open'),
      sequence: this.getTimeThresholdForChallenge('sequence'),
    };

    const timeThreshold = timeThresholds[challenge] || 30000;

    if (Math.abs(currentTime - proofTime) > timeThreshold) {
      return {
        verified: false,
        score: 0,
        method: 'timestamp-validation',
        reason: `La prueba de vida ha expirado (límite: ${timeThreshold / 1000}s)`,
        confidence: 0,
      };
    }

    // Sistema multicapa anti-spoofing
    const spoofAnalysis = await this.performMultilayerSpoofingDetection(
      imageData,
      motionData,
      textureData,
      challenge,
    );
    
    if (spoofAnalysis.isSpoofDetected) {
      return {
        verified: false,
        score: 0,
        method: 'advanced-anti-spoofing',
        reason: `Se ha detectado un posible intento de suplantación: ${spoofAnalysis.reason}`,
        confidence: spoofAnalysis.confidence,
        details: spoofAnalysis.details,
      };
    }

    // Implementación específica según el tipo de desafío
    let verificationResult: LivenessResult;
    
    switch (challenge) {
      case 'blink':
        verificationResult = await this.verifyBlinkChallenge(livenessProof);
        break;
      
      case 'smile':
        verificationResult = await this.verifySmileChallenge(livenessProof);
        break;
      
      case 'head-turn':
        verificationResult = await this.verifyHeadTurnChallenge(livenessProof);
        break;
      
      case 'nod':
        verificationResult = await this.verifyNodChallenge(livenessProof);
        break;
      
      case 'mouth-open':
        verificationResult = await this.verifyMouthOpenChallenge(livenessProof);
        break;
      
      case 'sequence':
        // Desafío secuencial (múltiples gestos en orden)
        verificationResult = await this.verifySequenceChallenge(livenessProof);
        break;
      
      default:
        // Detección genérica de presencia
        verificationResult = await this.verifyGenericPresence(livenessProof);
    }
    
    // Añadir información adicional de análisis forense
    verificationResult.details = {
      ...verificationResult.details,
      antispoofingScore: 1 - spoofAnalysis.confidence,
      challengeCompliance: verificationResult.score,
      timeValidity: 1 - Math.abs(currentTime - proofTime) / timeThreshold,
    };
    
    return verificationResult;
  }
  
  /**
   * Verifica desafío de parpadeo (mejorado)
   */
  private async verifyBlinkChallenge(
    livenessProof: Record<string, any>
  ): Promise<LivenessResult> {
    const { imageData, eyeStateSequence, blinkMetrics } = livenessProof;
    
    // En un sistema real, extraeríamos estos datos de la imagen o secuencia
    // Aquí simularemos el análisis
    
    let score = 0.0;
    let confidence = 0.0;
    let details = {};
    
    // Análisis de fotogramas múltiples (si está disponible)
    if (eyeStateSequence && eyeStateSequence.length >= 3) {
      // Verificar secuencia completa de parpadeo (abierto->cerrado->abierto)
      const hasFullBlinkSequence = this.verifyBlinkSequence(eyeStateSequence);
      
      // Verificar naturalidad del parpadeo (duración y transición)
      const { isNatural, naturalityScore } = this.verifyBlinkNaturality(eyeStateSequence);
      
      score = hasFullBlinkSequence ? 0.7 + (naturalityScore * 0.3) : 0.2;
      confidence = hasFullBlinkSequence ? 0.85 : 0.3;
      
      details = {
        fullBlinkDetected: hasFullBlinkSequence,
        blinkNaturality: naturalityScore,
        framesAnalyzed: eyeStateSequence.length,
      };
    } 
    // Si tenemos métricas de parpadeo detalladas
    else if (blinkMetrics) {
      const { earValues, blinkDuration, blinkTransitionSpeed } = blinkMetrics;
      
      // Verificar si los valores de EAR (Eye Aspect Ratio) indican parpadeo real
      const validEarRange = this.validateEyeAspectRatio(earValues);
      
      // Verificar duración natural del parpadeo (100-400ms típicamente)
      const validDuration = blinkDuration >= 100 && blinkDuration <= 400;
      
      // Verificar velocidad de transición (no debe ser instantánea ni demasiado lenta)
      const validTransition = blinkTransitionSpeed > 0.1 && blinkTransitionSpeed < 0.8;
      
      score = validEarRange ? 0.6 : 0.2;
      score += validDuration ? 0.2 : 0;
      score += validTransition ? 0.2 : 0;
      
      confidence = score > 0.7 ? 0.9 : 0.4;
      
      details = {
        validEarRange,
        validDuration,
        validTransition,
        earValues,
      };
    }
    // Análisis básico de imagen única (menos fiable)
    else if (imageData) {
      // En un sistema real, utilizaríamos un modelo de ML para detectar parpadeo
      // Por simplicidad, simulamos un resultado
      score = 0.65;
      confidence = 0.5;
      details = {
        analysisType: 'single-image',
        reliability: 'low',
      };
    } else {
      return {
        verified: false,
        score: 0,
        method: 'blink-detection',
        reason: 'No se proporcionaron datos suficientes para verificar parpadeo',
        confidence: 0,
      };
    }
    
    return {
      verified: score >= this.MIN_LIVENESS_SCORE,
      score,
      method: 'advanced-blink-detection',
      reason: score >= this.MIN_LIVENESS_SCORE ? undefined : 'No se detectó un parpadeo válido',
      confidence,
      details,
    };
  }