import { Injectable } from '@nestjs/common';
import { MasterDataQueryDto, SaveMasterDataDto } from './dto/master-data.dto';
import { MasterDataService } from './master-data.service';
import { MasterDataResource } from './master-data.types';

export abstract class ResourceService {
  protected abstract readonly resource: MasterDataResource;
  constructor(protected readonly masterData: MasterDataService) {}
  list(query: MasterDataQueryDto) {
    return this.masterData.findAll(this.resource, query);
  }
  get(id: string) {
    return this.masterData.findOne(this.resource, id);
  }
  create(dto: SaveMasterDataDto) {
    return this.masterData.create(this.resource, dto);
  }
  update(id: string, dto: SaveMasterDataDto) {
    return this.masterData.update(this.resource, id, dto);
  }
  archive(id: string) {
    return this.masterData.archive(this.resource, id);
  }
  remove(id: string) {
    return this.masterData.remove(this.resource, id);
  }
}

@Injectable()
export class DirectoratesService extends ResourceService {
  protected readonly resource = 'directorates' as const;
  constructor(masterData: MasterDataService) {
    super(masterData);
  }
}
@Injectable()
export class DepartmentsService extends ResourceService {
  protected readonly resource = 'departments' as const;
  constructor(masterData: MasterDataService) {
    super(masterData);
  }
}
@Injectable()
export class UnitsService extends ResourceService {
  protected readonly resource = 'units' as const;
  constructor(masterData: MasterDataService) {
    super(masterData);
  }
}
@Injectable()
export class LocationsService extends ResourceService {
  protected readonly resource = 'locations' as const;
  constructor(masterData: MasterDataService) {
    super(masterData);
  }
}
@Injectable()
export class VehicleTypesService extends ResourceService {
  protected readonly resource = 'vehicle-types' as const;
  constructor(masterData: MasterDataService) {
    super(masterData);
  }
  saveMapIcon(id: string, file: Express.Multer.File) { return this.masterData.saveVehicleTypeMapIcon(id, file); }
  mapIcon(id: string) { return this.masterData.vehicleTypeMapIcon(id); }
}
@Injectable()
export class RolesService extends ResourceService {
  protected readonly resource = 'roles' as const;
  constructor(masterData: MasterDataService) {
    super(masterData);
  }
}
