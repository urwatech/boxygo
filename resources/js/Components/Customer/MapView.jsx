import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { getOSMEmbedUrl, reverseGeocode } from '../../Services/LocationService';

export default function MapView({
  center = [34.8021, 38.9968], // Default to center of Syria
  zoom = 8, // Zoom level to show full Syria (increased from 7 to 8 for better fit)
  heightClass = 'h-screen md:h-[65vh]',
  marker,
  provider = 'openstreetmap', // 'openstreetmap' or 'google'
  viewbox = null, // [minLat, maxLat, minLon, maxLon] - defaults to Syria bounds
  hideViewLargerLink = false, // Hide the "View larger map" link
  draggableMarker = false,
  onMarkerChange,
  showFullscreenToggle = false,
}) {
  const page = usePage?.() || {};
  const { t } = useTranslation();
  const config = page?.props?.config || {};
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const [useInteractiveMap, setUseInteractiveMap] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isDraggingRef = useRef(false);

  // Use config from page props if available, otherwise use prop
  const mapProvider = config?.MAP_PROVIDER || provider || 'openstreetmap';
  const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;

  // Syria boundaries: [minLat, maxLat, minLon, maxLon]
  const syriaBounds = viewbox || [32.31, 37.31, 35.73, 42.45];

  // Debug logging (remove in production)
  if (typeof window !== 'undefined' && window.location.pathname.includes('dashboard')) {
    console.log('[MapView] Config:', { mapProvider, hasApiKey: !!googleMapsApiKey });
  }

  const mark = marker || center;

  // Keep refs to latest values so initMap closure reads current data
  const markRef = useRef(mark);
  const zoomRef = useRef(zoom);
  useEffect(() => { markRef.current = mark; }, [mark]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Use interactive map for Google Maps to enforce boundaries
  useEffect(() => {
    if (mapProvider === 'google' && googleMapsApiKey) {
      setUseInteractiveMap(true);
    }
  }, [mapProvider, googleMapsApiKey]);

  const handleMarkerDragEnd = useCallback(
    async (event) => {
      if (!draggableMarker || !onMarkerChange) {
        return;
      }

      isDraggingRef.current = true;
      const lat = event.latLng.lat();
      const lon = event.latLng.lng();

      setIsResolvingLocation(true);
      try {
        const result = await reverseGeocode(lat, lon, {
          provider: mapProvider,
          googleGeocodingApiKey: googleMapsApiKey,
        });

        onMarkerChange({
          address: result.address,
          lat: result.lat,
          lon: result.lon,
          latitude: result.lat,
          longitude: result.lon,
          components: result.components || {},
        });
      } catch (error) {
        console.error('Failed to update location from map drag', error);
        onMarkerChange({
          address: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
          lat,
          lon,
          latitude: lat,
          longitude: lon,
          components: {},
        });
      } finally {
        setIsResolvingLocation(false);
      }
    },
    [draggableMarker, onMarkerChange, mapProvider, googleMapsApiKey]
  );

  const attachMarkerDragListener = useCallback(
    (markerInstance) => {
      if (!markerInstance || !window.google) {
        return;
      }

      window.google.maps.event.clearListeners(markerInstance, 'dragend');
      markerInstance.setDraggable(Boolean(draggableMarker));

      if (draggableMarker && onMarkerChange) {
        markerInstance.addListener('dragend', handleMarkerDragEnd);
      }
    },
    [draggableMarker, onMarkerChange, handleMarkerDragEnd]
  );

 const src = useMemo(() => {
    if (mapProvider === 'google') {
      if (!googleMapsApiKey) {
        console.warn('Google Maps API key not available, falling back to OpenStreetMap');
        return getOSMEmbedUrl(center, zoom, mark, syriaBounds);
      }

      const [lat, lng] = mark || center;
      // Restrict map to Syria boundaries
      const minLat = syriaBounds[0]; // 32.31
      const maxLat = syriaBounds[1]; // 37.31
      const minLon = syriaBounds[2]; // 35.73
      const maxLon = syriaBounds[3]; // 42.45

      // Build Google Maps embed URL with region restriction
      return `https://www.google.com/maps/embed/v1/view?key=${googleMapsApiKey}&center=${lat},${lng}&zoom=${zoom}&maptype=roadmap&region=SY`;
    }

    return getOSMEmbedUrl(center, zoom, mark, syriaBounds);
  }, [center, zoom, mark, mapProvider, googleMapsApiKey, syriaBounds]);

  const isGoogleMaps = mapProvider === 'google' && googleMapsApiKey;
  const mapTitle = isGoogleMaps ? t('mapViewGoogleMapsTitle') : t('mapViewOpenStreetMapTitle');

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isActive = document.fullscreenElement === containerRef.current;
      setIsFullscreen(isActive);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        return;
      }

      if (containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Failed to toggle fullscreen mode', error);
    }
  }, []);

  // Initialize Google Maps with boundary restrictions (runs once)
  useEffect(() => {
    if (!useInteractiveMap || !mapRef.current || !googleMapsApiKey) return;

    // Already initialized — skip
    if (mapInstanceRef.current) return;

    // Load Google Maps script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => initMap();
      return;
    }

    initMap();

    function initMap() {
      if (!window.google || !mapRef.current) return;

      const [lat, lng] = markRef.current;
      const initialZoom = zoomRef.current;

      // Define strict bounds for Syria
      const strictBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(syriaBounds[0], syriaBounds[2]), // SW corner
        new window.google.maps.LatLng(syriaBounds[1], syriaBounds[3])  // NE corner
      );

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: initialZoom,
        restriction: {
          latLngBounds: strictBounds,
          strictBounds: true, // This prevents panning outside Syria
        },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        minZoom: 7, // Prevent zooming out too far
        maxZoom: 18,
      });

      // Add marker
      const markerInstance = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: t('commonLocation'),
        draggable: Boolean(draggableMarker),
      });

      attachMarkerDragListener(markerInstance);

      mapInstanceRef.current = map;
      markerInstanceRef.current = markerInstance;
    }

    return () => {
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setMap(null);
        markerInstanceRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, [useInteractiveMap, googleMapsApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!useInteractiveMap || !markerInstanceRef.current) {
      return;
    }

    attachMarkerDragListener(markerInstanceRef.current);
  }, [useInteractiveMap, attachMarkerDragListener]);

  // Update marker position when it changes (preserve user's zoom level on drag)
  useEffect(() => {
    if (mapInstanceRef.current && markerInstanceRef.current && useInteractiveMap) {
      const [lat, lng] = mark;
      const newPos = { lat, lng };
      markerInstanceRef.current.setPosition(newPos);

      if (isDraggingRef.current) {
        // Pin was dragged — just pan, keep the user's current zoom
        isDraggingRef.current = false;
        mapInstanceRef.current.panTo(newPos);
      } else {
        // New address selected (search/input) — zoom in to show the location
        mapInstanceRef.current.setCenter(newPos);
        mapInstanceRef.current.setZoom(15);
      }
    }
  }, [mark, useInteractiveMap]);

  // Hide bottom map UI elements (coordinates, location info, directions link)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const style = document.createElement('style');
    const clipPath = hideViewLargerLink ? 'inset(0 0 80px 0)' : 'none';
    style.textContent = `
      [data-map-container] {
        position: relative;
        overflow: hidden;
      }
      /* Hide the info panel at the bottom of Google Maps */
      ${hideViewLargerLink ? `
      [data-map-container] .gm-style-mtc,
      [data-map-container] [role="contentinfo"],
      [data-map-container] .gmnoprint {
        display: none !important;
      }
      /* Target the specific "View larger map" link structure */
      [data-map-container] .default-card,
      [data-map-container] .google-maps-link,
      [data-map-container] a[aria-label="View larger map"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      /* Hide the parent container of the View larger map link */
      [data-map-container] iframe > div[style*="position: absolute"][style*="left: 0px"][style*="top: 0px"] {
        display: none !important;
      }
      ` : ''}
      /* Hide bottom controls and info when hideViewLargerLink is true */
      [data-map-container] iframe {
        clip-path: ${clipPath};
        object-fit: cover;
        object-position: center top;
      }
    `;
    container.appendChild(style);

    return () => {
      if (container.contains(style)) {
        container.removeChild(style);
      }
    };
  }, [hideViewLargerLink]);

  if (draggableMarker && (mapProvider !== 'google' || !googleMapsApiKey)) {
    return (
      <div className={`w-full ${heightClass} md:rounded-2xl overflow-hidden relative bg-gray-100 flex items-center justify-center`}>
        <div className="text-center p-6">
          <p className="text-gray-600 mb-2">{t('draggableMapRequiresGoogleMaps')}</p>
          <p className="text-sm text-gray-500">{t('draggableMapRequiresApiKey')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-map-container
      className={`w-full ${heightClass} ${isFullscreen ? 'rounded-none' : 'md:rounded-2xl'} overflow-hidden relative`}
    >
      {useInteractiveMap ? (
        // Interactive Google Maps with strict boundaries
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
          }}
          aria-label="Google Maps view"
        />
      ) : (
        // Fallback to iframe for OpenStreetMap or when Google Maps API is not available
        <iframe
          title={mapTitle}
          src={src}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            filter: isGoogleMaps ? 'none' : 'grayscale(75%) brightness(1.06)',
          }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen={true}
          aria-label={t('mapViewEmbeddedAriaLabel', { provider: mapTitle })}
        />
      )}
      {/* Overlay to block bottom map controls when hideViewLargerLink is true */}
      {hideViewLargerLink && !useInteractiveMap && (
        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-transparent pointer-events-none"
          style={{ zIndex: 10 }}
        />
      )}
      {/* Fallback link for larger map view (OSM only) */}
      {!hideViewLargerLink && !isGoogleMaps && (
        <a
          href={`https://www.openstreetmap.org/?mlat=${mark[0]}&mlon=${mark[1]}#map=${zoom}/${center[0]}/${center[1]}`}
          target="_blank"
          rel="noreferrer"
          className="sr-only"
        >
          {t('mapViewViewLarger')}
        </a>
      )}
      {!hideViewLargerLink && isGoogleMaps && (
        <a
          href={`https://maps.google.com/?q=${mark[0]},${mark[1]}`}
          target="_blank"
          rel="noreferrer"
          className="sr-only"
        >
          {t('mapViewViewOnGoogle')}
        </a>
      )}
      {isResolvingLocation && (
        <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">{t('mapViewUpdatingAddress')}</span>
        </div>
      )}
      {showFullscreenToggle && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? t('mapViewExitFullscreen') : t('mapViewEnterFullscreen')}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-lg bg-white/90 p-2 text-slate-700 shadow-md backdrop-blur transition hover:bg-white"
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
