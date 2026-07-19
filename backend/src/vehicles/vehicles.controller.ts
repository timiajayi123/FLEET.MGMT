import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BulkDeleteVehiclesDto, ForceDeleteVehicleDto, SaveVehicleDto } from './vehicles.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehicles: VehiclesService) {}

  @Get()
  async list() {
    return { data: await this.vehicles.list() };
  }

  @Post()
  async create(@Body() dto: SaveVehicleDto) {
    return { data: await this.vehicles.create(dto) };
  }

  @Post('bulk-delete')
  async bulkDelete(@Body() dto: BulkDeleteVehiclesDto) {
    return this.vehicles.bulkRemove(dto.ids, {
      force: dto.force,
      deleteLinkedDrivers: dto.deleteLinkedDrivers,
    });
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveVehicleDto) {
    return { data: await this.vehicles.update(id, dto) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.vehicles.remove(id) };
  }

  @Post(':id/force-delete')
  async forceRemove(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ForceDeleteVehicleDto) {
    return { data: await this.vehicles.forceRemove(id, dto) };
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 }).build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return { data: await this.vehicles.saveImage(id, file) };
  }

  @Get(':id/image')
  async image(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const image = await this.vehicles.image(id);
    res.type(image.imageMimeType!).set('Cache-Control', 'public, max-age=300').send(Buffer.from(image.imageData!));
  }
}
