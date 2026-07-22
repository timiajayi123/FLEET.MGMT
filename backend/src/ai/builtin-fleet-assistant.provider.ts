import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import type { FleetAssistantContext, FleetAssistantProvider, FleetAssistantResponse } from './fleet-assistant.provider';

@Injectable()
export class BuiltinFleetAssistantProvider implements FleetAssistantProvider {
  readonly name = 'builtin' as const;
  constructor(private readonly analytics: AnalyticsService, private readonly prisma: PrismaService) {}
  isAvailable() { return true; }

  async ask(message: string, context: FleetAssistantContext): Promise<FleetAssistantResponse> {
    void context;
    const question = message.trim().toLocaleLowerCase();
    const dashboard = await this.analytics.dashboard({ from: daysAgo(question.includes('week') ? 7 : 30) });
    if (/last|latest|recent/.test(question) && /trip/.test(question)) return this.latestTrip();
    if (/pending|awaiting/.test(question) && /request/.test(question)) return this.pendingRequests();
    if (/report|export|download/.test(question)) return response('Vehicle request report', 'Open the reports workspace to filter, review and export live vehicle-request records as CSV.', [{ label: 'Available report', value: 'Vehicle requests' }, { label: 'Live records', value: String(dashboard.metrics.requests) }], { label: 'Open reports', href: '/analytics/reports' });
    if (/completed|complete/.test(question) && /trip/.test(question)) return response('Completed trips', `${dashboard.metrics.completedTrips} trips were completed in the selected period.`, [{ label: 'Completed trips', value: String(dashboard.metrics.completedTrips) }]);
    if (/unavailable|maintenance|in use/.test(question)) return response('Vehicle availability', `${dashboard.metrics.availableVehicles} vehicles are available, ${dashboard.metrics.inUseVehicles} are in use, and ${dashboard.metrics.maintenanceVehicles} are under maintenance.`, availability(dashboard.metrics));
    if (/official|non-official|purpose/.test(question)) return response('Trip purpose comparison', 'Request categories are based on the Official / Non-Official selection.', dashboard.tripPurpose);
    if (/department/.test(question)) return response('Requests by department', 'These departments have the highest request volume in the selected period.', dashboard.requestsByDepartment.slice(0, 8));
    if (/vehicle.*usage|most.*vehicle/.test(question)) return response('Vehicle utilisation', 'Most-used vehicles are calculated from recorded request-backed trips.', dashboard.mostUsedVehicles);
    if (/driver.*active|most.*driver/.test(question)) return response('Driver activity', 'Most-active drivers are calculated from recorded request-backed trips.', dashboard.mostActiveDrivers);
    if (/speed|overspeed/.test(question)) { const speed = await this.analytics.speed({}, 100); return response('Driver speed events', `${speed.violations.length} recorded point(s) exceeded the configured 100 km/h threshold.`, [{ label: 'Speed violations', value: String(speed.violations.length) }, { label: 'Maximum speed', value: speed.maximumSpeed === null ? 'No GPS speed data' : `${speed.maximumSpeed.toFixed(1)} km/h` }]); }
    if (/help|what can|can you do/.test(question)) return response('What I can answer', 'Ask about recent trips, pending requests, vehicle availability, most-used vehicles, active drivers, speed events, trip purpose, departments, or request reports.', [{ label: 'Example', value: 'What was the last trip?' }, { label: 'Example', value: 'Show pending vehicle requests' }, { label: 'Example', value: 'Generate a vehicle request report' }]);
    return response('Fleet summary', `${dashboard.metrics.requests} vehicle requests, ${dashboard.metrics.activeTrips} active trips, and ${dashboard.metrics.completedTrips} completed trips were recorded in the selected period. Try asking “What was the last trip?” or “Show pending vehicle requests” for a detailed answer.`, [{ label: 'Requests', value: String(dashboard.metrics.requests) }, { label: 'Active trips', value: String(dashboard.metrics.activeTrips) }, { label: 'Completed trips', value: String(dashboard.metrics.completedTrips) }, { label: 'Distance recorded', value: `${dashboard.metrics.distanceTravelled.toFixed(1)} km` }]);
  }

  private async latestTrip(): Promise<FleetAssistantResponse> {
    const trip = await this.prisma.trip.findFirst({ where: { requestId: { not: null } }, orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }], include: { vehicle: { select: { registrationNumber: true, manufacturer: true, model: true } }, driver: { select: { staffName: true } }, request: { select: { requestNumber: true, destination: true } } } });
    if (!trip) return response('Latest trip', 'No request-backed trips have been recorded yet.', []);
    return response('Latest trip', `${trip.driver.staffName} completed the most recently recorded trip using ${trip.vehicle.registrationNumber} (${trip.vehicle.manufacturer} ${trip.vehicle.model})${trip.request?.destination ? ` to ${trip.request.destination}` : ''}.`, [{ label: 'Request', value: trip.request?.requestNumber ?? '—' }, { label: 'Driver', value: trip.driver.staffName }, { label: 'Vehicle', value: trip.vehicle.registrationNumber }, { label: 'Status', value: trip.status.replaceAll('_', ' ') }, { label: 'Started', value: trip.startedAt?.toLocaleString() ?? 'Not recorded' }, { label: 'Ended', value: trip.endedAt?.toLocaleString() ?? 'Not recorded' }, { label: 'Distance', value: `${(trip.calculatedDistance ?? 0).toFixed(1)} km` }]);
  }

  private async pendingRequests(): Promise<FleetAssistantResponse> {
    const requests = await this.prisma.vehicleRequest.findMany({ where: { status: 'PENDING_APPROVAL' }, orderBy: { createdAt: 'asc' }, take: 8, select: { requestNumber: true, staffName: true, destination: true, priority: true } });
    if (!requests.length) return response('Pending vehicle requests', 'There are no vehicle requests awaiting approval.', []);
    return response('Pending vehicle requests', `${requests.length} request${requests.length === 1 ? '' : 's'} are awaiting approval. The oldest requests are shown below.`, requests.map((request) => ({ label: request.requestNumber, value: `${request.staffName} · ${request.destination} · ${request.priority}` })), { label: 'Review requests', href: '/fleet/vehicle-requests/review' });
  }
}

function daysAgo(days: number) { const date = new Date(); date.setUTCDate(date.getUTCDate() - (days - 1)); date.setUTCHours(0, 0, 0, 0); return date; }
function availability(metrics: { availableVehicles: number; inUseVehicles: number; maintenanceVehicles: number }) { return [{ label: 'Available', value: String(metrics.availableVehicles) }, { label: 'In use', value: String(metrics.inUseVehicles) }, { label: 'Maintenance', value: String(metrics.maintenanceVehicles) }]; }
function response(title: string, text: string, table: Array<{ label: string; value: string | number }>, action: FleetAssistantResponse['action'] = null): FleetAssistantResponse { return { title, text, table: table.map((row) => ({ label: row.label, value: String(row.value) })), action }; }
