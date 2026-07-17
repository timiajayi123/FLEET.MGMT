import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv, required } from './csv';

type Result = { created: number; updated: number; failed: number; errors: { row: number; message: string }[] };

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  constructor(private prisma: PrismaService) {}
  private result(): Result {
    return { created: 0, updated: 0, failed: 0, errors: [] };
  }
  private rows(file: Express.Multer.File) {
    return parseCsv(file.buffer.toString('utf8'));
  }

  async locations(file: Express.Multer.File) {
    const out = this.result();
    for (const [index, row] of this.rows(file).entries()) {
      try {
        required(row, ['code', 'name']);
        const exists = await this.prisma.location.findUnique({ where: { code: row.code } });
        await this.prisma.location.upsert({
          where: { code: row.code },
          create: {
            code: row.code,
            name: row.name,
            address: row.address || null,
            state: row.state || null,
            description: row.description || null,
            status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            sortOrder: Number(row.sortOrder || 0),
          },
          update: {
            name: row.name,
            address: row.address || null,
            state: row.state || null,
            description: row.description || null,
            status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            sortOrder: Number(row.sortOrder || 0),
          },
        });
        exists ? out.updated++ : out.created++;
      } catch (e) {
        out.failed++;
        out.errors.push({ row: index + 2, message: e instanceof Error ? e.message : 'Import failed' });
      }
    }
    return out;
  }

  async vehicles(file: Express.Multer.File) {
    const out = this.result(),
      statuses = ['AVAILABLE', 'IN_USE', 'RESERVED', 'MAINTENANCE', 'OUT_OF_SERVICE'];
    for (const [index, row] of this.rows(file).entries()) {
      try {
        const vehicle = normaliseVehicleRow(row);
        const key = vehicle.registrationNumber.toUpperCase();
        if (!key) {
          throw new Error('Missing required field: OFFICIAL REG. NUMBER, PRIVATE REG. NUMBER, or S/N');
        }
        if (!vehicle.manufacturer || !vehicle.model) {
          throw new Error('Missing required field: VEHICLE TYPE/MAKE');
        }
        if (vehicle.status && !statuses.includes(vehicle.status)) throw new Error('Invalid status');
        const [location, type] = await Promise.all([
          vehicle.locationLookup ? this.findLocation(vehicle.locationLookup) : null,
          vehicle.vehicleTypeCode
            ? this.prisma.vehicleType.findUnique({ where: { code: vehicle.vehicleTypeCode } })
            : null,
        ]);
        if (vehicle.vehicleTypeCode && !type)
          throw new Error(`Unknown vehicleTypeCode: ${vehicle.vehicleTypeCode}`);
        const exists = await this.prisma.vehicle.findUnique({ where: { registrationNumber: key } });
        const data = {
          serialNumber: vehicle.serialNumber,
          locationUser: vehicle.locationUser,
          privateRegistrationNumber: vehicle.privateRegistrationNumber,
          officialRegistrationNumber: vehicle.officialRegistrationNumber,
          manufacturer: vehicle.manufacturer,
          model: vehicle.model,
          year: vehicle.year,
          purchaseCost: vehicle.purchaseCost,
          bookedValue: vehicle.bookedValue,
          estimatedCost: vehicle.estimatedCost,
          reservedPresentValue: vehicle.reservedPresentValue,
          age: vehicle.age,
          serviceability: vehicle.serviceability,
          legacyAgency: vehicle.legacyAgency,
          chassisNumber: vehicle.chassisNumber,
          engineNumber: vehicle.engineNumber,
          remark: vehicle.remark,
          faultDescription: vehicle.faultDescription,
          color: vehicle.color,
          status: (vehicle.status || 'AVAILABLE') as any,
          locationId: location?.id || null,
          vehicleTypeId: type?.id || null,
        };
        await this.prisma.vehicle.upsert({
          where: { registrationNumber: key },
          create: { registrationNumber: key, ...data },
          update: data,
        });
        exists ? out.updated++ : out.created++;
      } catch (e) {
        out.failed++;
        out.errors.push({ row: index + 2, message: e instanceof Error ? e.message : 'Import failed' });
      }
    }
    return out;
  }

  async drivers(file: Express.Multer.File) {
    const out = this.result(),
      statuses = ['AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'INACTIVE'];
    const rows = this.rows(file);
    this.logger.log(
      `[drivers-import] file=${file.originalname ?? 'unknown'} size=${file.size ?? file.buffer.length} rows=${rows.length}`,
    );
    this.logger.debug(`[drivers-import] first rows=${JSON.stringify(rows.slice(0, 3).map(debugRow))}`);
    for (const [index, row] of rows.entries()) {
      try {
        const driver = normaliseDriverRow(row);
        const missing = [
          !driver.staffName && "DRIVER'S NAME",
        ].filter(Boolean);
        this.logger.debug(
          `[drivers-import] row=${index + 2} parsed=${JSON.stringify(debugRow(row))} cells=${JSON.stringify(
            rowCells(row),
          )} normalised=${JSON.stringify(driver)} missing=${JSON.stringify(missing)}`,
        );
        if (missing.length)
          throw new Error(
            `Missing required field(s): ${missing.join(', ')}. Detected columns: ${Object.keys(row).join(
              ' | ',
            )}. Row values: ${rowCells(row).join(' | ') || 'EMPTY'}`,
          );
        if (driver.category && !['OUTSOURCED', 'PERMANENT STAFF'].includes(driver.category))
          throw new Error('CATEGORY must be OUTSOURCED or PERMANENT STAFF');
        if (driver.status && !statuses.includes(driver.status)) throw new Error('Invalid status');
        const location = driver.locationCode ? await this.findLocation(driver.locationCode) : null;
        const exists = await this.prisma.driver.findUnique({ where: { employeeId: driver.employeeId } });
        const data = {
          serialNumber: driver.serialNumber,
          staffName: driver.staffName,
          locationText: driver.locationText,
          zone: driver.zone,
          category: driver.category,
          phone: driver.phone,
          email: driver.email,
          licenceNumber: driver.licenceNumber,
          licenceClass: driver.licenceClass,
          status: (driver.status || 'AVAILABLE') as any,
          locationId: location?.id || null,
        };
        await this.prisma.driver.upsert({
          where: { employeeId: driver.employeeId },
          create: { employeeId: driver.employeeId, ...data },
          update: data,
        });
        exists ? out.updated++ : out.created++;
      } catch (e) {
        out.failed++;
        out.errors.push({ row: index + 2, message: e instanceof Error ? e.message : 'Import failed' });
      }
    }
    return out;
  }

  private async findLocation(input: string) {
    const text = input.trim();
    if (!text) return null;
    return (
      (await this.prisma.location.findUnique({ where: { code: text.toUpperCase() } })) ||
      (await this.prisma.location.findFirst({
        where: { name: { equals: text, mode: 'insensitive' } },
      }))
    );
  }
}

