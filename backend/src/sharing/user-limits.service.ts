// backend/src/sharing/user-limits.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShareLink } from './entities/share-link.entity';
import { DocumentPermission } from './entities/document-permission.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserLimitsService {
  private readonly MAX_ACTIVE_SHARE_LINKS = 10;
  private readonly MAX_DOCUMENT_SHARES = 50;
  private readonly MAX_DAILY_SHARES = 20;

  constructor(
    @InjectRepository(ShareLink)
    private readonly shareLinksRepository: Repository<ShareLink>,
    @InjectRepository(DocumentPermission)
    private readonly permissionsRepository: Repository<DocumentPermission>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verifica límites antes de crear un enlace de compartición
   */
  async checkShareLinkLimits(userId: string): Promise<void> {
    await Promise.all([
      this.checkActiveShareLinksLimit(userId),
      this.checkDailySharesLimit(userId),
    ]);
  }

  /**
   * Verifica límites antes de compartir con usuario
   */
  async checkUserShareLimits(userId: string): Promise<void> {
    await Promise.all([
      this.checkTotalDocumentSharesLimit(userId),
      this.checkDailySharesLimit(userId),
    ]);
  }

  /**
   * Verifica límite de enlaces activos por usuario
   */
  private async checkActiveShareLinksLimit(userId: string): Promise<void> {
    const activeLinks = await this.shareLinksRepository.count({
      where: {
        createdBy: userId,
        isActive: true,
      },
    });

    if (activeLinks >= this.MAX_ACTIVE_SHARE_LINKS) {
      throw new BadRequestException(
        `Límite de enlaces activos alcanzado (${this.MAX_ACTIVE_SHARE_LINKS}). ` +
          'Desactive algunos enlaces existentes antes de crear nuevos.',
      );
    }
  }

  /**
   * Verifica límite total de documentos compartidos
   */
  private async checkTotalDocumentSharesLimit(userId: string): Promise<void> {
    const totalShares = await this.permissionsRepository.count({
      where: {
        createdBy: userId,
        isActive: true,
      },
    });

    if (totalShares >= this.MAX_DOCUMENT_SHARES) {
      throw new BadRequestException(
        `Límite de documentos compartidos alcanzado (${this.MAX_DOCUMENT_SHARES}). ` +
          'Revoque algunos permisos existentes antes de compartir más documentos.',
      );
    }
  }

  /**
   * Verifica límite de comparticiones diarias
   */
  private async checkDailySharesLimit(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Contar enlaces creados hoy
    const dailyLinks = await this.shareLinksRepository.count({
      where: {
        createdBy: userId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        } as any,
      },
    });

    // Contar permisos creados hoy
    const dailyPermissions = await this.permissionsRepository.count({
      where: {
        createdBy: userId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        } as any,
      },
    });

    const totalDailyShares = dailyLinks + dailyPermissions;

    if (totalDailyShares >= this.MAX_DAILY_SHARES) {
      throw new BadRequestException(
        `Límite diario de comparticiones alcanzado (${this.MAX_DAILY_SHARES}). ` +
          'Intente nuevamente mañana.',
      );
    }
  }

  /**
   * Obtiene estadísticas de uso para un usuario
   */
  async getUserUsageStats(userId: string): Promise<{
    activeShareLinks: number;
    maxActiveShareLinks: number;
    totalDocumentShares: number;
    maxDocumentShares: number;
    dailyShares: number;
    maxDailyShares: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      activeShareLinks,
      totalDocumentShares,
      dailyLinks,
      dailyPermissions,
    ] = await Promise.all([
      this.shareLinksRepository.count({
        where: {
          createdBy: userId,
          isActive: true,
        },
      }),
      this.permissionsRepository.count({
        where: {
          createdBy: userId,
          isActive: true,
        },
      }),
      this.shareLinksRepository.count({
        where: {
          createdBy: userId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          } as any,
        },
      }),
      this.permissionsRepository.count({
        where: {
          createdBy: userId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          } as any,
        },
      }),
    ]);

    return {
      activeShareLinks,
      maxActiveShareLinks: this.MAX_ACTIVE_SHARE_LINKS,
      totalDocumentShares,
      maxDocumentShares: this.MAX_DOCUMENT_SHARES,
      dailyShares: dailyLinks + dailyPermissions,
      maxDailyShares: this.MAX_DAILY_SHARES,
    };
  }

  /**
   * Limpia enlaces expirados automáticamente
   */
  async cleanupExpiredLinks(): Promise<number> {
    const now = new Date();

    const expiredLinks = await this.shareLinksRepository.find({
      where: {
        isActive: true,
        expiresAt: {
          lt: now,
        } as any,
      },
    });

    if (expiredLinks.length > 0) {
      await this.shareLinksRepository.update(
        expiredLinks.map((link) => link.id),
        { isActive: false },
      );
    }

    return expiredLinks.length;
  }
}
