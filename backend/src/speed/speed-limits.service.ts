import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SpeedLimitSource = 'VEHICLE_TYPE' | 'GLOBAL';

@Injectable()
export class SpeedLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async settings() {
    return (await this.prisma.fleetSpeedSetting.findFirst({ orderBy: { updatedAt: 'desc' } }))
      ?? this.prisma.fleetSpeedSetting.create({ data: {} });
  }

  async resolveEffectiveSpeedLimit(vehicleId: string) {
    const [settings, vehicle] = await Promise.all([
      this.settings(),
      this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true, vehicleTypeId: true, vehicleType: { select: { speedLimit: true } } },
      }),
    ]);
    if (!vehicle) throw new NotFoundException('Vehicle not found.');
    if (vehicle.vehicleType?.speedLimit != null) return { limit: vehicle.vehicleType.speedLimit, source: 'VEHICLE_TYPE' as const, settings, vehicleTypeId: vehicle.vehicleTypeId };
    return { limit: settings.defaultSpeedLimit, source: 'GLOBAL' as const, settings, vehicleTypeId: vehicle.vehicleTypeId };
  }

  async updateSettings(data: Record<string, unknown>, userId: string) {
    const current = await this.settings();
    const numbers = [
      'defaultSpeedLimit', 'graceSpeed', 'minimumViolationDurationSeconds', 'recoveryDurationSeconds',
      'alertCooldownMinutes', 'lowSeverityMaxExcess', 'mediumSeverityMaxExcess', 'highSeverityMaxExcess',
      'maximumAllowedSpeedLimit', 'staleAfterSeconds', 'readingRetentionDays',
    ];
    const update: Record<string, unknown> = { updatedById: userId };
    for (const key of numbers) {
      if (data[key] === undefined) continue;
      const value = Number(data[key]);
      if (!Number.isFinite(value) || value < 0) throw new BadRequestException(`${key} must be a valid positive number.`);
      update[key] = value;
    }
    if (data.alertsEnabled !== undefined) update.alertsEnabled = Boolean(data.alertsEnabled);
    if (data.speedUnit !== undefined) {
      const unit = String(data.speedUnit).toUpperCase();
      if (!['KMH', 'MPH'].includes(unit)) throw new BadRequestException('Speed unit must be KMH or MPH.');
      update.speedUnit = unit;
    }
    const merged = { ...current, ...update } as typeof current;
    if (!(merged.lowSeverityMaxExcess < merged.mediumSeverityMaxExcess && merged.mediumSeverityMaxExcess < merged.highSeverityMaxExcess))
      throw new BadRequestException('Severity thresholds must increase from low to critical.');
    if (merged.defaultSpeedLimit > merged.maximumAllowedSpeedLimit) throw new BadRequestException('Default limit cannot exceed the maximum allowed limit.');
    return this.prisma.fleetSpeedSetting.update({ where: { id: current.id }, data: update });
  }

  async updateVehicleType(id: string, speedLimit: number | null) {
    await this.validateLimit(speedLimit);
    return this.prisma.vehicleType.update({ where: { id }, data: { speedLimit } });
  }

  async updateVehicle(id: string, customSpeedLimit: number | null) {
    await this.validateLimit(customSpeedLimit);
    return this.prisma.vehicle.update({ where: { id }, data: { customSpeedLimit } });
  }

  private async validateLimit(value: number | null) {
    if (value == null) return;
    const settings = await this.settings();
    if (!Number.isFinite(value) || value <= 0 || value > settings.maximumAllowedSpeedLimit)
      throw new BadRequestException(`Speed limit must be between 1 and ${settings.maximumAllowedSpeedLimit} ${settings.speedUnit}.`);
  }
}

export function speedSeverity(excess: number, settings: {
  lowSeverityMaxExcess: number; mediumSeverityMaxExcess: number; highSeverityMaxExcess: number;
}) {
  if (excess <= settings.lowSeverityMaxExcess) return 'LOW';
  if (excess <= settings.mediumSeverityMaxExcess) return 'MEDIUM';
  if (excess <= settings.highSeverityMaxExcess) return 'HIGH';
  return 'CRITICAL';
}
