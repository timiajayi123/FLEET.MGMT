'use client';

import { PageHeader } from '@/components/page-header';
import type {
  GoogleMap,
  GoogleMapsNamespace,
  GoogleMarker,
} from '@/lib/google-maps';
import { loadGoogleMaps } from '@/lib/google-maps';
import {
  Crosshair,
  Map as MapIcon,
  MapPin,
  Radio,
  RadioTower,
  Square,
  ZoomIn,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type LivePosition = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  recordedAt: string;
  connectionStatus: 'LIVE' | 'STALE' | 'OFFLINE';
  driver: {
    id: string;
    staffName: string;
    employeeId: string;
    phone: string;
    passportMimeType?: string;
    status: string;
  };
  vehicle?: {
    id: string;
    registrationNumber: string;
    manufacturer: string;
    model: string;
    imageMimeType?: string;
  };
  allocation?: { id: string; purpose: string; destination?: string; status: string };
};

type CurrentUser = { role?: { code?: string; name?: string } };

export default function GpsTrackingPage() {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<GoogleMap | null>(null),
    mapsRef = useRef<GoogleMapsNamespace | null>(null),
    markers = useRef<Map<string, GoogleMarker>>(new Map()),
    infoWindow = useRef<InstanceType<GoogleMapsNamespace['InfoWindow']> | null>(null),
    watchId = useRef<number | null>(null),
    hasFitFleet = useRef(false);
  const [positions, setPositions] = useState<LivePosition[]>([]),
    [currentUser, setCurrentUser] = useState<CurrentUser | null>(null),
    [tracking, setTracking] = useState(false),
    [mapReady, setMapReady] = useState(false),
    [message, setMessage] = useState(''),
    [lastSent, setLastSent] = useState<string>('');
  const isDriver = currentUser?.role?.code === 'DRIVER';

  const load = useCallback(async () => {
    const response = await fetch('/api/gps/live', { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      setPositions(payload.data ?? []);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setCurrentUser(payload?.user ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (isDriver) return;
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [isDriver, load]);

  useEffect(() => {
    if (isDriver) return;
    if (!container.current || mapRef.current) return;
    let disposed = false;
    const markerStore = markers.current;
    void loadGoogleMaps()
      .then((maps) => {
        if (disposed || !container.current) return;
        mapsRef.current = maps;
        const map = new maps.Map(container.current, {
          center: { lat: 9.082, lng: 8.6753 },
          zoom: 5,
          mapTypeControl: true,
          mapTypeId: maps.MapTypeId.ROADMAP,
          streetViewControl: true,
          fullscreenControl: true,
          restriction: {
            latLngBounds: { north: 14.5, south: 4, west: 2.5, east: 14.8 },
            strictBounds: false,
          },
        });
        infoWindow.current = new maps.InfoWindow();
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((error) => setMessage(error.message));

    return () => {
      disposed = true;
      markerStore.forEach((marker) => marker.setMap(null));
      markerStore.clear();
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, [isDriver]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;

    const active = new Set<string>();
    const bounds = new maps.LatLngBounds();
    positions.forEach((position) => {
      active.add(position.id);
      const point = { lat: position.latitude, lng: position.longitude };
      bounds.extend(point);
      let marker = markers.current.get(position.id);
      if (!marker) {
        const createdMarker = new maps.Marker({
          map,
          position: point,
          title: position.driver.staffName,
          label: { text: 'CAR', color: '#ffffff', fontSize: '10px', fontWeight: '800' },
        });
        createdMarker.addListener('click', () => {
          infoWindow.current?.setContent(driverPopup(position));
          infoWindow.current?.open({ anchor: createdMarker, map });
          map.panTo(point);
          map.setZoom(Math.max(map.getZoom() ?? 17, 17));
        });
        marker = createdMarker;
        markers.current.set(position.id, marker);
      }
      marker.setPosition(point);
      marker.setTitle(position.driver.staffName);
      marker.setIcon({
        path: maps.SymbolPath.CIRCLE,
        fillColor: markerColor(position.connectionStatus),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        scale: 12,
      });
    });
    markers.current.forEach((marker, id) => {
      if (!active.has(id)) {
        marker.setMap(null);
        markers.current.delete(id);
      }
    });
    if (positions.length && !hasFitFleet.current) {
      map.fitBounds(bounds, 80);
      const listener = maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
        maps.event.removeListener(listener);
      });
      hasFitFleet.current = true;
    }
  }, [positions, mapReady]);

  function showFleetOverview() {
    const map = mapRef.current;
    if (!map) return;
    if (!positions.length) {
      map.fitBounds({ north: 14.5, south: 4, west: 2.5, east: 14.8 }, 35);
      return;
    }
    const longitudes = positions.map((position) => position.longitude);
    const latitudes = positions.map((position) => position.latitude);
    if (positions.length === 1) {
      map.panTo({ lat: latitudes[0], lng: longitudes[0] });
      map.setZoom(16);
      return;
    }
    map.fitBounds(
      {
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      },
      80,
    );
  }

  function showStreetView() {
    const position = positions[0];
    const map = mapRef.current;
    if (!position || !map) {
      setMessage('A driver location is needed before opening Street View.');
      return;
    }
    const panorama = map.getStreetView();
    panorama.setPosition({ lat: position.latitude, lng: position.longitude });
    panorama.setPov({ heading: position.heading ?? 0, pitch: 0 });
    panorama.setVisible(true);
  }

  async function send(position: GeolocationPosition) {
    const response = await fetch('/api/gps/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed ?? undefined,
        heading: position.coords.heading ?? undefined,
        recordedAt: new Date(position.timestamp).toISOString(),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        Array.isArray(payload.message)
          ? payload.message.join(' ')
          : payload.message || 'Unable to send location.',
      );
    setLastSent(new Date().toLocaleTimeString());
    void load();
  }

  function start() {
    if (!navigator.geolocation) {
      setMessage('This device does not support GPS location.');
      return;
    }
    setMessage('Requesting location permission...');
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        void send(position)
          .then(() => setMessage('Live location sharing is active.'))
          .catch((error) => {
            setMessage(error.message);
            stop();
          });
      },
      (error) => {
        setMessage(error.message);
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    setTracking(true);
  }

  function stop() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setTracking(false);
  }

  if (isDriver) {
    return (
      <>
        <PageHeader
          title="GPS Tracking"
          description="Start live location sharing from your phone during an assigned trip."
        />
        <section className="driver-gps-panel">
          <div className={`gps-signal ${tracking ? 'active' : ''}`}>
            <Radio size={26} />
            <div>
              <strong>{tracking ? 'You are sharing your live location' : 'Tracking is currently off'}</strong>
              <small>{lastSent ? `Last sent ${lastSent}` : 'No position sent this session'}</small>
            </div>
          </div>
          <p>
            Keep this page open while driving so fleet administrators can see your current position.
            You can stop tracking when the trip is complete.
          </p>
          {tracking ? (
            <button className="danger-action" onClick={stop}>
              <Square size={16} /> Stop tracking
            </button>
          ) : (
            <button className="primary-action" onClick={start}>
              <Crosshair size={16} /> Start tracking
            </button>
          )}
          {message && <div className="master-alert">{message}</div>}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="GPS Tracking"
        description="Live driver and allocated-vehicle positions from authenticated driver phones."
        actions={
          <span className="date-chip">
            <RadioTower size={15} /> {positions.filter((p) => p.connectionStatus === 'LIVE').length}{' '}
            live
          </span>
        }
      />
      <section className="gps-layout">
        <aside className="gps-control-panel">
          <div className={`gps-signal ${tracking ? 'active' : ''}`}>
            <Radio size={22} />
            <div>
              <strong>{tracking ? 'Sharing location' : 'Location sharing off'}</strong>
              <small>{lastSent ? `Last sent ${lastSent}` : 'No position sent this session'}</small>
            </div>
          </div>
          <p>Drivers should open this page on their phone and keep it active during the trip.</p>
          <div className="gps-map-actions">
            <button className="secondary-action" onClick={showFleetOverview}>
              <MapIcon size={16} /> Fleet overview
            </button>
            <button className="secondary-action" onClick={showStreetView}>
              <ZoomIn size={16} /> Street View
            </button>
          </div>
          <p className="gps-map-hint">Select a driver or use Street View to inspect the road view.</p>
          {tracking ? (
            <button className="danger-action" onClick={stop}>
              <Square size={16} /> Stop tracking
            </button>
          ) : (
            <button className="primary-action" onClick={start}>
              <Crosshair size={16} /> Start tracking
            </button>
          )}
          {message && <div className="master-alert">{message}</div>}
          <div className="gps-legend">
            <span>
              <i className="live" />
              Live
            </span>
            <span>
              <i className="stale" />
              Stale
            </span>
            <span>
              <i className="offline" />
              Offline
            </span>
          </div>
          <div className="gps-driver-list">
            {positions.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  mapRef.current?.panTo({ lat: p.latitude, lng: p.longitude });
                  mapRef.current?.setZoom(17);
                }}
              >
                <MapPin size={15} />
                <span>
                  <strong>{p.driver.staffName}</strong>
                  <small>
                    {p.vehicle?.registrationNumber ?? 'No vehicle'} ·{' '}
                    {new Date(p.recordedAt).toLocaleTimeString()}
                  </small>
                </span>
              </button>
            ))}
            {positions.length === 0 && <p>No driver locations have been received yet.</p>}
          </div>
        </aside>
        <div ref={container} className="gps-map" aria-label="Live fleet tracking map" />
      </section>
    </>
  );
}

function markerColor(status: LivePosition['connectionStatus']) {
  if (status === 'LIVE') return '#1aaa72';
  if (status === 'STALE') return '#e9a820';
  return '#8b95a5';
}

function driverPopup(position: LivePosition) {
  return `
    <div class="google-map-popup">
      <strong>${escapeHtml(position.driver.staffName)}</strong>
      <p>${escapeHtml(position.vehicle?.registrationNumber ?? 'No allocated vehicle')} &middot; ${escapeHtml(
        position.allocation?.destination ?? 'No destination',
      )} &middot; ${position.connectionStatus}</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });
}
