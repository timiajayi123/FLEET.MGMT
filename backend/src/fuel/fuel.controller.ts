import { Body, Controller, Get, Param, Patch, Post, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { BaselineDto, CreateFuelEntryDto, DecisionDto, FuelCardDto, FuelPriceDto, StationDto } from './fuel.dto';
import { FuelService } from './fuel.service';

@Controller('fuel')
export class FuelController {
  constructor(private readonly auth: AuthService, private readonly fuel: FuelService) {}

  @Get('bootstrap') async bootstrap(@Req() req: Request) { return this.fuel.bootstrap(await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Get('entries') async entries(@Req() req: Request) { return this.fuel.list(await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER'])); }
  @Get('dashboard') async dashboard(@Req() req: Request) { await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); return this.fuel.dashboard(); }
  @Post('entries')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'receipt', maxCount: 1 }, { name: 'dashboardPhoto', maxCount: 1 }, { name: 'odometerPhoto', maxCount: 1 }], { limits: { fileSize: 8 * 1024 * 1024, files: 3 } }))
  async create(@Req() req: Request, @Body() dto: CreateFuelEntryDto, @UploadedFiles() files: Record<string, Express.Multer.File[] | undefined>) { return this.fuel.create(dto, await requireUser(this.auth, req, ['S_ADMIN', 'FM', 'DRIVER']), files ?? {}); }
  @Patch('entries/:id/decision') async decision(@Req() req: Request, @Param('id') id: string, @Body() dto: DecisionDto) { return this.fuel.decide(id, dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
  @Get('cards') async cards(@Req() req: Request) { await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); return this.fuel.cards(); }
  @Post('cards') async card(@Req() req: Request, @Body() dto: FuelCardDto) { return this.fuel.createCard(dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
  @Get('stations') async stations(@Req() req: Request) { await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); return this.fuel.stations(); }
  @Post('stations') async station(@Req() req: Request, @Body() dto: StationDto) { return this.fuel.createStation(dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
  @Post('prices') async price(@Req() req: Request, @Body() dto: FuelPriceDto) { return this.fuel.createPrice(dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
  @Patch('baselines/:vehicleId') async baseline(@Req() req: Request, @Param('vehicleId') vehicleId: string, @Body() dto: BaselineDto) { return this.fuel.saveBaseline(vehicleId, dto, await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES])); }
}
