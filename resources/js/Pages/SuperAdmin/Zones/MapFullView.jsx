import React, { useMemo, useRef, useState } from 'react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import { Head, router, usePage } from '@inertiajs/react';
import { GoogleMap, OverlayView, Polygon, useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import Card from '../../../Components/Common/Card';

const DEFAULT_MAP_CENTER = { lat: 33.5138, lng: 36.2765 };
const SYRIA_BOUNDS = {
    north: 37.31,
    south: 32.31,
    east: 42.45,
    west: 35.73,
};
const mapLibraries = ['drawing'];

const normalizePaths = (paths) => {
    if (!Array.isArray(paths)) {
        return [];
    }

    return paths
        .map((path) => Array.isArray(path)
            ? path
                .map((point) => {
                    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
                        return null;
                    }

                    return { lat: point.lat, lng: point.lng };
                })
                .filter(Boolean)
            : [])
        .filter((path) => path.length >= 3);
};

const getPolygonCentroid = (paths = []) => {
    const points = paths.flat();
    if (!points.length) {
        return DEFAULT_MAP_CENTER;
    }
    const sum = points.reduce(
        (acc, point) => ({
            lat: acc.lat + point.lat,
            lng: acc.lng + point.lng,
        }),
        { lat: 0, lng: 0 },
    );
    return {
        lat: sum.lat / points.length,
        lng: sum.lng / points.length,
    };
};

export default function MapFullView({ allZones = [] }) {
    const { t } = useTranslation();
    const page = usePage?.() || {};
    const config = page?.props?.config || {};
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;
    const mapRef = useRef(null);
    const [hoveredZoneId, setHoveredZoneId] = useState(null);

    // Load Google Maps API
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey,
        libraries: mapLibraries,
    });

    // Prepare zones for map display
    const zonePolygons = useMemo(() => {
        return (Array.isArray(allZones) ? allZones : [])
            .map((zone) => {
                const paths = normalizePaths(zone?.drawn_paths);
                if (!paths.length) {
                    return null;
                }

                // Active zones: green, Inactive zones: red
                const color = zone.status === 'active' ? '#10B981' : '#EF4444';

                return {
                    id: zone.id,
                    name: zone.name,
                    city: zone.city,
                    status: zone.status,
                    color,
                    paths,
                    centroid: getPolygonCentroid(paths),
                };
            })
            .filter(Boolean);
    }, [allZones]);

    const mapOptions = useMemo(() => ({
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        zoomControl: true,
        minZoom: 7,
        restriction: {
            latLngBounds: SYRIA_BOUNDS,
            strictBounds: true,
        },
    }), []);

    const handleBack = () => {
        router.visit(route('admin.zones.index'));
    };

    const handleMapLoad = (mapInstance) => {
        mapRef.current = mapInstance;
    };

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div className="flex items-center justify-between w-full">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('superAdminZonesMapFullViewTitle')}</h2>
                        <nav className="text-sm text-blue-500">
                            <button
                                onClick={handleBack}
                                className="hover:underline"
                            >
                                {t('commonHome')}
                            </button>
                            <span className="mx-1 text-slate-500">&rsaquo;</span>
                            <button
                                onClick={handleBack}
                                className="hover:underline"
                            >
                                {t('commonZoneManagement')}
                            </button>
                            <span className="mx-1 text-slate-500">&rsaquo;</span>
                            <span className="font-medium text-[#64748b]">{t('superAdminZonesMapFullViewLabel')}</span>
                        </nav>
                    </div>
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center justify-center rounded-full bg-[#338dff] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#2b7ae4] transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4 mr-2"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('superAdminZonesMapBackToManagement')}
                    </button>
                </div>
            }
        >
            <Head title={t('superAdminZonesMapFullViewTitle')} />

            <Card
                title={t('superAdminZonesMapFullViewLabel')}
                contentClassName="p-0"
                className="h-[calc(100vh-200px)]"
            >
                {isLoaded ? (
                    <div style={{ direction: 'ltr', height: '100%' }}>
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: 'calc(96vh - 250px)' }}
                            center={DEFAULT_MAP_CENTER}
                            zoom={11}
                            options={mapOptions}
                            onLoad={handleMapLoad}
                        >
                            {zonePolygons.map((polygon) => (
                                polygon.paths.map((path, index) => (
                                    <Polygon
                                        key={`${polygon.id}-${index}`}
                                        paths={path}
                                        options={{
                                            fillColor: polygon.color,
                                            fillOpacity: 0.35,
                                            strokeColor: polygon.color,
                                            strokeOpacity: 0.9,
                                            strokeWeight: 2,
                                        }}
                                        onMouseOver={() => setHoveredZoneId(polygon.id)}
                                        onMouseOut={() => setHoveredZoneId((prev) => (prev === polygon.id ? null : prev))}
                                    />
                                ))
                            ))}
                            {hoveredZoneId && zonePolygons
                                .filter((polygon) => polygon.id === hoveredZoneId)
                                .map((polygon) => (
                                <OverlayView
                                    key={`label-${polygon.id}`}
                                    position={polygon.centroid}
                                    mapPaneName={OverlayView.FLOAT_PANE}
                                >
                                    <div className="pointer-events-none inline-flex whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.15)] border border-slate-200">
                                        {polygon.name}
                                    </div>
                                </OverlayView>
                            ))}
                        </GoogleMap>
                    </div>
                ) : (
                    <div style={{ width: '100%', height: 'calc(100vh - 250px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                        <p>{t('commonLoadingMap')}</p>
                    </div>
                )}
            </Card>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: '#10B981', opacity: 0.7 }}></div>
                    <span className="text-sm text-gray-700">{t('commonActiveZones')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: '#EF4444', opacity: 0.7 }}></div>
                    <span className="text-sm text-gray-700">{t('commonInactiveZones')}</span>
                </div>
            </div>
        </SuperAdminAuthenticated>
    );
}
