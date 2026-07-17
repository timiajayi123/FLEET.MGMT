import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MasterDataStatus } from '../../generated/prisma/enums';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';

const ALLOWED_ATTACHMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

@Injectable()
export class VehicleRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.location.findFirst({
        where: { id: dto.locationId, status: MasterDataStatus.ACTIVE },
      }),
      this.prisma.directorate.findFirst({
        where: { id: dto.directorateId, status: MasterDataStatus.ACTIVE },
      }),
      this.prisma.department.findFirst({
        where: { id: dto.departmentId, status: MasterDataStatus.ACTIVE },
      }),
      this.prisma.unit.findFirst({ where: { id: dto.unitId, status: MasterDataStatus.ACTIVE } }),
      this.prisma.vehicleType.findFirst({
        where: { id: dto.vehicleTypeId, status: MasterDataStatus.ACTIVE },
      }),
    ]);

    if (!location || !directorate || !department || !unit || !vehicleType) {
      throw new BadRequestException('One or more selected master-data records are unavailable.');
    }
    if (department.directorateId !== directorate.id || unit.departmentId !== department.id) {
      throw new BadRequestException('The selected directorate, department, and unit do not match.');
    }

    const request = await this.prisma.vehicleRequest.create({
      data: {
        requestNumber: this.createRequestNumber(),
        requesterId,
        staffName: dto.staffName,
        employeeId: dto.employeeId,
        locationId: location.id,
        directorateId: directorate.id,
        departmentId: department.id,
        unitId: unit.id,
        vehicleTypeId: vehicleType.id,
        location: location.name,
        directorate: directorate.name,
        department: department.name,
        unit: unit.name,
        purposeOfTrip: dto.purposeOfTrip,
        vehicleTypeName: vehicleType.name,
        destination: dto.destination,
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
