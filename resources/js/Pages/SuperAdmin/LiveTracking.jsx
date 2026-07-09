import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import SuperAdminAuthenticated from "../Layouts/SuperAdminAuthenticated";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseFirestore } from "../../firebase";

const DEFAULT_CENTER = { lat: 33.5138, lng: 36.2765 };
const MIN_SYRIA_ZOOM = 7;

const loadScript = (src) =>
    new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            resolve();
            return;
        }

        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === "true") {
                resolve();
            } else {
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener(
                    "error",
                    () => reject(new Error(`Failed to load script: ${src}`)),
                    { once: true },
                );
            }
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.loaded = "false";

        script.addEventListener(
            "load",
            () => {
                script.dataset.loaded = "true";
                resolve();
            },
            { once: true },
        );
        script.addEventListener(
            "error",
            () => reject(new Error(`Failed to load script: ${src}`)),
            { once: true },
        );

        document.body.appendChild(script);
    });

const ensureGoogleMaps = async (apiKey, t) => {
    if (typeof window === "undefined") {
        return;
    }

    if (window.google?.maps) {
        return;
    }

    if (!apiKey) {
        throw new Error(t("superAdminHeatmapMissingApiKey"));
    }

    const scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    await loadScript(scriptSrc);

    if (!window.google?.maps) {
        throw new Error(t("superAdminHeatmapMapLoadError"));
    }
};

const clearMarkers = (markersRef) => {
    if (!markersRef.current) {
        markersRef.current = [];
        return;
    }

    markersRef.current.forEach((marker) => marker?.setMap?.(null));
    markersRef.current = [];
};

const parseCoordinate = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const renderRiderInfo = (rider, t) => {
    const parcels = Number.isFinite(rider?.active_parcels)
        ? rider.active_parcels
        : 0;
    const value = Number.isFinite(rider?.active_value) ? rider.active_value : 0;
    const formattedValue = value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });

    return `
        <div style="font-family: 'Inter', sans-serif; padding: 10px 12px; min-width: 220px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; font-weight: 600;">${escapeHtml(t("commonRiderDetails"))}</div>
            <div style="margin-top: 6px; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHtml(rider?.name ?? t("superAdminHeatmapUnknownRider"))}</div>
            <div style="font-size: 12px; color: #64748b;">${escapeHtml(rider?.role ?? t("commonRider"))}</div>
            <div style="margin-top: 10px; display: flex; gap: 16px;">
                <div>
                    <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.06em;">${escapeHtml(t("commonParcels"))}</div>
                    <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${parcels}</div>
                </div>
                <div>
                    <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.06em;">${escapeHtml(t("commonValue"))}</div>
                    <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${formattedValue} ${escapeHtml(t("commonCurrencySyp"))}</div>
                </div>
            </div>
        </div>
    `;
};

