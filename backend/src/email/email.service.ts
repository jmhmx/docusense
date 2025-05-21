import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  context?: Record<string, any>;
  attachments?:
    | Array<{
        filename: string;
        path?: string;
        content?: Buffer;
        contentType?: string;
      }>
    | any;
}

interface Signer {
  name: string;
  date: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly templateDir: string;
  private readonly logoPath: string;

  constructor(private configService: ConfigService) {
    this.templateDir = path.join(process.cwd(), 'templates', 'email');

    // Obtener configuración desde variables de entorno
    const host = this.configService.get<string>('EMAIL_HOST');
    const port = this.configService.get<number>('EMAIL_PORT', 587);
    const secure = this.configService.get<boolean>('EMAIL_SECURE', false);

    // Crear configuración básica evitando tipado explícito
    const config = {
      host,
      port,
      secure, // true para puerto 465, false para otros puertos
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    };

    // Añadir configuración TLS solo para conexiones no seguras
    if (!secure) {
      // Configuración básica para superar problemas comunes con TLS
      Object.assign(config, {
        tls: {
          rejectUnauthorized: false, // Desactivar verificación de certificados
        },
      });
    }

    this.logger.log(
      `Inicializando servicio de email: ${host}:${port} (secure: ${secure})`,
    );

    // Crear transportador con la configuración
    this.transporter = nodemailer.createTransport(config);

    // Verificar conexión al iniciar
    this.verifyConnection();

    // Ruta al logo
    this.logoPath = path.resolve(
      __dirname,
      '../../templates/email/logotipo.png',
    );
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log(
        'Conexión con servidor de correo verificada correctamente',
      );
    } catch (error) {
      this.logger.error(
        `Error al verificar conexión con servidor de correo: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Mejora para el envío de correo con manejo detallado de errores SMTP
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Validar opciones mínimas
      if (!options.to || !options.subject) {
        throw new Error('Destinatario y asunto son requeridos');
      }

      // Verificar que el logo existe
      const logoExists = fs.existsSync(this.logoPath);

      // Preparar opciones de correo
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text:
          options.text ||
          options.html?.replace(/<[^>]*>/g, '') ||
          options.subject, // Generar texto plano como alternativa
        attachments: logoExists
          ? [
              {
                filename: 'logotipo.png',
                path: this.logoPath,
                cid: 'logotipo', // Esta ID se usa en el HTML como src="cid:logotipo"
              },
              options.attachments,
            ]
          : options.attachments,
      };

      // Enviar correo con temporizador
      const mailPromise = this.transporter.sendMail(mailOptions);

      // Crear un temporizador para cancelar después de 30 segundos
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                'Timeout enviando email: operación cancelada después de 30 segundos',
              ),
            ),
          30000,
        );
      });

      // Carrera entre envío y timeout
      const result = (await Promise.race([mailPromise, timeoutPromise])) as any;

      this.logger.log(`Email enviado a ${options.to}: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error al enviar email: ${error.message}`, error.stack);

      // Mejorar mensajes de error para problemas comunes
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `No se pudo conectar al servidor SMTP (${this.configService.get('EMAIL_HOST')}:${this.configService.get('EMAIL_PORT')}): conexión rechazada`,
        );
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(
          `Tiempo de espera agotado al conectar con el servidor SMTP (${this.configService.get('EMAIL_HOST')}:${this.configService.get('EMAIL_PORT')})`,
        );
      } else if (error.code === 'EAUTH') {
        throw new Error(
          `Error de autenticación con el servidor SMTP: credenciales incorrectas`,
        );
      } else if (error.code === 'ESOCKET') {
        throw new Error(
          `Error de conexión con el servidor SMTP: problema con el socket`,
        );
      }

      throw error;
    }
  }

  /**
   * Mejora para el método SendTemplateEmail con manejo de errores más detallado
   */
  async sendTemplateEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!options.template) {
        throw new Error('Template name is required');
      }

      // Localizar y cargar la plantilla
      const templatePath = path.join(
        this.templateDir,
        `${options.template}.hbs`,
      );

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Plantilla no encontrada: ${options.template}.hbs`);
      }

