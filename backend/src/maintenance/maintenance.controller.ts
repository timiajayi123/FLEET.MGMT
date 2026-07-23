import { Body, Controller, Get, Param, ParseFilePipeBuilder, Patch, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { CreateMaintenanceRequestDto, ReviewMaintenanceRequestDto } from './maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly auth: AuthService, private readonly maintenance: MaintenanceService) {}
  @Get() async list(@Req() req: Request) { return this.maintenance.list(await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Get('vehicles') async vehicles(@Req() req: Request) { return this.maintenance.vehicles(await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Post()
  @UseInterceptors(FileInterceptor('evidence', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async create(@Req() req: Request, @Body() dto: CreateMaintenanceRequestDto, @UploadedFile(new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 }).build({ fileIsRequired: false })) file?: Express.Multer.File) { return this.maintenance.create(dto, await requireUser(this.auth, req, ['DRIVER']), file); }
  @Get(':id/evidence')
  async evidence(@Param('id') id: string, @Req() req: Request, @Res() res: Response) { await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER']); const evidence = await this.maintenance.evidence(id); res.type(evidence.evidenceMimeType!).send(Buffer.from(evidence.evidenceData!)); }
  @Patch(':id/review') async review(@Req() req: Request, @Param('id') id: string, @Body() dto: ReviewMaintenanceRequestDto) { return this.maintenance.review(id, dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
}
