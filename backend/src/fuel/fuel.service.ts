import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BaselineDto,
  CreateFuelEntryDto,
  DecisionDto,
  FuelCardDto,
  FuelPriceDto,
} from './fuel.dto';

type SessionUser = {
  id: string;
  employeeId: string;
  staffName: string;
  role: { code: string };
  departmentId?: string | null;
  directorateId?: string | null;
  locationId?: string | null;
};
const MANAGERS = ['S_ADMIN', 'FM'];
const APPROVAL_STAGE = 'FLEET_MANAGER';
const RECORDED_STATUSES = ['APPROVED', 'POSTED', 'FINANCE_PENDING'];
const REVIEWABLE_STATUSES = ['FLEET_SUPERVISOR_PENDING', 'FLEET_MANAGER_PENDING'];
const DECIMAL = (value: number | null | undefined, scale = 4) =>
  value === null || value === undefined ? null : Number(value.toFixed(scale));

const entryInclude = {
  vehicle: {
    select: {
      registrationNumber: true,
      manufacturer: true,
      model: true,
      vehicleType: { select: { name: true } },
    },
  },
  driver: { select: { staffName: true, employeeId: true } },
  allocation: { select: { id: true, status: true } },
  trip: { select: { id: true, status: true, calculatedDistance: true } },
  station: { select: { name: true, state: true, city: true } },
  fuelCard: { select: { maskedNumber: true, provider: true, status: true } },
  alerts: { orderBy: { createdAt: 'desc' as const } },
  approvals: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { staffName: true } } },
  },
  attachments: {
    select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true },
  },
} as const;

