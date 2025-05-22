// backend/src/sharing/security-logger.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import * as crypto from 'crypto';

export enum SecurityEventType {
  INVALID_TOKEN_ACCESS = 'invalid_token_access',
  MULTIPLE_FAILED_ATTEMPTS = 'multiple_failed_attempts',
  SUSPICIOUS_IP_PATTERN = 'suspicious_ip_pattern',
  BRUTE_FORCE_DETECTED = 'brute_force_detected',
  TOKEN_ENUMERATION = 'token_enumeration',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  EXPIRED_TOKEN_ACCESS = 'expired_token_access',
  INVALID_PASSWORD_ATTEMPTS = 'invalid_password_attempts',
}

interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);
  private readonly suspiciousPatterns = new Map<string, number>();

  constructor(private readonly auditLogService: AuditLogService) {
    // Limpiar patrones cada hora
    setInterval(() => this.cleanupPatterns(), 60 * 60 * 1000);
  }

  /**
   * Registra un evento de seguridad
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const hashedIp = this.hashIp(event.ipAddress);

    // Log estructurado
    this.logger.warn(`SECURITY_EVENT: ${event.type}`, {
      type: event.type,
      severity: event.severity,
      hashedIp,
      timestamp: event.timestamp,
      details: event.details,
    });

    // Registrar en auditoría
    await this.auditLogService.log(
      AuditAction.SHARE_LINK_ACCESS,
      'system',
      null,
      {
        securityEvent: event.type,
        severity: event.severity,
        hashedIp,
        details: event.details,
      },
      event.ipAddress,
      event.userAgent,
    );

    // Detectar patrones sospechosos
    await this.analyzePattern(event);
  }

  /**
   * Registra intento de acceso con token inválido
   */
  async logInvalidTokenAccess(
    token: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<void> {
    const tokenPrefix = token.substring(0, 8);

    await this.logSecurityEvent({
      type: SecurityEventType.INVALID_TOKEN_ACCESS,
      severity: 'medium',
      ipAddress,
      userAgent,
      details: {
        tokenPrefix,
        tokenLength: token.length,
        isValidFormat: this.isValidTokenFormat(token),
      },
      timestamp: new Date(),
    });
  }

  /**
   * Registra múltiples intentos fallidos
   */
  async logMultipleFailedAttempts(
    ipAddress: string,
    attemptCount: number,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.MULTIPLE_FAILED_ATTEMPTS,
      severity: attemptCount > 10 ? 'high' : 'medium',
      ipAddress,
      userAgent,
      details: {
        attemptCount,
        timeWindow: '1 hour',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Registra detección de fuerza bruta
   */
  async logBruteForceDetection(
    ipAddress: string,
    attemptCount: number,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.BRUTE_FORCE_DETECTED,
      severity: 'critical',
      ipAddress,
      userAgent,
      details: {
        attemptCount,
        action: 'ip_blocked',
        blockDuration: '30 minutes',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Registra intentos de enumeración de tokens
   */
  async logTokenEnumeration(
    ipAddress: string,
    uniqueTokens: number,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.TOKEN_ENUMERATION,
      severity: 'high',
      ipAddress,
      userAgent,
      details: {
        uniqueTokensAttempted: uniqueTokens,
        timeWindow: '1 hour',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Registra exceso de límite de velocidad
   */
  async logRateLimitExceeded(
    ipAddress: string,
    limitType: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: 'medium',
      ipAddress,
      userAgent,
      details: {
        limitType,
        action: 'request_blocked',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Analiza patrones sospechosos
   */
  private async analyzePattern(event: SecurityEvent): Promise<void> {
    const hashedIp = this.hashIp(event.ipAddress);
    const currentCount = this.suspiciousPatterns.get(hashedIp) || 0;
    const newCount = currentCount + 1;

    this.suspiciousPatterns.set(hashedIp, newCount);

    // Detectar patrones de enumeración
    if (
      event.type === SecurityEventType.INVALID_TOKEN_ACCESS &&
      newCount >= 5
    ) {
      await this.logTokenEnumeration(
        event.ipAddress,
        newCount,
        event.userAgent,
      );
    }

    // Detectar fuerza bruta
    if (newCount >= 15) {
      await this.logBruteForceDetection(
        event.ipAddress,
        newCount,
        event.userAgent,
      );
    }
  }

  /**
   * Hash de IP para privacidad
   */
  private hashIp(ipAddress: string): string {
    return crypto
      .createHash('sha256')
      .update(ipAddress)
      .digest('hex')
      .substring(0, 12);
  }

  /**
   * Valida formato de token
   */
  private isValidTokenFormat(token: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  /**
   * Limpia patrones antiguos
   */
  private cleanupPatterns(): void {
    // En un entorno de producción, usarías Redis o similar
    // Por ahora, limpiar todo cada hora
    this.suspiciousPatterns.clear();
    this.logger.log('Patrones de seguridad limpiados');
  }

  /**
   * Obtiene estadísticas de seguridad
   */
  async getSecurityStats(): Promise<{
    suspiciousIps: number;
    recentEvents: Array<{ type: string; count: number }>;
  }> {
    // Implementar consultas a la base de datos para estadísticas
    return {
      suspiciousIps: this.suspiciousPatterns.size,
      recentEvents: [], // Implementar consulta real
    };
  }
}
