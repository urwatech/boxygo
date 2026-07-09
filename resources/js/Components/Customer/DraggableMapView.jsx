import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { usePage } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import { reverseGeocode } from "../../Services/LocationService";

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

    return "--";
};

// Tooltip component
function DropPointTooltip({ point, onSelectHandover, onSelectDelivery, t }) {
    const dropPointName = getFirstDisplayValue( point?.name );
    const dpNumber = getFirstDisplayValue( point?.dp_no );
    const keeperName = getFirstDisplayValue( point?.keeper?.name );
    const city = getFirstDisplayValue( point?.city );
    const address = getFirstDisplayValue( point?.address );

    const DetailRow = ({ label, value }) => (
        <div className="flex items-start justify-between gap-5 text-left text-sm">
            <span className="font-medium text-[#64748b] shrink-0">{label}:</span>
            <span className="text-[#111827] text-right break-words flex-1">{value}</span>
        </div>
    );

    return (
        <div className="relative w-full max-w-sm sm:min-w-[280px] sm:max-w-[320px] bg-white rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 overflow-hidden">
            <DetailRow label={t('commonDropPointName')} value={dropPointName} />
            <DetailRow label={t('commonDpNumber')} value={dpNumber} />
            <DetailRow label={t('superAdminHeatmapDropPointKeeperName')} value={keeperName} />
            <DetailRow label={t('commonCity')} value={city} />
            <DetailRow label={t('commonAddress')} value={address} />

            <div className="border-t border-[#e2e8f0] my-1"></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectHandover();
                    }}
                    className="w-full py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                >
                    {t("draggableMapLegendHandover") || "Handover"}
                </button>

                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectDelivery();
                    }}
                    className="w-full py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                >
                    {t("commonDeliveryLocation") || "Delivery"}
                </button>
            </div>

            <div className="w-3 h-3 bg-white border-t border-l border-gray-200 rotate-45 absolute bottom-[-6px] left-1/2 -translate-x-1/2"></div>
        </div>
    );
}

