import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
      .toString('hex');
    return `${salt}:${hash}`;
  }

  async verifyPassword(
    storedPassword: string,
    suppliedPassword: string,
  ): Promise<boolean> {
    const [salt, storedHash] = storedPassword.split(':');
    const hash = crypto
      .pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512')
      .toString('hex');
    return storedHash === hash;
  }

  async register(registerDto: RegisterDto, response: Response) {
    const { email, password } = registerDto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está en uso');
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Inicializar keyRotationCount para el token
    const keyRotationCount = user.keyRotationCount || 0;
    const token = this.generateToken(user.id, user.isAdmin, keyRotationCount);

    // Establecer cookie HTTP
    this.setAuthCookie(response, token);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    await this.emailService.sendWelcomeEmail(
      user.email,
      user.name,
      `${frontendUrl}/dashboard`,
    );

    // Devolver usuario sin el token en el cuerpo de la respuesta
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
    };
  }

  async login(loginDto: LoginDto, response: Response) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await this.verifyPassword(user.password, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Obtener el contador de rotación de claves
    const keyRotationCount = user.keyRotationCount || 0;
    const token = this.generateToken(user.id, user.isAdmin, keyRotationCount);

    // Establecer cookie HTTP
    this.setAuthCookie(response, token);

    // Devolver usuario sin el token en el cuerpo de la respuesta
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
    };
  }

  private generateToken(
    userId: string,
    isAdmin: boolean,
    keyRotationCount: number,
  ) {
    const payload = {
      sub: userId,
      isAdmin,
      keyRotation: keyRotationCount, // Incluir el contador de rotación actual
    };
    return this.jwtService.sign(payload);
  }

  // Método centralizado para establecer la cookie de autenticación
  private setAuthCookie(response: Response, token: string) {
    const expirationHours = this.configService.get<number>(
      'JWT_EXPIRATION_HOURS',
      4,
    );
    response.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expirationHours * 60 * 60 * 1000,
      path: '/',
    });
  }
}
