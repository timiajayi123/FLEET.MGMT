import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { PrismaService } from '../prisma/prisma.service';
import { SpeedLimitsService } from './speed-limits.service';
import { SpeedService } from './speed.service';

@Controller('speed')
export class SpeedController {
  constructor(private readonly auth: AuthService, private readonly speed: SpeedService, private readonly limits: SpeedLimitsService, private readonly prisma: PrismaService) {}
  @Get('dashboard') async dashboard(@Req() req: Request) { await this.manager(req); return this.speed.dashboard(); }
  @Get('live') async live(@Req() req: Request) { await this.manager(req); return this.speed.live(); }
  @Get('violations') async violations(@Req() req: Request, @Query() query: Record<string, string>) { await this.manager(req); return this.speed.violations(query); }
  @Get('violations/:id') async detail(@Req() req: Request, @Param('id') id: string) { await this.manager(req); return this.speed.detail(id); }
  @Patch('violations/:id') async action(@Req() req: Request, @Param('id') id: string, @Body() body: { status: string; note?: string }) { const user = await this.manager(req); return { data: await this.speed.action(id, body.status, user.id, body.note) }; }
  @Get('reports') async reports(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) { await this.manager(req); return this.speed.reports(date(from), date(to, true)); }
  @Get('drivers/:id/summary') async driver(@Req() req: Request, @Param('id') id: string) { await this.manager(req); return this.speed.driverSummary(id); }
  @Get('settings') async settings(@Req() req: Request) { await this.manager(req); return { data: await this.limits.settings() }; }
  @Patch('settings') async updateSettings(@Req() req: Request, @Body() body: Record<string, unknown>) { const user = await requireUser(this.auth, req, ['S_ADMIN']); return { data: await this.limits.updateSettings(body, user.id) }; }
  @Get('vehicle-types') async vehicleTypes(@Req() req: Request) { await this.manager(req); return { data: await this.prisma.vehicleType.findMany({ select: { id: true, code: true, name: true, speedLimit: true, _count: { select: { vehicles: true } } }, orderBy: { name: 'asc' } }) }; }
  @Patch('vehicle-types/:id/limit') async typeLimit(@Req() req: Request, @Param('id') id: string, @Body() body: { speedLimit?: number | null }) { await requireUser(this.auth, req, ['S_ADMIN']); return { data: await this.limits.updateVehicleType(id, nullableNumber(body.speedLimit)) }; }
  @Patch('vehicles/:id/limit') async vehicleLimit(@Req() req: Request, @Param('id') id: string, @Body() body: { customSpeedLimit?: number | null }) { await requireUser(this.auth, req, ['S_ADMIN']); return { data: await this.limits.updateVehicle(id, nullableNumber(body.customSpeedLimit)) }; }
  private manager(req: Request) { return requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); }
}
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; return Number(value); }
function date(value?: string, end = false) { if (!value) return undefined; const result = new Date(value); if (Number.isNaN(result.getTime())) return undefined; if (end) result.setHours(23, 59, 59, 999); return result; }
