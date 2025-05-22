// backend/src/sharing/rate-limiter.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface RateLimitEntry {
  attempts: number;
  firstAttempt: Date;
  lastAttempt: Date;
  blockedUntil?: Date;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly cache = new Map<string, RateLimitEntry>();

  // Configuración por defecto
  private readonly ACCESS_ATTEMPTS_LIMIT = 5;
  private readonly ACCESS_WINDOW_MINUTES = 60;
  private readonly CREATE_ATTEMPTS_LIMIT = 3;
  private readonly CREATE_WINDOW_MINUTES = 10;
  private readonly BLOCK_DURATION_MINUTES = 30;

  constructor(private configService: ConfigService) {
    // Limpiar cache cada hora
    setInterval(() => this.cleanupExpiredEntries(), 60 * 60 * 1000);
  }

  /**
   * Verifica límites para acceso a enlaces compartidos
   */
  async checkAccessAttempts(
    ipAddress: string,
    token?: string,
  ): Promise<{ allowed: boolean; remainingAttempts: number }> {
    const key = this.generateKey('access', ipAddress, token);
    const entry = this.cache.get(key);
    const now = new Date();

    // Si está bloqueado temporalmente
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      const remainingMinutes = Math.ceil(
        (entry.blockedUntil.getTime() - now.getTime()) / (1000 * 60),
      );

      this.logger.warn(
        `IP ${this.hashIp(ipAddress)} bloqueada por ${remainingMinutes}min`,
      );
      throw new BadRequestException(
        `Demasiados intentos fallidos. Intente nuevamente en ${remainingMinutes} minutos.`,
      );
    }

    // Primera vez o ventana expirada
    if (
      !entry ||
      this.isWindowExpired(entry.firstAttempt, this.ACCESS_WINDOW_MINUTES)
    ) {
      this.cache.set(key, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return {
        allowed: true,
        remainingAttempts: this.ACCESS_ATTEMPTS_LIMIT - 1,
      };
    }

    const remainingAttempts = this.ACCESS_ATTEMPTS_LIMIT - entry.attempts;

    if (entry.attempts >= this.ACCESS_ATTEMPTS_LIMIT) {
      // Bloquear IP temporalmente
      entry.blockedUntil = new Date(
        now.getTime() + this.BLOCK_DURATION_MINUTES * 60 * 1000,
      );
      this.cache.set(key, entry);

      this.logger.warn(
        `IP ${this.hashIp(ipAddress)} bloqueada por exceder límite de accesos`,
      );
      throw new BadRequestException(
        `Demasiados intentos fallidos. Bloqueado por ${this.BLOCK_DURATION_MINUTES} minutos.`,
      );
    }

    return { allowed: true, remainingAttempts };
  }

  /**
   * Registra un intento de acceso fallido
   */
  async recordFailedAccess(ipAddress: string, token?: string): Promise<void> {
    const key = this.generateKey('access', ipAddress, token);
    const entry = this.cache.get(key);
    const now = new Date();

    if (
      entry &&
      !this.isWindowExpired(entry.firstAttempt, this.ACCESS_WINDOW_MINUTES)
    ) {
      entry.attempts++;
      entry.lastAttempt = now;
      this.cache.set(key, entry);
    } else {
      this.cache.set(key, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
    }

    this.logger.log(
      `Intento fallido registrado para IP ${this.hashIp(ipAddress)}`,
    );
  }

  /**
   * Verifica límites para creación de enlaces
   */
  async checkCreateLinkAttempts(
    userId: string,
    ipAddress: string,
  ): Promise<{ allowed: boolean; remainingAttempts: number }> {
    const key = this.generateKey('create', userId, ipAddress);
    const entry = this.cache.get(key);
    const now = new Date();

    // Primera vez o ventana expirada
    if (
      !entry ||
      this.isWindowExpired(entry.firstAttempt, this.CREATE_WINDOW_MINUTES)
    ) {
      this.cache.set(key, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return {
        allowed: true,
        remainingAttempts: this.CREATE_ATTEMPTS_LIMIT - 1,
      };
    }

    const remainingAttempts = this.CREATE_ATTEMPTS_LIMIT - entry.attempts;

    if (entry.attempts >= this.CREATE_ATTEMPTS_LIMIT) {
      this.logger.warn(
        `Usuario ${userId} excedió límite de creación de enlaces`,
      );
      throw new BadRequestException(
        `Demasiados enlaces creados. Intente nuevamente en ${this.CREATE_WINDOW_MINUTES} minutos.`,
      );
    }

    // Incrementar contador
    entry.attempts++;
    entry.lastAttempt = now;
    this.cache.set(key, entry);

    return { allowed: true, remainingAttempts };
  }

  /**
   * Registra creación exitosa de enlace
   */
  async recordSuccessfulCreate(
    userId: string,
    ipAddress: string,
  ): Promise<void> {
    const key = this.generateKey('create', userId, ipAddress);
    const entry = this.cache.get(key);
    const now = new Date();

    if (
      entry &&
      !this.isWindowExpired(entry.firstAttempt, this.CREATE_WINDOW_MINUTES)
    ) {
      entry.attempts++;
      entry.lastAttempt = now;
      this.cache.set(key, entry);
    }
  }

  /**
   * Limpia entrada exitosa de acceso
   */
  async recordSuccessfulAccess(
    ipAddress: string,
    token?: string,
  ): Promise<void> {
    const key = this.generateKey('access', ipAddress, token);
    this.cache.delete(key);
  }

  private generateKey(
    type: string,
    ...identifiers: (string | undefined)[]
  ): string {
    const validIds = identifiers.filter((id) => id).join(':');
    return `ratelimit:${type}:${this.hashIp(validIds)}`;
  }

  private hashIp(input: string): string {
    return crypto
      .createHash('sha256')
      .update(input)
      .digest('hex')
      .substring(0, 12);
  }

  private isWindowExpired(firstAttempt: Date, windowMinutes: number): boolean {
    const now = new Date();
    const windowEnd = new Date(
      firstAttempt.getTime() + windowMinutes * 60 * 1000,
    );
    return now > windowEnd;
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Limpiar entradas bloqueadas expiradas
      if (entry.blockedUntil && now > entry.blockedUntil) {
        this.cache.delete(key);
        cleaned++;
        continue;
      }

      // Limpiar entradas de ventana expirada (24 horas)
      const expiry = new Date(
        entry.lastAttempt.getTime() + 24 * 60 * 60 * 1000,
      );
      if (now > expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(
        `Limpiadas ${cleaned} entradas de rate limiting expiradas`,
      );
    }
  }

  /**
   * Reset manual para administradores
   */
  async resetRateLimit(ipAddress: string, type?: string): Promise<void> {
    const pattern = type ? `ratelimit:${type}:` : 'ratelimit:';
    const hashedIp = this.hashIp(ipAddress);

    for (const [key] of this.cache.entries()) {
      if (key.includes(pattern) && key.includes(hashedIp)) {
        this.cache.delete(key);
      }
    }

    this.logger.log(`Rate limiting reset para IP ${hashedIp}`);
  }
}

// backend/src/sharing/sharing.service.ts - Integración

@Injectable()
export class SharingService {
  constructor(
    // ... otros servicios
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async createShareLink(
    userId: string,
    createShareLinkDto: CreateShareLinkDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ShareLink> {
    // Verificar rate limiting
    if (ipAddress) {
      await this.rateLimiter.checkCreateLinkAttempts(userId, ipAddress);
    }

    // ... resto del código de creación ...

    const savedLink = await this.shareLinksRepository.save(shareLink);

    // Registrar creación exitosa
    if (ipAddress) {
      await this.rateLimiter.recordSuccessfulCreate(userId, ipAddress);
    }

    return savedLink;
  }

  async accessShareLink(
    accessShareLinkDto: AccessShareLinkDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ document: Document; permissionLevel: PermissionLevel }> {
    const { token, password } = accessShareLinkDto;

    // Verificar rate limiting antes de procesar
    if (ipAddress) {
      await this.rateLimiter.checkAccessAttempts(ipAddress, token);
    }

    try {
      // ... lógica existente de validación ...

      // Si llegamos aquí, acceso exitoso
      if (ipAddress) {
        await this.rateLimiter.recordSuccessfulAccess(ipAddress, token);
      }

      return {
        document: shareLink.document,
        permissionLevel: shareLink.permissionLevel,
      };
    } catch (error) {
      // Registrar intento fallido para rate limiting
      if (
        ipAddress &&
        (error instanceof UnauthorizedException ||
          error instanceof BadRequestException)
      ) {
        await this.rateLimiter.recordFailedAccess(ipAddress, token);
      }
      throw error;
    }
  }
}
