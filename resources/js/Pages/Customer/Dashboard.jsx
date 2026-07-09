import React, { useState, useEffect, useRef } from "react";
import { Link, router } from "@inertiajs/react";
import CustomerSidebar from "../../Components/Customer/Sidebar";
import CustomerHeader from "../../Components/Customer/Header";
import Popup from "../SuperAdmin/Components/Popup";
import DraggableMapView from "../../Components/Customer/DraggableMapView";
import LocationSearchInput from "../../Components/Customer/LocationSearchInput";
import { useTranslation } from "react-i18next";
import { calculateShipmentPricing } from "../../utils/shipmentCalculationApi";
import NotificationDropdown from "../../Components/Customer/NotificationDropdown";

const CITY_COMPONENT_FIELDS = [
    "city",
    "town",
    "village",
    "municipality",
    "hamlet",
    "county",
    "district",
    "state_district",
    "subdistrict",
    "suburb",
    "neighbourhood",
    "locality",
    "borough",
];

const STATE_COMPONENT_FIELDS = [
    "state",
    "governorate",
    "region",
    "state_district",
    "province",
    "county",
];

const pickComponentValue = (components = {}, fields = []) => {
    for (const field of fields) {
        const value = components?.[field];
        if (value != null) {
            const trimmed = String(value).trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }
    return "";
};

const deriveCityName = (components = {}) =>
    pickComponentValue(components, CITY_COMPONENT_FIELDS);
const deriveStateName = (components = {}) =>
    pickComponentValue(components, STATE_COMPONENT_FIELDS);
const LOCATION_SERVICE_UNAVAILABLE_MESSAGE =
    "Please select a different location. Service is not available here.";

const buildCityPayloadFromMatch = (match, fallbackCity, fallbackState) => {
    if (!match?.exists || !match?.id) {
        return null;
    }

    const city = String(match.city || fallbackCity || "").trim();
    if (!city) {
        return null;
    }

    return {
        id: match.id,
        city,
        state: String(match.state || fallbackState || "").trim(),
    };
};
const toFiniteNumber = (value) => {
    const num = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(num) ? num : null;
};

const findExactDropPointMatch = (dropPoints, lat, lon) => {
    const normalizedLat = toFiniteNumber(lat);
    const normalizedLon = toFiniteNumber(lon);

    if (
        !Array.isArray(dropPoints) ||
        normalizedLat == null ||
        normalizedLon == null
    ) {
        return null;
    }

    return (
        dropPoints.find((dropPoint) => {
            const pointLat = toFiniteNumber(
                dropPoint?.latitude ??
                    dropPoint?.lat ??
                    dropPoint?.coordinates?.lat,
            );
            const pointLon = toFiniteNumber(
                dropPoint?.longitude ??
                    dropPoint?.lon ??
                    dropPoint?.lng ??
                    dropPoint?.coordinates?.lon ??
                    dropPoint?.coordinates?.lng,
            );



            return pointLat === normalizedLat && pointLon === normalizedLon;
        }) || null
    );
};

const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const r = 6371000;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const findSavedAddressMatch = (addresses, location) => {
    if (!Array.isArray(addresses) || !location) return null;
    const locLat = toFiniteNumber(
        location?.coordinates?.lat ?? location?.latitude ?? location?.lat,
    );
    const locLon = toFiniteNumber(
        location?.coordinates?.lon ?? location?.longitude ?? location?.lon,
    );

    if (locLat != null && locLon != null) {
        let best = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        addresses.forEach((address) => {
            const addrLat = toFiniteNumber(address?.latitude);
            const addrLon = toFiniteNumber(address?.longitude);
            if (addrLat == null || addrLon == null) return;
            const dist = distanceMeters(locLat, locLon, addrLat, addrLon);
            if (dist < bestDistance) {
                bestDistance = dist;
                best = address;
            }
        });
        if (best && bestDistance <= 100) {
            return best;
        }
    }

    const locationStreet = String(location?.address || "")
        .trim()
        .toLowerCase();
    if (!locationStreet) return null;
    return (
        addresses.find((address) => {
            const street = String(address?.street || "")
                .trim()
                .toLowerCase();
            return (
                street &&
                (locationStreet.includes(street) ||
                    street.includes(locationStreet))
            );
        }) || null
    );
};
export default function Dashboard({ addresses = [], dropPoints = [] }) {
    const ADDRESS_PAGE_SIZE = 5;

    const { t, i18n } = useTranslation();
    const isRTL = (i18n.language || "").toLowerCase().startsWith("ar");

    // Default locations
    const defaultHandoverLocation = {
        address: "",
        coordinates: { lat: 33.5130695, lon: 36.3095814 },
        components: {
            city: "",
            state: "",
            country: "Syria",
        },
        landmark: "",
        building: "",
        source: "pin",
        isDropPoint: false,
        dropPointId: null,
        dropPointName: "",
    };

    const defaultDeliveryLocation = {
        address: "",
        coordinates: { lat: 33.4587911, lon: 36.2388458 },
        components: {
            city: "",
            state: "",
            country: "Syria",
        },
        landmark: "",
        building: "",
        source: "pin",
        isDropPoint: false,
        dropPointId: null,
        dropPointName: "",
    };

    // Try to restore locations from sessionStorage (when user comes back from CreateBooking)
    const getInitialLocations = () => {
        try {
            const savedLocations = sessionStorage.getItem(
                "customerBookingLocations",
            );
            if (savedLocations) {
                const parsed = JSON.parse(savedLocations);
                // Clear after restoring
                sessionStorage.removeItem("customerBookingLocations");

                // Validate that coordinates are valid numbers
                const isValidCoord = (coord) =>
                    coord &&
                    typeof coord.lat === "number" &&
                    typeof coord.lon === "number" &&
                    !isNaN(coord.lat) &&
                    !isNaN(coord.lon);

                if (
                    parsed.handover &&
                    parsed.delivery &&
                    isValidCoord(parsed.handover.coordinates) &&
                    isValidCoord(parsed.delivery.coordinates)
                ) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Failed to restore locations:", e);
        }
        return null;
    };

    const initialLocations = getInitialLocations();

    const [handoverLocation, setHandoverLocation] = useState(() => {
        const initial = initialLocations?.handover || defaultHandoverLocation;
        return { ...initial, source: initial?.source || "pin" };
    });
    const [deliveryLocation, setDeliveryLocation] = useState(() => {
        const initial = initialLocations?.delivery || defaultDeliveryLocation;
        return { ...initial, source: initial?.source || "pin" };
    });
    // Track which location was last changed to focus map
    const [activeKey, setActiveKey] = useState("handover"); // 'handover' | 'delivery'
    const [handoverFocused, setHandoverFocused] = useState(false);
    const [deliveryFocused, setDeliveryFocused] = useState(false);
    const [showHandoverSaved, setShowHandoverSaved] = useState(false);
    const [showDeliverySaved, setShowDeliverySaved] = useState(false);
    const [handoverVisibleCount, setHandoverVisibleCount] =
        useState(ADDRESS_PAGE_SIZE);
    const [deliveryVisibleCount, setDeliveryVisibleCount] =
        useState(ADDRESS_PAGE_SIZE);
    const [handoverSearchQuery, setHandoverSearchQuery] = useState("");
    const [deliverySearchQuery, setDeliverySearchQuery] = useState("");
    // Flag to prevent blur from closing the dropdown when clicking inside it
    const handoverDropdownMouseDown = useRef(false);
    const deliveryDropdownMouseDown = useRef(false);
    const handoverInputRef = useRef(null);
    const deliveryInputRef = useRef(null);
    const [mapFocusRequest, setMapFocusRequest] = useState({
        key: "handover",
        nonce: 0,
    });

    // Which pin slot is currently "active" — drives which location a DP click fills
    const [activePin, setActivePin] = useState("handover"); // 'handover' | 'delivery'

    useEffect(() => {
        setHandoverVisibleCount((current) =>
            Math.min(current, Math.max(addresses.length, ADDRESS_PAGE_SIZE)),
        );
        setDeliveryVisibleCount((current) =>
            Math.min(current, Math.max(addresses.length, ADDRESS_PAGE_SIZE)),
        );
    }, [addresses.length]);

    const filterAddressesByQuery = (addrList, query) => {
        if (!query || !query.trim()) return addrList;
        const q = query.trim().toLowerCase();
        return addrList
            .filter((a) => {
                const name = (a.location_name || "").toLowerCase();
                const street = (a.street || "").toLowerCase();
                const area = (a.area || "").toLowerCase();
                const city = (a.city || "").toLowerCase();
                // Only match entries that start with the query — no mid-word matches
                return (
                    name.startsWith(q) ||
                    street.startsWith(q) ||
                    area.startsWith(q) ||
                    city.startsWith(q)
                );
            })
            .sort((a, b) => {
                // Entries whose location_name starts with the query come first
                const aName = (a.location_name || "").toLowerCase();
                const bName = (b.location_name || "").toLowerCase();
                const aStarts = aName.startsWith(q) ? 0 : 1;
                const bStarts = bName.startsWith(q) ? 0 : 1;
                return aStarts - bStarts;
            });
    };

    const filteredHandoverAddresses = filterAddressesByQuery(
        addresses,
        handoverSearchQuery,
    );
    const filteredDeliveryAddresses = filterAddressesByQuery(
        addresses,
        deliverySearchQuery,
    );

    const requestMapFocus = (key) => {
        setActiveKey(key);
        setMapFocusRequest((current) => ({
            key,
            nonce: current.nonce + 1,
        }));
    };

    const activateLocationCard = (
        key,
        { focusInput = false, focusMap = true } = {},
    ) => {
        const isDelivery = key === "delivery";
        const inputRef = isDelivery ? deliveryInputRef : handoverInputRef;
        const location = isDelivery ? deliveryLocation : handoverLocation;

        setActiveKey(key);
        setActivePin(key);

        if (isDelivery) {
            setDeliveryFocused(true);
            setShowDeliverySaved(true);
            setDeliveryVisibleCount(ADDRESS_PAGE_SIZE);
            setHandoverFocused(false);
            setShowHandoverSaved(false);
            setHandoverSearchQuery("");
        } else {
            setHandoverFocused(true);
            setShowHandoverSaved(true);
            setHandoverVisibleCount(ADDRESS_PAGE_SIZE);
            setDeliveryFocused(false);
            setShowDeliverySaved(false);
            setDeliverySearchQuery("");
        }

        if (focusMap && (location?.address || "").trim()) {
            requestMapFocus(key);
        }

        if (focusInput) {
            if (typeof window !== "undefined") {
                window.requestAnimationFrame(() => {
                    inputRef.current?.focus();
                });
            } else {
                inputRef.current?.focus();
            }
        }
    };

    const handleLocationCardMouseDown = (key, event) => {
        const dropdownTarget = event.target.closest(
            `[data-saved-address-dropdown="${key}"]`,
        );
        if (dropdownTarget) {
            return;
        }
        activateLocationCard(key, { focusInput: true });
    };

    const [showCityCheckModal, setShowCityCheckModal] = useState(false);
    const [locationValidationError, setLocationValidationError] = useState("");
    const [locationServiceError, setLocationServiceError] = useState("");
    const [shipmentCalculationState, setShipmentCalculationState] = useState({
        status: "idle", // idle | loading | success | error
        shipmentType: null,
        message: "",
        cityMatches: null,
        response: null,
    });
    const calculationRequestRef = useRef(0);
    const hasLocationServiceError = Boolean(locationServiceError);

    const isShipmentTypeValid =
        shipmentCalculationState.shipmentType === "direct" ||
        shipmentCalculationState.shipmentType === "indirect";
    const isNextDisabled =
        shipmentCalculationState.status !== "success" || !isShipmentTypeValid;
    const isCalculatingShipmentType =
        shipmentCalculationState.status === "loading";

    useEffect(() => {
        const senderLat = toFiniteNumber(handoverLocation?.coordinates?.lat);
        const senderLng = toFiniteNumber(handoverLocation?.coordinates?.lon);
        const receiverLat = toFiniteNumber(deliveryLocation?.coordinates?.lat);
        const receiverLng = toFiniteNumber(deliveryLocation?.coordinates?.lon);
        const hasHandoverAddress = Boolean(
            (handoverLocation?.address || "").trim(),
        );
        const hasDeliveryAddress = Boolean(
            (deliveryLocation?.address || "").trim(),
        );

        if (
            !hasHandoverAddress ||
            !hasDeliveryAddress ||
            senderLat == null ||
            senderLng == null ||
            receiverLat == null ||
            receiverLng == null
        ) {
            setShipmentCalculationState({
                status: "idle",
                shipmentType: null,
                message: "",
                cityMatches: null,
                response: null,
            });
            setLocationServiceError("");
            return undefined;
        }

        const requestId = calculationRequestRef.current + 1;
        calculationRequestRef.current = requestId;
        const abortController = new AbortController();

        setShipmentCalculationState((prev) => ({
            ...prev,
            status: "loading",
            shipmentType: null,
            message: "",
        }));
        setLocationServiceError("");

        const timerId = setTimeout(async () => {
            try {
                const senderCity = deriveCityName(
                    handoverLocation?.components || {},
                );
                const senderState = deriveStateName(
                    handoverLocation?.components || {},
                );
                const receiverCity = deriveCityName(
                    deliveryLocation?.components || {},
                );
                const receiverState = deriveStateName(
                    deliveryLocation?.components || {},
                );

                const result = await calculateShipmentPricing({
                    sender_lat: senderLat,
                    sender_lng: senderLng,
                    receiver_lat: receiverLat,
                    receiver_lng: receiverLng,
                    sender_city: senderCity,
                    sender_state: senderState,
                    receiver_city: receiverCity,
                    receiver_state: receiverState,
                    signal: abortController.signal,
                });

                if (calculationRequestRef.current !== requestId) {
                    return;
                }

                if (!result.ok) {
                    setShipmentCalculationState({
                        status: "error",
                        shipmentType: null,
                        message: result.message || t("dashboardCityCheckError"),
                        cityMatches: result.cityMatches ?? null,
                        response: result.body ?? null,
                    });
                    setLocationServiceError(LOCATION_SERVICE_UNAVAILABLE_MESSAGE);
                    return;
                }

                const calculatedType = result.shipmentType;
                const isValidType =
                    calculatedType === "direct" ||
                    calculatedType === "indirect";
                if (!isValidType) {
                    setShipmentCalculationState({
                        status: "error",
                        shipmentType: null,
                        message: t("dashboardCityCheckError"),
                        cityMatches: result.cityMatches ?? null,
                        response: result.body ?? null,
                    });
                    setLocationServiceError(LOCATION_SERVICE_UNAVAILABLE_MESSAGE);
                    return;
                }

                setShipmentCalculationState({
                    status: "success",
                    shipmentType: calculatedType,
                    message: "",
                    cityMatches: result.cityMatches ?? null,
                    response: result.body ?? null,
                });
                setLocationServiceError("");
            } catch (error) {
                if (
                    abortController.signal.aborted ||
                    calculationRequestRef.current !== requestId
                ) {
                    return;
                }
                console.error("Shipment calculation failed", error);
                setShipmentCalculationState({
                    status: "error",
                    shipmentType: null,
                    message: t("dashboardCityCheckError"),
                    cityMatches: null,
                    response: null,
                });
                setLocationServiceError(LOCATION_SERVICE_UNAVAILABLE_MESSAGE);
            }
        }, 450);

        return () => {
            clearTimeout(timerId);
            abortController.abort();
        };
    }, [
        handoverLocation?.address,
        handoverLocation?.coordinates?.lat,
        handoverLocation?.coordinates?.lon,
        handoverLocation?.components,
        deliveryLocation?.address,
        deliveryLocation?.coordinates?.lat,
        deliveryLocation?.coordinates?.lon,
        deliveryLocation?.components,
        t,
    ]);

    const handleProceedToBooking = async () => {
        const hasHandoverAddress = Boolean(
            (handoverLocation?.address || "").trim(),
        );
        const hasDeliveryAddress = Boolean(
            (deliveryLocation?.address || "").trim(),
        );
        const hasHandoverCoords =
            Number.isFinite(handoverLocation?.coordinates?.lat) &&
            Number.isFinite(handoverLocation?.coordinates?.lon);
        const hasDeliveryCoords =
            Number.isFinite(deliveryLocation?.coordinates?.lat) &&
            Number.isFinite(deliveryLocation?.coordinates?.lon);

        if (!hasHandoverAddress || !hasHandoverCoords) {
            setLocationValidationError(t("dashboardPickupLocationRequired"));
            return;
        }

        if (!hasDeliveryAddress || !hasDeliveryCoords) {
            setLocationValidationError(t("dashboardDropoffLocationRequired"));
            return;
        }

        if (isNextDisabled) {
            setLocationValidationError(
                isCalculatingShipmentType
                    ? "Checking shipment type. Please wait."
                    : shipmentCalculationState.message ||
                          t("dashboardCityCheckError"),
            );
            return;
        }

        try {
            // Extract city and state from location components with multiple fallbacks
            const hComp = handoverLocation?.components || {};
            const dComp = deliveryLocation?.components || {};
            const handoverDropPointMatch = findExactDropPointMatch(
                dropPoints,
                handoverLocation?.coordinates?.lat,
                handoverLocation?.coordinates?.lon,
            );
            const deliveryDropPointMatch = findExactDropPointMatch(
                dropPoints,
                deliveryLocation?.coordinates?.lat,
                deliveryLocation?.coordinates?.lon,
            );
            const isHandoverLocationDP = Boolean(handoverDropPointMatch);
            const isDeliveryLocationDP = Boolean(deliveryDropPointMatch);
            const handoverCity = deriveCityName(hComp);
            const handoverState = deriveStateName(hComp);
            const deliveryCity = deriveCityName(dComp);
            const deliveryState = deriveStateName(dComp);
            const cachedCityMatches =
                shipmentCalculationState?.cityMatches || {};
            const handoverCityPayload = buildCityPayloadFromMatch(
                cachedCityMatches.from,
                handoverCity,
                handoverState,
            );
            const deliveryCityPayload = buildCityPayloadFromMatch(
                cachedCityMatches.to,
                deliveryCity,
                deliveryState,
            );

            if (!handoverCityPayload || !deliveryCityPayload) {
                const handoverError = !handoverCityPayload
                    ? cachedCityMatches?.from?.message
                        ? `${t("dashboardNoPickupCityFound")} (${cachedCityMatches.from.message})`
                        : t("dashboardNoPickupCityFound")
                    : "";
                const deliveryError = !deliveryCityPayload
                    ? cachedCityMatches?.to?.message
                        ? `${t("dashboardNoDropoffCityFound")} (${cachedCityMatches.to.message})`
                        : t("dashboardNoDropoffCityFound")
                    : "";
                setLocationValidationError(
                    handoverError ||
                        deliveryError ||
                        shipmentCalculationState.message ||
                        t("dashboardUnableCities"),
                );
                return;
            }
            const handoverSource = handoverLocation?.source || "pin";
            const deliverySource = deliveryLocation?.source || "pin";
            const handoverSaved =
                handoverSource === "address_book"
                    ? findSavedAddressMatch(addresses, handoverLocation)
                    : null;
            const deliverySaved =
                deliverySource === "address_book"
                    ? findSavedAddressMatch(addresses, deliveryLocation)
                    : null;
            const handoverLandmark =
                handoverSource === "address_book"
                    ? handoverLocation?.landmark ||
                      handoverSaved?.landmark ||
                      ""
                    : "";
            const handoverBuilding =
                handoverSource === "address_book"
                    ? handoverLocation?.building ||
                      handoverSaved?.building_name ||
                      handoverSaved?.building ||
                      ""
                    : "";
            const deliveryLandmark =
                deliverySource === "address_book"
                    ? deliveryLocation?.landmark ||
                      deliverySaved?.landmark ||
                      ""
                    : "";
            const deliveryBuilding =
                deliverySource === "address_book"
                    ? deliveryLocation?.building ||
                      deliverySaved?.building_name ||
                      deliverySaved?.building ||
                      ""
                    : "";
            const handoverName =
                handoverSource === "address_book"
                    ? handoverLocation?.name || handoverSaved?.name || ""
                    : "";
            const handoverEmail =
                handoverSource === "address_book"
                    ? handoverLocation?.email || handoverSaved?.email || ""
                    : "";
            const handoverMobile =
                handoverSource === "address_book"
                    ? handoverLocation?.mobile || handoverSaved?.mobile || ""
                    : "";
            const deliveryName =
                deliverySource === "address_book"
                    ? deliveryLocation?.name || deliverySaved?.name || ""
                    : "";
            const deliveryEmail =
                deliverySource === "address_book"
                    ? deliveryLocation?.email || deliverySaved?.email || ""
                    : "";
            const deliveryMobile =
                deliverySource === "address_book"
                    ? deliveryLocation?.mobile || deliverySaved?.mobile || ""
                    : "";
            setLocationValidationError("");
            router.visit("/customer/create-booking", {
                method: "get",
                data: {
                    handover_address: handoverLocation.address,
                    handover_latitude: handoverLocation?.coordinates?.lat,
                    handover_longitude: handoverLocation?.coordinates?.lon,
                    handover_city: handoverCityPayload.city,
                    handover_state: handoverCityPayload.state || handoverState,
                    handover_landmark: handoverLandmark,
                    handover_building: handoverBuilding,
                    handover_source: handoverSource,
                    handover_city_id: handoverCityPayload.id,
                    handover_is_drop_point: isHandoverLocationDP ? "1" : "0",
                    handover_drop_point_id:
                        handoverDropPointMatch?.id ??
                        handoverLocation.dropPointId ??
                        "",
                    handover_drop_point_name:
                        handoverDropPointMatch?.name ??
                        handoverLocation.dropPointName ??
                        "",
                    handover_name: handoverName,
                    handover_email: handoverEmail,
                    handover_mobile: handoverMobile,
                    sender_name: handoverName,
                    sender_email: handoverEmail,
                    sender_phone: handoverMobile,
                    isHandoverLocationDP: isHandoverLocationDP ? "1" : "0",
                    delivery_address: deliveryLocation.address,
                    delivery_latitude: deliveryLocation?.coordinates?.lat,
                    delivery_longitude: deliveryLocation?.coordinates?.lon,
                    delivery_city: deliveryCityPayload.city,
                    delivery_state: deliveryCityPayload.state || deliveryState,
                    delivery_landmark: deliveryLandmark,
                    delivery_building: deliveryBuilding,
                    delivery_source: deliverySource,
                    delivery_city_id: deliveryCityPayload.id,
                    delivery_is_drop_point: isDeliveryLocationDP ? "1" : "0",
                    delivery_drop_point_id:
                        deliveryDropPointMatch?.id ??
                        deliveryLocation.dropPointId ??
                        "",
                    delivery_drop_point_name:
                        deliveryDropPointMatch?.name ??
                        deliveryLocation.dropPointName ??
                        "",
                    delivery_name: deliveryName,
                    delivery_email: deliveryEmail,
                    delivery_mobile: deliveryMobile,
                    receiver_name: deliveryName,
                    receiver_email: deliveryEmail,
                    receiver_phone: deliveryMobile,
                    isDeliveryLocationDP: isDeliveryLocationDP ? "1" : "0",
                    calculated_shipment_type:
                        shipmentCalculationState.shipmentType ?? "",
                },
            });
        } catch (e) {
            console.error("City check failed", e);
            setLocationValidationError(t("dashboardCityCheckError"));
        }
    };
    const handleSwapLocations = () => {
        setHandoverLocation({
            address: deliveryLocation.address,
            coordinates: { ...(deliveryLocation.coordinates ?? {}) },
            components: { ...(deliveryLocation.components ?? {}) },
            landmark: deliveryLocation.landmark || "",
            building: deliveryLocation.building || "",
            source: deliveryLocation.source || "pin",
            isDropPoint: deliveryLocation.isDropPoint || false,
            dropPointId: deliveryLocation.dropPointId || null,
            dropPointName: deliveryLocation.dropPointName || "",
        });
        setDeliveryLocation({
            address: handoverLocation.address,
            coordinates: { ...(handoverLocation.coordinates ?? {}) },
            components: { ...(handoverLocation.components ?? {}) },
            landmark: handoverLocation.landmark || "",
            building: handoverLocation.building || "",
            source: handoverLocation.source || "pin",
            isDropPoint: handoverLocation.isDropPoint || false,
            dropPointId: handoverLocation.dropPointId || null,
            dropPointName: handoverLocation.dropPointName || "",
        });
        setHandoverFocused(false);
        setDeliveryFocused(false);
        setShowHandoverSaved(false);
        setShowDeliverySaved(false);
    };

    // Called when the user clicks a drop-point marker on the map
    const handleDropPointSelect = (dropPoint, pinType) => {
        const lat = parseFloat(
            dropPoint?.latitude ??
                dropPoint?.lat ??
                dropPoint?.coordinates?.lat ??
                0,
        );
        const lon = parseFloat(
            dropPoint?.longitude ??
                dropPoint?.lon ??
                dropPoint?.lng ??
                dropPoint?.coordinates?.lon ??
                dropPoint?.coordinates?.lng ??
                0,
        );
        const city = dropPoint?.city || "";
        const address =
            dropPoint?.address || dropPoint?.name || `${lat}, ${lon}`;
        const locationData = {
            address,
            coordinates: { lat, lon },
            components: { city, state: "", country: "Syria" },
            landmark: "",
            building: "",
            source: "drop_point",
            isDropPoint: true,
            dropPointId: dropPoint?.id ?? null,
            dropPointName: dropPoint?.name || "",
        };
        if (pinType === "delivery") {
            setDeliveryLocation(locationData);
            requestMapFocus("delivery");
            // After filling delivery, switch focus back to handover for next action
            setActivePin("handover");
        } else {
            setHandoverLocation(locationData);
            requestMapFocus("handover");
            // After filling handover, automatically switch focus to delivery
            setActivePin("delivery");
        }
    };

    return (
        <div className="min-h-screen bg-[#f8f9fb] text-[#1f2937] flex flex-col md:flex-row overflow-x-hidden">
            <CustomerSidebar />
            <main className="flex-1 md:ml-[72px] md:overflow-y-auto">
                <CustomerHeader
                    title={t("commonDashboard")}
                    breadcrumbs={[
                        {
                            label: t("commonHome"),
                            href: "/customer/dashboard",
                        },
                        { label: t("commonDashboard") },
                    ]}
                />
                {hasLocationServiceError && (
                    <div className="block md:hidden fixed top-4 left-0 right-0 z-50 px-3">
                        <div className="bg-red-500 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
                        
                        <span>{locationServiceError}</span>

                        <button
                            onClick={() => setLocationServiceError("")}
                            className="ml-3 text-white text-lg leading-none"
                        >
                            ×
                        </button>
                        </div>
                    </div>
                )}
                <div className="px-0 py-0 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-10 lg:py-6 h-screen md:h-auto">
                    <div className="relative h-full md:h-auto">
                        <div className={`md:hidden fixed top-3 z-20 bg-white rounded-full ${isRTL ? "left-3" : "right-3"}`}>
                            <NotificationDropdown />
                        </div>
                        <DraggableMapView
                            handoverLocation={{
                                lat: handoverLocation.coordinates.lat,
                                lon: handoverLocation.coordinates.lon,
                            }}
                            deliveryLocation={{
                                lat: deliveryLocation.coordinates.lat,
                                lon: deliveryLocation.coordinates.lon,
                            }}
                            onHandoverChange={(locationData) => {
                                setHandoverLocation({
                                    address: locationData.address,
                                    coordinates: {
                                        lat: locationData.lat,
                                        lon: locationData.lon,
                                    },
                                    components: {
                                        city: locationData.city,
                                        state: locationData.state,
                                        country:
                                            locationData.components?.country ||
                                            "Syria",
                                    },
                                    landmark: "",
                                    building: "",
                                    source: "pin",
                                    isDropPoint: false,
                                    dropPointId: null,
                                    dropPointName: "",
                                });
                                requestMapFocus("handover");
                            }}
                            onDeliveryChange={(locationData) => {
                                setDeliveryLocation({
                                    address: locationData.address,
                                    coordinates: {
                                        lat: locationData.lat,
                                        lon: locationData.lon,
                                    },
                                    components: {
                                        city: locationData.city,
                                        state: locationData.state,
                                        country:
                                            locationData.components?.country ||
                                            "Syria",
                                    },
                                    landmark: "",
                                    building: "",
                                    source: "pin",
                                    isDropPoint: false,
                                    dropPointId: null,
                                    dropPointName: "",
                                });
                                requestMapFocus("delivery");
                            }}
                            dropPoints={dropPoints}
                            activePin={activePin}
                            focusedPin={activeKey}
                            focusRequestNonce={mapFocusRequest.nonce}
                            onDropPointSelect={handleDropPointSelect}
                            heightClass="h-[calc(100vh-80px)] md:h-[calc(100vh-140px)]"
                        />

                        <div className={`hidden md:flex absolute left-0 right-0 top-20 md:top-auto md:bottom-6 flex justify-center px-4 ${hasLocationServiceError ? 'md:max-h-[200px]' : 'md:max-h-[150px]'} overflow-visible`}>
                            <div
                                className={`w-full max-w-5xl md:bg-white/90 md:backdrop-blur rounded-[22px] p-4 md:p-6 flex flex-col md:flex-row md:flex-wrap items-start relative ${hasLocationServiceError ? "border border-red-300 shadow-[0_0_0_1px_rgba(239,68,68,0.15),0_12px_30px_rgba(239,68,68,0.10)]" : "border border-gray-200 md:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"}`}
                            >
                                {hasLocationServiceError && (
                                    <div className="order-start basis-full w-full mb-3 md:mb-4">
                                        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-sm text-red-600">
                                            {locationServiceError}
                                        </div>
                                    </div>
                                )}
                                <div
                                    className="w-full md:w-auto flex-1 relative bg-white/90 backdrop-blur rounded-[14px] border border-gray-200 p-4 -mb-3 md:-mb-0 md:-mr-2"
                                    onMouseDown={(event) =>
                                        handleLocationCardMouseDown(
                                            "handover",
                                            event,
                                        )
                                    }
                                >
                                    {handoverFocused &&
                                        showHandoverSaved &&
                                        Array.isArray(addresses) &&
                                        addresses.length > 0 && (
                                            <div
                                                data-saved-address-dropdown="handover"
                                                className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[14px] shadow-[0_12px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50"
                                                onMouseDown={() => {
                                                    handoverDropdownMouseDown.current = true;
                                                }}
                                            >
                                                {/* Search inside address book */}
                                                <div className="px-3 pt-3 pb-2">
                                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                                                        <svg
                                                            className="w-3.5 h-3.5 text-gray-400 shrink-0"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle
                                                                cx="11"
                                                                cy="11"
                                                                r="8"
                                                            />
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M21 21l-4.35-4.35"
                                                            />
                                                        </svg>
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder-gray-400"
                                                            placeholder={t(
                                                                "customerDashboardSearchSavedPlaceholder",
                                                            )}
                                                            value={
                                                                handoverSearchQuery
                                                            }
                                                            onChange={(e) => {
                                                                setHandoverSearchQuery(
                                                                    e.target
                                                                        .value,
                                                                );
                                                                setHandoverVisibleCount(
                                                                    ADDRESS_PAGE_SIZE,
                                                                );
                                                            }}
                                                        />
                                                        {handoverSearchQuery && (
                                                            <button
                                                                type="button"
                                                                className="text-gray-400 hover:text-gray-600"
                                                                onMouseDown={(
                                                                    e,
                                                                ) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setHandoverSearchQuery(
                                                                        "",
                                                                    );
                                                                    setHandoverVisibleCount(
                                                                        ADDRESS_PAGE_SIZE,
                                                                    );
                                                                }}
                                                            >
                                                                <svg
                                                                    className="w-3 h-3"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        d="M6 18L18 6M6 6l12 12"
                                                                    />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto">
                                                    {filteredHandoverAddresses
                                                        .slice(
                                                            0,
                                                            handoverVisibleCount,
                                                        )
                                                        .map((a, idx) => (
                                                            <div
                                                                key={
                                                                    a.id ?? idx
                                                                }
                                                                className={`flex items-start gap-3 px-2 py-3 ${idx !== Math.min(filteredHandoverAddresses.length, handoverVisibleCount) - 1 ? "border-b border-gray-200" : ""}`}
                                                            >
                                                                <span className="mt-1 inline-flex items-center justify-center rounded-full ">
                                                                    <img
                                                                        src="/assets/images/location_icon.png"
                                                                        alt="pin"
                                                                    />
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="flex-1 text-left"
                                                                    onMouseDown={(
                                                                        e,
                                                                    ) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const fullAddress =
                                                                            [
                                                                                a.street,
                                                                                a.area,
                                                                                a.city,
                                                                            ]
                                                                                .filter(
                                                                                    Boolean,
                                                                                )
                                                                                .join(
                                                                                    ", ",
                                                                                ) ||
                                                                            a.street ||
                                                                            "";
                                                                        const lat =
                                                                            parseFloat(
                                                                                a.latitude ??
                                                                                    0,
                                                                            );
                                                                        const lon =
                                                                            parseFloat(
                                                                                a.longitude ??
                                                                                    0,
                                                                            );
                                                                        const comp =
                                                                            {
                                                                                city:
                                                                                    a.city ||
                                                                                    a.area ||
                                                                                    "",
                                                                                state:
                                                                                    a.state ||
                                                                                    a.governorate ||
                                                                                    "",
                                                                                country:
                                                                                    a.country ||
                                                                                    "Syria",
                                                                            };
                                                                        setHandoverLocation(
                                                                            {
                                                                                address:
                                                                                    fullAddress,
                                                                                coordinates:
                                                                                    {
                                                                                        lat,
                                                                                        lon,
                                                                                    },
                                                                                components:
                                                                                    comp,
                                                                                landmark:
                                                                                    a.landmark ||
                                                                                    "",
                                                                                building:
                                                                                    a.building_name ||
                                                                                    "",
                                                                                name:
                                                                                    a.name ||
                                                                                    "",
                                                                                email:
                                                                                    a.email ||
                                                                                    "",
                                                                                mobile:
                                                                                    a.mobile ||
                                                                                    "",
                                                                                source: "address_book",
                                                                            },
                                                                        );
                                                                        setHandoverSearchQuery(
                                                                            "",
                                                                        );
                                                                        requestMapFocus(
                                                                            "handover",
                                                                        );
                                                                        setHandoverFocused(
                                                                            false,
                                                                        );
                                                                        setShowHandoverSaved(
                                                                            false,
                                                                        );
                                                                    }}
                                                                >
                                                                    <span className="block text-sm font-semibold text-[#111827] leading-tight">
                                                                        {a.location_name ||
                                                                            t(
                                                                                "commonSaved",
                                                                            )}
                                                                    </span>
                                                                    <span className="mt-1 block text-xs text-[#6b7280] leading-tight">
                                                                        {[
                                                                            a.street,
                                                                            a.area,
                                                                            a.city,
                                                                        ]
                                                                            .filter(
                                                                                Boolean,
                                                                            )
                                                                            .join(
                                                                                ", ",
                                                                            )}
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    {filteredHandoverAddresses.length ===
                                                        0 && (
                                                        <div className="px-4 py-3 text-sm text-gray-500">
                                                            {t(
                                                                "locationSearchNoResults",
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {filteredHandoverAddresses.length >
                                                    handoverVisibleCount && (
                                                    <div className="px-3 py-2">
                                                        <button
                                                            type="button"
                                                            className="text-sm float-right cursor-pointer font-semibold text-blue-500 hover:text-blue-600"
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                            }}
                                                            onClick={() => {
                                                                setHandoverVisibleCount(
                                                                    (current) =>
                                                                        Math.min(
                                                                            current +
                                                                                ADDRESS_PAGE_SIZE,
                                                                            filteredHandoverAddresses.length,
                                                                        ),
                                                                );
                                                            }}
                                                        >
                                                            {t(
                                                                "customerDashboardSeeMore",
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    <div className="text-sm font-semibold text-blue-500 flex items-center gap-2">
                                        <img
                                            src="/assets/images/map-pin.svg"
                                            alt={t("customerDashboardPinAlt")}
                                            className="w-4 h-4"
                                        />
                                        {t("commonHandOverLocation")}
                                    </div>
                                    <LocationSearchInput
                                        inputRef={handoverInputRef}
                                        value={handoverLocation.address}
                                        onChange={(text) => {
                                            setHandoverLocation({
                                                ...handoverLocation,
                                                address: text,
                                                landmark: "",
                                                building: "",
                                                source: "pin",
                                            });
                                            setShowHandoverSaved(false);
                                        }}
                                        onSelect={({
                                            address,
                                            lat,
                                            lon,
                                            components,
                                        }) => {
                                            setHandoverLocation({
                                                address,
                                                coordinates: { lat, lon },
                                                components: components || {},
                                                landmark: "",
                                                building: "",
                                                source: "pin",
                                            });
                                            setHandoverSearchQuery("");
                                            requestMapFocus("handover");
                                        }}
                                        savedAddresses={[]}
                                        onInputFocus={() =>
                                            activateLocationCard("handover", {
                                                focusMap: false,
                                            })
                                        }
                                        onInputBlur={() => {
                                            if (
                                                handoverDropdownMouseDown.current
                                            ) {
                                                handoverDropdownMouseDown.current = false;
                                                return;
                                            }
                                            setTimeout(() => {
                                                setHandoverFocused(false);
                                                setShowHandoverSaved(false);
                                                setHandoverSearchQuery("");
                                            }, 100);
                                        }}
                                        placeholder={t(
                                            "customerDashboardHandoverPlaceholder",
                                        )}
                                    />
                                    <div className="mt-3 border-b border-gray-200" />
                                </div>

                                {/* Middle swap connector */}
                                <div
                                    className={`flex items-center z-10 justify-center self-center md:self-auto -mx-1 ${handoverFocused || deliveryFocused ? "md:self-end md:mb-5" : "md:mt-5"}`}
                                >
                                    <div
                                        className="relative w-10 h-10 md:w-15 md:h-15 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center cursor-pointer"
                                        onClick={handleSwapLocations}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" ||
                                                event.key === " "
                                            ) {
                                                event.preventDefault();
                                                handleSwapLocations();
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <img
                                            src="/assets/images/arrow-double.png"
                                            onError={() => {}}
                                            alt={t("customerDashboardSwapAlt")}
                                            className="w-5 h-5 md:w-9 md:h-9 opacity-70 rotate-90 md:rotate-0"
                                        />
                                    </div>
                                </div>

                                {/* Right card */}
                                <div
                                    className="w-[100%] md:w-auto flex-1 relative bg-white/90 backdrop-blur rounded-[14px] border border-gray-200 p-4 -mt-3 md:-mt-0 md:-ml-2"
                                    onMouseDown={(event) =>
                                        handleLocationCardMouseDown(
                                            "delivery",
                                            event,
                                        )
                                    }
                                >
                                    {/* Saved addresses list for Delivery (inline, same design) */}
                                    {deliveryFocused &&
                                        showDeliverySaved &&
                                        Array.isArray(addresses) &&
                                        addresses.length > 0 && (
                                            <div
                                                data-saved-address-dropdown="delivery"
                                                className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[14px] shadow-[0_12px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50"
                                                onMouseDown={() => {
                                                    deliveryDropdownMouseDown.current = true;
                                                }}
                                            >
                                                {/* Search inside address book */}
                                                <div className="px-3 pt-3 pb-2">
                                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                                                        <svg
                                                            className="w-3.5 h-3.5 text-gray-400 shrink-0"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle
                                                                cx="11"
                                                                cy="11"
                                                                r="8"
                                                            />
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M21 21l-4.35-4.35"
                                                            />
                                                        </svg>
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder-gray-400"
                                                            placeholder={t(
                                                                "customerDashboardSearchSavedPlaceholder",
                                                            )}
                                                            value={
                                                                deliverySearchQuery
                                                            }
                                                            onChange={(e) => {
                                                                setDeliverySearchQuery(
                                                                    e.target
                                                                        .value,
                                                                );
                                                                setDeliveryVisibleCount(
                                                                    ADDRESS_PAGE_SIZE,
                                                                );
                                                            }}
                                                        />
                                                        {deliverySearchQuery && (
                                                            <button
                                                                type="button"
                                                                className="text-gray-400 hover:text-gray-600"
                                                                onMouseDown={(
                                                                    e,
                                                                ) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setDeliverySearchQuery(
                                                                        "",
                                                                    );
                                                                    setDeliveryVisibleCount(
                                                                        ADDRESS_PAGE_SIZE,
                                                                    );
                                                                }}
                                                            >
                                                                <svg
                                                                    className="w-3 h-3"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        d="M6 18L18 6M6 6l12 12"
                                                                    />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto">
                                                    {filteredDeliveryAddresses
                                                        .slice(
                                                            0,
                                                            deliveryVisibleCount,
                                                        )
                                                        .map((a, idx) => (
                                                            <div
                                                                key={
                                                                    a.id ?? idx
                                                                }
                                                                className={`flex items-start gap-3 px-2 py-3 ${idx !== Math.min(filteredDeliveryAddresses.length, deliveryVisibleCount) - 1 ? "border-b border-gray-200" : ""}`}
                                                            >
                                                                <span className="mt-1 inline-flex items-center justify-center rounded-full ">
                                                                    <img
                                                                        src="/assets/images/location_icon.png"
                                                                        alt="pin"
                                                                    />
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="flex-1 text-left"
                                                                    onMouseDown={(
                                                                        e,
                                                                    ) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const fullAddress =
                                                                            [
                                                                                a.street,
                                                                                a.area,
                                                                                a.city,
                                                                            ]
                                                                                .filter(
                                                                                    Boolean,
                                                                                )
                                                                                .join(
                                                                                    ", ",
                                                                                ) ||
                                                                            a.street ||
                                                                            "";
                                                                        const lat =
                                                                            parseFloat(
                                                                                a.latitude ??
                                                                                    0,
                                                                            );
                                                                        const lon =
                                                                            parseFloat(
                                                                                a.longitude ??
                                                                                    0,
                                                                            );
                                                                        const comp =
                                                                            {
                                                                                city:
                                                                                    a.city ||
                                                                                    a.area ||
                                                                                    "",
                                                                                state:
                                                                                    a.state ||
                                                                                    a.governorate ||
                                                                                    "",
                                                                                country:
                                                                                    a.country ||
                                                                                    "Syria",
                                                                            };
                                                                        setDeliveryLocation(
                                                                            {
                                                                                address:
                                                                                    fullAddress,
                                                                                coordinates:
                                                                                    {
                                                                                        lat,
                                                                                        lon,
                                                                                    },
                                                                                components:
                                                                                    comp,
                                                                                landmark:
                                                                                    a.landmark ||
                                                                                    "",
                                                                                building:
                                                                                    a.building_name ||
                                                                                    "",
                                                                                name:
                                                                                    a.name ||
                                                                                    "",
                                                                                email:
                                                                                    a.email ||
                                                                                    "",
                                                                                mobile:
                                                                                    a.mobile ||
                                                                                    "",
                                                                                source: "address_book",
                                                                            },
                                                                        );
                                                                        setDeliverySearchQuery(
                                                                            "",
                                                                        );
                                                                        requestMapFocus(
                                                                            "delivery",
                                                                        );
                                                                        setDeliveryFocused(
                                                                            false,
                                                                        );
                                                                        setShowDeliverySaved(
                                                                            false,
                                                                        );
                                                                    }}
                                                                >
                                                                    <span className="block text-sm font-semibold text-[#111827] leading-tight">
                                                                        {a.location_name ||
                                                                            t(
                                                                                "commonSaved",
                                                                            )}
                                                                    </span>
                                                                    <span className="mt-1 block text-xs text-[#6b7280] leading-tight">
                                                                        {[
                                                                            a.street,
                                                                            a.area,
                                                                            a.city,
                                                                        ]
                                                                            .filter(
                                                                                Boolean,
                                                                            )
                                                                            .join(
                                                                                ", ",
                                                                            )}
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    {filteredDeliveryAddresses.length ===
                                                        0 && (
                                                        <div className="px-4 py-3 text-sm text-gray-500">
                                                            {t(
                                                                "locationSearchNoResults",
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {filteredDeliveryAddresses.length >
                                                    deliveryVisibleCount && (
                                                    <div className="px-3 py-2">
                                                        <button
                                                            type="button"
                                                            className="text-sm float-right cursor-pointer font-semibold text-blue-500 hover:text-blue-600"
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                            }}
                                                            onClick={() => {
                                                                setDeliveryVisibleCount(
                                                                    (current) =>
                                                                        Math.min(
                                                                            current +
                                                                                ADDRESS_PAGE_SIZE,
                                                                            filteredDeliveryAddresses.length,
                                                                        ),
                                                                );
                                                            }}
                                                        >
                                                            {t(
                                                                "customerDashboardSeeMore",
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    <div className="text-sm font-semibold text-blue-500 flex items-center gap-2">
                                        <img
                                            src="/assets/images/map-pin.svg"
                                            alt={t("customerDashboardPinAlt")}
                                            className="w-4 h-4"
                                        />
                                        {t("commonDeliveryLocation")}
                                    </div>
                                    <LocationSearchInput
                                        inputRef={deliveryInputRef}
                                        value={deliveryLocation.address}
                                        onChange={(text) => {
                                            setDeliveryLocation({
                                                ...deliveryLocation,
                                                address: text,
                                                landmark: "",
                                                building: "",
                                                source: "pin",
                                            });
                                            setShowDeliverySaved(false);
                                        }}
                                        onSelect={({
                                            address,
                                            lat,
                                            lon,
                                            components,
                                        }) => {
                                            setDeliveryLocation({
                                                address,
                                                coordinates: { lat, lon },
                                                components: components || {},
                                                landmark: "",
                                                building: "",
                                                source: "pin",
                                            });
                                            setDeliverySearchQuery("");
                                            requestMapFocus("delivery");
                                        }}
                                        savedAddresses={[]}
                                        onInputFocus={() =>
                                            activateLocationCard("delivery", {
                                                focusMap: false,
                                            })
                                        }
                                        onInputBlur={() => {
                                            if (
                                                deliveryDropdownMouseDown.current
                                            ) {
                                                deliveryDropdownMouseDown.current = false;
                                                return;
                                            }
                                            setTimeout(() => {
                                                setDeliveryFocused(false);
                                                setShowDeliverySaved(false);
                                                setDeliverySearchQuery("");
                                            }, 100);
                                        }}
                                        placeholder={t(
                                            "customerDashboardDeliveryPlaceholder",
                                        )}
                                    />
                                    <div className="mt-3 border-b border-gray-200" />
                                </div>

                                {/* Submit button (vertically centered) */}
                                <div className={`absolute -bottom-8 flex items-center -translate-y-1/2 md:top-1/2 ${isRTL ? "left-8 md:left-0" : "right-8 md:right-0"}`}>
                                    <button
                                        type="button"
                                        onClick={handleProceedToBooking}
                                        disabled={isNextDisabled}
                                        aria-label={t(
                                            "customerDashboardProceedAria",
                                        )}
                                        className={
                                            isNextDisabled
                                                ? "cursor-not-allowed"
                                                : "cursor-pointer"
                                        }
                                    >
                                        {isCalculatingShipmentType ? (
                                            <span
                                                className={`w-12 h-12 inline-flex rounded-full text-white items-center justify-center bg-[#338DFF] shadow-[0_10px_24px_rgba(51,141,255,0.35)] hover:bg-[#2f7ee6]`}
                                            >
                                            <svg
                                                className="animate-spin w-5 h-5 text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                ></path>
                                            </svg>
                                            </span>
                                        ) : (
                                            <span
                                                className={`w-12 h-12 inline-flex rounded-full text-white items-center justify-center ${isNextDisabled ? "bg-[#9fb8d8] shadow-[0_6px_14px_rgba(110,136,168,0.25)]" : "bg-[#338DFF] shadow-[0_10px_24px_rgba(51,141,255,0.35)] hover:bg-[#2f7ee6]"}`}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M7 17L17 7M10 7h7v7"
                                                    />
                                                </svg>
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="md:hidden block absolute bottom-30 left-0 right-0 z-40 px-3">
                            <div className="relative bg-white rounded-[18px] shadow-lg border border-gray-200 flex items-center px-3 py-4">

                                {/* Submit button */}
                                <button
                                    onClick={handleProceedToBooking}
                                        disabled={isNextDisabled}
                                        aria-label={t(
                                            "customerDashboardProceedAria",
                                        )}
                                        className={
                                            `absolute top-0 -translate-y-1/2 w-12 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-md ${isRTL ? "left-1" : "right-1"} ${isNextDisabled
                                                ? "cursor-not-allowed"
                                                : "cursor-pointer"}`
                                        }
                                >
                                    {isCalculatingShipmentType ? (
                                            <span
                                                className={`w-12 h-12 inline-flex rounded-full text-white items-center justify-center bg-[#338DFF] shadow-[0_10px_24px_rgba(51,141,255,0.35)] hover:bg-[#2f7ee6]`}
                                            >
                                            <svg
                                                className="animate-spin w-5 h-5 text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                ></path>
                                            </svg>
                                            </span>
                                        ) : (
                                            <span
                                                className={`w-12 h-12 inline-flex rounded-full text-white items-center justify-center ${isNextDisabled ? "bg-[#9fb8d8] shadow-[0_6px_14px_rgba(110,136,168,0.25)]" : "bg-[#338DFF] shadow-[0_10px_24px_rgba(51,141,255,0.35)] hover:bg-[#2f7ee6]"}`}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M7 17L17 7M10 7h7v7"
                                                    />
                                                </svg>
                                            </span>
                                        )}
                                </button>
                                
                                <div className="w-full">
                                    {/* Handover Input */}
                                    {handoverFocused &&
                                        showHandoverSaved &&
                                        Array.isArray(addresses) &&
                                        addresses.length > 0 && (
                                            <div
                                                data-saved-address-dropdown="handover"
                                                className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[14px] shadow-[0_12px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50"
                                                onMouseDown={() => {
                                                    handoverDropdownMouseDown.current = true;
                                                }}
                                            >
                                                {/* Search inside address book */}
                                                <div className="px-3 pt-3 pb-2">
                                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                                                        <svg
                                                            className="w-3.5 h-3.5 text-gray-400 shrink-0"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle
                                                                cx="11"
                                                                cy="11"
                                                                r="8"
                                                            />
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M21 21l-4.35-4.35"
                                                            />
                                                        </svg>
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder-gray-400"
                                                            placeholder={t(
                                                                "customerDashboardSearchSavedPlaceholder",
                                                            )}
                                                            value={
                                                                handoverSearchQuery
                                                            }
                                                            onChange={(e) => {
                                                                setHandoverSearchQuery(
                                                                    e.target
                                                                        .value,
                                                                );
                                                                setHandoverVisibleCount(
                                                                    ADDRESS_PAGE_SIZE,
                                                                );
                                                            }}
                                                        />
                                                        {handoverSearchQuery && (
                                                            <button
                                                                type="button"
                                                                className="text-gray-400 hover:text-gray-600"
                                                                onMouseDown={(
                                                                    e,
                                                                ) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setHandoverSearchQuery(
                                                                        "",
                                                                    );
                                                                    setHandoverVisibleCount(
                                                                        ADDRESS_PAGE_SIZE,
                                                                    );
                                                                }}
                                                            >
                                                                <svg
                                                                    className="w-3 h-3"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        d="M6 18L18 6M6 6l12 12"
                                                                    />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto">
                                                    {filteredHandoverAddresses
                                                        .slice(
                                                            0,
                                                            handoverVisibleCount,
                                                        )
                                                        .map((a, idx) => (
                                                            <div
                                                                key={
                                                                    a.id ?? idx
                                                                }
                                                                className={`flex items-start gap-3 px-2 py-3 ${idx !== Math.min(filteredHandoverAddresses.length, handoverVisibleCount) - 1 ? "border-b border-gray-200" : ""}`}
                                                            >
                                                                <span className="mt-1 inline-flex items-center justify-center rounded-full ">
                                                                    <img
                                                                        src="/assets/images/location_icon.png"
                                                                        alt="pin"
                                                                    />
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="flex-1 text-left"
                                                                    onMouseDown={(
                                                                        e,
                                                                    ) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const fullAddress =
                                                                            [
                                                                                a.street,
                                                                                a.area,
                                                                                a.city,
                                                                            ]
                                                                                .filter(
                                                                                    Boolean,
                                                                                )
                                                                                .join(
                                                                                    ", ",
                                                                                ) ||
                                                                            a.street ||
                                                                            "";
                                                                        const lat =
                                                                            parseFloat(
                                                                                a.latitude ??
                                                                                    0,
                                                                            );
                                                                        const lon =
                                                                            parseFloat(
                                                                                a.longitude ??
                                                                                    0,
                                                                            );
                                                                        const comp =
                                                                            {
                                                                                city:
                                                                                    a.city ||
                                                                                    a.area ||
                                                                                    "",
                                                                                state:
                                                                                    a.state ||
                                                                                    a.governorate ||
                                                                                    "",
                                                                                country:
                                                                                    a.country ||
                                                                                    "Syria",
                                                                            };
                                                                        setHandoverLocation(
                                                                            {
                                                                                address:
                                                                                    fullAddress,
                                                                                coordinates:
                                                                                    {
                                                                                        lat,
                                                                                        lon,
                                                                                    },
                                                                                components:
                                                                                    comp,
                                                                                landmark:
                                                                                    a.landmark ||
                                                                                    "",
                                                                                building:
                                                                                    a.building_name ||
                                                                                    "",
                                                                                name:
                                                                                    a.name ||
                                                                                    "",
                                                                                email:
                                                                                    a.email ||
                                                                                    "",
                                                                                mobile:
                                                                                    a.mobile ||
                                                                                    "",
                                                                                source: "address_book",
                                                                            },
                                                                        );
                                                                        setHandoverSearchQuery(
                                                                            "",
                                                                        );
                                                                        requestMapFocus(
                                                                            "handover",
                                                                        );
                                                                        setHandoverFocused(
                                                                            false,
                                                                        );
                                                                        setShowHandoverSaved(
                                                                            false,
                                                                        );
                                                                    }}
                                                                >
                                                                    <span className="block text-sm font-semibold text-[#111827] leading-tight">
                                                                        {a.location_name ||
                                                                            t(
                                                                                "commonSaved",
                                                                            )}
                                                                    </span>
                                                                    <span className="mt-1 block text-xs text-[#6b7280] leading-tight">
                                                                        {[
                                                                            a.street,
                                                                            a.area,
                                                                            a.city,
                                                                        ]
                                                                            .filter(
                                                                                Boolean,
                                                                            )
                                                                            .join(
                                                                                ", ",
                                                                            )}
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    {filteredHandoverAddresses.length ===
                                                        0 && (
                                                        <div className="px-4 py-3 text-sm text-gray-500">
                                                            {t(
                                                                "locationSearchNoResults",
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {filteredHandoverAddresses.length >
                                                    handoverVisibleCount && (
                                                    <div className="px-3 py-2">
                                                        <button
                                                            type="button"
                                                            className="text-sm float-right cursor-pointer font-semibold text-blue-500 hover:text-blue-600"
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                            }}
                                                            onClick={() => {
                                                                setHandoverVisibleCount(
                                                                    (current) =>
                                                                        Math.min(
                                                                            current +
                                                                                ADDRESS_PAGE_SIZE,
                                                                            filteredHandoverAddresses.length,
                                                                        ),
                                                                );
                                                            }}
                                                        >
                                                            {t(
                                                                "customerDashboardSeeMore",
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    <div 
                                        className="flex-1 min-w-0 pr-3"
                                        onMouseDown={(event) =>
                                            handleLocationCardMouseDown(
                                                "handover",
                                                event,
                                            )
                                        }
                                    >
                                        <LocationSearchInput
                                            inputRef={handoverInputRef}
                                            value={handoverLocation.address}
                                            onChange={(text) => {
                                                setHandoverLocation({
                                                    ...handoverLocation,
                                                    address: text,
                                                    landmark: "",
                                                    building: "",
                                                    source: "pin",
                                                });
                                                setShowHandoverSaved(false);
                                            }}
                                            onSelect={({ address, lat, lon, components }) => {
                                                setHandoverLocation({
                                                    address,
                                                    coordinates: { lat, lon },
                                                    components: components || {},
                                                    landmark: "",
                                                    building: "",
                                                    source: "pin",
                                                });
                                                setHandoverSearchQuery("");
                                                requestMapFocus("handover");
                                            }}
                                            savedAddresses={[]}
                                            onInputFocus={() =>
                                                activateLocationCard("handover", {
                                                    focusMap: false,
                                                })
                                            }
                                            onInputBlur={() => {
                                                if (
                                                    handoverDropdownMouseDown.current
                                                ) {
                                                    handoverDropdownMouseDown.current = false;
                                                    return;
                                                }
                                                setTimeout(() => {
                                                    setHandoverFocused(false);
                                                    setShowHandoverSaved(false);
                                                    setHandoverSearchQuery("");
                                                }, 100);
                                            }}
                                            placeholder={t(
                                                "customerDashboardHandoverPlaceholder",
                                            )}
                                        />
                                    </div>

                                    {/* Divider */}
                                    <div className="w-full h-[0.5px] bg-gray-300"></div>

                                    {/* Delivery Input */}
                                    {deliveryFocused &&
                                        showDeliverySaved &&
                                        Array.isArray(addresses) &&
                                        addresses.length > 0 && (
                                            <div
                                                data-saved-address-dropdown="delivery"
                                                className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[14px] shadow-[0_12px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50"
                                                onMouseDown={() => {
                                                    deliveryDropdownMouseDown.current = true;
                                                }}
                                            >
                                                {/* Search inside address book */}
                                                <div className="px-3 pt-3 pb-2">
                                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                                                        <svg
                                                            className="w-3.5 h-3.5 text-gray-400 shrink-0"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle
                                                                cx="11"
                                                                cy="11"
                                                                r="8"
                                                            />
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M21 21l-4.35-4.35"
                                                            />
                                                        </svg>
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder-gray-400"
                                                            placeholder={t(
                                                                "customerDashboardSearchSavedPlaceholder",
                                                            )}
                                                            value={
                                                                deliverySearchQuery
                                                            }
                                                            onChange={(e) => {
                                                                setDeliverySearchQuery(
                                                                    e.target
                                                                        .value,
                                                                );
                                                                setDeliveryVisibleCount(
                                                                    ADDRESS_PAGE_SIZE,
                                                                );
                                                            }}
                                                        />
                                                        {deliverySearchQuery && (
                                                            <button
                                                                type="button"
                                                                className="text-gray-400 hover:text-gray-600"
                                                                onMouseDown={(
                                                                    e,
                                                                ) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setDeliverySearchQuery(
                                                                        "",
                                                                    );
                                                                    setDeliveryVisibleCount(
                                                                        ADDRESS_PAGE_SIZE,
                                                                    );
                                                                }}
                                                            >
                                                                <svg
                                                                    className="w-3 h-3"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        d="M6 18L18 6M6 6l12 12"
                                                                    />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto">
                                                    {filteredDeliveryAddresses
                                                        .slice(
                                                            0,
                                                            deliveryVisibleCount,
                                                        )
                                                        .map((a, idx) => (
                                                            <div
                                                                key={
                                                                    a.id ?? idx
                                                                }
                                                                className={`flex items-start gap-3 px-2 py-3 ${idx !== Math.min(filteredDeliveryAddresses.length, deliveryVisibleCount) - 1 ? "border-b border-gray-200" : ""}`}
                                                            >
                                                                <span className="mt-1 inline-flex items-center justify-center rounded-full ">
                                                                    <img
                                                                        src="/assets/images/location_icon.png"
                                                                        alt="pin"
                                                                    />
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="flex-1 text-left"
                                                                    onMouseDown={(
                                                                        e,
                                                                    ) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const fullAddress =
                                                                            [
                                                                                a.street,
                                                                                a.area,
                                                                                a.city,
                                                                            ]
                                                                                .filter(
                                                                                    Boolean,
                                                                                )
                                                                                .join(
                                                                                    ", ",
                                                                                ) ||
                                                                            a.street ||
                                                                            "";
                                                                        const lat =
                                                                            parseFloat(
                                                                                a.latitude ??
                                                                                    0,
                                                                            );
                                                                        const lon =
                                                                            parseFloat(
                                                                                a.longitude ??
                                                                                    0,
                                                                            );
                                                                        const comp =
                                                                            {
                                                                                city:
                                                                                    a.city ||
                                                                                    a.area ||
                                                                                    "",
                                                                                state:
                                                                                    a.state ||
                                                                                    a.governorate ||
                                                                                    "",
                                                                                country:
                                                                                    a.country ||
                                                                                    "Syria",
                                                                            };
                                                                        setDeliveryLocation(
                                                                            {
                                                                                address:
                                                                                    fullAddress,
                                                                                coordinates:
                                                                                    {
                                                                                        lat,
                                                                                        lon,
                                                                                    },
                                                                                components:
                                                                                    comp,
                                                                                landmark:
                                                                                    a.landmark ||
                                                                                    "",
                                                                                building:
                                                                                    a.building_name ||
                                                                                    "",
                                                                                name:
                                                                                    a.name ||
                                                                                    "",
                                                                                email:
                                                                                    a.email ||
                                                                                    "",
                                                                                mobile:
                                                                                    a.mobile ||
                                                                                    "",
                                                                                source: "address_book",
                                                                            },
                                                                        );
                                                                        setDeliverySearchQuery(
                                                                            "",
                                                                        );
                                                                        requestMapFocus(
                                                                            "delivery",
                                                                        );
                                                                        setDeliveryFocused(
                                                                            false,
                                                                        );
                                                                        setShowDeliverySaved(
                                                                            false,
                                                                        );
                                                                    }}
                                                                >
                                                                    <span className="block text-sm font-semibold text-[#111827] leading-tight">
                                                                        {a.location_name ||
                                                                            t(
                                                                                "commonSaved",
                                                                            )}
                                                                    </span>
                                                                    <span className="mt-1 block text-xs text-[#6b7280] leading-tight">
                                                                        {[
                                                                            a.street,
                                                                            a.area,
                                                                            a.city,
                                                                        ]
                                                                            .filter(
                                                                                Boolean,
                                                                            )
                                                                            .join(
                                                                                ", ",
                                                                            )}
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    {filteredDeliveryAddresses.length ===
                                                        0 && (
                                                        <div className="px-4 py-3 text-sm text-gray-500">
                                                            {t(
                                                                "locationSearchNoResults",
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {filteredDeliveryAddresses.length >
                                                    deliveryVisibleCount && (
                                                    <div className="px-3 py-2">
                                                        <button
                                                            type="button"
                                                            className="text-sm float-right cursor-pointer font-semibold text-blue-500 hover:text-blue-600"
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                            }}
                                                            onClick={() => {
                                                                setDeliveryVisibleCount(
                                                                    (current) =>
                                                                        Math.min(
                                                                            current +
                                                                                ADDRESS_PAGE_SIZE,
                                                                            filteredDeliveryAddresses.length,
                                                                        ),
                                                                );
                                                            }}
                                                        >
                                                            {t(
                                                                "customerDashboardSeeMore",
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    <div 
                                        className="flex-1 min-w-0"
                                        onMouseDown={(event) =>
                                            handleLocationCardMouseDown(
                                                "delivery",
                                                event,
                                            )
                                        }
                                    >
                                        <LocationSearchInput
                                            inputRef={deliveryInputRef}
                                            value={deliveryLocation.address}
                                            onChange={(text) => {
                                                setDeliveryLocation({
                                                    ...deliveryLocation,
                                                    address: text,
                                                    landmark: "",
                                                    building: "",
                                                    source: "pin",
                                                });
                                                setShowDeliverySaved(false);
                                            }}
                                            onSelect={({ address, lat, lon, components }) => {
                                                setDeliveryLocation({
                                                    address,
                                                    coordinates: { lat, lon },
                                                    components: components || {},
                                                    landmark: "",
                                                    building: "",
                                                    source: "pin",
                                                });
                                                setDeliverySearchQuery("");
                                                requestMapFocus("delivery");
                                            }}
                                            savedAddresses={[]}
                                            onInputFocus={() =>
                                                activateLocationCard("delivery", {
                                                    focusMap: false,
                                                })
                                            }
                                            onInputBlur={() => {
                                                if (
                                                    deliveryDropdownMouseDown.current
                                                ) {
                                                    deliveryDropdownMouseDown.current = false;
                                                    return;
                                                }
                                                setTimeout(() => {
                                                    setDeliveryFocused(false);
                                                    setShowDeliverySaved(false);
                                                    setDeliverySearchQuery("");
                                                }, 100);
                                            }}
                                            placeholder={t(
                                                "customerDashboardDeliveryPlaceholder",
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Swap Button (RIGHT SIDE CENTER FLOATING) */}
                                <button
                                    onClick={handleSwapLocations}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-md"
                                >
                                    <img
                                        src="/assets/images/arrow-double.png"
                                        className="w-4 h-4 rotate-90"
                                    />
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            </main>
            {showCityCheckModal && (
                <Popup
                    title={t("dashboardDeliveryNotAvailable")}
                    message={t("dashboardDeliveryNotAvailableMessage")}
                    showIcon={false}
                    buttonLabel={t("commonOk")}
                    onConfirm={() => setShowCityCheckModal(false)}
                />
            )}
            {locationValidationError && (
                <Popup
                    title={t("dashboardLocationRequiredTitle")}
                    message={locationValidationError}
                    showIcon={false}
                    buttonLabel={t("commonOk")}
                    onConfirm={() => setLocationValidationError("")}
                />
            )}
        </div>
    );
}
