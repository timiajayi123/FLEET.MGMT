import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaselineDto, CreateFuelEntryDto, DecisionDto, FuelCardDto, FuelPriceDto, StationDto } from './fuel.dto';

type SessionUser = { id: string; employeeId: string; staffName: string; role: { code: string }; departmentId?: string | null; directorateId?: string | null; locationId?: string | null; unitId?: string | null };
const MANAGERS = ['S_ADMIN', 'FM'];
const APPROVAL_STAGES = ['FLEET_SUPERVISOR', 'FLEET_MANAGER', 'FINANCE'];
const DECIMAL = (value: number | null | undefined, scale = 4) => value === null || value === undefined ? null : Number(value.toFixed(scale));

const entryInclude = {
  vehicle: { select: { registrationNumber: true, manufacturer: true, model: true } },
  driver: { select: { staffName: true, employeeId: true } },
  allocation: { select: { id: true, status: true } },
  trip: { select: { id: true, status: true, calculatedDistance: true } },
  station: { select: { name: true, state: true, city: true } },
  fuelCard: { select: { maskedNumber: true, provider: true, status: true } },
  alerts: { orderBy: { createdAt: 'desc' as const } },
  approvals: { orderBy: { createdAt: 'asc' as const }, include: { actor: { select: { staffName: true } } } },
  attachments: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true } },
} as const;

