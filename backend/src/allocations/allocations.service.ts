import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAllocationDto } from './allocations.dto';

const ACTIVE = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];
const include = {
  request: { include: { requester: { select: { staffName: true, phone: true } } } },
  vehicle: { select: { id: true, registrationNumber: true, manufacturer: true, model: true, status: true, imageMimeType: true } },
  driver: { select: { id: true, staffName: true, employeeId: true, phone: true, status: true, passportMimeType: true } },
  assignedBy: { select: { id: true, staffName: true } },
  trip: true,
} as const;

@Injectable()
export class AllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: Pick<User, 'employeeId'> & { role: { code: string } }) {
    return this.prisma.vehicleAllocation.findMany({
      where: user.role.code === 'DRIVER' ? { driver: { employeeId: user.employeeId } } : undefined,
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async driverDashboard(employeeId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { employeeId } });
    if (!driver) throw new NotFoundException('Your user account is not linked to a driver profile.');
    const allocations = await this.prisma.vehicleAllocation.findMany({
      where: { driverId: driver.id }, include, orderBy: { startAt: 'desc' }, take: 30,
    });
    return {
      driver,
      current: allocations.find((item) => ACTIVE.includes(item.status)) ?? null,
      upcoming: allocations.filter((item) => ['ASSIGNED', 'ACCEPTED'].includes(item.status) && item.startAt > new Date()),
      recent: allocations.filter((item) => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(item.status)).slice(0, 10),
    };
  }

  async create(dto: CreateAllocationDto, assignedById: string) {
    return this.prisma.$transaction((tx) => this.save(tx, undefined, dto, assignedById));
  }

  async update(id: string, dto: CreateAllocationDto, assignedById: string) {
    return this.prisma.$transaction((tx) => this.save(tx, id, dto, assignedById));
  }

