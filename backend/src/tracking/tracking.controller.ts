import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { requireUser, TRACKING_VIEW_ROLES } from '../common/request-auth';
import { TrackingBatchDto, TrackingPointDto, TripCoordinateDto } from './tracking.dto';
import { TrackingService } from './tracking.service';
import { TripsService } from './trips.service';

@Controller()
export class TrackingController {
  constructor(private readonly auth: AuthService, private readonly tracking: TrackingService, private readonly trips: TripsService) {}
  @Post('driver-tracking/location') async location(@Req() req: Request, @Body() dto: TrackingPointDto) { return this.tracking.save(await requireUser(this.auth, req), dto); }
  @Post('driver-tracking/location/batch') async batch(@Req() req: Request, @Body() dto: TrackingBatchDto) { const user = await requireUser(this.auth, req); const results = []; for (const point of dto.points) results.push(await this.tracking.save(user, point, true)); return { data: results }; }
  @Get('driver-tracking/status') async status(@Req() req: Request) { const user = await requireUser(this.auth, req); return { online: true, user: { employeeId: user.employeeId, role: user.role.code } }; }
  @Get('driver-tracking/my-current-trip') async current(@Req() req: Request) { const user = await requireUser(this.auth, req, ['DRIVER']); return { data: await this.trips.current(user.employeeId) }; }
  @Post('trips/:id/start') async start(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TripCoordinateDto) { const user = await requireUser(this.auth, req, ['DRIVER']); return { data: await this.trips.start(id, user.employeeId, dto) }; }
  @Post('trips/:id/end') async end(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TripCoordinateDto) { const user = await requireUser(this.auth, req, ['DRIVER']); return { data: await this.trips.end(id, user.employeeId, dto) }; }
  @Get('trips/:id/history') async tripHistory(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) { return { data: await this.trips.history(id, await requireUser(this.auth, req)) }; }
  @Get('fleet/live') async live(@Req() req: Request) { await requireUser(this.auth, req, [...TRACKING_VIEW_ROLES]); return this.tracking.live(); }
  @Get('fleet/vehicles/:vehicleId/location-history') async vehicleHistory(@Req() req: Request, @Param('vehicleId', ParseUUIDPipe) vehicleId: string, @Query('from') from?: string) { await requireUser(this.auth, req, [...TRACKING_VIEW_ROLES]); return { data: await this.tracking.vehicleHistory(vehicleId, from ? new Date(from) : undefined) }; }
}
