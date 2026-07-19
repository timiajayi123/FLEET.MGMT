import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { VehicleRequestsService } from './vehicle-requests.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { ApproveRequestAllocationDto } from '../allocations/allocations.dto';

@Controller('vehicle-requests')
export class VehicleRequestsController {
  constructor(private readonly vehicleRequestsService: VehicleRequestsService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = await requireUser(this.auth, req);
    return { data: await this.vehicleRequestsService.list(user) };
  }

  @Patch(':id/approve')
  async approve(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<ApproveRequestAllocationDto>) {
    const user = await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]);
    return { data: await this.vehicleRequestsService.approve(id, user.id, dto) };
  }

  @Patch(':id/reject')
  async reject(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]);
    return { data: await this.vehicleRequestsService.setStatus(id, 'REJECTED') };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async create(
    @Req() req: Request,
    @Body() dto: CreateVehicleRequestDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({ fileIsRequired: false }),
    )
    attachment?: Express.Multer.File,
  ) {
    const user = await requireUser(this.auth, req);
    return this.vehicleRequestsService.create(dto, attachment, user.id);
  }
}
