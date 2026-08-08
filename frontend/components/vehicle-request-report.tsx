'use client';

import {
  Award,
  BarChart3,
  CarFront,
  ChevronLeft,
  ClipboardList,
  Fuel,
  Gauge,
  Route,
  Users,
  Wrench,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './page-header';

type ReportKind =
  | 'requests'
  | 'trips'
  | 'drivers'
  | 'driver-performance'
  | 'speed'
  | 'utilisation'
  | 'maintenance'
  | 'fuel';
type Row = Record<string, unknown>;
type DisplayRow = Record<string, string | number>;
type ReportVehicle = {
  registrationNumber?: string;
  manufacturer?: string;
  model?: string;
  vehicleType?: { name?: string } | null;
};

const reports: {
  kind: ReportKind;
  title: string;
  description: string;
  icon: typeof ClipboardList;
  available: boolean;
}[] = [
  {
    kind: 'requests',
    title: 'Vehicle Request Report',
    description: 'Requests, approval status, destinations and allocations.',
    icon: ClipboardList,
    available: true,
  },
  {
    kind: 'trips',
    title: 'Trip Report',
    description: 'Request-backed trips, dates, distance, vehicle and driver.',
    icon: Route,
    available: true,
  },
  {
    kind: 'drivers',
    title: 'Driver Activity Report',
    description: 'Driver trip participation and completed-trip counts.',
    icon: Users,
    available: true,
  },
  {
    kind: 'driver-performance',
    title: 'Driver Performance Report',
    description: 'Trip completion, distance, ratings and safe-driving performance by driver.',
    icon: Award,
    available: true,
  },
  {
    kind: 'fuel',
    title: 'Fuel Recorded and Distance Covered',
    description: 'Fuel spend, litres, distance covered and efficiency by driver and vehicle.',
    icon: Fuel,
    available: true,
  },
  {
    kind: 'utilisation',
    title: 'Vehicle Utilisation Report',
    description: 'Most-used vehicles based on completed and active trips.',
    icon: CarFront,
    available: true,
  },
  {
    kind: 'maintenance',
    title: 'Maintenance Report',
    description: 'Fault reports, vehicle decisions, serviceability and admin remarks.',
    icon: Wrench,
    available: true,
  },
  {
    kind: 'speed',
    title: 'Speed Violation Report',
    description: 'Recorded speed-limit events from valid GPS points.',
    icon: Gauge,
    available: true,
  },
];

export function VehicleRequestReport() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReport = searchParams.get('report');
  const selected = reports.some((report) => report.kind === requestedReport)
    ? (requestedReport as ReportKind)
    : null;
  const active = reports.find((report) => report.kind === selected);
  return selected && active ? (
    <ReportDetail report={active} onBack={() => router.push('/analytics/reports')} />
  ) : (
    <ReportHub onSelect={(kind) => router.push(`/analytics/reports?report=${kind}`)} />
  );
}

function ReportHub({ onSelect }: { onSelect: (kind: ReportKind) => void }) {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Choose a live fleet report to review, filter, and export."
      />
      <section className="report-hub-grid">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <button
              key={report.kind}
              className="report-hub-card"
              disabled={!report.available}
              onClick={() => onSelect(report.kind)}
            >
              <span className="report-hub-icon">
                <Icon size={22} />
              </span>
              <strong>{report.title}</strong>
              <p>{report.description}</p>
              <small>{report.available ? 'Open report' : 'Not available yet'}</small>
            </button>
          );
        })}
      </section>
    </>
  );
}

