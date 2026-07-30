import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { MasterDataStatus } from '../common/status.constants';
import { PrismaService } from '../prisma/prisma.service';
import { MasterDataQueryDto, SaveMasterDataDto } from './dto/master-data.dto';
import { isMasterDataResource, MasterDataResource } from './master-data.types';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  assertResource(resource: string): asserts resource is MasterDataResource {
    if (!isMasterDataResource(resource))
      throw new NotFoundException(`Unknown master-data resource: ${resource}`);
  }

  async findAll(resource: MasterDataResource, query: MasterDataQueryDto) {
    if (resource === 'departments' || resource === 'directorates')
      await this.purgeArchivedHierarchy(resource);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? (resource === 'departments' ? 'sortOrder' : 'name');
    const sortOrder = query.sortOrder ?? 'asc';
    const where = {
      ...(query.activeOnly
        ? { status: MasterDataStatus.ACTIVE }
        : query.status
          ? { status: query.status }
          : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { code: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
    };
    const orderBy = [
      { [sortBy]: sortOrder },
      ...(sortBy === 'sortOrder' ? [{ name: 'asc' as const }] : []),
      { id: 'asc' as const },
    ];
    let data: unknown[];
    let total: number;

    switch (resource) {
      case 'directorates':
        [total, data] = await this.prisma.$transaction([
          this.prisma.directorate.count({ where }),
          this.prisma.directorate.findMany({
            where,
            skip,
            take: limit,
            orderBy,
          }),
        ]);
        break;
      case 'departments': {
        const departmentWhere = {
          ...where,
          ...((query.directorateId ?? query.parentId)
            ? { directorateId: query.directorateId ?? query.parentId }
            : {}),
        };
        [total, data] = await this.prisma.$transaction([
          this.prisma.department.count({ where: departmentWhere }),
          this.prisma.department.findMany({
            where: departmentWhere,
            skip,
            take: limit,
            orderBy,
            include: { directorate: { select: { id: true, name: true, code: true } } },
          }),
        ]);
        break;
      }
      case 'locations':
        [total, data] = await this.prisma.$transaction([
          this.prisma.location.count({ where }),
          this.prisma.location.findMany({
            where,
            skip,
            take: limit,
            orderBy,
          }),
        ]);
        break;
      case 'vehicle-types':
        [total, data] = await this.prisma.$transaction([
          this.prisma.vehicleType.count({ where }),
          this.prisma.vehicleType.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            select: { id: true, code: true, name: true, description: true, passengerCapacity: true, mapIcon: true, mapIconMimeType: true, status: true, sortOrder: true, createdAt: true, updatedAt: true },
          }),
        ]);
        break;
      case 'roles':
        [total, data] = await this.prisma.$transaction([
          this.prisma.role.count({ where }),
          this.prisma.role.findMany({
            where,
            skip,
            take: limit,
            orderBy,
          }),
        ]);
        break;
    }

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), sortBy, sortOrder },
    };
  }

  async findOne(resource: MasterDataResource, id: string) {
    const record = await this.findById(resource, id);
    if (!record) throw new NotFoundException('Master-data record not found.');
    return record;
  }

  async create(resource: MasterDataResource, dto: SaveMasterDataDto) {
    this.validateResourceFields(resource, dto);
    const data = this.commonData(dto);
    if (resource === 'departments' || resource === 'directorates')
      data.status = MasterDataStatus.ACTIVE;
    try {
      return await this.createRecord(resource, dto, data);
    } catch (error) {
      if (await this.prisma.recoverFromInvalidConnectionState(error)) {
        return await this.createRecord(resource, dto, data);
      }
      this.handlePrismaError(error);
    }
  }

  async update(resource: MasterDataResource, id: string, dto: SaveMasterDataDto) {
    await this.findOne(resource, id);
    this.validateResourceFields(resource, dto);
    const data = this.commonData(dto);
    if (resource === 'departments' || resource === 'directorates')
      data.status = MasterDataStatus.ACTIVE;
    try {
      switch (resource) {
        case 'directorates':
          return await this.prisma.directorate.update({ where: { id }, data });
        case 'departments':
          return await this.prisma.department.update({
            where: { id },
            data: { ...data, directorateId: dto.directorateId! },
            include: { directorate: { select: { id: true, name: true, code: true } } },
          });
        case 'locations':
          return await this.prisma.location.update({
            where: { id },
            data: { ...data, address: dto.address || null, state: dto.state || null },
          });
        case 'vehicle-types':
          return await this.prisma.vehicleType.update({
            where: { id },
            data: { ...data, passengerCapacity: dto.passengerCapacity ?? null, mapIcon: dto.mapIcon || null },
          });
        case 'roles': {
          const existing = await this.prisma.role.findUniqueOrThrow({ where: { id } });
          return await this.prisma.role.update({
            where: { id },
            data: {
              ...data,
              isSystemRole: existing.isSystemRole ? true : (dto.isSystemRole ?? false),
            },
          });
        }
      }
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async archive(resource: MasterDataResource, id: string) {
    const existing = await this.findOne(resource, id);
    if ('isSystemRole' in existing && existing.isSystemRole)
      throw new ConflictException('System roles cannot be archived.');
    try {
      switch (resource) {
        case 'directorates':
          return await this.prisma.directorate.update({
            where: { id },
            data: { status: MasterDataStatus.INACTIVE },
          });
        case 'departments':
          return await this.prisma.department.update({
            where: { id },
            data: { status: MasterDataStatus.INACTIVE },
          });
        case 'locations':
          return await this.prisma.location.update({
            where: { id },
            data: { status: MasterDataStatus.INACTIVE },
          });
        case 'vehicle-types':
          return await this.prisma.vehicleType.update({
            where: { id },
            data: { status: MasterDataStatus.INACTIVE },
          });
        case 'roles':
          return await this.prisma.role.update({
            where: { id },
            data: { status: MasterDataStatus.INACTIVE },
          });
      }
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(resource: MasterDataResource, id: string) {
    if (!['locations', 'departments', 'directorates'].includes(resource))
      return this.archive(resource, id);
    await this.findOne(resource, id);
    if (resource === 'locations') await this.assertLocationCanBeDeleted(id);
    if (resource === 'departments') await this.assertDepartmentCanBeDeleted(id);
    if (resource === 'directorates') await this.assertDirectorateCanBeDeleted(id);
    try {
      if (resource === 'locations') return await this.prisma.location.delete({ where: { id } });
      if (resource === 'departments') return await this.prisma.department.delete({ where: { id } });
      return await this.prisma.directorate.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async saveVehicleTypeMapIcon(id: string, file: Express.Multer.File) {
    await this.prisma.vehicleType.findUniqueOrThrow({ where: { id } });
    return this.prisma.vehicleType.update({
      where: { id },
      data: { mapIcon: null, mapIconMimeType: file.mimetype, mapIconData: Uint8Array.from(file.buffer) },
      select: { id: true, name: true, mapIconMimeType: true, updatedAt: true },
    });
  }

  async vehicleTypeMapIcon(id: string) {
    const type = await this.prisma.vehicleType.findUnique({ where: { id }, select: { mapIconMimeType: true, mapIconData: true } });
    if (!type?.mapIconData || !type.mapIconMimeType) throw new NotFoundException('No uploaded map icon exists for this vehicle type.');
    return type;
  }

  private findById(resource: MasterDataResource, id: string) {
    switch (resource) {
      case 'directorates':
        return this.prisma.directorate.findUnique({ where: { id } });
      case 'departments':
        return this.prisma.department.findUnique({
          where: { id },
          include: { directorate: { select: { id: true, name: true, code: true } } },
        });
      case 'locations':
        return this.prisma.location.findUnique({ where: { id } });
      case 'vehicle-types':
        return this.prisma.vehicleType.findUnique({ where: { id } });
      case 'roles':
        return this.prisma.role.findUnique({ where: { id } });
    }
  }

  private commonData(dto: SaveMasterDataDto) {
    return {
      code: dto.code.toUpperCase(),
      name: dto.name,
      description: dto.description || null,
      status: dto.status ?? MasterDataStatus.ACTIVE,
      sortOrder: dto.sortOrder ?? 0,
    };
  }

  private createRecord(
    resource: MasterDataResource,
    dto: SaveMasterDataDto,
    data: ReturnType<MasterDataService['commonData']>,
  ) {
    switch (resource) {
      case 'directorates':
        return this.prisma.directorate.create({ data });
      case 'departments':
        return this.prisma.department.create({
          data: { ...data, directorateId: dto.directorateId! },
          include: { directorate: { select: { id: true, name: true, code: true } } },
        });
      case 'locations':
        return this.prisma.location.create({
          data: { ...data, address: dto.address || null, state: dto.state || null },
        });
      case 'vehicle-types':
        return this.prisma.vehicleType.create({
          data: { ...data, passengerCapacity: dto.passengerCapacity ?? null, mapIcon: dto.mapIcon || null },
        });
      case 'roles':
        return this.prisma.role.create({
          data: { ...data, isSystemRole: dto.isSystemRole ?? false },
        });
    }
  }

  private validateResourceFields(resource: MasterDataResource, dto: SaveMasterDataDto) {
    if (resource === 'departments' && !dto.directorateId)
      throw new BadRequestException('directorateId is required for departments.');
  }

  private async assertLocationCanBeDeleted(locationId: string) {
    const [userCount, users, vehicleCount, vehicles, driverCount, drivers, requestCount, requests] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where: { locationId } }),
      this.prisma.user.findMany({
        where: { locationId },
        select: { staffName: true, employeeId: true },
        take: 3,
        orderBy: { staffName: 'asc' },
      }),
        this.prisma.vehicle.count({ where: { locationId } }),
      this.prisma.vehicle.findMany({
        where: { locationId },
        select: { registrationNumber: true, manufacturer: true, model: true },
        take: 3,
        orderBy: { registrationNumber: 'asc' },
      }),
        this.prisma.driver.count({ where: { locationId } }),
      this.prisma.driver.findMany({
        where: { locationId },
        select: { staffName: true, employeeId: true },
        take: 3,
        orderBy: { staffName: 'asc' },
      }),
        this.prisma.vehicleRequest.count({ where: { locationId } }),
      this.prisma.vehicleRequest.findMany({
        where: { locationId },
        select: { requestNumber: true, staffName: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const blockers = [
      this.referenceSummary(
        'users',
        userCount,
        users,
        (user) => `${user.staffName} (${user.employeeId})`,
      ),
      this.referenceSummary(
        'vehicles',
        vehicleCount,
        vehicles,
        (vehicle) =>
          `${vehicle.registrationNumber} - ${vehicle.manufacturer} ${vehicle.model}`,
      ),
      this.referenceSummary(
        'drivers',
        driverCount,
        drivers,
        (driver) => `${driver.staffName} (${driver.employeeId})`,
      ),
      this.referenceSummary(
        'vehicle requests',
        requestCount,
        requests,
        (request) => `${request.requestNumber} - ${request.staffName}`,
      ),
    ].filter(Boolean);
    if (blockers.length) {
      throw new ConflictException(
        `This location cannot be deleted because it is attached to: ${blockers.join('; ')}.`,
      );
    }
  }

  private async assertDepartmentCanBeDeleted(departmentId: string) {
    const [users, requests, budgets] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { departmentId } }),
      this.prisma.vehicleRequest.count({ where: { departmentId } }),
      this.prisma.fuelBudget.count({ where: { departmentId } }),
    ]);
    const blockers = [
      users && `${users} user(s)`,
      requests && `${requests} vehicle request(s)`,
      budgets && `${budgets} fuel budget(s)`,
    ].filter(Boolean);
    if (blockers.length)
      throw new ConflictException(`This department cannot be deleted because it is used by ${blockers.join(', ')}.`);
  }

  private async assertDirectorateCanBeDeleted(directorateId: string) {
    const [departments, users, requests, budgets] = await this.prisma.$transaction([
      this.prisma.department.count({ where: { directorateId } }),
      this.prisma.user.count({ where: { directorateId } }),
      this.prisma.vehicleRequest.count({ where: { directorateId } }),
      this.prisma.fuelBudget.count({ where: { directorateId } }),
    ]);
    const blockers = [
      departments && `${departments} department(s)`,
      users && `${users} user(s)`,
      requests && `${requests} vehicle request(s)`,
      budgets && `${budgets} fuel budget(s)`,
    ].filter(Boolean);
    if (blockers.length)
      throw new ConflictException(`This directorate cannot be deleted because it is used by ${blockers.join(', ')}.`);
  }

  private async purgeArchivedHierarchy(resource: 'departments' | 'directorates') {
    const archived = resource === 'departments'
      ? await this.prisma.department.findMany({ where: { status: MasterDataStatus.INACTIVE }, select: { id: true } })
      : await this.prisma.directorate.findMany({ where: { status: MasterDataStatus.INACTIVE }, select: { id: true } });
    for (const record of archived) {
      try {
        if (resource === 'departments') {
          await this.assertDepartmentCanBeDeleted(record.id);
          await this.prisma.department.delete({ where: { id: record.id } });
        } else {
          await this.assertDirectorateCanBeDeleted(record.id);
          await this.prisma.directorate.delete({ where: { id: record.id } });
        }
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
  }

  private referenceSummary<T>(
    label: string,
    count: number,
    items: T[],
    describe: (item: T) => string,
  ) {
    if (!count) return '';
    const examples = items.map(describe).join(', ');
    return `${label} (${count}: ${examples})`;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('A record with this code or name already exists.');
      if (error.code === 'P2003')
        throw new ConflictException(
          'This record is already referenced by another module and cannot be deleted.',
        );
      if (error.code === 'P2025') throw new NotFoundException('Master-data record not found.');
    }
    throw error;
  }
}
