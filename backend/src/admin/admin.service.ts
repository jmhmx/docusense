// backend/src/admin/admin.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfiguration } from './entities/system-configuration.entity';
import { UpdateSystemConfigurationDto } from './dto/system-configuration.dto';
import { EmailService } from '../email/email.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { User } from '../users/entities/user.entity';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import * as crypto from 'crypto';

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
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private emailService: EmailService,
    private blockchainService: BlockchainService,
    private auditLogService: AuditLogService,
    private authService: AuthService,
    private usersService: UsersService,
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

  // Función mejorada para obtener la configuración
  async getConfiguration(): Promise<SystemConfiguration> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: {},
      });

      if (!config) {
        this.logger.warn(
          'Configuración no encontrada. Creando configuración inicial...',
        );

        // Crear configuración inicial con valores predeterminados
        const initialConfig = this.systemConfigRepository.create({
          emailConfig: this.defaultConfigurations.email,
          securityConfig: this.defaultConfigurations.security,
          storageConfig: this.defaultConfigurations.storage,
          blockchainConfig: this.defaultConfigurations.blockchain,
        });

        const savedConfig =
          await this.systemConfigRepository.save(initialConfig);
        return savedConfig;
      }

      // Por seguridad, no devolver la contraseña SMTP
      if (config.emailConfig?.password) {
        config.emailConfig.password = undefined;
      }

      return config;
    } catch (error) {
      this.logger.error(
        `Error obteniendo configuración: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener la configuración del sistema',
      );
    }
  }

  async updateConfiguration(
    updateConfigDto: UpdateSystemConfigurationDto,
    adminId: string,
  ): Promise<SystemConfiguration> {
    try {
      const config = await this.getConfiguration();

      // Actualizar solo las secciones proporcionadas
      if (updateConfigDto.email) {
        // Si no se proporciona contraseña, mantener la actual
        if (!updateConfigDto.email.password && config.emailConfig?.password) {
          updateConfigDto.email.password = config.emailConfig.password;
        }

        // Validar que los datos de email son coherentes
        if (
          updateConfigDto.email.smtpPort &&
          (updateConfigDto.email.smtpPort < 1 ||
            updateConfigDto.email.smtpPort > 65535)
        ) {
          throw new BadRequestException(
            'El puerto SMTP debe estar entre 1 y 65535',
          );
        }

        config.emailConfig = updateConfigDto.email;
      }

      if (updateConfigDto.security) {
        // Validar que los valores de seguridad son coherentes
        if (
          updateConfigDto.security.passwordMinLength &&
          updateConfigDto.security.passwordMinLength < 6
        ) {
          throw new BadRequestException(
            'La longitud mínima de contraseña debe ser al menos 6',
          );
        }

        if (
          updateConfigDto.security.jwtExpirationHours &&
          updateConfigDto.security.jwtExpirationHours < 1
        ) {
          throw new BadRequestException(
            'El tiempo de expiración de JWT debe ser al menos 1 hora',
          );
        }

        config.securityConfig = updateConfigDto.security;
      }

      if (updateConfigDto.storage) {
        // Validar configuración de almacenamiento
        if (
          updateConfigDto.storage.maxFileSizeMB &&
          updateConfigDto.storage.maxFileSizeMB <= 0
        ) {
          throw new BadRequestException(
            'El tamaño máximo de archivo debe ser mayor que 0 MB',
          );
        }

        config.storageConfig = updateConfigDto.storage;
      }

      if (updateConfigDto.blockchain) {
        // Si se deshabilita blockchain, validar que no afecte a documentos existentes
        if (
          config.blockchainConfig?.enabled &&
          !updateConfigDto.blockchain.enabled
        ) {
          // Aquí podría hacerse una comprobación para verificar si hay documentos registrados en blockchain
          this.logger.warn('Deshabilitando integración con blockchain');
        }

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
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error actualizando configuración: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al actualizar la configuración del sistema',
      );
    }
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

  async testEmailConfiguration(emailAddress: string): Promise<boolean> {
    try {
      const config = await this.getConfiguration();

      if (!config.emailConfig) {
        throw new BadRequestException(
          'Configuración de correo electrónico no disponible',
        );
      }

      // Verificar que tenemos la información mínima necesaria
      if (!config.emailConfig.smtpServer || !config.emailConfig.username) {
        throw new BadRequestException(
          'Falta información de configuración SMTP',
        );
      }

      // Intenta enviar un correo de prueba
      const result = await this.emailService.sendEmail({
        to: emailAddress,
        subject: 'Prueba de configuración de correo - DocuSense',
        text: `Este es un correo de prueba para verificar la configuración de SMTP. 
               Si estás recibiendo este correo, la configuración es correcta.
               
               Detalles de configuración probada:
               - Servidor SMTP: ${config.emailConfig.smtpServer}
               - Puerto: ${config.emailConfig.smtpPort}
               - SSL: ${config.emailConfig.useSSL ? 'Habilitado' : 'Deshabilitado'}
               - Remitente: ${config.emailConfig.fromEmail}`,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Error en prueba de correo: ${error.message}`,
        error.stack,
      );

      // Proporcionar mensaje de error más específico
      if (error.code === 'ECONNREFUSED') {
        throw new BadRequestException(
          `No se pudo conectar al servidor SMTP: ${error.message}`,
        );
      } else if (error.code === 'ETIMEDOUT') {
        throw new BadRequestException(
          `Tiempo de espera agotado al conectar con el servidor SMTP: ${error.message}`,
        );
      } else if (error.code === 'EAUTH') {
        throw new BadRequestException(
          `Error de autenticación con el servidor SMTP: ${error.message}`,
        );
      }

      throw new BadRequestException(
        `Error al probar la configuración de correo: ${error.message}`,
      );
    }
  }

  async testBlockchainConnection(adminId: string): Promise<boolean> {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error probando conexión blockchain: ${error.message}`,
        error.stack,
      );

      // Manejar errores específicos de blockchain
      if (error.message.includes('network')) {
        throw new BadRequestException(
          `Error de red al conectar con blockchain: ${error.message}`,
        );
      } else if (
        error.message.includes('authentication') ||
        error.message.includes('auth')
      ) {
        throw new BadRequestException(
          `Error de autenticación con blockchain: ${error.message}`,
        );
      }

      throw new BadRequestException(
        `Error al probar la conexión con blockchain: ${error.message}`,
      );
    }
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

  async createInitialAdmin(
    email: string,
    name: string,
    password: string,
  ): Promise<User> {
    // Verificar si ya existe algún administrador
    const adminCount = await this.usersRepository.count({
      where: { isAdmin: true },
    });
    if (adminCount > 0) {
      throw new BadRequestException(
        'Ya existe al menos un administrador en el sistema',
      );
    }

    // Verificar si el email ya está registrado
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Hashear la contraseña
    const hashedPassword = await this.hashPassword(password);

    // Crear el usuario administrador
    const adminUser = this.usersRepository.create({
      email,
      name,
      password: hashedPassword,
      isAdmin: true,
    });

    const savedUser = await this.usersRepository.save(adminUser);

    // Registrar en el log de auditoría
    await this.auditLogService.log(
      AuditAction.USER_CREATE,
      'system',
      savedUser.id,
      {
        action: 'initial_admin_setup',
      },
    );

    // Ocultar la contraseña antes de devolver
    delete savedUser.password;
    return savedUser;
  }

  private async hashPassword(password: string): Promise<string> {
    // Generar un salt aleatorio
    const salt = crypto.randomBytes(16).toString('hex');
    // Hashear la contraseña con el salt
    const hash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
      .toString('hex');
    // Devolver "salt:hash" para almacenar ambos
    return `${salt}:${hash}`;
  }

  /**
   * Verifica el estado del servicio de correo electrónico
   */
  async checkEmailServiceStatus(): Promise<boolean> {
    try {
      // Obtener la configuración actual
      const config = await this.getConfiguration();

      // Verificamos si la configuración existe y tiene los datos básicos
      if (
        !config.emailConfig ||
        !config.emailConfig.smtpServer ||
        !config.emailConfig.fromEmail
      ) {
        this.logger.warn('Servicio de correo no configurado correctamente');
        return false;
      }

      // En un sistema real, aquí podríamos hacer una prueba real de conexión SMTP
      // Para este ejemplo, simplemente verificamos que existan los datos básicos

      // Simular un 10% de fallos aleatorios para testing
      if (Math.random() < 0.1) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error verificando servicio de correo: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Verifica el estado del servicio de blockchain
   */
  async checkBlockchainServiceStatus(): Promise<boolean> {
    try {
      // Obtener la configuración actual
      const config = await this.getConfiguration();

      // Si blockchain no está habilitado, consideramos el servicio como no disponible
      if (!config.blockchainConfig || !config.blockchainConfig.enabled) {
        return false;
      }

      // En un sistema real, aquí verificaríamos la conexión con el proveedor blockchain
      // Para este ejemplo, simulamos un resultado exitoso la mayoría del tiempo

      // Simular un 10% de fallos aleatorios para testing
      if (Math.random() < 0.1) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error verificando servicio blockchain: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Obtiene una lista de usuarios recientes en el sistema
   */
  async getRecentUsers(): Promise<any[]> {
    try {
      // Consulta para obtener usuarios recientes
      const users = await this.usersRepository.find({
        order: { createdAt: 'DESC' },
        take: 10, // Limitar a los 10 más recientes
        select: ['id', 'name', 'email', 'isAdmin', 'createdAt', 'updatedAt'],
      });

      // Obtener información adicional como cantidad de documentos (opcional)
      const enhancedUsers = await Promise.all(
        users.map(async (user) => {
          // Aquí podrías enriquecer los datos de usuario con información adicional
          // Por ejemplo, obtener la cantidad de documentos que ha creado

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
            // Datos simulados para este ejemplo
            documentsCount: Math.floor(Math.random() * 20),
            lastActivity: new Date(
              Math.max(
                new Date(user.updatedAt).getTime(),
                Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
              ),
            ).toISOString(),
          };
        }),
      );

      return enhancedUsers;
    } catch (error) {
      this.logger.error(
        `Error obteniendo usuarios recientes: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener usuarios recientes',
      );
    }
  }

  /**
   * Obtiene eventos de seguridad recientes en el sistema
   */
  async getSecurityEvents(): Promise<any[]> {
    try {
      // En un sistema real, estas serían consultas a la base de datos de auditoría
      // Para este ejemplo, generamos datos simulados

      // Tipos de eventos de seguridad
      const eventTypes = [
        { type: 'Intento de acceso fallido', severity: 'medium' },
        { type: 'Certificado revocado', severity: 'high' },
        { type: 'Documento cifrado', severity: 'low' },
        { type: 'Rotación de claves', severity: 'low' },
        { type: 'Configuración modificada', severity: 'medium' },
        { type: 'Alerta de seguridad', severity: 'critical' },
        { type: 'Usuario bloqueado', severity: 'high' },
        { type: 'Documento compartido', severity: 'low' },
      ];

      // Generar eventos aleatorios
      const events = Array(15)
        .fill(0)
        .map((_, index) => {
          const eventInfo =
            eventTypes[Math.floor(Math.random() * eventTypes.length)];
          const daysAgo = Math.floor(Math.random() * 7); // Hasta 7 días atrás
          const hoursAgo = Math.floor(Math.random() * 24); // Hasta 24 horas atrás

          const timestamp = new Date();
          timestamp.setDate(timestamp.getDate() - daysAgo);
          timestamp.setHours(timestamp.getHours() - hoursAgo);

          return {
            id: (index + 1).toString(),
            type: eventInfo.type,
            severity: eventInfo.severity,
            description: this.getRandomDescription(eventInfo.type),
            timestamp: timestamp.toISOString(),
            ipAddress: this.getRandomIP(),
            userId:
              Math.random() > 0.3
                ? Math.floor(Math.random() * 5 + 1).toString()
                : undefined,
            resourceId:
              Math.random() > 0.5
                ? `doc-${Math.floor(Math.random() * 100)}`
                : undefined,
          };
        });

      // Ordenar por fecha (más reciente primero)
      return events.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    } catch (error) {
      this.logger.error(
        `Error obteniendo eventos de seguridad: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener eventos de seguridad',
      );
    }
  }

  /**
   * Genera una IP aleatoria para los eventos de seguridad de ejemplo
   */
  private getRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  /**
   * Genera una descripción aleatoria según el tipo de evento
   */
  private getRandomDescription(eventType: string): string {
    switch (eventType) {
      case 'Intento de acceso fallido':
        return 'Múltiples intentos fallidos de inicio de sesión desde IP sospechosa';
      case 'Certificado revocado':
        return 'Certificado de usuario revocado por posible compromiso de clave';
      case 'Documento cifrado':
        return 'Documento sensible cifrado automáticamente según política de seguridad';
      case 'Rotación de claves':
        return 'Rotación automática de claves criptográficas completada';
      case 'Configuración modificada':
        return 'Modificación de parámetros críticos de seguridad del sistema';
      case 'Alerta de seguridad':
        return 'Posible ataque de fuerza bruta detectado contra interfaz de API';
      case 'Usuario bloqueado':
        return 'Usuario bloqueado temporalmente por múltiples intentos fallidos de autenticación';
      case 'Documento compartido':
        return 'Documento confidencial compartido fuera de la organización';
      default:
        return 'Evento de seguridad registrado en el sistema';
    }
  }
}