function ReportDetail({
  report,
  onBack,
}: {
  report: (typeof reports)[number];
  onBack: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [duration, setDuration] = useState('90');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});
  const endpoint = useMemo(
    () => endpointFor(report.kind, status, search, from, to, extraFilters),
    [extraFilters, from, report.kind, search, status, to],
  );
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));
    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Unable to load report.');
        return payload;
      })
      .then((payload) => setRows(normalise(report.kind, payload)))
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [endpoint, report.kind]);
  const visibleRows =
    report.kind === 'fuel' && search.trim()
      ? rows.filter((row) =>
          JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase()),
        )
      : rows;
  function changeDuration(value: string) {
    setDuration(value);
    if (value === 'custom') return;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Number(value));
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }
  function exportCsv() {
    const formatted = formatRows(report.kind, visibleRows);
    if (!formatted.length) return;
    const keys = Object.keys(formatted[0]);
    const csv = [keys, ...formatted.map((row) => keys.map((key) => row[key]))]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.kind}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeader
        title={report.title}
        description={report.description}
        actions={
          <div className="report-header-actions">
            <button className="secondary-action" onClick={onBack}>
              <ChevronLeft size={16} /> All reports
            </button>
            <button className="secondary-action" onClick={exportCsv} disabled={!visibleRows.length}>
              Generate report
            </button>
          </div>
        }
      />
      <section className="panel report-sheet">
        <div className="report-filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search report"
          />
          {report.kind === 'requests' && (
            <>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="PENDING_APPROVAL">Pending approval</option>
              <option value="APPROVED">Approved</option>
              <option value="ALLOCATED">Allocated</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
            {[
              ['department', 'Department'],
              ['purpose', 'Purpose'],
              ['destination', 'Destination'],
            ].map(([key, label]) => (
              <select key={key} aria-label={`Filter by ${label}`} value={extraFilters[key] ?? ''} onChange={(event) => setExtraFilters((current) => ({ ...current, [key]: event.target.value }))}>
                <option value="">All {label.toLowerCase()}s</option>
                {key === 'purpose'
                  ? <><option value="Official">Official</option><option value="Non-Official">Non-Official</option></>
                  : [...new Set(rows.map((row) => String(row[key] ?? '')).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            ))}
            </>
          )}
          {report.kind === 'maintenance' && <>
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{[...new Set(rows.map((row) => String(row.status ?? '')).filter(Boolean))].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>
            <select value={extraFilters.issueType ?? ''} onChange={(event) => setExtraFilters((current) => ({ ...current, issueType: event.target.value }))}><option value="">All issue types</option>{[...new Set(rows.map((row) => String(row.issueType ?? '')).filter(Boolean))].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select value={extraFilters.reportedById ?? ''} onChange={(event) => setExtraFilters((current) => ({ ...current, reportedById: event.target.value }))}><option value="">All reporters</option>{peopleFromRows(rows, 'reportedBy').map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
            <select value={extraFilters.reviewedById ?? ''} onChange={(event) => setExtraFilters((current) => ({ ...current, reviewedById: event.target.value }))}><option value="">All reviewers</option>{peopleFromRows(rows, 'reviewedBy').map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
          </>}
          {report.kind === 'driver-performance' && (
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All driver statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          )}
          <DateRangeControls duration={duration} changeDuration={changeDuration} from={from} to={to} setFrom={setFrom} setTo={setTo} />
          {report.kind === 'fuel' && (
            <>
              <select value={extraFilters.fuelType ?? ''} onChange={(event) => setExtraFilters((current) => ({ ...current, fuelType: event.target.value }))}>
                <option value="">All fuel types</option>
                {[...new Set(rows.map((row) => String(row.fuelType ?? '')).filter(Boolean))].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </>
          )}
          <span className="report-total">
            {visibleRows.length} record{visibleRows.length === 1 ? '' : 's'}
          </span>
        </div>
        {error && <div className="master-alert">{error}</div>}
        {loading ? (
          <p>Loading live report…</p>
        ) : (
          <ReportTable kind={report.kind} rows={visibleRows} />
        )}
      </section>
    </>
  );
}

function DateRangeControlsLegacy({ duration, changeDuration, from, to, setFrom, setTo }: { duration: string; changeDuration: (value: string) => void; from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }) {
  return <>
    <select aria-label="Report date range" value={duration} onChange={(event) => changeDuration(event.target.value)}>
      <option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option><option value="365">Last 1 year</option><option value="730">Last 2 years</option><option value="custom">Custom dates</option>
    </select>
    {duration === 'custom' && <><input type="date" aria-label="Report start date" value={from} onChange={(event) => { setFrom(event.target.value); }} /><input type="date" aria-label="Report end date" value={to} onChange={(event) => { setTo(event.target.value); }} /></>}
  </>;
}

function DateRangeControls({ duration, changeDuration, from, to, setFrom, setTo }: { duration: string; changeDuration: (value: string) => void; from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }) {
  return <><select aria-label="Report date range" value={duration} onChange={(event) => changeDuration(event.target.value)}><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option><option value="365">Last 1 year</option><option value="730">Last 2 years</option><option value="custom">Custom dates</option></select>{duration === 'custom' && <><input type="date" aria-label="Report start date" value={from} onChange={(event) => setFrom(event.target.value)} /><input type="date" aria-label="Report end date" value={to} onChange={(event) => setTo(event.target.value)} /></>}</>;
}

function endpointFor(kind: ReportKind, status: string, search: string, from: string, to: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  Object.entries(extra).forEach(([key, value]) => value && params.set(key, value));
  if (kind === 'fuel') return `/api/fuel/comparison?${params}`;
  if (kind === 'requests') return `/api/analytics/reports/vehicle-requests?${params}`;
  if (kind === 'maintenance') return `/api/analytics/reports/maintenance?${params}`;
  if (kind === 'driver-performance') return `/api/analytics/reports/driver-performance?${params}`;
  if (kind === 'trips' || kind === 'drivers') return `/api/trips?${params}`;
  if (kind === 'speed') return '/api/analytics/speed?threshold=100';
  return '/api/analytics/dashboard';
}
function normalise(kind: ReportKind, payload: Record<string, unknown>): Row[] {
  if (kind === 'fuel')
    return (payload.data as { fuelEntries?: Row[] } | undefined)?.fuelEntries ?? [];
  if (kind === 'requests' || kind === 'trips' || kind === 'maintenance' || kind === 'driver-performance')
    return (payload.data as Row[] | undefined) ?? [];
  if (kind === 'speed') return (payload.violations as Row[] | undefined) ?? [];
  if (kind === 'drivers') {
    const trips =
      (payload.data as { driver?: { staffName?: string } | null; status: string }[] | undefined) ??
      [];
    const map = new Map<string, { driver: string; allocatedTrips: number; completedTrips: number }>();
    trips.forEach((trip) => {
      const driver = trip.driver?.staffName ?? 'Unassigned driver';
      const row = map.get(driver) ?? { driver, allocatedTrips: 0, completedTrips: 0 };
      row.allocatedTrips++;
      if (trip.status === 'COMPLETED') row.completedTrips++;
      map.set(driver, row);
    });
    return [...map.values()];
  }
  return (payload.mostUsedVehicles as Row[] | undefined) ?? [];
}
function peopleFromRows(rows: Row[], key: 'reportedBy' | 'reviewedBy') {
  const people = rows.map((row) => row[key] as { id?: string; staffName?: string } | null | undefined).filter((person): person is { id: string; staffName: string } => Boolean(person?.id && person.staffName));
  return [...new Map(people.map((person) => [person.id, { id: person.id, name: person.staffName }])).values()];
}
function formatRows(kind: ReportKind, rows: Row[]): DisplayRow[] {
  return rows.map((row, index): DisplayRow => {
    if (kind === 'fuel') {
      const vehicle = row.vehicle as ReportVehicle | undefined;
      const driver = row.driver as { staffName?: string; employeeId?: string } | undefined;
      return {
        'S/N': index + 1,
        'FUEL ENTRY': cell(row.entryNumber),
        DATE: dateTime(row.fuelingAt),
        VEHICLE: vehicleLabel(vehicle),
        DRIVER: driver?.staffName ?? '',
        'DRIVER ID': driver?.employeeId ?? '',
        STATION: cell(row.stationName),
        'FUEL TYPE': cell(row.fuelType),
        'LITRES (L)': cell(row.dispensedLitres),
        'PRICE/LITRE': cell(row.pricePerLitre),
        'TOTAL SPEND': cell(row.totalAmount),
        'CURRENT ODOMETER (KM)': cell(row.currentOdometer),
        'PREVIOUS ODOMETER (KM)': cell(row.previousOdometer),
        'DISTANCE SINCE FUEL (KM)': cell(row.distanceTravelled),
        'RECORDED TRIP DISTANCE (KM)': cell(row.tripDistance),
        'EFFICIENCY (KM/L)': cell(row.kmPerLitre),
        STATUS: cell(row.approvalStatus),
      };
    }
    if (kind === 'requests') {
      const allocation = (
        row.allocations as { vehicle?: ReportVehicle; driver?: { staffName: string } }[] | undefined
      )?.[0];
      return {
        'S/N': index + 1,
        'REQUEST NUMBER': cell(row.requestNumber),
        'STAFF NAME': cell(row.staffName),
        DEPARTMENT: cell(row.department),
        PURPOSE: cell(row.purposeOfTrip),
        DESTINATION: cell(row.destination),
        STATUS: cell(row.status),
        'DEPARTURE DATE': dateTime(row.departureDate),
        'RETURN DATE': dateTime(row.expectedReturnDate),
        VEHICLE: vehicleLabel(allocation?.vehicle),
        DRIVER: allocation?.driver?.staffName ?? '',
      };
    }
    if (kind === 'maintenance') {
      const vehicle = row.vehicle as ReportVehicle | undefined;
      const reporter = row.reportedBy as { staffName?: string; employeeId?: string } | undefined;
      const reviewer = row.reviewedBy as { staffName?: string } | undefined;
      return {
        'S/N': index + 1,
        VEHICLE: vehicleLabel(vehicle),
        'REPORTED BY': reporter?.staffName ?? '',
        'DRIVER ID': reporter?.employeeId ?? '',
        'ISSUE TYPE': cell(row.issueType),
        'ISSUE DESCRIPTION': cell(row.issueDescription),
        'PHOTO ATTACHED': row.evidenceMimeType ? 'Yes' : 'No',
        'ISSUE DATE': dateTime(row.issueOccurredAt),
        STATUS: String(cell(row.status)).replaceAll('_', ' '),
        SERVICEABILITY: String(cell(row.serviceability)).replaceAll('_', ' '),
        'ADMIN REMARK': cell(row.adminRemark),
        'REVIEWED BY': reviewer?.staffName ?? '',
        'REVIEW DATE': dateTime(row.reviewedAt),
      };
    }
    if (kind === 'trips') {
      const vehicle = row.vehicle as ReportVehicle | undefined;
      const driver = row.driver as { staffName?: string } | undefined;
      return {
        Status: cell(row.status),
        Vehicle: vehicleLabel(vehicle),
        'DISTANCE/KM': typeof row.calculatedDistance === 'number' ? row.calculatedDistance.toFixed(2) : cell(row.calculatedDistance),
        Driver: driver?.staffName ?? '',
        'STAFF NAME': cell((row.request as { staffName?: string } | undefined)?.staffName ?? row.staffName ?? driver?.staffName),
        'DESTINATION FROM': cell((row.request as { location?: string; customPickupLocation?: string } | undefined)?.customPickupLocation ?? (row.request as { location?: string } | undefined)?.location ?? row.location ?? row.customPickupLocation),
        'DESTINATION TO': cell((row.request as { destination?: string; customDestination?: string } | undefined)?.customDestination ?? (row.request as { destination?: string } | undefined)?.destination ?? row.destination ?? row.customDestination ?? (row.allocation as { destination?: string } | undefined)?.destination),
        Started: dateTime(row.startedAt),
        Ended: dateTime(row.endedAt),
      };
    }
    if (kind === 'driver-performance') {
      return {
        'S/N': index + 1,
        DRIVER: cell(row.staffName),
        'DRIVER ID': cell(row.employeeId),
        LOCATION: cell(row.location),
        STATUS: String(cell(row.status)).replaceAll('_', ' '),
        'ALLOCATED TRIPS': cell(row.allocatedTrips),
        'COMPLETED TRIPS': cell(row.completedTrips),
        'COMPLETION RATE': `${Number(row.completionRate ?? 0).toFixed(1)}%`,
        'DISTANCE/KM': Number(row.totalDistance ?? 0).toFixed(2),
        RATING: row.averageRating ? `${Number(row.averageRating).toFixed(1)} / 5` : 'Not rated',
        'RATING COUNT': cell(row.ratingCount),
        'SPEED VIOLATIONS': cell(row.violations),
        'SAFETY SCORE': `${Number(row.safetyScore ?? 0).toFixed(1)}%`,
        'PERFORMANCE SCORE': `${Number(row.performanceScore ?? 0).toFixed(1)}%`,
      };
    }
    if (kind === 'speed') {
      return {
        'S/N': index + 1,
        VEHICLE:
          vehicleLabel(row.vehicleDetails as ReportVehicle | undefined) ||
          String(row.vehicle ?? ''),
        DRIVER: cell(row.driver),
        'SPEED (KM/H)': cell(row.speed),
        'LIMIT (KM/H)': cell(row.limit ?? row.effectiveSpeedLimit),
        'EXCESS (KM/H)': cell(row.excessSpeed),
        SEVERITY: cell(row.severity),
        STATUS: cell(row.status),
        'RECORDED DATE': dateTime(row.recordedAt),
        TRIP: cell(row.trip),
      };
    }
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cell(value)]));
  });
}
function cell(value: unknown): string | number {
  return typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? /^\d{4}-\d{2}-\d{2}T/.test(value)
        ? dateTime(value)
        : value
      : value === null || value === undefined
        ? ''
        : String(value);
}
function dateTime(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const two = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
function vehicleLabel(vehicle?: ReportVehicle) {
  if (!vehicle) return '';
  const manufacturer = vehicle.manufacturer?.trim() ?? '';
  const selectedType = vehicle.vehicleType?.name?.trim() || vehicle.model?.trim() || 'Vehicle';
  const fullType =
    manufacturer && !selectedType.toLowerCase().startsWith(manufacturer.toLowerCase())
      ? `${manufacturer} ${selectedType}`
      : selectedType;
  return [vehicle.registrationNumber, fullType].filter(Boolean).join(' - ');
}
function ReportTable({ kind, rows }: { kind: ReportKind; rows: Row[] }) {
  const formatted = formatRows(kind, rows);
  if (!formatted.length)
    return (
      <div className="master-empty">
        <BarChart3 size={28} />
        <h2>No report data</h2>
        <p>No matching live records are available for this report.</p>
      </div>
    );
  const columns = Object.keys(formatted[0]);
  return (
    <div className="report-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {formatted.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{String(row[column] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
