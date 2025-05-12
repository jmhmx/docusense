// backend/src/users/users.controller.ts - actualizado
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
  Req,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

@Controller('api/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
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
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
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
