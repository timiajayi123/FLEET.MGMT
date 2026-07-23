import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMaintenanceRequestDto, ReviewMaintenanceRequestDto } from './maintenance.dto';

type SessionUser = { id: string; employeeId: string; role: { code: string } };
const MANAGERS = ['S_ADMIN', 'FM'];
const include = { evidenceMimeType: true, vehicle: { select: { id: true, registrationNumber: true, manufacturer: true, model: true, status: true, serviceability: true, vehicleType: { select: { name: true } } } }, reportedBy: { select: { staffName: true, employeeId: true } }, reviewedBy: { select: { staffName: true } } } as const;

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SessionUser) {
    const where = user.role.code === 'DRIVER' ? { reportedById: user.id } : undefined;
    return { data: await this.prisma.maintenanceRequest.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 200 }), canReview: MANAGERS.includes(user.role.code) };
  }

  async vehicles(user: SessionUser) {
    if (user.role.code !== 'DRIVER') return { data: await this.prisma.vehicle.findMany({ where: { status: { not: 'OUT_OF_SERVICE' } }, select: vehicleSelect, orderBy: { registrationNumber: 'asc' } }) };
    const driver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId } });
    if (!driver) throw new NotFoundException('Your user account is not linked to a driver profile.');
    const allocations = await this.prisma.vehicleAllocation.findMany({ where: { driverId: driver.id }, select: { vehicle: { select: vehicleSelect } }, orderBy: { createdAt: 'desc' }, take: 100 });
    const unique = new Map(allocations.map((allocation) => [allocation.vehicle.id, allocation.vehicle]));
    return { data: [...unique.values()] };
  }

  async create(dto: CreateMaintenanceRequestDto, user: SessionUser, evidence?: Express.Multer.File) {
    const occurredAt = new Date(dto.issueOccurredAt);
    if (Number.isNaN(occurredAt.getTime()) || occurredAt > new Date()) throw new BadRequestException('Issue date must be a valid past or current date.');
    if (evidence && !['image/jpeg', 'image/png', 'image/webp'].includes(evidence.mimetype)) throw new BadRequestException('Evidence image must be JPEG, PNG, or WebP.');
    await this.assertVehicleAllowed(dto.vehicleId, user);
    return { data: await this.prisma.maintenanceRequest.create({ data: { vehicleId: dto.vehicleId, reportedById: user.id, issueType: dto.issueType.trim(), issueDescription: dto.issueDescription.trim(), issueOccurredAt: occurredAt, ...(evidence ? { evidenceMimeType: evidence.mimetype, evidenceData: Uint8Array.from(evidence.buffer) } : {}) }, include }) };
  }

  async evidence(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id }, select: { evidenceMimeType: true, evidenceData: true } });
    if (!request?.evidenceData || !request.evidenceMimeType) throw new NotFoundException('No maintenance evidence image was attached to this request.');
    return request;
  }

  async review(id: string, dto: ReviewMaintenanceRequestDto, user: SessionUser) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Maintenance request not found.');
    if (request.status !== 'PENDING_REVIEW') throw new BadRequestException('This maintenance request has already been reviewed.');
    const serviceability = dto.serviceability;
    const vehicleStatus = serviceability === 'SERVICEABLE' ? 'MAINTENANCE' : 'OUT_OF_SERVICE';
    return { data: await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id: request.vehicleId }, data: { serviceability, status: vehicleStatus, remark: dto.adminRemark.trim(), faultDescription: request.issueDescription } });
      return tx.maintenanceRequest.update({ where: { id }, data: { serviceability, adminRemark: dto.adminRemark.trim(), status: serviceability === 'SERVICEABLE' ? 'MAINTENANCE_REQUIRED' : 'OUT_OF_SERVICE', reviewedById: user.id, reviewedAt: new Date() }, include });
    }) };
  }

  private async assertVehicleAllowed(vehicleId: string, user: SessionUser) {
    if (user.role.code !== 'DRIVER') {
      if (!await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } })) throw new NotFoundException('Vehicle not found.');
      return;
    }
    const driver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId } });
    const allocated = driver && await this.prisma.vehicleAllocation.findFirst({ where: { driverId: driver.id, vehicleId }, select: { id: true } });
    if (!allocated) throw new BadRequestException('Drivers can report only vehicles previously allocated to them.');
  }
}

const vehicleSelect = { id: true, registrationNumber: true, manufacturer: true, model: true, status: true, vehicleType: { select: { name: true } } } as const;
