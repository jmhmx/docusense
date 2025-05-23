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
        cid?: string;
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
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate<any>> =
    new Map();

  constructor(private configService: ConfigService) {
    this.templateDir = path.join(process.cwd(), 'templates', 'email');
    this.logoPath = path.join(process.cwd(), 'templates/email/logotipo.png');

    // Verificar existencia del logo al iniciar
    if (fs.existsSync(this.logoPath)) {
      this.logger.log(`Logo encontrado en: ${this.logoPath}`);
    } else {
      this.logger.warn(
        `Logo no encontrado en: ${this.logoPath}. Los correos se enviarán sin logo.`,
      );
    }

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

    // Registrar helpers de Handlebars
    this.registerHandlebarsHelpers();

    // Precompilar plantillas
    this.precompileTemplates();
  }

  private registerHandlebarsHelpers() {
    // Registrar helper para comparación
    handlebars.registerHelper('eq', function (a, b) {
      return a === b;
    });

    // Registrar helper para bloques condicionales
    handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // Registrar helper para formatear fechas
    handlebars.registerHelper('formatDate', function (dateString) {
      try {
        const date = new Date(dateString);
        return date.toLocaleString();
      } catch (e) {
        return dateString;
      }
    });
  }

  private precompileTemplates() {
    // Precompilar todas las plantillas para mejor rendimiento
    try {
      if (fs.existsSync(this.templateDir)) {
        const files = fs.readdirSync(this.templateDir);

        // Primero registrar la plantilla base como parcial
        const baseTemplatePath = path.join(this.templateDir, 'email-base.hbs');
        if (fs.existsSync(baseTemplatePath)) {
          const baseTemplate = fs.readFileSync(baseTemplatePath, 'utf8');
          handlebars.registerPartial('email-base', baseTemplate);
          this.logger.log('Plantilla base registrada como parcial');
        } else {
          this.logger.warn(
            'Plantilla base no encontrada, los correos no se renderizarán correctamente',
          );
        }

        // Luego compilar las demás plantillas
        for (const file of files) {
          if (file.endsWith('.hbs') && file !== 'email-base.hbs') {
            const templateName = file.replace('.hbs', '');
            const templatePath = path.join(this.templateDir, file);
            const templateSource = fs.readFileSync(templatePath, 'utf8');

            // Compilar plantilla
            try {
              const compiledTemplate = handlebars.compile(templateSource);
              this.compiledTemplates.set(templateName, compiledTemplate);
              this.logger.log(`Plantilla compilada: ${templateName}`);
            } catch (err) {
              this.logger.error(
                `Error compilando plantilla ${templateName}: ${err.message}`,
              );
            }
          }
        }

        this.logger.log(
          `Precompiladas ${this.compiledTemplates.size} plantillas`,
        );
      }
    } catch (error) {
      this.logger.error(`Error precompilando plantillas: ${error.message}`);
    }
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
      let attachments = options.attachments || [];

      // Añadir el logo como adjunto solo si existe
      if (logoExists) {
        // Crear un nuevo array con el logo y los adjuntos existentes
        attachments = [
          {
            filename: 'logotipo.png',
            path: this.logoPath,
            cid: 'logotipo', // Esta ID se usa en el HTML como src="cid:logotipo"
            contentType: 'image/png',
          },
          ...(Array.isArray(attachments) ? attachments : []),
        ];
      }

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
        attachments: attachments,
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
        throw new Error('El nombre de la plantilla es requerido');
      }

      // Buscar la plantilla precompilada
      const compiledTemplate = this.compiledTemplates.get(options.template);

      if (!compiledTemplate) {
        // Si no está precompilada, intentar cargarla en el momento
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

          // Preparar contexto con variables adicionales
          const logoExists = fs.existsSync(this.logoPath);
          const context = {
            ...options.context,
            logoExists,
            recipient: Array.isArray(options.to) ? options.to[0] : options.to,
            subject: options.subject,
          };

          const html = template(context);

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
      } else {
        // Usar la plantilla precompilada
        // Preparar contexto con variables adicionales
        const logoExists = fs.existsSync(this.logoPath);
        const context = {
          ...options.context,
          logoExists,
          recipient: Array.isArray(options.to) ? options.to[0] : options.to,
          subject: options.subject,
        };

        const html = compiledTemplate(context);

        return this.sendEmail({
          ...options,
          html,
        });
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
      isMultiSignatureProcess?: boolean;
      multiSignatureInfo?: {
        requiredSigners: number;
        totalSigners: number;
        dueDate: string;
      };
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando notificación de documento compartido a ${email}`);

    // Si es parte de un proceso de firmas múltiples, usar plantilla específica
    if (data.isMultiSignatureProcess && data.multiSignatureInfo) {
      return this.sendTemplateEmail({
        to: email,
        subject: `Solicitud de firma: "${data.documentTitle}"`,
        template: 'multi-signature-request',
        context: {
          signerName: data.userName,
          ownerName: data.sharerName,
          documentTitle: data.documentTitle,
          documentUrl: data.documentUrl,
          requiredSigners: data.multiSignatureInfo.requiredSigners,
          totalSigners: data.multiSignatureInfo.totalSigners,
          dueDate: data.multiSignatureInfo.dueDate,
          instructions:
            data.message ||
            'Para firmar el documento, haga clic en el enlace anterior, inicie sesión en su cuenta y siga las instrucciones en pantalla.',
        },
      });
    }

    // Usar plantilla estándar para compartición normal
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
   * Envía notificación de solicitud de firma múltiple
   */
  async sendMultiSignatureRequestEmail(
    email: string,
    data: {
      signerName: string;
      ownerName: string;
      documentTitle: string;
      documentUrl: string;
      requiredSigners: number;
      totalSigners: number;
      dueDate: string;
      instructions: string;
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando solicitud de firma múltiple a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: `Solicitud de firma: "${data.documentTitle}"`,
      template: 'multi-signature-request',
      context: data,
    });
  }

  /**
   * Envía notificación de progreso en firmas múltiples
   */
  async sendMultiSignatureProgressEmail(
    email: string,
    data: {
      ownerName: string;
      signerName: string;
      documentTitle: string;
      documentUrl: string;
      completedSigners: number;
      requiredSigners: number;
      remainingSigners: number;
      progress: number;
      isComplete: boolean;
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando progreso de firma múltiple a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: data.isComplete
        ? `Proceso completado: "${data.documentTitle}"`
        : `Progreso de firmas: "${data.documentTitle}"`,
      template: 'multi-signature-progress',
      context: data,
    });
  }

  /**
   * Envía recordatorio de firma pendiente
   */
  async sendSignatureReminderEmail(
    email: string,
    data: {
      signerName: string;
      documentTitle: string;
      documentUrl: string;
      recentSignerName: string;
      completedSigners: number;
      requiredSigners: number;
      progress: number;
    },
  ): Promise<boolean> {
    this.logger.log(`Enviando recordatorio de firma a ${email}`);
    return this.sendTemplateEmail({
      to: email,
      subject: `Recordatorio de firma: "${data.documentTitle}"`,
      template: 'signature-reminder',
      context: data,
    });
  }
}
