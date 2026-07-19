import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { CreateAllocationDto, RejectAllocationDto, ReportIssueDto } from './allocations.dto';
import { AllocationsService } from './allocations.service';

@Controller('vehicle-allocations')
export class AllocationsController {
  constructor(private readonly service: AllocationsService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = await requireUser(this.auth, req);
    return { data: await this.service.list(user) };
  }

  @Get('my-dashboard')
  async myDashboard(@Req() req: Request) {
    const user = await requireUser(this.auth, req, ['DRIVER']);
    return this.service.driverDashboard(user.employeeId);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateAllocationDto) {
    const user = await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]);
    return { data: await this.service.create(dto, user.id) };
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAllocationDto) {
    const user = await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]);
    return { data: await this.service.update(id, dto, user.id) };
  }

  @Post(':id/accept')
  async accept(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const user = await requireUser(this.auth, req, ['DRIVER']);
    return { data: await this.service.driverDecision(id, user.employeeId, true) };
  }

  @Post(':id/reject')
  async reject(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectAllocationDto) {
    const user = await requireUser(this.auth, req, ['DRIVER']);
    return { data: await this.service.driverDecision(id, user.employeeId, false, dto.reason) };
  }

  @Post(':id/emergency')
  async emergency(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportIssueDto) {
    const user = await requireUser(this.auth, req, ['DRIVER']);
    return { data: await this.service.emergency(id, user.employeeId, dto.message) };
  }

  @Post(':id/issue')
  async issue(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportIssueDto) {
    const user = await requireUser(this.auth, req, ['DRIVER']);
    return { data: await this.service.reportIssue(id, user.employeeId, dto.message) };
  }

  @Patch(':id/complete')
  async complete(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]);
    return { data: await this.service.completeWithoutTrip(id) };
  }

  @Delete(':id')
  async cancel(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]);
    return { data: await this.service.cancel(id) };
  }
}