function normaliseDriverRow(row: Record<string, string>) {
  const category = field(row, 4, 'CATEGORY', 'category').trim().toUpperCase();
  const serialNumber = field(row, 0, 'S/N', 'SN', 'S NO', 'SERIAL NUMBER', 'serialNumber') || null;
  const staffName = field(row, 1, "DRIVER'S NAME", 'DRIVERS NAME', 'DRIVER NAME', 'NAME', 'staffName') || '';
  const employeeId = field(row, 5, 'I D NUMBER', 'ID NUMBER', 'ID NO', 'ID', 'STAFF ID', 'employeeId');
  return {
    serialNumber,
    staffName,
    locationText: field(row, 2, 'LOCATION', 'LOCATION/USER', 'BASE', 'locationText') || null,
    locationCode: value(row, 'locationCode'),
    zone: field(row, 3, 'ZONE', 'zone') || null,
    category: category === 'PERMANENT' ? 'PERMANENT STAFF' : category || null,
    employeeId: employeeId || generatedDriverEmployeeId(serialNumber, staffName),
    email: field(row, 6, 'E MAIL', 'EMAIL', 'EMAIL ADDRESS', 'email') || null,
    phone: field(row, 7, 'PHONE NUMBER', 'PHONE NO', 'PHONE', 'PHONE NUMBER ', 'phone') || '',
    licenceNumber: value(row, 'licenceNumber') || null,
    licenceClass: value(row, 'licenceClass') || null,
    status: value(row, 'status').toUpperCase(),
  };
}

function generatedDriverEmployeeId(serialNumber: string | null, staffName: string) {
  const serial = serialNumber?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (serial) return `DRV-${serial}`;
  const nameKey = staffName
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
  return `DRV-${nameKey || Date.now()}`;
}

