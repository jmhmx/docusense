// backend/src/email/email.service.ts
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
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly templateDir: string;

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

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Validar opciones mínimas
      if (!options.to || !options.subject) {
        throw new Error('Destinatario y asunto son requeridos');
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
        attachments: options.attachments,
      };

      // Enviar correo con manejo de timeout
      const result = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout enviando email')), 30000),
        ),
      ]);

      this.logger.log(`Email enviado a ${options.to}: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error al enviar email: ${error.message}`, error.stack);
      return false;
    }
  }

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

      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      const html = template(options.context || {});

      return this.sendEmail({
        ...options,
        html,
      });
    } catch (error) {
      this.logger.error(
        `Error al enviar email con template: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

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
}
