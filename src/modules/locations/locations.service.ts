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
