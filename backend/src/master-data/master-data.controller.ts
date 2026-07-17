import {
  Body,
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MasterDataQueryDto, SaveMasterDataDto } from './dto/master-data.dto';
import { MasterDataService } from './master-data.service';

@Controller('master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get(':resource')
  async findAll(@Param('resource') resource: string, @Query() query: MasterDataQueryDto) {
    this.masterDataService.assertResource(resource);
    return this.masterDataService.findAll(resource, query);
  }

  @Get(':resource/:id')
  async findOne(@Param('resource') resource: string, @Param('id', ParseUUIDPipe) id: string) {
    this.masterDataService.assertResource(resource);
    return { data: await this.masterDataService.findOne(resource, id) };
  }

  @Post(':resource')
  async create(@Param('resource') resource: string, @Body() dto: SaveMasterDataDto) {
    this.masterDataService.assertResource(resource);
    return { data: await this.masterDataService.create(resource, dto) };
  }

  @Patch(':resource/:id')
  async update(
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveMasterDataDto,
  ) {
    this.masterDataService.assertResource(resource);
    return { data: await this.masterDataService.update(resource, id, dto) };
  }

  @Delete(':resource/:id')
  async remove(@Param('resource') resource: string, @Param('id', ParseUUIDPipe) id: string) {
    this.masterDataService.assertResource(resource);
    return { data: await this.masterDataService.remove(resource, id) };
  }

  @Post(':resource/import')
  importContract(@Param('resource') resource: string): never {
    this.masterDataService.assertResource(resource);
    throw new NotImplementedException({
      message: 'CSV/Excel import is reserved for a future release.',
      resource,
      acceptedExtensions: ['.csv', '.xlsx'],
    });
  }
}
