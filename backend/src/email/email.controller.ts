// backend/src/email/email.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

// DTO para la validación de datos
export class SendEmailDto {
  @IsEmail({}, { message: 'Dirección de correo inválida' })
  @IsNotEmpty({ message: 'El correo destinatario es requerido' })
  to: string;

  @IsString()
  @IsNotEmpty({ message: 'El asunto es requerido' })
  subject: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  html?: string;

  @IsString()
  @IsOptional()
  template?: string;

  @IsOptional()
  context?: Record<string, any>;
}

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendEmail(@Body(new ValidationPipe()) emailDto: SendEmailDto) {
    const result = await this.emailService.sendEmail(emailDto);
    return {
      success: result,
      message: result
        ? 'Correo enviado correctamente'
        : 'Error al enviar correo',
    };
  }

  @Post('template')
  @UseGuards(JwtAuthGuard)
  async sendTemplateEmail(@Body(new ValidationPipe()) emailDto: SendEmailDto) {
    if (!emailDto.template) {
      return {
        success: false,
        message: 'Se requiere especificar una plantilla',
      };
    }

    const result = await this.emailService.sendTemplateEmail(emailDto);
    return {
      success: result,
      message: result
        ? 'Correo enviado correctamente'
        : 'Error al enviar correo',
    };
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async testEmailConnection() {
    const result = await this.emailService.sendEmail({
      to:
        process.env.EMAIL_TEST_RECIPIENT || 'jose.hernandezm@enginecore.com.mx',
      subject: 'Prueba de conexión con AWS SES',
      text: 'Este es un correo de prueba del sistema DocuSense',
    });

    return {
      success: result,
      message: result
        ? 'Conexión con AWS SES funcionando correctamente'
        : 'Error en la conexión con AWS SES',
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE,
        from: process.env.EMAIL_FROM,
      },
    };
  }
}