      try {
        const templateSource = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateSource);
        const html = template(options.context || {});

        return this.sendEmail({
          ...options,
          html,
        });
      } catch (handlebarsError) {
        this.logger.error(
          `Error compilando plantilla: ${handlebarsError.message}`,
          handlebarsError.stack,
        );
        throw new Error(
          `Error en la plantilla de correo: ${handlebarsError.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al enviar email con template: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Método para enviar email de bienvenida
  async sendWelcomeEmail(
    email: string,
    name: string,
    dashboardUrl: string,
  ): Promise<boolean> {
    this.logger.log(`Enviando email de bienvenida a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: '¡Bienvenido a DocuSense!',
      template: 'welcome-email',
      context: {
        name,
        dashboardUrl,
      },
    });
  }

  // Método para notificar documento compartido
  async sendSharedDocumentEmail(
    email: string,
    data: {
      userName: string;
      sharerName: string;
      documentTitle: string;
      documentUrl: string;
      permissionLevel: string;
      message?: string;
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando notificación de documento compartido a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: `${data.sharerName} ha compartido un documento contigo`,
      template: 'shared-document',
      context: data,
    });
  }

  // Método para notificar nuevo comentario
  async sendNewCommentEmail(
    email: string,
    data: {
      userName: string;
      commenterName: string;
      documentTitle: string;
      documentUrl: string;
      commentContent: string;
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando notificación de nuevo comentario a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: `Nuevo comentario en "${data.documentTitle}"`,
      template: 'new-comment',
      context: data,
    });
  }

  // Método para notificar respuesta a comentario
  async sendCommentReplyEmail(
    email: string,
    data: {
      userName: string;
      responderName: string;
      documentTitle: string;
      documentUrl: string;
      originalComment: string;
      replyContent: string;
    },
  ): Promise<boolean> {
    this.logger.log(
      `Enviando notificación de respuesta a comentario a ${email}`,
    );
    return this.sendTemplateEmail({
      to: email,
      subject: `${data.responderName} ha respondido a tu comentario`,
      template: 'comment-reply',
      context: data,
    });
  }

  // Método para notificar firma de documento
  async sendDocumentSignedEmail(
    email: string,
    data: {
      userName: string;
      signerName: string;
      documentTitle: string;
      documentUrl: string;
      signatureDate: string;
      signatureReason?: string;
      pendingSigners?: string;
      completedSigners?: number;
      totalRequiredSigners?: number;
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando notificación de documento firmado a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: `${data.signerName} ha firmado el documento "${data.documentTitle}"`,
      template: 'document-signed',
      context: data,
    });
  }

  // Método para notificar que todas las firmas han sido completadas
  async sendSignaturesCompletedEmail(
    email: string,
    data: {
      userName: string;
      documentTitle: string;
      documentUrl: string;
      signers: Signer[];
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando notificación de firmas completadas a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: `Proceso de firmas completado: "${data.documentTitle}"`,
      template: 'signatures-completed',
      context: data,
    });
  }

  // Método para notificar cancelación de proceso de firmas
  async sendSignaturesCancelledEmail(
    email: string,
    data: {
      userName: string;
      cancelerName: string;
      documentTitle: string;
      documentUrl: string;
      cancellationReason?: string;
    },
  ): Promise<boolean> {
    this.logger.log(
      `Enviando notificación de cancelación de firmas a ${email}`,
    );
    return this.sendTemplateEmail({
      to: email,
      subject: `Proceso de firmas cancelado: "${data.documentTitle}"`,
      template: 'signatures-cancelled',
      context: data,
    });
  }

  // Método existente para enviar notificación de mención
  async sendMentionNotification(
    email: string,
    data: {
      userName: string;
      mentionedBy: string;
      documentTitle: string;
      documentUrl: string;
    },
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: email,
      subject: `${data.mentionedBy} te ha mencionado en un comentario`,
      template: 'mention-notification',
      context: data,
    });
  }

  /**
   * Mejora para validar la configuración de email antes de intentar enviar
   */
  private validateEmailConfig() {
    // Obtener la configuración desde las variables de entorno
    const host = this.configService.get<string>('EMAIL_HOST');
    const port = this.configService.get<number>('EMAIL_PORT', 587);
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASSWORD');
    const from = this.configService.get<string>('EMAIL_FROM');

    // Validar que todos los campos requeridos estén presentes
    if (!host) {
      throw new Error('EMAIL_HOST es obligatorio en la configuración');
    }

    if (!port || port < 1 || port > 65535) {
      throw new Error('EMAIL_PORT inválido (debe estar entre 1 y 65535)');
    }

    if (!user) {
      throw new Error('EMAIL_USER es obligatorio en la configuración');
    }

    if (!pass) {
      throw new Error('EMAIL_PASSWORD es obligatorio en la configuración');
    }

    if (!from) {
      throw new Error('EMAIL_FROM es obligatorio en la configuración');
    }

    return { host, port, user, pass, from };
  }

  /**
   * Actualiza la configuración del servicio de email
   */
  async updateEmailConfig(config: {
    fromEmail: string;
    smtpServer: string;
    smtpPort: number;
    useSSL: boolean;
    username: string;
    password?: string;
  }): Promise<boolean> {
    try {
      // Validar configuración
      if (!config.smtpServer) {
        throw new Error('Servidor SMTP es obligatorio');
      }

      if (!config.smtpPort || config.smtpPort < 1 || config.smtpPort > 65535) {
        throw new Error('Puerto SMTP inválido (debe estar entre 1 y 65535)');
      }

      if (!config.username) {
        throw new Error('Nombre de usuario SMTP es obligatorio');
      }

      if (!config.fromEmail) {
        throw new Error('Dirección de correo (From) es obligatoria');
      }

      // Actualizar la configuración en el transporter
      const secure = config.useSSL;

      // Recrear el transporter con la nueva configuración
      const transportConfig: any = {
        host: config.smtpServer,
        port: config.smtpPort,
        secure,
        auth: {
          user: config.username,
          pass:
            config.password || this.configService.get<string>('EMAIL_PASSWORD'),
        },
      };

      // Añadir configuración TLS solo para conexiones no seguras
      if (!secure) {
        // Configuración básica para superar problemas comunes con TLS
        transportConfig.tls = {
          rejectUnauthorized: false, // Desactivar verificación de certificados
        };
      }

      // Crear el nuevo transporter
      this.transporter = nodemailer.createTransport(transportConfig);

      // Verificar la conexión
      await this.transporter.verify();

      this.logger.log('Configuración de email actualizada correctamente');
      return true;
    } catch (error) {
      this.logger.error(
        `Error actualizando configuración de email: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Envía un email de informe de configuración de sistema
   */
  async sendSystemConfigReport(
    email: string,
    configData: any,
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: email,
      subject: 'Reporte de Configuración del Sistema - DocuSense',
      template: 'system-config-report',
      context: {
        date: new Date().toLocaleString(),
        config: {
          email: {
            server: configData.email.smtpServer,
            port: configData.email.smtpPort,
            useSSL: configData.email.useSSL ? 'Sí' : 'No',
            fromEmail: configData.email.fromEmail,
          },
          security: {
            jwtExpiration: `${configData.security.jwtExpirationHours} horas`,
            passwordMinLength: configData.security.passwordMinLength,
            twoFactorEnabled: configData.security.twoFactorAuthEnabled
              ? 'Sí'
              : 'No',
          },
          storage: {
            maxFileSize: `${configData.storage.maxFileSizeMB} MB`,
            totalStorage: `${configData.storage.totalStorageGB} GB`,
            allowedTypes: configData.storage.allowedFileTypes.join(', '),
          },
          blockchain: {
            enabled: configData.blockchain.enabled ? 'Sí' : 'No',
            provider: configData.blockchain.provider,
          },
        },
      },
    });
  }
}
