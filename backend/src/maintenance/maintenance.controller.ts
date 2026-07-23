import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { CreateMaintenanceRequestDto, ReviewMaintenanceRequestDto } from './maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly auth: AuthService, private readonly maintenance: MaintenanceService) {}
  @Get() async list(@Req() req: Request) { return this.maintenance.list(await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Get('vehicles') async vehicles(@Req() req: Request) { return this.maintenance.vehicles(await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Post() async create(@Req() req: Request, @Body() dto: CreateMaintenanceRequestDto) { return this.maintenance.create(dto, await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Patch(':id/review') async review(@Req() req: Request, @Param('id') id: string, @Body() dto: ReviewMaintenanceRequestDto) { return this.maintenance.review(id, dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
}
