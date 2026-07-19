import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ForceDeleteVehicleDto, SaveVehicleDto } from './vehicles.dto';

const select = {
  id: true,
  registrationNumber: true,
  serialNumber: true,
  locationUser: true,
  privateRegistrationNumber: true,
  officialRegistrationNumber: true,
  manufacturer: true,
  model: true,
  year: true,
  purchaseCost: true,
  bookedValue: true,
  estimatedCost: true,
  reservedPresentValue: true,
  age: true,
  serviceability: true,
  legacyAgency: true,
  chassisNumber: true,
  engineNumber: true,
  remark: true,
  faultDescription: true,
  color: true,
  status: true,
  locationId: true,
  vehicleTypeId: true,
  imageMimeType: true,
  location: { select: { id: true, name: true, code: true } },
  vehicleType: { select: { id: true, name: true, code: true } },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}
  list() {
    return this.prisma.$queryRaw`
      SELECT
        TOP (1000)
        id,
        registrationNumber,
        serialNumber,
        locationUser,
        privateRegistrationNumber,
        officialRegistrationNumber,
        manufacturer,
        model,
        year,
        purchaseCost,
        bookedValue,
        estimatedCost,
        reservedPresentValue,
        age,
        serviceability,
        legacyAgency,
        chassisNumber,
        engineNumber,
        remark,
        faultDescription,
        color,
        status,
        locationId,
        vehicleTypeId,
        imageMimeType,
        createdAt,
        updatedAt
      FROM dbo.vehicles WITH (NOLOCK)
    `;
  }
  create(dto: SaveVehicleDto) {
    return this.prisma.vehicle.create({ data: this.data(dto), select });
  }
  update(id: string, dto: SaveVehicleDto) {
    return this.prisma.vehicle.update({ where: { id }, data: this.data(dto), select });
  }
  async remove(id: string) {
    const [a, c, h] = await this.prisma.$transaction([
      this.prisma.vehicleAllocation.count({ where: { vehicleId: id } }),
      this.prisma.driverCurrentLocation.count({ where: { vehicleId: id } }),
      this.prisma.driverLocationHistory.count({ where: { vehicleId: id } }),
    ]);
    const blocks = [a && `allocations (${a})`, c && `current GPS locations (${c})`, h && `GPS history (${h})`].filter(Boolean);
    if (blocks.length)
      throw new ConflictException(`This vehicle cannot be deleted because it is attached to: ${blocks.join(', ')}.`);
    return this.prisma.vehicle.delete({ where: { id }, select });
  }
  async forceRemove(id: string, options: ForceDeleteVehicleDto = {}) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      select: { id: true, registrationNumber: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    return this.forceRemoveMany([id], { deleteLinkedDrivers: options.deleteLinkedDrivers });
  }

  async bulkRemove(
    ids: string[],
    options: { force?: boolean; deleteLinkedDrivers?: boolean } = {},
  ) {
    const uniqueIds = [...new Set(ids)];
    if (options.force) {
      return this.forceRemoveMany(uniqueIds, { deleteLinkedDrivers: options.deleteLinkedDrivers });
    }
    const deleted: string[] = [];
    const blocked: { id: string; label: string; reason: string }[] = [];
    const missing: string[] = [];
    for (const id of uniqueIds) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id },
        select: { id: true, registrationNumber: true, officialRegistrationNumber: true, privateRegistrationNumber: true },
      });
      if (!vehicle) {
        missing.push(id);
        continue;
      }
      const label = vehicle.officialRegistrationNumber || vehicle.privateRegistrationNumber || vehicle.registrationNumber;
      try {
        await this.remove(id);
        deleted.push(id);
      } catch (error) {
        blocked.push({
          id,
          label,
          reason: error instanceof Error ? error.message : 'Unable to delete vehicle.',
        });
      }
    }
    return { deleted, blocked, missing, summary: { requested: uniqueIds.length, deleted: deleted.length, blocked: blocked.length, missing: missing.length } };
  }

  private async forceRemoveMany(
    ids: string[],
    options: { deleteLinkedDrivers?: boolean } = {},
  ) {
    const uniqueIds = [...new Set(ids)];
    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, registrationNumber: true },
    });
    const vehicleIds = vehicles.map((vehicle) => vehicle.id);
    const missing = uniqueIds.filter((id) => !vehicleIds.includes(id));
    if (!vehicleIds.length) {
      return {
        deleted: [],
        deletedLinkedDrivers: [],
        missing,
        cleaned: { allocations: 0, trips: 0, currentGps: 0, gpsHistory: 0, requestsReset: 0 },
        summary: { requested: uniqueIds.length, deleted: 0, blocked: 0, missing: missing.length },
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const vehicleAllocations = await tx.vehicleAllocation.findMany({
        where: { vehicleId: { in: vehicleIds } },
        select: { id: true, driverId: true, requestId: true },
      });
      const linkedDriverIds = [...new Set(vehicleAllocations.map((allocation) => allocation.driverId).filter(Boolean))];
      const driverIds = options.deleteLinkedDrivers ? linkedDriverIds : [];
      const allocations = driverIds.length
        ? await tx.vehicleAllocation.findMany({
            where: this.allocationWhere(vehicleIds, driverIds),
            select: { id: true, driverId: true, requestId: true },
          })
        : vehicleAllocations;
      const allocationIds = allocations.map((allocation) => allocation.id);
      const requestIds = [...new Set(allocations.map((allocation) => allocation.requestId).filter(Boolean) as string[])];

      const tripWhere = this.tripWhere(vehicleIds, driverIds, allocationIds);
      const trips = await tx.trip.findMany({
        where: tripWhere,
        select: { id: true },
      });
      const tripIds = trips.map((trip) => trip.id);

      const history = await tx.driverLocationHistory.deleteMany({
        where: this.dependentWhere(vehicleIds, driverIds, allocationIds, tripIds),
      });
      const currentGps = await tx.driverCurrentLocation.deleteMany({
        where: this.dependentWhere(vehicleIds, driverIds, allocationIds, tripIds),
      });
      const deletedTrips = await tx.trip.deleteMany({ where: tripWhere });
      const deletedAllocations = await tx.vehicleAllocation.deleteMany({
        where: this.allocationWhere(vehicleIds, driverIds),
      });
      const requestsReset = requestIds.length
        ? await tx.vehicleRequest.updateMany({
            where: { id: { in: requestIds } },
            data: { status: 'APPROVED' },
          })
        : { count: 0 };

      if (!options.deleteLinkedDrivers && linkedDriverIds.length) {
        await tx.driver.updateMany({ where: { id: { in: linkedDriverIds } }, data: { status: 'AVAILABLE' } });
      }

      const deletedVehicles = await tx.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
      const deletedDrivers = driverIds.length
        ? await tx.driver.deleteMany({ where: { id: { in: driverIds } } })
        : { count: 0 };

      return {
        deleted: vehicleIds,
        deletedLinkedDrivers: driverIds,
        missing,
        cleaned: {
          allocations: deletedAllocations.count,
          trips: deletedTrips.count,
          currentGps: currentGps.count,
          gpsHistory: history.count,
          requestsReset: requestsReset.count,
        },
        summary: {
          requested: uniqueIds.length,
          deleted: deletedVehicles.count,
          blocked: 0,
          missing: missing.length,
        },
      };
    });
  }

  private dependentWhere(vehicleIds: string[], driverIds: string[], allocationIds: string[], tripIds: string[]) {
    const OR: object[] = [{ vehicleId: { in: vehicleIds } }];
    if (driverIds.length) OR.push({ driverId: { in: driverIds } });
    if (allocationIds.length) OR.push({ allocationId: { in: allocationIds } });
    if (tripIds.length) OR.push({ tripId: { in: tripIds } });
    return { OR };
  }

  private tripWhere(vehicleIds: string[], driverIds: string[], allocationIds: string[]) {
    const OR: object[] = [{ vehicleId: { in: vehicleIds } }];
    if (allocationIds.length) OR.push({ allocationId: { in: allocationIds } });
    if (driverIds.length) OR.push({ driverId: { in: driverIds } });
    return { OR };
  }

  private allocationWhere(vehicleIds: string[], driverIds: string[]) {
    const OR: object[] = [{ vehicleId: { in: vehicleIds } }];
    if (driverIds.length) OR.push({ driverId: { in: driverIds } });
    return { OR };
  }
  async image(id: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id }, select: { imageData: true, imageMimeType: true } });
    if (!v?.imageData || !v.imageMimeType) throw new NotFoundException('Vehicle image not found.');
    return v;
  }
  async saveImage(id: string, file: Express.Multer.File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new BadRequestException('Vehicle image must be JPEG, PNG, or WebP.');
    return this.prisma.vehicle.update({
      where: { id },
      data: { imageMimeType: file.mimetype, imageData: Uint8Array.from(file.buffer) },
      select,
    });
  }
  private data(dto: SaveVehicleDto) {
    const registrationNumber = this.registrationNumber(dto);
    return {
      ...dto,
      registrationNumber,
      serialNumber: dto.serialNumber?.trim() || null,
      locationUser: dto.locationUser?.trim() || null,
      privateRegistrationNumber: dto.privateRegistrationNumber?.trim().toUpperCase() || null,
      officialRegistrationNumber: dto.officialRegistrationNumber?.trim().toUpperCase() || null,
      manufacturer: dto.manufacturer.trim(),
      model: dto.model.trim(),
      color: dto.color?.trim() || null,
      serviceability: dto.serviceability?.trim() || null,
      legacyAgency: dto.legacyAgency?.trim() || null,
      chassisNumber: dto.chassisNumber?.trim() || null,
      engineNumber: dto.engineNumber?.trim() || null,
      remark: dto.remark?.trim() || null,
      faultDescription: dto.faultDescription?.trim() || null,
    };
  }
  private registrationNumber(dto: SaveVehicleDto) {
    const value =
      dto.registrationNumber?.trim() ||
      dto.officialRegistrationNumber?.trim() ||
      dto.privateRegistrationNumber?.trim() ||
      (dto.serialNumber ? `SN-${dto.serialNumber.trim()}` : '');
    if (!value)
      throw new BadRequestException(
        'Enter at least one of Official Reg. Number, Private Reg. Number, or S/N.',
      );
    return value.toUpperCase();
  }
}
