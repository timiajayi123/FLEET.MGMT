import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MasterDataQueryDto, SaveMasterDataDto } from './dto/master-data.dto';
import {
  DepartmentsService,
  DirectoratesService,
  LocationsService,
  ResourceService,
  RolesService,
  UnitsService,
  VehicleTypesService,
} from './resource-services';

abstract class ResourceController {
  constructor(private readonly service: ResourceService) {}
  @Get() list(@Query() query: MasterDataQueryDto) {
    return this.service.list(query);
  }
  @Get(':id') async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.get(id) };
  }
  @Post() async create(@Body() dto: SaveMasterDataDto) {
    return { data: await this.service.create(dto) };
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveMasterDataDto,
  ) {
    return { data: await this.service.update(id, dto) };
  }
  @Delete(':id') async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.remove(id) };
  }
}

@Controller('directorates')
export class DirectoratesController extends ResourceController {
  constructor(service: DirectoratesService) {
    super(service);
  }
}
@Controller('departments')
export class DepartmentsController extends ResourceController {
  constructor(service: DepartmentsService) {
    super(service);
  }
}
@Controller('units')
export class UnitsController extends ResourceController {
  constructor(service: UnitsService) {
    super(service);
  }
}
@Controller('locations')
export class LocationsController extends ResourceController {
  constructor(service: LocationsService) {
    super(service);
  }
}
@Controller('vehicle-types')
export class VehicleTypesController extends ResourceController {
  constructor(private readonly vehicleTypes: VehicleTypesService) {
    super(vehicleTypes);
  }
  @Post(':id/map-icon')
  @UseInterceptors(FileInterceptor('mapIcon', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadMapIcon(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) throw new BadRequestException('Upload a PNG, JPEG, WebP, or SVG icon up to 2 MB.');
    return { data: await this.vehicleTypes.saveMapIcon(id, file) };
  }
  @Get(':id/map-icon')
  async getMapIcon(@Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    const icon = await this.vehicleTypes.mapIcon(id);
    response.setHeader('Content-Type', icon.mapIconMimeType!);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.send(Buffer.from(icon.mapIconData!));
  }
}
@Controller('roles')
export class RolesController extends ResourceController {
  constructor(service: RolesService) {
    super(service);
  }
}
