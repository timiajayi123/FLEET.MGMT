import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { speedSeverity, SpeedLimitsService } from './speed-limits.service';

type Reading = { vehicleId: string; driverId?: string | null; tripId?: string | null; speedKmh: number; latitude: number; longitude: number; recordedAt: Date; source?: string };

@Injectable()
export class SpeedService {
  private retentionCounter = 0;
  constructor(private readonly prisma: PrismaService, private readonly limits: SpeedLimitsService) {}

  async processReading(input: Reading) {
    const resolved = await this.limits.resolveEffectiveSpeedLimit(input.vehicleId);
    const ageSeconds = Math.abs(Date.now() - input.recordedAt.getTime()) / 1000;
    if (!Number.isFinite(input.speedKmh) || input.speedKmh < 0 || input.speedKmh > 300 || ageSeconds > resolved.settings.staleAfterSeconds)
      return { ignored: true, reason: 'INVALID_OR_STALE_READING' };
    const threshold = resolved.limit + resolved.settings.graceSpeed;
    const overspeed = input.speedKmh > threshold;
    await this.prisma.speedReading.create({ data: {
      vehicleId: input.vehicleId, driverId: input.driverId, tripId: input.tripId, speed: input.speedKmh,
      latitude: input.latitude, longitude: input.longitude, recordedAt: input.recordedAt, source: input.source ?? 'PHONE_GPS',
      effectiveSpeedLimit: resolved.limit, limitSource: resolved.source, isOverspeeding: overspeed,
    } });
    const active = await this.prisma.speedViolation.findFirst({ where: { vehicleId: input.vehicleId, status: 'ACTIVE' }, orderBy: { startedAt: 'desc' } });
    let alert: Record<string, unknown> | undefined;
    if (overspeed) {
      const excess = input.speedKmh - resolved.limit;
      const severity = speedSeverity(excess, resolved.settings);
      if (active) {
        const updated = await this.prisma.speedViolation.update({ where: { id: active.id }, data: {
          recordedSpeed: input.speedKmh, maximumSpeed: Math.max(active.maximumSpeed, input.speedKmh), excessSpeed: excess,
          severity: severityRank(severity) > severityRank(active.severity) ? severity : active.severity,
          latitude: input.latitude, longitude: input.longitude, lastSeenAt: input.recordedAt,
          durationSeconds: Math.max(0, Math.round((input.recordedAt.getTime() - active.startedAt.getTime()) / 1000)),
        } });
        const canAlert = resolved.settings.alertsEnabled && severity === 'CRITICAL' &&
          (!updated.lastAlertedAt || input.recordedAt.getTime() - updated.lastAlertedAt.getTime() >= resolved.settings.alertCooldownMinutes * 60_000);
        if (canAlert) {
          await this.prisma.speedViolation.update({ where: { id: active.id }, data: { lastAlertedAt: input.recordedAt } });
          alert = this.alertPayload(updated);
        }
      } else {
        const windowStart = new Date(input.recordedAt.getTime() - resolved.settings.minimumViolationDurationSeconds * 1000);
        const first = await this.prisma.speedReading.findFirst({
          where: { vehicleId: input.vehicleId, isOverspeeding: true, recordedAt: { gte: windowStart, lte: input.recordedAt } },
          orderBy: { recordedAt: 'asc' },
        });
        if (first && input.recordedAt.getTime() - first.recordedAt.getTime() >= resolved.settings.minimumViolationDurationSeconds * 1000) {
          const created = await this.prisma.speedViolation.create({ data: {
            vehicleId: input.vehicleId, driverId: input.driverId, tripId: input.tripId, vehicleTypeId: resolved.vehicleTypeId,
            recordedSpeed: input.speedKmh, maximumSpeed: input.speedKmh, effectiveSpeedLimit: resolved.limit, excessSpeed: excess,
            severity, latitude: input.latitude, longitude: input.longitude, startedAt: first.recordedAt, lastSeenAt: input.recordedAt,
            durationSeconds: Math.round((input.recordedAt.getTime() - first.recordedAt.getTime()) / 1000),
            lastAlertedAt: resolved.settings.alertsEnabled ? input.recordedAt : null,
            audits: { create: { action: 'DETECTED', toStatus: 'ACTIVE', note: `Automatic ${severity.toLowerCase()} overspeed detection.` } },
          } });
          if (resolved.settings.alertsEnabled) alert = this.alertPayload(created);
        }
      }
    } else if (active && input.recordedAt.getTime() - active.lastSeenAt.getTime() >= resolved.settings.recoveryDurationSeconds * 1000) {
      await this.prisma.speedViolation.update({ where: { id: active.id }, data: {
        status: 'ENDED', endedAt: input.recordedAt,
        durationSeconds: Math.max(0, Math.round((active.lastSeenAt.getTime() - active.startedAt.getTime()) / 1000)),
        audits: { create: { action: 'AUTO_ENDED', fromStatus: 'ACTIVE', toStatus: 'ENDED', note: 'Vehicle remained below the overspeed threshold.' } },
      } });
    }
    if (++this.retentionCounter % 500 === 0) {
      const cutoff = new Date(Date.now() - resolved.settings.readingRetentionDays * 86_400_000);
      void this.prisma.speedReading.deleteMany({ where: { recordedAt: { lt: cutoff } } });
    }
    return { ignored: false, overspeed, effectiveSpeedLimit: resolved.limit, limitSource: resolved.source, alert };
  }

