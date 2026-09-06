import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all workshop users with roles and assignments' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get all operational roles' })
  async getRolesFromUsers() {
    return this.usersService.getRoles();
  }

  @Post()
  @ApiOperation({ summary: 'Register a new workshop user with employee profile and role' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user details, role assignment, status, or password' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or deactivate a user account' })
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}

// Dedicated Roles Controller for top-level GET /roles
@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all operational workshop roles' })
  async getRoles() {
    return this.usersService.getRoles();
  }
}
