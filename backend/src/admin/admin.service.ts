// backend/src/admin/admin.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfiguration } from './entities/system-configuration.entity';
import { UpdateSystemConfigurationDto } from './dto/system-configuration.dto';
import { EmailService } from '../email/email.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly defaultConfigurations = {
    email: {
      fromEmail: 'no-reply@docusense.com',
      smtpServer: 'smtp.example.com',
      smtpPort: 587,
      useSSL: false,
      username: 'smtp-user',
    },
    security: {
      jwtExpirationHours: 4,
      maxLoginAttempts: 5,
      passwordMinLength: 8,
      requireStrongPasswords: true,
      twoFactorAuthEnabled: true,
      keyRotationDays: 90,
    },
    storage: {
      maxFileSizeMB: 50,
      totalStorageGB: 10,
      allowedFileTypes: ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'],
      documentExpirationDays: 0,
    },
    blockchain: {
      enabled: false,
      provider: 'ethereum',
      networkId: 'mainnet',
    },
  };

  constructor(
    @InjectRepository(SystemConfiguration)
    private systemConfigRepository: Repository<SystemConfiguration>,
    private emailService: EmailService,
    private blockchainService: BlockchainService,
    private auditLogService: AuditLogService,
  ) {
    this.initializeConfiguration();
  }

  private async initializeConfiguration() {
    try {
      // Verificar si ya existe una configuración
      const existingConfig = await this.systemConfigRepository.findOne({
        where: {},
      });

      if (!existingConfig) {
        // Crear configuración inicial con valores predeterminados
        const initialConfig = this.systemConfigRepository.create({
          emailConfig: this.defaultConfigurations.email,
          securityConfig: this.defaultConfigurations.security,
          storageConfig: this.defaultConfigurations.storage,
          blockchainConfig: this.defaultConfigurations.blockchain,
        });

        await this.systemConfigRepository.save(initialConfig);
        this.logger.log('Configuración inicial del sistema creada');
      }
    } catch (error) {
      this.logger.error(
        `Error inicializando configuración del sistema: ${error.message}`,
        error.stack,
      );
    }
  }

  async getConfiguration(): Promise<SystemConfiguration> {
    const config = await this.systemConfigRepository.findOne({
      where: {},
    });

    if (!config) {
      throw new NotFoundException('Configuración del sistema no encontrada');
    }

    // Por seguridad, no devolver la contraseña SMTP
    if (config.emailConfig?.password) {
      config.emailConfig.password = undefined;
    }

    return config;
  }

  async updateConfiguration(
    updateConfigDto: UpdateSystemConfigurationDto,
    adminId: string,
  ): Promise<SystemConfiguration> {
    const config = await this.systemConfigRepository.findOne({
      where: {},
    });

    if (!config) {
      throw new NotFoundException('Configuración del sistema no encontrada');
    }

    // Actualizar solo las secciones proporcionadas
    if (updateConfigDto.email) {
      // Si no se proporciona contraseña, mantener la actual
      if (!updateConfigDto.email.password && config.emailConfig?.password) {
        updateConfigDto.email.password = config.emailConfig.password;
      }
      config.emailConfig = updateConfigDto.email;
    }

    if (updateConfigDto.security) {
      config.securityConfig = updateConfigDto.security;
    }

    if (updateConfigDto.storage) {
      config.storageConfig = updateConfigDto.storage;
    }

    if (updateConfigDto.blockchain) {
      config.blockchainConfig = updateConfigDto.blockchain;
    }

    // Guardar los cambios
    const updatedConfig = await this.systemConfigRepository.save(config);

    // Registrar la actualización en el log de auditoría
    await this.auditLogService.log(
      AuditAction.PERMISSION_UPDATE,
      adminId,
      null,
      {
        action: 'system_configuration_update',
        sections: Object.keys(updateConfigDto),
      },
    );

    // Por seguridad, no devolver la contraseña SMTP
    if (updatedConfig.emailConfig?.password) {
      updatedConfig.emailConfig.password = undefined;
    }

    return updatedConfig;
  }

  async resetSectionToDefault(
    section: 'email' | 'security' | 'storage' | 'blockchain',
    adminId: string,
  ): Promise<SystemConfiguration> {
    const config = await this.systemConfigRepository.findOne({
      where: {},
    });

    if (!config) {
      throw new NotFoundException('Configuración del sistema no encontrada');
    }

    // Restablecer la sección específica a los valores predeterminados
    switch (section) {
      case 'email':
        config.emailConfig = this.defaultConfigurations.email;
        break;
      case 'security':
        config.securityConfig = this.defaultConfigurations.security;
        break;
      case 'storage':
        config.storageConfig = this.defaultConfigurations.storage;
        break;
      case 'blockchain':
        config.blockchainConfig = this.defaultConfigurations.blockchain;
        break;
      default:
        throw new BadRequestException('Sección no válida');
    }

    // Guardar los cambios
    const updatedConfig = await this.systemConfigRepository.save(config);

    // Registrar el restablecimiento en el log de auditoría
    await this.auditLogService.log(
      AuditAction.PERMISSION_UPDATE,
      adminId,
      null,
      {
        action: 'system_configuration_reset',
        section,
      },
    );

    // Por seguridad, no devolver la contraseña SMTP
    if (updatedConfig.emailConfig?.password) {
      updatedConfig.emailConfig.password = undefined;
    }

    return updatedConfig;
  }

  async testEmailConfiguration(adminId: string): Promise<boolean> {
    const config = await this.getConfiguration();

    if (!config.emailConfig) {
      throw new BadRequestException(
        'Configuración de correo electrónico no disponible',
      );
    }

    // Registrar en el log de auditoría
    await this.auditLogService.log(
      AuditAction.PERMISSION_UPDATE,
      adminId,
      null,
      {
        action: 'test_email_configuration',
      },
    );

    // Enviar correo de prueba al administrador
    return this.emailService.sendEmail({
      to: adminId, // Asumiendo que adminId es el email del administrador
      subject: 'Prueba de configuración de correo - DocuSense',
      text: 'Este es un correo de prueba para verificar la configuración de SMTP. Si estás recibiendo este correo, la configuración es correcta.',
    });
  }

  async testBlockchainConnection(adminId: string): Promise<boolean> {
    const config = await this.getConfiguration();

    if (!config.blockchainConfig || !config.blockchainConfig.enabled) {
      throw new BadRequestException(
        'La integración con blockchain no está habilitada',
      );
    }

    // Registrar en el log de auditoría
    await this.auditLogService.log(
      AuditAction.PERMISSION_UPDATE,
      adminId,
      null,
      {
        action: 'test_blockchain_connection',
        provider: config.blockchainConfig.provider,
        networkId: config.blockchainConfig.networkId,
      },
    );

    // Probar conexión con blockchain
    return this.blockchainService.testConnection();
  }

  async getSystemStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalDocuments: number;
    storageUsed: number;
    certificatesIssued: number;
    signedDocuments: number;
  }> {
    // Aquí implementarías lógica para obtener estadísticas reales
    // Este es un ejemplo con datos simulados
    return {
      totalUsers: 145,
      activeUsers: 87,
      totalDocuments: 523,
      storageUsed: 2.7 * 1024 * 1024 * 1024, // 2.7 GB en bytes
      certificatesIssued: 78,
      signedDocuments: 156,
    };
  }
}
