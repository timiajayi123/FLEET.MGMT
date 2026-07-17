import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  constructor(service: VehicleTypesService) {
    super(service);
  }
}
@Controller('roles')
export class RolesController extends ResourceController {
  constructor(service: RolesService) {
    super(service);
  }
}
