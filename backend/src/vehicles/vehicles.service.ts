import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveVehicleDto } from './vehicles.dto';

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
    return this.prisma.vehicle.findMany({ select, orderBy: { registrationNumber: 'asc' } });
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
  async bulkRemove(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
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
