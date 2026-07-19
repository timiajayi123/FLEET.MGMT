import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripCoordinateDto } from './tracking.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: { employeeId: string; role: { code: string } }) {
    const where = user.role.code === 'DRIVER'
      ? { driver: { employeeId: user.employeeId }, requestId: { not: null } }
      : { requestId: { not: null } };
    return this.prisma.trip.findMany({
      where,
      include: {
        driver: { select: { id: true, staffName: true, employeeId: true, phone: true } },
        vehicle: { select: { id: true, registrationNumber: true, manufacturer: true, model: true } },
        request: { select: { id: true, requestNumber: true, staffName: true, employeeId: true, purposeOfTrip: true, destination: true, status: true, departureDate: true, expectedReturnDate: true } },
        allocation: { select: { id: true, status: true, startAt: true, expectedEndAt: true, actualStartAt: true, actualEndAt: true, destination: true, purpose: true } },
        _count: { select: { locationHistory: true } },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  current(employeeId: string) {
    return this.prisma.vehicleAllocation.findFirst({
      where: { driver: { employeeId }, status: 'IN_PROGRESS', requestId: { not: null }, request: { status: 'ALLOCATED' } },
      include: { trip: true, vehicle: true, request: true },
    });
  }

  async start(allocationId: string, employeeId: string, coordinate: TripCoordinateDto) {
    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.vehicleAllocation.findUnique({ where: { id: allocationId }, include: { driver: true, trip: true, request: true } });
      if (!allocation || allocation.driver.employeeId !== employeeId) throw new NotFoundException('Assignment not found for this driver.');
      if (!['ASSIGNED', 'ACCEPTED'].includes(allocation.status)) throw new BadRequestException('This assignment cannot be started.');
      if (!allocation.requestId || allocation.request?.status !== 'ALLOCATED') {
        throw new BadRequestException('Live tracking can only start after an approved vehicle request has been allocated to this driver.');
      }
      const now = new Date();
      const trip = allocation.trip
        ? await tx.trip.update({ where: { id: allocation.trip.id }, data: { status: 'IN_PROGRESS', startedAt: now, startLatitude: coordinate.latitude, startLongitude: coordinate.longitude } })
        : await tx.trip.create({ data: { allocationId, requestId: allocation.requestId, vehicleId: allocation.vehicleId, driverId: allocation.driverId, status: 'IN_PROGRESS', startedAt: now, startLatitude: coordinate.latitude, startLongitude: coordinate.longitude } });
      await Promise.all([
        tx.vehicleAllocation.update({ where: { id: allocationId }, data: { status: 'IN_PROGRESS', actualStartAt: now } }),
        tx.vehicle.update({ where: { id: allocation.vehicleId }, data: { status: 'IN_USE' } }),
        tx.driver.update({ where: { id: allocation.driverId }, data: { status: 'IN_USE' } }),
      ]);
      return trip;
    });
  }

  async end(tripId: string, employeeId: string, coordinate: TripCoordinateDto) {
    return this.prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId }, include: { driver: true, allocation: true } });
      if (!trip || trip.driver.employeeId !== employeeId) throw new NotFoundException('Active trip not found for this driver.');
      if (trip.status !== 'IN_PROGRESS') throw new BadRequestException('Only an in-progress trip can be ended.');
      const points = await tx.driverLocationHistory.findMany({ where: { tripId }, orderBy: { recordedAt: 'asc' } });
      let distanceKm = 0;
      for (let index = 1; index < points.length; index++) distanceKm += haversine(points[index - 1].latitude, points[index - 1].longitude, points[index].latitude, points[index].longitude);
      const speeds = points.map((point) => point.speed).filter((speed): speed is number => speed !== null);
      const endedAt = new Date();
      const completed = await tx.trip.update({ where: { id: tripId }, data: { status: 'COMPLETED', endedAt, endLatitude: coordinate.latitude ?? points.at(-1)?.latitude, endLongitude: coordinate.longitude ?? points.at(-1)?.longitude, calculatedDistance: distanceKm, maximumSpeed: speeds.length ? Math.max(...speeds) : 0, averageSpeed: speeds.length ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0 } });
      await Promise.all([
        tx.vehicleAllocation.update({ where: { id: trip.allocationId }, data: { status: 'COMPLETED', actualEndAt: endedAt } }),
        tx.vehicle.update({ where: { id: trip.vehicleId }, data: { status: 'AVAILABLE' } }),
        tx.driver.update({ where: { id: trip.driverId }, data: { status: 'AVAILABLE' } }),
        trip.requestId ? tx.vehicleRequest.update({ where: { id: trip.requestId }, data: { status: 'COMPLETED' } }) : Promise.resolve(),
      ]);
      return completed;
    });
  }

  async history(tripId: string, user: { employeeId: string; role: { code: string } }) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId }, include: { driver: true, allocation: { include: { vehicle: true, request: true } }, locationHistory: { orderBy: { recordedAt: 'asc' } } } });
    if (!trip) throw new NotFoundException('Trip not found.');
    if (user.role.code === 'DRIVER' && trip.driver.employeeId !== user.employeeId) throw new NotFoundException('Trip not found.');
    if (!['DRIVER', 'S_ADMIN', 'FM'].includes(user.role.code)) throw new NotFoundException('Trip not found.');
    return trip;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
