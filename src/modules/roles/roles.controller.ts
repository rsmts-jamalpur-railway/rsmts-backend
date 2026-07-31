import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Roles (Master Data)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrator', 'Management')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all available roles' })
  findAll() {
    return this.rolesService.findAll();
  }
}
