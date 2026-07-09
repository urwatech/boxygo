import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

const STATUS_CONFIG = {
    pending: { label: 'Pending', weight: 0.45, color: '#f97316' },
    assigned: { label: 'Assigned', weight: 0.55, color: '#fb923c' },
    accepted: { label: 'Accepted', weight: 0.6, color: '#f59e0b' },
    in_transit: { label: 'In Transit', weight: 0.75, color: '#ef4444' },
    picked_up: { label: 'Picked Up', weight: 0.65, color: '#f97316' },
    delayed: { label: 'Delayed', weight: 0.95, color: '#dc2626' },
    delivered: { label: 'Delivered', weight: 0.35, color: '#22c55e' },
    cancelled: { label: 'Cancelled', weight: 0.2, color: '#6b7280' },
    returned: { label: 'Returned', weight: 0.3, color: '#0ea5e9' },
};

const normalizeStatusKey = (status) => {
    if (!status) {
        return 'unknown';
    }

    return status
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
};

const toReadableLabel = (value) => value
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char?.toUpperCase());

const getStatusMeta = (status) => {
    const key = normalizeStatusKey(status);
    const preset = STATUS_CONFIG[key];

    return {
        key,
        label: preset?.label ?? (status ? toReadableLabel(status) : 'Unknown'),
        weight: preset?.weight ?? 0.5,
        color: preset?.color ?? '#94a3b8',
    };
};

const loadScript = (src) => new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
        resolve();
        return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
        if (existing.dataset.loaded === 'true') {
            resolve();
        } else {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        }
        return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.loaded = 'false';

    script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });

    document.body.appendChild(script);
});

