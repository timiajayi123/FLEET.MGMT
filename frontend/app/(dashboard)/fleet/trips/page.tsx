'use client';

import { PageHeader } from '@/components/page-header';
import { loadGoogleMaps, type GoogleMap, type GoogleMarker } from '@/lib/google-maps';
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
    purposeOfTrip: string;
    destination: string;
    status: string;
    departureDate: string;
    expectedReturnDate: string;
  };
  vehicle: { id: string; registrationNumber: string; manufacturer: string; model: string };
  driver: { id: string; staffName: string; employeeId: string; phone?: string };
  _count: { locationHistory: number };
};

export default function TripsPage() {
  const [items, setItems] = useState<Trip[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
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
      return (!needle || text.includes(needle)) && (status === 'ALL' || trip.status === status || trip.allocation.status === status);
    });
  }, [items, query, status]);

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
        <article><strong>{totalDistance.toFixed(1)} km</strong><span>Recorded distance</span></article>
      </section>
      <section className="fleet-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, staff, driver, vehicle or destination" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
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
              <TripFact icon={<BarChart3 size={16} />} label="GPS summary" value={`${trip._count.locationHistory} point${trip._count.locationHistory === 1 ? '' : 's'} · ${(trip.calculatedDistance ?? 0).toFixed(1)} km · max ${toKmh(trip.maximumSpeed)} km/h`} />
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

type ReplayPoint = { id: string; latitude: number; longitude: number; recordedAt: string; speed?: number | null };
function TripReplay({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const map = useRef<GoogleMap | null>(null);
  const marker = useRef<GoogleMarker | null>(null);
  const [points, setPoints] = useState<ReplayPoint[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('Loading recorded trip points…');

  useEffect(() => { fetch(`/api/trips/${trip.id}/history`, { cache: 'no-store' }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Unable to load trip replay.'); return payload.data.locationHistory as ReplayPoint[]; }).then((history) => { setPoints(history); setMessage(history.length ? '' : 'This trip has no GPS history to replay.'); }).catch((reason: Error) => setMessage(reason.message)); }, [trip.id]);
  useEffect(() => { if (!points.length || !mapElement.current || map.current) return; void loadGoogleMaps().then((maps) => { const first = points[0]; map.current = new maps.Map(mapElement.current!, { center: { lat: first.latitude, lng: first.longitude }, zoom: 15, mapTypeId: maps.MapTypeId.ROADMAP, streetViewControl: true, fullscreenControl: true }); marker.current = new maps.Marker({ map: map.current, position: { lat: first.latitude, lng: first.longitude }, title: trip.vehicle.registrationNumber, icon: { url: '/vehicle-icons/honda.png', scaledSize: new maps.Size(52, 52), anchor: new maps.Point(26, 26) } }); }).catch((reason: Error) => setMessage(reason.message)); }, [points, trip.vehicle.registrationNumber]);
  useEffect(() => { const point = points[index]; if (!point) return; const position = { lat: point.latitude, lng: point.longitude }; marker.current?.setPosition(position); map.current?.panTo(position); }, [index, points]);
  useEffect(() => { if (!playing || points.length < 2) return; const timer = window.setInterval(() => setIndex((current) => current >= points.length - 1 ? 0 : current + 1), 900); return () => window.clearInterval(timer); }, [playing, points.length]);
  const current = points[index];
  return <div className="master-modal-backdrop"><section className="trip-replay-modal" role="dialog" aria-modal="true" aria-label="Trip replay"><header><div><small>RECORDED GPS REPLAY</small><h2>{trip.vehicle.registrationNumber} · {trip.driver.staffName}</h2><p>{trip.request?.requestNumber ?? 'Trip'} — {trip.allocation.destination || trip.request?.destination}</p></div><button className="secondary-action" onClick={onClose}>Close</button></header><div ref={mapElement} className="trip-replay-map" />{message ? <div className="master-alert">{message}</div> : <footer><button className="secondary-action" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>Previous</button><button className="primary-action" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause replay' : 'Play replay'}</button><button className="secondary-action" onClick={() => setIndex((current) => Math.min(points.length - 1, current + 1))} disabled={index >= points.length - 1}>Next</button><span>{index + 1} / {points.length} · {current ? new Date(current.recordedAt).toLocaleString() : ''} · {Math.round(((current?.speed ?? 0) * 3.6))} km/h</span></footer>}</section></div>;
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
