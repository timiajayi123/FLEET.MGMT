import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly auth: AuthService, private readonly analytics: AnalyticsService) {}
  @Get('dashboard') async dashboard(@Req() req: Request, @Query() query: Record<string, string>) { await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); return this.analytics.dashboard(filters(query)); }
  @Get('speed') async speed(@Req() req: Request, @Query() query: Record<string, string>) { await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); const threshold = Number(query.threshold); return this.analytics.speed(filters(query), Number.isFinite(threshold) && threshold >= 20 && threshold <= 200 ? threshold : 100); }
  @Get('reports/vehicle-requests') async report(@Req() req: Request, @Query() query: Record<string, string>) { await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); return this.analytics.report(filters(query)); }
}
function filters(query: Record<string, string>) { return { from: parseDate(query.from), to: parseDate(query.to, true), departmentId: query.departmentId || undefined, vehicleId: query.vehicleId || undefined, driverId: query.driverId || undefined, status: query.status || undefined, search: query.search || undefined }; }
function parseDate(value?: string, end = false) { if (!value) return undefined; const date = new Date(value); if (Number.isNaN(date.getTime())) return undefined; if (end) date.setUTCHours(23, 59, 59, 999); return date; }