export default function DraggableMapView({
    handoverLocation = { lat: 36.2021, lon: 37.1343 }, // Default to Aleppo
    deliveryLocation = { lat: 36.2121, lon: 37.1543 },
    dropPoints = [],
    onHandoverChange,
    onDeliveryChange,
    focusedPin = "handover",
    focusRequestNonce = 0,
    onDropPointSelect, // (dropPoint, pinType) => void — called when a pin is dragged onto a DP
    heightClass = "h-[500px]",
    provider = "google",
}) {
    const page = usePage?.() || {};
    const config = page?.props?.config || {};
    const { t } = useTranslation();
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const handoverMarkerRef = useRef(null);
    const deliveryMarkerRef = useRef(null);
    const dropPointMarkersRef = useRef([]);
    const dropPointsRef = useRef(dropPoints);
    const onDropPointSelectRef = useRef(onDropPointSelect);
    const dropPointInfoWindowRef = useRef(null);
    const openDropPointIdRef = useRef(null);
    const [showMapLegend, setShowMapLegend] = useState(false);

    // Keep ref in sync with latest prop value
    useEffect(() => {
        onDropPointSelectRef.current = onDropPointSelect;
    }, [onDropPointSelect]);

    const [isLoading, setIsLoading] = useState({
        handover: false,
        delivery: false,
    });
    const [openDropPointId, setOpenDropPointId] = useState(null);

    useEffect(() => {
        openDropPointIdRef.current = openDropPointId;
    }, [openDropPointId]);

    // Use config from page props if available, default to Google Maps
    const mapProvider = config?.MAP_PROVIDER || provider || "google";
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;

    // Syria boundaries
    const syriaBounds = [32.31, 37.31, 35.73, 42.45]; // [minLat, maxLat, minLon, maxLon]

    // Haversine distance in metres
    const haversineMeters = (lat1, lon1, lat2, lon2) => {
        const toRad = (d) => (d * Math.PI) / 180;
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const SNAP_RADIUS = 50; // metres — drag within this distance to snap to a DP

    const findNearestDropPoint = (lat, lon) => {
        const points = dropPointsRef.current;
        if (!Array.isArray(points) || points.length === 0) return null;
        let best = null;
        let bestDist = SNAP_RADIUS;
        points.forEach((point) => {
            const pLat = parseFloat(
                point?.latitude ?? point?.lat ?? point?.coordinates?.lat,
            );
            const pLon = parseFloat(
                point?.longitude ?? point?.lon ?? point?.coordinates?.lon,
            );
            if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return;
            const dist = haversineMeters(lat, lon, pLat, pLon);
            if (dist <= bestDist) {
                bestDist = dist;
                best = point;
            }
        });
        return best;
    };

    const getDropPointCoordinates = (point) => {
        const lat = parseFloat(
            point?.latitude ?? point?.lat ?? point?.coordinates?.lat,
        );
        const lon = parseFloat(
            point?.longitude ??
                point?.lon ??
                point?.lng ??
                point?.coordinates?.lon ??
                point?.coordinates?.lng,
        );
        return { lat, lon };
    };

    const closeDropPointTooltip = useCallback(() => {
        if (dropPointInfoWindowRef.current) {
            dropPointInfoWindowRef.current.close();
        }
        openDropPointIdRef.current = null;
        setOpenDropPointId(null);
    }, []);

    const buildDropPointTooltipContent = useCallback(
        (point, onSelect) => {
            const container = document.createElement("div");

            const root = ReactDOM.createRoot(container);
            root.render(
                <DropPointTooltip
                    point={point}
                    onSelectHandover={() => onSelect("handover")}
                    onSelectDelivery={() => onSelect("delivery")}
                    t={t}
                />,
            );

            return container;
        },
        [t],
    );

    const openDropPointTooltip = useCallback(
        (marker, point, pointId) => {
            if (!window.google || !mapInstanceRef.current || !marker) {
                return;
            }

            if (!dropPointInfoWindowRef.current) {
                dropPointInfoWindowRef.current =
                    new window.google.maps.InfoWindow({
                        pixelOffset: new window.google.maps.Size(0, -12),
                    });
                dropPointInfoWindowRef.current.addListener("closeclick", () => {
                    openDropPointIdRef.current = null;
                    setOpenDropPointId(null);
                });
            }

            const onSelect = (pinType) => {
                if (typeof onDropPointSelectRef.current === "function") {
                    onDropPointSelectRef.current(point, pinType);
                }
                closeDropPointTooltip();
            };

            const content = buildDropPointTooltipContent(point, onSelect);
            dropPointInfoWindowRef.current.setContent(content);
            dropPointInfoWindowRef.current.open({
                map: mapInstanceRef.current,
                anchor: marker,
                shouldFocus: false,
            });
            openDropPointIdRef.current = pointId;
            setOpenDropPointId(pointId);
        },
        [buildDropPointTooltipContent, closeDropPointTooltip],
    );

    // Handle reverse geocoding when marker is dropped
    const handleMarkerDragEnd = async (type, lat, lon) => {
        setIsLoading((prev) => ({ ...prev, [type]: true }));

        try {
            const result = await reverseGeocode(lat, lon, {
                provider: mapProvider,
                googleGeocodingApiKey: googleMapsApiKey,
            });

            const locationData = {
                address: result.address,
                lat: result.lat,
                lon: result.lon,
                city: result.components?.city || result.components?.town || "",
                state:
                    result.components?.state ||
                    result.components?.governorate ||
                    "",
            };

            if (type === "handover") {
                onHandoverChange?.(locationData);
            } else {
                onDeliveryChange?.(locationData);
            }
        } catch (error) {
            console.error(`Error geocoding ${type} location:`, error);
            // Still update coordinates even if geocoding fails
            const locationData = {
                address: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
                lat,
                lon,
                city: "",
                state: "",
            };

            if (type === "handover") {
                onHandoverChange?.(locationData);
            } else {
                onDeliveryChange?.(locationData);
            }
        } finally {
            setIsLoading((prev) => ({ ...prev, [type]: false }));
        }
    };

    const renderDropPointMarkers = useCallback(
        (points = []) => {
            if (!window.google || !mapInstanceRef.current) {
                return;
            }

            closeDropPointTooltip();
            dropPointMarkersRef.current.forEach((marker) =>
                marker.setMap(null),
            );
            dropPointMarkersRef.current = [];

            if (!Array.isArray(points) || points.length === 0) {
                return;
            }

            points.forEach((point) => {
                const dropPointPinIcon = {
                    url: "/assets/images/dpk_pin.svg",
                    scaledSize: new window.google.maps.Size(52, 58),
                    origin: new window.google.maps.Point(0, 0),
                    anchor: new window.google.maps.Point(22, 58),
                };

                const { lat, lon } = getDropPointCoordinates(point);

                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                    return;
                }

                const pointId = String(point?.id ?? `${lat},${lon}`);

                const svgMarker = `
                    <svg width="52" height="58" viewBox="0 0 61 79" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g filter="url(#filter0_d_13122_33315)">
                        <path d="M50.1389 24.337C50.1389 32.983 37.8454 52.7545 32.5655 60.8474C31.4402 62.5723 28.9643 62.5723 27.8389 60.8474C22.559 52.7545 10.2656 32.983 10.2656 24.337C10.2656 13.3265 19.1918 4.40039 30.2022 4.40039C41.2127 4.40039 50.1389 13.3265 50.1389 24.337Z" fill="#338DFF"/>
                        <path d="M13.6802 26.0881C13.6802 16.5231 21.434 8.76929 30.9989 8.76929C36.59 8.76929 41.5608 11.4194 44.7279 15.5308C41.7371 10.3394 36.1322 6.84375 29.7103 6.84375C20.1445 6.84375 12.3906 14.5976 12.3906 24.1625C12.3906 28.1364 13.73 31.7973 15.9814 34.7197C14.5174 32.1785 13.6802 29.2311 13.6802 26.0881Z" fill="#338DFF"/>
                        <path d="M25.5 56.776C25.5005 56.7755 25.5013 56.7756 25.5016 56.7762C26.3788 58.2459 27.1796 59.5614 27.8619 60.6692C28.9605 62.4528 31.4972 62.4868 32.641 60.7318C37.9616 52.5676 50.1388 32.9423 50.1388 24.3372C50.1388 24.009 49.6951 23.9624 49.6013 24.2769C48.8626 26.7564 47.9141 29.1749 46.7954 31.503C43.0218 39.3584 37.4409 44.391 31.4972 50.764C29.5809 52.8178 27.5862 54.8495 25.5 56.776Z" fill="#338DFF"/>
                        <path d="M41.0975 34.3512C47.1136 28.3351 47.1136 18.581 41.0975 12.5648C35.0814 6.54869 25.3273 6.54869 19.3111 12.5648C13.295 18.581 13.295 28.3351 19.3111 34.3512C25.3273 40.3673 35.0814 40.3673 41.0975 34.3512Z" fill="white"/>
                        </g>
                        <text x="30.5" y="30" text-anchor="middle" alignment-baseline="center" font-size="20" fill="#164265">${point.icon}</text>
                    </svg>
                    `;

                const marker = new window.google.maps.Marker({
                    position: { lat, lng: lon },
                    map: mapInstanceRef.current,
                    title: point?.name
                        ? t("draggableMapDropPointKeeperWithName", {
                              name: point.name,
                          })
                        : t("draggableMapLegendDropPointKeeper"),
                    icon: !point.icon
                        ? dropPointPinIcon
                        : {
                              url:
                                  "data:image/svg+xml;charset=UTF-8," +
                                  encodeURIComponent(svgMarker),
                              scaledSize: new window.google.maps.Size(52, 58),
                              origin: new window.google.maps.Point(0, 0),
                              anchor: new window.google.maps.Point(22, 58),
                          },
                    zIndex: 5,
                    cursor: "pointer",
                });

                marker.addListener("click", () => {
                    if (openDropPointIdRef.current === pointId) {
                        closeDropPointTooltip();
                        return;
                    }
                    openDropPointTooltip(marker, point, pointId);
                });

                dropPointMarkersRef.current.push(marker);
            });
        },
        [closeDropPointTooltip, openDropPointTooltip, t],
    );

    useEffect(() => {
        dropPointsRef.current = dropPoints;
        renderDropPointMarkers(dropPoints);
    }, [dropPoints, renderDropPointMarkers]);

    // Initialize Google Maps
    useEffect(() => {
        if (mapProvider !== "google" || !googleMapsApiKey || !mapRef.current)
            return;

        // Load Google Maps script if not already loaded
        if (!window.google) {
            const script = document.createElement("script");
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

            // Define strict bounds for Syria
            const strictBounds = new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(syriaBounds[0], syriaBounds[2]), // SW corner
                new window.google.maps.LatLng(syriaBounds[1], syriaBounds[3]), // NE corner
            );

            // Calculate center between handover and delivery
            const centerLat = (handoverLocation.lat + deliveryLocation.lat) / 2;
            const centerLon = (handoverLocation.lon + deliveryLocation.lon) / 2;

            const isMobile = window.innerWidth <= 768;

            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: centerLat, lng: centerLon },
                zoom: 12,
                // restriction: {
                //     latLngBounds: strictBounds,
                //     strictBounds: true,
                // },
                mapTypeControl: false,
                streetViewControl: false,
                cameraControl: !isMobile,
                fullscreenControl: !isMobile,
                zoomControl: !isMobile,
                gestureHandling: "greedy",
                minZoom: 7,
                maxZoom: 18,
            });

            // Custom SVG icon for handover marker (red pin)
            const redPinSVG = {
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                fillColor: "#EA4335",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 2,
                scale: 2,
                anchor: new window.google.maps.Point(12, 22),
            };

            // Custom SVG icon for delivery marker (green pin)
            const greenPinSVG = {
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                fillColor: "#34A853",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 2,
                scale: 2,
                anchor: new window.google.maps.Point(12, 22),
            };

            // Create handover marker (red) - clean design
            const handoverMarker = new window.google.maps.Marker({
                position: {
                    lat: handoverLocation.lat,
                    lng: handoverLocation.lon,
                },
                map: map,
                title: t("draggableMapMarkerHandover"),
                draggable: true,
                icon: redPinSVG,
                animation: window.google.maps.Animation.DROP,
            });

            // Create delivery marker (green) - clean design
            const deliveryMarker = new window.google.maps.Marker({
                position: {
                    lat: deliveryLocation.lat,
                    lng: deliveryLocation.lon,
                },
                map: map,
                title: t("draggableMapMarkerDelivery"),
                draggable: true,
                icon: greenPinSVG,
                animation: window.google.maps.Animation.DROP,
            });

            // Store references before adding listeners
            mapInstanceRef.current = map;
            handoverMarkerRef.current = handoverMarker;
            deliveryMarkerRef.current = deliveryMarker;

            renderDropPointMarkers(dropPointsRef.current);
            map.addListener("click", () => {
                closeDropPointTooltip();
            });

            // Add drag listeners — snap to nearest drop point if within SNAP_RADIUS
            handoverMarker.addListener("dragend", (event) => {
                const lat = event.latLng.lat();
                const lon = event.latLng.lng();
                const nearestDP = findNearestDropPoint(lat, lon);
                if (
                    nearestDP &&
                    typeof onDropPointSelectRef.current === "function"
                ) {
                    const dpLat = parseFloat(
                        nearestDP?.latitude ?? nearestDP?.lat,
                    );
                    const dpLon = parseFloat(
                        nearestDP?.longitude ?? nearestDP?.lon,
                    );
                    handoverMarker.setPosition({ lat: dpLat, lng: dpLon });
                    onDropPointSelectRef.current(nearestDP, "handover");
                } else {
                    handleMarkerDragEnd("handover", lat, lon);
                }
            });

            deliveryMarker.addListener("dragend", (event) => {
                const lat = event.latLng.lat();
                const lon = event.latLng.lng();
                const nearestDP = findNearestDropPoint(lat, lon);
                if (
                    nearestDP &&
                    typeof onDropPointSelectRef.current === "function"
                ) {
                    const dpLat = parseFloat(
                        nearestDP?.latitude ?? nearestDP?.lat,
                    );
                    const dpLon = parseFloat(
                        nearestDP?.longitude ?? nearestDP?.lon,
                    );
                    deliveryMarker.setPosition({ lat: dpLat, lng: dpLon });
                    onDropPointSelectRef.current(nearestDP, "delivery");
                } else {
                    handleMarkerDragEnd("delivery", lat, lon);
                }
            });
        }

        return () => {
            closeDropPointTooltip();
            if (dropPointInfoWindowRef.current) {
                dropPointInfoWindowRef.current.close();
                dropPointInfoWindowRef.current = null;
            }
            if (handoverMarkerRef.current) {
                handoverMarkerRef.current.setMap(null);
            }
            if (deliveryMarkerRef.current) {
                deliveryMarkerRef.current.setMap(null);
            }
            if (dropPointMarkersRef.current.length) {
                dropPointMarkersRef.current.forEach((marker) =>
                    marker.setMap(null),
                );
                dropPointMarkersRef.current = [];
            }
        };
    }, [
        closeDropPointTooltip,
        mapProvider,
        googleMapsApiKey,
        renderDropPointMarkers,
    ]);

    // Keep marker positions in sync and explicitly focus the active marker.
    useEffect(() => {
        if (
            handoverMarkerRef.current &&
            deliveryMarkerRef.current &&
            mapInstanceRef.current
        ) {
            const handoverPos = {
                lat: handoverLocation.lat,
                lng: handoverLocation.lon,
            };
            const deliveryPos = {
                lat: deliveryLocation.lat,
                lng: deliveryLocation.lon,
            };

            handoverMarkerRef.current.setPosition(handoverPos);
            deliveryMarkerRef.current.setPosition(deliveryPos);

            const targetPos =
                focusedPin === "delivery" ? deliveryPos : handoverPos;

            mapInstanceRef.current.panTo(targetPos);
            if (mapInstanceRef.current.getZoom() < 15) {
                mapInstanceRef.current.setZoom(15);
            }
        }
    }, [
        focusRequestNonce,
        focusedPin,
        handoverLocation.lat,
        handoverLocation.lon,
        deliveryLocation.lat,
        deliveryLocation.lon,
    ]);

    // Fallback for OpenStreetMap (iframe - not draggable)
    if (mapProvider !== "google" || !googleMapsApiKey) {
        return (
            <div
                className={`w-full ${heightClass} md:rounded-2xl overflow-hidden relative bg-gray-100 flex items-center justify-center`}
            >
                <div className="text-center p-6">
                    <p className="text-gray-600 mb-2">
                        {t("draggableMapRequiresGoogleMaps")}
                    </p>
                    <p className="text-sm text-gray-500">
                        {t("draggableMapRequiresApiKey")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`w-full ${heightClass} md:rounded-2xl overflow-hidden relative border border-gray-200 bg-white shadow-md`}
            style={{ minHeight: "400px" }}
        >
            {/* Map container */}
            <div
                ref={mapRef}
                className="w-full h-full rounded-t-xl"
                style={{ minHeight: "400px" }}
                aria-label={t("draggableMapAriaLabel")}
            />

            {/* Loading indicators */}
            {(isLoading.handover || isLoading.delivery) && (
                <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-xl shadow-md flex items-center gap-3 border border-gray-200">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-700 font-medium">
                        {isLoading.handover
                            ? t("draggableMapUpdatingHandover")
                            : t("draggableMapUpdatingDelivery")}
                    </span>
                </div>
            )}

            {/* Legend */}
            <div className="hidden md:block absolute bottom-4 left-4 bg-white px-4 py-3 rounded-xl shadow-md border border-gray-200 w-max">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                    {t("draggableMapLegendTitle")}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500 ring-1 ring-gray-300"></div>
                        <span className="text-xs text-gray-600">
                            {t("draggableMapLegendHandover")}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500 ring-1 ring-gray-300"></div>
                        <span className="text-xs text-gray-600">
                            {t("commonDeliveryLocation")}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-600 ring-1 ring-gray-300"></div>
                        <span className="text-xs text-gray-600">
                            {t("draggableMapLegendDropPointKeeper")}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Mobile Info Button + Popup */}
            <div className="absolute md:hidden bottom-4 left-4 z-50">

                {/* Info Button (Mobile only) */}
                <button
                    onClick={() => setShowMapLegend(!showMapLegend)}
                    className="md:hidden w-5 h-5 bg-white border border-gray-200 shadow-md rounded-full flex items-center justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="#3B82F6" viewBox="0 0 640 640">
                        <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/>
                    </svg>
                </button>

                {showMapLegend && (
                    <div className="md:hidden absolute bottom-12 left-0 bg-white px-4 py-3 rounded-xl shadow-lg border border-gray-200 w-64">
                        <div className="text-sm font-semibold text-gray-700 mb-2">
                            Drag pins to select location
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-red-500 ring-1 ring-gray-300"></div>
                                <span className="text-xs text-gray-600">Handover Location</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-green-500 ring-1 ring-gray-300"></div>
                                <span className="text-xs text-gray-600">Delivery Location</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-blue-600 ring-1 ring-gray-300"></div>
                                <span className="text-xs text-gray-600">Drop Point Keeper</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
