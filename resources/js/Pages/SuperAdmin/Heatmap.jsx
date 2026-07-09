import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import SuperAdminAuthenticated from '../Layouts/SuperAdminAuthenticated';

const STATUS_CONFIG = {
    pending: { labelKey: 'superAdminHeatmapStatusPending', weight: 0.45, color: '#f97316' },
    assigned: { labelKey: 'superAdminHeatmapStatusAssigned', weight: 0.55, color: '#fb923c' },
    accepted: { labelKey: 'superAdminHeatmapStatusAccepted', weight: 0.6, color: '#f59e0b' },
    in_transit: { labelKey: 'superAdminHeatmapStatusInTransit', weight: 0.75, color: '#ef4444' },
    picked_up: { labelKey: 'superAdminHeatmapStatusPickedUp', weight: 0.65, color: '#f97316' },
    delayed: { labelKey: 'superAdminHeatmapStatusDelayed', weight: 0.95, color: '#dc2626' },
    delivered: { labelKey: 'superAdminHeatmapStatusDelivered', weight: 0.35, color: '#22c55e' },
    cancelled: { labelKey: 'superAdminHeatmapStatusCancelled', weight: 0.2, color: '#6b7280' },
    returned: { labelKey: 'superAdminHeatmapStatusReturned', weight: 0.3, color: '#0ea5e9' },
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
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeCityKey = (value) => {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
};

const getStatusMeta = (status, t) => {
    const key = normalizeStatusKey(status);
    const preset = STATUS_CONFIG[key];

    return {
        key,
        label: preset?.labelKey
            ? t(preset.labelKey)
            : (status ? toReadableLabel(status) : t('statusUnknown')),
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

const ensureGoogleMaps = async (apiKey, t) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (window.google?.maps?.visualization) {
        return;
    }

    if (!apiKey) {
        throw new Error(t('superAdminHeatmapMissingApiKey'));
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

const ACTIVITY_LEVELS = [
    { key: 'very_busy', labelKey: 'superAdminHeatmapActivityVeryBusy', minWeight: 0.75, color: '#b91c1c' },
    { key: 'moderate_busy', labelKey: 'superAdminHeatmapActivityModerateBusy', minWeight: 0.55, color: '#f97316' },
    { key: 'low_busy', labelKey: 'superAdminHeatmapActivityLowBusy', minWeight: 0, color: '#fbbf24' },
];

const SYRIA_BOUNDS = [32.31, 37.31, 35.73, 42.45]; // [minLat, maxLat, minLon, maxLon]
const MIN_SYRIA_ZOOM = 7;

const getActivityLevel = (weight) => {
    const resolvedWeight = Number.isFinite(weight) ? weight : 0;
    const level = ACTIVITY_LEVELS.find((item) => resolvedWeight >= item.minWeight);

    return level ?? ACTIVITY_LEVELS[ACTIVITY_LEVELS.length - 1];
};

const clearMarkers = (markersRef) => {
    if (!markersRef.current) {
        markersRef.current = [];
        return;
    }
    markersRef.current.forEach((marker) => marker?.setMap?.(null));
    markersRef.current = [];
};

const fitMapToCoordinates = (map, google, coordinates) => {
    if (!map || !google?.maps || !Array.isArray(coordinates) || coordinates.length === 0) {
        return false;
    }

    const bounds = new google.maps.LatLngBounds();
    coordinates.forEach(({ lat, lng }) => {
        bounds.extend(new google.maps.LatLng(lat, lng));
    });

    if (coordinates.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(12);
        return true;
    }

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    if (map.getZoom() < MIN_SYRIA_ZOOM) {
        map.setZoom(MIN_SYRIA_ZOOM);
    }

    return true;
};

const getFirstDisplayValue = (...values) => {
    for (const value of values) {
        if (value === null || value === undefined) {
            continue;
        }

        const normalized = String(value).trim();
        if (normalized) {
            return normalized;
        }
    }

    return '--';
};

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderDetailRow = (label, value) => `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;text-align:left;font-size:14px;">
        <span style="font-weight:500;color:#64748b;flex-shrink:0;">${escapeHtml(label)}:</span>
        <span style="color:#111827;text-align:right;word-break:break-word;flex:1;">${escapeHtml(value)}</span>
    </div>
`;

const renderDropPointInfo = (point, t) => {
    const dropPointName = getFirstDisplayValue(point?.name);
    const dpNumber = getFirstDisplayValue(point?.dp_no);
    const keeperName = getFirstDisplayValue(point?.keeper?.name);
    const city = getFirstDisplayValue(point?.city);
    const address = getFirstDisplayValue(point?.address);

    return `
        <div style="min-width:280px;max-width:320px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:16px;display:flex;flex-direction:column;gap:12px;font-family:'Inter',sans-serif;box-shadow:0 10px 25px rgba(15,23,42,0.12);overflow:hidden;">
            ${renderDetailRow(t('commonDropPointName'), dropPointName)}
            ${renderDetailRow(t('commonDpNumber'), dpNumber)}
            ${renderDetailRow(t('superAdminHeatmapDropPointKeeperName'), keeperName)}
            ${renderDetailRow(t('commonCity'), city)}
            ${renderDetailRow(t('commonAddress'), address)}
        </div>
    `;
};

export default function Heatmap({ shipments = [], riders = [], dropPoints = [], warehouses = [], cities = [] }) {
    const { t } = useTranslation();
    const page = usePage?.() || {};
    const config = page?.props?.config || {};
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const heatLayerRef = useRef(null);
    const riderMarkersRef = useRef([]);
    const dropPointMarkersRef = useRef([]);
    const warehouseMarkersRef = useRef([]);
    const infoWindowRef = useRef(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [viewMode, setViewMode] = useState('parcel'); // 'parcel' | 'riders' | 'drop_points' | 'warehouses'
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [selectedCity, setSelectedCity] = useState('all');
    const showRegionFilters = false; // Hide governorate/sub-area chips per latest design

    const cityLabelLookup = useMemo(() => {
        const lookup = new Map();

        (Array.isArray(cities) ? cities : []).forEach((city) => {
            const label = String(city?.name ?? '').trim();
            const key = normalizeCityKey(label);
            if (key && label && !lookup.has(key)) {
                lookup.set(key, label);
            }
        });

        return lookup;
    }, [cities]);

    const cityCoordinatesByKey = useMemo(() => {
        const lookup = new Map();

        (Array.isArray(cities) ? cities : []).forEach((city) => {
            const label = String(city?.name ?? '').trim();
            const key = normalizeCityKey(label);
            const latitude = city?.latitude !== undefined && city?.latitude !== null ? Number(city.latitude) : null;
            const longitude = city?.longitude !== undefined && city?.longitude !== null ? Number(city.longitude) : null;
            if (key && label) {
                lookup.set(key, {
                    label,
                    latitude,
                    longitude,
                });
            }
        });

        return lookup;
    }, [cities]);

    const selectedCityKey = selectedCity === 'all' ? 'all' : normalizeCityKey(selectedCity);

    const selectedCityMeta = useMemo(() => {
        if (selectedCity === 'all') {
            return null;
        }

        return cityCoordinatesByKey.get(selectedCityKey) || null;
    }, [cityCoordinatesByKey, selectedCity, selectedCityKey]);

    const selectedCityCenter = useMemo(() => {
        if (!selectedCityMeta) {
            return null;
        }

        return Number.isFinite(selectedCityMeta.latitude) && Number.isFinite(selectedCityMeta.longitude)
            ? { lat: selectedCityMeta.latitude, lng: selectedCityMeta.longitude }
            : null;
    }, [selectedCityMeta]);

    const cityOptions = useMemo(() => {
        const labels = new Map();
        const addOption = (value) => {
            const key = normalizeCityKey(value);
            if (!key || labels.has(key)) {
                return;
            }

            labels.set(key, cityLabelLookup.get(key) || String(value).trim());
        };

        if (viewMode === 'parcel') {
            shipments.forEach((shipment) => {
                addOption(shipment?.handover?.city);
                addOption(shipment?.delivery?.city);
            });
        } else if (viewMode === 'drop_points') {
            dropPoints.forEach((point) => addOption(point?.city));
        } else if (viewMode === 'warehouses') {
            warehouses.forEach((warehouse) => addOption(warehouse?.city));
        }

        if (labels.size === 0) {
            cityLabelLookup.forEach((label, key) => {
                labels.set(key, label);
            });
        }

        return Array.from(labels.entries())
            .map(([key, label]) => ({ key, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [cityLabelLookup, dropPoints, shipments, viewMode, warehouses]);

    const isCityFilterDisabled = viewMode === 'riders' || cityOptions.length === 0;

    useEffect(() => {
        if (viewMode === 'riders' || selectedCity === 'all') {
            return;
        }

        const exists = cityOptions.some((option) => option.key === selectedCityKey);
        if (!exists) {
            setSelectedCity('all');
        }
    }, [cityOptions, selectedCity, selectedCityKey, viewMode]);

    const filteredShipments = useMemo(() => {
        if (selectedCity === 'all') {
            return shipments;
        }

        return shipments.filter((shipment) => {
            const handoverKey = normalizeCityKey(shipment?.handover?.city);
            const deliveryKey = normalizeCityKey(shipment?.delivery?.city);
            return handoverKey === selectedCityKey || deliveryKey === selectedCityKey;
        });
    }, [selectedCity, selectedCityKey, shipments]);

    const filteredDropPoints = useMemo(() => {
        if (selectedCity === 'all' || viewMode === 'riders') {
            return dropPoints;
        }

        return dropPoints.filter((point) => normalizeCityKey(point?.city) === selectedCityKey);
    }, [dropPoints, selectedCity, selectedCityKey, viewMode]);

    const filteredWarehouses = useMemo(() => {
        if (selectedCity === 'all' || viewMode === 'riders') {
            return warehouses;
        }

        return warehouses.filter((warehouse) => normalizeCityKey(warehouse?.city) === selectedCityKey);
    }, [selectedCity, selectedCityKey, viewMode, warehouses]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        let isCancelled = false;

        const load = async () => {
            try {
                    await ensureGoogleMaps(googleMapsApiKey, t);
                if (isCancelled) {
                    return;
                }
                if (!mapContainerRef.current) {
                    return;
                }

                // const strictBounds = new window.google.maps.LatLngBounds(
                //     new window.google.maps.LatLng(SYRIA_BOUNDS[0], SYRIA_BOUNDS[2]),
                //     new window.google.maps.LatLng(SYRIA_BOUNDS[1], SYRIA_BOUNDS[3])
                // );

                const map = new window.google.maps.Map(mapContainerRef.current, {
                    center: { lat: 33.5138, lng: 36.2765 },
                    zoom: MIN_SYRIA_ZOOM,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    clickableIcons: false,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    // restriction: {
                    //     latLngBounds: strictBounds,
                    //     strictBounds: true,
                    // },
                    styles: [
                        {
                            featureType: "poi",
                            stylers: [{ visibility: "off" }],
                        },
                        {
                            featureType: "transit",
                            stylers: [{ visibility: "off" }],
                        },
                    ],
                    minZoom: MIN_SYRIA_ZOOM,
                });

                mapInstanceRef.current = map;

                const heatLayer = new window.google.maps.visualization.HeatmapLayer({
                    data: [],
                    map,
                    radius: 38,
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
                infoWindowRef.current = new window.google.maps.InfoWindow();
                setIsMapReady(true);

                setTimeout(() => {
                    window.google?.maps?.event?.trigger(map, 'resize');
                }, 150);
            } catch (error) {
                console.error(error);
                if (!isCancelled) {
                    const resolvedError = error?.message === t('superAdminHeatmapMissingApiKey')
                        ? error.message
                        : t('superAdminHeatmapMapLoadError');
                    setMapError(resolvedError);
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
            clearMarkers(riderMarkersRef);
            clearMarkers(dropPointMarkersRef);
            clearMarkers(warehouseMarkersRef);
            infoWindowRef.current = null;
        };
    }, [googleMapsApiKey, t]);

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

        // Hide heatmap for drop points and warehouses (markers only)
        if (viewMode === 'drop_points' || viewMode === 'warehouses') {
            return [];
        }

        // Show parcel locations when viewMode is 'parcel'
        if (!Array.isArray(filteredShipments)) {
            return [];
        }

        return filteredShipments.flatMap((shipment) => {
            const meta = getStatusMeta(shipment.status, t);
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
    }, [filteredShipments, riders, viewMode]);

    const activitySummary = useMemo(() => {
        const summarySource = viewMode === 'riders' ? shipments : filteredShipments;
        const summary = ACTIVITY_LEVELS.map((level) => ({
            key: level.key,
            label: t(level.labelKey),
            color: level.color,
            count: 0,
        }));

        summarySource.forEach((shipment) => {
            const meta = getStatusMeta(shipment.status, t);
            const level = getActivityLevel(meta.weight);
            const bucket = summary.find((item) => item.key === level.key);

            if (bucket) {
                bucket.count += 1;
            }
        });

        return summary;
    }, [filteredShipments, shipments, t, viewMode]);

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
            fitMapToCoordinates(
                map,
                google,
                heatPoints.map(([lat, lng]) => ({ lat, lng }))
            );
        } else if (selectedCityCenter) {
            map.setCenter(selectedCityCenter);
            map.setZoom(11);
        } else {
            // Default to Damascus, Syria center
            map.setCenter({ lat: 33.5138, lng: 36.2765 });
            map.setZoom(MIN_SYRIA_ZOOM);
        }
    }, [heatPoints, isMapReady, selectedCityCenter]);

    const renderRiderInfo = (rider) => {
        const parcels = Number.isFinite(rider?.active_parcels) ? rider.active_parcels : 0;
        const value = Number.isFinite(rider?.active_value) ? rider.active_value : 0;
        const formattedValue = value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        return `
            <div style="font-family: 'Inter', sans-serif; padding: 10px 12px; min-width: 220px;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; font-weight: 600;">${escapeHtml(t('commonRiderDetails'))}</div>
                <div style="margin-top: 6px; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHtml(rider?.name ?? t('superAdminHeatmapUnknownRider'))}</div>
                <div style="font-size: 12px; color: #64748b;">${escapeHtml(rider?.role ?? t('commonRider'))}</div>
                <div style="margin-top: 10px; display: flex; gap: 16px;">
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.06em;">${escapeHtml(t('commonParcels'))}</div>
                        <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${parcels}</div>
                    </div>
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.06em;">${escapeHtml(t('commonValue'))}</div>
                        <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${formattedValue} ${escapeHtml(t('commonCurrencySyp'))}</div>
                    </div>
                </div>
            </div>
        `;
    };

    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !window.google?.maps) {
            return;
        }

        clearMarkers(riderMarkersRef);
        infoWindowRef.current?.close?.();

        if (viewMode !== 'riders') {
            return;
        }

        const markers = (riders || [])
            .filter((rider) => Number.isFinite(rider?.latitude) && Number.isFinite(rider?.longitude))
            .map((rider) => {
                const marker = new window.google.maps.Marker({
                    position: { lat: rider.latitude, lng: rider.longitude },
                    map: mapInstanceRef.current,
                    title: rider.name || t('commonRider'),
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 6,
                        fillColor: '#2563eb',
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                    },
                });

                marker.addListener('click', () => {
                    if (!infoWindowRef.current) {
                        infoWindowRef.current = new window.google.maps.InfoWindow();
                    }
                    infoWindowRef.current.setContent(renderRiderInfo(rider));
                    infoWindowRef.current.open(mapInstanceRef.current, marker);
                });

                return marker;
            });

        riderMarkersRef.current = markers;
    }, [isMapReady, riders, t, viewMode]);

    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !window.google?.maps) {
            return;
        }

        clearMarkers(dropPointMarkersRef);
        infoWindowRef.current?.close?.();

        if (viewMode !== 'drop_points') {
            return;
        }

        const validDropPoints = (filteredDropPoints || [])
            .filter((point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude))
            .map((point) => {
                const marker = new window.google.maps.Marker({
                    position: { lat: point.latitude, lng: point.longitude },
                    map: mapInstanceRef.current,
                    title: point.name || t('commonDropPoint'),
                    icon: {
                        url: '/assets/images/dpk_pin.svg',
                        scaledSize: new window.google.maps.Size(52, 58),
                        anchor: new window.google.maps.Point(22, 58),
                    },
                });

                marker.addListener('click', () => {
                    if (!infoWindowRef.current) {
                        infoWindowRef.current = new window.google.maps.InfoWindow();
                    }
                    infoWindowRef.current.setContent(renderDropPointInfo(point, t));
                    infoWindowRef.current.open(mapInstanceRef.current, marker);
                });

                return marker;
            });

        dropPointMarkersRef.current = validDropPoints;

        const dropPointCoordinates = (filteredDropPoints || [])
            .filter((point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude))
            .map((point) => ({ lat: point.latitude, lng: point.longitude }));

        const fitResult = fitMapToCoordinates(
            mapInstanceRef.current,
            window.google,
            dropPointCoordinates
        );

        if (!fitResult && selectedCityCenter) {
            mapInstanceRef.current.setCenter(selectedCityCenter);
            mapInstanceRef.current.setZoom(11);
        }
    }, [filteredDropPoints, isMapReady, selectedCityCenter, t, viewMode]);

    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !window.google?.maps) {
            return;
        }

        clearMarkers(warehouseMarkersRef);
        infoWindowRef.current?.close?.();

        if (viewMode !== 'warehouses') {
            return;
        }

        const pinSvg = encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
                <path d="M18 2c7.18 0 13 5.82 13 13 0 9.07-10.56 20.3-12.12 21.93a1.25 1.25 0 0 1-1.76 0C15.56 35.3 5 24.07 5 15 5 7.82 10.82 2 18 2z" fill="#f97316"/>
                <circle cx="18" cy="15" r="6" fill="#ffffff"/>
                <circle cx="18" cy="15" r="3.4" fill="#f97316"/>
            </svg>
        `);

        const validWarehouses = (filteredWarehouses || [])
            .filter((warehouse) => Number.isFinite(warehouse?.latitude) && Number.isFinite(warehouse?.longitude));

        const markers = validWarehouses
            .map((warehouse) => {
                const marker = new window.google.maps.Marker({
                    position: { lat: warehouse.latitude, lng: warehouse.longitude },
                    map: mapInstanceRef.current,
                    title: warehouse.name || t('superAdminHeatmapWarehouseLabel'),
                    icon: {
                        url: `data:image/svg+xml;utf8,${pinSvg}`,
                        scaledSize: new window.google.maps.Size(30, 40),
                        anchor: new window.google.maps.Point(15, 40),
                    },
                });

                marker.addListener('click', () => {
                    if (!infoWindowRef.current) {
                        infoWindowRef.current = new window.google.maps.InfoWindow();
                    }
                    infoWindowRef.current.setContent(`
                        <div style="font-family: 'Inter', sans-serif; padding: 10px 12px; min-width: 180px;">
                            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; font-weight: 600;">${escapeHtml(t('superAdminHeatmapWarehouseLabel'))}</div>
                            <div style="margin-top: 6px; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHtml(warehouse.name || t('statusUnknown'))}</div>
                            <div style="font-size: 12px; color: #64748b;">${warehouse.code || ''}</div>
                            <div style="margin-top: 4px; font-size: 12px; color: #64748b;">${warehouse.city || ''}</div>
                        </div>
                    `);
                    infoWindowRef.current.open(mapInstanceRef.current, marker);
                });

                return marker;
            });

        warehouseMarkersRef.current = markers;

        const warehouseCoordinates = validWarehouses.map((warehouse) => ({ lat: warehouse.latitude, lng: warehouse.longitude }));
        const fitResult = fitMapToCoordinates(
            mapInstanceRef.current,
            window.google,
            warehouseCoordinates
        );

        if (!fitResult && selectedCityCenter) {
            mapInstanceRef.current.setCenter(selectedCityCenter);
            mapInstanceRef.current.setZoom(11);
        }
    }, [filteredWarehouses, isMapReady, selectedCityCenter, t, viewMode]);

    const headerContent = (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span>{t('commonHome')}</span>
                <span className="text-slate-300">&gt;</span>
                <span>{t('commonHeatmap')}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">{t('commonHeatmap')}</h1>
        </div>
    );

    return (
        <SuperAdminAuthenticated headerContent={headerContent}>
            <Head title={t('commonHeatmap')} />

            <section className="px-0 py-0">
                <div className="mx-auto min-w-[90vw] min-h-[90vh] overflow-hidden border-0 bg-transparent md:border md:border-slate-200 md:bg-white md:shadow-[0_24px_55px_rgba(15,23,42,0.12)]">
                    <div className="relative z-0 h-[68vh] min-h-[90vh] w-full md:h-[78vh]">
                        <div ref={mapContainerRef} className="absolute inset-0 z-0" />

                        {mapError && (
                            <div className="absolute inset-0 z-[1300] flex items-center justify-center bg-white/85 px-6 text-center text-sm text-red-500">
                                {mapError}
                            </div>
                        )}

                        {!isMapReady && !mapError && (
                            <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-slate-50 text-sm text-slate-500">
                                {t('superAdminHeatmapPreparingMap')}
                            </div>
                        )}

                        <div className={`pointer-events-none absolute inset-x-6 top-6 z-[1250] flex flex-wrap items-start gap-4 md:inset-x-10 md:top-10 ${showRegionFilters ? 'justify-between' : 'justify-end'}`}>
                            {showRegionFilters && (
                                <div className="pointer-events-auto flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        {t('commonGovernorate')}:
                                    </span>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                        {t('cityDamascus')}
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
                                    </button>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        {t('commonSubArea')}:
                                    </span>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                        {t('commonSubAreaExample')}
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
                                    </button>
                                </div>
                            )}

                            <div className="pointer-events-auto flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-4 rounded-full border border-slate-200 bg-white px-6 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                                    {activitySummary.map((status, index) => (
                                        <div
                                            key={status.key}
                                            className={`flex items-center gap-2 ${index !== 0 ? 'border-l border-slate-200 pl-4' : ''}`}
                                        >
                                            <span
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: status.color }}
                                            />
                                            {status.label}
                                        </div>
                                    ))}
                                </div>
                                <div className="relative">
                                    <div className={`inline-flex items-center gap-3 rounded-full border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-[0_12px_32px_rgba(15,23,42,0.12)] ${isCityFilterDisabled ? 'border-slate-200 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                                        <span>{t('commonCity')}</span>
                                        <select
                                            value={selectedCity}
                                            onChange={(event) => setSelectedCity(event.target.value)}
                                            disabled={isCityFilterDisabled}
                                            className="bg-transparent text-xs font-semibold uppercase tracking-wide text-slate-700 outline-none disabled:text-slate-400"
                                        >
                                            <option value="all">{t('superAdminHeatmapAllCities')}</option>
                                            {cityOptions.map((city) => (
                                                <option key={city.key} value={city.label}>
                                                    {city.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowModeDropdown(!showModeDropdown)}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[0_12px_32px_rgba(15,23,42,0.12)] transition hover:bg-slate-50"
                                    >
                                        {viewMode === 'parcel'
                                            ? t('commonParcel')
                                            : viewMode === 'riders'
                                            ? t('superAdminHeatmapModeRiders')
                                            : viewMode === 'drop_points'
                                            ? t('commonDropPoints')
                                            : t('commonWarehouses')}
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
                                    </button>
                                    {showModeDropdown && (
                                        <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden z-[1300]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewMode('parcel');
                                                    setShowModeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${viewMode === 'parcel' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700'}`}
                                            >
                                                {t('commonParcel')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewMode('riders');
                                                    setShowModeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${viewMode === 'riders' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700'}`}
                                            >
                                                {t('superAdminHeatmapModeRiders')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewMode('drop_points');
                                                    setShowModeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${viewMode === 'drop_points' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700'}`}
                                            >
                                                {t('commonDropPoints')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewMode('warehouses');
                                                    setShowModeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${viewMode === 'warehouses' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700'}`}
                                            >
                                                {t('commonWarehouses')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => router.visit(route('admin.dashboard'))}
                            className="pointer-events-auto absolute bottom-7 right-7 z-[1250] inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#338DFF] text-white shadow-[0_18px_45px_rgba(51,141,255,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(51,141,255,0.6)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 cursor-pointer"
                            aria-label={t('superAdminHeatmapGoToDashboard')}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-6 w-6"
                            >
                                <path d="M8 3H3v5" />
                                <path d="M3 3 9 9" />
                                <path d="M16 21h5v-5" />
                                <path d="m21 21-6-6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </section>
        </SuperAdminAuthenticated>
    );
}
