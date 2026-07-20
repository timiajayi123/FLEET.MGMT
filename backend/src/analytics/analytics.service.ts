import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AnalyticsFilters = { from?: Date; to?: Date; departmentId?: string; vehicleId?: string; driverId?: string; status?: string; search?: string };

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(filters: AnalyticsFilters) {
    const requestWhere = { createdAt: dateRange(filters), ...(filters.departmentId ? { departmentId: filters.departmentId } : {}) };
    const tripWhere = { requestId: { not: null }, createdAt: dateRange(filters), ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}), ...(filters.driverId ? { driverId: filters.driverId } : {}) };
    const [vehicles, availableVehicles, inUseVehicles, maintenanceVehicles, drivers, activeDrivers, requests, pendingRequests, approvedRequests, rejectedRequests, trips, completedTrips, activeTrips, requestRows, tripRows] = await Promise.all([
      this.prisma.vehicle.count(), this.prisma.vehicle.count({ where: { status: 'AVAILABLE' } }), this.prisma.vehicle.count({ where: { status: 'IN_USE' } }), this.prisma.vehicle.count({ where: { status: 'MAINTENANCE' } }),
      this.prisma.driver.count(), this.prisma.driver.count({ where: { status: 'IN_USE' } }), this.prisma.vehicleRequest.count({ where: requestWhere }), this.prisma.vehicleRequest.count({ where: { ...requestWhere, status: 'PENDING_APPROVAL' } }),
      this.prisma.vehicleRequest.count({ where: { ...requestWhere, status: { in: ['APPROVED', 'ALLOCATED'] } } }), this.prisma.vehicleRequest.count({ where: { ...requestWhere, status: 'REJECTED' } }),
      this.prisma.trip.count({ where: tripWhere }), this.prisma.trip.count({ where: { ...tripWhere, status: 'COMPLETED' } }), this.prisma.trip.count({ where: { ...tripWhere, status: 'IN_PROGRESS' } }),
      this.prisma.vehicleRequest.findMany({ where: requestWhere, select: { createdAt: true, status: true, purposeOfTrip: true, tripCategory: true, department: true } }),
      this.prisma.trip.findMany({ where: tripWhere, select: { startedAt: true, endedAt: true, calculatedDistance: true, maximumSpeed: true, averageSpeed: true, vehicle: { select: { registrationNumber: true } }, driver: { select: { staffName: true } } } }),
    ]);
    const completed = tripRows.filter((trip) => trip.startedAt && trip.endedAt);
    const averageTripDurationMinutes = completed.length ? completed.reduce((total, trip) => total + ((trip.endedAt!.getTime() - trip.startedAt!.getTime()) / 60000), 0) / completed.length : null;
    const distanceTravelled = tripRows.reduce((total, trip) => total + (trip.calculatedDistance ?? 0), 0);
    return {
      metrics: { vehicles, availableVehicles, inUseVehicles, maintenanceVehicles, drivers, activeDrivers, requests, pendingRequests, approvedRequests, rejectedRequests, trips, completedTrips, activeTrips, averageTripDurationMinutes, distanceTravelled },
      activity: groupByDate(requestRows.map((row) => ({ date: row.createdAt, value: 1 }))),
      requestStatus: counts(requestRows.map((row) => row.status)),
      tripPurpose: counts(requestRows.map((row) => row.tripCategory ?? row.purposeOfTrip)),
      requestsByDepartment: counts(requestRows.map((row) => row.department)),
      mostUsedVehicles: top(counts(tripRows.map((row) => row.vehicle.registrationNumber))),
      mostActiveDrivers: top(counts(tripRows.map((row) => row.driver.staffName))),
    };
  }

  async speed(filters: AnalyticsFilters, threshold = 100) {
    const history = await this.prisma.driverLocationHistory.findMany({
      where: { speed: { not: null }, recordedAt: dateRange(filters), ...(filters.driverId ? { driverId: filters.driverId } : {}), ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}), ...(filters.departmentId ? { trip: { request: { departmentId: filters.departmentId } } } : {}) },
      include: { driver: { select: { staffName: true } }, vehicle: { select: { registrationNumber: true } }, trip: { select: { id: true, request: { select: { requestNumber: true } } } } }, orderBy: { recordedAt: 'desc' }, take: 5000,
    });
    const valid = history.filter((point) => point.speed !== null && point.speed >= 0 && point.speed <= 250);
    const violations = valid.filter((point) => point.speed! > threshold);
    return { threshold, records: valid.length, averageSpeed: valid.length ? valid.reduce((sum, point) => sum + point.speed!, 0) / valid.length : null, maximumSpeed: valid.length ? Math.max(...valid.map((point) => point.speed!)) : null, violations: violations.map((point) => ({ id: point.id, speed: point.speed, recordedAt: point.recordedAt, latitude: point.latitude, longitude: point.longitude, driver: point.driver.staffName, vehicle: point.vehicle?.registrationNumber ?? null, trip: point.trip?.request?.requestNumber ?? point.tripId })), trend: valid.slice().reverse().map((point) => ({ recordedAt: point.recordedAt, speed: point.speed, driver: point.driver.staffName })) };
  }

  async report(filters: AnalyticsFilters) {
    const rows = await this.prisma.vehicleRequest.findMany({ where: { createdAt: dateRange(filters), ...(filters.status ? { status: filters.status } : {}), ...(filters.departmentId ? { departmentId: filters.departmentId } : {}), ...(filters.search ? { OR: [{ requestNumber: { contains: filters.search } }, { staffName: { contains: filters.search } }, { destination: { contains: filters.search } }] } : {}) }, include: { allocations: { include: { vehicle: { select: { registrationNumber: true } }, driver: { select: { staffName: true } } }, take: 1, orderBy: { createdAt: 'desc' } }, trips: { select: { status: true, calculatedDistance: true, maximumSpeed: true, averageSpeed: true, startedAt: true, endedAt: true }, take: 1, orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' }, take: 1000 });
    return { total: rows.length, data: rows };
  }
}

function dateRange(filters: AnalyticsFilters) { return filters.from || filters.to ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } : undefined; }
function counts(values: Array<string | null | undefined>) { const map = new Map<string, number>(); values.filter((value): value is string => Boolean(value)).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1)); return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); }
function top(rows: { label: string; value: number }[]) { return rows.slice(0, 8); }
function groupByDate(rows: { date: Date; value: number }[]) { const map = new Map<string, number>(); rows.forEach((row) => { const key = row.date.toISOString().slice(0, 10); map.set(key, (map.get(key) ?? 0) + row.value); }); return [...map].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)); }
