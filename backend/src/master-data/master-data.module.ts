import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import {
  DepartmentsController,
  DirectoratesController,
  LocationsController,
  RolesController,
  UnitsController,
  VehicleTypesController,
} from './resource-controllers';
import {
  DepartmentsService,
  DirectoratesService,
  LocationsService,
  RolesService,
  UnitsService,
  VehicleTypesService,
} from './resource-services';

@Module({
  controllers: [
    MasterDataController,
    DirectoratesController,
    DepartmentsController,
    UnitsController,
    LocationsController,
    VehicleTypesController,
    RolesController,
  ],
  providers: [
    MasterDataService,
    DirectoratesService,
    DepartmentsService,
    UnitsService,
    LocationsService,
    VehicleTypesService,
    RolesService,
  ],
})
export class MasterDataModule {}
