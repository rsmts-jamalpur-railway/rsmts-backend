import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { QaService, SubmitInspectionDto } from './qa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('QA & Inspection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('qa')
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Post('inspect')
  @ApiOperation({ summary: 'Submit a QA Inspection result for an active operation' })
  async submitInspection(@Request() req, @Body() data: SubmitInspectionDto) {
    return this.qaService.submitInspection(req.user.userId, data);
  }
}
