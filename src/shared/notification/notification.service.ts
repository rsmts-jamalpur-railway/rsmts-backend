import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Emit a notification (stores in DB, and later we can trigger WS events)
   */
  async notify(title: string, message: string, type: string) {
    this.logger.log(`[Notification - ${type}] ${title}: ${message}`);

    const notification = await this.prisma.notification.create({
      data: {
        title,
        message,
        type,
      },
    });

    this.eventsGateway.broadcast('notification', notification);
    return notification;
  }
}
