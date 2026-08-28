import {
  SetMetadata,
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Decorator
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('User roles not found');
    }

    const hasRole = user.roles.some((role: string) => requiredRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        `Requires one of these roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
