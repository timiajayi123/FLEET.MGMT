'use client';

import { PageHeader } from '@/components/page-header';
import {
  loadGoogleMaps,
  type GoogleMap,
  type GoogleMapsNamespace,
  type GoogleMarker,
} from '@/lib/google-maps';
import { BarChart3, CarFront, ClipboardList, MapPin, Navigation, Search, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Trip = {
  id: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  calculatedDistance?: number;
  maximumSpeed?: number;
  averageSpeed?: number;
  allocation: {
    id: string;
    status: string;
    startAt: string;
    expectedEndAt: string;
    actualStartAt?: string;
    actualEndAt?: string;
    destination?: string;
    purpose: string;
  };
  request?: {
    id: string;
    requestNumber: string;
    staffName: string;
    employeeId: string;
    department: string;
    directorate: string;
    purposeOfTrip: string;
    destination: string;
    status: string;
    departureDate: string;
    expectedReturnDate: string;
  };
  vehicle: {
    id: string;
    registrationNumber: string;
    manufacturer: string;
    model: string;
    vehicleType?: { name: string } | null;
  };
  driver: { id: string; staffName: string; employeeId: string; phone?: string };
  _count: { locationHistory: number };
};

export default function TripsPage() {
  const [items, setItems] = useState<Trip[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [error, setError] = useState('');
  const [replayTrip, setReplayTrip] = useState<Trip | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch('/api/trips', { cache: 'no-store' })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || 'Unable to load trip history.');
          setItems(payload.data ?? []);
        })
        .catch((err: Error) => setError(err.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = useMemo(() => {
    const needle = query.toLowerCase();
    return items.filter((trip) => {
      const text = [
        trip.request?.requestNumber,
        trip.request?.staffName,
        trip.driver.staffName,
        trip.driver.employeeId,
        trip.vehicle.registrationNumber,
        trip.vehicle.manufacturer,
        trip.vehicle.model,
        trip.allocation.destination,
        trip.allocation.purpose,
      ].filter(Boolean).join(' ').toLowerCase();
      const tripDate = (trip.startedAt || trip.allocation.startAt).slice(0, 10);
      return (!needle || text.includes(needle))
        && (status === 'ALL' || trip.status === status || trip.allocation.status === status)
        && (!dateFilter || tripDate === dateFilter)
        && (!destinationFilter || (trip.allocation.destination || trip.request?.destination) === destinationFilter)
        && (!driverFilter || trip.driver.id === driverFilter)
        && (!staffFilter || trip.request?.employeeId === staffFilter)
        && (!departmentFilter || trip.request?.department === departmentFilter);
    });
  }, [dateFilter, departmentFilter, destinationFilter, driverFilter, items, query, staffFilter, status]);

  const completed = items.filter((trip) => trip.status === 'COMPLETED').length;
  const inProgress = items.filter((trip) => trip.status === 'IN_PROGRESS').length;
  const totalDistance = items.reduce((sum, trip) => sum + (trip.calculatedDistance ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Trip History"
        description="Completed and active trips created from approved vehicle request allocations."
        actions={<span className="date-chip"><Navigation size={15} /> Request-backed trips</span>}
      />
      {error && <div className="master-alert">{error}</div>}
      <section className="fleet-summary trip-history-summary">
        <article><strong>{items.length}</strong><span>Total trips</span></article>
        <article className="green"><strong>{completed}</strong><span>Completed</span></article>
        <article className="yellow"><strong>{inProgress}</strong><span>In progress</span></article>
        <article><strong>{totalDistance.toFixed(2)} km</strong><span>Recorded distance</span></article>
      </section>
      <section className="fleet-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, staff, driver, vehicle or destination" /></label>
        <div className="trip-history-filters">
        <input aria-label="Filter trips by date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}/>
        <select aria-label="Filter trips by destination" value={destinationFilter} onChange={(event) => setDestinationFilter(event.target.value)}><option value="">All destinations</option>{unique(items.map((trip) => trip.allocation.destination || trip.request?.destination)).map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Filter trips by driver" value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option value="">All drivers</option>{uniqueRecords(items.map((trip) => ({ id: trip.driver.id, label: trip.driver.staffName }))).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
        <select aria-label="Filter trips by requesting staff" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}><option value="">All staff</option>{uniqueRecords(items.flatMap((trip) => trip.request ? [{ id: trip.request.employeeId, label: trip.request.staffName }] : [])).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
        <select aria-label="Filter trips by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="">All departments</option>{unique(items.map((trip) => trip.request?.department)).map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Filter trips by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button type="button" className="secondary-action" onClick={() => { setDateFilter(''); setDestinationFilter(''); setDriverFilter(''); setStaffFilter(''); setDepartmentFilter(''); setStatus('ALL'); setQuery(''); }}>Clear filters</button>
        </div>
      </section>
      <section className="trip-history-list">
        {visible.map((trip) => (
          <article key={trip.id} className="trip-history-card">
            <header>
              <div>
                <small>{trip.request?.requestNumber ?? 'NO REQUEST'}</small>
                <h2>{trip.allocation.destination || trip.request?.destination || 'No destination'}</h2>
              </div>
              <span className={`trip-status ${trip.status.toLowerCase()}`}>{trip.status.replaceAll('_', ' ')}</span>
            </header>
            <div className="trip-history-grid">
              <TripFact icon={<ClipboardList size={16} />} label="Requesting staff" value={trip.request ? `${trip.request.staffName} (${trip.request.employeeId})` : 'No approved request'} />
              <TripFact icon={<UserRound size={16} />} label="Driver" value={`${trip.driver.staffName} (${trip.driver.employeeId})`} />
              <TripFact icon={<CarFront size={16} />} label="Vehicle" value={`${trip.vehicle.registrationNumber} - ${trip.vehicle.manufacturer} ${trip.vehicle.model}`} />
              <TripFact icon={<MapPin size={16} />} label="Schedule" value={`${formatDate(trip.allocation.startAt)} → ${formatDate(trip.allocation.expectedEndAt)}`} />
              <TripFact icon={<Navigation size={16} />} label="Actual trip" value={`${trip.startedAt ? formatDate(trip.startedAt) : 'Not started'} → ${trip.endedAt ? formatDate(trip.endedAt) : 'Not ended'}`} />
              <TripFact icon={<BarChart3 size={16} />} label="GPS summary" value={`${trip._count.locationHistory} point${trip._count.locationHistory === 1 ? '' : 's'} · ${(trip.calculatedDistance ?? 0).toFixed(2)} km · max ${toKmh(trip.maximumSpeed)} km/h`} />
            </div>
            <p>{trip.request?.purposeOfTrip || trip.allocation.purpose}</p>
            <footer className="trip-card-actions">
              <button className="secondary-action" disabled={!trip._count.locationHistory} onClick={() => setReplayTrip(trip)}><Navigation size={16} /> Replay GPS trip</button>
              {!trip._count.locationHistory && <small>No recorded GPS points for this trip.</small>}
            </footer>
          </article>
        ))}
        {!visible.length && (
          <div className="master-empty">
            <h2>No trip history yet</h2>
            <p>Trips will appear after a staff vehicle request is approved, allocated to a driver, and started.</p>
          </div>
        )}
      </section>
      {replayTrip && <TripReplay trip={replayTrip} onClose={() => setReplayTrip(null)} />}
    </>
  );
}

type ReplayPoint = {
  id: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speed?: number | null;
  heading?: number | null;
};
function TripReplay({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const map = useRef<GoogleMap | null>(null);
  const mapsNamespace = useRef<GoogleMapsNamespace | null>(null);
  const marker = useRef<GoogleMarker | null>(null);
  const vehicleImageMarker = useRef<GoogleMarker | null>(null);
  const imageUpdateToken = useRef(0);
  const [points, setPoints] = useState<ReplayPoint[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('Loading recorded trip points…');

  useEffect(() => { fetch(`/api/trips/${trip.id}/history`, { cache: 'no-store' }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Unable to load trip replay.'); return payload.data.locationHistory as ReplayPoint[]; }).then((history) => { setPoints(history); setMessage(history.length ? '' : 'This trip has no GPS history to replay.'); }).catch((reason: Error) => setMessage(reason.message)); }, [trip.id]);
  useEffect(() => { if (!points.length || !mapElement.current || map.current) return; void loadGoogleMaps().then((maps) => { const first = points[0]; const position = { lat: first.latitude, lng: first.longitude }; const heading = replayHeading(points, 0); const kind = replayVehicleKind(trip.vehicle); const imageUrl = replayVehicleImageUrl(trip.vehicle); mapsNamespace.current = maps; map.current = new maps.Map(mapElement.current!, { center: position, zoom: 15, mapTypeId: maps.MapTypeId.ROADMAP, streetViewControl: true, fullscreenControl: true }); marker.current = new maps.Marker({ map: map.current, position, zIndex: 10, title: `${trip.vehicle.registrationNumber} - ${replayVehicleKindLabel(kind)}`, label: replaySpeedLabel(first), icon: tripReplayVehicleIcon(maps, heading, kind) }); if (imageUrl) { vehicleImageMarker.current = new maps.Marker({ map: map.current, position, zIndex: 20, optimized: false, title: `${trip.vehicle.registrationNumber} - ${trip.vehicle.manufacturer} ${trip.vehicle.model}`, icon: replayVehicleRawImageIcon(maps, imageUrl) }); const token = ++imageUpdateToken.current; void rotatedReplayVehicleImageIcon(maps, imageUrl, heading).then((icon) => { if (token === imageUpdateToken.current) vehicleImageMarker.current?.setIcon(icon); }).catch(() => undefined); } }).catch((reason: Error) => setMessage(reason.message)); }, [points, trip.vehicle]);
  useEffect(() => { const point = points[index]; if (!point) return; const position = { lat: point.latitude, lng: point.longitude }; const heading = replayHeading(points, index); marker.current?.setPosition(position); marker.current?.setLabel(replaySpeedLabel(point)); vehicleImageMarker.current?.setPosition(position); const maps = mapsNamespace.current; if (maps) { marker.current?.setIcon(tripReplayVehicleIcon(maps, heading, replayVehicleKind(trip.vehicle))); const imageUrl = replayVehicleImageUrl(trip.vehicle); if (imageUrl && vehicleImageMarker.current) { const token = ++imageUpdateToken.current; void rotatedReplayVehicleImageIcon(maps, imageUrl, heading).then((icon) => { if (token === imageUpdateToken.current) vehicleImageMarker.current?.setIcon(icon); }).catch(() => undefined); } } map.current?.panTo(position); }, [index, points, trip.vehicle]);
  useEffect(() => () => { imageUpdateToken.current += 1; marker.current?.setMap(null); vehicleImageMarker.current?.setMap(null); }, []);
  useEffect(() => { if (!playing || points.length < 2) return; const timer = window.setInterval(() => setIndex((current) => current >= points.length - 1 ? 0 : current + 1), 900); return () => window.clearInterval(timer); }, [playing, points.length]);
  const current = points[index];
  return (
    <div className="master-modal-backdrop">
      <section className="trip-replay-modal" role="dialog" aria-modal="true" aria-label="Trip replay">
        <header>
          <div>
            <small>RECORDED GPS REPLAY</small>
            <h2>{trip.vehicle.registrationNumber} · {trip.driver.staffName}</h2>
            <p>{trip.request?.requestNumber ?? 'Trip'} — {trip.allocation.destination || trip.request?.destination}</p>
          </div>
          <button className="secondary-action" onClick={onClose}>Close</button>
        </header>
        <div ref={mapElement} className="trip-replay-map" />
        {message ? (
          <div className="master-alert">{message}</div>
        ) : (
          <footer className="trip-replay-controls">
            <div className="trip-replay-seek">
              <small>Start</small>
              <input
                type="range"
                min="0"
                max={Math.max(0, points.length - 1)}
                value={index}
                aria-label="Move through trip replay"
                onChange={(event) => setIndex(Number(event.target.value))}
              />
              <small>End</small>
            </div>
            <div className="trip-replay-actions">
              <button className="secondary-action" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>Previous</button>
              <button className="primary-action" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause replay' : 'Play replay'}</button>
              <button className="secondary-action" onClick={() => setIndex((current) => Math.min(points.length - 1, current + 1))} disabled={index >= points.length - 1}>Next</button>
              <span>{index + 1} / {points.length} · {current ? new Date(current.recordedAt).toLocaleString() : ''} · {Math.round(((current?.speed ?? 0) * 3.6))} km/h</span>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

function replayHeading(points: ReplayPoint[], index: number) {
  const current = points[index];
  if (!current) return 0;
  if (typeof current.heading === 'number' && Number.isFinite(current.heading)) {
    return normalizeReplayHeading(current.heading);
  }

  const next = points[index + 1];
  if (next && isDifferentReplayPoint(current, next)) return replayBearing(current, next);
  const previous = points[index - 1];
  if (previous && isDifferentReplayPoint(previous, current)) return replayBearing(previous, current);
  return 0;
}

function isDifferentReplayPoint(from: ReplayPoint, to: ReplayPoint) {
  return (
    Math.abs(from.latitude - to.latitude) > 0.000001 ||
    Math.abs(from.longitude - to.longitude) > 0.000001
  );
}

function replayBearing(from: ReplayPoint, to: ReplayPoint) {
  const latitude1 = replayRadians(from.latitude);
  const latitude2 = replayRadians(to.latitude);
  const longitudeDelta = replayRadians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return normalizeReplayHeading((Math.atan2(y, x) * 180) / Math.PI);
}

type ReplayVehicleKind = 'BUS' | 'TRUCK' | 'PICKUP' | 'VAN' | 'SUV' | 'MOTORCYCLE' | 'CAR';

function replayVehicleKind(vehicle: Trip['vehicle']): ReplayVehicleKind {
  const text = [vehicle.vehicleType?.name, vehicle.manufacturer, vehicle.model]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\bbus\b|coaster|hiace|civilian/.test(text)) return 'BUS';
  if (/truck|lorry|tipper|tanker|trailer/.test(text)) return 'TRUCK';
  if (/pickup|pick-up|hilux|ranger|d-max|dmax/.test(text)) return 'PICKUP';
  if (/van|sienna|sharan|caravan/.test(text)) return 'VAN';
  if (/motorcycle|bike|okada/.test(text)) return 'MOTORCYCLE';
  if (/suv|jeep|prado|land cruiser|fortuner|rav4|pilot|pathfinder|explorer/.test(text)) return 'SUV';
  return 'CAR';
}

function replayVehicleKindLabel(kind: ReplayVehicleKind) {
  return {
    BUS: 'Bus',
    TRUCK: 'Truck',
    PICKUP: 'Pickup',
    VAN: 'Van',
    SUV: 'SUV',
    MOTORCYCLE: 'Motorcycle',
    CAR: 'Car',
  }[kind];
}

function replayVehicleImageUrl(vehicle: Trip['vehicle']) {
  const text = `${vehicle.vehicleType?.name ?? ''} ${vehicle.manufacturer} ${vehicle.model}`.toLowerCase();
  if (text.includes('hilux')) return '/vehicle-icons/hilux.svg';
  if (text.includes('honda') || text.includes('accord') || text.includes('civic')) {
    return '/vehicle-icons/honda.png';
  }
  return '';
}

function replayVehicleRawImageIcon(maps: GoogleMapsNamespace, imageUrl: string) {
  return {
    url: imageUrl,
    scaledSize: new maps.Size(60, 60),
    anchor: new maps.Point(30, 30),
  };
}

const replayVehicleImages = new Map<string, Promise<HTMLImageElement>>();

function loadReplayVehicleImage(imageUrl: string) {
  const cached = replayVehicleImages.get(imageUrl);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load the vehicle replay icon.'));
    image.src = imageUrl;
  });
  replayVehicleImages.set(imageUrl, pending);
  return pending;
}

async function rotatedReplayVehicleImageIcon(
  maps: GoogleMapsNamespace,
  imageUrl: string,
  heading: number,
) {
  const image = await loadReplayVehicleImage(imageUrl);
  const size = 66;
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  const context = canvas.getContext('2d');
  if (!context) return replayVehicleRawImageIcon(maps, imageUrl);
  context.scale(2, 2);
  context.translate(size / 2, size / 2);
  context.rotate((normalizeReplayHeading(heading + 180) * Math.PI) / 180);
  if (imageUrl.includes('honda')) {
    context.drawImage(
      image,
      image.naturalWidth * 0.15,
      image.naturalHeight * 0.17,
      image.naturalWidth * 0.7,
      image.naturalHeight * 0.6,
      -29,
      -27,
      58,
      54,
    );
  } else {
    context.drawImage(image, -27, -27, 54, 54);
  }
  return {
    url: canvas.toDataURL('image/png'),
    scaledSize: new maps.Size(size, size),
    anchor: new maps.Point(size / 2, size / 2),
  };
}

function tripReplayVehicleIcon(
  maps: GoogleMapsNamespace,
  heading: number,
  kind: ReplayVehicleKind,
) {
  const vehicleShape = replayVehicleShape(kind);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <filter id="s" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#020617" flood-opacity=".38"/></filter>
    <g filter="url(#s)" transform="rotate(${normalizeReplayHeading(heading)} 32 32)">
      <path d="M32 2l8 10h-5v6h-6v-6h-5z" fill="#0f172a" stroke="#fff" stroke-width="2"/>
      <g fill="#0f8a61" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke fill">${vehicleShape}</g>
    </g>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(66, 66),
    anchor: new maps.Point(33, 33),
    labelOrigin: new maps.Point(82, 33),
  };
}

function replaySpeedLabel(point: ReplayPoint) {
  return {
    text: `${Math.max(0, Math.round((point.speed ?? 0) * 3.6))} km/h`,
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '900',
    className: 'trip-replay-speed-label',
  };
}

function replayVehicleShape(kind: ReplayVehicleKind) {
  return {
    BUS: '<rect x="21" y="17" width="22" height="39" rx="5"/><rect x="25" y="21" width="14" height="7" rx="2" fill="#dbeafe"/><rect x="25" y="32" width="5" height="7" rx="1" fill="#dbeafe"/><rect x="34" y="32" width="5" height="7" rx="1" fill="#dbeafe"/><rect x="25" y="43" width="14" height="7" rx="2" fill="#dbeafe"/>',
    TRUCK: '<rect x="22" y="18" width="20" height="17" rx="4"/><rect x="19" y="35" width="26" height="20" rx="3"/><rect x="26" y="22" width="12" height="6" rx="1" fill="#dbeafe"/>',
    PICKUP: '<rect x="21" y="18" width="22" height="21" rx="6"/><path d="M20 38h24v17H20z"/><path d="M24 42h16v9H24z" fill="#dbeafe"/><rect x="25" y="22" width="14" height="7" rx="2" fill="#dbeafe"/>',
    VAN: '<rect x="20" y="17" width="24" height="39" rx="8"/><rect x="24" y="21" width="16" height="8" rx="2" fill="#dbeafe"/><rect x="24" y="34" width="16" height="14" rx="3" fill="#dbeafe"/>',
    SUV: '<path d="M23 18h18l4 10-3 27H22l-3-27z"/><rect x="24" y="23" width="16" height="8" rx="2" fill="#dbeafe"/><rect x="24" y="37" width="16" height="10" rx="2" fill="#dbeafe"/>',
    MOTORCYCLE: '<circle cx="32" cy="22" r="6"/><circle cx="32" cy="50" r="6"/><path d="M32 28l-7 11h14z"/><rect x="29" y="36" width="6" height="10" rx="3"/>',
    CAR: '<path d="M24 18h16l5 12-3 25H22l-3-25z"/><rect x="24" y="23" width="16" height="8" rx="2" fill="#dbeafe"/><rect x="25" y="38" width="14" height="9" rx="2" fill="#dbeafe"/>',
  }[kind];
}

function replayRadians(value: number) {
  return (value * Math.PI) / 180;
}

function normalizeReplayHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function TripFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="trip-fact">{icon}<span><small>{label}</small><strong>{value}</strong></span></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function toKmh(speedMetresPerSecond?: number) {
  return Math.round((speedMetresPerSecond ?? 0) * 3.6);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function uniqueRecords(values: Array<{ id: string; label: string }>) {
  return [...new Map(values.map((value) => [value.id, value])).values()].sort((a, b) => a.label.localeCompare(b.label));
}