  private async save(tx: Prisma.TransactionClient, id: string | undefined, dto: CreateAllocationDto, assignedById: string) {
    const startAt = new Date(dto.startAt);
    const expectedEndAt = new Date(dto.expectedEndAt);
    if (expectedEndAt <= startAt) throw new BadRequestException('Expected end must be after scheduled departure.');
    const existing = id ? await tx.vehicleAllocation.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new NotFoundException('Allocation not found.');
    if (existing && !['ASSIGNED', 'ACCEPTED'].includes(existing.status)) {
      throw new BadRequestException('Only an assignment that has not started can be changed.');
    }
    const [request, vehicle, driver] = await Promise.all([
      tx.vehicleRequest.findUnique({ where: { id: dto.requestId } }),
      tx.vehicle.findUnique({ where: { id: dto.vehicleId } }),
      tx.driver.findUnique({ where: { id: dto.driverId } }),
    ]);
    if (!request || !['APPROVED', 'ALLOCATED'].includes(request.status)) throw new BadRequestException('Only an approved request can be allocated.');
    if (!vehicle || (vehicle.status !== 'AVAILABLE' && vehicle.id !== existing?.vehicleId)) throw new BadRequestException('Selected vehicle is not available.');
    if (!driver || driver.status === 'INACTIVE' || (driver.status !== 'AVAILABLE' && driver.id !== existing?.driverId)) throw new BadRequestException('Selected driver is not available.');
    const overlap = { status: { in: ACTIVE }, startAt: { lt: expectedEndAt }, expectedEndAt: { gt: startAt }, id: id ? { not: id } : undefined } satisfies Prisma.VehicleAllocationWhereInput;
    const [vehicleConflict, driverConflict] = await Promise.all([
      tx.vehicleAllocation.findFirst({ where: { ...overlap, vehicleId: dto.vehicleId } }),
      tx.vehicleAllocation.findFirst({ where: { ...overlap, driverId: dto.driverId } }),
    ]);
    if (vehicleConflict) throw new BadRequestException('Vehicle has an overlapping active allocation.');
    if (driverConflict) throw new BadRequestException('Driver has an overlapping active allocation.');
    if (existing && existing.vehicleId !== dto.vehicleId) await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'AVAILABLE' } });
    if (existing && existing.driverId !== dto.driverId) await tx.driver.update({ where: { id: existing.driverId }, data: { status: 'AVAILABLE' } });
    const data = { requestId: dto.requestId, vehicleId: dto.vehicleId, driverId: dto.driverId, assignedById, purpose: request.purposeOfTrip, destination: request.destination, startAt, expectedEndAt, notes: dto.notes || null, status: 'ASSIGNED', rejectionReason: null };
    const allocation = existing
      ? await tx.vehicleAllocation.update({ where: { id: existing.id }, data, include })
      : await tx.vehicleAllocation.create({ data, include });
    await Promise.all([
      tx.vehicle.update({ where: { id: dto.vehicleId }, data: { status: 'ALLOCATED' } }),
      tx.driver.update({ where: { id: dto.driverId }, data: { status: 'ASSIGNED' } }),
      tx.vehicleRequest.update({ where: { id: dto.requestId }, data: { status: 'ALLOCATED' } }),
    ]);
    return allocation;
  }

  async driverDecision(id: string, employeeId: string, accept: boolean, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.vehicleAllocation.findUnique({ where: { id }, include: { driver: true } });
      if (!allocation || allocation.driver.employeeId !== employeeId) throw new NotFoundException('Assignment not found.');
      if (allocation.status !== 'ASSIGNED') throw new BadRequestException('This assignment has already been handled.');
      if (!accept) {
        await Promise.all([
          tx.vehicle.update({ where: { id: allocation.vehicleId }, data: { status: 'AVAILABLE' } }),
          tx.driver.update({ where: { id: allocation.driverId }, data: { status: 'AVAILABLE' } }),
          allocation.requestId ? tx.vehicleRequest.update({ where: { id: allocation.requestId }, data: { status: 'APPROVED' } }) : Promise.resolve(),
        ]);
      }
      return tx.vehicleAllocation.update({ where: { id }, data: { status: accept ? 'ACCEPTED' : 'REJECTED', rejectionReason: accept ? null : reason }, include });
    });
  }

  async emergency(id: string, employeeId: string, message: string) {
    const allocation = await this.prisma.vehicleAllocation.findFirst({ where: { id, driver: { employeeId }, status: 'IN_PROGRESS' } });
    if (!allocation) throw new NotFoundException('Active trip assignment not found.');
    return this.prisma.vehicleAllocation.update({ where: { id }, data: { emergencyAt: new Date(), notes: [allocation.notes, `EMERGENCY: ${message}`].filter(Boolean).join('\n') }, include });
  }

  async reportIssue(id: string, employeeId: string, message: string) {
    const allocation = await this.prisma.vehicleAllocation.findFirst({ where: { id, driver: { employeeId }, status: { in: ACTIVE } } });
    if (!allocation) throw new NotFoundException('Active assignment not found.');
    return this.prisma.vehicleAllocation.update({ where: { id }, data: { notes: [allocation.notes, `DRIVER ISSUE: ${message}`].filter(Boolean).join('\n') }, include });
  }

  async cancel(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.vehicleAllocation.findUnique({ where: { id }, include: { trip: true } });
      if (!allocation) throw new NotFoundException('Allocation not found.');
      if (allocation.status === 'COMPLETED') throw new BadRequestException('Completed allocations are retained for audit.');
      await Promise.all([
        tx.vehicle.update({ where: { id: allocation.vehicleId }, data: { status: 'AVAILABLE' } }),
        tx.driver.update({ where: { id: allocation.driverId }, data: { status: 'AVAILABLE' } }),
        allocation.requestId ? tx.vehicleRequest.update({ where: { id: allocation.requestId }, data: { status: 'APPROVED' } }) : Promise.resolve(),
        allocation.trip ? tx.trip.update({ where: { allocationId: id }, data: { status: 'CANCELLED', endedAt: new Date() } }) : Promise.resolve(),
      ]);
      return tx.vehicleAllocation.update({ where: { id }, data: { status: 'CANCELLED', actualEndAt: new Date() }, include });
    });
  }

  async completeWithoutTrip(id: string) {
    const allocation = await this.prisma.vehicleAllocation.findUnique({ where: { id } });
    if (!allocation) throw new NotFoundException('Allocation not found.');
    if (allocation.status === 'IN_PROGRESS') throw new BadRequestException('End the active trip from the driver workflow.');
    return this.cancel(id);
  }
}
