'use client';

export type GooglePoint = { lat: number; lng: number };
export type GoogleMapsListener = unknown;
export type GoogleLatLng = { lat: () => number; lng: () => number };
export type GoogleMapClickEvent = { latLng?: GoogleLatLng };
export type GoogleGeocoderResult = {
  place_id: string;
  formatted_address: string;
  geometry: { location: GoogleLatLng };
};
export type GooglePlacesResult = {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  geometry?: { location?: GoogleLatLng };
};
export type GooglePlace = {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  location?: GoogleLatLng;
};
export type GoogleMarker = {
  addListener: (eventName: string, handler: () => void) => GoogleMapsListener;
  setLabel: (label: Record<string, unknown> | string | null) => void;
  setIcon: (icon: Record<string, unknown>) => void;
  setMap: (map: GoogleMap | null) => void;
  setPosition: (point: GooglePoint) => void;
  setTitle: (title: string) => void;
};
export type GoogleStreetViewPanorama = {
  setPosition: (point: GooglePoint) => void;
  setPov: (pov: { heading: number; pitch: number }) => void;
  setVisible: (visible: boolean) => void;
};
export type GoogleMap = {
  addListener: (eventName: string, handler: (event: GoogleMapClickEvent) => void) => GoogleMapsListener;
  fitBounds: (bounds: unknown, padding?: number) => void;
  getStreetView: () => GoogleStreetViewPanorama;
  getZoom: () => number | undefined;
  panTo: (point: GooglePoint) => void;
  setZoom: (zoom: number) => void;
};
export type GoogleGeocoder = {
  geocode: (
    request: Record<string, unknown>,
    callback: (items: GoogleGeocoderResult[] | null, status: string) => void,
  ) => void;
};
export type GooglePlacesService = {
  findPlaceFromQuery: (
    request: Record<string, unknown>,
    callback: (items: GooglePlacesResult[] | null, status: string) => void,
  ) => void;
  textSearch: (
    request: Record<string, unknown>,
    callback: (items: GooglePlacesResult[] | null, status: string) => void,
  ) => void;
};
export type GooglePlacesLibrary = {
  Place: {
    searchByText: (request: Record<string, unknown>) => Promise<{ places: GooglePlace[] }>;
  };
};
export type GoogleMapsNamespace = {
  Geocoder: new () => GoogleGeocoder;
  InfoWindow: new () => {
    open: (options: { anchor: GoogleMarker; map: GoogleMap }) => void;
    setContent: (content: string) => void;
  };
  LatLngBounds: new () => { extend: (point: GooglePoint) => void };
  Map: new (container: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  Point: new (x: number, y: number) => unknown;
  Size: new (width: number, height: number) => unknown;
  MapTypeId: { ROADMAP: string };
  SymbolPath: { CIRCLE: unknown };
  places: {
    Place: GooglePlacesLibrary['Place'];
    PlacesService: new (map: GoogleMap) => GooglePlacesService;
    PlacesServiceStatus: { OK: string };
  };
  event: {
    addListenerOnce: (
      target: GoogleMap,
      eventName: string,
      handler: () => void,
    ) => GoogleMapsListener;
    removeListener: (listener: GoogleMapsListener) => void;
  };
};

let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null;

declare global {
  interface Window {
    __initFleetGoogleMaps?: () => void;
    google?: { maps: GoogleMapsNamespace };
  }
}

export function hasGoogleMapsKey() {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(
      new Error('Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to frontend/.env.local to enable Google Maps.'),
    );
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      reject(new Error('Google Maps loaded, but the Maps library was unavailable.'));
    };
    window.__initFleetGoogleMaps = finish;

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-api]');
    if (existing) {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.dataset.googleMapsApi = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places&v=weekly&callback=__initFleetGoogleMaps`;
    script.onload = finish;
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
