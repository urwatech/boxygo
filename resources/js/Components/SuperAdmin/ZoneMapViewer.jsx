import React, { useEffect, useMemo, useState } from 'react';
import { GoogleMap, LoadScript, Polygon } from '@react-google-maps/api';
import { usePage } from '@inertiajs/react';

const DEFAULT_CENTER = { lat: 33.5138, lng: 36.2765 };
const DEFAULT_ZOOM = 11;
const SELECTED_ZOOM = 13;
const libraries = [];

export const ZONE_COLOR_PALETTE = [
    '#338DFF',
    '#F97316',
    '#10B981',
    '#F43F5E',
    '#A855F7',
    '#FACC15',
    '#0EA5E9',
    '#EC4899',
    '#14B8A6',
    '#8B5CF6',
];

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

const computeCentroid = (path) => {
    if (!Array.isArray(path) || !path.length) {
        return null;
    }

    const sum = path.reduce((acc, point) => ({
        lat: acc.lat + point.lat,
        lng: acc.lng + point.lng,
    }), { lat: 0, lng: 0 });

    return {
        lat: sum.lat / path.length,
        lng: sum.lng / path.length,
    };
};

const ZoneMapViewer = ({
    zones = [],
    selectedZoneId = null,
    height = 320,
}) => {
    const page = usePage?.() || {};
    const config = page?.props?.config || {};
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;

    const zonePolygons = useMemo(() => {
        return (Array.isArray(zones) ? zones : [])
            .map((zone, index) => {
                const paths = normalizePaths(zone?.drawn_paths);
                if (!paths.length) {
                    return null;
                }

                const color = zone?.color || ZONE_COLOR_PALETTE[index % ZONE_COLOR_PALETTE.length];
                const centroid = computeCentroid(paths[0]) || DEFAULT_CENTER;

                return {
                    id: zone.id,
                    name: zone.name,
                    city: zone.city,
                    color,
                    paths,
                    centroid,
                };
            })
            .filter(Boolean);
    }, [zones]);

    const selectedPolygon = useMemo(
        () => zonePolygons.find((polygon) => String(polygon.id) === String(selectedZoneId)),
        [zonePolygons, selectedZoneId],
    );

    const [mapCenter, setMapCenter] = useState(() => selectedPolygon?.centroid || zonePolygons[0]?.centroid || DEFAULT_CENTER);
    const [mapZoom, setMapZoom] = useState(selectedPolygon ? SELECTED_ZOOM : DEFAULT_ZOOM);

    useEffect(() => {
        if (selectedPolygon) {
            setMapCenter(selectedPolygon.centroid);
            setMapZoom(SELECTED_ZOOM);
        } else if (zonePolygons.length > 0) {
            setMapCenter(zonePolygons[0].centroid);
            setMapZoom(DEFAULT_ZOOM);
        } else {
            setMapCenter(DEFAULT_CENTER);
            setMapZoom(DEFAULT_ZOOM);
        }
    }, [selectedPolygon, zonePolygons]);

    const mapOptions = useMemo(() => ({
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
        zoomControl: true,
    }), []);

    return (
        <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={libraries}>
            <div style={{ direction: 'ltr' }}>
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height }}
                    center={mapCenter}
                    zoom={mapZoom}
                    options={mapOptions}
                >
                    {zonePolygons.map((polygon) => (
                        polygon.paths.map((path, index) => (
                            <Polygon
                                key={`${polygon.id}-${index}`}
                                paths={path}
                                options={{
                                    fillColor: polygon.color,
                                    fillOpacity: String(polygon.id) === String(selectedZoneId) ? 0.35 : 0.18,
                                    strokeColor: polygon.color,
                                    strokeOpacity: String(polygon.id) === String(selectedZoneId) ? 0.9 : 0.5,
                                    strokeWeight: String(polygon.id) === String(selectedZoneId) ? 3 : 1.5,
                                }}
                            />
                        ))
                    ))}
                </GoogleMap>
            </div>
        </LoadScript>
    );
};

export default ZoneMapViewer;