@Injectable()
export class FuelService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(user: SessionUser) {
    const manager = MANAGERS.includes(user.role.code);
    const driver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId }, select: { id: true, staffName: true, phone: true } });
    const activeAllocation = driver ? await this.prisma.vehicleAllocation.findFirst({ where: { driverId: driver.id, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } }, orderBy: { startAt: 'desc' }, include: { vehicle: { select: { id: true, registrationNumber: true, manufacturer: true, model: true, vehicleType: { select: { name: true } } } }, trip: { select: { id: true, status: true, calculatedDistance: true } } } }) : null;
    const [stations, cards, vehicles] = await Promise.all([
      this.prisma.fuelStation.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true, brand: true, state: true, city: true } }),
      manager ? this.prisma.fuelCard.findMany({ where: { status: 'ACTIVE' }, orderBy: { maskedNumber: 'asc' }, select: { id: true, maskedNumber: true, provider: true, vehicleId: true, driverId: true, status: true } }) : driver ? this.prisma.fuelCard.findMany({ where: { status: 'ACTIVE', OR: [{ driverId: driver.id }, { vehicleId: activeAllocation?.vehicleId }] }, select: { id: true, maskedNumber: true, provider: true, vehicleId: true, driverId: true, status: true } }) : [],
      manager ? this.prisma.vehicle.findMany({ where: { status: { not: 'OUT_OF_SERVICE' } }, orderBy: { registrationNumber: 'asc' }, select: { id: true, registrationNumber: true, manufacturer: true, model: true } }) : [],
    ]);
    return { data: { canManage: manager, driver, activeAllocation, stations, cards, vehicles } };
  }

  async list(user: SessionUser, status?: string) {
    const driver = user.role.code === 'DRIVER' ? await this.requireDriver(user) : null;
    const where = { ...(driver ? { driverId: driver.id } : {}), ...(status ? { approvalStatus: status } : {}) };
    return { data: await this.prisma.fuelEntry.findMany({ where, include: entryInclude, orderBy: { fuelingAt: 'desc' }, take: 300 }) };
  }

  async create(dto: CreateFuelEntryDto, user: SessionUser, files: Record<string, Express.Multer.File[] | undefined>) {
    const manager = MANAGERS.includes(user.role.code);
    const context = await this.resolveContext(dto, user, manager);
    const approvedPrice = await this.prisma.fuelPrice.findFirst({ where: { fuelType: dto.fuelType, state: dto.state ?? context.station?.state ?? '', status: 'ACTIVE', effectiveDate: { lte: new Date(dto.fuelingAt) }, OR: [{ stationId: context.station?.id }, { stationId: null }] }, orderBy: { effectiveDate: 'desc' } });
    const baseline = await this.prisma.vehicleFuelBaseline.findUnique({ where: { vehicleId: context.vehicle.id } });
    const price = dto.pricePerLitre;
    const litres = dto.dispensedLitres;
    const total = DECIMAL(price * litres, 2)!;
    const previous = await this.prisma.fuelEntry.findFirst({ where: { vehicleId: context.vehicle.id, approvalStatus: { in: ['APPROVED', 'POSTED'] }, currentOdometer: { not: null } }, orderBy: { fuelingAt: 'desc' }, select: { currentOdometer: true } });
    const priorOdometer = previous?.currentOdometer ? Number(previous.currentOdometer) : null;
    const distance = dto.currentOdometer !== undefined && priorOdometer !== null ? DECIMAL(dto.currentOdometer - priorOdometer, 2) : context.trip?.calculatedDistance ? DECIMAL(Number(context.trip.calculatedDistance), 2) : dto.gpsDistance ?? null;
    if (distance !== null && distance < 0) throw new BadRequestException('Current odometer cannot be lower than the last approved fuel odometer.');
    const kmPerLitre = distance !== null ? DECIMAL(distance / litres) : null;
    const litresPer100Km = distance && distance > 0 ? DECIMAL(litres / distance * 100) : null;
    const costPerKm = distance && distance > 0 ? DECIMAL(total / distance) : null;
    const baselineDifference = baseline?.expectedKmPerLitre && kmPerLitre !== null ? DECIMAL(kmPerLitre - Number(baseline.expectedKmPerLitre)) : null;
    const baselineVariancePct = baseline?.expectedKmPerLitre && baselineDifference !== null ? DECIMAL(baselineDifference / Number(baseline.expectedKmPerLitre) * 100, 2) : null;
    const validationAlerts = await this.validateEntry({ dto, context, approvedPrice, baseline, total, baselineVariancePct, distance });
    const submitting = dto.submit !== false;
    const approvalStatus = submitting ? 'FLEET_SUPERVISOR_PENDING' : 'DRAFT';
    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fuelEntry.create({ data: {
        entryNumber: `FUEL-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        vehicleId: context.vehicle.id, driverId: context.driver.id, allocationId: context.allocation.id, tripId: context.trip?.id ?? null, createdById: user.id, stationId: context.station?.id ?? null, fuelCardId: dto.fuelCardId ?? null, vendorId: context.station?.vendorId ?? null,
        fuelingAt: new Date(dto.fuelingAt), entryType: dto.entryType || 'REFUEL', fuelType: dto.fuelType, entryStatus: submitting ? 'SUBMITTED' : 'DRAFT', approvalStatus, reason: dto.reason || null, comments: dto.comments || null,
        vehicleRegistration: context.vehicle.registrationNumber, driverName: context.driver.staffName, driverEmployeeId: context.driver.employeeId, allocationSnapshot: context.allocation.id, tripSnapshot: context.trip?.id ?? null,
        departmentName: user.departmentId ? await this.nameOf('department', user.departmentId) : null, directorateName: user.directorateId ? await this.nameOf('directorate', user.directorateId) : null, officeName: user.locationId ? await this.nameOf('location', user.locationId) : null, unitName: user.unitId ? await this.nameOf('unit', user.unitId) : null, supervisorName: context.allocation.assignedBy?.staffName ?? null,
        state: dto.state ?? context.station?.state ?? null, city: dto.city ?? context.station?.city ?? null, pumpNumber: dto.pumpNumber || null, fuelLevelBefore: dto.fuelLevelBefore ?? null, fuelLevelAfter: dto.fuelLevelAfter ?? null, requestedLitres: dto.requestedLitres ?? null, dispensedLitres: litres, approvedPricePerLitre: approvedPrice?.pricePerLitre ?? null, pricePerLitre: price, totalAmount: total, paymentMethod: dto.paymentMethod, cardTransactionNumber: dto.cardTransactionNumber || null, receiptNumber: dto.receiptNumber || null, vendorInvoice: dto.vendorInvoice || null,
        previousOdometer: priorOdometer, currentOdometer: dto.currentOdometer ?? null, distanceTravelled: distance, gpsDistance: dto.gpsDistance ?? null, tripDistance: context.trip?.calculatedDistance ?? null, engineHours: dto.engineHours ?? null, distanceSource: dto.currentOdometer !== undefined ? 'ODOMETER' : context.trip ? 'TRIP' : dto.gpsDistance !== undefined ? 'GPS' : null, kmPerLitre, litresPer100Km, costPerKm, baselineDifference, baselineVariancePct, latitude: dto.latitude ?? null, longitude: dto.longitude ?? null, submittedAt: submitting ? new Date() : null,
      }, include: entryInclude });
      if (submitting) await tx.fuelApproval.create({ data: { fuelEntryId: created.id, stage: APPROVAL_STAGES[0], status: 'PENDING' } });
      for (const alert of validationAlerts) await tx.fuelAlert.create({ data: { fuelEntryId: created.id, ...alert } });
      for (const [kind, list] of Object.entries(files)) for (const file of list ?? []) await tx.fuelAttachment.create({ data: { fuelEntryId: created.id, kind, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, data: Uint8Array.from(file.buffer) } });
      await tx.fuelAuditLog.create({ data: { fuelEntryId: created.id, actorId: user.id, action: submitting ? 'SUBMITTED' : 'SAVED_DRAFT', entityType: 'FuelEntry', entityId: created.id, details: 'Fuel entry created with historical vehicle, driver, allocation and trip snapshots.' } });
      return created;
    });
    return { data: entry };
  }

  async decide(id: string, dto: DecisionDto, user: SessionUser) {
    const entry = await this.prisma.fuelEntry.findUnique({ where: { id }, include: { approvals: { where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 1 } } });
    if (!entry) throw new NotFoundException('Fuel entry not found.');
    const current = entry.approvals[0];
    if (!current) throw new BadRequestException('This fuel entry is not awaiting approval.');
    if (dto.decision === 'REJECT' && !dto.comment) throw new BadRequestException('A rejection reason is required.');
    return this.prisma.$transaction(async (tx) => {
      await tx.fuelApproval.update({ where: { id: current.id }, data: { status: dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', comment: dto.comment || null, actorId: user.id, actedAt: new Date() } });
      if (dto.decision === 'REJECT') {
        await tx.fuelEntry.update({ where: { id }, data: { approvalStatus: 'REJECTED', entryStatus: 'REJECTED' } });
      } else {
        const next = APPROVAL_STAGES[APPROVAL_STAGES.indexOf(current.stage) + 1];
        if (next) { await tx.fuelApproval.create({ data: { fuelEntryId: id, stage: next, status: 'PENDING' } }); await tx.fuelEntry.update({ where: { id }, data: { approvalStatus: `${next}_PENDING` } }); }
        else { await tx.fuelEntry.update({ where: { id }, data: { approvalStatus: 'APPROVED', entryStatus: 'APPROVED', approvedAt: new Date() } }); }
      }
      await tx.fuelAuditLog.create({ data: { fuelEntryId: id, actorId: user.id, action: dto.decision, entityType: 'FuelEntry', entityId: id, details: dto.comment || null } });
      return { data: await tx.fuelEntry.findUniqueOrThrow({ where: { id }, include: entryInclude }) };
    });
  }

  async dashboard() {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const entries = await this.prisma.fuelEntry.findMany({ where: { approvalStatus: { in: ['APPROVED', 'POSTED'] }, fuelingAt: { gte: since } }, select: { totalAmount: true, dispensedLitres: true, kmPerLitre: true, costPerKm: true, vehicleId: true, departmentName: true, fuelingAt: true } });
    const alerts = await this.prisma.fuelAlert.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 10 });
    const totalSpend = entries.reduce((sum, entry) => sum + Number(entry.totalAmount), 0);
    const totalLitres = entries.reduce((sum, entry) => sum + Number(entry.dispensedLitres), 0);
    const average = (key: 'kmPerLitre' | 'costPerKm') => { const values = entries.map((entry) => entry[key]).filter((value): value is NonNullable<typeof value> => value !== null).map(Number); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; };
    const vehiclesOverBaseline = await this.prisma.fuelEntry.count({
      where: { baselineVariancePct: { lt: -10 }, approvalStatus: { in: ['APPROVED', 'POSTED'] } },
    });
    const approvalQueue = await this.prisma.fuelEntry.findMany({
      where: { approvalStatus: { contains: 'PENDING' } }, include: entryInclude, orderBy: { submittedAt: 'asc' }, take: 20,
    });
    return { data: { metrics: { totalSpend: DECIMAL(totalSpend, 2), totalLitres: DECIMAL(totalLitres, 3), averageConsumption: DECIMAL(average('kmPerLitre')), averageCostPerKm: DECIMAL(average('costPerKm')), vehiclesOverBaseline, openAlerts: alerts.length }, alerts, approvalQueue } };
  }

  async cards() { return { data: await this.prisma.fuelCard.findMany({ include: { vehicle: { select: { registrationNumber: true } }, driver: { select: { staffName: true } }, transactions: { orderBy: { transactionAt: 'desc' }, take: 5 } }, orderBy: { createdAt: 'desc' } }) }; }
  async createCard(dto: FuelCardDto, user: SessionUser) { const card = await this.prisma.fuelCard.create({ data: { ...dto, cardNumber: dto.cardNumber.replace(/\s/g, ''), maskedNumber: mask(dto.cardNumber), issueDate: new Date(dto.issueDate), expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null } }); await this.audit(user.id, 'CREATED', 'FuelCard', card.id); return { data: card }; }
  async stations() { return { data: await this.prisma.fuelStation.findMany({ include: { vendor: true, prices: { orderBy: { effectiveDate: 'desc' }, take: 1 } }, orderBy: { name: 'asc' } }) }; }
  async createStation(dto: StationDto, user: SessionUser) { const station = await this.prisma.fuelStation.create({ data: dto }); await this.audit(user.id, 'CREATED', 'FuelStation', station.id); return { data: station }; }
  async createPrice(dto: FuelPriceDto, user: SessionUser) { const price = await this.prisma.fuelPrice.create({ data: { ...dto, effectiveDate: new Date(dto.effectiveDate) } }); await this.audit(user.id, 'CREATED', 'FuelPrice', price.id); return { data: price }; }
  async saveBaseline(vehicleId: string, dto: BaselineDto, user: SessionUser) { const baseline = await this.prisma.vehicleFuelBaseline.upsert({ where: { vehicleId }, create: { vehicleId, ...dto }, update: dto }); await this.audit(user.id, 'SAVED', 'VehicleFuelBaseline', baseline.id); return { data: baseline }; }

  private async resolveContext(dto: CreateFuelEntryDto, user: SessionUser, manager: boolean) {
    const currentDriver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId } });
    const allocation = dto.allocationId
      ? await this.prisma.vehicleAllocation.findUnique({ where: { id: dto.allocationId }, include: { vehicle: true, driver: true, trip: true, assignedBy: { select: { staffName: true } } } })
      : await this.prisma.vehicleAllocation.findFirst({ where: { driverId: manager ? dto.driverId ?? currentDriver?.id : currentDriver?.id, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } }, orderBy: { startAt: 'desc' }, include: { vehicle: true, driver: true, trip: true, assignedBy: { select: { staffName: true } } } });
    if (!allocation) throw new BadRequestException('Fuel entries require an active vehicle allocation so the driver and vehicle history can be stored permanently.');
    if (!manager && (!currentDriver || allocation.driverId !== currentDriver.id)) throw new BadRequestException('Drivers can only submit fuel for their own active allocation.');
    if (!manager && dto.vehicleId && dto.vehicleId !== allocation.vehicleId) throw new BadRequestException('Vehicle must match the active allocation.');
    if (!manager && dto.driverId && dto.driverId !== allocation.driverId) throw new BadRequestException('Driver must match the active allocation.');
    const station = dto.stationId ? await this.prisma.fuelStation.findUnique({ where: { id: dto.stationId } }) : null;
    if (dto.stationId && !station) throw new NotFoundException('Fuel station not found.');
    return { allocation, vehicle: allocation.vehicle, driver: allocation.driver, trip: dto.tripId ? await this.prisma.trip.findUnique({ where: { id: dto.tripId } }) : allocation.trip, station };
  }

  private async validateEntry(input: { dto: CreateFuelEntryDto; context: Awaited<ReturnType<FuelService['resolveContext']>>; approvedPrice: { pricePerLitre: unknown; tolerancePct: unknown } | null; baseline: { tankCapacityLitres: unknown; acceptableTolerancePct: unknown } | null; total: number; baselineVariancePct: number | null; distance: number | null }) {
    const alerts: { alertType: string; severity: string; message: string }[] = [];
    if (input.dto.receiptNumber && await this.prisma.fuelEntry.findFirst({ where: { receiptNumber: input.dto.receiptNumber } })) alerts.push({ alertType: 'DUPLICATE_RECEIPT', severity: 'HIGH', message: 'This receipt number is already used by another fuel entry.' });
    if (input.baseline?.tankCapacityLitres && input.dto.dispensedLitres > Number(input.baseline.tankCapacityLitres)) alerts.push({ alertType: 'TANK_CAPACITY', severity: 'HIGH', message: 'Dispensed litres exceed the vehicle fuel tank baseline.' });
    if (input.approvedPrice) { const approved = Number(input.approvedPrice.pricePerLitre); const tolerance = Number(input.approvedPrice.tolerancePct); if (input.dto.pricePerLitre > approved * (1 + tolerance / 100)) alerts.push({ alertType: 'PRICE_VARIANCE', severity: 'HIGH', message: 'Entered price exceeds the approved state/station fuel-price tolerance.' }); }
    if (input.baselineVariancePct !== null && input.baseline?.acceptableTolerancePct && Math.abs(input.baselineVariancePct) > Number(input.baseline.acceptableTolerancePct)) alerts.push({ alertType: 'BASELINE_VARIANCE', severity: 'WARNING', message: 'Fuel efficiency differs materially from the vehicle baseline.' });
    if (input.distance !== null && input.distance > 0 && input.dto.gpsDistance !== undefined && Math.abs(input.distance - input.dto.gpsDistance) > Math.max(5, input.distance * .3)) alerts.push({ alertType: 'GPS_MISMATCH', severity: 'WARNING', message: 'Odometer/trip distance materially differs from supplied GPS distance.' });
    if (input.dto.fuelCardId) await this.validateCard(input.dto.fuelCardId, input.context, input.total, input.dto.fuelType, input.dto.state ?? input.context.station?.state ?? '');
    return alerts;
  }

  private async validateCard(cardId: string, context: Awaited<ReturnType<FuelService['resolveContext']>>, amount: number, fuelType: string, state: string) {
    const card = await this.prisma.fuelCard.findUnique({ where: { id: cardId } });
    if (!card || card.status !== 'ACTIVE' || card.expiryDate && card.expiryDate < new Date()) throw new BadRequestException('Fuel card is inactive, suspended, or expired.');
    if (card.vehicleId && card.vehicleId !== context.vehicle.id || card.driverId && card.driverId !== context.driver.id) throw new BadRequestException('Fuel card is not assigned to this historical vehicle and driver allocation.');
    if (card.transactionLimit && amount > Number(card.transactionLimit)) throw new BadRequestException('Fuel amount exceeds this card’s per-transaction limit.');
    if (card.allowedFuelTypes && !card.allowedFuelTypes.toLowerCase().split(',').map((item) => item.trim()).includes(fuelType.toLowerCase())) throw new BadRequestException('This fuel type is not permitted by the fuel card.');
    if (card.allowedStates && !card.allowedStates.toLowerCase().split(',').map((item) => item.trim()).includes(state.toLowerCase())) throw new BadRequestException('This state is not permitted by the fuel card.');
  }

  private async requireDriver(user: SessionUser) { const driver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId } }); if (!driver) throw new BadRequestException('Your account is not linked to a driver profile.'); return driver; }
  private async nameOf(model: 'department' | 'directorate' | 'location' | 'unit', id: string) {
    if (model === 'department') return (await this.prisma.department.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
    if (model === 'directorate') return (await this.prisma.directorate.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
    if (model === 'location') return (await this.prisma.location.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
    return (await this.prisma.unit.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  }
  private async audit(actorId: string, action: string, entityType: string, entityId: string) { await this.prisma.fuelAuditLog.create({ data: { actorId, action, entityType, entityId } }); }
}

function mask(value: string) { const digits = value.replace(/\s/g, ''); return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`; }