  async dashboard() {
    const now = new Date(); const today = new Date(now); today.setHours(0, 0, 0, 0);
    const [live, active, todayCount, criticalToday, totalToday] = await Promise.all([
      this.live(), this.prisma.speedViolation.count({ where: { status: 'ACTIVE' } }),
      this.prisma.speedViolation.count({ where: { startedAt: { gte: today } } }),
      this.prisma.speedViolation.count({ where: { startedAt: { gte: today }, severity: 'CRITICAL' } }),
      this.prisma.speedReading.count({ where: { recordedAt: { gte: today } } }),
    ]);
    const overspeedReadings = await this.prisma.speedReading.count({ where: { recordedAt: { gte: today }, isOverspeeding: true } });
    return { data: { activeViolations: active, violationsToday: todayCount, criticalToday, monitoredVehicles: live.data.length,
      complianceRate: totalToday ? Math.round((1 - overspeedReadings / totalToday) * 1000) / 10 : 100,
      severity: await this.prisma.speedViolation.groupBy({ by: ['severity'], where: { startedAt: { gte: today } }, _count: true }),
      recent: await this.prisma.speedViolation.findMany({ include: violationInclude, orderBy: { startedAt: 'desc' }, take: 8 }) }, generatedAt: now };
  }

  async live() {
    const settings = await this.limits.settings();
    const rows = await this.prisma.driverCurrentLocation.findMany({
      where: { trip: { status: 'IN_PROGRESS' } },
      include: { driver: { select: { id: true, staffName: true, employeeId: true } }, vehicle: { include: { vehicleType: true } }, trip: true },
      orderBy: { recordedAt: 'desc' },
    });
    return { data: rows.map((row) => {
      const limit = row.vehicle?.vehicleType?.speedLimit ?? settings.defaultSpeedLimit;
      const source = row.vehicle?.vehicleType?.speedLimit != null ? 'VEHICLE_TYPE' : 'GLOBAL';
      const speed = Math.round(Number(row.speed ?? 0) * 3.6 * 10) / 10;
      const stale = Date.now() - row.recordedAt.getTime() > settings.staleAfterSeconds * 1000;
      const state = stale ? 'OFFLINE' : speed > limit + settings.graceSpeed + settings.highSeverityMaxExcess ? 'CRITICAL' : speed > limit + settings.graceSpeed ? 'OVERSPEEDING' : speed >= limit * .9 ? 'NEAR_LIMIT' : 'NORMAL';
      return { ...row, speedKmh: speed, effectiveSpeedLimit: limit, limitSource: source, state };
    }), generatedAt: new Date() };
  }

