import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { v4 as uuidv4 } from 'uuid';

export enum AuditAction {
  DOCUMENT_VIEW = 'document_view',
  DOCUMENT_DOWNLOAD = 'document_download',
  DOCUMENT_UPLOAD = 'document_upload',
  DOCUMENT_DELETE = 'document_delete',
  DOCUMENT_UPDATE = 'document_update',
  DOCUMENT_SIGN = 'document_sign',
  DOCUMENT_SHARE = 'document_share',
  DOCUMENT_ENCRYPT = 'document_encrypt',
  SIGNATURE_CREATE = 'signature_create',
  SIGNATURE_VERIFY = 'signature_verify',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  AUTH_2FA_REQUEST = 'auth_2fa_request',
  AUTH_2FA_VERIFY = 'auth_2fa_verify',
  AUTH_2FA_SETUP = 'auth_2fa_setup',
  AUTH_2FA_DISABLE = 'auth_2fa_disable',
  AUTH_2FA_RECOVERY = 'auth_2fa_recovery',
  PERMISSION_UPDATE = 'permission_update',
  PERMISSION_REVOKE = 'permission_revoke',
  SHARE_LINK_CREATE = 'share_link_create',
  SHARE_LINK_ACCESS = 'share_link_access',
  SHARE_LINK_DEACTIVATE = 'share_link_deactivate',
  COMMENT_CREATE = 'comment_create',
  COMMENT_UPDATE = 'comment_update',
  COMMENT_DELETE = 'comment_delete',
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Registra una acción en el log de auditoría
   */
  async log(
    action: AuditAction,
    userId: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        id: uuidv4(),
        action,
        userId,
        resourceId,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        details,
      });

      await this.auditLogRepository.save(auditLog);
      this.logger.debug(
        `Audit log: ${action} by user ${userId} on resource ${resourceId || 'N/A'}`,
      );

      return auditLog;
    } catch (error) {
      this.logger.error(
        `Error creando registro de auditoría: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene logs de auditoría filtrados por criterios
   */
  async findLogs(
    userId?: string,
    resourceId?: string,
    action?: AuditAction,
    startDate?: Date,
    endDate?: Date,
    limit = 100,
    offset = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const queryBuilder =
        this.auditLogRepository.createQueryBuilder('audit_log');

      // Aplicar filtros
      if (userId) {
        queryBuilder.andWhere('audit_log.userId = :userId', { userId });
      }

      if (resourceId) {
        queryBuilder.andWhere('audit_log.resourceId = :resourceId', {
          resourceId,
        });
      }

      if (action) {
        queryBuilder.andWhere('audit_log.action = :action', { action });
      }

      if (startDate) {
        queryBuilder.andWhere('audit_log.timestamp >= :startDate', {
          startDate,
        });
      }

      if (endDate) {
        queryBuilder.andWhere('audit_log.timestamp <= :endDate', { endDate });
      }

      // Ordenar por fecha descendente (más reciente primero)
      queryBuilder.orderBy('audit_log.timestamp', 'DESC');

      // Obtener total
      const total = await queryBuilder.getCount();

      // Aplicar paginación
      queryBuilder.limit(limit).offset(offset);

      // Ejecutar consulta
      const logs = await queryBuilder.getMany();

      return { logs, total };
    } catch (error) {
      this.logger.error(
        `Error consultando logs de auditoría: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene los logs de un recurso específico (ej. documento)
   */
  async getResourceLogs(resourceId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { resourceId },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Obtiene los logs de un usuario específico
   */
  async getUserLogs(userId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