@Injectable()
export class FuelService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(user: SessionUser) {
    const manager = MANAGERS.includes(user.role.code);
    const driver = await this.prisma.driver.findUnique({
      where: { employeeId: user.employeeId },
      select: { id: true, staffName: true, phone: true },
    });
    const activeAllocation = driver
      ? await this.prisma.vehicleAllocation.findFirst({
          where: { driverId: driver.id, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
          orderBy: { startAt: 'desc' },
          include: {
            vehicle: {
              select: {
                id: true,
                registrationNumber: true,
                manufacturer: true,
                model: true,
                vehicleType: { select: { id: true, name: true } },
              },
            },
            driver: { select: { id: true, staffName: true, employeeId: true } },
            trip: { select: { id: true, status: true, calculatedDistance: true } },
          },
        })
      : null;
    const [cards, vehicles, vehicleTypes, recentManualStations] = await Promise.all([
      manager
        ? this.prisma.fuelCard.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { maskedNumber: 'asc' },
            select: {
              id: true,
              maskedNumber: true,
              provider: true,
              vehicleId: true,
              driverId: true,
              status: true,
              currentBalance: true,
              issueDate: true,
              expiryDate: true,
            },
          })
        : driver
          ? this.prisma.fuelCard.findMany({
              where: {
                status: 'ACTIVE',
                OR: [{ driverId: driver.id }, { vehicleId: activeAllocation?.vehicleId }],
              },
              select: {
                id: true,
                maskedNumber: true,
                provider: true,
                vehicleId: true,
                driverId: true,
                status: true,
                currentBalance: true,
                issueDate: true,
                expiryDate: true,
              },
            })
          : [],
      this.prisma.vehicle.findMany({
        where: { status: { not: 'OUT_OF_SERVICE' } },
        orderBy: { registrationNumber: 'asc' },
        select: {
          id: true,
          registrationNumber: true,
          manufacturer: true,
          model: true,
          vehicleType: { select: { id: true, name: true } },
        },
      }),
      this.prisma.vehicleType.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      driver
        ? this.prisma.fuelEntry.findMany({
            where: { driverId: driver.id, stationId: null },
            orderBy: { fuelingAt: 'desc' },
            take: 100,
            select: { stationName: true, stationLocation: true },
          })
        : [],
    ]);
    const quickStations = recentManualStations.reduce<
      { stationName: string; stationLocation: string }[]
    >((entries, station) => {
      const stationName = station.stationName?.trim();
      const stationLocation = station.stationLocation?.trim();
      if (!stationName || !stationLocation) return entries;
      const exists = entries.some(
        (entry) =>
          entry.stationName.toLocaleLowerCase() === stationName.toLocaleLowerCase() &&
          entry.stationLocation.toLocaleLowerCase() === stationLocation.toLocaleLowerCase(),
      );
      if (!exists) entries.push({ stationName, stationLocation });
      return entries;
    }, []);
    return {
      data: {
        canManage: manager,
        driver,
        activeAllocation,
        cards,
        vehicles,
        vehicleTypes,
        quickStations,
      },
    };
  }

  async list(user: SessionUser, status?: string) {
    const driver = user.role.code === 'DRIVER' ? await this.requireDriver(user) : null;
    const where = {
      ...(driver ? { driverId: driver.id } : {}),
      ...(status ? { approvalStatus: status } : {}),
    };
    return {
      data: await this.prisma.fuelEntry.findMany({
        where,
        include: entryInclude,
        orderBy: { fuelingAt: 'desc' },
        take: 300,
      }),
    };
  }

  async create(
    dto: CreateFuelEntryDto,
    user: SessionUser,
    files: Record<string, Express.Multer.File[] | undefined>,
  ) {
    const manager = MANAGERS.includes(user.role.code);
    const context = await this.resolveContext(dto, user, manager);
    const approvedPrice = await this.prisma.fuelPrice.findFirst({
      where: {
        fuelType: dto.fuelType,
        state: dto.state ?? '',
        status: 'ACTIVE',
        effectiveDate: { lte: new Date(dto.fuelingAt) },
        stationId: null,
      },
      orderBy: { effectiveDate: 'desc' },
    });
    const baseline = await this.prisma.vehicleFuelBaseline.findUnique({
      where: { vehicleId: context.vehicle.id },
    });
    const price = dto.pricePerLitre;
    const litres = dto.dispensedLitres;
    const total = DECIMAL(price * litres, 2)!;
    const previous = await this.prisma.fuelEntry.findFirst({
      where: {
        vehicleId: context.vehicle.id,
        approvalStatus: { in: RECORDED_STATUSES },
        currentOdometer: { not: null },
      },
      orderBy: { fuelingAt: 'desc' },
      select: { currentOdometer: true },
    });
    const priorOdometer = previous?.currentOdometer ? Number(previous.currentOdometer) : null;
    const distance =
      dto.currentOdometer !== undefined && priorOdometer !== null
        ? DECIMAL(dto.currentOdometer - priorOdometer, 2)
        : context.trip?.calculatedDistance
          ? DECIMAL(Number(context.trip.calculatedDistance), 2)
          : (dto.gpsDistance ?? null);
    if (distance !== null && distance < 0)
      throw new BadRequestException(
        'Current odometer cannot be lower than the last approved fuel odometer.',
      );
    const kmPerLitre = distance !== null ? DECIMAL(distance / litres) : null;
    const litresPer100Km = distance && distance > 0 ? DECIMAL((litres / distance) * 100) : null;
    const costPerKm = distance && distance > 0 ? DECIMAL(total / distance) : null;
    const baselineDifference =
      baseline?.expectedKmPerLitre && kmPerLitre !== null
        ? DECIMAL(kmPerLitre - Number(baseline.expectedKmPerLitre))
        : null;
    const baselineVariancePct =
      baseline?.expectedKmPerLitre && baselineDifference !== null
        ? DECIMAL((baselineDifference / Number(baseline.expectedKmPerLitre)) * 100, 2)
        : null;
    const validationAlerts = await this.validateEntry({
      dto,
      context,
      approvedPrice,
      baseline,
      total,
      baselineVariancePct,
      distance,
    });
    const submitting = dto.submit !== false;
    const approvalStatus = submitting ? 'FLEET_MANAGER_PENDING' : 'DRAFT';
    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fuelEntry.create({
        data: {
          entryNumber: `FUEL-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          vehicleId: context.vehicle.id,
          driverId: context.driver.id,
          allocationId: context.allocation?.id ?? null,
          tripId: context.trip?.id ?? null,
          createdById: user.id,
          stationId: null,
          fuelCardId: dto.fuelCardId ?? null,
          vendorId: null,
          fuelingAt: new Date(dto.fuelingAt),
          entryType: dto.entryType || 'REFUEL',
          fuelType: dto.fuelType,
          entryStatus: submitting ? 'SUBMITTED' : 'DRAFT',
          approvalStatus,
          reason: dto.reason || null,
          comments: dto.comments || null,
          vehicleRegistration: context.vehicle.registrationNumber,
          driverName: context.driver.staffName,
          driverEmployeeId: context.driver.employeeId,
          allocationSnapshot: context.allocation?.id ?? null,
          tripSnapshot: context.trip?.id ?? null,
          departmentName: user.departmentId
            ? await this.nameOf('department', user.departmentId)
            : null,
          directorateName: user.directorateId
            ? await this.nameOf('directorate', user.directorateId)
            : null,
          officeName: user.locationId ? await this.nameOf('location', user.locationId) : null,
          unitName: null,
          supervisorName: context.allocation?.assignedBy?.staffName ?? null,
          state: dto.state ?? null,
          city: dto.city ?? null,
          stationName: dto.stationName,
          stationLocation: dto.stationLocation,
          pumpNumber: dto.pumpNumber || null,
          fuelLevelBefore: dto.fuelLevelBefore ?? null,
          fuelLevelAfter: dto.fuelLevelAfter ?? null,
          requestedLitres: dto.requestedLitres ?? null,
          dispensedLitres: litres,
          approvedPricePerLitre: approvedPrice?.pricePerLitre ?? null,
          pricePerLitre: price,
          totalAmount: total,
          paymentMethod: dto.paymentMethod,
          cardTransactionNumber: dto.cardTransactionNumber || null,
          receiptNumber: dto.receiptNumber || null,
          vendorInvoice: dto.vendorInvoice || null,
          previousOdometer: priorOdometer,
          currentOdometer: dto.currentOdometer ?? null,
          distanceTravelled: distance,
          gpsDistance: dto.gpsDistance ?? null,
          tripDistance: context.trip?.calculatedDistance ?? null,
          engineHours: dto.engineHours ?? null,
          distanceSource:
            dto.currentOdometer !== undefined
              ? 'ODOMETER'
              : context.trip
                ? 'TRIP'
                : dto.gpsDistance !== undefined
                  ? 'GPS'
                  : null,
          kmPerLitre,
          litresPer100Km,
          costPerKm,
          baselineDifference,
          baselineVariancePct,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          submittedAt: submitting ? new Date() : null,
        },
        include: entryInclude,
      });
      if (submitting)
        await tx.fuelApproval.create({
          data: { fuelEntryId: created.id, stage: APPROVAL_STAGE, status: 'PENDING' },
        });
      for (const alert of validationAlerts)
        await tx.fuelAlert.create({ data: { fuelEntryId: created.id, ...alert } });
      for (const [kind, list] of Object.entries(files))
        for (const file of list ?? [])
          await tx.fuelAttachment.create({
            data: {
              fuelEntryId: created.id,
              kind,
              fileName: file.originalname,
              mimeType: file.mimetype,
              sizeBytes: file.size,
              data: Uint8Array.from(file.buffer),
            },
          });
      await tx.fuelAuditLog.create({
        data: {
          fuelEntryId: created.id,
          actorId: user.id,
          action: submitting ? 'SUBMITTED' : 'SAVED_DRAFT',
          entityType: 'FuelEntry',
          entityId: created.id,
          details:
            'Fuel entry created with historical vehicle, driver, allocation and trip snapshots.',
        },
      });
      return created;
    });
    return { data: entry };
  }

  async decide(id: string, dto: DecisionDto, user: SessionUser) {
    const entry = await this.prisma.fuelEntry.findUnique({
      where: { id },
      include: {
        approvals: { where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    if (!entry) throw new NotFoundException('Fuel entry not found.');
    const current = entry.approvals[0];
    if (!current) throw new BadRequestException('This fuel entry is not awaiting approval.');
    if (dto.decision === 'REJECT' && !dto.comment)
      throw new BadRequestException('A rejection reason is required.');
    return this.prisma.$transaction(async (tx) => {
      const recordedDecision = await tx.fuelApproval.updateMany({
        where: { id: current.id, status: 'PENDING' },
        data: {
          status: dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          comment: dto.comment || null,
          actorId: user.id,
          actedAt: new Date(),
        },
      });
      if (recordedDecision.count !== 1)
        throw new BadRequestException('This fuel entry has already been reviewed.');
      if (dto.decision === 'REJECT') {
        await tx.fuelEntry.update({
          where: { id },
          data: { approvalStatus: 'REJECTED', entryStatus: 'REJECTED' },
        });
      } else {
        await tx.fuelEntry.update({
          where: { id },
          data: { approvalStatus: 'APPROVED', entryStatus: 'APPROVED', approvedAt: new Date() },
        });
      }
      await tx.fuelAuditLog.create({
        data: {
          fuelEntryId: id,
          actorId: user.id,
          action: dto.decision,
          entityType: 'FuelEntry',
          entityId: id,
          details: dto.comment || null,
        },
      });
      return {
        data: await tx.fuelEntry.findUniqueOrThrow({ where: { id }, include: entryInclude }),
      };
    });
  }

  async dashboard(query: Record<string, string> = {}) {
    const requestedDays = Number(query.days || 30);
    const days = Number.isFinite(requestedDays)
      ? Math.min(3650, Math.max(1, Math.floor(requestedDays)))
      : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const entries = await this.prisma.fuelEntry.findMany({
      where: { approvalStatus: { in: RECORDED_STATUSES }, fuelingAt: { gte: since } },
      select: {
        totalAmount: true,
        dispensedLitres: true,
        kmPerLitre: true,
        costPerKm: true,
        vehicleId: true,
        departmentName: true,
        fuelingAt: true,
      },
    });
    const alerts = await this.prisma.fuelAlert.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const totalSpend = entries.reduce((sum, entry) => sum + Number(entry.totalAmount), 0);
    const totalLitres = entries.reduce((sum, entry) => sum + Number(entry.dispensedLitres), 0);
    const average = (key: 'kmPerLitre' | 'costPerKm') => {
      const values = entries
        .map((entry) => entry[key])
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .map(Number);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    };
    const vehiclesOverBaseline = await this.prisma.fuelEntry.count({
      where: {
        baselineVariancePct: { lt: -10 },
        approvalStatus: { in: RECORDED_STATUSES },
        fuelingAt: { gte: since },
      },
    });
    const approvalQueue = await this.prisma.fuelEntry.findMany({
      where: { approvalStatus: { in: REVIEWABLE_STATUSES } },
      include: entryInclude,
      orderBy: { submittedAt: 'asc' },
      take: 20,
    });
    return {
      data: {
        period: { days, from: since, to: new Date() },
        metrics: {
          totalSpend: DECIMAL(totalSpend, 2),
          totalLitres: DECIMAL(totalLitres, 3),
          averageConsumption: DECIMAL(average('kmPerLitre')),
          averageCostPerKm: DECIMAL(average('costPerKm')),
          vehiclesOverBaseline,
          openAlerts: alerts.length,
        },
        alerts,
        approvalQueue,
      },
    };
  }

  async comparison(query: Record<string, string>) {
    const from = validDate(query.from) ?? new Date(Date.now() - 90 * 24 * 60 * 60_000);
    const to = validDate(query.to) ?? new Date();
    if (query.to) to.setHours(23, 59, 59, 999);
    const filter = {
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
      ...(query.fuelType ? { fuelType: query.fuelType } : {}),
    };
    const [fuelEntries, trips, allocations, vehicles, drivers] = await Promise.all([
      this.prisma.fuelEntry.findMany({
        where: { ...filter, fuelingAt: { gte: from, lte: to }, entryStatus: { not: 'DRAFT' } },
        orderBy: { fuelingAt: 'desc' },
        take: 1000,
        select: {
          id: true,
          entryNumber: true,
          fuelingAt: true,
          stationName: true,
          fuelType: true,
          vehicleId: true,
          driverId: true,
          dispensedLitres: true,
          pricePerLitre: true,
          totalAmount: true,
          currentOdometer: true,
          distanceTravelled: true,
          tripDistance: true,
          kmPerLitre: true,
          approvalStatus: true,
          vehicle: {
            select: {
              registrationNumber: true,
              manufacturer: true,
              model: true,
              vehicleType: { select: { name: true } },
            },
          },
          driver: { select: { staffName: true, employeeId: true, category: true } },
        },
      }),
      this.prisma.trip.findMany({
        where: { ...filter, startedAt: { gte: from, lte: to } },
        orderBy: { startedAt: 'desc' },
        take: 1000,
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          calculatedDistance: true,
          vehicleId: true,
          driverId: true,
          vehicle: { select: { registrationNumber: true } },
          driver: { select: { staffName: true, employeeId: true, category: true } },
        },
      }),
      this.prisma.vehicleAllocation.findMany({
        where: { ...filter, startAt: { lte: to }, expectedEndAt: { gte: from } },
        orderBy: { startAt: 'desc' },
        take: 1000,
        select: {
          id: true,
          status: true,
          purpose: true,
          startAt: true,
          expectedEndAt: true,
          vehicleId: true,
          driverId: true,
          vehicle: { select: { registrationNumber: true } },
          driver: { select: { staffName: true, employeeId: true, category: true } },
          trip: { select: { calculatedDistance: true, status: true } },
        },
      }),
      this.prisma.vehicle.findMany({
        orderBy: { registrationNumber: 'asc' },
        select: { id: true, registrationNumber: true, manufacturer: true, model: true },
      }),
      this.prisma.driver.findMany({
        orderBy: { staffName: 'asc' },
        select: { id: true, staffName: true, employeeId: true, category: true },
      }),
    ]);
    const litres = fuelEntries.reduce((sum, row) => sum + Number(row.dispensedLitres), 0);
    const spend = fuelEntries.reduce((sum, row) => sum + Number(row.totalAmount), 0);
    const tripDistance = trips.reduce((sum, row) => sum + Number(row.calculatedDistance ?? 0), 0);
    const odometerDistance = fuelEntries.reduce(
      (sum, row) => sum + Number(row.distanceTravelled ?? 0),
      0,
    );
    return {
      data: {
        period: { from, to },
        metrics: {
          fuelRecords: fuelEntries.length,
          litres: DECIMAL(litres, 3),
          spend: DECIMAL(spend, 2),
          tripDistance: DECIMAL(tripDistance, 2),
          odometerDistance: DECIMAL(odometerDistance, 2),
          kmPerLitre: litres ? DECIMAL(tripDistance / litres, 2) : null,
        },
        vehicles,
        drivers,
        fuelEntries,
        trips,
        allocations,
      },
    };
  }

  async cards() {
    return {
      data: await this.prisma.fuelCard.findMany({
        include: {
          vehicle: { select: { registrationNumber: true } },
          driver: { select: { staffName: true } },
          transactions: { orderBy: { transactionAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
  async createCard(dto: FuelCardDto, user: SessionUser) {
    const card = await this.prisma.fuelCard.create({
      data: {
        ...dto,
        cardNumber: dto.cardNumber.replace(/\s/g, ''),
        maskedNumber: mask(dto.cardNumber),
        issueDate: new Date(dto.issueDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });
    await this.audit(user.id, 'CREATED', 'FuelCard', card.id);
    return { data: card };
  }
  async createPrice(dto: FuelPriceDto, user: SessionUser) {
    const price = await this.prisma.fuelPrice.create({
      data: { ...dto, effectiveDate: new Date(dto.effectiveDate) },
    });
    await this.audit(user.id, 'CREATED', 'FuelPrice', price.id);
    return { data: price };
  }
  async saveBaseline(vehicleId: string, dto: BaselineDto, user: SessionUser) {
    const baseline = await this.prisma.vehicleFuelBaseline.upsert({
      where: { vehicleId },
      create: { vehicleId, ...dto },
      update: dto,
    });
    await this.audit(user.id, 'SAVED', 'VehicleFuelBaseline', baseline.id);
    return { data: baseline };
  }

  private async resolveContext(dto: CreateFuelEntryDto, user: SessionUser, manager: boolean) {
    const currentDriver = await this.prisma.driver.findUnique({
      where: { employeeId: user.employeeId },
    });
    const selectedDriver =
      manager && dto.driverId
        ? await this.prisma.driver.findUnique({ where: { id: dto.driverId } })
        : currentDriver;
    if (!selectedDriver)
      throw new BadRequestException('Your account is not linked to a driver profile.');
    if (!dto.vehicleId && !dto.allocationId)
      throw new BadRequestException('Select the vehicle that was fueled.');
    const allocation = dto.allocationId
      ? await this.prisma.vehicleAllocation.findUnique({
          where: { id: dto.allocationId },
          include: {
            vehicle: true,
            driver: true,
            trip: true,
            assignedBy: { select: { staffName: true } },
          },
        })
      : await this.prisma.vehicleAllocation.findFirst({
          where: {
            driverId: selectedDriver.id,
            vehicleId: dto.vehicleId,
          },
          orderBy: { startAt: 'desc' },
          include: {
            vehicle: true,
            driver: true,
            trip: true,
            assignedBy: { select: { staffName: true } },
          },
        });
    if (allocation && !manager && allocation.driverId !== selectedDriver.id)
      throw new BadRequestException('Drivers can only submit fuel records under their own name.');
    const vehicle =
      allocation?.vehicle ??
      (dto.vehicleId
        ? await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } })
        : null);
    if (!vehicle) throw new NotFoundException('Vehicle not found.');
    return {
      allocation,
      vehicle,
      driver: allocation?.driver ?? selectedDriver,
      trip: dto.tripId
        ? await this.prisma.trip.findUnique({ where: { id: dto.tripId } })
        : (allocation?.trip ?? null),
    };
  }

  private async validateEntry(input: {
    dto: CreateFuelEntryDto;
    context: Awaited<ReturnType<FuelService['resolveContext']>>;
    approvedPrice: { pricePerLitre: unknown; tolerancePct: unknown } | null;
    baseline: { tankCapacityLitres: unknown; acceptableTolerancePct: unknown } | null;
    total: number;
    baselineVariancePct: number | null;
    distance: number | null;
  }) {
    const alerts: { alertType: string; severity: string; message: string }[] = [];
    if (
      input.dto.receiptNumber &&
      (await this.prisma.fuelEntry.findFirst({ where: { receiptNumber: input.dto.receiptNumber } }))
    )
      alerts.push({
        alertType: 'DUPLICATE_RECEIPT',
        severity: 'HIGH',
        message: 'This receipt number is already used by another fuel entry.',
      });
    if (
      input.baseline?.tankCapacityLitres &&
      input.dto.dispensedLitres > Number(input.baseline.tankCapacityLitres)
    )
      alerts.push({
        alertType: 'TANK_CAPACITY',
        severity: 'HIGH',
        message: 'Dispensed litres exceed the vehicle fuel tank baseline.',
      });
    if (input.approvedPrice) {
      const approved = Number(input.approvedPrice.pricePerLitre);
      const tolerance = Number(input.approvedPrice.tolerancePct);
      if (input.dto.pricePerLitre > approved * (1 + tolerance / 100))
        alerts.push({
          alertType: 'PRICE_VARIANCE',
          severity: 'HIGH',
          message: 'Entered price exceeds the approved state/station fuel-price tolerance.',
        });
    }
    if (
      input.baselineVariancePct !== null &&
      input.baseline?.acceptableTolerancePct &&
      Math.abs(input.baselineVariancePct) > Number(input.baseline.acceptableTolerancePct)
    )
      alerts.push({
        alertType: 'BASELINE_VARIANCE',
        severity: 'WARNING',
        message: 'Fuel efficiency differs materially from the vehicle baseline.',
      });
    if (
      input.distance !== null &&
      input.distance > 0 &&
      input.dto.gpsDistance !== undefined &&
      Math.abs(input.distance - input.dto.gpsDistance) > Math.max(5, input.distance * 0.3)
    )
      alerts.push({
        alertType: 'GPS_MISMATCH',
        severity: 'WARNING',
        message: 'Odometer/trip distance materially differs from supplied GPS distance.',
      });
    if (input.dto.fuelCardId)
      await this.validateCard(
        input.dto.fuelCardId,
        input.context,
        input.total,
        input.dto.fuelType,
        input.dto.state ?? '',
      );
    return alerts;
  }

  private async validateCard(
    cardId: string,
    context: Awaited<ReturnType<FuelService['resolveContext']>>,
    amount: number,
    fuelType: string,
    state: string,
  ) {
    const card = await this.prisma.fuelCard.findUnique({ where: { id: cardId } });
    if (!card || card.status !== 'ACTIVE' || (card.expiryDate && card.expiryDate < new Date()))
      throw new BadRequestException('Fuel coupon is inactive, suspended, or expired.');
    if (
      (card.vehicleId && card.vehicleId !== context.vehicle.id) ||
      (card.driverId && card.driverId !== context.driver.id)
    )
      throw new BadRequestException(
        'Fuel coupon is not assigned to this historical vehicle and driver allocation.',
      );
    if (card.transactionLimit && amount > Number(card.transactionLimit))
      throw new BadRequestException('Fuel amount exceeds this coupon’s maximum redemption value.');
    if (
      card.allowedFuelTypes &&
      !card.allowedFuelTypes
        .toLowerCase()
        .split(',')
        .map((item) => item.trim())
        .includes(fuelType.toLowerCase())
    )
      throw new BadRequestException('This fuel type is not permitted by the fuel coupon.');
    if (
      card.allowedStates &&
      !card.allowedStates
        .toLowerCase()
        .split(',')
        .map((item) => item.trim())
        .includes(state.toLowerCase())
    )
      throw new BadRequestException('This state is not permitted by the fuel coupon.');
  }

  private async requireDriver(user: SessionUser) {
    const driver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId } });
    if (!driver) throw new BadRequestException('Your account is not linked to a driver profile.');
    return driver;
  }
  private async nameOf(model: 'department' | 'directorate' | 'location', id: string) {
    if (model === 'department')
      return (
        (await this.prisma.department.findUnique({ where: { id }, select: { name: true } }))
          ?.name ?? null
      );
    if (model === 'directorate')
      return (
        (await this.prisma.directorate.findUnique({ where: { id }, select: { name: true } }))
          ?.name ?? null
      );
    return (
      (await this.prisma.location.findUnique({ where: { id }, select: { name: true } }))?.name ??
      null
    );
  }
  private async audit(actorId: string, action: string, entityType: string, entityId: string) {
    await this.prisma.fuelAuditLog.create({ data: { actorId, action, entityType, entityId } });
  }
}

function mask(value: string) {
  const digits = value.replace(/\s/g, '');
  return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
function validDate(value?: string) {
  if (!value) return null;
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}
