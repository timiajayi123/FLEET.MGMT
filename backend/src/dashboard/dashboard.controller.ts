import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { requireUser } from '../common/request-auth';
import { DashboardService } from './dashboard.service';
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService, private readonly auth: AuthService) {}
  @Get() async get(@Req() req: Request, @Query('days') days?: string) {
    const value = days === '90' ? 90 : 30;
    return this.dashboard.summary(await requireUser(this.auth, req), value);
  }
}
