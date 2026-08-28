import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../shared/audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(createUserDto: CreateUserDto, currentUserId: string) {
    const exists = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    const password_hash = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password_hash,
        full_name: createUserDto.full_name,
        note: createUserDto.note,
        department: createUserDto.department,
        designation: createUserDto.designation,
        role_id: createUserDto.role_id,
        is_active: createUserDto.is_active ?? true,
        created_by: currentUserId,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
      },
    });

    await this.audit.logAction(currentUserId, 'CREATE_USER', {
      target_user: user.email,
    });
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        full_name: true,
        note: true,
        department: true,
        designation: true,
        is_active: true,
        role: true,
        last_login: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        full_name: true,
        note: true,
        department: true,
        designation: true,
        is_active: true,
        role: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUserId: string,
  ) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        updated_by: currentUserId,
      },
      select: { id: true, email: true, full_name: true },
    });

    await this.audit.logAction(currentUserId, 'UPDATE_USER', {
      target_user: user.email,
      updates: updateUserDto,
    });
    return user;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    
    // Check if user is trying to delete the super admin (id 1)
    if (user.role_id === 1 && user.email.includes('admin')) {
        throw new BadRequestException('Cannot delete the root administrator account');
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: `User ${user.email} permanently deleted` };
  }
}
