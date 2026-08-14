'use client';

import { GpsSpeedometer } from '@/components/gps-speedometer';
import { loadGoogleMaps, type GoogleMap, type GoogleMapsNamespace, type GoogleMarker } from '@/lib/google-maps';
import { ChevronUp, Expand, List, LocateFixed, Map as MapIcon, RefreshCw, Search } from 'lucide-react';
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
  isLastKnownLocation?: boolean;
  connectionStatus: 'MOVING' | 'STATIONARY' | 'STALE' | 'OFFLINE';
  driver: { staffName: string; employeeId: string; phone: string };
  vehicle: { id: string; registrationNumber: string; manufacturer: string; model: string; vehicleType?: { id: string; name: string; mapIcon?: string | null; mapIconMimeType?: string | null } };
  trip?: { id: string; status: string } | null;
  allocation?: { id: string; status: string; purpose: string; destination?: string; request?: { staffName: string; directorate: string; department: string } } | null;
};
type VehicleIconKind = 'BUS' | 'TRUCK' | 'PICKUP' | 'VAN' | 'SUV' | 'MOTORCYCLE' | 'CAR';

export function LiveFleetMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const markers = useRef(new Map<string, GoogleMarker>());
  const latestPositions = useRef(new Map<string, Position>());
  const markerHeadings = useRef(new Map<string, number>());
  const info = useRef<InstanceType<GoogleMapsNamespace['InfoWindow']> | null>(null);
  const socket = useRef<Socket | null>(null);
  const hasFramedMap = useRef(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [mapMessage, setMapMessage] = useState('');
  const [syncAt, setSyncAt] = useState<Date | null>(null);
  const [view, setView] = useState<'MAP' | 'LIST'>('MAP');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const load = useCallback(async () => {
    const liveResponse = await fetch('/api/fleet/live', { cache: 'no-store' });
    if (liveResponse.ok) {
      const payload = await liveResponse.json();
      setPositions(payload.data ?? []);
      setSyncAt(new Date(payload.generatedAt ?? Date.now()));
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
    const text = `${position.vehicle.registrationNumber} ${position.vehicle.manufacturer} ${position.vehicle.model} ${position.driver.staffName} ${position.allocation?.destination ?? ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (filter === 'ALL' || position.connectionStatus === filter || (filter === 'EMERGENCY' && Boolean((position.allocation as { emergencyAt?: string } | null)?.emergencyAt)));
  }), [positions, query, filter]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    const active = new Set<string>();
    const bounds = new maps.LatLngBounds();
    for (const position of visible) {
      active.add(position.vehicleId);
      const previousPosition = latestPositions.current.get(position.vehicleId);
      const displayHeading = resolveVehicleHeading(
        position,
        previousPosition,
        markerHeadings.current.get(position.vehicleId),
      );
      if (displayHeading !== undefined) {
        markerHeadings.current.set(position.vehicleId, displayHeading);
      }
      latestPositions.current.set(position.vehicleId, position);
      const point = { lat: position.latitude, lng: position.longitude };
      bounds.extend(point);
      let marker = markers.current.get(position.vehicleId);
      if (!marker) {
        marker = new maps.Marker({ map, position: point, title: position.vehicle.registrationNumber, optimized: true });
        const currentMarker = marker;
        currentMarker.addListener('click', () => {
          const current = latestPositions.current.get(position.vehicleId) ?? position;
          info.current?.setContent(popup(current));
          info.current?.open({ anchor: currentMarker, map });
        });
        markers.current.set(position.vehicleId, marker);
      }
      marker.setPosition(point);
      marker.setTitle(`${position.vehicle.registrationNumber} - ${position.driver.staffName}${position.connectionStatus === 'OFFLINE' ? ' - OFFLINE (last known location)' : ''}`);
      marker.setLabel({
        text: position.connectionStatus === 'OFFLINE' ? 'OFFLINE' : mapSpeedLabel(position.speed),
        color: '#0f172a',
        fontSize: '13px',
        fontWeight: '900',
        className: 'vehicle-speed-label',
      });
      marker.setIcon(vehicleMarkerIcon(maps, position, displayHeading));
    }
    markers.current.forEach((marker, id) => {
      if (!active.has(id)) {
        marker.setMap(null);
        markers.current.delete(id);
        latestPositions.current.delete(id);
        markerHeadings.current.delete(id);
      }
    });
    if (visible.length && !hasFramedMap.current) {
      map.fitBounds(bounds, 90);
      maps.event.addListenerOnce(map, 'idle', () => {
        const openingZoom = map.getZoom();
        if (openingZoom !== undefined && openingZoom > 13) map.setZoom(13);
      });
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

  const counts = {
    moving: positions.filter((p) => p.connectionStatus === 'MOVING').length,
    stationary: positions.filter((p) => p.connectionStatus === 'STATIONARY').length,
    stale: positions.filter((p) => ['STALE', 'OFFLINE'].includes(p.connectionStatus)).length,
  };
  const selectedPosition = visible.find((position) => position.vehicleId === selectedVehicleId);

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
      {mapMessage && <div className="map-setup-message">{mapMessage} The live fleet list remains available.</div>}
      <section className={`live-map-layout ${view.toLowerCase()}`}>
        <div ref={mapContainer} className="admin-live-map" />
        <aside className="fleet-vehicle-list">
          <header><strong>{visible.length} vehicles</strong><small>Last sync {syncAt ? syncAt.toLocaleTimeString() : '--'}</small></header>
          {selectedPosition && (
            <section className="admin-driver-detail">
              <div className="admin-driver-detail-heading">
                <div>
                  <strong>{selectedPosition.driver.staffName}</strong>
                  <small>{selectedPosition.driver.employeeId} - {selectedPosition.driver.phone || 'No phone'}</small>
                </div>
                <button type="button" onClick={() => setSelectedVehicleId('')} aria-label="Hide selected vehicle details">
                  <ChevronUp />
                  Hide details
                </button>
              </div>
              <GpsSpeedometer
                className="admin-live-speedometer"
                speedMetresPerSecond={selectedPosition.speed}
                recordedAt={selectedPosition.recordedAt}
              />
              <dl>
                <div><dt>Vehicle</dt><dd>{selectedPosition.vehicle.registrationNumber}</dd></div>
                <div><dt>Type</dt><dd>{vehicleIconLabel(vehicleIconKind(selectedPosition))}</dd></div>
                <div><dt>Status</dt><dd>{selectedPosition.connectionStatus}</dd></div>
                <div><dt>Accuracy</dt><dd>{selectedPosition.accuracy ? `${Math.round(selectedPosition.accuracy)} m` : '--'}</dd></div>
                <div><dt>Destination</dt><dd>{selectedPosition.allocation?.destination || 'No active destination'}</dd></div>
                <div><dt>{selectedPosition.connectionStatus === 'OFFLINE' ? 'Last known at' : 'Last update'}</dt><dd>{new Date(selectedPosition.recordedAt).toLocaleString()}</dd></div>
                <div><dt>Coordinates</dt><dd>{selectedPosition.latitude.toFixed(5)}, {selectedPosition.longitude.toFixed(5)}</dd></div>
              </dl>
            </section>
          )}
          {visible.map((position) => (
            <button
              className={selectedPosition?.vehicleId === position.vehicleId ? 'selected' : ''}
              key={position.vehicleId}
              type="button"
              aria-expanded={selectedPosition?.vehicleId === position.vehicleId}
              onClick={() => {
                setSelectedVehicleId((current) => current === position.vehicleId ? '' : position.vehicleId);
                mapRef.current?.panTo({ lat: position.latitude, lng: position.longitude });
                mapRef.current?.setZoom(17);
              }}
            >
              <i style={{ background: color(position.connectionStatus) }} />
              <span>
                <strong>{position.vehicle.registrationNumber}</strong>
                <small>{vehicleIconLabel(vehicleIconKind(position))} - {position.driver.staffName} - {position.vehicle.manufacturer} {position.vehicle.model}</small>
                <small>{position.allocation?.destination || 'No active destination'}</small>
                <em>{position.connectionStatus} - {Math.round((position.speed ?? 0) * 3.6)} km/h - {position.isSimulated ? 'SIMULATED - ' : ''}{position.connectionStatus === 'OFFLINE' ? 'Last seen ' : ''}{new Date(position.recordedAt).toLocaleString()}</em>
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

function vehicleMarkerIcon(
  maps: GoogleMapsNamespace,
  position: Position,
  heading?: number,
) {
  const customUrl = customVehicleIconUrl(position);
  if (customUrl) {
    return {
      url: customUrl,
      scaledSize: new maps.Size(64, 64),
      anchor: new maps.Point(32, 32),
      labelOrigin: new maps.Point(32, -8),
    };
  }

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleMarkerSvg(vehicleIconKind(position), color(position.connectionStatus), heading))}`,
    scaledSize: new maps.Size(88, 88),
    anchor: new maps.Point(44, heading === undefined ? 70 : 44),
    labelOrigin: new maps.Point(44, -8),
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

function vehicleMarkerSvg(kind: VehicleIconKind, fill: string, heading?: number) {
  const body = {
    BUS: '<rect x="11" y="14" width="42" height="26" rx="5"/><rect x="16" y="18" width="8" height="8" rx="1"/><rect x="28" y="18" width="8" height="8" rx="1"/><rect x="40" y="18" width="8" height="8" rx="1"/>',
    TRUCK: '<rect x="9" y="18" width="28" height="20" rx="4"/><path d="M37 24h9l7 7v7H37z"/><rect x="14" y="22" width="16" height="7" rx="1"/>',
    PICKUP: '<path d="M9 28l5-10h22l6 10h12v10H9z"/><rect x="17" y="21" width="13" height="7" rx="1"/><path d="M43 28h9"/>',
    VAN: '<path d="M9 28l7-11h26l9 11v10H9z"/><rect x="18" y="20" width="10" height="8" rx="1"/><rect x="32" y="20" width="9" height="8" rx="1"/>',
    SUV: '<path d="M8 29l8-11h28l10 11v9H8z"/><rect x="18" y="21" width="10" height="7" rx="1"/><rect x="32" y="21" width="10" height="7" rx="1"/>',
    MOTORCYCLE: '<path d="M18 36h10l8-12h8l4 12"/><path d="M31 27h12"/><circle cx="18" cy="38" r="6"/><circle cx="48" cy="38" r="6"/>',
    CAR: '<path d="M8 30l7-10h34l7 10v9H8z"/><rect x="19" y="23" width="10" height="7" rx="1"/><rect x="34" y="23" width="10" height="7" rx="1"/>',
  }[kind];

  const rotation = heading === undefined ? 0 : normalizeHeading(heading) - 90;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#020617" flood-opacity=".35"/></filter>
    <g filter="url(#shadow)" transform="rotate(${rotation} 32 32)">
      <path d="M32 58c4-7 20-12 20-30C52 17 43 8 32 8S12 17 12 28c0 18 16 23 20 30z" fill="#111827"/>
      <g fill="${fill}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body}</g>
      <circle cx="21" cy="40" r="4.5" fill="#111827" stroke="#ffffff" stroke-width="2"/>
      <circle cx="43" cy="40" r="4.5" fill="#111827" stroke="#ffffff" stroke-width="2"/>
    </g>
  </svg>`;
}

function resolveVehicleHeading(
  current: Position,
  previous?: Position,
  previousHeading?: number,
) {
  if (typeof current.heading === 'number' && Number.isFinite(current.heading)) {
    return normalizeHeading(current.heading);
  }

  if (
    previous &&
    (Math.abs(current.latitude - previous.latitude) > 0.000001 ||
      Math.abs(current.longitude - previous.longitude) > 0.000001)
  ) {
    return bearingBetween(previous, current);
  }

  return previousHeading;
}

function bearingBetween(from: Position, to: Position) {
  const latitude1 = degreesToRadians(from.latitude);
  const latitude2 = degreesToRadians(to.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function popup(position: Position) {
  const offline = position.connectionStatus === 'OFFLINE';
  return `<div class="google-map-popup"><strong>${escape(position.vehicle.registrationNumber)} - ${escape(position.vehicle.manufacturer)} ${escape(position.vehicle.model)}</strong>${offline ? '<p class="google-map-offline"><b>OFFLINE</b> · Showing the last known vehicle location</p>' : ''}<p><b>Vehicle icon:</b> ${vehicleIconLabel(vehicleIconKind(position))}${position.vehicle.vehicleType?.name ? ` (${escape(position.vehicle.vehicleType.name)})` : ''}</p><p><b>Driver:</b> ${escape(position.driver.staffName)} (${escape(position.driver.employeeId)})</p><p><b>Destination:</b> ${escape(position.allocation?.destination ?? 'No active destination')}</p><p class="google-map-speed"><b>${offline ? 'Last recorded speed' : 'Live speed'}</b> ${mapSpeedLabel(position.speed)}</p><p><b>Accuracy:</b> ${Math.round(position.accuracy ?? 0)}m - <b>Status:</b> ${position.connectionStatus}${position.isSimulated ? ' - SIMULATED' : ''}</p><p><b>${offline ? 'Last seen' : 'Updated'}:</b> ${escape(new Date(position.recordedAt).toLocaleString())}</p><p><b>Coordinates:</b> ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}</p>${position.allocation?.purpose ? `<p>${escape(position.allocation.purpose)}</p>` : ''}</div>`;
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}
