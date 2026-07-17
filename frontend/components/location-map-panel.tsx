'use client';

import type {
  GoogleGeocoder,
  GoogleGeocoderResult,
  GoogleMap,
  GoogleMapClickEvent,
  GoogleMapsNamespace,
  GoogleMarker,
  GooglePlace,
} from '@/lib/google-maps';
import { loadGoogleMaps } from '@/lib/google-maps';
import { Building2, Crosshair, MapPin, Search, Trash2, ZoomIn } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type LocationRecord = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  state?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type SearchResult = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

const MAPPED_LOCATION_PIN_URL = '/location-pin-flaticon.svg';

export function LocationMapPanel() {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<GoogleMap | null>(null),
    mapsRef = useRef<GoogleMapsNamespace | null>(null),
    infoWindow = useRef<InstanceType<GoogleMapsNamespace['InfoWindow']> | null>(null),
    hasFitLocations = useRef(false),
    markers = useRef<GoogleMarker[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]),
    [results, setResults] = useState<SearchResult[]>([]),
    [selected, setSelected] = useState<SearchResult | null>(null),
    [target, setTarget] = useState(''),
    [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/locations?limit=100&sortBy=name&sortOrder=asc');
    const payload = await response.json();
    setLocations(payload.data ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let disposed = false;
    void loadGoogleMaps()
      .then((maps) => {
        if (disposed || !container.current) return;
        mapsRef.current = maps;
        infoWindow.current = new maps.InfoWindow();
        const map = new maps.Map(container.current, {
          center: { lat: 9.082, lng: 8.6753 },
          zoom: 6,
          mapTypeControl: true,
          mapTypeId: maps.MapTypeId.ROADMAP,
          streetViewControl: true,
          fullscreenControl: true,
          restriction: {
            latLngBounds: { north: 14.5, south: 4, west: 2.5, east: 14.8 },
            strictBounds: false,
          },
        });
        map.addListener('click', (event: GoogleMapClickEvent) => {
          if (!event.latLng) return;
          const latitude = event.latLng.lat();
          const longitude = event.latLng.lng();
          setSelected({
            id: `manual-${latitude}-${longitude}`,
            displayName: `Pinned map position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            latitude,
            longitude,
          });
          setResults([]);
          setMessage('Map position selected. Select or confirm the registered location, then save it.');
        });
        mapRef.current = map;
      })
      .catch((error) => setMessage(error.message));

    return () => {
      disposed = true;
      const currentMarkers = markers.current;
      currentMarkers.forEach((marker) => marker.setMap(null));
      currentMarkers.length = 0;
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;

    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = [];

    const mappedLocations = locations.filter(
      (location) => location.latitude != null && location.longitude != null,
    );

    mappedLocations.forEach((location) => {
        const point = { lat: location.latitude!, lng: location.longitude! };
        const marker = new maps.Marker({
          map,
          position: point,
          title: `${location.name} (${location.code})`,
          icon: {
            url: MAPPED_LOCATION_PIN_URL,
            scaledSize: new maps.Size(42, 42),
            anchor: new maps.Point(21, 42),
          },
        });
        marker.addListener('click', () => {
          setTarget(location.id);
          setSelected({
            id: `registered-${location.id}`,
            displayName: `${location.name} (${location.code})`,
            latitude: location.latitude!,
            longitude: location.longitude!,
          });
          setMessage(`Showing the saved map position for ${location.name}.`);
          infoWindow.current?.setContent(
            `<div class="google-map-popup"><strong>${escapeHtml(location.name)}</strong><p>${escapeHtml(
              location.code,
            )}</p></div>`,
          );
          infoWindow.current?.open({ anchor: marker, map });
          map.panTo(point);
          map.setZoom(17);
        });
        markers.current.push(marker);
      });

    if (!selected && mappedLocations.length && !hasFitLocations.current) {
      const bounds = new maps.LatLngBounds();
      mappedLocations.forEach((location) =>
        bounds.extend({ lat: location.latitude!, lng: location.longitude! }),
      );
      map.fitBounds(bounds, 90);
      const listener = maps.event.addListenerOnce(map, 'idle', () => {
        const zoom = map.getZoom() ?? 6;
        if (mappedLocations.length === 1 || zoom > 8) map.setZoom(8);
        maps.event.removeListener(listener);
      });
      hasFitLocations.current = true;
    }

    if (selected) {
      const marker = new maps.Marker({
        map,
        position: { lat: selected.latitude, lng: selected.longitude },
        title: selected.displayName,
        label: { text: 'PIN', color: '#ffffff', fontSize: '10px', fontWeight: '800' },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          fillColor: '#e09b17',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 15,
        },
      });
      markers.current.push(marker);
      map.panTo({ lat: selected.latitude, lng: selected.longitude });
      map.setZoom(17);
    }
  }, [locations, selected]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('query') || '');
    const maps = mapsRef.current;
    if (!maps) {
      setMessage('Google Maps is still loading. Try again in a moment.');
      return;
    }
    setMessage('Searching Google Places...');
    try {
      const placeSearch = maps.places?.Place?.searchByText;
      if (!placeSearch) {
        setResults([]);
        setSelected(null);
        setMessage(
          'Google Places search is not available for this key. Enable Places API (New) or use a billing-enabled key.',
        );
        return;
      }
      const { places } = await placeSearch({
        textQuery: `${query}, Nigeria`,
        fields: ['displayName', 'formattedAddress', 'location', 'id'],
        locationRestriction: { north: 14.5, south: 4, west: 2.5, east: 14.8 },
        maxResultCount: 8,
        region: 'ng',
      });
      const placeResults = normalisePlaces(places);
      if (placeResults.length) {
        setResults(placeResults);
        setSelected(placeResults[0] ?? null);
        setMessage('');
        return;
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Google Places search failed: ${error.message}`
          : 'Google Places search failed.',
      );
      return;
    }

    try {
      await searchAddress(query, maps);
    } catch (error) {
      setResults([]);
      setSelected(null);
      setMessage(
        error instanceof Error
          ? `Google address fallback failed: ${error.message}`
          : 'Google address fallback failed.',
      );
    }
  }

  async function save() {
    if (!selected || !target) return;
    const response = await fetch(`/api/geocoding/locations/${target}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: selected.latitude, longitude: selected.longitude }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message);
      return;
    }
    setMessage('Map position saved.');
    await load();
  }

  async function deletePin() {
    if (!target) return;
    const location = locations.find((item) => item.id === target);
    if (!location || location.latitude == null || location.longitude == null) {
      setMessage('This location does not have a saved map pin to delete.');
      return;
    }
    const response = await fetch(`/api/geocoding/locations/${target}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message || 'Unable to delete the saved map pin.');
      return;
    }
    setSelected(null);
    setResults([]);
    setMessage(`Saved map pin deleted for ${location.name}.`);
    await load();
  }

  async function searchAddress(query: string, maps: GoogleMapsNamespace) {
    const geocoder: GoogleGeocoder = new maps.Geocoder();
    geocoder.geocode(
      { address: query, componentRestrictions: { country: 'NG' } },
      (geocoderItems: GoogleGeocoderResult[] | null, geocoderStatus: string) => {
        if (geocoderStatus !== 'OK' || !geocoderItems?.length) {
          setResults([]);
          setSelected(null);
          setMessage('No matching Google place or address found within Nigeria.');
          return;
        }
        const nextResults = geocoderItems.slice(0, 8).map((item) => ({
          id: item.place_id,
          displayName: item.formatted_address,
          latitude: item.geometry.location.lat(),
          longitude: item.geometry.location.lng(),
        }));
        setResults(nextResults);
        setSelected(nextResults[0] ?? null);
        setMessage('');
      },
    );
  }

  function selectRegisteredLocation(id: string) {
    setTarget(id);
    const location = locations.find((item) => item.id === id);
    if (!location) return;
    if (location.latitude == null || location.longitude == null) {
      setSelected(null);
      setMessage(`${location.name} has no saved map position yet. Search or click the map to set one.`);
      return;
    }
    const position = {
      id: `registered-${location.id}`,
      displayName: `${location.name} (${location.code})`,
      latitude: location.latitude,
      longitude: location.longitude,
    };
    setSelected(position);
    setResults([]);
    setMessage(`Showing the saved map position for ${location.name}.`);
    mapRef.current?.panTo({ lat: location.latitude, lng: location.longitude });
    mapRef.current?.setZoom(17);
  }

  function openStreetView() {
    if (!selected || !mapRef.current) return;
    const panorama = mapRef.current.getStreetView();
    panorama.setPosition({ lat: selected.latitude, lng: selected.longitude });
    panorama.setPov({ heading: 0, pitch: 0 });
    panorama.setVisible(true);
  }

  const targetLocation = target ? locations.find((location) => location.id === target) : null;
  const targetLocationIsMapped =
    targetLocation?.latitude != null && targetLocation?.longitude != null;

  return (
    <section className="location-map-panel">
      <div className="location-map-tools">
        <h2>Location map</h2>
        <p>
          Search for a place or click directly on the map, then link that pin to a registered
          location.
        </p>
        <form onSubmit={search}>
          <label>
            <Search size={16} />
            <input
              name="query"
              placeholder="Search address, office, depot, city..."
              required
              minLength={3}
            />
          </label>
          <button className="primary-action">Search Nigeria</button>
        </form>
        <div className="location-results">
          {results.map((result) => (
            <button key={result.id} onClick={() => setSelected(result)}>
              <MapPin size={15} />
              {result.displayName}
            </button>
          ))}
        </div>
        <select value={target} onChange={(event) => selectRegisteredLocation(event.target.value)}>
          <option value="">Select registered location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} ({location.code})
              {location.latitude != null && location.longitude != null ? ' - mapped' : ''}
            </option>
          ))}
        </select>
        {targetLocation && (
          <div className="location-details-card">
            <header>
              <Building2 size={16} />
              <div>
                <strong>{targetLocation.name}</strong>
                <span>
                  {targetLocation.code}
                  {targetLocation.status ? ` · ${targetLocation.status}` : ''}
                </span>
              </div>
            </header>
            {(targetLocation.address || targetLocation.state) && (
              <p>
                {[targetLocation.address, targetLocation.state].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="location-details-grid">
              <div>
                <span>Latitude</span>
                <strong>
                  {targetLocation.latitude != null ? targetLocation.latitude.toFixed(6) : 'Not set'}
                </strong>
              </div>
              <div>
                <span>Longitude</span>
                <strong>
                  {targetLocation.longitude != null
                    ? targetLocation.longitude.toFixed(6)
                    : 'Not set'}
                </strong>
              </div>
            </div>
          </div>
        )}
        {selected && (
          <div className="location-coordinate-card">
            <MapPin size={16} />
            <div>
              <strong>{selected.displayName}</strong>
              <span>
                {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
              </span>
            </div>
          </div>
        )}
        <div className="location-map-button-row">
          <button
            className="secondary-action"
            disabled={!selected || !target}
            onClick={() => void save()}
          >
            <Crosshair size={15} /> Save map position
          </button>
          <button
            className="secondary-action danger-action"
            disabled={!targetLocationIsMapped}
            onClick={() => void deletePin()}
          >
            <Trash2 size={15} /> Delete pin
          </button>
        </div>
        <button className="secondary-action" disabled={!selected} onClick={openStreetView}>
          <ZoomIn size={15} /> Open Street View
        </button>
        {message && <div className="master-alert">{message}</div>}
        <small>
          Google Maps · Pin icon inspired by{' '}
          <a href="https://www.flaticon.com/free-icons/pin" target="_blank" rel="noreferrer">
            Those Icons - Flaticon
          </a>
        </small>
      </div>
      <div ref={container} className="location-admin-map" />
    </section>
  );
}

function normalisePlaces(items: GooglePlace[] | null): SearchResult[] {
  return (items ?? [])
    .filter((item) => item.location && item.id)
    .slice(0, 8)
    .map((item) => ({
      id: item.id!,
      displayName: [item.displayName, item.formattedAddress].filter(Boolean).join(' - '),
      latitude: item.location!.lat(),
      longitude: item.location!.lng(),
    }));
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
