import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DashboardUser = { id: string; employeeId: string; role: { code: string } };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: DashboardUser, days = 30) {
    if (user.role.code === 'DRIVER') return this.driverSummary(user);
    if (user.role.code === 'ST') return this.staffSummary(user, days);
    return this.adminSummary(days);
  }

  private async adminSummary(days: number) {
    const since = rangeStart(days);
    const [totalRequests, pendingRequests, approvedRequests, activeUsers, activeAllocations, completedTrips, recent, queue] = await Promise.all([
      this.prisma.vehicleRequest.count(),
      this.prisma.vehicleRequest.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.vehicleRequest.count({ where: { status: { in: ['APPROVED', 'ALLOCATED'] } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.vehicleAllocation.count({ where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] }, requestId: { not: null } } }),
      this.prisma.trip.count({ where: { status: 'COMPLETED', requestId: { not: null } } }),
      this.prisma.vehicleRequest.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.vehicleRequest.findMany({ where: { status: 'PENDING_APPROVAL' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, requestNumber: true, staffName: true, destination: true, createdAt: true } }),
    ]);
    const activity = activitySeries(days, since, recent.map((item) => item.createdAt));
    return {
      role: 'ADMIN',
      metrics: { totalRequests, pendingRequests, approvedRequests, activeUsers, activeAllocations, completedTrips },
      activity,
      approvalQueue: queue,
      notifications: queue.map((item) => ({ id: item.id, title: 'Vehicle request awaiting approval', message: `${item.requestNumber} · ${item.staffName} · ${item.destination}`, createdAt: item.createdAt })),
    };
  }

  private async staffSummary(user: DashboardUser, days: number) {
    const since = rangeStart(days);
    const [totalRequests, pendingRequests, approvedRequests, allocatedRequests, completedRequests, recent, latest] = await Promise.all([
      this.prisma.vehicleRequest.count({ where: { requesterId: user.id } }),
      this.prisma.vehicleRequest.count({ where: { requesterId: user.id, status: 'PENDING_APPROVAL' } }),
      this.prisma.vehicleRequest.count({ where: { requesterId: user.id, status: 'APPROVED' } }),
      this.prisma.vehicleRequest.count({ where: { requesterId: user.id, status: 'ALLOCATED' } }),
      this.prisma.vehicleRequest.count({ where: { requesterId: user.id, status: 'COMPLETED' } }),
      this.prisma.vehicleRequest.findMany({ where: { requesterId: user.id, createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.vehicleRequest.findMany({
        where: { requesterId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, requestNumber: true, destination: true, purposeOfTrip: true, status: true, createdAt: true, allocations: { take: 1, orderBy: { createdAt: 'desc' }, select: { driver: { select: { staffName: true, employeeId: true, phone: true } }, vehicle: { select: { registrationNumber: true, manufacturer: true, model: true } }, status: true } } },
      }),
    ]);
    return {
      role: 'STAFF',
      metrics: { totalRequests, pendingRequests, approvedRequests, allocatedRequests, completedRequests },
      activity: activitySeries(days, since, recent.map((item) => item.createdAt)),
      myRequests: latest,
      approvalQueue: [],
      notifications: latest.slice(0, 3).map((item) => ({ id: item.id, title: `Request ${item.status.toLowerCase().replaceAll('_', ' ')}`, message: `${item.requestNumber} · ${item.destination}`, createdAt: item.createdAt })),
    };
  }

  private async driverSummary(user: DashboardUser) {
    const driver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId } });
    if (!driver) {
      return { role: 'DRIVER', metrics: { totalAssignments: 0, completedTrips: 0, activeTrips: 0, upcomingAssignments: 0, totalDistance: 0 }, currentAssignment: null, recentTrips: [], approvalQueue: [], activity: [] };
    }
    const [totalAssignments, completedTrips, activeTrips, upcomingAssignments, trips, currentAssignment] = await Promise.all([
      this.prisma.vehicleAllocation.count({ where: { driverId: driver.id, requestId: { not: null } } }),
      this.prisma.trip.count({ where: { driverId: driver.id, status: 'COMPLETED', requestId: { not: null } } }),
      this.prisma.trip.count({ where: { driverId: driver.id, status: 'IN_PROGRESS', requestId: { not: null } } }),
      this.prisma.vehicleAllocation.count({ where: { driverId: driver.id, status: { in: ['ASSIGNED', 'ACCEPTED'] }, requestId: { not: null } } }),
      this.prisma.trip.findMany({
        where: { driverId: driver.id, requestId: { not: null } },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        include: { vehicle: { select: { registrationNumber: true, manufacturer: true, model: true } }, request: { select: { requestNumber: true, staffName: true, destination: true } }, allocation: { select: { purpose: true, destination: true } } },
      }),
      this.prisma.vehicleAllocation.findFirst({
        where: { driverId: driver.id, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] }, requestId: { not: null } },
        include: { vehicle: { select: { registrationNumber: true, manufacturer: true, model: true } }, request: { select: { requestNumber: true, staffName: true, destination: true } }, trip: true },
        orderBy: { startAt: 'asc' },
      }),
    ]);
    const totalDistance = trips.reduce((sum, trip) => sum + (trip.calculatedDistance ?? 0), 0);
    return {
      role: 'DRIVER',
      metrics: { totalAssignments, completedTrips, activeTrips, upcomingAssignments, totalDistance },
      currentAssignment,
      recentTrips: trips,
      approvalQueue: [],
      activity: [],
    };
  }
}

function rangeStart(days: number) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  return since;
}

function activitySeries(days: number, since: Date, dates: Date[]) {
  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  dates.forEach((date) => {
    const key = date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts].map(([date, count]) => ({ date, count }));
}
