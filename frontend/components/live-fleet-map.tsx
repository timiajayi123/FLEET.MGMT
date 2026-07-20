'use client';

import { loadGoogleMaps, type GoogleMap, type GoogleMapsNamespace, type GoogleMarker } from '@/lib/google-maps';
import { Crosshair, Expand, List, LocateFixed, Map as MapIcon, Pause, Play, RefreshCw, Search, Square } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Position = {
  id: string;
  vehicleId: string;
  driverId: string;
  allocationId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
  isSimulated: boolean;
  connectionStatus: 'MOVING' | 'STATIONARY' | 'STALE' | 'OFFLINE';
  driver: { staffName: string; employeeId: string; phone: string };
  vehicle: { id: string; registrationNumber: string; manufacturer: string; model: string; vehicleType?: { id: string; name: string; mapIcon?: string | null; mapIconMimeType?: string | null } };
  trip: { id: string; status: string };
  allocation: { id: string; status: string; purpose: string; destination?: string; request?: { staffName: string; directorate: string; department: string; unit: string } };
};
type Allocation = { id: string; status: string; destination?: string; vehicle: { registrationNumber: string }; driver: { staffName: string }; trip?: { id: string; status: string } };
type VehicleIconKind = 'BUS' | 'TRUCK' | 'PICKUP' | 'VAN' | 'SUV' | 'MOTORCYCLE' | 'CAR';

