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
import { ForceDeleteDriverDto, SaveDriverDto } from './drivers.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
export class DriversController {
  constructor(private drivers: DriversService) {}

  @Get()
  async list() {
    return { data: await this.drivers.list() };
  }

  @Get(':id/details')
  async details(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.drivers.details(id) };
  }

  @Post()
  async create(@Body() dto: SaveDriverDto) {
    return { data: await this.drivers.create(dto) };
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveDriverDto) {
    return { data: await this.drivers.update(id, dto) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.drivers.remove(id) };
  }

  @Post(':id/force-delete')
  async forceRemove(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ForceDeleteDriverDto) {
    return { data: await this.drivers.forceRemove(id, dto) };
  }

  @Post(':id/passport')
  @UseInterceptors(FileInterceptor('passport', { limits: { fileSize: 3 * 1024 * 1024 } }))
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: 3 * 1024 * 1024 }).build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return { data: await this.drivers.savePassport(id, file) };
  }

  @Get(':id/passport')
  async passport(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const p = await this.drivers.passport(id);
    res.type(p.passportMimeType!).send(Buffer.from(p.passportData!));
  }
}
