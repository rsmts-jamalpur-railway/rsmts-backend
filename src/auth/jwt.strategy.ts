import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default_secret',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { 
        employee: true,
        user_roles: { include: { role: true } }
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is inactive or not found');
    }

    return {
      userId: user.id,
      employeeId: user.employee.employee_number,
      roles: user.user_roles.map(ur => ur.role.name),
      assigned_location_id: user.assigned_location_id,
    };
  }
}
