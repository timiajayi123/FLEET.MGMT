import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MasterDataStatus } from '../common/status.constants';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { AllocationsService } from '../allocations/allocations.service';
import { ApproveRequestAllocationDto } from '../allocations/allocations.dto';

const ALLOWED_ATTACHMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

@Injectable()
export class VehicleRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly allocations: AllocationsService) {}

  list(user: { id: string; role: { code: string } }) {
    return this.prisma.vehicleRequest.findMany({
      where: ['S_ADMIN', 'FM'].includes(user.role.code) ? undefined : { requesterId: user.id },
      include: {
        requester: { select: { id: true, staffName: true, email: true, phone: true } },
        allocations: { select: { id: true, status: true, vehicleId: true, driverId: true } },
      },
      omit: { attachmentData: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    const request = await this.prisma.vehicleRequest.findUnique({ where: { id } });
    if (!request) throw new BadRequestException('Vehicle request not found.');
    if (!['PENDING_APPROVAL', 'REJECTED', 'APPROVED'].includes(request.status)) {
      throw new BadRequestException('An allocated or completed request cannot be changed.');
    }
    return this.prisma.vehicleRequest.update({ where: { id }, data: { status }, omit: { attachmentData: true } });
  }

  async approve(id: string, assignedById: string, dto?: Partial<ApproveRequestAllocationDto>) {
    if (dto?.vehicleId && dto?.driverId && dto?.startAt && dto?.expectedEndAt) {
      return this.allocations.assignRequest(id, dto as ApproveRequestAllocationDto, assignedById);
    }
    return this.setStatus(id, 'APPROVED');
  }

  async create(dto: CreateVehicleRequestDto, attachment?: Express.Multer.File, requesterId?: string) {
    const departureDate = new Date(dto.departureDate);
    const expectedReturnDate = new Date(dto.expectedReturnDate);

    if (expectedReturnDate <= departureDate) {
      throw new BadRequestException('Expected return date must be after departure date.');
    }

    if (attachment && !ALLOWED_ATTACHMENT_TYPES.has(attachment.mimetype)) {
      throw new BadRequestException('Attachment must be a PDF, JPEG, or PNG file.');
    }

    const [location, directorate, department, unit, vehicleType] = await Promise.all([
      dto.locationId ? this.prisma.location.findFirst({ where: { id: dto.locationId, status: MasterDataStatus.ACTIVE } }) : null,
      this.prisma.directorate.findFirst({
        where: { id: dto.directorateId, status: MasterDataStatus.ACTIVE },
      }),
      dto.departmentId ? this.prisma.department.findFirst({ where: { id: dto.departmentId, status: MasterDataStatus.ACTIVE } }) : null,
      dto.unitId ? this.prisma.unit.findFirst({ where: { id: dto.unitId, status: MasterDataStatus.ACTIVE } }) : null,
      this.prisma.vehicleType.findFirst({
        where: { id: dto.vehicleTypeId, status: MasterDataStatus.ACTIVE },
      }),
    ]);

    if (!directorate || !vehicleType || (dto.locationId && !location) || (dto.departmentId && !department) || (dto.unitId && !unit)) {
      throw new BadRequestException('One or more selected master-data records are unavailable.');
    }
    if (department && department.directorateId !== directorate.id) {
      throw new BadRequestException('The selected department does not match the directorate.');
    }
    if (unit && (!department || unit.departmentId !== department.id)) {
      throw new BadRequestException('The selected directorate, department, and unit do not match.');
    }

    const request = await this.prisma.vehicleRequest.create({
      data: {
        requestNumber: this.createRequestNumber(),
        requesterId,
        staffName: dto.staffName,
        employeeId: dto.employeeId,
        locationId: location?.id,
        directorateId: directorate.id,
        departmentId: department?.id,
        unitId: unit?.id,
        vehicleTypeId: vehicleType.id,
        location: location?.name ?? dto.customPickupLocation!,
        directorate: directorate.name,
        department: department?.name ?? dto.customDepartment!,
        unit: unit?.name ?? dto.customUnit!,
        purposeOfTrip: dto.purposeOfTrip,
        tripCategory: dto.purposeOfTrip,
        vehicleTypeName: vehicleType.name,
        destination: dto.destination,
        customPickupLocation: dto.customPickupLocation || null,
        customDestination: dto.customDestination || null,
        customDepartment: dto.customDepartment || null,
        customUnit: dto.customUnit || null,
        departureDate,
        expectedReturnDate,
        numberOfPassengers: dto.numberOfPassengers,
        priority: dto.priority,
        remarks: dto.remarks || null,
        attachmentFileName: attachment?.originalname,
        attachmentMimeType: attachment?.mimetype,
        attachmentSizeBytes: attachment?.size,
        attachmentData: attachment ? Uint8Array.from(attachment.buffer) : undefined,
      },
      omit: { attachmentData: true },
    });

    return request;
  }

  private createRequestNumber(): string {
    const year = new Date().getUTCFullYear();
    return `FMR-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