export function LiveFleetMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const markers = useRef(new Map<string, GoogleMarker>());
  const latestPositions = useRef(new Map<string, Position>());
  const info = useRef<InstanceType<GoogleMapsNamespace['InfoWindow']> | null>(null);
  const socket = useRef<Socket | null>(null);
  const simulator = useRef<number | null>(null);
  const simulationStep = useRef(0);
  const hasFramedMap = useRef(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [mapMessage, setMapMessage] = useState('');
  const [syncAt, setSyncAt] = useState<Date | null>(null);
  const [view, setView] = useState<'MAP' | 'LIST'>('MAP');
  const [selectedAllocation, setSelectedAllocation] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [simulationRunning, setSimulationRunning] = useState(false);
  const simulatorEnabled = process.env.NEXT_PUBLIC_ENABLE_GPS_SIMULATOR === 'true' && process.env.NODE_ENV !== 'production';

  const load = useCallback(async () => {
    const [liveResponse, allocationsResponse] = await Promise.all([
      fetch('/api/fleet/live', { cache: 'no-store' }),
      fetch('/api/vehicle-allocations', { cache: 'no-store' }),
    ]);
    if (liveResponse.ok) {
      const payload = await liveResponse.json();
      setPositions(payload.data ?? []);
      setSyncAt(new Date(payload.generatedAt ?? Date.now()));
    }
    if (allocationsResponse.ok) {
      const payload = await allocationsResponse.json();
      setAllocations(payload.data ?? []);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 10000);
    const backend = process.env.NEXT_PUBLIC_SOCKET_URL || '/';
    const client = io(backend, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      secure: window.location.protocol === 'https:',
    });
    socket.current = client;
    client.on('vehicle-location', (event: Partial<Position> & { vehicleId: string }) => {
      let found = false;
      setPositions((current) => current.map((item) => {
        if (item.vehicleId !== event.vehicleId) return item;
        found = true;
        return { ...item, ...event, connectionStatus: event.speed && event.speed > 1 ? 'MOVING' : 'STATIONARY' };
      }));
      if (!found) void load();
      setSyncAt(new Date());
    });
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      client.disconnect();
      if (simulator.current) window.clearInterval(simulator.current);
    };
  }, [load]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    let disposed = false;
    const markerStore = markers.current;
    void loadGoogleMaps()
      .then((maps) => {
        if (disposed || !mapContainer.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(mapContainer.current, {
          center: { lat: 9.082, lng: 8.6753 },
          zoom: 6,
          mapTypeId: maps.MapTypeId.ROADMAP,
          streetViewControl: true,
          fullscreenControl: true,
          mapTypeControl: true,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined,
        });
        info.current = new maps.InfoWindow();
      })
      .catch((error: Error) => setMapMessage(error.message));
    return () => {
      disposed = true;
      markerStore.forEach((marker) => marker.setMap(null));
      markerStore.clear();
      mapRef.current = null;
    };
  }, []);

  const visible = useMemo(() => positions.filter((position) => {
    const text = `${position.vehicle.registrationNumber} ${position.vehicle.manufacturer} ${position.vehicle.model} ${position.driver.staffName} ${position.allocation.destination ?? ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (filter === 'ALL' || position.connectionStatus === filter || (filter === 'EMERGENCY' && Boolean((position.allocation as { emergencyAt?: string }).emergencyAt)));
  }), [positions, query, filter]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    const active = new Set<string>();
    const bounds = new maps.LatLngBounds();
    for (const position of visible) {
      active.add(position.vehicleId);
      latestPositions.current.set(position.vehicleId, position);
      const point = { lat: position.latitude, lng: position.longitude };
      bounds.extend(point);
      let marker = markers.current.get(position.vehicleId);
      if (!marker) {
        marker = new maps.Marker({ map, position: point, title: position.vehicle.registrationNumber, optimized: true });
        const currentMarker = marker;
        currentMarker.addListener('click', () => {
          const current = latestPositions.current.get(position.vehicleId) ?? position;
          setSelectedVehicleId(current.vehicleId);
          info.current?.setContent(popup(current));
          info.current?.open({ anchor: currentMarker, map });
        });
        markers.current.set(position.vehicleId, marker);
      }
      marker.setPosition(point);
      marker.setTitle(`${position.vehicle.registrationNumber} - ${position.driver.staffName}`);
      marker.setLabel({
        text: mapSpeedLabel(position.speed),
        color: '#0f172a',
        fontSize: '11px',
        fontWeight: '900',
        className: 'vehicle-speed-label',
      });
      marker.setIcon(vehicleMarkerIcon(maps, position));
    }
    markers.current.forEach((marker, id) => {
      if (!active.has(id)) {
        marker.setMap(null);
        markers.current.delete(id);
        latestPositions.current.delete(id);
      }
    });
    if (visible.length && !hasFramedMap.current) {
      map.fitBounds(bounds, 90);
      hasFramedMap.current = true;
    }
  }, [visible]);

  function fitVisible() {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || !visible.length) return;
    const bounds = new maps.LatLngBounds();
    visible.forEach((position) => bounds.extend({ lat: position.latitude, lng: position.longitude }));
    map.fitBounds(bounds, 90);
  }

  function fullscreen() {
    mapContainer.current?.requestFullscreen().catch(() => setMapMessage('Full-screen map is unavailable in this browser.'));
  }

  async function simulatePoint() {
    const allocation = allocations.find((item) => item.id === selectedAllocation);
    if (!allocation?.trip) return;
    const step = simulationStep.current++;
    const latitude = 9.0765 + step * 0.0012;
    const longitude = 7.3986 + step * 0.0011;
    await fetch('/api/driver-tracking/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocationId: allocation.id, tripId: allocation.trip.id, clientEventId: crypto.randomUUID(), latitude, longitude, speed: 12, heading: 45, accuracy: 8, recordedAt: new Date().toISOString(), isSimulated: true }),
    });
    void load();
  }

  function toggleSimulation() {
    if (simulationRunning) {
      if (simulator.current) window.clearInterval(simulator.current);
      simulator.current = null;
      setSimulationRunning(false);
      return;
    }
    if (!selectedAllocation) {
      setMapMessage('Select an in-progress allocation for the simulator.');
      return;
    }
    void simulatePoint();
    simulator.current = window.setInterval(() => void simulatePoint(), 4000);
    setSimulationRunning(true);
  }

  const counts = {
    moving: positions.filter((p) => p.connectionStatus === 'MOVING').length,
    stationary: positions.filter((p) => p.connectionStatus === 'STATIONARY').length,
    stale: positions.filter((p) => ['STALE', 'OFFLINE'].includes(p.connectionStatus)).length,
  };
  const selectedPosition = visible.find((position) => position.vehicleId === selectedVehicleId) ?? visible[0];

  return (
    <div className="live-fleet-page">
      <section className="fleet-summary">
        <article><strong>{positions.length}</strong><span>Tracked vehicles</span></article>
        <article className="green"><strong>{counts.moving}</strong><span>Moving</span></article>
        <article className="yellow"><strong>{counts.stationary}</strong><span>Stationary</span></article>
        <article className="grey"><strong>{counts.stale}</strong><span>Stale / offline</span></article>
      </section>
      <section className="fleet-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vehicle, driver or destination" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="MOVING">Moving</option>
          <option value="STATIONARY">Stationary</option>
          <option value="STALE">Stale</option>
          <option value="OFFLINE">Offline</option>
        </select>
        <button className="secondary-action" onClick={() => setView(view === 'MAP' ? 'LIST' : 'MAP')}>{view === 'MAP' ? <List /> : <MapIcon />}{view === 'MAP' ? 'List' : 'Map'}</button>
        <button className="secondary-action" onClick={() => void load()}><RefreshCw />Refresh</button>
        <button className="secondary-action" onClick={fitVisible}><LocateFixed />Fit</button>
        <button className="secondary-action" onClick={fullscreen}><Expand />Full screen</button>
      </section>
      {simulatorEnabled && (
        <section className="simulator-bar">
          <div><Crosshair /><span><strong>Development GPS simulator</strong><small>Points are visibly marked as simulated and use the production tracking pipeline.</small></span></div>
          <select value={selectedAllocation} onChange={(event) => setSelectedAllocation(event.target.value)}>
            <option value="">Select in-progress allocation</option>
            {allocations.filter((item) => item.status === 'IN_PROGRESS' && item.trip).map((item) => <option key={item.id} value={item.id}>{item.vehicle.registrationNumber} - {item.driver.staffName} - {item.destination}</option>)}
          </select>
          <button className={simulationRunning ? 'danger-action' : 'primary-action'} onClick={toggleSimulation}>{simulationRunning ? <><Pause />Pause</> : <><Play />Start simulation</>}</button>
          {simulationRunning && <button className="secondary-action" onClick={() => { if (simulator.current) window.clearInterval(simulator.current); simulator.current = null; simulationStep.current = 0; setSimulationRunning(false); }}><Square />Stop</button>}
        </section>
      )}
      {mapMessage && <div className="map-setup-message">{mapMessage} The live fleet list and simulator remain available.</div>}
      <section className={`live-map-layout ${view.toLowerCase()}`}>
        <div ref={mapContainer} className="admin-live-map" />
        <aside className="fleet-vehicle-list">
          <header><strong>{visible.length} vehicles</strong><small>Last sync {syncAt ? syncAt.toLocaleTimeString() : '--'}</small></header>
          {selectedPosition && (
            <section className="admin-driver-detail">
              <div>
                <strong>{selectedPosition.driver.staffName}</strong>
                <small>{selectedPosition.driver.employeeId} - {selectedPosition.driver.phone || 'No phone'}</small>
              </div>
              <AdminSpeedCard speedMetresPerSecond={selectedPosition.speed} recordedAt={selectedPosition.recordedAt} />
              <dl>
                <div><dt>Vehicle</dt><dd>{selectedPosition.vehicle.registrationNumber}</dd></div>
                <div><dt>Type</dt><dd>{vehicleIconLabel(vehicleIconKind(selectedPosition))}</dd></div>
                <div><dt>Status</dt><dd>{selectedPosition.connectionStatus}</dd></div>
                <div><dt>Accuracy</dt><dd>{selectedPosition.accuracy ? `${Math.round(selectedPosition.accuracy)} m` : '--'}</dd></div>
                <div><dt>Destination</dt><dd>{selectedPosition.allocation.destination || 'No destination'}</dd></div>
                <div><dt>Last update</dt><dd>{new Date(selectedPosition.recordedAt).toLocaleTimeString()}</dd></div>
              </dl>
            </section>
          )}
          {visible.map((position) => (
            <button className={selectedPosition?.vehicleId === position.vehicleId ? 'selected' : ''} key={position.vehicleId} onClick={() => { setSelectedVehicleId(position.vehicleId); mapRef.current?.panTo({ lat: position.latitude, lng: position.longitude }); mapRef.current?.setZoom(17); }}>
              <i style={{ background: color(position.connectionStatus) }} />
              <span>
                <strong>{position.vehicle.registrationNumber}</strong>
                <small>{vehicleIconLabel(vehicleIconKind(position))} - {position.driver.staffName} - {position.vehicle.manufacturer} {position.vehicle.model}</small>
                <small>{position.allocation.destination || 'No destination'}</small>
                <em>{position.connectionStatus} - {Math.round((position.speed ?? 0) * 3.6)} km/h - {position.isSimulated ? 'SIMULATED - ' : ''}{new Date(position.recordedAt).toLocaleTimeString()}</em>
              </span>
            </button>
          ))}
          {!visible.length && <p>No matching live vehicle positions.</p>}
        </aside>
      </section>
    </div>
  );
}

function color(status: Position['connectionStatus']) {
  if (status === 'MOVING') return '#0f9f6e';
  if (status === 'STATIONARY') return '#d97706';
  if (status === 'STALE') return '#64748b';
  return '#334155';
}

function mapSpeedLabel(speedMetresPerSecond?: number) {
  if (typeof speedMetresPerSecond !== 'number' || !Number.isFinite(speedMetresPerSecond)) return '0 km/h';
  return `${Math.max(0, Math.round(speedMetresPerSecond * 3.6))} km/h`;
}

function vehicleIconKind(position: Position): VehicleIconKind {
  const text = [
    position.vehicle.vehicleType?.name,
    position.vehicle.manufacturer,
    position.vehicle.model,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\bbus\b|coaster|hiace|civilian/.test(text)) return 'BUS';
  if (/truck|lorry|tipper|tanker|trailer/.test(text)) return 'TRUCK';
  if (/pickup|pick-up|hilux|ranger|d-max|dmax/.test(text)) return 'PICKUP';
  if (/van|sienna|sharan|caravan/.test(text)) return 'VAN';
  if (/motorcycle|bike|okada/.test(text)) return 'MOTORCYCLE';
  if (/suv|jeep|prado|land cruiser|fortuner|rav4|pilot|pathfinder|explorer/.test(text)) return 'SUV';
  return 'CAR';
}

function vehicleIconLabel(kind: VehicleIconKind) {
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

function vehicleMarkerIcon(maps: GoogleMapsNamespace, position: Position) {
  const customUrl = customVehicleIconUrl(position);
  if (customUrl) {
    return {
      url: customUrl,
      scaledSize: new maps.Size(56, 56),
      anchor: new maps.Point(28, 28),
      labelOrigin: new maps.Point(28, -8),
    };
  }

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleMarkerSvg(vehicleIconKind(position), color(position.connectionStatus)))}`,
    scaledSize: new maps.Size(64, 64),
    anchor: new maps.Point(32, 50),
    labelOrigin: new maps.Point(32, -4),
  };
}

function customVehicleIconUrl(position: Position) {
  const vehicleType = position.vehicle.vehicleType;
  if (vehicleType?.mapIconMimeType) return `/api/vehicle-types/${vehicleType.id}/map-icon`;
  if (vehicleType?.mapIcon) return vehicleType.mapIcon;
  const text = [
    position.vehicle.vehicleType?.name,
    position.vehicle.manufacturer,
    position.vehicle.model,
  ].filter(Boolean).join(' ').toLowerCase();

  if (text.includes('hilux')) return '/vehicle-icons/hilux.svg';
  if (text.includes('honda') || text.includes('accord') || text.includes('civic')) return '/vehicle-icons/honda.png';
  return '';
}

function vehicleMarkerSvg(kind: VehicleIconKind, fill: string) {
  const body = {
    BUS: '<rect x="11" y="14" width="42" height="26" rx="5"/><rect x="16" y="18" width="8" height="8" rx="1"/><rect x="28" y="18" width="8" height="8" rx="1"/><rect x="40" y="18" width="8" height="8" rx="1"/>',
    TRUCK: '<rect x="9" y="18" width="28" height="20" rx="4"/><path d="M37 24h9l7 7v7H37z"/><rect x="14" y="22" width="16" height="7" rx="1"/>',
    PICKUP: '<path d="M9 28l5-10h22l6 10h12v10H9z"/><rect x="17" y="21" width="13" height="7" rx="1"/><path d="M43 28h9"/>',
    VAN: '<path d="M9 28l7-11h26l9 11v10H9z"/><rect x="18" y="20" width="10" height="8" rx="1"/><rect x="32" y="20" width="9" height="8" rx="1"/>',
    SUV: '<path d="M8 29l8-11h28l10 11v9H8z"/><rect x="18" y="21" width="10" height="7" rx="1"/><rect x="32" y="21" width="10" height="7" rx="1"/>',
    MOTORCYCLE: '<path d="M18 36h10l8-12h8l4 12"/><path d="M31 27h12"/><circle cx="18" cy="38" r="6"/><circle cx="48" cy="38" r="6"/>',
    CAR: '<path d="M8 30l7-10h34l7 10v9H8z"/><rect x="19" y="23" width="10" height="7" rx="1"/><rect x="34" y="23" width="10" height="7" rx="1"/>',
  }[kind];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#020617" flood-opacity=".35"/></filter>
    <g filter="url(#shadow)">
      <path d="M32 58c4-7 20-12 20-30C52 17 43 8 32 8S12 17 12 28c0 18 16 23 20 30z" fill="#111827"/>
      <g fill="${fill}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body}</g>
      <circle cx="21" cy="40" r="4.5" fill="#111827" stroke="#ffffff" stroke-width="2"/>
      <circle cx="43" cy="40" r="4.5" fill="#111827" stroke="#ffffff" stroke-width="2"/>
    </g>
  </svg>`;
}

function AdminSpeedCard({ speedMetresPerSecond, recordedAt }: { speedMetresPerSecond?: number; recordedAt?: string }) {
  const hasSpeed = typeof speedMetresPerSecond === 'number' && Number.isFinite(speedMetresPerSecond);
  const speed = hasSpeed ? Math.max(0, Math.round(speedMetresPerSecond * 3.6)) : null;
  const percent = Math.min(100, ((speed ?? 0) / 120) * 100);

  return <div className="speed-card admin-speed-card" role="meter" aria-label={hasSpeed ? `Current speed ${speed} kilometres per hour` : 'Current speed unavailable'} aria-valuemin={0} aria-valuemax={120} aria-valuenow={speed ?? undefined}><div className="speed-card-top"><span>Driver speed</span><strong>{speed ?? '—'}<small>km/h</small></strong></div><div className="speed-bar" aria-hidden="true"><i style={{ width: `${percent}%` }}/></div><div className="speed-card-scale"><span>0</span><span>60</span><span>120+</span></div><p>{hasSpeed ? `Latest GPS point · ${recordedAt ? new Date(recordedAt).toLocaleTimeString() : 'now'}` : 'No GPS speed value yet.'}</p></div>;
}

function popup(position: Position) {
  return `<div class="google-map-popup"><strong>${escape(position.vehicle.registrationNumber)} - ${escape(position.vehicle.manufacturer)} ${escape(position.vehicle.model)}</strong><p><b>Vehicle icon:</b> ${vehicleIconLabel(vehicleIconKind(position))}${position.vehicle.vehicleType?.name ? ` (${escape(position.vehicle.vehicleType.name)})` : ''}</p><p><b>Driver:</b> ${escape(position.driver.staffName)} (${escape(position.driver.employeeId)})</p><p><b>Destination:</b> ${escape(position.allocation.destination ?? 'No destination')}</p><p class="google-map-speed"><b>Live speed</b> ${mapSpeedLabel(position.speed)}</p><p><b>Accuracy:</b> ${Math.round(position.accuracy ?? 0)}m - <b>Status:</b> ${position.connectionStatus}${position.isSimulated ? ' - SIMULATED' : ''}</p><p>${escape(position.allocation.purpose)}</p></div>`;
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}
