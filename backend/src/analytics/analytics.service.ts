import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AnalyticsFilters = {
  from?: Date;
  to?: Date;
  departmentId?: string;
  vehicleId?: string;
  driverId?: string;
  status?: string;
  search?: string;
  department?: string;
  purpose?: string;
  destination?: string;
  issueType?: string;
  reportedById?: string;
  reviewedById?: string;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(filters: AnalyticsFilters) {
    const requestWhere = {
      createdAt: dateRange(filters),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.department ? { department: { contains: filters.department } } : {}),
      ...(filters.purpose ? { OR: [{ purposeOfTrip: { contains: filters.purpose } }, { tripCategory: { contains: filters.purpose } }] } : {}),
      ...(filters.destination ? { destination: { contains: filters.destination } } : {}),
    };
    const tripWhere = {
      createdAt: dateRange(filters),
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.driverId ? { driverId: filters.driverId } : {}),
    };
    const [
      vehicles,
      availableVehicles,
      inUseVehicles,
      maintenanceVehicles,
      drivers,
      activeDrivers,
      requests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      trips,
      completedTrips,
      activeTrips,
      requestRows,
      tripRows,
    ] = await Promise.all([
      this.prisma.vehicle.count(),
      this.prisma.vehicle.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.vehicle.count({ where: { status: 'IN_USE' } }),
      this.prisma.vehicle.count({ where: { status: 'MAINTENANCE' } }),
      this.prisma.driver.count(),
      this.prisma.driver.count({ where: { status: 'IN_USE' } }),
      this.prisma.vehicleRequest.count({ where: requestWhere }),
      this.prisma.vehicleRequest.count({ where: { ...requestWhere, status: 'PENDING_APPROVAL' } }),
      this.prisma.vehicleRequest.count({
        where: { ...requestWhere, status: { in: ['APPROVED', 'ALLOCATED'] } },
      }),
      this.prisma.vehicleRequest.count({ where: { ...requestWhere, status: 'REJECTED' } }),
      this.prisma.trip.count({ where: tripWhere }),
      this.prisma.trip.count({ where: { ...tripWhere, status: 'COMPLETED' } }),
      this.prisma.trip.count({ where: { ...tripWhere, status: 'IN_PROGRESS' } }),
      this.prisma.vehicleRequest.findMany({
        where: requestWhere,
        select: {
          createdAt: true,
          status: true,
          purposeOfTrip: true,
          tripCategory: true,
          department: true,
        },
      }),
      this.prisma.trip.findMany({
        where: tripWhere,
        select: {
          createdAt: true,
          startedAt: true,
          endedAt: true,
          calculatedDistance: true,
          maximumSpeed: true,
          averageSpeed: true,
          vehicle: {
            select: {
              registrationNumber: true,
              manufacturer: true,
              model: true,
              vehicleType: { select: { name: true } },
            },
          },
          driver: { select: { staffName: true } },
        },
      }),
    ]);
    const completed = tripRows.filter((trip) => trip.startedAt && trip.endedAt);
    const averageTripDurationMinutes = completed.length
      ? completed.reduce(
          (total, trip) => total + (trip.endedAt!.getTime() - trip.startedAt!.getTime()) / 60000,
          0,
        ) / completed.length
      : null;
    const distanceTravelled = tripRows.reduce(
      (total, trip) => total + (trip.calculatedDistance ?? 0),
      0,
    );
    return {
      metrics: {
        vehicles,
        availableVehicles,
        inUseVehicles,
        maintenanceVehicles,
        drivers,
        activeDrivers,
        requests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        trips,
        completedTrips,
        activeTrips,
        averageTripDurationMinutes,
        distanceTravelled,
      },
      activity: groupByDate(requestRows.map((row) => ({ date: row.createdAt, value: 1 }))),
      driverActivity: groupByDate(tripRows.map((row) => ({ date: row.createdAt, value: 1 }))),
      distanceActivity: groupByDate(
        tripRows.map((row) => ({ date: row.createdAt, value: row.calculatedDistance ?? 0 })),
      ),
      tripDistances: tripRows
        .filter((row) => row.calculatedDistance !== null)
        .map((row) => ({
          recordedAt: row.endedAt ?? row.startedAt ?? row.createdAt,
          distance: row.calculatedDistance ?? 0,
          driver: row.driver?.staffName ?? 'Unassigned driver',
          vehicle: row.vehicle.registrationNumber,
        })),
      requestStatus: counts(requestRows.map((row) => row.status)),
      tripPurpose: counts(
        requestRows.map((row) => normaliseTripPurpose(row.tripCategory ?? row.purposeOfTrip)),
      ),
      requestsByDepartment: counts(requestRows.map((row) => row.department)),
      mostUsedVehicles: top(
        counts(
          tripRows.map((row) => {
            const vehicleName =
              (row.vehicle.vehicleType?.name ??
                [row.vehicle.manufacturer, row.vehicle.model].filter(Boolean).join(' ')) ||
              'Vehicle';
            return `${row.vehicle.registrationNumber} - ${vehicleName}`;
          }),
        ),
      ),
      mostActiveDrivers: top(
        counts(tripRows.map((row) => row.driver?.staffName ?? 'Unassigned driver')),
      ),
    };
  }

  async speed(filters: AnalyticsFilters, threshold = 100) {
    const history = await this.prisma.driverLocationHistory.findMany({
      where: {
        speed: { not: null },
        recordedAt: dateRange(filters),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.issueType ? { issueType: filters.issueType } : {}),
        ...(filters.reportedById ? { reportedById: filters.reportedById } : {}),
        ...(filters.reviewedById ? { reviewedById: filters.reviewedById } : {}),
        ...(filters.departmentId
          ? { trip: { request: { departmentId: filters.departmentId } } }
          : {}),
      },
      include: {
        driver: { select: { staffName: true } },
        vehicle: {
          select: {
            registrationNumber: true,
            manufacturer: true,
            model: true,
            vehicleType: { select: { name: true } },
          },
        },
        trip: { select: { id: true, request: { select: { requestNumber: true } } } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 5000,
    });
    const valid = history.filter(
      (point) => point.speed !== null && point.speed >= 0 && point.speed <= 250,
    );
    const violations = valid.filter((point) => point.speed! > threshold);
    return {
      threshold,
      records: valid.length,
      averageSpeed: valid.length
        ? valid.reduce((sum, point) => sum + point.speed!, 0) / valid.length
        : null,
      maximumSpeed: valid.length ? Math.max(...valid.map((point) => point.speed!)) : null,
      violations: violations.map((point) => ({
        id: point.id,
        speed: point.speed,
        recordedAt: point.recordedAt,
        latitude: point.latitude,
        longitude: point.longitude,
        driver: point.driver?.staffName ?? 'Unassigned driver',
        vehicle: point.vehicle?.registrationNumber ?? null,
        vehicleDetails: point.vehicle,
        trip: point.trip?.request?.requestNumber ?? point.tripId,
      })),
      trend: valid
        .slice()
        .reverse()
        .map((point) => ({
          recordedAt: point.recordedAt,
          speed: point.speed,
          driver: point.driver?.staffName ?? 'Unassigned driver',
          vehicle: point.vehicle?.registrationNumber ?? 'Unassigned vehicle',
        })),
    };
  }

  async report(filters: AnalyticsFilters) {
    const rows = await this.prisma.vehicleRequest.findMany({
      where: {
        createdAt: dateRange(filters),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.department ? { department: { contains: filters.department } } : {}),
        ...(filters.purpose ? { OR: [{ purposeOfTrip: { contains: filters.purpose } }, { tripCategory: { contains: filters.purpose } }] } : {}),
        ...(filters.destination ? { destination: { contains: filters.destination } } : {}),
        ...(filters.search
          ? {
              OR: [
                { requestNumber: { contains: filters.search } },
                { staffName: { contains: filters.search } },
                { destination: { contains: filters.search } },
              ],
            }
          : {}),
      },
      include: {
        allocations: {
          include: {
            vehicle: {
              select: {
                registrationNumber: true,
                manufacturer: true,
                model: true,
                vehicleType: { select: { name: true } },
              },
            },
            driver: { select: { staffName: true } },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        trips: {
          select: {
            status: true,
            calculatedDistance: true,
            maximumSpeed: true,
            averageSpeed: true,
            startedAt: true,
            endedAt: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return { total: rows.length, data: rows };
  }

  async tripReport(filters: AnalyticsFilters) {
    const completedAt = dateRange(filters);
    const [allocations, standaloneTrips] = await Promise.all([
      this.prisma.vehicleAllocation.findMany({
        where: {
          requestId: { not: null },
          status: 'COMPLETED',
          actualEndAt: completedAt,
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters.driverId ? { driverId: filters.driverId } : {}),
          ...(filters.search
            ? {
                OR: [
                  { request: { requestNumber: { contains: filters.search } } },
                  { request: { staffName: { contains: filters.search } } },
                  { request: { destination: { contains: filters.search } } },
                  { driver: { staffName: { contains: filters.search } } },
                  { vehicle: { registrationNumber: { contains: filters.search } } },
                ],
              }
            : {}),
        },
        include: {
          trip: true,
          driver: { select: { id: true, staffName: true, employeeId: true } },
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              manufacturer: true,
              model: true,
              vehicleType: { select: { name: true } },
            },
          },
          request: {
            select: {
              id: true,
              requestNumber: true,
              staffName: true,
              employeeId: true,
              department: true,
              purposeOfTrip: true,
              location: true,
              destination: true,
              customPickupLocation: true,
              customDestination: true,
              departureDate: true,
              expectedReturnDate: true,
            },
          },
        },
        orderBy: [{ actualEndAt: 'desc' }, { createdAt: 'desc' }],
        take: 1000,
      }),
      this.prisma.trip.findMany({
        where: {
          requestId: null,
          status: 'COMPLETED',
          endedAt: completedAt,
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters.driverId ? { driverId: filters.driverId } : {}),
          ...(filters.search
            ? {
                OR: [
                  { driver: { staffName: { contains: filters.search } } },
                  { vehicle: { registrationNumber: { contains: filters.search } } },
                ],
              }
            : {}),
        },
        include: {
          driver: { select: { id: true, staffName: true, employeeId: true } },
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              manufacturer: true,
              model: true,
              vehicleType: { select: { name: true } },
            },
          },
          allocation: {
            select: {
              id: true,
              destination: true,
              purpose: true,
              startAt: true,
              expectedEndAt: true,
              actualStartAt: true,
              actualEndAt: true,
            },
          },
        },
        orderBy: [{ endedAt: 'desc' }, { createdAt: 'desc' }],
        take: 1000,
      }),
    ]);
    const requestJourneys = allocations.map((allocation) => ({
      id: allocation.trip?.id ?? allocation.id,
      status: 'COMPLETED',
      calculatedDistance: allocation.trip?.calculatedDistance ?? null,
      maximumSpeed: allocation.trip?.maximumSpeed ?? null,
      averageSpeed: allocation.trip?.averageSpeed ?? null,
      startedAt: allocation.trip?.startedAt ?? allocation.actualStartAt ?? allocation.startAt,
      endedAt: allocation.trip?.endedAt ?? allocation.actualEndAt ?? allocation.expectedEndAt,
      vehicle: allocation.vehicle,
      driver: allocation.driver,
      request: allocation.request,
      allocation: {
        id: allocation.id,
        destination: allocation.destination,
        purpose: allocation.purpose,
        startAt: allocation.startAt,
        expectedEndAt: allocation.expectedEndAt,
        actualStartAt: allocation.actualStartAt,
        actualEndAt: allocation.actualEndAt,
      },
    }));
    const data = [...requestJourneys, ...standaloneTrips].sort(
      (first, second) =>
        new Date(second.endedAt ?? 0).getTime() - new Date(first.endedAt ?? 0).getTime(),
    );
    return { total: data.length, data };
  }

  async maintenanceReport(filters: AnalyticsFilters) {
    const rows = await this.prisma.maintenanceRequest.findMany({
      where: {
        createdAt: dateRange(filters),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.issueType ? { issueType: filters.issueType } : {}),
        ...(filters.reportedById ? { reportedById: filters.reportedById } : {}),
        ...(filters.reviewedById ? { reviewedById: filters.reviewedById } : {}),
        ...(filters.search
          ? {
              OR: [
                { issueType: { contains: filters.search } },
                { issueDescription: { contains: filters.search } },
                { vehicle: { registrationNumber: { contains: filters.search } } },
                { reportedBy: { staffName: { contains: filters.search } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        issueType: true,
        issueDescription: true,
        issueOccurredAt: true,
        evidenceMimeType: true,
        status: true,
        serviceability: true,
        adminRemark: true,
        createdAt: true,
        reviewedAt: true,
        vehicle: {
          select: {
            registrationNumber: true,
            manufacturer: true,
            model: true,
            vehicleType: { select: { name: true } },
          },
        },
        reportedBy: { select: { id: true, staffName: true, employeeId: true } },
        reviewedBy: { select: { id: true, staffName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return { total: rows.length, data: rows };
  }

  async driverPerformance(filters: AnalyticsFilters) {
    const driverWhere = {
      ...(filters.driverId ? { id: filters.driverId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { staffName: { contains: filters.search } },
              { employeeId: { contains: filters.search } },
            ],
          }
        : {}),
    };
    const [drivers, allocationGroups, distanceGroups, ratingGroups, violationGroups] = await Promise.all([
      this.prisma.driver.findMany({
        where: driverWhere,
        select: {
          id: true,
          staffName: true,
          employeeId: true,
          status: true,
          locationText: true,
          location: { select: { name: true } },
        },
        orderBy: { staffName: 'asc' },
      }),
      this.prisma.vehicleAllocation.groupBy({
        by: ['driverId', 'status'],
        where: {
          requestId: { not: null },
          status: { not: 'CANCELLED' },
          startAt: dateRange(filters),
          ...(filters.driverId ? { driverId: filters.driverId } : {}),
        },
        _count: { _all: true },
      }),
      this.prisma.trip.groupBy({
        by: ['driverId'],
        where: {
          createdAt: dateRange(filters),
          ...(filters.driverId ? { driverId: filters.driverId } : {}),
        },
        _sum: { calculatedDistance: true },
      }),
      this.prisma.driverRating.groupBy({
        by: ['driverId'],
        where: {
          createdAt: dateRange(filters),
          ...(filters.driverId ? { driverId: filters.driverId } : {}),
        },
        _count: { _all: true },
        _avg: { stars: true },
      }),
      this.prisma.speedViolation.groupBy({
        by: ['driverId', 'severity'],
        where: {
          driverId: { not: null },
          startedAt: dateRange(filters),
          ...(filters.driverId ? { driverId: filters.driverId } : {}),
        },
        _count: { _all: true },
      }),
    ]);
    const ratings = new Map(
      ratingGroups.map((row) => [
        row.driverId,
        { average: row._avg.stars, count: row._count._all },
      ]),
    );
    const severityWeights: Record<string, number> = {
      LOW: 1,
      MEDIUM: 3,
      HIGH: 6,
      CRITICAL: 10,
    };
    const rows = drivers.map((driver) => {
      const driverAllocations = allocationGroups.filter((row) => row.driverId === driver.id);
      const allocatedTrips = driverAllocations.reduce((sum, row) => sum + row._count._all, 0);
      const completedTrips = driverAllocations
        .filter((row) => row.status === 'COMPLETED')
        .reduce((sum, row) => sum + row._count._all, 0);
      const totalDistance = Number(
        distanceGroups.find((row) => row.driverId === driver.id)?._sum.calculatedDistance ?? 0,
      );
      const driverViolations = violationGroups.filter((row) => row.driverId === driver.id);
      const violations = driverViolations.reduce((sum, row) => sum + row._count._all, 0);
      const violationPenalty = driverViolations.reduce(
        (sum, row) => sum + row._count._all * (severityWeights[row.severity] ?? 1),
        0,
      );
      const completionRate = allocatedTrips ? (completedTrips / allocatedTrips) * 100 : 0;
      const safetyScore = Math.max(0, 100 - violationPenalty);
      const rating = ratings.get(driver.id);
      const ratingScore = rating?.average ? (rating.average / 5) * 100 : completionRate;
      const performanceScore =
        allocatedTrips || rating?.count
          ? completionRate * 0.5 + ratingScore * 0.3 + safetyScore * 0.2
          : 0;
      return {
        ...driver,
        location: driver.location?.name ?? driver.locationText ?? 'Not set',
        allocatedTrips,
        completedTrips,
        completionRate: round(completionRate, 1),
        totalDistance: round(totalDistance, 2),
        averageRating: rating?.average ? round(rating.average, 1) : null,
        ratingCount: rating?.count ?? 0,
        violations,
        safetyScore: round(safetyScore, 1),
        performanceScore: round(performanceScore, 1),
      };
    }).sort((first, second) =>
      second.performanceScore - first.performanceScore ||
      second.completedTrips - first.completedTrips ||
      first.staffName.localeCompare(second.staffName),
    );
    const activeRows = rows.filter((row) => row.allocatedTrips > 0);
    const totalAllocated = rows.reduce((sum, row) => sum + row.allocatedTrips, 0);
    const totalCompleted = rows.reduce((sum, row) => sum + row.completedTrips, 0);
    const totalRatings = rows.reduce((sum, row) => sum + row.ratingCount, 0);
    const weightedRating = rows.reduce(
      (sum, row) => sum + (row.averageRating ?? 0) * row.ratingCount,
      0,
    );
    return {
      summary: {
        totalDrivers: rows.length,
        activeDrivers: activeRows.length,
        completionRate: round(totalAllocated ? (totalCompleted / totalAllocated) * 100 : 0, 1),
        averageRating: totalRatings ? round(weightedRating / totalRatings, 1) : null,
        safetyScore: activeRows.length
          ? round(activeRows.reduce((sum, row) => sum + row.safetyScore, 0) / activeRows.length, 1)
          : 100,
      },
      data: rows,
    };
  }

  async latestTripSummary() {
    const trip = await this.prisma.trip.findFirst({
      where: { requestId: { not: null } },
      orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        status: true,
        startedAt: true,
        endedAt: true,
        calculatedDistance: true,
        vehicle: { select: { registrationNumber: true } },
      },
    });
    if (!trip) return { available: false };
    return {
      available: true,
      vehicle: trip.vehicle.registrationNumber,
      status: trip.status,
      startedAt: trip.startedAt?.toISOString() ?? null,
      endedAt: trip.endedAt?.toISOString() ?? null,
      distanceKm: Number((trip.calculatedDistance ?? 0).toFixed(1)),
    };
  }
}

function dateRange(filters: AnalyticsFilters) {
  return filters.from || filters.to
    ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) }
    : undefined;
}
function counts(values: Array<string | null | undefined>) {
  const map = new Map<string, number>();
  values
    .filter((value): value is string => Boolean(value))
    .forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
function top(rows: { label: string; value: number }[]) {
  return rows.slice(0, 8);
}
function normaliseTripPurpose(value?: string | null) {
  const purpose = value?.trim().toLowerCase();
  if (purpose === 'official') return 'Official';
  if (purpose === 'non-official' || purpose === 'non official') return 'Non-Official';
  return null;
}
function groupByDate(rows: { date: Date; value: number }[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + row.value);
  });
  return [...map]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
