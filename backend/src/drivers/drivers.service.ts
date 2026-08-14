import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ForceDeleteDriverDto, SaveDriverDto } from './drivers.dto';

const select = {
  id: true,
  serialNumber: true,
  staffName: true,
  employeeId: true,
  locationText: true,
  zone: true,
  category: true,
  phone: true,
  email: true,
  licenceNumber: true,
  licenceClass: true,
  status: true,
  locationId: true,
  passportMimeType: true,
  location: { select: { id: true, name: true, code: true } },
  allocations: {
    where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] as string[] } },
    orderBy: { startAt: 'desc' as const },
    take: 1,
    select: {
      vehicle: {
        select: {
          registrationNumber: true,
          age: true,
          serviceability: true,
          vehicleType: { select: { id: true, name: true } },
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}
  async list() {
    const drivers = await this.prisma.driver.findMany({
      select: { ...select, ratings: { select: { stars: true } } },
      orderBy: [{ serialNumber: 'asc' }, { staffName: 'asc' }],
    });
    return drivers.map(({ ratings, ...driver }) => {
      const ratingTotal = ratings.reduce((total, rating) => total + rating.stars, 0);
      return {
        ...driver,
        rating: ratings.length ? ratingTotal / ratings.length : null,
        ratingCount: ratings.length,
      };
    });
  }
  async details(id: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id }, select });
    if (!driver) throw new NotFoundException('Driver not found.');

    const [
      allocations,
      trips,
      requestTrips,
      completedRequestTrips,
      standaloneTrips,
      completedStandaloneTrips,
      activeTrips,
      ratings,
    ] =
      await this.prisma.$transaction([
        this.prisma.vehicleAllocation.findMany({
          where: { driverId: id },
          select: {
            id: true,
            status: true,
            destination: true,
            purpose: true,
            startAt: true,
            expectedEndAt: true,
            vehicle: {
              select: {
                id: true,
                registrationNumber: true,
                manufacturer: true,
                model: true,
                status: true,
                vehicleType: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.trip.aggregate({
          where: { driverId: id },
          _count: { _all: true },
          _avg: { averageSpeed: true },
          _sum: { calculatedDistance: true },
        }),
        this.prisma.vehicleAllocation.count({
          where: { driverId: id, requestId: { not: null }, status: { not: 'CANCELLED' } },
        }),
        this.prisma.vehicleAllocation.count({
          where: { driverId: id, requestId: { not: null }, status: 'COMPLETED' },
        }),
        this.prisma.trip.count({ where: { driverId: id, requestId: null } }),
        this.prisma.trip.count({
          where: { driverId: id, requestId: null, status: 'COMPLETED' },
        }),
        this.prisma.trip.count({ where: { driverId: id, status: 'IN_PROGRESS' } }),
        this.prisma.driverRating.aggregate({
          where: { driverId: id },
          _count: { _all: true },
          _avg: { stars: true },
        }),
      ]);

    const uniqueVehicles = [
      ...new Map(
        allocations.map((allocation) => [allocation.vehicle.id, allocation.vehicle]),
      ).values(),
    ];
    return {
      driver,
      vehicles: uniqueVehicles,
      allocations,
      summary: {
        totalTrips: requestTrips + standaloneTrips,
        completedTrips: completedRequestTrips + completedStandaloneTrips,
        activeTrips,
        averageSpeed: trips._avg.averageSpeed,
        totalDistance: trips._sum.calculatedDistance ?? 0,
        rating: ratings._avg.stars,
        ratingCount: ratings._count._all,
      },
    };
  }
  create(dto: SaveDriverDto) {
    return this.prisma.driver.create({ data: this.data(dto), select });
  }
  update(id: string, dto: SaveDriverDto) {
    return this.prisma.driver.update({ where: { id }, data: this.data(dto), select });
  }
  async remove(id: string) {
    const [a, c, h] = await this.prisma.$transaction([
      this.prisma.vehicleAllocation.count({ where: { driverId: id } }),
      this.prisma.driverCurrentLocation.count({ where: { driverId: id } }),
      this.prisma.driverLocationHistory.count({ where: { driverId: id } }),
    ]);
    const blocks = [
      a && `allocations (${a})`,
      c && `current GPS location (${c})`,
      h && `GPS history (${h})`,
    ].filter(Boolean);
    if (blocks.length)
      throw new ConflictException(
        `This driver cannot be deleted because they are attached to: ${blocks.join(', ')}.`,
      );
    return this.prisma.driver.delete({ where: { id }, select });
  }
  async forceRemove(id: string, options: ForceDeleteDriverDto = {}) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      select: { id: true, staffName: true },
    });
    if (!driver) throw new NotFoundException('Driver not found.');

    return this.prisma.$transaction(async (tx) => {
      const driverAllocations = await tx.vehicleAllocation.findMany({
        where: { driverId: id },
        select: { id: true, vehicleId: true, requestId: true },
      });
      const linkedVehicleIds = [
        ...new Set(driverAllocations.map((allocation) => allocation.vehicleId).filter(Boolean)),
      ];
      const vehicleIds = options.deleteLinkedVehicles ? linkedVehicleIds : [];
      const allocations = vehicleIds.length
        ? await tx.vehicleAllocation.findMany({
            where: this.allocationWhere(id, vehicleIds),
            select: { id: true, vehicleId: true, requestId: true },
          })
        : driverAllocations;
      const allocationIds = allocations.map((allocation) => allocation.id);
      const requestIds = [
        ...new Set(
          allocations.map((allocation) => allocation.requestId).filter(Boolean) as string[],
        ),
      ];

      const tripWhere = this.tripWhere(id, vehicleIds, allocationIds);
      const trips = await tx.trip.findMany({
        where: tripWhere,
        select: { id: true },
      });
      const tripIds = trips.map((trip) => trip.id);

      const history = await tx.driverLocationHistory.deleteMany({
        where: this.dependentWhere(id, vehicleIds, allocationIds, tripIds),
      });
      const currentGps = await tx.driverCurrentLocation.deleteMany({
        where: this.dependentWhere(id, vehicleIds, allocationIds, tripIds),
      });
      const deletedTrips = await tx.trip.deleteMany({ where: tripWhere });
      const deletedAllocations = await tx.vehicleAllocation.deleteMany({
        where: this.allocationWhere(id, vehicleIds),
      });
      const requestsReset = requestIds.length
        ? await tx.vehicleRequest.updateMany({
            where: { id: { in: requestIds } },
            data: { status: 'APPROVED' },
          })
        : { count: 0 };

      if (!options.deleteLinkedVehicles && linkedVehicleIds.length) {
        await tx.vehicle.updateMany({
          where: { id: { in: linkedVehicleIds } },
          data: { status: 'AVAILABLE' },
        });
      }

      const deletedDriver = await tx.driver.delete({ where: { id }, select });
      const deletedVehicles = vehicleIds.length
        ? await tx.vehicle.deleteMany({ where: { id: { in: vehicleIds } } })
        : { count: 0 };

      return {
        deleted: deletedDriver.id,
        deletedLinkedVehicles: vehicleIds,
        cleaned: {
          allocations: deletedAllocations.count,
          trips: deletedTrips.count,
          currentGps: currentGps.count,
          gpsHistory: history.count,
          requestsReset: requestsReset.count,
        },
        summary: { deleted: 1, deletedLinkedVehicles: deletedVehicles.count },
      };
    });
  }
  async passport(id: string) {
    const d = await this.prisma.driver.findUnique({
      where: { id },
      select: { passportData: true, passportMimeType: true },
    });
    if (!d?.passportData || !d.passportMimeType)
      throw new NotFoundException('Driver passport not found.');
    return d;
  }
  async savePassport(id: string, file: Express.Multer.File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new BadRequestException('Passport must be JPEG, PNG, or WebP.');
    return this.prisma.driver.update({
      where: { id },
      data: { passportMimeType: file.mimetype, passportData: Uint8Array.from(file.buffer) },
      select,
    });
  }
  private data(dto: SaveDriverDto) {
    return {
      ...dto,
      serialNumber: dto.serialNumber?.trim() || null,
      staffName: dto.staffName.trim(),
      employeeId: dto.employeeId.trim(),
      locationText: dto.locationText?.trim() || null,
      zone: dto.zone?.trim() || null,
      category: dto.category?.trim() || null,
      phone: dto.phone.trim(),
      email: dto.email?.trim() || null,
      licenceNumber: dto.licenceNumber?.trim() || null,
      licenceClass: dto.licenceClass?.trim() || null,
    };
  }

  private dependentWhere(
    driverId: string,
    vehicleIds: string[],
    allocationIds: string[],
    tripIds: string[],
  ) {
    const OR: object[] = [{ driverId }];
    if (vehicleIds.length) OR.push({ vehicleId: { in: vehicleIds } });
    if (allocationIds.length) OR.push({ allocationId: { in: allocationIds } });
    if (tripIds.length) OR.push({ tripId: { in: tripIds } });
    return { OR };
  }

  private tripWhere(driverId: string, vehicleIds: string[], allocationIds: string[]) {
    const OR: object[] = [{ driverId }];
    if (allocationIds.length) OR.push({ allocationId: { in: allocationIds } });
    if (vehicleIds.length) OR.push({ vehicleId: { in: vehicleIds } });
    return { OR };
  }

  private allocationWhere(driverId: string, vehicleIds: string[]) {
    const OR: object[] = [{ driverId }];
    if (vehicleIds.length) OR.push({ vehicleId: { in: vehicleIds } });
    return { OR };
  }
}
