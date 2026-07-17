import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { VehicleRequestsService } from './vehicle-requests.service';

@Controller('vehicle-requests')
export class VehicleRequestsController {
  constructor(private readonly vehicleRequestsService: VehicleRequestsService, private readonly auth: AuthService) {}

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
    const token = req.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${SESSION_COOKIE}=`))?.split('=')[1];
    const user = await this.auth.fromToken(token);
    return this.vehicleRequestsService.create(dto, attachment, user?.id);
  }
}
