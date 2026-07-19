import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { requireUser, TRACKING_VIEW_ROLES } from '../common/request-auth';
import { TrackingService } from '../tracking/tracking.service';
import { LocationUpdateDto } from './gps.dto';

@Controller('gps')
export class GpsController {
  constructor(private readonly tracking: TrackingService, private readonly auth: AuthService) {}
  @Post('location') async update(@Req() req: Request, @Body() dto: LocationUpdateDto) {
    return this.tracking.save(await requireUser(this.auth, req), { ...dto, clientEventId: randomUUID() });
  }
  @Get('live') async live(@Req() req: Request) {
    await requireUser(this.auth, req, [...TRACKING_VIEW_ROLES]);
    return this.tracking.live();
  }
}
