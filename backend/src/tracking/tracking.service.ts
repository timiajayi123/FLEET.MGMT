import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FleetGateway } from './fleet.gateway';
import { TrackingPointDto } from './tracking.dto';

@Injectable()
export class TrackingService {
  private readonly lastPost = new Map<string, number>();
  constructor(private readonly prisma: PrismaService, private readonly gateway: FleetGateway) {}

  async save(user: { id: string; employeeId: string; role: { code: string } }, dto: TrackingPointDto, batch = false) {
    if (!batch) {
      const last = this.lastPost.get(user.id) ?? 0;
      if (Date.now() - last < 1000) throw new HttpException('Location updates are arriving too quickly.', HttpStatus.TOO_MANY_REQUESTS);
      this.lastPost.set(user.id, Date.now());
    }
    if (dto.latitude < 4 || dto.latitude > 14.5 || dto.longitude < 2.5 || dto.longitude > 14.8) throw new BadRequestException('GPS position is outside the supported Nigeria service area.');
    const recordedAt = new Date(dto.recordedAt);
    if (recordedAt.getTime() > Date.now() + 2 * 60_000) throw new BadRequestException('GPS timestamp is unreasonably far in the future.');
    const simulated = dto.isSimulated === true;
    const simulatorFlag = process.env.GPS_SIMULATOR_ENABLED ?? process.env.ENABLE_GPS_SIMULATOR;
    const simulatorAllowed = process.env.NODE_ENV !== 'production' && simulatorFlag === 'true' && ['S_ADMIN', 'FM'].includes(user.role.code);
    if (simulated && !simulatorAllowed) throw new BadRequestException('GPS simulator is disabled or unauthorized.');
    const allocation = simulated && dto.allocationId
      ? await this.prisma.vehicleAllocation.findUnique({ where: { id: dto.allocationId }, include: { driver: true, trip: true, request: true } })
      : await this.prisma.vehicleAllocation.findFirst({ where: { driver: { employeeId: user.employeeId }, status: 'IN_PROGRESS', requestId: { not: null }, request: { status: 'ALLOCATED' } }, include: { driver: true, trip: true, request: true } });
    if (!allocation || allocation.status !== 'IN_PROGRESS' || !allocation.trip || allocation.trip.status !== 'IN_PROGRESS') throw new NotFoundException('No in-progress trip is available for tracking.');
    if (!allocation.requestId || allocation.request?.status !== 'ALLOCATED') throw new BadRequestException('Live tracking requires an approved and allocated vehicle request.');
    if (!simulated && allocation.driver.employeeId !== user.employeeId) throw new NotFoundException('No in-progress trip is available for tracking.');
    if (dto.tripId && dto.tripId !== allocation.trip.id) throw new BadRequestException('Trip and allocation do not match.');
    const clientEventId = dto.clientEventId || randomUUID();
    const data = { driverId: allocation.driverId, vehicleId: allocation.vehicleId, allocationId: allocation.id, tripId: allocation.trip.id, latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy, speed: dto.speed, heading: dto.heading, altitude: dto.altitude, recordedAt, receivedAt: new Date(), isSimulated: simulated };
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.driverLocationHistory.findUnique({ where: { clientEventId } });
      if (!existing) await tx.driverLocationHistory.create({ data: { ...data, clientEventId } });
      return tx.driverCurrentLocation.upsert({ where: { driverId: allocation.driverId }, create: { ...data, trackingSource: simulated ? 'SIMULATOR' : 'PHONE_GPS' }, update: { ...data, trackingSource: simulated ? 'SIMULATOR' : 'PHONE_GPS' } });
    });
    const event = { vehicleId: allocation.vehicleId, driverId: allocation.driverId, allocationId: allocation.id, tripId: allocation.trip.id, latitude: result.latitude, longitude: result.longitude, speed: result.speed, heading: result.heading, accuracy: result.accuracy, recordedAt: result.recordedAt, isSimulated: result.isSimulated };
    this.gateway.publishLocation(event);
    return { success: true, duplicate: false, ...event };
  }

  async live() {
    const now = Date.now();
    const data = await this.prisma.driverCurrentLocation.findMany({
      where: { trip: { status: 'IN_PROGRESS' }, allocation: { requestId: { not: null }, request: { status: 'ALLOCATED' } } },
      include: { driver: true, vehicle: { include: { vehicleType: true } }, trip: true, allocation: { include: { request: { include: { requester: true } } } } },
    });
    return { data: data.map((item) => ({ ...item, connectionStatus: now - item.recordedAt.getTime() > 5 * 60_000 ? 'OFFLINE' : now - item.recordedAt.getTime() > 60_000 ? 'STALE' : item.speed && item.speed > 1 ? 'MOVING' : 'STATIONARY' })), generatedAt: new Date() };
  }

  vehicleHistory(vehicleId: string, from?: Date) {
    return this.prisma.driverLocationHistory.findMany({ where: { vehicleId, recordedAt: from ? { gte: from } : undefined }, orderBy: { recordedAt: 'asc' }, take: 5000 });
  }
}
