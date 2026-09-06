import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { argon2id } from 'hash-wasm';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async hashPassword(password: string): Promise<string> {
    const salt = new Uint8Array(16);
    crypto.webcrypto.getRandomValues(salt);
    return await argon2id({
      password,
      salt,
      parallelism: 1,
      iterations: 256,
      memorySize: 512,
      hashLength: 32,
      outputType: 'encoded',
    });
  }

  /**
   * List all workshop users with detailed roles and location scopes
   */
  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        employee: true,
        assigned_location: true,
        identifiers: true,
        user_roles: {
          include: {
            role: true,
            scope_location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      count: users.length,
      data: users.map((user) => {
        const primaryUserRole = user.user_roles[0];
        const primaryRole = primaryUserRole?.role;
        const emailIdent = user.identifiers.find((i) => i.type === 'EMAIL');
        const phoneIdent = user.identifiers.find((i) => i.type === 'PHONE');

        return {
          id: user.id,
          employee_id: user.employee.employee_number,
          employee_uuid: user.employee.id,
          first_name: user.employee.first_name,
          last_name: user.employee.last_name || '',
          full_name: `${user.employee.first_name} ${user.employee.last_name || ''}`.trim(),
          email: emailIdent?.value || `${user.employee.employee_number.toLowerCase()}@rsmts.gov.in`,
          phone: phoneIdent?.value || null,
          status: user.status,
          is_active: user.status === 'ACTIVE',
          role: primaryRole
            ? {
                id: primaryRole.id,
                role_name: primaryRole.name,
                description: primaryRole.description,
              }
            : {
                id: 'viewer',
                role_name: 'VIEWER',
                description: 'Read-only access',
              },
          roles: user.user_roles.map((ur) => ur.role.name),
          assigned_location_id: user.assigned_location_id,
          assigned_location: user.assigned_location
            ? {
                location_id: user.assigned_location.location_id,
                location_type: user.assigned_location.location_type,
                zone: user.assigned_location.zone,
              }
            : null,
          department: primaryUserRole?.scope_department || 'Jamalpur Workshop',
          designation: primaryUserRole?.scope_section || 'Section Supervisor',
          last_login_at: user.last_login_at,
          createdAt: user.createdAt,
        };
      }),
    };
  }

  /**
   * List all master roles
   */
  async getRoles() {
    const roles = await this.prisma.role.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        role_name: r.name,
        name: r.name,
        description: r.description,
        is_system_role: r.is_system_role,
      })),
    };
  }

  /**
   * Create a new employee and user account with assigned role
   */
  async create(dto: CreateUserDto) {
    const normalizedEmpNo = dto.employee_number.trim().toUpperCase();
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Check duplicate employee number
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { employee_number: normalizedEmpNo },
    });
    if (existingEmployee) {
      throw new BadRequestException(`Employee number ${normalizedEmpNo} already exists.`);
    }

    // 2. Check duplicate email identifier
    const existingEmail = await this.prisma.userIdentifier.findFirst({
      where: { normalized_value: normalizedEmail },
    });
    if (existingEmail) {
      throw new BadRequestException(`Email ${dto.email} is already registered to another user.`);
    }

    // 2b. Validate location if specified
    let validLocationId: string | null = null;
    if (dto.assigned_location_id && dto.assigned_location_id.trim()) {
      const loc = await this.prisma.location.findUnique({
        where: { location_id: dto.assigned_location_id.trim() },
      });
      if (loc) {
        validLocationId = loc.location_id;
      }
    }

    // 3. Create Employee
    const employee = await this.prisma.employee.create({
      data: {
        employee_number: normalizedEmpNo,
        first_name: dto.first_name.trim(),
        last_name: dto.last_name?.trim() || null,
        employment_status: 'ACTIVE',
      },
    });

    // 4. Hash password
    const pwdHash = await this.hashPassword(dto.password);

    // 5. Create User
    const user = await this.prisma.user.create({
      data: {
        employee_id: employee.id,
        assigned_location_id: validLocationId,
        password_hash: pwdHash,
        status: 'ACTIVE',
      },
    });

    // 6. Create User Identifiers (Email + Employee ID)
    await this.prisma.userIdentifier.createMany({
      data: [
        {
          user_id: user.id,
          type: 'EMAIL',
          value: dto.email.trim(),
          normalized_value: normalizedEmail,
          is_primary: true,
          is_verified: true,
        },
        {
          user_id: user.id,
          type: 'EMPLOYEE_ID',
          value: normalizedEmpNo,
          normalized_value: normalizedEmpNo.toLowerCase(),
          is_primary: false,
          is_verified: true,
        },
      ],
    });

    // 7. Find or create Role
    let role = await this.prisma.role.findUnique({
      where: { name: dto.role_name.trim().toUpperCase() },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: dto.role_name.trim().toUpperCase(),
          description: `${dto.role_name} operational role`,
        },
      });
    }

    // 8. Assign Role
    await this.prisma.userRole.create({
      data: {
        user_id: user.id,
        role_id: role.id,
        scope_location_id: validLocationId,
        scope_department: dto.department || 'Jamalpur Workshop',
        scope_section: dto.designation || 'Supervisor',
      },
    });

    // 9. Write Security Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: 'USER_CREATED',
          details: {
            employee_number: normalizedEmpNo,
            full_name: `${dto.first_name} ${dto.last_name || ''}`.trim(),
            role: role.name,
            email: dto.email.trim(),
            assigned_location: validLocationId || 'ALL_LOCATIONS',
          },
        },
      });
    } catch (auditErr) {
      this.logger.warn(`Failed to create audit log for user creation: ${auditErr}`);
    }

    this.logger.log(`Created user ${normalizedEmpNo} (${dto.first_name}) with role ${role.name}`);

    return {
      success: true,
      message: `User ${dto.first_name} (${normalizedEmpNo}) registered successfully.`,
      data: {
        id: user.id,
        employee_number: normalizedEmpNo,
        full_name: `${dto.first_name} ${dto.last_name || ''}`.trim(),
        role: role.name,
        assigned_location_id: validLocationId,
      },
    };
  }

  /**
   * Update existing user details, role, status, or password
   */
  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        employee: true,
        user_roles: true,
        identifiers: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    // 1. Update Employee details if provided
    if (dto.first_name || dto.last_name) {
      await this.prisma.employee.update({
        where: { id: user.employee_id },
        data: {
          first_name: dto.first_name ? dto.first_name.trim() : user.employee.first_name,
          last_name: dto.last_name !== undefined ? dto.last_name.trim() : user.employee.last_name,
        },
      });
    }

    // 2. Update User basic properties
    const userUpdateData: any = {};
    if (dto.assigned_location_id !== undefined) {
      userUpdateData.assigned_location_id = dto.assigned_location_id || null;
    }
    if (dto.status) {
      userUpdateData.status = dto.status.toUpperCase();
    }
    if (dto.password && dto.password.length >= 6) {
      userUpdateData.password_hash = await this.hashPassword(dto.password);
      userUpdateData.password_changed_at = new Date();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      });
    }

    // 3. Update Email Identifier if provided
    if (dto.email) {
      const normEmail = dto.email.trim().toLowerCase();
      const existingEmailIdent = user.identifiers.find((i) => i.type === 'EMAIL');
      if (existingEmailIdent) {
        await this.prisma.userIdentifier.update({
          where: { id: existingEmailIdent.id },
          data: {
            value: dto.email.trim(),
            normalized_value: normEmail,
          },
        });
      } else {
        await this.prisma.userIdentifier.create({
          data: {
            user_id: user.id,
            type: 'EMAIL',
            value: dto.email.trim(),
            normalized_value: normEmail,
            is_primary: true,
          },
        });
      }
    }

    // 4. Update Role if provided
    if (dto.role_name) {
      const normRoleName = dto.role_name.trim().toUpperCase();
      let role = await this.prisma.role.findUnique({
        where: { name: normRoleName },
      });
      if (!role) {
        role = await this.prisma.role.create({
          data: { name: normRoleName, description: `${normRoleName} Role` },
        });
      }

      // Delete previous roles and insert new
      await this.prisma.userRole.deleteMany({
        where: { user_id: user.id },
      });

      await this.prisma.userRole.create({
        data: {
          user_id: user.id,
          role_id: role.id,
          scope_location_id: dto.assigned_location_id !== undefined ? dto.assigned_location_id : user.assigned_location_id,
          scope_department: dto.department || 'Jamalpur Workshop',
          scope_section: dto.designation || 'Supervisor',
        },
      });
    } else if (dto.department || dto.designation) {
      // Update scope fields on existing UserRole
      const firstRole = user.user_roles[0];
      if (firstRole) {
        await this.prisma.userRole.updateMany({
          where: { user_id: user.id },
          data: {
            scope_department: dto.department || firstRole.scope_department,
            scope_section: dto.designation || firstRole.scope_section,
          },
        });
      }
    }

    // Record audit log entry
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: 'USER_UPDATED',
          details: {
            employee_number: user.employee.employee_number,
            updated_fields: Object.keys(dto).filter((k) => k !== 'password'),
            status: dto.status,
            role: dto.role_name,
          },
        },
      });
    } catch (auditErr) {
      this.logger.warn(`Failed to create audit log for user update: ${auditErr}`);
    }

    this.logger.log(`Updated user ${user.id} (${user.employee.employee_number})`);

    return {
      success: true,
      message: 'User updated successfully.',
    };
  }

  /**
   * Delete user account
   */
  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    try {
      // Clean up dependent direct auth records first
      await this.prisma.session.deleteMany({ where: { user_id: id } });
      await this.prisma.userIdentifier.deleteMany({ where: { user_id: id } });
      await this.prisma.userRole.deleteMany({ where: { user_id: id } });

      // Attempt hard delete of user
      await this.prisma.user.delete({ where: { id } });

      // Attempt clean up of employee record if not referenced
      try {
        await this.prisma.employee.delete({ where: { id: user.employee_id } });
      } catch (empErr) {
        // Ignored if employee is referenced elsewhere
      }

      this.logger.log(`Deleted user ${id} (${user.employee.employee_number})`);

      return {
        success: true,
        message: `User ${user.employee.first_name} (${user.employee.employee_number}) has been permanently deleted.`,
      };
    } catch (err: any) {
      // If foreign keys (e.g. MovementLog, AuditLog) prevent hard deletion, safe soft-delete
      this.logger.warn(`Foreign key prevented hard deletion for ${id}; performing safe deactivation.`);
      await this.prisma.user.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: `User has operational audit history. Account access has been revoked and user marked inactive.`,
      };
    }
  }
}
