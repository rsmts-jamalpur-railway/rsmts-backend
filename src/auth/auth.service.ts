import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { argon2id } from 'hash-wasm';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { identifier, password } = loginDto;

    // 1. Find user via any of the identifiers (Employee ID, Email, Mobile)
    const userIdentifier = await this.prisma.userIdentifier.findFirst({
      where: {
        normalized_value: identifier.toLowerCase().trim(),
      },
      include: {
        user: {
          include: {
            employee: true,
            user_roles: {
              include: { role: true }
            }
          }
        }
      }
    });

    if (!userIdentifier || !userIdentifier.user) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    const user = userIdentifier.user;

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or locked');
    }

    // 2. Verify Argon2id password
    const { argon2Verify } = await import('hash-wasm');
    const isPasswordValid = await argon2Verify({
      password,
      hash: user.password_hash
    });

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const payload = {
      sub: user.id,
      employee_id: user.employee.employee_number,
      roles: user.user_roles.map(ur => ur.role.name),
      assigned_location_id: user.assigned_location_id,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Store in Session table
    await this.prisma.session.create({
      data: {
        user_id: user.id,
        session_token_hash: refreshToken, // Should hash this in prod
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
    });

    await this.prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        details: { message: `User logged in via ${userIdentifier.type}` },
      },
    });

    return {
      user: {
        id: user.id,
        name: `${user.employee.first_name} ${user.employee.last_name || ''}`.trim(),
        roles: payload.roles,
        assigned_location_id: user.assigned_location_id,
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    };
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.session.updateMany({
      where: {
        user_id: userId,
        session_token_hash: refreshToken,
      },
      data: {
        revoked_at: new Date()
      }
    });
  }
}
