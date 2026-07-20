import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class AiService {
  constructor(private readonly analytics: AnalyticsService) {}

  async ask(message: string) {
    const question = message.trim().toLocaleLowerCase();
    const dashboard = await this.analytics.dashboard({ from: daysAgo(question.includes('week') ? 7 : 30) });
    if (/pending|awaiting/.test(question)) return response('Pending vehicle requests', `There are ${dashboard.metrics.pendingRequests} requests awaiting approval.`, [{ label: 'Pending requests', value: dashboard.metrics.pendingRequests }]);
    if (/completed|complete/.test(question) && /trip/.test(question)) return response('Completed trips', `${dashboard.metrics.completedTrips} trips were completed in the selected period.`, [{ label: 'Completed trips', value: dashboard.metrics.completedTrips }]);
    if (/unavailable|maintenance|in use/.test(question)) return response('Vehicle availability', `${dashboard.metrics.availableVehicles} vehicles are available, ${dashboard.metrics.inUseVehicles} are in use, and ${dashboard.metrics.maintenanceVehicles} are under maintenance.`, availability(dashboard.metrics));
    if (/official|non-official|purpose/.test(question)) return response('Trip purpose comparison', 'Request categories are based on the new Official / Non-Official selection.', dashboard.tripPurpose);
    if (/department/.test(question)) return response('Requests by department', 'These departments have the highest request volume in the selected period.', dashboard.requestsByDepartment.slice(0, 8));
    if (/vehicle.*usage|most.*vehicle/.test(question)) return response('Vehicle utilisation', 'Most-used vehicles are calculated from recorded request-backed trips.', dashboard.mostUsedVehicles);
    if (/driver.*active|most.*driver/.test(question)) return response('Driver activity', 'Most-active drivers are calculated from recorded request-backed trips.', dashboard.mostActiveDrivers);
    if (/speed|overspeed/.test(question)) { const speed = await this.analytics.speed({}, 100); return response('Driver speed events', `${speed.violations.length} recorded point(s) exceeded the configured 100 km/h threshold.`, [{ label: 'Speed violations', value: speed.violations.length }, { label: 'Maximum speed', value: speed.maximumSpeed === null ? 'No GPS speed data' : `${speed.maximumSpeed.toFixed(1)} km/h` }]); }
    return response('Fleet summary', `${dashboard.metrics.requests} vehicle requests, ${dashboard.metrics.activeTrips} active trips, and ${dashboard.metrics.completedTrips} completed trips were recorded in the selected period.`, [{ label: 'Requests', value: dashboard.metrics.requests }, { label: 'Active trips', value: dashboard.metrics.activeTrips }, { label: 'Completed trips', value: dashboard.metrics.completedTrips }, { label: 'Distance recorded', value: `${dashboard.metrics.distanceTravelled.toFixed(1)} km` }]);
  }
}
function daysAgo(days: number) { const date = new Date(); date.setUTCDate(date.getUTCDate() - (days - 1)); date.setUTCHours(0, 0, 0, 0); return date; }
function availability(metrics: { availableVehicles: number; inUseVehicles: number; maintenanceVehicles: number }) { return [{ label: 'Available', value: metrics.availableVehicles }, { label: 'In use', value: metrics.inUseVehicles }, { label: 'Maintenance', value: metrics.maintenanceVehicles }]; }
function response(title: string, text: string, table: { label: string; value: string | number }[]) { return { title, text, table, source: 'controlled fleet analytics' }; }
