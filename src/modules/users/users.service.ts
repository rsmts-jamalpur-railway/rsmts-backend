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
      where: { employee_id: createUserDto.employee_id },
    });
    if (exists) {
      throw new BadRequestException('Employee ID already exists');
    }

    const password_hash = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        employee_id: createUserDto.employee_id,
        password_hash,
        full_name: createUserDto.full_name,
        department: createUserDto.department,
        designation: createUserDto.designation,
        role_id: createUserDto.role_id,
        is_active: createUserDto.is_active ?? true,
        created_by: currentUserId,
      },
      select: {
        id: true,
        employee_id: true,
        full_name: true,
        role: true,
        is_active: true,
      },
    });

    await this.audit.logAction(currentUserId, 'CREATE_USER', {
      target_user: user.employee_id,
    });
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        employee_id: true,
        full_name: true,
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
        employee_id: true,
        full_name: true,
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
      select: { id: true, employee_id: true, full_name: true },
    });

    await this.audit.logAction(currentUserId, 'UPDATE_USER', {
      target_user: user.employee_id,
      updates: updateUserDto,
    });
    return user;
  }
}
