import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  Get,
  Request,
  ValidationPipe,
  UsePipes,
  HttpCode,
  HttpStatus,
  Logger,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { Response } from 'express';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      exceptionFactory: (errors) => {
        // Personalizar mensajes de error de validación
        const formattedErrors = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints || {})[0] || 'Dato inválido',
          value: error.value,
        }));

        return {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Errores de validación',
          errors: formattedErrors,
        };
      },
    }),
  )
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    this.logger.log(
      `Registro desde IP: ${ipAddress}, User-Agent: ${userAgent?.substring(0, 50)}`,
    );

    try {
      const result = await this.authService.register(registerDto, response);

      this.logger.log(`Registro exitoso para: ${registerDto.email}`);

      return {
        success: true,
        message: 'Cuenta creada exitosamente',
        user: result.user,
      };
    } catch (error) {
      this.logger.error(`Error en registro: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints || {})[0] || 'Dato inválido',
          value: error.value,
        }));

        return {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Errores de validación',
          errors: formattedErrors,
        };
      },
    }),
  )
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    this.logger.log(
      `Login desde IP: ${ipAddress}, User-Agent: ${userAgent?.substring(0, 50)}`,
    );

    try {
      const result = await this.authService.login(loginDto, response);

      this.logger.log(`Login exitoso para: ${loginDto.email}`);

      return {
        success: true,
        message: 'Inicio de sesión exitoso',
        user: result.user,
      };
    } catch (error) {
      this.logger.error(
        `Error en login para ${loginDto.email}: ${error.message}`,
      );
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response, @Request() req) {
    this.logger.log(`Logout para usuario: ${req.user?.id}`);

    response.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      success: true,
      message: 'Sesión cerrada exitosamente',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    // Excluir la contraseña de los datos devueltos
    const { password, twoFactorTempSecret, ...userData } = req.user;

    this.logger.log(`Perfil solicitado por usuario: ${req.user.id}`);

    return {
      success: true,
      user: userData,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  verifyToken(@Request() req) {
    return {
      success: true,
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        isAdmin: req.user.isAdmin,
      },
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('security-stats')
  getSecurityStats(@Request() req) {
    this.logger.log(
      `Estadísticas de seguridad solicitadas por admin: ${req.user.id}`,
    );

    const stats = this.authService.getSecurityStats();
    return {
      success: true,
      stats,
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('unblock-user')
  @HttpCode(HttpStatus.OK)
  unblockUser(@Body('email') email: string, @Request() req) {
    if (!email) {
      return {
        success: false,
        message: 'Email es requerido',
      };
    }

    this.logger.log(`Admin ${req.user.id} desbloqueando usuario: ${email}`);

    const unblocked = this.authService.unblockUser(email);

    return {
      success: unblocked,
      message: unblocked
        ? 'Usuario desbloqueado exitosamente'
        : 'Usuario no estaba bloqueado o no encontrado',
    };
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmailAvailability(@Body('email') email: string) {
    if (!email) {
      return {
        available: false,
        message: 'Email es requerido',
      };
    }

    // Validar formato básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        available: false,
        message: 'Formato de email inválido',
      };
    }

    try {
      const { UsersService } = await import('../users/users.service');
      const usersService = new UsersService(null as any); // Simplificado para el ejemplo

      const existingUser = await usersService.findByEmail(
        email.toLowerCase().trim(),
      );

      return {
        available: !existingUser,
        message: existingUser
          ? 'Este correo electrónico ya está registrado'
          : 'Correo electrónico disponible',
      };
    } catch (error) {
      this.logger.error(
        `Error verificando disponibilidad de email: ${error.message}`,
      );
      return {
        available: false,
        message: 'Error verificando disponibilidad',
      };
    }
  }
}
