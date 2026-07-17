import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationUpdateDto } from './gps.dto';
@Injectable()
export class GpsService {
  constructor(private prisma: PrismaService) {}
  async update(employeeId: string, dto: LocationUpdateDto) {
    if (
      dto.latitude < 4 ||
      dto.latitude > 14.5 ||
      dto.longitude < 2.5 ||
      dto.longitude > 14.8
    ) {
      throw new BadRequestException(
        'GPS position is outside the supported Nigeria service area.',
      );
    }
    const driver = await this.prisma.driver.findUnique({ where: { employeeId } });
    if (!driver || driver.status === 'INACTIVE')
      throw new BadRequestException(
        'Your user account is not linked to an active driver record with the same employee ID.',
      );
    const allocation = await this.prisma.vehicleAllocation.findFirst({
      where: { driverId: driver.id, status: 'ACTIVE' },
      orderBy: { startAt: 'desc' },
    });
    const data = {
      driverId: driver.id,
      vehicleId: allocation?.vehicleId,
      allocationId: allocation?.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      speed: dto.speed,
      heading: dto.heading,
      recordedAt: new Date(dto.recordedAt),
    };
    await this.prisma.$transaction([
      this.prisma.driverCurrentLocation.upsert({
        where: { driverId: driver.id },
        create: data,
        update: data,
      }),
      this.prisma.driverLocationHistory.create({ data }),
    ]);
    return { success: true, driverId: driver.id, allocationId: allocation?.id ?? null };
  }
  async live() {
    const now = Date.now();
    const data = await this.prisma.driverCurrentLocation.findMany({
      include: {
        driver: {
          select: {
            id: true,
            staffName: true,
            employeeId: true,
            phone: true,
            passportMimeType: true,
            status: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            manufacturer: true,
            model: true,
            imageMimeType: true,
          },
        },
        allocation: { select: { id: true, purpose: true, destination: true, status: true } },
      },
    });
    return {
      data: data.map((item) => ({
        ...item,
        connectionStatus:
          now - item.recordedAt.getTime() > 5 * 60 * 1000
            ? 'OFFLINE'
            : now - item.recordedAt.getTime() > 2 * 60 * 1000
              ? 'STALE'
              : 'LIVE',
      })),
      generatedAt: new Date(),
    };
  }
}
