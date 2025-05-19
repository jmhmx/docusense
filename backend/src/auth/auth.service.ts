import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto'; // Usar el módulo nativo de Node.js
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express'; // Añade esta importación

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService, // Añadido servicio de email
    private readonly configService: ConfigService, // Añadido servicio de configuración
  ) {}

  // Función para hashear contraseñas usando crypto
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

  // Función para verificar contraseñas
  private async verifyPassword(
    storedPassword: string,
    suppliedPassword: string,
  ): Promise<boolean> {
    // Separar el salt y hash almacenados
    const [salt, storedHash] = storedPassword.split(':');
    // Hashear la contraseña proporcionada con el mismo salt
    const hash = crypto
      .pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512')
      .toString('hex');
    // Comparar los hashes
    return storedHash === hash;
  }

  async register(registerDto: RegisterDto, response: Response) {
    const { email, password } = registerDto;

    // Verificar si el usuario ya existe
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está en uso');
    }

    // Hashear la contraseña
    const hashedPassword = await this.hashPassword(password);

    // Crear nuevo usuario
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Generar token
    const token = this.generateToken(user.id, user.isAdmin);

    // Establecer cookie
    response.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000,
      path: '/',
    });

    // Enviar correo de bienvenida
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    await this.emailService.sendWelcomeEmail(
      user.email,
      user.name,
      `${frontendUrl}/dashboard`,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  async login(loginDto: LoginDto, response: Response) {
    const { email, password } = loginDto;

    // Verificación de credenciales
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await this.verifyPassword(user.password, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar token
    const token = this.generateToken(user.id, user.isAdmin);

    // Establecer como cookie HttpOnly
    response.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000,
      path: '/',
    });

    // También devolver el token para mantener compatibilidad con el cliente
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
      token, // Seguimos enviando el token para mantener compatibilidad
    };
  }

  private generateToken(userId: string, isAdmin: boolean) {
    const payload = { sub: userId, isAdmin };
    return this.jwtService.sign(payload);
  }
}
