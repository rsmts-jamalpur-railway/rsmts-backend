import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../../auth/roles.guard';

@ApiTags('Locations (Master Data)')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Roles('Administrator', 'Management', 'SSE', 'WRS_5_Inspector', 'Shop_InCharge', 'Yard_Master')
  @Get()
  @ApiOperation({ summary: 'List all locations and capacities' })
  findAll() {
    return this.locationsService.findAll();
  }

  @Roles('Administrator', 'Management', 'SSE', 'WRS_5_Inspector', 'Shop_InCharge', 'Yard_Master')
  @Get(':id')
  @ApiOperation({ summary: 'Get single location details' })
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Roles('Administrator', 'Management')
  @Patch(':id')
  @ApiOperation({ summary: 'Update location capacity/TAT' })
  update(@Param('id') id: string, @Body() updateLocationDto: UpdateLocationDto, @Request() req) {
    return this.locationsService.update(id, updateLocationDto, req.user.userId);
  }
}
