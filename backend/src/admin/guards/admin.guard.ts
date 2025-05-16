import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Guard para proteger rutas que requieren permisos de administrador
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Verificar si el usuario existe y es administrador
    if (!user || !user.isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos de administrador para acceder a este recurso',
      );
    }

    return true;
  }
}