export default function LiveTracking({ riders = [], car_drivers = [] }) {
    const { t } = useTranslation();
    const page = usePage?.() || {};
    const config = page?.props?.config || {};
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;
    const markersMapRef = useRef(new Map());

    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const riderMarkersRef = useRef([]);
    const infoWindowRef = useRef(null);

    const [viewMode, setViewMode] = useState("all"); // | 'rider' | 'car_driver' | 'all'
    const [showModeDropdown, setShowModeDropdown] = useState(false);

    const [isMapReady, setIsMapReady] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [riderLocations, setRiderLocations] = useState([]);
    const baseRiders = Array.isArray(riders) ? riders : [];
    const baseCarDrivers = Array.isArray(car_drivers) ? car_drivers : [];

    const baseUsers = [
        ...baseRiders.map((r) => ({ ...r, type: "rider" })),
        ...baseCarDrivers.map((c) => ({ ...c, type: "car_driver" })),
    ];

    const filteredLocations = useMemo(() => {
        if (viewMode === "all") return riderLocations;

        return riderLocations.filter(
            (item) => item.type === viewMode
        );
    }, [riderLocations, viewMode]);

    useEffect(() => {
        const firestore = getFirebaseFirestore();
        if (!firestore) return;

        const ridersRef = collection(firestore, "tracking");

        const unsubscribe = onSnapshot(ridersRef, (snapshot) => {
            const trackingData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            const merged = baseUsers.map((rider) => {
                const liveData = trackingData.find(
                    (t) => String(t.id) === String(rider.id),
                );

                const lat = parseCoordinate(liveData?.lat ?? rider.latitude);
                const lng = parseCoordinate(liveData?.lng ?? rider.longitude);

                return {
                    rider: {
                        ...rider,
                        ...liveData,
                    },
                    type: rider.type,
                    lat,
                    lng,
                };
            });

            setRiderLocations(merged);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        let isCancelled = false;

        const load = async () => {
            try {
                await ensureGoogleMaps(googleMapsApiKey, t);
                if (isCancelled || !mapContainerRef.current) {
                    return;
                }

                const map = new window.google.maps.Map(
                    mapContainerRef.current,
                    {
                        center: DEFAULT_CENTER,
                        zoom: MIN_SYRIA_ZOOM,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                        clickableIcons: false,
                        zoomControl: true,
                        gestureHandling: "greedy",
                        minZoom: MIN_SYRIA_ZOOM,
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
                    },
                );

                mapInstanceRef.current = map;
                infoWindowRef.current = new window.google.maps.InfoWindow();
                setIsMapReady(true);

                setTimeout(() => {
                    window.google?.maps?.event?.trigger(map, "resize");
                }, 150);
            } catch (error) {
                console.error(error);
                if (!isCancelled) {
                    const resolvedError =
                        error?.message === t("superAdminHeatmapMissingApiKey")
                            ? error.message
                            : t("superAdminHeatmapMapLoadError");
                    setMapError(resolvedError);
                }
            }
        };

        load();

        return () => {
            isCancelled = true;
            clearMarkers(riderMarkersRef);
            infoWindowRef.current = null;
            mapInstanceRef.current = null;
        };
    }, [googleMapsApiKey, t]);

    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !window.google?.maps) {
            return;
        }

        const map = mapInstanceRef.current;
        const markersMap = markersMapRef.current;

        const currentIds = new Set();

        filteredLocations.forEach(({ rider, type, lat, lng }) => {
            if (lat == null || lng == null) return;
            if (!rider?.id) return;

            currentIds.add(rider.id);

            const existingMarker = markersMap.get(rider.id);

            if (existingMarker) {
                existingMarker.setPosition({ lat, lng });
                return;
            }

            const marker = new window.google.maps.Marker({
                position: { lat, lng },
                map,
                title: rider?.name,
                icon: {
                    url:
                        type === "rider"
                            ? "/assets/images/rider_icon.svg"
                            : "/assets/images/car-driver_icon.svg",
                    scaledSize: new window.google.maps.Size(45, 45),
                    anchor: new window.google.maps.Point(22, 22),
                },
            });

            marker.addListener("click", () => {
                if (!infoWindowRef.current) {
                    infoWindowRef.current = new window.google.maps.InfoWindow();
                }

                infoWindowRef.current.setContent(renderRiderInfo(rider, t));
                infoWindowRef.current.open(map, marker);
            });

            markersMap.set(rider.id, marker);
        });

        markersMap.forEach((marker, id) => {
            if (!currentIds.has(id)) {
                marker.setMap(null);
                markersMap.delete(id);
            }
        });
    }, [isMapReady, filteredLocations]);

    const headerContent = (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span>{t("commonHome")}</span>
                <span className="text-slate-300">&gt;</span>
                <span>{t("superAdminSidebarLiveTracking")}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                {t("superAdminSidebarLiveTracking")}
            </h1>
        </div>
    );

    return (
        <SuperAdminAuthenticated headerContent={headerContent}>
            <Head title={t("superAdminSidebarLiveTracking")} />

            <section className="px-0 py-0">
                <div className="mx-auto min-w-[90vw] min-h-[90vh] overflow-hidden border-0 bg-transparent md:border md:border-slate-200 md:bg-white md:shadow-[0_24px_55px_rgba(15,23,42,0.12)]">
                    <div className="relative z-0 h-[68vh] min-h-[90vh] w-full md:h-[78vh]">
                        <div
                            ref={mapContainerRef}
                            className="absolute inset-0 z-0"
                        />

                        {mapError && (
                            <div className="absolute inset-0 z-[1300] flex items-center justify-center bg-white/85 px-6 text-center text-sm text-red-500">
                                {mapError}
                            </div>
                        )}

                        {!isMapReady && !mapError && (
                            <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-slate-50 text-sm text-slate-500">
                                {t("superAdminHeatmapPreparingMap")}
                            </div>
                        )}

                        <div
                            className={`pointer-events-none absolute inset-x-6 top-6 z-[1250] flex flex-wrap items-start gap-4 md:inset-x-22 md:top-10 justify-end`}
                        >
                            <div className="pointer-events-auto flex flex-wrap items-center gap-3">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowModeDropdown(
                                                !showModeDropdown,
                                            )
                                        }
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[0_12px_32px_rgba(15,23,42,0.12)] transition hover:bg-slate-50"
                                    >
                                        {viewMode === "rider"
                                            ? t("superAdminHeatmapModeRiders")
                                            : viewMode === "car_driver"
                                              ? t(
                                                    "superAdminEmployeesStatCarDrivers",
                                                )
                                              : t("commonAll")}
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
                                                    setViewMode("all");
                                                    setShowModeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${viewMode === "all" ? "bg-blue-50 text-blue-600 font-semibold" : "text-slate-700"}`}
                                            >
                                                {t("commonAll")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewMode("rider");
                                                    setShowModeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${viewMode === "rider" ? "bg-blue-50 text-blue-600 font-semibold" : "text-slate-700"}`}
                                            >
                                                {t(
                                                    "superAdminHeatmapModeRiders",
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewMode("car_driver");
                                                    setShowModeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${viewMode === "car_driver" ? "bg-blue-50 text-blue-600 font-semibold" : "text-slate-700"}`}
                                            >
                                                {t(
                                                    "superAdminEmployeesStatCarDrivers",
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                router.visit(route("admin.dashboard"))
                            }
                            className="pointer-events-auto absolute bottom-7 right-7 z-[1250] inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#338DFF] text-white shadow-[0_18px_45px_rgba(51,141,255,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(51,141,255,0.6)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 cursor-pointer"
                            aria-label={t("superAdminHeatmapGoToDashboard")}
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