function field(row: Record<string, string>, index: number, ...keys: string[]) {
  return value(row, ...keys) || rowCells(row)[index]?.trim() || '';
}

function rowCells(row: Record<string, string>) {
  const values = Object.values(row).map((item) => item?.trim() ?? '');
  if (values.filter(Boolean).length > 1) return values;
  const packed = values.find(Boolean);
  if (!packed) return values;
  const delimiter =
    (packed.match(/\t/g)?.length ?? 0) >= Math.max(packed.match(/,/g)?.length ?? 0, packed.match(/;/g)?.length ?? 0)
      ? '\t'
      : (packed.match(/;/g)?.length ?? 0) > (packed.match(/,/g)?.length ?? 0)
        ? ';'
        : ',';
  return packed.split(delimiter).map((item) => item.trim());
}

function debugRow(row: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, item]) => [key, item.length > 120 ? `${item.slice(0, 120)}...` : item]),
  );
}

function normaliseVehicleRow(row: Record<string, string>) {
  const officialRegistration = value(row, 'OFFICIAL REG. NUMBER', 'officialRegistrationNumber');
  const privateRegistration = value(row, 'PRIVATE REG. NUMBER', 'privateRegistrationNumber');
  const make = value(row, 'VEHICLE TYPE/MAKE', 'vehicleTypeMake');
  const [manufacturer, ...modelParts] = make.split(/\s+/).filter(Boolean);
  const explicitStatus = value(row, 'STATUS', 'status').toUpperCase();
  const serviceability = value(row, 'SERVICEABLE/UNSERVICEABLE', 'serviceability').toUpperCase();
  return {
    serialNumber: value(row, 'S/N', 'serialNumber') || null,
    locationUser: value(row, 'LOCATION/USER', 'locationUser') || null,
    privateRegistrationNumber: privateRegistration || null,
    officialRegistrationNumber: officialRegistration || null,
    registrationNumber:
      value(row, 'registrationNumber') ||
      officialRegistration ||
      privateRegistration ||
      (value(row, 'S/N', 'serialNumber') ? `SN-${value(row, 'S/N', 'serialNumber')}` : ''),
    manufacturer: value(row, 'manufacturer') || manufacturer || '',
    model: value(row, 'model') || modelParts.join(' ') || make || '',
    year: numberOrNull(value(row, 'year', 'YEAR OF PURCHASE')),
    purchaseCost: value(row, 'PURCHASE COST', 'purchaseCost') || null,
    bookedValue: value(row, 'BOOKED VALUE (N)', 'bookedValue') || null,
    estimatedCost: value(row, 'ESTIMATED COST (N)', 'estimatedCost') || null,
    reservedPresentValue: value(row, 'RESERVED PRESENT VALUE', 'reservedPresentValue') || null,
    age: value(row, 'AGE', 'age') || null,
    serviceability: value(row, 'SERVICEABLE/UNSERVICEABLE', 'serviceability') || null,
    legacyAgency: value(row, 'LEGACY AGENCY', 'legacyAgency') || null,
    chassisNumber: value(row, 'CHASSIS NUMBER', 'chassisNumber') || null,
    engineNumber: value(row, 'ENGINE NUMBER', 'engineNumber') || null,
    remark: value(row, 'REMARK', 'remark') || null,
    faultDescription: value(row, 'DESCRIPTION OF FAULT', 'faultDescription') || null,
    color: value(row, 'color') || null,
    status: mapVehicleStatus(explicitStatus, serviceability),
    locationLookup: value(row, 'locationCode'),
    vehicleTypeCode: value(row, 'vehicleTypeCode').toUpperCase(),
  };
}

function value(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key]) return row[key].trim();
    const found = Object.keys(row).find((item) => clean(item) === clean(key));
    if (found && row[found]) return row[found].trim();
  }
  return '';
}

function clean(input: string) {
  return input
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

function numberOrNull(input: string) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : null;
}


function mapVehicleStatus(status: string, serviceability: string) {
  const normal = status.replace(/[^A-Z_]/g, '_');
  if (['AVAILABLE', 'IN_USE', 'RESERVED', 'MAINTENANCE', 'OUT_OF_SERVICE'].includes(normal)) return normal;
  if (serviceability.includes('UNSERVICEABLE')) return 'OUT_OF_SERVICE';
  if (serviceability.includes('SERVICEABLE')) return 'AVAILABLE';
  return 'AVAILABLE';
}
