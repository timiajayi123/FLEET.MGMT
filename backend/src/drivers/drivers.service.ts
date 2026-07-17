import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveDriverDto } from './drivers.dto';

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
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}
  list() {
    return this.prisma.driver.findMany({ select, orderBy: [{ serialNumber: 'asc' }, { staffName: 'asc' }] });
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
    const blocks = [a && `allocations (${a})`, c && `current GPS location (${c})`, h && `GPS history (${h})`].filter(Boolean);
    if (blocks.length) throw new ConflictException(`This driver cannot be deleted because they are attached to: ${blocks.join(', ')}.`);
    return this.prisma.driver.delete({ where: { id }, select });
  }
  async passport(id: string) {
    const d = await this.prisma.driver.findUnique({ where: { id }, select: { passportData: true, passportMimeType: true } });
    if (!d?.passportData || !d.passportMimeType) throw new NotFoundException('Driver passport not found.');
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
}