  async violations(query: Record<string, string>) {
    const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: Prisma.SpeedViolationWhereInput = {
      status: query.status && query.status !== 'ALL' ? query.status : undefined,
      severity: query.severity && query.severity !== 'ALL' ? query.severity : undefined,
      vehicleId: query.vehicleId || undefined, driverId: query.driverId || undefined,
      startedAt: query.from || query.to ? { gte: validDate(query.from), lte: validDate(query.to, true) } : undefined,
      OR: query.search ? [{ vehicle: { registrationNumber: { contains: query.search } } }, { driver: { staffName: { contains: query.search } } }] : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.speedViolation.findMany({ where, include: violationInclude, orderBy: { startedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.speedViolation.count({ where }),
    ]);
    return { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async detail(id: string) {
    const violation = await this.prisma.speedViolation.findUnique({ where: { id }, include: { ...violationInclude, audits: { include: { actor: { select: { staffName: true, employeeId: true } } }, orderBy: { createdAt: 'asc' } } } });
    if (!violation) throw new NotFoundException('Speed violation not found.');
    const from = new Date(violation.startedAt.getTime() - 60_000); const to = new Date((violation.endedAt ?? violation.lastSeenAt).getTime() + 60_000);
    const readings = await this.prisma.speedReading.findMany({ where: { vehicleId: violation.vehicleId, recordedAt: { gte: from, lte: to } }, orderBy: { recordedAt: 'asc' }, take: 1000 });
    return { data: { ...violation, readings } };
  }

  async action(id: string, status: string, userId: string, note?: string) {
    if (!['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'].includes(status)) throw new BadRequestException('Invalid violation status.');
    const current = await this.prisma.speedViolation.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Speed violation not found.');
    return this.prisma.speedViolation.update({ where: { id }, data: {
      status, acknowledgedAt: status === 'ACKNOWLEDGED' ? new Date() : current.acknowledgedAt,
      acknowledgedById: status === 'ACKNOWLEDGED' ? userId : current.acknowledgedById, resolutionNote: note,
      endedAt: status === 'RESOLVED' || status === 'DISMISSED' ? (current.endedAt ?? new Date()) : current.endedAt,
      audits: { create: { actorId: userId, action: status, fromStatus: current.status, toStatus: status, note } },
    }, include: violationInclude });
  }

  async reports(from?: Date, to?: Date) {
    const where = { startedAt: { gte: from, lte: to } };
    const [bySeverity, byVehicle, byDriver, count] = await Promise.all([
      this.prisma.speedViolation.groupBy({ by: ['severity'], where, _count: true }),
      this.prisma.speedViolation.groupBy({ by: ['vehicleId'], where, _count: true, _max: { maximumSpeed: true }, orderBy: { _count: { vehicleId: 'desc' } }, take: 10 }),
      this.prisma.speedViolation.groupBy({ by: ['driverId'], where: { ...where, driverId: { not: null } }, _count: true, orderBy: { _count: { driverId: 'desc' } }, take: 10 }),
      this.prisma.speedViolation.count({ where }),
    ]);
    return { data: { count, bySeverity, topVehicles: byVehicle, topDrivers: byDriver } };
  }

  async driverSummary(driverId: string) {
    const [driver, trips, violations] = await Promise.all([
      this.prisma.driver.findUnique({ where: { id: driverId }, select: { id: true, staffName: true, employeeId: true } }),
      this.prisma.trip.count({ where: { driverId } }),
      this.prisma.speedViolation.findMany({ where: { driverId }, orderBy: { startedAt: 'desc' }, take: 1000 }),
    ]);
    if (!driver) throw new NotFoundException('Driver not found.');
    const weights: Record<string, number> = { LOW: 1, MEDIUM: 3, HIGH: 6, CRITICAL: 10 };
    const penalty = violations.reduce((sum, item) => sum + (weights[item.severity] ?? 1) + Math.min(5, item.durationSeconds / 60), 0);
    return { data: { driver, tripCount: trips, violationCount: violations.length, violationsPer100Trips: trips ? Math.round(violations.length / trips * 10000) / 100 : 0,
      safetyScore: Math.max(0, Math.round(100 - penalty)), scoringMethod: '100 minus severity penalties (1/3/6/10) and up to 5 points per violation duration.', recent: violations.slice(0, 10) } };
  }

  private alertPayload(item: { id: string; vehicleId: string; driverId: string | null; severity: string; recordedSpeed: number; effectiveSpeedLimit: number; latitude: number; longitude: number; startedAt: Date }) {
    return { type: 'OVERSPEED_ALERT', violationId: item.id, vehicleId: item.vehicleId, driverId: item.driverId, severity: item.severity, speed: item.recordedSpeed, limit: item.effectiveSpeedLimit, latitude: item.latitude, longitude: item.longitude, startedAt: item.startedAt };
  }
}

const violationInclude = {
  vehicle: { select: { id: true, registrationNumber: true, manufacturer: true, model: true } },
  driver: { select: { id: true, staffName: true, employeeId: true } },
  trip: { select: { id: true, status: true, allocationId: true } },
} as const;
function severityRank(value: string) { return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(value); }
function validDate(value?: string, end = false) { if (!value) return undefined; const date = new Date(value); if (Number.isNaN(date.getTime())) return undefined; if (end) date.setHours(23, 59, 59, 999); return date; }
