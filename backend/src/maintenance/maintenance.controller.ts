import { Body, Controller, Get, Header, Param, ParseFilePipeBuilder, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { CreateMaintenanceRequestDto, MaintenanceDriverFeedbackDto, ReviewMaintenanceRequestDto } from './maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly auth: AuthService, private readonly maintenance: MaintenanceService) {}
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async list(
    @Req() req: Request,
    @Query('limit') requestedLimit?: string,
    @Query('view') requestedView?: string,
  ) {
    const parsedLimit = Number(requestedLimit);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(200, Math.max(2, Math.floor(parsedLimit)))
      : 2;
    return this.maintenance.list(
      await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER']),
      limit,
      requestedView === 'history' ? 'history' : 'active',
    );
  }
  @Get('vehicles')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async vehicles(@Req() req: Request) { return this.maintenance.vehicles(await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Post()
  @UseInterceptors(FileInterceptor('evidence', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async create(@Req() req: Request, @Body() dto: CreateMaintenanceRequestDto, @UploadedFile(new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 }).build({ fileIsRequired: false })) file?: Express.Multer.File) { return this.maintenance.create(dto, await requireUser(this.auth, req, ['DRIVER']), file); }
  @Get(':id/evidence')
  async evidence(@Param('id') id: string, @Req() req: Request, @Res() res: Response) { await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER']); const evidence = await this.maintenance.evidence(id); res.type(evidence.evidenceMimeType!).send(Buffer.from(evidence.evidenceData!)); }
  @Patch(':id/review') async review(@Req() req: Request, @Param('id') id: string, @Body() dto: ReviewMaintenanceRequestDto) { return this.maintenance.review(id, dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
  @Patch(':id/driver-feedback') async driverFeedback(@Req() req: Request, @Param('id') id: string, @Body() dto: MaintenanceDriverFeedbackDto) { return this.maintenance.driverFeedback(id, dto, await requireUser(this.auth, req, ['DRIVER'])); }
}
