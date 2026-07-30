import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import {
  DepartmentsController,
  DirectoratesController,
  LocationsController,
  RolesController,
  VehicleTypesController,
} from './resource-controllers';
import {
  DepartmentsService,
  DirectoratesService,
  LocationsService,
  RolesService,
  VehicleTypesService,
} from './resource-services';

@Module({
  controllers: [
    MasterDataController,
    DirectoratesController,
    DepartmentsController,
    LocationsController,
    VehicleTypesController,
    RolesController,
  ],
  providers: [
    MasterDataService,
    DirectoratesService,
    DepartmentsService,
    LocationsService,
    VehicleTypesService,
    RolesService,
  ],
})
export class MasterDataModule {}
