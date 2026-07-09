import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, DrawingManager, Polygon, Marker } from '@react-google-maps/api';

const centerMap = {
    lat: 33.5138,
    lng: 36.2765,
};

const SYRIA_BOUNDS = {
    north: 37.31,
    south: 32.31,
    east: 42.45,
    west: 35.73,
};

const MapDrawing = ({
    initialPaths = [],
    onPathsChange = () => { },
    center = centerMap,
    zoom = 10,
    showCityMarker = false,
    apiKey,
    allowEditing = true,
}) => {
    const normalizeIncomingPaths = useCallback((incoming = []) => {
        if (!incoming) return [];

        try {
            let parsedPaths = typeof incoming === 'string' ? JSON.parse(incoming) : incoming;

            if (!Array.isArray(parsedPaths)) return [];
            if (parsedPaths.length === 0) return [];

            if (!Array.isArray(parsedPaths[0]) && parsedPaths[0] !== null && typeof parsedPaths[0] === 'object') {
                parsedPaths = [parsedPaths];
            }

            return parsedPaths
                .map((path) => Array.isArray(path)
                    ? path
                        .map((point) => {
                            if (!point) return null;
                            const lat = typeof point.lat === 'number' ? point.lat : parseFloat(point.lat);
                            const lng = typeof point.lng === 'number' ? point.lng : parseFloat(point.lng);
                            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                            return { lat, lng };
                        })
                        .filter(Boolean)
                    : [])
                .filter((path) => path.length >= 3);
        } catch (e) {
            console.error("Error normalizing map paths", e);
            return [];
        }
    }, []);

    const [paths, setPaths] = useState(() => normalizeIncomingPaths(initialPaths));
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [drawingOptions, setDrawingOptions] = useState(null);
    const [isDrawingReady, setIsDrawingReady] = useState(false);
    const [mapInstance, setMapInstance] = useState(null);
    const [currentCenter, setCurrentCenter] = useState(center);
    const [currentZoom, setCurrentZoom] = useState(zoom);
    const overlayListenersRef = useRef({});
    const overlaysRef = useRef([]);
    const incomingPathsRef = useRef(JSON.stringify(initialPaths || []));
    const skipNotifyRef = useRef(false);
    const drawingScriptLoadingRef = useRef(false);

    useEffect(() => {
        const normalized = normalizeIncomingPaths(initialPaths);
        const serialized = JSON.stringify(normalized);
        if (incomingPathsRef.current === serialized) {
            return;
        }

        incomingPathsRef.current = serialized;
        skipNotifyRef.current = true;
        setPaths(normalized);
    }, [initialPaths, normalizeIncomingPaths]);


    useEffect(() => {
        if (skipNotifyRef.current) {
            skipNotifyRef.current = false;
            return;
        }

        onPathsChange(paths);
    }, [paths]);

    // Memoize map options to prevent re-renders
    const mapOptions = useMemo(() => ({
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        clickableIcons: false,
        keyboardShortcuts: false,
        gestureHandling: 'greedy',
        minZoom: 7,
        maxZoom: 18,
        restriction: {
            latLngBounds: SYRIA_BOUNDS,
            strictBounds: true,
        },
    }), []);

    const extractOverlayPath = useCallback((overlay) => overlay
        ?.getPath()
        ?.getArray()
        ?.map((latLng) => ({
            lat: latLng.lat(),
            lng: latLng.lng(),
        })) || [], []);

    // Handle drawing complete - for polygons/polylines
    const handleOverlayComplete = useCallback((event) => {
        if (!window.google?.maps?.drawing) {
            return;
        }

        const isPolygon = event.type === window.google.maps.drawing.OverlayType.POLYGON;
        const isPolyline = event.type === window.google.maps.drawing.OverlayType.POLYLINE;

        if (!isPolygon && !isPolyline) {
            return;
        }

        const overlay = event.overlay;
        const newPath = extractOverlayPath(overlay);

        if (!newPath.length) {
            overlay.setMap(null);
            return;
        }

        setPaths((prevPaths) => [...prevPaths, newPath]);
        overlay.setMap(null); // Remove drawn overlay to avoid duplication
    }, [extractOverlayPath]);

    const onLoad = useCallback((map) => {
        setMapInstance(map);
        setIsMapLoaded(true);
    }, []);

    useEffect(() => {
        if (!isMapLoaded || !window.google?.maps) {
            return;
        }

        let isActive = true;
        let cleanupCallback = null;

        const ensureDrawingLibrary = async () => {
            if (window.google.maps.drawing) {
                if (isActive) {
                    setIsDrawingReady(true);
                }
                return;
            }

            if (typeof window.google.maps.importLibrary !== 'function') {
                if (!apiKey) {
                    console.error('Google Maps API key is missing; unable to load drawing library.');
                    return;
                }

                if (drawingScriptLoadingRef.current) {
                    return;
                }

                drawingScriptLoadingRef.current = true;

                const existing = document.getElementById('google-maps-drawing-loader');
                if (existing) {
                    return;
                }

                const callbackName = '__mpDrawingInit';
                cleanupCallback = callbackName;
                window[callbackName] = () => {
                    if (isActive) {
                        setIsDrawingReady(!!window.google?.maps?.drawing);
                    }
                };

                const script = document.createElement('script');
                script.id = 'google-maps-drawing-loader';
                script.async = true;
                script.defer = true;
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing&v=weekly&callback=${callbackName}`;
                script.onerror = () => {
                    console.error('Failed to load Google Maps drawing library script.');
                };

                document.head.appendChild(script);
                return;
            }

            try {
                await window.google.maps.importLibrary('drawing');
                if (isActive) {
                    setIsDrawingReady(!!window.google.maps.drawing);
                }
            } catch (error) {
                console.error('Failed to load Google Maps drawing library:', error);
            }
        };

        ensureDrawingLibrary();

        return () => {
            isActive = false;
            if (cleanupCallback && window[cleanupCallback]) {
                delete window[cleanupCallback];
            }
        };
    }, [isMapLoaded, apiKey]);

    // Update map center when center prop changes
    useEffect(() => {
        if (!mapInstance || !center) return;

        const newCenter = { lat: center.lat, lng: center.lng };
        setCurrentCenter(newCenter);
        setCurrentZoom(zoom);

        // Smoothly pan to new center
        mapInstance.panTo(newCenter);
        mapInstance.setZoom(zoom);
    }, [center, zoom, mapInstance]);

    // Memoize drawing options
    useEffect(() => {
        if (!isDrawingReady || !window.google?.maps?.drawing) return;

        setDrawingOptions({
            drawingControl: allowEditing,
            drawingControlOptions: {
                position: window.google.maps.ControlPosition.TOP_CENTER,
                drawingModes: [
                    window.google.maps.drawing.OverlayType.POLYGON,
                ],
            },
            polygonOptions: {
                fillColor: '#338DFF',
                fillOpacity: 0.2,
                strokeColor: '#338DFF',
                strokeOpacity: 0.9,
                strokeWeight: 2,
                editable: allowEditing,
                draggable: allowEditing,
            },
        });
    }, [isDrawingReady, allowEditing]);

    const detachEditableListeners = useCallback((index) => {
        const listeners = overlayListenersRef.current[index];
        if (listeners) {
            listeners.forEach((listener) => listener.remove());
            delete overlayListenersRef.current[index];
        }
    }, []);

    const attachEditableListeners = useCallback((overlay, index) => {
        if (!overlay || !window.google?.maps) return;

        detachEditableListeners(index);
        overlay.setEditable(allowEditing);
        overlay.setDraggable(allowEditing);

        const syncPath = () => {
            const updatedPath = extractOverlayPath(overlay);
            setPaths((prevPaths) => {
                if (!prevPaths[index]) {
                    return prevPaths;
                }
                const next = [...prevPaths];
                next[index] = updatedPath;
                return next;
            });
        };

        const path = overlay.getPath();
        const listeners = allowEditing ? [
            path.addListener('insert_at', syncPath),
            path.addListener('set_at', syncPath),
            path.addListener('remove_at', syncPath),
            overlay.addListener('dragend', syncPath),
        ] : [];

        if (listeners.length) {
            overlayListenersRef.current[index] = listeners;
        }
    }, [extractOverlayPath, allowEditing, detachEditableListeners]);

    useEffect(() => () => {
        Object.values(overlayListenersRef.current).forEach((listeners) => {
            listeners.forEach((listener) => listener.remove());
        });
        overlayListenersRef.current = {};
    }, []);

    useEffect(() => {
        overlaysRef.current.forEach((overlay, index) => {
            if (!overlay) {
                return;
            }
            attachEditableListeners(overlay, index);
        });
    }, [paths, allowEditing, attachEditableListeners]);

    return (
        <div style={{ direction: "ltr" }}>   {/* FIX: Force LTR for Google Maps */}
            <GoogleMap
                mapContainerStyle={{
                    width: "100%",
                    height: "320px",
                }}
                center={currentCenter}
                zoom={currentZoom}
                onLoad={onLoad}
                options={mapOptions}
            >
                {isMapLoaded && (
                    <>
                        {drawingOptions && (
                            <DrawingManager
                                options={drawingOptions}
                                onOverlayComplete={handleOverlayComplete}
                            />
                        )}

                        {showCityMarker && currentCenter && (
                            <Marker
                                position={currentCenter}
                                icon={{
                                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                                    scaledSize: new window.google.maps.Size(40, 40),
                                }}
                                title="City Location"
                            />
                        )}

                        {paths.map((path, index) => (
                            <Polygon
                                key={`path-${index}`}
                                paths={path}
                                options={{
                                    fillColor: '#338DFF',
                                    fillOpacity: 0.15,
                                    strokeColor: '#338DFF',
                                    strokeOpacity: 0.9,
                                    strokeWeight: 2,
                                    editable: allowEditing,
                                    draggable: allowEditing,
                                }}
                                onLoad={(polygon) => {
                                    overlaysRef.current[index] = polygon;
                                    attachEditableListeners(polygon, index);
                                }}
                                onUnmount={() => {
                                    detachEditableListeners(index);
                                    overlaysRef.current[index] = null;
                                }}
                            />
                        ))}
                    </>
                )}
            </GoogleMap>
        </div>
    );

};

export default MapDrawing;
