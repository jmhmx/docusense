import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import { AuthService } from '../auth/auth.service';

// Extender el DTO para incluir contraseña actual
interface UpdateUserWithCurrentPasswordDto extends UpdateUserDto {
  currentPassword?: string;
}

@Controller('api/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService, // Añadido para acceder a verifyPassword
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('available')
  async getAvailableUsers() {
    try {
      this.logger.log(
        'Iniciando búsqueda de usuarios disponibles para menciones',
      );
      const users = await this.usersService.findAll();

      // Mapear solo los datos necesarios para mostrar en menciones
      const mappedUsers = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      }));

      this.logger.log(`Retornando ${mappedUsers.length} usuarios disponibles`);
      return mappedUsers;
    } catch (error) {
      this.logger.error(
        `Error al obtener usuarios disponibles: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al obtener usuarios disponibles: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserWithCurrentPasswordDto,
    @Req() req, // Usar @Req() en lugar de @Request()
  ) {
    // Verificar si el usuario es admin o es el mismo usuario
    if (id !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar este usuario',
      );
    }

    // Si se actualiza la contraseña y no es admin, verificar contraseña actual
    if (updateUserDto.password && id === req.user.id && !req.user.isAdmin) {
      if (!updateUserDto.currentPassword) {
        throw new BadRequestException(
          'Se requiere la contraseña actual para cambiar la contraseña',
        );
      }

      // Verificar contraseña actual
      const user = await this.usersService.findOne(id);

      // Usar el método de authService en lugar de uno local
      const isValid = await this.authService.verifyPassword(
        user.password,
        updateUserDto.currentPassword,
      );

      if (!isValid) {
        throw new BadRequestException('La contraseña actual es incorrecta');
      }

      // Eliminar currentPassword para no guardarlo
      delete updateUserDto.currentPassword;
    }

    // Actualizar el usuario
    const updatedUser = await this.usersService.update(id, updateUserDto);

    // Si se cambió la contraseña, registrar en auditoría
    if (updateUserDto.password) {
      await this.auditLogService.log(AuditAction.USER_UPDATE, req.user.id, id, {
        action: 'password_change',
        byAdmin: req.user.isAdmin && id !== req.user.id,
      });
    }

    return updatedUser;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('biometrics/setup-complete')
  async completeBiometricSetup(
    @Body() setupDto: { userId: string; setupMethod: string },
    @Req() req,
  ) {
    // Verificar que el usuario solo puede completar su propio setup
    if (req.user.id !== setupDto.userId && !req.user.isAdmin) {
      throw new UnauthorizedException(
        'No puede completar la configuración biométrica de otro usuario',
      );
    }

    try {
      // Actualizar el perfil del usuario con la información biométrica
      await this.usersService.update(setupDto.userId, {
        biometricAuthEnabled: true,
        biometricAuthMethod: setupDto.setupMethod,
        biometricAuthSetupAt: new Date(),
      });

      // Registrar en auditoría
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        setupDto.userId,
        null,
        {
          action: 'biometric_setup_complete',
          method: setupDto.setupMethod,
        },
      );

      return {
        success: true,
        message: 'Configuración biométrica completada',
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al completar configuración biométrica: ${error.message}`,
      );
    }
  }
}