const ensureGoogleMaps = async (apiKey) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (window.google?.maps?.visualization) {
        return;
    }

    if (!apiKey) {
        throw new Error('Google Maps API key is missing.');
    }

    if (window.google?.maps?.importLibrary) {
        await window.google.maps.importLibrary('visualization');
        return;
    }

    const scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`;
    await loadScript(scriptSrc);

    if (!window.google?.maps?.visualization && window.google?.maps?.importLibrary) {
        await window.google.maps.importLibrary('visualization');
    }
};


const SYRIA_BOUNDS = [32.31, 37.31, 35.73, 42.45]; // [minLat, maxLat, minLon, maxLon]
const MIN_SYRIA_ZOOM = 7;


export default function HeatmapWidget({ shipments = [], riders = [], compact = true, showFullscreenButton = true }) {
    const { t } = useTranslation();
    const page = usePage?.() || {};
    const config = page?.props?.config || {};
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const heatLayerRef = useRef(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [viewMode, setViewMode] = useState('parcel'); // 'parcel' or 'riders'

    const ACTIVITY_LEVELS = [
        { key: 'very_busy', label: t('superAdminHeatmapActivityVeryBusy'), minWeight: 0.75, color: '#b91c1c' },
        { key: 'moderate_busy', label: t('superAdminHeatmapActivityModerateBusy'), minWeight: 0.55, color: '#f97316' },
        { key: 'low_busy', label: t('superAdminHeatmapActivityLowBusy'), minWeight: 0, color: '#fbbf24' },
    ];
    
    const getActivityLevel = (weight) => {
        const resolvedWeight = Number.isFinite(weight) ? weight : 0;
        const level = ACTIVITY_LEVELS.find((item) => resolvedWeight >= item.minWeight);
    
        return level ?? ACTIVITY_LEVELS[ACTIVITY_LEVELS.length - 1];
    };

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }
        
        let isCancelled = false;
        
        const load = async () => {
            try {
                await ensureGoogleMaps(googleMapsApiKey);
                if (isCancelled) {
                    return;
                }
                if (!mapContainerRef.current) {
                    return;
                }

                const strictBounds = new window.google.maps.LatLngBounds(
                    new window.google.maps.LatLng(SYRIA_BOUNDS[0], SYRIA_BOUNDS[2]),
                    new window.google.maps.LatLng(SYRIA_BOUNDS[1], SYRIA_BOUNDS[3])
                );

                const map = new window.google.maps.Map(mapContainerRef.current, {
                    center: { lat: 33.5138, lng: 36.2765 },
                    zoom: MIN_SYRIA_ZOOM,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    clickableIcons: false,
                    zoomControl: false,
                    gestureHandling: 'greedy',
                    restriction: {
                        latLngBounds: strictBounds,
                        strictBounds: true,
                    },
                    minZoom: MIN_SYRIA_ZOOM,
                });

                mapInstanceRef.current = map;

                const heatLayer = new window.google.maps.visualization.HeatmapLayer({
                    data: [],
                    map,
                    radius: compact ? 24 : 36,
                    opacity: 0.35,
                    maxIntensity: 1,
                    gradient: [
                        'rgba(0,0,0,0)',
                        'rgba(251,191,36,0.55)',
                        'rgba(249,115,22,0.65)',
                        'rgba(239,68,68,0.75)',
                        'rgba(185,28,28,0.9)'
                    ],
                });

                heatLayerRef.current = heatLayer;
                setIsMapReady(true);

                setTimeout(() => {
                    window.google?.maps?.event?.trigger(map, 'resize');
                }, 150);
            } catch (error) {
                console.error(error);
                if (!isCancelled) {
                    setMapError(error?.message || 'Could not load the map.');
                }
            }
        };

        load();

        return () => {
            isCancelled = true;
            if (mapInstanceRef.current) {
                mapInstanceRef.current = null;
            }
            if (heatLayerRef.current) {
                heatLayerRef.current.setMap(null);
                heatLayerRef.current = null;
            }
        };
    }, [compact, googleMapsApiKey]);

    const heatPoints = useMemo(() => {
        // Show rider locations when viewMode is 'riders'
        if (viewMode === 'riders') {
            if (!Array.isArray(riders)) {
                return [];
            }

            return riders
                .filter((rider) =>
                    rider?.latitude !== undefined &&
                    rider?.latitude !== null &&
                    rider?.longitude !== undefined &&
                    rider?.longitude !== null
                )
                .map((rider) => [
                    parseFloat(rider.latitude),
                    parseFloat(rider.longitude),
                    0.8 // Fixed weight for riders
                ])
                .filter((point) => (
                    point.length === 3
                    && Number.isFinite(point[0])
                    && Number.isFinite(point[1])
                ));
        }

        // Show parcel locations when viewMode is 'parcel'
        if (!Array.isArray(shipments)) {
            return [];
        }

        return shipments.flatMap((shipment) => {
            const meta = getStatusMeta(shipment.status);
            const weight = Number.isFinite(meta.weight) ? meta.weight : 0.5;
            const points = [];

            if (shipment?.handover?.lat !== undefined && shipment?.handover?.lng !== undefined) {
                points.push([shipment.handover.lat, shipment.handover.lng, weight]);
            }

            if (shipment?.delivery?.lat !== undefined && shipment?.delivery?.lng !== undefined) {
                points.push([shipment.delivery.lat, shipment.delivery.lng, Math.min(1, weight + 0.05)]);
            }

            return points;
        }).filter((point) => (
            point.length === 3
            && Number.isFinite(point[0])
            && Number.isFinite(point[1])
        ));
    }, [shipments, riders, viewMode]);

    const activitySummary = useMemo(() => {
        const summary = ACTIVITY_LEVELS.map((level) => ({
            key: level.key,
            label: level.label,
            color: level.color,
            count: 0,
        }));

        shipments.forEach((shipment) => {
            const meta = getStatusMeta(shipment.status);
            const level = getActivityLevel(meta.weight);
            const bucket = summary.find((item) => item.key === level.key);

            if (bucket) {
                bucket.count += 1;
            }
        });

        return summary;
    }, [shipments]);

    useEffect(() => {
        if (!isMapReady || !heatLayerRef.current) {
            return;
        }

        const map = mapInstanceRef.current;
        const google = window.google;

        if (!map || !google?.maps) {
            return;
        }

        const points = heatPoints.map(([lat, lng, weight]) => ({
            location: new google.maps.LatLng(lat, lng),
            weight: Number.isFinite(weight) ? weight : 0.5,
        }));

        heatLayerRef.current.setData(points);

        if (heatPoints.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            heatPoints.forEach(([lat, lng]) => bounds.extend(new google.maps.LatLng(lat, lng)));
            if (heatPoints.length === 1) {
                map.setCenter(bounds.getCenter());
                map.setZoom(12);
            } else {
                map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
                if (map.getZoom() < MIN_SYRIA_ZOOM) {
                    map.setZoom(MIN_SYRIA_ZOOM);
                }
            }
        } else {
            // Default to Damascus, Syria center
            map.setCenter({ lat: 33.5138, lng: 36.2765 });
            map.setZoom(MIN_SYRIA_ZOOM);
        }
    }, [heatPoints, isMapReady]);

    const handleFullscreen = () => {
        router.visit(route('admin.heatmap.index'));
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 cursor-default flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-800 text-base">{t('commonHeatmap')}</h3>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value)}
                            className="border border-gray-200 rounded-full text-sm pl-3 pr-8 py-1.5 font-medium text-gray-600 appearance-none cursor-pointer focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        >
                            <option value="parcel">Parcel</option>
                            <option value="riders">Riders</option>
                        </select>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                </div>
            </div>

            <div className={`rounded-xl overflow-hidden mb-4 relative ${compact ? 'h-40' : 'h-[460px] md:h-[600px]'}`}>
                {mapError && (
                    <div className="absolute inset-0 z-[1300] flex items-center justify-center bg-white/85 px-6 text-center text-xs text-red-500">
                        {mapError}
                    </div>
                )}
                {!isMapReady && !mapError && (
                    <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-slate-50 text-xs text-slate-500">
                        Loading map...
                    </div>
                )}
                <div ref={mapContainerRef} className="relative z-0 h-full w-full" />

                {showFullscreenButton && (
                    <button
                        type="button"
                        onClick={handleFullscreen}
                        className="pointer-events-auto absolute bottom-4 right-4 z-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#338DFF] text-white shadow-[0_12px_30px_rgba(51,141,255,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(51,141,255,0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 cursor-pointer"
                        aria-label="Open heatmap in full view"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                        >
                            <path d="M8 3H3v5" />
                            <path d="M3 3 9 9" />
                            <path d="M16 21h5v-5" />
                            <path d="m21 21-6-6" />
                        </svg>
                    </button>
                )}
            </div>

            {compact && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <div className="flex items-center gap-4 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                        {activitySummary.map((status, index) => (
                            <div
                                key={status.key}
                                className={`flex items-center gap-2 ${index !== 0 ? 'border-l border-slate-200 pl-3' : ''}`}
                            >
                                <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: status.color }}
                                />
                                {status?.label?.toUpperCase()}
                            </div>
                        ))}
                    </div>
                    {/* <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                        Parcel
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4 text-slate-400"
                        >
                            <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.939l3.71-3.71a.75.75 0 1 1 1.06 1.062l-4.24 4.25a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 .01-1.06Z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button> */}
                </div>
            )}
        </div>
    );
}
