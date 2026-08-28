import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AuditService } from '../../shared/audit/audit.service';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(data: any, currentUserId: string) {
    const loc = await this.prisma.location.create({
      data: {
        location_id: data.location_id,
        max_capacity: data.max_capacity,
        standard_tat_hours: data.standard_tat_hours,
      },
    });

    await this.audit.logAction(currentUserId, 'CREATE_LOCATION', {
      location: loc.location_id,
    });
    return loc;
  }

  findAll() {
    return this.prisma.location.findMany();
  }

  async findOne(id: string) {
    const loc = await this.prisma.location.findUnique({
      where: { location_id: id },
    });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  async update(
    id: string,
    updateLocationDto: UpdateLocationDto,
    currentUserId: string,
  ) {
    const loc = await this.prisma.location.update({
      where: { location_id: id },
      data: updateLocationDto,
    });

    await this.audit.logAction(currentUserId, 'UPDATE_LOCATION', {
      location: id,
      updates: updateLocationDto,
    });
    return loc;
  }
}
