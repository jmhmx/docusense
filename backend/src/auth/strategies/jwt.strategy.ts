import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      // Extraer JWT de la cookie en lugar del encabezado
      jwtFromRequest: (req) => {
        console.log('Cookies en solicitud:', req.cookies);
        if (!req.cookies) return null;
        const token = req.cookies['auth_token'];
        console.log(
          'Token extraído de cookie:',
          token ? 'presente' : 'ausente',
        );
        return token;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    console.log('Payload JWT recibido:', payload);
    try {
      const user = await this.usersService.findOne(payload.sub);
      console.log('Usuario encontrado:', user);
      if (!user) {
        console.log('Usuario no encontrado para el payload:', payload);
        throw new UnauthorizedException();
      }
      return user;
    } catch (error) {
      console.log('Error en validación JWT:', error);
      throw new UnauthorizedException();
    }
  }
}
