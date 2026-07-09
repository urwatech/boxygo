import { useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';
import OnlinePaymentGatewayForm from '../../Components/Customer/OnlinePaymentGatewayForm';
import Popup from '../SuperAdmin/Components/Popup';
import Menu from '../../Components/Common/Menu';
import { useTranslation } from 'react-i18next';
import useLocaleFormatter from '../../hooks/useLocaleFormatter';
import {
    confirmMtnPayment,
    confirmSyriatelPayment,
    initiateMtnPayment,
    initiatePaymeraPayment,
    initiateSyriatelPayment,
    resendSyriatelOtp,
} from '../../utils/customerPaymentApi';
import TermsAndConditions from './TermsAndConditions';

const PHONE_PREFIX = '+';
const PHONE_PREFIX_DIGITS = '';
const extractSubscriberDigits = (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    const withoutPrefix = digits.startsWith(PHONE_PREFIX_DIGITS)
        ? digits.slice(PHONE_PREFIX_DIGITS.length)
        : digits;
    return withoutPrefix.slice(0, 12);
};

const formatPhoneForDisplay = (value) => {
    const subscriber = extractSubscriberDigits(value);
    if (!subscriber) return '';

    // Format as: XXX XXX XXX (without prefix since it's shown separately)
    const parts = [];
    for (let i = 0; i < subscriber.length; i += 3) {
        parts.push(subscriber.slice(i, i + 3));
    }
    return parts.join(' ');
};

const formatPhoneForState = (value) => {
    const digits = extractSubscriberDigits(value);
    if (!digits) return '';
    return `${PHONE_PREFIX}${digits}`;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value) => {
    if (value == null) {
        return true;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
        return true;
    }

    return emailPattern.test(trimmed);
};
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const enforceEnglishEmailInput = (value) => String(value ?? '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9@._+\-]/g, '');
const removeEmojis = (value) => String(value ?? '')
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '');
const sameEmailError = 'Sender and receiver email cannot be the same.';
const parseNumericValue = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const normalized = String(value).replace(/[^0-9.-]+/g, '').trim();
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRegionValue = (...values) => {
    for (const value of values) {
        if (value == null) continue;
        const normalized = String(value).toLowerCase().trim();
        if (normalized) {
            return normalized;
        }
    }
    return '';
};

const parseBooleanLike = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true';
    }
    return false;
};

const getCsrfHeaders = () => {
    if (typeof document === 'undefined') {
        return {};
    }

    const xsrfMatch = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    const xsrf = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : null;

    if (xsrf) {
        return { 'X-XSRF-TOKEN': xsrf };
    }

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const csrf = csrfMeta?.getAttribute('content');

    return csrf ? { 'X-CSRF-TOKEN': csrf } : {};
};

const resolveMediaUrl = (value, fallback = '') => {
    if (!value) return fallback;
    const raw = String(value).trim();
    if (!raw) return fallback;

    if (raw.startsWith('/assets/parcel-icons/')) {
        return raw.replace('/assets/parcel-icons/', '/storage/parcel-icons/');
    }

    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw;
    }

    const normalized = raw.replace(/^public\//i, '').replace(/^storage\//i, '');
    return `/storage/${normalized}`;
};

export default function CreateBooking({
    handover_address = '',
    handover_latitude = null,
    handover_longitude = null,
    handover_city = '',
    handover_state = '',
    handover_city_id = null,
    handover_landmark = '',
    handover_building = '',
    handover_source = '',
    handover_is_drop_point = false,
    handover_drop_point_id = null,
    handover_drop_point_name = '',
    handover_name = '',
    handover_email = '',
    handover_mobile = '',
    sender_name = '',
    sender_email = '',
    sender_phone = '',
    isHandoverLocationDP = false,
    delivery_address = '',
    delivery_latitude = null,
    delivery_longitude = null,
    delivery_city = '',
    delivery_state = '',
    delivery_city_id = null,
    delivery_landmark = '',
    delivery_building = '',
    delivery_source = '',
    delivery_is_drop_point = false,
    delivery_drop_point_id = null,
    delivery_drop_point_name = '',
    delivery_name = '',
    delivery_email = '',
    delivery_mobile = '',
    receiver_name = '',
    receiver_email = '',
    receiver_phone = '',
    isDeliveryLocationDP = false,
    tracking_status = '',
    tracking_index = 0,
    sizes = [],
    latestBooking = null,
    savedLandmarks = [],
    savedBuildings = [],
    savedNames = [],
    savedEmails = [],
    savedMobiles = [],
    financialSettings = {},
}) {

    const page = usePage();
    const senderProfile = page?.props?.auth?.user ?? null;
    const { t, i18n } = useTranslation();
    const { locale, formatNumber } = useLocaleFormatter();
    const TOTAL_FEE = 110;
    const hasHandoverDropPoint = parseBooleanLike(isHandoverLocationDP) || parseBooleanLike(handover_is_drop_point);
    const hasDeliveryDropPoint = parseBooleanLike(isDeliveryLocationDP) || parseBooleanLike(delivery_is_drop_point);
    const forcedIndirectDeliveryMode = hasHandoverDropPoint && hasDeliveryDropPoint
        ? 'drop_point_to_drop_point'
        : hasHandoverDropPoint
            ? 'drop_point_to_door'
            : hasDeliveryDropPoint
                ? 'door_to_drop_point'
                : null;
    const isDropPointBooking = Boolean(forcedIndirectDeliveryMode);
    const insuranceMinAmount = parseNumericValue(financialSettings.insurance_min_amount);
    const insuranceMaxAmount = parseNumericValue(financialSettings.insurance_max_amount);
    const insuranceCompensationSource =
        financialSettings.insurance_compensation_value ?? financialSettings.insurance_value;
    const parsedInsuranceCompensation = parseNumericValue(insuranceCompensationSource);
    const insuranceCompensationValue = parsedInsuranceCompensation !== null
        ? formatNumber(parsedInsuranceCompensation)
        : (String(insuranceCompensationSource ?? '').trim() || '-');        

    // Get text direction based on language
    const textDirection = i18n.language === 'ar' ? 'rtl' : 'ltr';
    const [step, setStep] = useState('courier'); // 'courier' | 'shipment' | 'review'
    const [completed, setCompleted] = useState({ courier: false, shipment: false });
    const [activated, setActivated] = useState({ courier: true, shipment: false, review: false });
    const [showPopup, setShowPopup] = useState(false);
    const [newShipmentId, setNewShipmentId] = useState(null);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [submitting, setSubmitting] = useState(false);
    const [onlineProvider, setOnlineProvider] = useState('mtn');
    const [onlinePhone, setOnlinePhone] = useState('');
    const [onlineStep, setOnlineStep] = useState('phone');
    const [otpCode, setOtpCode] = useState('');
    const [paymentData, setPaymentData] = useState(null);
    const [paymentError, setPaymentError] = useState('');
    const photoInputRef = useRef(null);
    const [errors, setErrors] = useState({});
    const [trackingStatus, setTrackingStatus] = useState(String(tracking_status || 'assigned'));
    const [trackingIndex, setTrackingIndex] = useState(Number(tracking_index || 0));
    const [showConsignmentMenu, setShowConsignmentMenu] = useState(false);
    const [showInsuranceMenu, setShowInsuranceMenu] = useState(false);
    const [showInsuranceWarningPopup, setShowInsuranceWarningPopup] = useState(false);
    const [showSizeMenu, setShowSizeMenu] = useState(false);
    const [showRouteMenuDesktop, setShowRouteMenuDesktop] = useState(false);
    const [showRouteMenuMobile, setShowRouteMenuMobile] = useState(false);
    const [showScheduleMenu, setShowScheduleMenu] = useState(false);
    const [availableDeliveryType, setAvailableDeliveryType] = useState(null); // 'direct' | 'indirect' | null (both available)
    const consignmentMenuRef = useRef(null);
    const handoverMenuRef = useRef(null);
    const insuranceMenuRef = useRef(null);
    const sizeMenuRef = useRef(null);
    const routeMenuDesktopRef = useRef(null);
    const routeMenuMobileRef = useRef(null);
    const [shipmentFeeToggle, setShipmentFeeToggle] = useState(true);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const handoverTimeSlots = useMemo(() => ([
        { label: t('createBookingScheduleSlotMorning'), value: t('createBookingScheduleSlotMorning') },
        { label: t('createBookingScheduleSlotNoon'), value: t('createBookingScheduleSlotNoon') },
        { label: t('createBookingScheduleSlotAfternoon'), value: t('createBookingScheduleSlotAfternoon') },
    ]), [t]);
    const [fromCityId, setFromCityId] = useState(null)
    const [toCityId, setToCityId] = useState(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            const ctn = consignmentMenuRef.current;
            const itn = insuranceMenuRef.current;
            const rtd = routeMenuDesktopRef.current;
            const rtm = routeMenuMobileRef.current;
            const htn = handoverMenuRef.current;
            if (showConsignmentMenu && ctn && !ctn.contains(event.target)) {
                setShowConsignmentMenu(false);
            }
            if (showScheduleMenu && htn && !htn.contains(event.target)) {
                setShowScheduleMenu(false);
            }
            if (showInsuranceMenu && itn && !itn.contains(event.target)) {
                setShowInsuranceMenu(false);
            }
            if (showRouteMenuDesktop && rtd && !rtd.contains(event.target)) {
                setShowRouteMenuDesktop(false);
            }
            if (showRouteMenuMobile && rtm && !rtm.contains(event.target)) {
                setShowRouteMenuMobile(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showConsignmentMenu, showScheduleMenu, showInsuranceMenu, showRouteMenuDesktop, showRouteMenuMobile]);



    // Location state
    const [locations, setLocations] = useState(() => {
        // Try to restore from sessionStorage first (when returning from dashboard)
        const savedLocations = sessionStorage.getItem('customerBookingLocations');
        if (savedLocations) {
            try {
                const parsed = JSON.parse(savedLocations);
                // Clear the sessionStorage after restoring
                sessionStorage.removeItem('customerBookingLocations');
                return {
                    handover: {
                        ...(parsed?.handover || {}),
                        source: parsed?.handover?.source || handover_source || '',
                    },
                    delivery: {
                        ...(parsed?.delivery || {}),
                        source: parsed?.delivery?.source || delivery_source || '',
                    },
                };
            } catch (e) {
                console.error('Failed to restore locations:', e);
            }
        }

        // Default to props from server
        return {
            handover: {
                address: handover_address,
                coordinates: { lat: handover_latitude, lon: handover_longitude },
                landmark: handover_landmark,
                building: handover_building,
                source: handover_source || '',
            },
            delivery: {
                address: delivery_address,
                coordinates: { lat: delivery_latitude, lon: delivery_longitude },
                landmark: delivery_landmark,
                building: delivery_building,
                source: delivery_source || '',
            }
        };
    });

    useEffect(() => {
        setLocations((prev) => {
            let changed = false;
            const next = { ...prev };

            if (!prev.handover.landmark && handover_landmark) {
                next.handover = { ...next.handover, landmark: handover_landmark };
                changed = true;
            }
            if (!prev.handover.building && handover_building) {
                next.handover = { ...next.handover, building: handover_building };
                changed = true;
            }
            if (!prev.handover.source && handover_source) {
                next.handover = { ...next.handover, source: handover_source };
                changed = true;
            }
            if (!prev.delivery.landmark && delivery_landmark) {
                next.delivery = { ...next.delivery, landmark: delivery_landmark };
                changed = true;
            }
            if (!prev.delivery.building && delivery_building) {
                next.delivery = { ...next.delivery, building: delivery_building };
                changed = true;
            }
            if (!prev.delivery.source && delivery_source) {
                next.delivery = { ...next.delivery, source: delivery_source };
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [handover_landmark, handover_building, delivery_landmark, delivery_building]);

    // Cities and pricing state
    const [cities, setCities] = useState([]);
    const [shippingFee, setShippingFee] = useState(null);
    const [shippingOptions, setShippingOptions] = useState(null);
    const [shippingPriceResponse, setShippingPriceResponse] = useState(null);
    const [shippingDebugInfo, setShippingDebugInfo] = useState(null);
    const [shippingFeeLoading, setShippingFeeLoading] = useState(false);
    const [priceBreakdown, setPriceBreakdown] = useState(null);
    const [manualIndirectOverride, setManualIndirectOverride] = useState(false);
    // const [isSenderPaying, setIsSenderPaying] = useState(true)
    const [notification, setNotification] = useState(null);

    // Form state
    const [formData, setFormData] = useState(() => {
        const safeText = (value) => (typeof value === 'string' ? value.trim() : value != null ? String(value).trim() : '');

        // Try to restore from sessionStorage first (when returning from dashboard)
        const savedFormData = sessionStorage.getItem('customerBookingFormData');
        if (savedFormData) {
            try {
                const parsed = JSON.parse(savedFormData);
                // Clear the sessionStorage after restoring
                sessionStorage.removeItem('customerBookingFormData');
                return parsed;
            } catch (e) {
                console.error('Failed to restore form data:', e);
            }
        }

        // Prefill from latest booking if available, otherwise use sender profile
        // const senderName = latestBooking?.sender_name ? safeText(latestBooking.sender_name) : safeText(senderProfile?.name);
        // const senderPhone = latestBooking?.sender_phone ? latestBooking.sender_phone : formatPhoneForState(senderProfile?.phone_number);
        // const senderEmail = latestBooking?.sender_email ? safeText(latestBooking.sender_email) : safeText(senderProfile?.email);
        // const senderLandmark = 'asd';
        // const senderBuilding = 'asd';

        // Prefill receiver details from latest booking if available
        // const receiverName = latestBooking?.receiver_name ? safeText(latestBooking.receiver_name) : '';
        // const receiverPhone = latestBooking?.receiver_phone ? latestBooking.receiver_phone : '';
        // const receiverEmail = latestBooking?.receiver_email ? safeText(latestBooking.receiver_email) : '';
        // const receiverLandmark = 'asd';
        // const receiverBuilding = 'asd';

        const senderName = safeText(sender_name || handover_name);
        const senderPhone = formatPhoneForState(sender_phone || handover_mobile);
        const senderEmail = safeText(sender_email || handover_email);
        const senderLandmark = "";
        const senderBuilding = "";

        // Prefill receiver details from latest booking if available
        const receiverName = safeText(receiver_name || delivery_name);
        const receiverPhone = formatPhoneForState(receiver_phone || delivery_mobile);
        const receiverEmail = safeText(receiver_email || delivery_email);
        const receiverLandmark = "";
        const receiverBuilding = "";

        return {
            // Courier step
            size: '', // holds selected size id or 'custom'
            customLength: '',
            customWidth: '',
            customHeight: '',
            customWeight: '',
            consignmentType: '',
            consignmentTypeOther: '', // For "Other Materials (must be specified)"
            parcelAmount: '',
            insurance: '',
            scheduleTime: '',
            photos: [],
            specialInstruction: '',
            additionalDocs: [],

            // Shipment step
            senderName,
            senderPhone,
            senderEmail,
            senderLandmark,
            senderBuilding,
            receiverName,
            receiverPhone,
            receiverEmail,
            receiverLandmark,
            receiverBuilding,
            acceptReturns: false,
            returnWindow: '',
            deliveryFeePayer: 'sender',
            returnDeliveryFeePayer: 'sender',

            // Review step
            deliverySpeed: isDropPointBooking ? 'indirect' : 'direct',
            // Delivery mode (route type)
            deliveryMode: forcedIndirectDeliveryMode || 'door_to_door'
        };
    });
    const defaultIndirectDeliveryMode = forcedIndirectDeliveryMode || 'door_to_door';
    const detectedDeliveryType = useMemo(() => {
        if (isDropPointBooking) {
            return 'indirect';
        }

        const handoverLat = locations.handover.coordinates?.lat;
        const handoverLng = locations.handover.coordinates?.lon;
        const deliveryLat = locations.delivery.coordinates?.lat;
        const deliveryLng = locations.delivery.coordinates?.lon;

        if (handoverLat == null || handoverLng == null || deliveryLat == null || deliveryLng == null) {
            return null;
        }

        if (handover_city_id != null && delivery_city_id != null) {
            return handover_city_id === delivery_city_id ? 'direct' : 'indirect';
        }

        const normalizedHandoverRegion = normalizeRegionValue(handover_state, handover_city);
        const normalizedDeliveryRegion = normalizeRegionValue(delivery_state, delivery_city);

        if (normalizedHandoverRegion && normalizedDeliveryRegion) {
            return normalizedHandoverRegion === normalizedDeliveryRegion ? 'direct' : 'indirect';
        }

        return null;
    }, [
        isDropPointBooking,
        locations.handover.coordinates?.lat,
        locations.handover.coordinates?.lon,
        locations.delivery.coordinates?.lat,
        locations.delivery.coordinates?.lon,
        handover_city_id,
        delivery_city_id,
        handover_state,
        handover_city,
        delivery_state,
        delivery_city,
    ]);
    const apiDetectedDeliveryType = useMemo(() => {
        const normalized = typeof shippingPriceResponse?.type === 'string'
            ? shippingPriceResponse.type.toLowerCase()
            : '';

        if (normalized !== 'direct' && normalized !== 'indirect') {
            return null;
        }

        return manualIndirectOverride ? null : normalized;
    }, [shippingPriceResponse?.type, manualIndirectOverride]);
    const resolvedDetectedDeliveryType = detectedDeliveryType ?? apiDetectedDeliveryType;
    const isDetectedDirectDelivery = resolvedDetectedDeliveryType === 'direct';
    const isDetectedIndirectDelivery = resolvedDetectedDeliveryType === 'indirect';
    const isIndirectOverrideActive = isDetectedDirectDelivery && manualIndirectOverride;
    const canSelectIndirectSpeed = !isDropPointBooking && isDetectedDirectDelivery;
    const showDirectDeliveryCard = !isDropPointBooking && (isDetectedDirectDelivery || (!resolvedDetectedDeliveryType && availableDeliveryType !== 'indirect'));
    const showIndirectDeliveryCard = isDropPointBooking || isDetectedDirectDelivery || isDetectedIndirectDelivery || (!resolvedDetectedDeliveryType && availableDeliveryType !== 'direct');
    const isIndirectCardClickable = canSelectIndirectSpeed && !shippingFeeLoading;
    const goodsAmountNumber = parseNumericValue(formData.parcelAmount);
    const insuranceMinBound = insuranceMinAmount ?? 0;
    const insuranceMaxBound = insuranceMaxAmount ?? Number.POSITIVE_INFINITY;
    const isInsuranceYesAllowed =
        goodsAmountNumber !== null &&
        goodsAmountNumber > 0 &&
        goodsAmountNumber >= insuranceMinBound &&
        goodsAmountNumber <= insuranceMaxBound;
    const lastStandardSizeRef = useRef(
        formData.size && formData.size !== 'custom' ? formData.size : null
    );

    useEffect(() => {
        if (!formData.insurance) {
            setFormData((prev) => ({ ...prev, insurance: 'Yes' }));
        }
    }, [formData.insurance]);

    // State to track matched city IDs
    const [matchedCities, setMatchedCities] = useState({
        handover: null,
        delivery: null
    });

    const clearShippingPriceState = () => {
        setShippingPriceResponse(null);
        setShippingFee(null);
        setShippingOptions(null);
        setPriceBreakdown(null);
    };

    const applyShippingPriceData = (priceData) => {
        if (!priceData) {
            clearShippingPriceState();
            return;
        }

        setShippingPriceResponse(priceData);

        const normalizedTotal = parseNumericValue(priceData.total ?? priceData.price);
        setShippingFee(normalizedTotal);
        setPriceBreakdown(priceData.breakdown ?? null);

        const normalizedType = typeof priceData.type === 'string' ? priceData.type.toLowerCase() : '';
        const hasValidType = normalizedType === 'direct' || normalizedType === 'indirect';
        const optionMap = priceData.options && typeof priceData.options === 'object' ? priceData.options : null;
        const optionKeys = optionMap ? Object.keys(optionMap) : [];

        if (optionMap && optionKeys.length > 0) {
            setShippingOptions(optionMap);
            return;
        }

        if (hasValidType) {
            setShippingOptions({
                [normalizedType]: {
                    total: normalizedTotal,
                    sender_price: priceData.sender_price ?? null,
                    reciever_price: priceData.reciever_price ?? priceData.receiver_price ?? null,
                    service_fee: priceData.service_fee ?? null,
                },
            });
            return;
        }

        setShippingOptions(null);
    };
    const indirectDeliveryFees = useMemo(() => {
        const senderFee =
            parseNumericValue(shippingPriceResponse?.sender_price) ??
            parseNumericValue(shippingPriceResponse?.breakdown?.sender) ??
            parseNumericValue(shippingPriceResponse?.sender?.price) ??
            parseNumericValue(shippingOptions?.indirect?.sender_price);

        const receiverFee =
            parseNumericValue(shippingPriceResponse?.reciever_price ?? shippingPriceResponse?.receiver_price) ??
            parseNumericValue(shippingPriceResponse?.breakdown?.receiver) ??
            parseNumericValue(shippingPriceResponse?.receiver?.price) ??
            parseNumericValue(shippingOptions?.indirect?.reciever_price ?? shippingOptions?.indirect?.receiver_price);

        return {
            sender: senderFee ?? 0,
            receiver: receiverFee ?? 0,
        };
    }, [shippingPriceResponse, shippingOptions]);

    useEffect(() => {
        if (!isDropPointBooking) {
            return;
        }

        setAvailableDeliveryType('indirect');
        setManualIndirectOverride(false);
        setFormData((prev) => {
            const nextMode = defaultIndirectDeliveryMode;
            if (prev.deliverySpeed === 'indirect' && prev.deliveryMode === nextMode) {
                return prev;
            }
            return { ...prev, deliverySpeed: 'indirect', deliveryMode: nextMode };
        });
    }, [isDropPointBooking, defaultIndirectDeliveryMode]);

    // Fetch cities on mount
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const response = await fetch('/api/v1/cities');
                const result = await response.json();
                if (result.data) {
                    setCities(result.data);
                }
            } catch (error) {
                console.error('Failed to fetch cities:', error);
            }
        };
        fetchCities();
    }, []);

    // Match cities using coordinates - find nearest city based on Haversine distance
    useEffect(() => {
        const findNearestCityByCoordinates = (lat, lon, allCities) => {
            if (!lat || !lon || !allCities || allCities.length === 0) {
                return null;
            }

            const earthRadius = 6371; // Earth radius in kilometers

            // Calculate distance using Haversine formula
            const calculateDistance = (lat1, lon1, lat2, lon2) => {
                const toRadians = (degrees) => degrees * (Math.PI / 180);

                const dLat = toRadians(lat2 - lat1);
                const dLon = toRadians(lon2 - lon1);

                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);

                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                return earthRadius * c; // Distance in kilometers
            };

            // Find cities with valid coordinates and calculate distances
            const citiesWithCoords = allCities.filter(city => city.latitude != null && city.longitude != null);

            const citiesWithDistances = citiesWithCoords
                .map(city => ({
                    ...city,
                    distance: calculateDistance(lat, lon, city.latitude, city.longitude)
                }))
                .sort((a, b) => a.distance - b.distance);

            // Return the nearest city (within a reasonable range of 100km)
            if (citiesWithDistances.length > 0 && citiesWithDistances[0].distance <= 100) {
                return citiesWithDistances[0];
            }

            return null;
        };

        const matchCitiesByCoordinates = () => {
            if (cities.length === 0) {
                return;
            }

            // Priority 1: Use city_id if already provided from Dashboard
            if (handover_city_id && delivery_city_id) {
                const handoverCity = cities.find(c => c.id === handover_city_id);
                const deliveryCity = cities.find(c => c.id === delivery_city_id);

                if (handoverCity && deliveryCity) {
                    setMatchedCities({
                        handover: handoverCity,
                        delivery: deliveryCity
                    });
                    return;
                }
            }

            // Priority 2: Use coordinates to find nearest city in cities table
            const hasHandoverCoords = handover_latitude != null && handover_longitude != null;
            const hasDeliveryCoords = delivery_latitude != null && delivery_longitude != null;

            if (hasHandoverCoords && hasDeliveryCoords) {
                const handoverCity = findNearestCityByCoordinates(handover_latitude, handover_longitude, cities);

                const deliveryCity = findNearestCityByCoordinates(delivery_latitude, delivery_longitude, cities);

                if (handoverCity && deliveryCity) {
                    setMatchedCities({
                        handover: handoverCity,
                        delivery: deliveryCity
                    });
                    return;
                }
            }

            // Priority 3: Fallback to name-based matching (legacy behavior)
            let handoverMatch = null;
            let deliveryMatch = null;

            // Helper function to normalize city names for comparison
            // Handles variations like "Al-Bab" vs "Al Bab", "Al-Bukamal" vs "Al Bukamal"
            const normalizeCityName = (name) => {
                const normalized = (name || '')
                    .toLowerCase()
                    .trim()
                    // Replace hyphens with spaces
                    .replace(/-/g, ' ')
                    // Replace multiple spaces with single space
                    .replace(/\s+/g, ' ')
                    // Remove common prefixes/articles
                    .replace(/^(al|el|as|ad|ar)\s+/i, '');
                return normalized;
            };

            // Match handover city by name
            if (handover_city || handover_state) {
                const searchCityNorm = normalizeCityName(handover_city);
                const searchStateNorm = normalizeCityName(handover_state);

                handoverMatch = cities.find(city => {
                    const cityNameNorm = normalizeCityName(city.name);
                    const govNameNorm = normalizeCityName(city.governate);

                    // Try normalized comparison first (more accurate)
                    if (searchCityNorm && cityNameNorm === searchCityNorm) {
                        return true;
                    }

                    // Fallback to partial matches
                    const cityName = city.name.toLowerCase();
                    const govName = (city.governate || '').toLowerCase();
                    const searchCity = (handover_city || '').toLowerCase();
                    const searchState = (handover_state || '').toLowerCase();

                    return cityName.includes(searchCity) ||
                        searchCity.includes(cityName) ||
                        cityNameNorm.includes(searchCityNorm) ||
                        searchCityNorm.includes(cityNameNorm) ||
                        govName.includes(searchState) ||
                        searchState.includes(govName) ||
                        govNameNorm.includes(searchStateNorm) ||
                        searchStateNorm.includes(govNameNorm);
                });
            }

            // Match delivery city by name
            if (delivery_city || delivery_state) {
                const searchCityNorm = normalizeCityName(delivery_city);
                const searchStateNorm = normalizeCityName(delivery_state);

                deliveryMatch = cities.find(city => {
                    const cityNameNorm = normalizeCityName(city.name);
                    const govNameNorm = normalizeCityName(city.governate);

                    // Try normalized comparison first (more accurate)
                    if (searchCityNorm && cityNameNorm === searchCityNorm) {
                        return true;
                    }

                    // Fallback to partial matches
                    const cityName = city.name.toLowerCase();
                    const govName = (city.governate || '').toLowerCase();
                    const searchCity = (delivery_city || '').toLowerCase();
                    const searchState = (delivery_state || '').toLowerCase();

                    return cityName.includes(searchCity) ||
                        searchCity.includes(cityName) ||
                        cityNameNorm.includes(searchCityNorm) ||
                        searchCityNorm.includes(cityNameNorm) ||
                        govName.includes(searchState) ||
                        searchState.includes(govName) ||
                        govNameNorm.includes(searchStateNorm) ||
                        searchStateNorm.includes(govNameNorm);
                });
            }

            if (handoverMatch || deliveryMatch) {
                setMatchedCities({
                    handover: handoverMatch,
                    delivery: deliveryMatch
                });
            } else {
                setMatchedCities({
                    handover: null,
                    delivery: null
                });
            }
        };

        matchCitiesByCoordinates();
    }, [cities, handover_city, handover_state, delivery_city, delivery_state, handover_latitude, handover_longitude, delivery_latitude, delivery_longitude, handover_city_id, delivery_city_id]);

    // // Calculate shipping fee when both cities and size are matched
    // useEffect(() => {
    //     const calculatePrice = async () => {
    //         if (!matchedCities.handover || !matchedCities.delivery) {
    //             clearShippingPriceState();
    //             return;
    //         }

    //         setShippingFeeLoading(true);
    //         try {
    //             const requestBody = {
    //                 from_city_id: matchedCities.handover.id,
    //                 to_city_id: matchedCities.delivery.id,
    //                 size_id: (formData.size && formData.size !== 'custom') ? formData.size : null
    //             };

    //             const response = await fetch('/customer/shipments/calculate-price', {
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': 'application/json',
    //                     'Accept': 'application/json',
    //                     'X-Requested-With': 'XMLHttpRequest',
    //                     ...getCsrfHeaders(),
    //                 },
    //                 credentials: 'same-origin',
    //                 body: JSON.stringify(requestBody)
    //             });

    //             const contentType = response.headers.get('content-type') || '';
    //             if (!contentType.includes('application/json')) {
    //                 const text = await response.text();
    //                 throw new Error(`Price API returned non-JSON response (${response.status}): ${text.slice(0, 120)}`);
    //             }

    //             const result = await response.json();

    //             if (result.success && result.data) {
    //                 applyShippingPriceData(result.data);
    //             } else {
    //                 clearShippingPriceState();
    //             }
    //         } catch (error) {
    //             console.error('Failed to calculate price:', error);
    //             clearShippingPriceState();
    //         } finally {
    //             setShippingFeeLoading(false);
    //         }
    //     };

    //     calculatePrice();
    // }, [matchedCities, formData.size]);

    // Close route menus when switching to direct delivery speed
    useEffect(() => {
        if (formData.deliverySpeed !== 'indirect') {
            setShowRouteMenuDesktop(false);
            setShowRouteMenuMobile(false);
        }
    }, [formData.deliverySpeed]);

    // State for city mismatch error
    const [cityMismatchError, setCityMismatchError] = useState('');
    const isBookNowDisabled = !!cityMismatchError || !termsAccepted;

    // useEffect(() => {
    //     if(formData.deliveryFeePayer === 'sender' || (formData.acceptReturns ? formData.returnDeliveryFeePayer === "sender" : false)) {
    //         setIsSenderPaying(true);
    //     } else {
    //         setIsSenderPaying(false);
    //     }
    // }, [formData])

    // Validate location match (state/governorate) for Direct delivery mode
    useEffect(() => {
        if (step === 'review' && formData.deliverySpeed === 'direct') {
            // Primary: Compare city IDs if available (most accurate)
            if (handover_city_id != null && delivery_city_id != null) {
                if (handover_city_id !== delivery_city_id) {
                    setCityMismatchError(t('createBookingDirectCityRestriction'));
                } else {
                    setCityMismatchError('');
                }
            } else {
                // Fallback: Use region name comparison if city IDs not available
                const normalizedHandoverRegion = normalizeRegionValue(handover_state, handover_city);
                const normalizedDeliveryRegion = normalizeRegionValue(delivery_state, delivery_city);

                if (normalizedHandoverRegion && normalizedDeliveryRegion) {
                    if (normalizedHandoverRegion !== normalizedDeliveryRegion) {
                        setCityMismatchError(t('createBookingDirectCityRestriction'));
                    } else {
                        setCityMismatchError('');
                    }
                } else {
                    setCityMismatchError('');
                }
            }
        } else {
            // Clear error if not in Direct mode
            setCityMismatchError('');
        }
    }, [step, formData.deliverySpeed, handover_city, delivery_city, handover_state, delivery_state, handover_city_id, delivery_city_id, t]);

    useEffect(() => {
        if (resolvedDetectedDeliveryType !== 'direct') {
            setManualIndirectOverride(false);
        }
    }, [resolvedDetectedDeliveryType]);

    // Sync the selected delivery speed with system detection and manual indirect override.
    useEffect(() => {
        if (step !== 'review') {
            return;
        }

        if (isDropPointBooking || isDetectedIndirectDelivery) {
            setAvailableDeliveryType('indirect');
            setFormData((prev) => {
                const nextMode = defaultIndirectDeliveryMode;
                if (prev.deliverySpeed === 'indirect' && prev.deliveryMode === nextMode) {
                    return prev;
                }
                return { ...prev, deliverySpeed: 'indirect', deliveryMode: nextMode };
            });
            return;
        }

        if (isDetectedDirectDelivery) {
            setAvailableDeliveryType('direct');
            setFormData((prev) => {
                if (manualIndirectOverride) {
                    if (prev.deliverySpeed === 'indirect' && prev.deliveryMode === 'door_to_door') {
                        return prev;
                    }
                    return { ...prev, deliverySpeed: 'indirect', deliveryMode: 'door_to_door' };
                }

                if (prev.deliverySpeed === 'direct') {
                    return prev;
                }

                return { ...prev, deliverySpeed: 'direct' };
            });
            return;
        }

        setAvailableDeliveryType(null);
    }, [
        step,
        isDropPointBooking,
        isDetectedIndirectDelivery,
        isDetectedDirectDelivery,
        defaultIndirectDeliveryMode,
        manualIndirectOverride,
    ]);

    // Auto-fill landmark/building fields from current handover and delivery selections
    useEffect(() => {
        const handoverSource = locations.handover.source || '';
        const deliverySource = locations.delivery.source || '';
        const isHandoverAddressBook = handoverSource === 'address_book';
        const isDeliveryAddressBook = deliverySource === 'address_book';
        const isHandoverPin = handoverSource === 'pin';
        const isDeliveryPin = deliverySource === 'pin';

        setFormData(prev => {
            const next = { ...prev };

            if (isHandoverAddressBook) {
                next.senderLandmark = locations.handover.landmark || '';
                next.senderBuilding = locations.handover.building || '';
            } else if (isHandoverPin) {
                next.senderLandmark = '';
                next.senderBuilding = '';
            } else {
                if (locations.handover.landmark || locations.handover.address) {
                    next.senderLandmark = locations.handover.landmark || locations.handover.address || '';
                }
                if (locations.handover.building) {
                    next.senderBuilding = locations.handover.building;
                }
            }

            if (isDeliveryAddressBook) {
                next.receiverLandmark = locations.delivery.landmark || '';
                next.receiverBuilding = locations.delivery.building || '';
            } else if (isDeliveryPin) {
                next.receiverLandmark = '';
                next.receiverBuilding = '';
            } else {
                if (locations.delivery.landmark || locations.delivery.address) {
                    next.receiverLandmark = locations.delivery.landmark || locations.delivery.address || '';
                }
                if (locations.delivery.building) {
                    next.receiverBuilding = locations.delivery.building;
                }
            }

            return next;
        });
    }, [
        locations.handover.address,
        locations.delivery.address,
        locations.handover.landmark,
        locations.delivery.landmark,
        locations.handover.building,
        locations.delivery.building,
        locations.handover.source,
        locations.delivery.source,
    ]);

    const handlePhoneInputChange = (field, event) => {
        const digits = extractSubscriberDigits(event.target.value);
        const nextValue = digits ? `${PHONE_PREFIX}${digits}` : '';
        setFormData(prev => ({ ...prev, [field]: nextValue }));
        setErrors(prev => {
            const next = { ...prev };
            if (next[field]) delete next[field];
            return next;
        });
    };

    const handleInputChange = (field, value) => {
        if (isDropPointBooking) {
            if (field === 'deliverySpeed' && value !== 'indirect') {
                return;
            }
            if (field === 'deliveryMode' && value !== forcedIndirectDeliveryMode) {
                return;
            }
        }

        let sanitizedValue =
            field === 'senderEmail' || field === 'receiverEmail'
                ? enforceEnglishEmailInput(value)
                : value;
        if (typeof sanitizedValue === 'string') {
            sanitizedValue = removeEmojis(sanitizedValue);
        }
        setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
        setErrors(prev => {
            const next = { ...prev };
            if (next[field]) delete next[field];
            if (field === 'photos' && next.photos) delete next.photos;
            if (field === 'size') {
                // Clear custom dimension errors when switching away from custom
                delete next.customLength; delete next.customWidth; delete next.customHeight; delete next.customWeight; delete next.size;
            }
            if (field === 'senderEmail' || field === 'receiverEmail') {
                const otherField = field === 'senderEmail' ? 'receiverEmail' : 'senderEmail';
                const otherValue = formData[otherField];
                if (
                    next[otherField] === sameEmailError &&
                    normalizeEmail(sanitizedValue) !== normalizeEmail(otherValue)
                ) {
                    delete next[otherField];
                }
            }
            return next;
        });
    };

    const handleDeliverySpeedSelection = (speed) => {
        if (speed === 'direct') {
            if (!isDetectedDirectDelivery || shippingFeeLoading) {
                return;
            }

            setManualIndirectOverride(false);
            setFormData((prev) => (
                prev.deliverySpeed === 'direct'
                    ? prev
                    : { ...prev, deliverySpeed: 'direct' }
            ));
            return;
        }

        if (speed === 'indirect') {
            if (!canSelectIndirectSpeed || shippingFeeLoading) {
                return;
            }

            setManualIndirectOverride(true);
            setFormData((prev) => {
                if (prev.deliverySpeed === 'indirect' && prev.deliveryMode === 'door_to_door') {
                    return prev;
                }

                return {
                    ...prev,
                    deliverySpeed: 'indirect',
                    deliveryMode: 'door_to_door',
                };
            });
        }
    };

    const handleReturnWindowInput = (event) => {
        const raw = String(event.target.value || '');
        const digitsOnly = raw.replace(/[^0-9]/g, '');
        const nextValue = digitsOnly ? String(Number(digitsOnly)) : '';
        handleInputChange('returnWindow', nextValue);
    };

    const adjustReturnWindow = (delta) => {
        setFormData(prev => {
            const current = Number.parseInt(prev.returnWindow, 10);
            const base = Number.isFinite(current) && current >= 1 ? current : 3;
            const nextValue = Math.max(1, base + delta);
            return { ...prev, returnWindow: String(nextValue) };
        });
    };

    const showNotification = (message, type = 'info', duration = 4000) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), duration);
    };

    useEffect(() => {
        if (formData.size && formData.size !== 'custom') {
            lastStandardSizeRef.current = formData.size;
        }
    }, [formData.size]);

    const validateCourier = () => {
        const e = {};
        // Size required; if custom, all custom fields required
        if (!formData.size) {
            e.size = t('createBookingErrorSizeRequired');
        } else if (formData.size === 'custom') {
            if (!String(formData.customLength).trim()) {
                e.customLength = t('createBookingErrorLengthRequired');
            } else if (!/^\d+$/.test(String(formData.customLength).trim()) || parseInt(formData.customLength) < 1) {
                e.customLength = 'Length must be a positive integer';
            }
            if (!String(formData.customWidth).trim()) {
                e.customWidth = t('createBookingErrorWidthRequired');
            } else if (!/^\d+$/.test(String(formData.customWidth).trim()) || parseInt(formData.customWidth) < 1) {
                e.customWidth = 'Width must be a positive integer';
            }
            if (!String(formData.customHeight).trim()) {
                e.customHeight = t('createBookingErrorHeightRequired');
            } else if (!/^\d+$/.test(String(formData.customHeight).trim()) || parseInt(formData.customHeight) < 1) {
                e.customHeight = 'Height must be a positive integer';
            }
            if (!String(formData.customWeight).trim()) e.customWeight = t('createBookingErrorWeightRequired');
        }

        // Parcel details: consignment type required (schedule time is optional)
        if (!String(formData.consignmentType).trim()) e.consignmentType = t('createBookingErrorConsignmentRequired');

        // Photos: at least one
        if (!Array.isArray(formData.photos) || formData.photos.length < 1) e.photos = t('createBookingErrorPhotoRequired');

        return e;
    };

    const consignmentItems = useMemo(() => [
        { label: t('commonDocuments'), value: 'Documents' },
        { label: t('createBookingConsignmentSensitiveElectronics'), value: 'Sensitive Electronics' },
        { label: t('createBookingConsignmentFragileMaterials'), value: 'Fragile Materials' },
        { label: t('createBookingConsignmentClothingTextilesShoes'), value: 'Clothing, Textiles, and Shoes' },
        { label: t('createBookingConsignmentHouseholdElectricalAppliances'), value: 'Household Electrical Appliances' },
        { label: t('createBookingConsignmentFurniture'), value: 'Furniture' },
        { label: t('createBookingConsignmentDryFoodItems'), value: 'Dry, Sealed/Packaged Food Items' },
        { label: t('createBookingConsignmentSpareParts'), value: 'Spare Parts' },
        { label: t('createBookingConsignmentOtherMaterials'), value: 'Other Materials (must be specified)' },
    ], [t, i18n.language]);

    const consignmentLabelMap = useMemo(() => {
        const map = {};
        consignmentItems.forEach(({ value, label }) => {
            if (!value) return;
            map[value] = label;
            if (typeof value === 'string') {
                map[value.toLowerCase()] = label;
            }
        });

        const legacyOptions = [
            { value: 'Fragile', key: 'createBookingConsignmentFragile' },
            { value: 'Electronics', key: 'createBookingConsignmentElectronics' },
        ];
        legacyOptions.forEach(({ value, key }) => {
            const label = t(key);
            map[value] = label;
            map[value.toLowerCase()] = label;
        });

        return map;
    }, [consignmentItems, t, i18n.language]);
    const getConsignmentLabel = (value) => {
        if (!value) return '';
        const normalized = typeof value === 'string' ? value.toLowerCase() : value;
        return consignmentLabelMap[value] || consignmentLabelMap[normalized] || value;
    };

    const insuranceItems = useMemo(() => [
        // { label: t('commonYes'), value: 'Yes', disabled: !isInsuranceYesAllowed },
        { label: t('commonYes'), value: 'Yes' },
        { label: t('commonNo'), value: 'No' },
    ], [t, i18n.language, isInsuranceYesAllowed]);
    const insuranceLabelMap = useMemo(() => ({
        Yes: t('commonYes'),
        No: t('commonNo'),
    }), [t, i18n.language]);
    const getInsuranceLabel = (value) => {
        if (!value) return '';
        return insuranceLabelMap[value] || value;
    };

    const routeLabelMap = {
        door_to_door: t('createBookingRouteDoorToDoor'),
        door_to_drop_point: t('createBookingRouteDoorToDrop'),
        drop_point_to_door: t('createBookingRouteDropToDoor'),
        drop_point_to_drop_point: t('createBookingRouteDropToDrop'),
    };

    const routeOptions = Object.entries(routeLabelMap).map(([value, label]) => ({
        id: value,
        value,
        label,
    }));
    const visibleRouteOptions = isDropPointBooking
        ? routeOptions.filter((option) => option.value === forcedIndirectDeliveryMode)
        : routeOptions;

    const deliveryTimelineDirect = [
        { key: 'assigned', label: t('statusAssigned') },
        { key: 'pickup', label: t('statusPickup') },
        { key: 'in_transit', label: t('statusInTransit') },
        // { key: 'out_for_delivery', label: t('shipmentsTimelineArrivedDropPoint') },
        { key: 'delivered', label: t('statusDelivered') },
    ];

    const deliveryTimelineIndirectFull = [
        { key: 'assigned', label: t('statusAssigned'), modes: ['door_to_door', 'door_to_drop_point'] },
        { key: 'pickup', label: t('statusPickup'), modes: ['door_to_door', 'door_to_drop_point'] },
        { key: 'in_transit', label: t('statusInTransit'), modes: ['door_to_door', 'door_to_drop_point'] },
        { key: 'arrived_dp1', label: t('timelineArrivedDropPoint1'), modes: ['door_to_door', 'door_to_drop_point'] },
        { key: 'delivered_dp1', label: t('timelineDeliveredDropPoint1'), modes: ['door_to_door', 'door_to_drop_point', 'drop_point_to_door', 'drop_point_to_drop_point'] },
        { key: 'dispatched_wh', label: t('timelineDispatchedToWarehouse'), modes: ['door_to_door', 'door_to_drop_point', 'drop_point_to_door', 'drop_point_to_drop_point'] },
        { key: 'arrived_wh', label: t('timelineArrivedWarehouse'), modes: ['door_to_door', 'door_to_drop_point', 'drop_point_to_door', 'drop_point_to_drop_point'] },
        ...(toCityId !== fromCityId ? [{ key: 'arrived_wh_2', label: t('timelineArrivedWarehouse2'), modes: ['door_to_door', 'door_to_drop_point', 'drop_point_to_door', 'drop_point_to_drop_point'] }] : []),
        { key: 'arrived_dp2', label: t('timelineArrivedDropPoint2'), modes: ['door_to_door', 'door_to_drop_point', 'drop_point_to_door', 'drop_point_to_drop_point'] },
        { key: 'ready_pickup', label: t('notificationReadyForPickupTitle'), modes: ['drop_point_to_drop_point'] },
        { key: 'dispatched_dp2', label: t('timelineDispatchedDropPoint2'), modes: ['door_to_door', 'drop_point_to_door'] },
        { key: 'pickup_dp2', label: t('timelinePickupDropPoint2'), modes: ['door_to_door', 'drop_point_to_door'] },
        { key: 'in_transit_customer', label: t('timelineInTransitToCustomer'), modes: ['door_to_door', 'drop_point_to_door'] },
        { key: 'delivered', label: t('statusDelivered'), modes: ['door_to_door', 'door_to_drop_point', 'drop_point_to_door', 'drop_point_to_drop_point'] },
    ];

    // Function to filter timeline based on delivery mode
    const getFilteredTimeline = (deliverySpeed, deliveryMode) => {
        if (deliverySpeed === 'direct') {
            return deliveryTimelineDirect;
        }

        // For indirect delivery, filter based on delivery mode
        if (!deliveryMode) {
            deliveryMode = 'door_to_door'; // default
        }

        return deliveryTimelineIndirectFull.filter(step =>
            !step.modes || step.modes.includes(deliveryMode)
        );
    };

    const formatCurrency = (value, fallback = '—') => {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }
        const formatted = numeric.toLocaleString('en-US');
        return `${formatted} SYP`;
    };
    const computeInsuranceFee = (goodsAmount) => {
        if (formData.insurance !== 'Yes') {
            return 0;
        }
        const safeGoodsAmount = parseNumericValue(goodsAmount) || 0;
        if (!Number.isFinite(safeGoodsAmount) || safeGoodsAmount <= 0) {
            return 0;
        }

        const minBound = insuranceMinAmount ?? 0;
        const maxBound = insuranceMaxAmount ?? Number.POSITIVE_INFINITY;
        if (safeGoodsAmount < minBound || safeGoodsAmount > maxBound) {
            return 0;
        }

        const rawType = String(financialSettings.insurance_type || 'Fixed Amount').toLowerCase();
        const insuranceValue = parseNumericValue(financialSettings.insurance_value) || 0;
        if (rawType.includes('percentage')) {
            return Math.round(safeGoodsAmount * (insuranceValue / 100));
        }
        return Math.round(insuranceValue);
    };

    const computeTotals = (fee, includeShipmentFee = true, options = {}) => {
        const {
            deliveryFeePayer = formData.deliveryFeePayer,
            acceptReturns = formData.acceptReturns,
            returnDeliveryFeePayer = formData.returnDeliveryFeePayer,
        } = options;

        // Prefer selected option total, then API total, then explicit fallback fee.
        const f =
            parseNumericValue(shippingOptions?.[formData.deliverySpeed]?.total) ??
            parseNumericValue(shippingPriceResponse?.total) ??
            parseNumericValue(fee) ??
            0;

        if (!Number.isFinite(f)) {
            return {
                shipmentFee: null,
                appliedShipmentFee: null,
                rdfFee: null,
                appliedRdfFee: null,
                goodsAmount: null,
                serviceFee: null,
                insuranceFee: null,
                subtotal: null,
                platform: null,
                vat: null,
                total: null,
                senderPaysAmount: null,
            };
        }

        const goodsAmount = parseNumericValue(formData.parcelAmount) || 0;
        const insuranceFee = computeInsuranceFee(goodsAmount);
        const serviceFee =
            parseNumericValue(shippingOptions?.[formData.deliverySpeed]?.service_fee) ??
            parseNumericValue(shippingPriceResponse?.service_fee) ??
            (
                (parseNumericValue(shippingPriceResponse?.sender?.service_fee) ?? 0) +
                (parseNumericValue(shippingPriceResponse?.receiver?.service_fee) ?? 0)
            );            

        const deliveryPlatformFeeString = financialSettings.platform_fee;

        // Parse the platform fee (remove commas and convert to number)
        const platform = parseFloat(String(deliveryPlatformFeeString || '0').replace(/,/g, '')) || 0;

        // Shipment fee (always included in total)
        const shipmentFeeValue = includeShipmentFee ? f : 0;

        // RDF fee value (using same fee as shipment fee)
        const rdfFeeValue = f;
        // RDF is included ONLY when both payers are the same (Sender+Sender or Receiver+Receiver)
        const includeRdfInTotal = acceptReturns && deliveryFeePayer === returnDeliveryFeePayer;
        const fullRdfFee = includeRdfInTotal ? rdfFeeValue : 0;

        // Total = Goods + Insurance + Shipment + Platform (before VAT)
        const total = goodsAmount + insuranceFee + serviceFee + shipmentFeeValue + platform;
        const taxableSubtotal = insuranceFee + serviceFee + shipmentFeeValue + platform;

        // Calculate VAT based on delivery type and financial settings
        let vat = 0;
        const vatType = financialSettings.vat_type || 'Fixed Amount';
        const vatValueLine = financialSettings.vat_value || '0';

        // Parse the VAT value (remove commas and convert to number)
        const parsedVatValue = parseFloat(String(vatValueLine).replace(/,/g, '')) || 0;

        if (vatType === 'Percentage') {
            // VAT is percentage of Taxable Subtotal
            vat = Math.round(taxableSubtotal * (parsedVatValue / 100));
        } else {
            // Fixed amount
            vat = Math.round(parsedVatValue);
        }

        // SubTotal = Total + VAT (the final displayed amount)
        const subtotal = total + vat;
        // Checkout total = subtotal + RDF (when both payers match: Sender+Sender or Receiver+Receiver)
        const checkoutTotal = subtotal + fullRdfFee;

        // senderPaysAmount = what the SENDER pays (for button label), now includes Platform + VAT
        const senderPaysShipmentFee = deliveryFeePayer === 'sender';
        const senderPaysRdfFee = (acceptReturns && returnDeliveryFeePayer === 'sender') ? rdfFeeValue : 0;
        
        const senderPaysAmount = senderPaysShipmentFee ? insuranceFee + serviceFee + platform + vat + shipmentFeeValue : 0;
        const senderPaysAmountWithRDF = senderPaysRdfFee ? senderPaysAmount + rdfFeeValue : senderPaysAmount;
        
        const receiverPaysShipmentFee = (deliveryFeePayer === 'receiver') ? shipmentFeeValue : 0;
        const receiverPaysRdfFee = (acceptReturns && returnDeliveryFeePayer === 'receiver') ? rdfFeeValue : 0;
        const receiverPaysAmount = receiverPaysShipmentFee ? insuranceFee + serviceFee + platform + vat + shipmentFeeValue + goodsAmount : goodsAmount;
        const receiverPaysAmountWithRDF = receiverPaysRdfFee ? receiverPaysAmount + rdfFeeValue : receiverPaysAmount;

        return {
            shipmentFee: f,
            appliedShipmentFee: shipmentFeeValue,
            rdfFee: rdfFeeValue,
            appliedRdfFee: fullRdfFee,
            goodsAmount,
            serviceFee,
            insuranceFee,
            subtotal,
            platform,
            vat,
            total,
            checkoutTotal,
            senderPaysAmount : senderPaysAmountWithRDF,
            receiverPaysAmount,
            senderPaysAmountWithRDF,
            receiverPaysAmountWithRDF
        };
    };

    const handleParcelAmountChange = (e) => {
        let v = e.target.value || '';
        v = v.replace(/[^0-9.]/g, '');
        const parts = v.split('.');
        if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
        const num = parseFloat(v);
        if (!v || isNaN(num) || num <= 0) {
            handleInputChange('parcelAmount', '');
        } else {
            handleInputChange('parcelAmount', v);
        }
    };

    const validateShipment = () => {
        const e = {};
        // Sender required fields
        if (!String(formData.senderName).trim()) e.senderName = 'Sender name is required.';
        if (!String(formData.senderPhone).trim()) e.senderPhone = 'Sender phone is required.';
        if (!String(formData.senderLandmark).trim()) e.senderLandmark = 'Sender nearest landmark is required.';
        if (!String(formData.senderBuilding).trim()) e.senderBuilding = 'Sender building name is required.';
        const senderEmail = String(formData.senderEmail || '').trim();
        if (senderEmail && !isValidEmail(senderEmail)) {
            e.senderEmail = 'Sender email must be valid.';
        }

        // Receiver required fields
        if (!String(formData.receiverName).trim()) e.receiverName = 'Receiver name is required.';
        if (!String(formData.receiverPhone).trim()) e.receiverPhone = 'Receiver phone is required.';
        if (!String(formData.receiverLandmark).trim()) e.receiverLandmark = 'Receiver nearest landmark is required.';
        if (!String(formData.receiverBuilding).trim()) e.receiverBuilding = 'Receiver building name is required.';
        const receiverEmail = String(formData.receiverEmail || '').trim();
        if (receiverEmail && !isValidEmail(receiverEmail)) {
            e.receiverEmail = 'Receiver email must be valid.';
        }
        const userEmail = page?.props?.auth?.user?.email;
        
        if (receiverEmail == userEmail) {
            e.receiverEmail = 'Receiver email cannot be same as your own email.';
        }

        if (
            !e.senderEmail &&
            !e.receiverEmail &&
            senderEmail &&
            receiverEmail &&
            normalizeEmail(senderEmail) === normalizeEmail(receiverEmail)
        ) {
            e.senderEmail = sameEmailError;
            e.receiverEmail = sameEmailError;
        }

        return e;
    };

    // Calculate shipping fee when entering Review step using PriceCalculator API
    useEffect(() => {
        const shouldCalculate = step === 'review';
        if (!shouldCalculate) return;

        const fromCity = handover_city || '';
        const fromState = handover_state || '';
        const toCity = delivery_city || '';
        const toState = delivery_state || '';

        if (!fromCity || !toCity) {
            clearShippingPriceState();
            return;
        }

        let abort = false;
        (async () => {
            try {
                setShippingFeeLoading(true);
                // Resolve cities to get type and governate
                const qs1 = new URLSearchParams({ city: fromCity, state: fromState });
                const qs2 = new URLSearchParams({ city: toCity, state: toState });
                const commonHeaders = { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
                const [r1, r2] = await Promise.all([
                    fetch(`/api/v1/cities/check?${qs1.toString()}`, { headers: commonHeaders }),
                    fetch(`/api/v1/cities/check?${qs2.toString()}`, { headers: commonHeaders }),
                ]);
                if (!r1.ok || !r2.ok) {
                    throw new Error(`City lookup failed (${r1.status}/${r2.status})`);
                }
                const ct1 = r1.headers.get('content-type') || '';
                const ct2 = r2.headers.get('content-type') || '';
                const j1 = ct1.includes('application/json') ? await r1.json() : { exists: false };
                const j2 = ct2.includes('application/json') ? await r2.json() : { exists: false };

                if (!j1?.exists || !j2?.exists) {
                    clearShippingPriceState();
                    return;
                }

                if (j1.data.id && j2.data.id) {
                    setFromCityId(j1.data.id);
                    setToCityId(j2.data.id);
                }

                const payload = {
                    from_city_id: j1.data?.id,
                    to_city_id: j2.data?.id,
                    size_id: (formData.size && formData.size !== 'custom') ? formData.size : null,
                    handover_latitude: locations.handover.coordinates?.lat,
                    handover_longitude: locations.handover.coordinates?.lon,
                    delivery_latitude: locations.delivery.coordinates?.lat,
                    delivery_longitude: locations.delivery.coordinates?.lon,
                    force_indirect: isDropPointBooking || isIndirectOverrideActive,
                };

                // Use web route with session auth + CSRF
                const resp = await fetch('/customer/shipments/calculate-price', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        ...getCsrfHeaders(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(payload),
                });
                if (!resp.ok) {
                    const maybeJson = (resp.headers.get('content-type') || '').includes('application/json');
                    const errBody = maybeJson ? await resp.json().catch(() => null) : null;
                    if (resp.status === 422 && errBody?.debug) {
                        setShippingDebugInfo(errBody);
                        setShippingOptions(null);
                    }
                    const msg = errBody?.message || `Price API failed: ${resp.status}`;
                    throw new Error(msg);
                }
                const data = await resp.json();
                
                if (!abort && data?.success && data?.data) {
                    setShippingDebugInfo(null);
                    applyShippingPriceData(data.data);
                }
            } catch (e) {
                console.error('Failed to calculate shipping fee', e);
                if (!abort) {
                    clearShippingPriceState();
                }
            } finally {
                if (!abort) setShippingFeeLoading(false);
            }
        })();

        return () => {
            abort = true;
        };
    }, [step, handover_city, handover_state, delivery_city, delivery_state, isDropPointBooking, isIndirectOverrideActive, locations.handover.coordinates?.lat, locations.handover.coordinates?.lon, locations.delivery.coordinates?.lat, locations.delivery.coordinates?.lon, formData.size]);

    const goToStep = (target) => {
        // push history entry so browser back button can be tracked
        if (target !== step) {
            try {
                window.history.pushState({ step: target }, '');
            } catch (e) {
                console.warn('history pushState failed', e);
            }
        }

        if (target === 'courier') {
            setStep('courier');
            setCompleted({ courier: false, shipment: false });
            setActivated((prev) => ({ ...prev, courier: true, shipment: false, review: false }));
            return;
        }
        if (target === 'shipment') {
            const e1 = validateCourier();
            setErrors(e1);
            if (Object.keys(e1).length === 0) {
                setCompleted((prev) => ({
                    ...prev,
                    courier: true,
                    shipment: step === 'review' ? false : prev.shipment,
                }));
                setActivated((prev) => ({
                    ...prev,
                    courier: true,
                    shipment: true,
                    review: step === 'review' ? false : prev.review,
                }));
                setStep('shipment');
            }
            return;
        }
        if (target === 'review') {
            const e1 = validateCourier();
            const e2 = validateShipment();
            const merged = { ...e1, ...e2 };
            setErrors(merged);
            if (Object.keys(merged).length === 0) {
                setCompleted((prev) => ({ ...prev, courier: true, shipment: true }));
                setActivated((prev) => ({ ...prev, courier: true, shipment: true, review: true }));
                setStep('review');
            }
            return;
        }
    };

    const handleDocsUpload = async (e) => {
        const files = Array.from(e.target?.files || []);
        if (files.length === 0) return;

        // Upload each document
        for (const file of files) {
            try {
                const uploadedUrl = await uploadDocument(file);
                setFormData(prev => ({
                    ...prev,
                    additionalDocs: [...prev.additionalDocs, uploadedUrl]
                }));
            } catch (err) {
                console.error('Document upload failed:', err);
                setErrors(prev => ({
                    ...prev,
                    additionalDocs: `Failed to upload ${file.name}. Please try again.`
                }));
            }
        }

        // Clear the input so the same file can be selected again
        e.target.value = '';
    };

    const uploadDocument = async (file) => {
        const xsrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        const xsrf = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : null;

        const fd = new FormData();
        fd.append('document', file);

        const resp = await fetch('/customer/uploads/document', {
            method: 'POST',
            headers: {
                ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
                ...(!xsrf && document.querySelector('meta[name="csrf-token"]')
                    ? { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') }
                    : {}),
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: fd,
            credentials: 'same-origin',
        });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        return data.url;
    };

    const uploadPhoto = async (file) => {
        // Prefer XSRF cookie to avoid stale <meta> tokens on first load
        const xsrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        const xsrf = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : null;

        const fd = new FormData();
        fd.append('photo', file);

        const resp = await fetch('/customer/uploads/photo', {
            method: 'POST',
            headers: {
                ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
                ...(!xsrf && document.querySelector('meta[name="csrf-token"]')
                    ? { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') }
                    : {}),
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: fd,
            credentials: 'same-origin',
        });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        return data.url;
    };

    const handlePhotoSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create immediate local preview to avoid delays or missed renders
        const localUrl = URL.createObjectURL(file);
        let insertIndex = -1;
        setFormData(prev => {
            const nextPhotos = [...prev.photos, localUrl];
            insertIndex = nextPhotos.length - 1;
            return { ...prev, photos: nextPhotos };
        });
        // Clear any photo-related error immediately
        setErrors(prev => {
            if (!prev.photos) return prev;
            const next = { ...prev };
            delete next.photos;
            return next;
        });

        try {
            const uploadedUrl = await uploadPhoto(file);
            // Replace local blob URL with server URL when ready
            setFormData(prev => {
                const nextPhotos = [...prev.photos];
                if (insertIndex >= 0 && insertIndex < nextPhotos.length && nextPhotos[insertIndex] === localUrl) {
                    nextPhotos[insertIndex] = uploadedUrl;
                } else {
                    // Fallback: append if index mismatch
                    nextPhotos.push(uploadedUrl);
                }
                return { ...prev, photos: nextPhotos };
            });
        } catch (err) {
            console.error(err);
            // Remove the placeholder preview if upload fails
            setFormData(prev => ({
                ...prev,
                photos: prev.photos.filter((p, i) => !(i === insertIndex && p === localUrl))
            }));
            setErrors(prev => ({ ...prev, photos: 'Photo upload failed. Please try again.' }));
        } finally {
            // Clean up local object URL
            try { URL.revokeObjectURL(localUrl); } catch { }
        }

        // Allow re-selecting the same file
        e.target.value = '';
    };

    const handleRemovePhoto = (index) => {
        setFormData(prev => {
            const nextPhotos = prev.photos?.filter((_, idx) => idx !== index) ?? [];
            const removed = prev.photos?.[index];
            if (removed && removed.startsWith('blob:')) {
                try { URL.revokeObjectURL(removed); } catch { }
            }
            return { ...prev, photos: nextPhotos };
        });
        setErrors(prev => {
            if (!prev.photos) return prev;
            const next = { ...prev };
            delete next.photos;
            return next;
        });
    };

    const handleRemoveDocument = (index) => {
        setFormData(prev => ({
            ...prev,
            additionalDocs: prev.additionalDocs?.filter((_, idx) => idx !== index) ?? []
        }));
        setErrors(prev => {
            if (!prev.additionalDocs) return prev;
            const next = { ...prev };
            delete next.additionalDocs;
            return next;
        });
    };

    const handleTermsLinkClick = (e) => {
        const isMobile = window.innerWidth < 640; // Tailwind sm breakpoint
        
        if (isMobile) {
            e.preventDefault();
            e.stopPropagation();
            setShowTermsModal(true);
        }
        // On desktop, allow default behavior (opens in new tab)
    };

    const buildShipmentPayload = () => {
        const totals = computeTotals(shippingFee, shipmentFeeToggle);
        const shipmentFeeValue = Number.isFinite(totals.appliedShipmentFee) ? totals.appliedShipmentFee : 0;
        const serviceFeeValue = Number.isFinite(totals.serviceFee) ? totals.serviceFee : 0;
        const insuranceFeeValue = Number.isFinite(totals.insuranceFee) ? totals.insuranceFee : 0;
        const senderAmount = Number.isFinite(totals.senderPaysAmount) ? totals.senderPaysAmount : 0;
        const receiverAmount = Number.isFinite(totals.receiverPaysAmount) ? totals.receiverPaysAmount : 0;
        const totalAmount = senderAmount;

        const sizeOptions = Array.isArray(sizes) ? sizes : [];
        const isCustomSizeSelection = formData.size === 'custom';
        const selectedSizeOption = !isCustomSizeSelection && formData.size
            ? sizeOptions.find((s) => String(s.id) === String(formData.size))
            : null;

        const sizeLabel = isCustomSizeSelection
            ? 'custom'
            : selectedSizeOption?.name ?? null;

        const deriveWeightFromSize = () => {
            if (!selectedSizeOption) {
                return null;
            }

            const bounds = [selectedSizeOption.min_weight_kg, selectedSizeOption.max_weight_kg]
                .filter((value) => value !== undefined && value !== null && value !== '');

            if (bounds.length === 0) {
                return null;
            }

            return bounds.join(' - ');
        };

        const weightValue = isCustomSizeSelection
            ? (formData.customWeight ? String(formData.customWeight) : null)
            : deriveWeightFromSize();

        const rdf_amount = shipmentFeeValue;
        const senderDoorServiceFee = formData.deliverySpeed === 'indirect'
            ? indirectDeliveryFees.sender
            : null;
        const receiverDoorServiceFee = formData.deliverySpeed === 'indirect'
            ? indirectDeliveryFees.receiver
            : null;
        const payload = {
            delivery_speed: formData.deliverySpeed,
            consignment_type: formData.consignmentType === 'Other Materials (must be specified)'
                ? formData.consignmentTypeOther
                : formData.consignmentType,
            size: sizeLabel,
            size_id: (formData.size && formData.size !== 'custom') ? Number(formData.size) : null,
            custom_length: isCustomSizeSelection ? formData.customLength : null,
            custom_width: isCustomSizeSelection ? formData.customWidth : null,
            custom_height: isCustomSizeSelection ? formData.customHeight : null,
            weight: weightValue,
            parcel_amount: formData.parcelAmount || null,
            service_fee: serviceFeeValue,
            insurance: formData.insurance || null,
            insurance_fee: insuranceFeeValue,
            schedule_time: formData.scheduleTime,

            payment_type: 'new_shipment',
            payer_type: 'sender',

            handover_address: locations.handover.address,
            handover_latitude: locations.handover.coordinates?.lat,
            handover_longitude: locations.handover.coordinates?.lon,
            delivery_address: locations.delivery.address,
            delivery_latitude: locations.delivery.coordinates?.lat,
            delivery_longitude: locations.delivery.coordinates?.lon,

            sender_name: formData.senderName,
            sender_phone: formData.senderPhone,
            sender_email: formData.senderEmail,
            sender_landmark: formData.senderLandmark,
            sender_building: formData.senderBuilding,
            receiver_name: formData.receiverName,
            receiver_phone: formData.receiverPhone,
            receiver_email: formData.receiverEmail,
            receiver_landmark: formData.receiverLandmark,
            receiver_building: formData.receiverBuilding,

            rdf_amount: rdf_amount,
            sender_amount: senderAmount,
            reciever_amount: receiverAmount,
            sender_zone_delivery_fee: senderDoorServiceFee,
            reciever_zone_delivery_fee: receiverDoorServiceFee,

            accept_returns: formData.acceptReturns,
            return_window: formData.returnWindow || null,
            delivery_fee_payer: formData.deliveryFeePayer,
            return_delivery_fee_payer: formData.acceptReturns ? formData.returnDeliveryFeePayer : null,
            special_instruction: formData.specialInstruction,
            photos: (formData.photos || []).filter(u => typeof u === 'string' && !u.startsWith('blob:')),
            additional_docs: formData.additionalDocs,
            payment_method: paymentMethod,
            total_fee: shipmentFeeValue, // This comes from totals.appliedShipmentFee which uses shippingOptions
            payment_amount: totalAmount, // This comes from totals.senderPaysAmount
            from_city_id: fromCityId,
            to_city_id: toCityId,
        };

        if (formData.deliverySpeed === 'indirect') {
            payload.indirect_delivery_mode = formData.deliveryMode;
        }

        return payload;
    };

    const buildOnlinePayload = () => buildShipmentPayload();

    const submitShipment = async () => {
        // Clear stale parcel amount / insurance errors before submission since fields are optional
        setErrors(prev => {
            if (!prev?.parcelAmount && !prev?.insurance) {
                return prev;
            }
            const next = { ...prev };
            delete next.parcelAmount;
            delete next.insurance;
            return next;
        });

        // Validate region match for Direct delivery before submission
        if (formData.deliverySpeed === 'direct') {
            if (handover_city_id != null && delivery_city_id != null) {
                if (handover_city_id !== delivery_city_id) {
                    const restrictionMessage = t('createBookingDirectCityRestriction');
                    setCityMismatchError(restrictionMessage);
                    alert(restrictionMessage);
                    return;
                }
            } else {
                const normalizedHandoverRegion = normalizeRegionValue(handover_state, handover_city);
                const normalizedDeliveryRegion = normalizeRegionValue(delivery_state, delivery_city);

                if (normalizedHandoverRegion && normalizedDeliveryRegion) {
                    if (normalizedHandoverRegion !== normalizedDeliveryRegion) {
                        const restrictionMessage = t('createBookingDirectCityRestriction');
                        setCityMismatchError(restrictionMessage);
                        alert(restrictionMessage);
                        return;
                    }
                }
            }
        }

        const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        const payload = buildShipmentPayload();

        const resp = await fetch('/customer/shipments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error('Failed to store shipment');
        const data = await resp.json();
        return data;
    };

    const handleResendSyriatelOtp = async () => {
        if (!paymentData?.invoice) return;

        try {
            const { ok, result } = await resendSyriatelOtp({
                shipment_id: paymentData.shipment_id,
                invoice: paymentData.invoice,
            });

            if (ok) {
                setPaymentError(t('onlinePaymentOtpResent'));
            } else {
                setPaymentError(result.message || t('onlinePaymentResendError'));
            }
        } catch {
            setPaymentError(t('onlinePaymentResendError'));
        }
    };

    const handleConfirmPayment = async () => {
        if (submitting) return;
        setPaymentError('');

        if (paymentMethod === 'online' && onlineProvider === 'mtn' && onlineStep === 'phone') {
            try {
                setSubmitting(true);
                const onlinePayload = buildOnlinePayload();
                onlinePayload.payment_phone = onlinePhone;
                const { ok, result } = await initiateMtnPayment(onlinePayload);
                if (!ok) {
                    setPaymentError(result.message || t('commonPaymentInitiateError'));
                    return;
                }
                setPaymentData(result.payment);
                setOnlineStep('otp');
            } catch (e) {
                console.error(e);
                setPaymentError(t('commonPaymentInitiateError'));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (paymentMethod === 'online' && onlineProvider === 'mtn' && onlineStep === 'otp') {
            if (!otpCode || otpCode.length < 4) {
                setPaymentError(t('onlinePaymentOtpInvalid'));
                return;
            }
            try {
                setSubmitting(true);
                const { ok, result } = await confirmMtnPayment({
                    shipment_id: paymentData?.shipment_id ?? paymentData?.invoice,
                    phone: paymentData?.phone,
                    guid: paymentData?.guid,
                    operation_number: paymentData?.operation_number,
                    invoice: paymentData?.invoice,
                    code: otpCode,
                });
                if (!ok) {
                    setPaymentError(result.message || t('onlinePaymentConfirmError'));
                    return;
                }
                setCheckoutOpen(false);
                setNewShipmentId(result.shipment_id ?? null);
                setShowPopup(true);
                setOnlineStep('phone');
                setOnlinePhone('');
                setOtpCode('');
                setPaymentData(null);
            } catch (e) {
                console.error(e);
                setPaymentError(t('onlinePaymentConfirmError'));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (paymentMethod === 'online' && onlineProvider === 'syriatel' && onlineStep === 'phone') {
            try {
                setSubmitting(true);
                const onlinePayload = buildOnlinePayload();
                onlinePayload.payment_phone = onlinePhone;
                const { ok, result } = await initiateSyriatelPayment(onlinePayload);
                if (!ok) {
                    setPaymentError(result.message || t('commonPaymentInitiateError'));
                    return;
                }
                setPaymentData(result.payment);
                setOnlineStep('otp');
            } catch (e) {
                console.error(e);
                setPaymentError(t('commonPaymentInitiateError'));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (paymentMethod === 'online' && onlineProvider === 'syriatel' && onlineStep === 'otp') {
            if (!otpCode || otpCode.length < 4) {
                setPaymentError(t('onlinePaymentOtpInvalid'));
                return;
            }
            try {
                setSubmitting(true);
                const { ok, result } = await confirmSyriatelPayment({
                    shipment_id: paymentData?.shipment_id,
                    invoice: paymentData?.invoice,
                    otp: otpCode,
                });
                if (!ok) {
                    setPaymentError(result.message || t('onlinePaymentConfirmError'));
                    return;
                }
                setCheckoutOpen(false);
                setNewShipmentId(result.shipment_id ?? null);
                setShowPopup(true);
                setOnlineStep('phone');
                setOnlinePhone('');
                setOtpCode('');
                setPaymentData(null);
            } catch (e) {
                console.error(e);
                setPaymentError(t('onlinePaymentConfirmError'));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (paymentMethod === 'online' && onlineProvider === 'card') {
            try {
                setSubmitting(true);
                const onlinePayload = buildOnlinePayload();
                const { ok, result } = await initiatePaymeraPayment(onlinePayload);
                if (!ok || !result.payment_url) {
                    setPaymentError(result.message || t('onlinePaymentCardError'));
                    return;
                }
                window.location.href = result.payment_url;
            } catch (e) {
                console.error(e);
                setPaymentError(t('onlinePaymentCardError'));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (paymentMethod === 'cash') {
            try {
                setSubmitting(true);
                const result = await submitShipment();
                setCheckoutOpen(false);
                setNewShipmentId(result?.shipment_id ?? null);
                setShowPopup(true);
            } catch (e) {
                console.error(e);
                alert(t('createBookingSubmitError'));
            } finally {
                setSubmitting(false);
            }
        }
    };

    const redirectToDashboardForAddressEdit = () => {
        try {
            sessionStorage.setItem('customerBookingFormData', JSON.stringify(formData));

            const handoverLat = locations.handover.coordinates?.lat ?? handover_latitude;
            const handoverLon = locations.handover.coordinates?.lon ?? handover_longitude;
            const deliveryLat = locations.delivery.coordinates?.lat ?? delivery_latitude;
            const deliveryLon = locations.delivery.coordinates?.lon ?? delivery_longitude;
            const normalizeCoordinate = (value) => {
                if (typeof value === 'number') {
                    return Number.isFinite(value) ? value : null;
                }

                const parsed = parseFloat(value);
                return Number.isFinite(parsed) ? parsed : null;
            };

            const locationsToSave = {
                handover: {
                    address: locations.handover.address || handover_address || '',
                    coordinates: {
                        lat: normalizeCoordinate(handoverLat),
                        lon: normalizeCoordinate(handoverLon)
                    },
                    landmark: locations.handover.landmark || handover_landmark || '',
                    building: locations.handover.building || handover_building || '',
                    source: locations.handover.source || handover_source || '',
                    components: {
                        city: locations.handover.components?.city || handover_city || '',
                        state: locations.handover.components?.state || handover_state || '',
                        country: locations.handover.components?.country || 'Syria'
                    }
                },
                delivery: {
                    address: locations.delivery.address || delivery_address || '',
                    coordinates: {
                        lat: normalizeCoordinate(deliveryLat),
                        lon: normalizeCoordinate(deliveryLon)
                    },
                    landmark: locations.delivery.landmark || delivery_landmark || '',
                    building: locations.delivery.building || delivery_building || '',
                    source: locations.delivery.source || delivery_source || '',
                    components: {
                        city: locations.delivery.components?.city || delivery_city || '',
                        state: locations.delivery.components?.state || delivery_state || '',
                        country: locations.delivery.components?.country || 'Syria'
                    }
                }
            };

            sessionStorage.setItem('customerBookingLocations', JSON.stringify(locationsToSave));
        } catch (e) {
            console.error('Failed to save form data:', e);
        }

        window.location.href = "/customer/dashboard";
    };

    const next = () => {
        if (step === 'courier') return goToStep('shipment');
        if (step === 'shipment') return goToStep('review');
    };
    const back = () => {
        if (step === "courier") {
            redirectToDashboardForAddressEdit();
            return;
        }
        setStep(prev => {
            if (prev === 'review') {
                // Going back to shipment: remove its completed tick
                setCompleted(c => ({ ...c, shipment: false }));
                setActivated(a => ({ ...a, review: false, shipment: true }));
                return 'shipment';
            }
            // Going back to courier: remove its completed tick
            setCompleted(c => ({ ...c, courier: false, shipment: false }));
            setActivated(a => ({ ...a, shipment: false, review: false, courier: true }));
            return 'courier';
        });
    };

    // keep browser history in sync with the current step
    useEffect(() => {
        // initialize state entry so first back works predictably
        try {
            window.history.replaceState({ step }, '');
        } catch (e) {
            console.warn('history replaceState failed', e);
        }

        const handlePop = (e) => {
            // if a modal is visible, treat navigation as a reset
            if (showPopup) {
                setStep('courier');
                setCompleted({ courier: false, shipment: false });
                setActivated({ courier: true, shipment: false, review: false });
                return;
            }

            // if the event carries our step state, use it directly
            const incoming = e?.state?.step;
            if (incoming === 'review') {
                setCompleted(c => ({ ...c, courier: true, shipment: true }));
                setActivated(a => ({ ...a, courier: true, shipment: true, review: true }));
                setStep('review');
                return;
            }
            if (incoming === 'shipment') {
                setCompleted(c => ({ ...c, courier: true, shipment: false }));
                setActivated(a => ({ ...a, courier: true, shipment: true, review: false }));
                setStep('shipment');
                return;
            }
            // default to courier (covers incoming === 'courier' or undefined)
            setCompleted({ courier: false, shipment: false });
            setActivated({ courier: true, shipment: false, review: false });
            setStep('courier');
        };

        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [showPopup]);

    useEffect(() => {
        if (computeTotals(shippingFee, shipmentFeeToggle).senderPaysAmountWithRDF === 0) {
            setPaymentMethod('cash');
        }
    }, [formData.deliveryFeePayer, formData.returnDeliveryFeePayer]);


    const isCustomSize = formData.size === 'custom';
    const sizeOptions = Array.isArray(sizes) ? sizes : [];
    const selectedSize = !isCustomSize && formData.size
        ? sizeOptions.find((s) => String(s.id) === String(formData.size))
        : null;
    const handleSelectStandardSizes = () => {
        if (!isCustomSize) {
            return;
        }
        const fallbackSize = lastStandardSizeRef.current ?? (sizeOptions[0]?.id ?? null);
        if (fallbackSize === null || fallbackSize === undefined) {
            return;
        }
        handleInputChange('size', fallbackSize);
    };

    return (
        <div className="min-h-screen bg-[#f3f6f8]">
            <style>{`
                .card { border-radius: 14px; box-shadow: 0 2px 0 rgba(0,0,0,0.02); }
                .step-pill { border:1.5px solid #338DFF; padding:12px 12px; border-radius:999px; font-weight:700; font-size:14px; background:#fff; color:#338DFF; transition:all 0.2s ease; display:inline-flex; align-items:center; gap:8px; }
                .step-pill.active { background:#fff; color:#338DFF; box-shadow:none; }
                .step-pill.completed { background:#338DFF; color:#fff; box-shadow:0 10px 20px rgba(51,141,255,0.25); }
                .step-connector { height:2px; width:48px; background:#dbe3f5; }
                .step-connector.done { background:#338DFF; box-shadow:0 1px 0 rgba(51,141,255,0.35) inset; }
                /* Location block styles to match design */
                .location-card { border:1px solid #E6EAF3; border-radius:14px; padding:16px; background:#fff; box-shadow:none; }
                .order-card { border:1px solid #e5ecfb; border-radius:18px; padding:18px; background:white; box-shadow:0 10px 20px rgba(64,112,206,0.06); }
                .speed-card { border-radius:20px; border:1.5px solid transparent; background:white; padding:18px; transition:border-color 0.2s ease, box-shadow 0.2s ease; }
                .speed-card.active { border-color:#338dff; box-shadow:0 12px 26px rgba(51,141,255,0.15); background:linear-gradient(180deg,#f0f6ff,#ffffff); }
                table.payment-table tr td { padding:12px 16px; }
                table.payment-table tr:not(:last-child) td { border-bottom:1px solid #edf1fb; }
                .sidebar { width:72px; background:#338dff; min-height:100vh; color:#fff; padding-top:20px; }
                .sb-icon { width:44px; height:44px; display:flex; align-items:center; justify-content:center; border-radius:12px; margin:10px auto; background:rgba(255,255,255,0.06); transition:background .15s; }
                .sb-icon:hover { background:rgba(255,255,255,0.12); cursor:pointer; }
                .size-card { padding:14px; }
                .size-card.active { border-color:#2f80ed; background:linear-gradient(180deg,#f0f7ff,#fff); box-shadow:0 2px 6px rgba(47,128,237,0.06); }
                .custom-fields input { background:#fff; border:2px solid #E3E3E3; border-radius:25px; padding:16px 20px; font-size:14px; font-weight:600; color:#1f2937; transition:border-color .2s, box-shadow .2s, transform .2s; }
                .custom-fields input::placeholder { font-weight:500; }
                .custom-fields input:hover, .custom-fields input:focus { border-color:#2f80ed; box-shadow:0 10px 20px rgba(47,128,237,0.18); transform:translateY(-1px); outline:none; }
                .custom-fields input:disabled { background:#f7f6f8; color:#9ca3af; border-color:#e5e7eb; box-shadow:none; transform:none; cursor:not-allowed; }
                .custom-fields input:disabled::placeholder { color:#cbd5f5; }
                input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.4); }

                /* Pill selects for Parcel Details */
                .select-pill { position:relative; }
                .select-pill select { appearance:none; -webkit-appearance:none; -moz-appearance:none; width:100%; border:1px solid #E6EAF3; background:#fff; border-radius:999px; padding:16px 42px 16px 16px; font-size:14px; color:#111827; }
                .select-pill .chev { position:absolute; right:10px; top:50%; transform:translateY(-50%); width:28px; height:28px;  border-radius:999px; display:flex; align-items:center; justify-content:center; color:#0f172a; pointer-events:none; background:#fff; }
                .input-pill input, .input-pill .input-el { width:100%; border:1px solid #E6EAF3; background:#fff; border-radius:999px; padding:16px 20px; font-size:14px; outline:none; }
                .input-pill input:focus, .input-pill .input-el:focus { border-color:#E6EAF3; }

                /* Size options */
                .size-opt { border:1px solid #E6EAF3; border-radius:16px; background:#fff; padding:14px; transition:border-color .2s, box-shadow .2s; }
                .size-opt.selected { border-color:#338DFF; box-shadow:0 8px 16px rgba(51,141,255,0.12); }
                .size-opt.disabled { opacity:.55; pointer-events:none; }
                .size-header-dot { width:20px; height:20px; border:2px solid #d1d5db; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; margin-right:8px; transition:border-color .2s ease; }
                .size-header-dot .dot { width:10px; height:10px; background:#338DFF; border-radius:999px; opacity:0; transition:opacity .2s ease; }
                .size-header-dot.selected { border-color:#338DFF; }
                .size-header-dot.selected .dot { opacity:1; }
                .step-pill.inactive { border-color: #d1d5db; color: #9ca3af; cursor: not-allowed; }
                .step-connector.inactive { background-color: #e5e7eb; }
            `}</style>

            <div className="flex">
                {/* Sidebar */}
                <CustomerSidebar showBottomTabs={false} />


                {/* Main content */}
                {/* Add subtle vertical divider between sidebar and content */}
                <main className="flex-1 md:border-l border-[#E6EAF3] md:ml-[72px] md:overflow-y-auto">
                    {/* Mobile fixed step header */}
                    <div className="md:hidden flex justify-center items-center fixed top-0 left-0 right-0 z-20 font-bold bg-white/95 backdrop-blur border-b border-[#E6EAF3] h-14">
                        <button className={`md:hidden absolute top-1/2 -translate-y-1/2 ${textDirection === 'rtl' ? 'right-4' : 'left-4'}`} onClick={back} aria-label={t('commonBack')}>
                            <img src="/assets/images/left_arrow_icon.svg" alt="icon" className={textDirection === 'rtl' ? 'rotate-180' : ''} />
                        </button>
                        <h1 className="text-lg">
                            {step === 'courier'
                                ? t('createBookingStepCourier')
                                : step === 'shipment'
                                    ? t('commonShipmentDetails')
                                    : t('createBookingStepReview')}
                        </h1>
                    </div>
                    {/* Spacer to avoid content under fixed mobile header */}
                    <div className="h-14 md:hidden"></div>
                    {/* Page header */}
                    <CustomerHeader
                        title={t('createBookingTitle')}
                        breadcrumbs={[
                            { label: t('commonHome'), href: '/customer/dashboard' },
                            { label: t('createBookingBreadcrumbCreateBooking') },
                        ]}
                    />

                    {/* Card */}
                    <div className="md:px-6 md:pt-6">

                        <div className="md:bg-white card md:p-6">

                            {/* centered steps */}

                            <div className={`hidden md:flex justify-center ${step === 'review' ? 'ml-2' : completed.courier ? '-ml-5' : ''} mb-4`}>
                                <div className="inline-flex items-center gap-3 bg-transparent px-2 py-1">

                                    {/* Courier */}
                                    <button
                                        type="button"
                                        onClick={() => goToStep('courier')}
                                        className={`step-pill
                ${completed.courier ? 'completed' : ''}
                ${(step === 'courier' && activated.courier) ? 'active' : ''}
                ${!completed.courier && step !== 'courier' ? 'inactive' : ''}`}
                                    >
                                        {completed.courier && (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-blue-500">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        )}
                                        {t('createBookingStepCourier')}
                                    </button>

                                    <span className={`step-connector ${completed.courier ? 'done' : 'inactive'}`} />

                                    {/* Shipment */}
                                    <button
                                        type="button"
                                        onClick={() => goToStep('shipment')}
                                        className={`step-pill
                ${completed.shipment ? 'completed' : ''}
                ${(step === 'shipment' && activated.shipment) ? 'active' : ''}
                ${!completed.shipment && step !== 'shipment' ? 'inactive' : ''}`}
                                    >
                                        {completed.shipment && (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-blue-500">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        )}
                                        {t('commonShipmentDetails')}
                                    </button>

                                    <span className={`step-connector ${(step === 'review' || completed.shipment) ? 'done' : 'inactive'}`} />

                                    {/* Review */}
                                    <button
                                        type="button"
                                        onClick={() => goToStep('review')}
                                        className={`step-pill
                ${(step === 'review' && activated.review) ? 'active' : ''}
                ${!completed.shipment && step !== 'review' ? 'inactive' : ''}`}
                                    >
                                        {t('createBookingStepReview')}
                                    </button>

                                </div>
                            </div>


                            <div className="flex gap-8 items-stretch">
                                {/* Left column */}
                                <div className="hidden md:block w-1/3 space-y-6">
                                    {/* Delivery speed selector */}
                                    {step === 'review' && (
                                        <div className="rounded-2xl bg-[#eef5ff] p-4">
                                            <p className="text-base font-semibold text-gray-800 mb-3">{t('deliverySpeedPrompt')}</p>

                                            {/* Pricing Debug Information */}
                                            {shippingDebugInfo && (
                                                <div className="mb-4 p-4 rounded-xl border-2 border-red-200 bg-red-50 space-y-3">
                                                    <div className="flex items-center gap-2 text-red-700">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                        <p className="font-bold text-sm">{t('createBookingPricingCalculationDebug')}</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2 text-[10px] sm:text-xs">
                                                        <div className="bg-white p-2 rounded border border-red-100">
                                                            <p className="font-semibold text-gray-400 uppercase mb-1">{t('createBookingDirectPath')}</p>
                                                            <p className="text-gray-800 break-words">{shippingDebugInfo.debug?.direct || 'No errors reported'}</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded border border-red-100">
                                                            <p className="font-semibold text-gray-400 uppercase mb-1">{t('createBookingIndirectPath')}</p>
                                                            <p className="text-gray-800 break-words">{shippingDebugInfo.debug?.indirect || 'No errors reported'}</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded border border-red-100 flex flex-wrap justify-between gap-2">
                                                            <span>{t('createBookingPickupZone')}: <span className="font-mono font-bold text-blue-600">{shippingDebugInfo.zones?.pickup || t('commonNotAvailable')}</span></span>
                                                            <span>{t('createBookingDropOffZone')}: <span className="font-mono font-bold text-blue-600">{shippingDebugInfo.zones?.drop_off || t('commonNotAvailable')}</span></span>
                                                        </div>
                                                        <div className="bg-white p-2 rounded border border-red-100 flex flex-wrap justify-between gap-2">
                                                            <span>{t('createBookingBoxSizeId')}: <span className="font-mono font-bold text-blue-600">{shippingDebugInfo.parcel?.id || t('commonNotAvailable')}</span></span>
                                                            <span>{t('createBookingMappingKey')}: <span className="font-mono font-bold text-blue-600">{shippingDebugInfo.parcel?.mapping_key || t('commonNotAvailable')}</span></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Direct - Only show if available */}
                                            {showDirectDeliveryCard && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeliverySpeedSelection('direct')}
                                                    disabled={shippingFeeLoading}
                                                    className={`w-full text-left rounded-xl border-2 px-4 py-3 transition ${formData.deliverySpeed === 'direct' ? 'border-[#338DFF] bg-white' : 'border-[#dbe3f5] bg-white'} ${shippingFeeLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center ${formData.deliverySpeed === 'direct' ? 'border-[#338DFF]' : 'border-gray-300'}`}>
                                                            {formData.deliverySpeed === 'direct' && <span className="w-2 h-2 rounded-full bg-[#338DFF]" />}
                                                        </span>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-base font-semibold text-gray-800">{t('createBookingDirectDelivery')}</p>
                                                            </div>
                                                            <p className="text-sm text-gray-500 mt-0.5">{t('createBookingDeliverySpeedDirectDesc')}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            )}

                                            {/* In-Direct Speed Card */}
                                            {showIndirectDeliveryCard && (
                                                <div
                                                    role={isIndirectCardClickable ? 'button' : undefined}
                                                    tabIndex={isIndirectCardClickable ? 0 : -1}
                                                    onClick={() => handleDeliverySpeedSelection('indirect')}
                                                    onKeyDown={(e) => {
                                                        if (!isIndirectCardClickable) return;
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleDeliverySpeedSelection('indirect');
                                                        }
                                                    }}
                                                    className={`${showDirectDeliveryCard ? 'mt-3' : ''} w-full text-left rounded-xl border-2 px-4 py-3 transition ${formData.deliverySpeed === 'indirect' ? 'border-[#338DFF] bg-white' : 'border-[#dbe3f5] bg-white'} ${isIndirectCardClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center ${formData.deliverySpeed === 'indirect' ? 'border-[#338DFF]' : 'border-gray-300'}`}>
                                                            {formData.deliverySpeed === 'indirect' && <span className="w-2 h-2 rounded-full bg-[#338DFF]" />}
                                                        </span>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center">
                                                                <p className={`text-base font-semibold ${formData.deliverySpeed === 'indirect' ? 'text-gray-800' : 'text-gray-800'}`}>{t('createBookingIndirectDelivery')}</p>
                                                            </div>
                                                            <span  className={`text-sm font-medium inline-flex items-center gap-1 border border-[#dbe3f5] rounded-lg px-2 py-1 bg-white ${formData.deliverySpeed === 'indirect' ? 'text-blue-500' : 'text-gray-400 opacity-60'}`}>
                                                                {routeLabelMap[formData.deliveryMode] || routeLabelMap.door_to_door}
                                                            </span>
                                                            {/* <div className="mt-1 relative inline-block" ref={routeMenuDesktopRef}>
                                                                <button
                                                                    type="button"
                                                                    className={`text-sm font-medium inline-flex items-center gap-1 border border-[#dbe3f5] rounded-lg px-2 py-1 bg-white ${formData.deliverySpeed === 'indirect' ? 'text-blue-500' : 'text-gray-400 cursor-not-allowed opacity-60'}`}
                                                                    disabled={formData.deliverySpeed !== 'indirect' || isDropPointBooking}
                                                                    onClick={(e) => { e.stopPropagation(); if (formData.deliverySpeed !== 'indirect' || isDropPointBooking) return; setShowRouteMenuDesktop(v => !v); }}
                                                                >
                                                                    {routeLabelMap[formData.deliveryMode] || routeLabelMap.door_to_drop_point}
                                                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
                                                                </button>
                                                                {showRouteMenuDesktop && formData.deliverySpeed === 'indirect' && !isDropPointBooking && (
                                                                    <div className="absolute left-0 right-0" style={{ top: 'calc(100% + 4px)' }}>
                                                                        <Menu
                                                                            className="w-full"
                                                                            items={visibleRouteOptions}
                                                                            onItemClick={(item) => {
                                                                                handleInputChange('deliveryMode', item.value);
                                                                                setShowRouteMenuDesktop(false);
                                                                            }}
                                                                            anchorRef={routeMenuDesktopRef}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div> */}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* City Mismatch Error Message */}
                                            {cityMismatchError && (
                                                <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                                                    <div className="flex items-start gap-2">
                                                        <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                        <p className="text-sm text-red-700 font-medium">{cityMismatchError}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="location-card">
                                        <div>
                                            <p className="text-sm font-semibold text-blue-500">{t('commonHandOverLocation')}</p>
                                            <div className="mt-2 flex items-center justify-between border border-[#E6EAF3] rounded-full px-4 py-2 bg-white">
                                                <p className="text-sm text-gray-800 pr-3 whitespace-normal break-words leading-snug">{locations.handover.address}</p>
                                                <span className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                                    <img src="/assets/images/map-icon.png" alt="map-icon" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="location-card">
                                        <div>
                                            <p className="text-sm font-semibold text-blue-500">{t('commonDeliveryLocation')}</p>
                                            <div className="mt-2 flex items-center justify-between border border-[#E6EAF3] rounded-full px-4 py-2 bg-white">
                                                <p className="text-sm text-gray-800 pr-3 whitespace-normal break-words leading-snug">{locations.delivery.address}</p>
                                                <span className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                                    <img src="/assets/images/map-icon.png" alt="map-icon" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {step !== 'courier' && (
                                        <button
                                            type="button"
                                            onClick={redirectToDashboardForAddressEdit}
                                            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#338DFF] text-[#338DFF] rounded-full font-semibold text-sm hover:bg-[#f0f6ff] transition-colors"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            {t('createBookingEditAddresses')}
                                        </button>
                                    )}

                                    {step === 'review' && (
                                        <div className="border border-[#e5ecfb] rounded-2xl p-6 mb-6 ">
                                            <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('commonOrderTracking')}</h2>
                                            <hr className="border-t border-[#E6EAF3] mb-4" />
                                            {(() => {
                                                const timeline = getFilteredTimeline(formData.deliverySpeed, formData.deliveryMode);
                                                const idx = Number.isFinite(trackingIndex) && trackingIndex > 0 ? Math.min(timeline.length - 1, trackingIndex - 1) : Math.max(0, timeline.findIndex(s => s.key === trackingStatus));
                                                const now = new Date();
                                                const dateLocale = locale.startsWith('ar') ? 'ar-EG' : 'en-GB';
                                                const fmt = (d) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, ' ');
                                                return (
                                                    <div className="space-y-0">
                                                        {timeline.map((s, i) => {
                                                            const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
                                                            return (
                                                                <div key={s.key} className="flex items-start gap-4">
                                                                    <div className="flex flex-col items-center">
                                                                        {state === 'done' ? (
                                                                            <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                                                                                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                                            </div>
                                                                        ) : state === 'active' ? (
                                                                            <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                                                                                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                                                                                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                                                                            </div>
                                                                        )}
                                                                        {i < timeline.length - 1 && (
                                                                            <div className={`w-0.5 h-10 mt-1 ${i <= idx ? 'bg-gray-300' : 'bg-gray-200'}`}></div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <p className={`text-sm font-medium ${i <= idx ? 'text-gray-400' : 'text-gray-400'}`}>{s.label}</p>
                                                                        {/* <p className={`text-xs ${state === 'done' ? 'text-gray-500' : state === 'active' ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                        {i < idx ? fmt(now) : i === idx ? `Est. ${fmt(new Date(now.getTime() + 30*60000))}` : '--'}
                                                                    </p> */}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Vertical divider between columns */}
                                <div className="hidden lg:block w-px bg-[#E6EAF3] self-stretch rounded-full"></div>

                                {/* Right column */}
                                <div className="flex-1 space-y-6">
                                    {step === 'courier' && (
                                        <>
                                            {/* Mobile: Size select */}
                                            <div className="md:hidden size-card ">
                                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                    <label className="flex items-center text-base font-semibold text-gray-800 cursor-pointer select-none">
                                                        <input
                                                            type="radio"
                                                            name="size-mode"
                                                            className="sr-only"
                                                            checked={!isCustomSize}
                                                            onChange={handleSelectStandardSizes}
                                                        />
                                                        <span className={`size-header-dot ${!isCustomSize ? 'selected' : ''}`}>
                                                            <span className="dot"></span>
                                                        </span>
                                                        {t('createBookingSelectSize')}
                                                    </label>

                                                </div>
                                                <div className="select-pill">
                                                    <div className="relative w-full" ref={sizeMenuRef}>
                                                        <div
                                                            className={`w-full rounded-full border px-4 py-3 text-sm text-left flex justify-between items-center cursor-pointer ${errors.size ? 'border-red-500' : 'border-[#E6EAF3]'}`}
                                                            onClick={() => setShowSizeMenu(!showSizeMenu)}
                                                        >
                                                            {formData.size === 'custom' ? t('commonCustom') :
                                                                sizes.find(s => s.id === formData.size)?.name || t('createBookingSelectSizePlaceholder')}
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
                                                        </div>
                                                        {showSizeMenu && (
                                                            <Menu
                                                                items={[
                                                                    ...(Array.isArray(sizes) ? sizes.map(s => ({
                                                                        id: s.id,
                                                                        label: `${s.name}${(s.min_weight_kg || s.max_weight_kg) ? ` (${[s.min_weight_kg, s.max_weight_kg].filter(Boolean).join(' - ')} KGs)` : ''}`,
                                                                        value: s.id
                                                                    })) : [])
                                                                ]}
                                                                onItemClick={(item) => {
                                                                    handleInputChange('size', item.value);
                                                                    setShowSizeMenu(false);
                                                                }}
                                                                anchorRef={sizeMenuRef}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                {errors.size && <p className="text-red-600 text-xs mt-2">{errors.size}</p>}

                                                {/* Mobile: Custom fields in single column */}
                                                <label className="inline-flex mt-2 items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer select-none">
                                                    <span className={`w-5 h-5 rounded-full border ${isCustomSize ? 'border-[#338DFF]' : 'border-gray-300'} flex items-center justify-center`}>
                                                        {isCustomSize && <span className="w-2.5 h-2.5 rounded-full bg-[#338DFF]"></span>}
                                                    </span>
                                                    <input
                                                        type="radio"
                                                        name="size-mode"
                                                        className="sr-only"
                                                        checked={isCustomSize}
                                                        onChange={() => handleInputChange('size', 'custom')}
                                                    />
                                                    {t('commonCustom')}
                                                </label>
                                                <div className={`mt-2 ${!isCustomSize ? 'opacity-60 pointer-events-none' : ''}`}>
                                                    {/* <label className="block text-sm text-gray-700 font-medium mb-2">{t('commonCustom')}</label> */}
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                step="1"
                                                                disabled={!isCustomSize}
                                                                placeholder={t('createBookingCustomLengthPlaceholder')}
                                                                className={`w-full rounded-full border px-4 outline-none py-3 text-sm ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'} ${errors.customLength ? 'border-red-500' : ''}`}
                                                                value={formData.customLength}
                                                                style={errors.customLength ? undefined : { border: '1px solid #D1D5DB' }}
                                                                onFocus={(e) => { if (!errors.customLength && isCustomSize) e.currentTarget.style.borderColor = '#338DFF'; }}
                                                                onBlur={(e) => { if (!errors.customLength) e.currentTarget.style.borderColor = '#D1D5DB'; }}
                                                                onChange={(e) => handleInputChange('customLength', e.target.value)}
                                                                onKeyPress={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                                            />
                                                            {errors.customLength && <p className="text-red-600 text-xs mt-1">{errors.customLength}</p>}
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                step="1"
                                                                disabled={!isCustomSize}
                                                                placeholder={t('createBookingCustomWidthPlaceholder')}
                                                                className={`w-full rounded-full border px-4 outline-none py-3 text-sm ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'} ${errors.customWidth ? 'border-red-500' : ''}`}
                                                                value={formData.customWidth}
                                                                style={errors.customWidth ? undefined : { border: '1px solid #D1D5DB' }}
                                                                onFocus={(e) => { if (!errors.customWidth && isCustomSize) e.currentTarget.style.borderColor = '#338DFF'; }}
                                                                onBlur={(e) => { if (!errors.customWidth) e.currentTarget.style.borderColor = '#D1D5DB'; }}
                                                                onChange={(e) => handleInputChange('customWidth', e.target.value)}
                                                                onKeyPress={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                                            />
                                                            {errors.customWidth && <p className="text-red-600 text-xs mt-1">{errors.customWidth}</p>}
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                step="1"
                                                                disabled={!isCustomSize}
                                                                placeholder={t('createBookingCustomHeightPlaceholder')}
                                                                className={`w-full rounded-full border px-4 outline-none py-3 text-sm ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'} ${errors.customHeight ? 'border-red-500' : ''}`}
                                                                value={formData.customHeight}
                                                                style={errors.customHeight ? undefined : { border: '1px solid #D1D5DB' }}
                                                                onFocus={(e) => { if (!errors.customHeight && isCustomSize) e.currentTarget.style.borderColor = '#338DFF'; }}
                                                                onBlur={(e) => { if (!errors.customHeight) e.currentTarget.style.borderColor = '#D1D5DB'; }}
                                                                onChange={(e) => handleInputChange('customHeight', e.target.value)}
                                                                onKeyPress={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                                            />
                                                            {errors.customHeight && <p className="text-red-600 text-xs mt-1">{errors.customHeight}</p>}
                                                        </div>
                                                        <div>
                                                            <input
                                                                disabled={!isCustomSize}
                                                                placeholder={t('createBookingCustomWeightPlaceholder')}
                                                                className={`w-full rounded-full border px-4 outline-none py-3 text-sm ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'} ${errors.customWeight ? 'border-red-500' : ''}`}
                                                                value={formData.customWeight}
                                                                style={errors.customWeight ? undefined : { border: '1px solid #D1D5DB' }}
                                                                onFocus={(e) => { if (!errors.customWeight && isCustomSize) e.currentTarget.style.borderColor = '#338DFF'; }}
                                                                onBlur={(e) => { if (!errors.customWeight) e.currentTarget.style.borderColor = '#D1D5DB'; }}
                                                                onChange={(e) => handleInputChange('customWeight', e.target.value)}
                                                            />
                                                            {errors.customWeight && <p className="text-red-600 text-xs mt-1">{errors.customWeight}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Desktop: Size grid */}
                                            <div className="hidden md:block size-card bg-[#F7F6F8]">
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="flex items-center text-base font-semibold text-gray-800 cursor-pointer select-none">
                                                        <input
                                                            type="radio"
                                                            name="size-mode"
                                                            className="sr-only"
                                                            checked={!isCustomSize}
                                                            onChange={handleSelectStandardSizes}
                                                        />
                                                        <span className={`size-header-dot ${!isCustomSize ? 'selected' : ''}`}>
                                                            <span className="dot"></span>
                                                        </span>
                                                        {t('createBookingAvailableSizes')}
                                                    </label>
                                                    <div className="text-sm text-gray-400">{t('createBookingSelectOne')}</div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-4">
                                                    {Array.isArray(sizes) && sizes.map((s) => {
                                                        const selected = String(formData.size) === String(s.id);
                                                        return (
                                                            <label key={s.id} className={`size-opt cursor-pointer ${selected ? 'selected' : ''}`}>
                                                                <div className="flex items-center gap-3 w-full">
                                                                    <div className="w-10 h-10 rounded-md flex items-center justify-center bg-white overflow-hidden">
                                                                        <img
                                                                            src={resolveMediaUrl(s.icon_path, '/assets/images/Parcel.svg')}
                                                                            onError={(e) => {
                                                                                e.currentTarget.onerror = null;
                                                                                e.currentTarget.src = '/assets/images/Parcel.svg';
                                                                            }}
                                                                            alt="size icon"
                                                                            className="w-7 h-7 object-contain"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className={`text-sm font-semibold ${selected ? 'text-blue-500' : 'text-gray-700'}`}>{s.name}</div>
                                                                        <div className="text-xs text-gray-500">{[s.min_weight_kg, s.max_weight_kg].filter(Boolean).join(' - ') || '—'} {(s.min_weight_kg || s.max_weight_kg) ? 'KGs' : ''}</div>
                                                                    </div>
                                                                    <span className={`w-5 h-5 rounded-full border ${selected ? 'border-[#338DFF]' : 'border-gray-300'} flex items-center justify-center`}>
                                                                        {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#338DFF]"></span>}
                                                                    </span>
                                                                    <input type="radio" name="size" className="sr-only" checked={selected} onChange={() => handleInputChange('size', s.id)} />
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>

                                                {/* Custom option */}
                                                <div className="mt-4 border-t border-[#E6EAF3] pt-4">
                                                    <label className="inline-flex items-center gap-3 cursor-pointer">
                                                        <span className={`w-5 h-5 rounded-full border ${isCustomSize ? 'border-[#338DFF]' : 'border-gray-300'} flex items-center justify-center`}>
                                                            {isCustomSize && <span className="w-2.5 h-2.5 rounded-full bg-[#338DFF]"></span>}
                                                        </span>
                                                        <input type="radio" name="size" className="sr-only" checked={isCustomSize} onChange={() => handleInputChange('size', 'custom')} />
                                                        <span className="text-sm text-gray-700 font-medium">{t('commonCustom')}</span>
                                                    </label>
                                                    <div className={`grid grid-cols-2 gap-3 mt-3 custom-fields ${!isCustomSize ? 'opacity-60 pointer-events-none' : ''}`}>
                                                        <div>
                                                            <input type="number" min="1" step="1" disabled={!isCustomSize} placeholder={t('createBookingCustomLengthPlaceholder')} className={`w-full rounded-full border px-4 py-3 text-sm ${errors.customLength ? 'border-red-500' : 'border-[#E6EAF3]'} ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'}`} value={formData.customLength} onChange={(e) => handleInputChange('customLength', e.target.value)} onKeyPress={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }} />
                                                            {errors.customLength && <p className="text-red-600 text-xs mt-1">{errors.customLength}</p>}
                                                        </div>
                                                        <div>
                                                            <input type="number" min="1" step="1" disabled={!isCustomSize} placeholder={t('createBookingCustomWidthPlaceholder')} className={`w-full rounded-full border px-4 py-3 text-sm ${errors.customWidth ? 'border-red-500' : 'border-[#E6EAF3]'} ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'}`} value={formData.customWidth} onChange={(e) => handleInputChange('customWidth', e.target.value)} onKeyPress={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }} />
                                                            {errors.customWidth && <p className="text-red-600 text-xs mt-1">{errors.customWidth}</p>}
                                                        </div>
                                                        <div>
                                                            <input type="number" min="1" step="1" disabled={!isCustomSize} placeholder={t('createBookingCustomHeightPlaceholder')} className={`w-full rounded-full border px-4 py-3 text-sm ${errors.customHeight ? 'border-red-500' : 'border-[#E6EAF3]'} ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'}`} value={formData.customHeight} onChange={(e) => handleInputChange('customHeight', e.target.value)} onKeyPress={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }} />
                                                            {errors.customHeight && <p className="text-red-600 text-xs mt-1">{errors.customHeight}</p>}
                                                        </div>
                                                        <div>
                                                            <input disabled={!isCustomSize} placeholder={t('createBookingCustomWeightPlaceholder')} className={`w-full rounded-full border px-4 py-3 text-sm ${errors.customWeight ? 'border-red-500' : 'border-[#E6EAF3]'} ${!isCustomSize ? 'bg-[#F7F6F8] text-gray-400' : 'bg-white'}`} value={formData.customWeight} onChange={(e) => handleInputChange('customWeight', e.target.value)} />
                                                            {errors.customWeight && <p className="text-red-600 text-xs mt-1">{errors.customWeight}</p>}
                                                        </div>
                                                    </div>
                                                    {errors.size && <p className="text-red-600 text-xs mt-2">{errors.size}</p>}
                                                </div>
                                            </div>

                                            {/* Parcel Details */}
                                            <div className="size-card border-t border-[#E6EAF3] md:px-0">
                                                <div className="text-base font-semibold text-gray-800 mb-4">{t('commonParcelDetails')}</div>
                                                <div className="grid gird-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Consignment Type */}
                                                    <div>
                                                        <div className="relative" ref={consignmentMenuRef}>
                                                            <div
                                                                className={`w-full rounded-full border ${errors.consignmentType ? 'border-red-500' : 'border-[#E6EAF3]'
                                                                    } bg-white px-4 py-3 text-sm flex items-center justify-between cursor-pointer`}
                                                                onClick={() => setShowConsignmentMenu((v) => !v)}
                                                            >
                                                                <span
                                                                    className={`truncate ${formData.consignmentType ? 'text-gray-900' : 'text-gray-400'
                                                                        }`}
                                                                >
                                                                    {formData.consignmentType ? getConsignmentLabel(formData.consignmentType) : t('createBookingSelectConsignment')}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    aria-label="Open consignment type menu"
                                                                    className="ml-2 w-7 h-7 rounded-full border border-[#E6EAF3] flex items-center justify-center text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    <svg
                                                                        className="w-3.5 h-3.5"
                                                                        viewBox="0 0 20 20"
                                                                        fill="currentColor"
                                                                    >
                                                                        <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
                                                                    </svg>
                                                                </button>
                                                            </div>

                                                            {showConsignmentMenu && (
                                                                <div className="absolute left-0 mt-2 z-40 w-full">
                                                                    <Menu
                                                                        unstyled
                                                                        className="rounded-[24px] !top-0 !left-0 border border-[#E6EAF3] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] overflow-hidden max-h-60"
                                                                        itemClassName="px-5 py-3 text-sm text-[#111827] hover:bg-[#F5F7FB]"
                                                                        items={consignmentItems}
                                                                        anchorRef={consignmentMenuRef}
                                                                        onItemClick={(item) => {
                                                                            handleInputChange('consignmentType', item.value);
                                                                            setShowConsignmentMenu(false);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {errors.consignmentType && (
                                                            <p className="text-red-600 text-xs mt-1">{errors.consignmentType}</p>
                                                        )}

                                                        {/* Conditional input for "Other Materials" specification */}
                                                        {formData.consignmentType === 'Other Materials (must be specified)' && (
                                                            <div className="mt-3">
                                                                <input
                                                                    type="text"
                                                                    value={formData.consignmentTypeOther}
                                                                    onChange={(e) => handleInputChange('consignmentTypeOther', e.target.value)}
                                                                    placeholder={t('createBookingSpecifyMaterial', 'Please specify the material')}
                                                                    className="w-full rounded-full border border-[#E6EAF3] bg-white px-4 py-3 text-sm outline-none focus:border-[#338DFF]"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Handover Time */}
                                                    <div>
                                                        <div className="relative" ref={handoverMenuRef}>
                                                            <button
                                                                type="button"
                                                                className={`w-full rounded-full border ${errors.scheduleTime ? 'border-red-500' : 'border-[#E6EAF3]'} bg-white px-4 py-3 text-sm flex items-center justify-between`}
                                                                onClick={() => setShowScheduleMenu((v) => !v)}
                                                            >
                                                                <span className={`truncate ${formData.scheduleTime ? 'text-gray-900' : 'text-gray-400'}`}>
                                                                    {formData.scheduleTime || t('createBookingScheduleTimePlaceholder', 'Select handover time')}
                                                                </span>
                                                                <span className="ml-2 w-7 h-7 rounded-full border border-[#E6EAF3] flex items-center justify-center text-gray-700 hover:bg-gray-50">
                                                                    <svg className={`w-3.5 h-3.5 transition-transform ${showScheduleMenu ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                                                        <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
                                                                    </svg>
                                                                </span>
                                                            </button>
                                                            {showScheduleMenu && (
                                                                <div className="absolute left-0 mt-2 z-40 w-full">
                                                                    <Menu
                                                                        unstyled
                                                                        className="rounded-[24px] border border-[#E6EAF3] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] overflow-hidden max-h-60"
                                                                        itemClassName="px-5 py-3 text-sm text-[#111827] hover:bg-[#F5F7FB]"
                                                                        items={handoverTimeSlots}
                                                                        anchorRef={handoverMenuRef}
                                                                        onItemClick={(item) => {
                                                                            handleInputChange('scheduleTime', item.value);
                                                                            setShowScheduleMenu(false);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {errors.scheduleTime && <p className="text-red-600 text-xs mt-1">{errors.scheduleTime}</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Photos */}
                                            <div className="border-t border-[#E6EAF3] pt-4 size-card">
                                                <p className="font-medium text-gray-800 mb-3">{t('commonPhotos')}</p>
                                                <div className="flex items-center gap-3">
                                                    {formData.photos?.map((url, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#e5ecfb] group"
                                                        >
                                                            <img src={url} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                                                            <button
                                                                type="button"
                                                                aria-label="Remove photo"
                                                                onClick={() => handleRemovePhoto(idx)}
                                                                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:bg-black/80"
                                                            >
                                                                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => photoInputRef.current?.click()} className="w-20 h-20 rounded-xl border border-[#e5ecfb] bg-white flex flex-col items-center justify-center text-gray-600 hover:bg-[#f7fbff]">
                                                        <span className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center">
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        </span>
                                                        <span className="text-[11px] mt-1">{t('commonAddNew')}</span>
                                                    </button>
                                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                                </div>
                                                {errors.photos && <p className="text-red-600 text-xs mt-2">{errors.photos}</p>}
                                            </div>

                                            {/* Special Instruction */}
                                            <div className="mt-6 border-t border-[#E6EAF3] pt-4 size-card">
                                                <p className="text-sm font-semibold text-gray-700 mb-3">{t('commonSpecialInstruction')}</p>
                                                <textarea
                                                    rows={4}
                                                    className="w-full rounded-xl border border-[#e5ecfb] bg-white px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#338DFF]"
                                                    placeholder={t('createBookingSpecialInstructionPlaceholder')}
                                                    value={formData.specialInstruction}
                                                    onChange={(e) => handleInputChange('specialInstruction', e.target.value)}
                                                />
                                            </div>

                                            {/* Additional Documents */}
                                            <div className="mt-6 border-t border-[#E6EAF3] pt-4 size-card">
                                                <p className="text-sm font-semibold text-gray-700 mb-3">{t('commonAdditionalDocuments')}</p>
                                                <label className="block border-2 border-dashed border-[#e5ecfb] rounded-2xl p-8 text-center cursor-pointer hover:border-[#338DFF] transition">
                                                    <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" className="hidden" onChange={handleDocsUpload} />
                                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-blue-500">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-3-3m3 3l3-3M6 20h12" />
                                                        </svg>
                                                        <span className="text-sm">{t('createBookingUploadDocument')}</span>
                                                    </div>
                                                </label>
                                                {formData.additionalDocs?.length > 0 && (
                                                    <div className="mt-4 flex gap-3 flex-wrap">
                                                        {formData.additionalDocs.map((url, idx) => (
                                                            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#e5ecfb] flex items-center justify-center bg-blue-50 group">
                                                                <a href={url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center">
                                                                    <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                    </svg>
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveDocument(idx)}
                                                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    aria-label="Remove document"
                                                                >
                                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {errors.additionalDocs && (
                                                    <p className="mt-2 text-sm text-red-500">{errors.additionalDocs}</p>
                                                )}
                                            </div>
                                            <div className="h-10 md:hidden"></div>
                                        </>
                                    )}

                                    {step === 'shipment' && (
                                        <div className="space-y-8">
                                            {/* Sender Details */}
                                            <div>
                                                <div className="text-base font-semibold text-gray-800 my-4 px-3 md:px-0">{t('commonSenderDetails')}</div>
                                                <div className="grid px-3 md:px-0 grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <input
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.senderName ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            value={formData.senderName}
                                                            placeholder={t('commonSenderName')}
                                                            onChange={(e) => handleInputChange('senderName', e.target.value)}
                                                            dir={textDirection}
                                                            list="sender-name-list"
                                                        />
                                                        <datalist id="sender-name-list">
                                                            {savedNames.map((building, index) => (
                                                                <option key={index} value={building} />
                                                            ))}
                                                        </datalist>
                                                        {errors.senderName && <p className="text-red-600 text-xs mt-1">{errors.senderName}</p>}
                                                    </div>
                                                    <div dir={textDirection}>
                                                        <div className={`h-[56px] rounded-full bg-white border flex items-center overflow-hidden ${errors.senderPhone ? 'border-red-500' : 'border-gray-300 focus-within:border-[#338DFF]'}`}>
                                                            <span className="pl-5 pr-2 text-gray-600 text-sm font-medium">+</span>
                                                            <input
                                                                type="tel"
                                                                dir={textDirection}
                                                                inputMode="tel"
                                                                className="flex-1 px-3 outline-none bg-transparent text-sm"
                                                                placeholder={t('createBookingPhonePlaceholder')}
                                                                value={formatPhoneForDisplay(formData.senderPhone)}
                                                                onChange={(e) => handlePhoneInputChange('senderPhone', e)}
                                                                list="sender-mobile-list"
                                                            />
                                                        </div>
                                                        <datalist id="sender-mobile-list">
                                                            {savedMobiles.map((building, index) => (
                                                                <option key={index} value={building} />
                                                            ))}
                                                        </datalist>
                                                        {errors.senderPhone && <p className="text-red-600 text-xs mt-1 col-span-2">{errors.senderPhone}</p>}
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="email"
                                                            inputMode="email"
                                                            lang="en"
                                                            dir={textDirection}
                                                            autoCapitalize="none"
                                                            autoCorrect="off"
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.senderEmail ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            placeholder={t('commonEmail') || 'Email'}
                                                            value={formData.senderEmail}
                                                            onChange={(e) => handleInputChange('senderEmail', e.target.value)}
                                                            list="sender-email-list"
                                                        />
                                                        <datalist id="sender-email-list">
                                                            {savedEmails.map((building, index) => (
                                                                <option key={index} value={building} />
                                                            ))}
                                                        </datalist>
                                                        {errors.senderEmail && <p className="text-red-600 text-xs mt-1">{errors.senderEmail}</p>}
                                                    </div>
                                                    <div>
                                                        <input
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.senderLandmark ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            placeholder={t('createBookingLandmarkPlaceholder')}
                                                            value={formData.senderLandmark}
                                                            onChange={(e) => handleInputChange('senderLandmark', e.target.value)}
                                                            list="sender-landmarks-list"
                                                            dir={textDirection}
                                                        />
                                                        <datalist id="sender-landmarks-list">
                                                            {savedLandmarks.map((landmark, index) => (
                                                                <option key={index} value={landmark} />
                                                            ))}
                                                        </datalist>
                                                        {errors.senderLandmark && <p className="text-red-600 text-xs mt-1">{errors.senderLandmark}</p>}
                                                    </div>
                                                    <div>
                                                        <input
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.senderBuilding ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            placeholder={t('createBookingBuildingPlaceholder')}
                                                            value={formData.senderBuilding}
                                                            onChange={(e) => handleInputChange('senderBuilding', e.target.value)}
                                                            list="sender-buildings-list"
                                                            dir={textDirection}
                                                        />
                                                        <datalist id="sender-buildings-list">
                                                            {savedBuildings.map((building, index) => (
                                                                <option key={index} value={building} />
                                                            ))}
                                                        </datalist>
                                                        {errors.senderBuilding && <p className="text-red-600 text-xs mt-1">{errors.senderBuilding}</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Receiver Details */}
                                            <div>
                                                <div className="text-base border-t border-[#e5ecfb] pt-5 font-semibold text-gray-800 mb-4 px-3 md:px-0">{t('commonReceiverDetails')}</div>
                                                <div className="grid px-3 md:px-0 grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <input
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.receiverName ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            placeholder={t('commonReceiverName')}
                                                            value={formData.receiverName}
                                                            onChange={(e) => handleInputChange('receiverName', e.target.value)}
                                                            dir={textDirection}
                                                            list="receiver-name-list"
                                                        />
                                                        <datalist id="receiver-name-list">
                                                            {savedNames.map((building, index) => (
                                                                <option key={index} value={building} />
                                                            ))}
                                                        </datalist>
                                                        {errors.receiverName && <p className="text-red-600 text-xs mt-1">{errors.receiverName}</p>}
                                                    </div>
                                                    <div>
                                                        <div className={`h-[56px] rounded-full bg-white border flex items-center overflow-hidden ${errors.receiverPhone ? 'border-red-500' : 'border-gray-300 focus-within:border-[#338DFF]'}`}>
                                                            <span className="pl-5 pr-2 text-gray-600 text-sm font-medium">+</span>
                                                            <input
                                                                type="tel"
                                                                inputMode="tel"
                                                                dir={textDirection}
                                                                className="flex-1 px-3 outline-none bg-transparent text-sm"
                                                                placeholder={t('createBookingPhonePlaceholder')}
                                                                value={formatPhoneForDisplay(formData.receiverPhone)}
                                                                onChange={(e) => handlePhoneInputChange('receiverPhone', e)}
                                                                list="receiver-mobile-list"
                                                            />
                                                            <datalist id="receiver-mobile-list">
                                                                {savedMobiles.map((building, index) => (
                                                                    <option key={index} value={building} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                        {errors.receiverPhone && <p className="text-red-600 text-xs mt-1 col-span-2">{errors.receiverPhone}</p>}
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="email"
                                                            inputMode="email"
                                                            lang="en"
                                                            dir={textDirection}
                                                            autoCapitalize="none"
                                                            autoCorrect="off"
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.receiverEmail ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            placeholder={t('commonEmail') || 'Email'}
                                                            value={formData.receiverEmail}
                                                            list="receiver-email-list"
                                                            onChange={(e) => handleInputChange('receiverEmail', e.target.value)}
                                                        />
                                                        <datalist id="receiver-email-list">
                                                            {savedEmails.map((building, index) => (
                                                                <option key={index} value={building} />
                                                            ))}
                                                        </datalist>
                                                        {errors.receiverEmail && <p className="text-red-600 text-xs mt-1">{errors.receiverEmail}</p>}
                                                    </div>
                                                    <div>
                                                        <input
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.receiverLandmark ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            placeholder={t('createBookingLandmarkPlaceholder')}
                                                            value={formData.receiverLandmark}
                                                            onChange={(e) => handleInputChange('receiverLandmark', e.target.value)}
                                                            list="receiver-landmarks-list"
                                                            dir={textDirection}
                                                        />
                                                        <datalist id="receiver-landmarks-list">
                                                            {savedLandmarks.map((landmark, index) => (
                                                                <option key={index} value={landmark} />
                                                            ))}
                                                        </datalist>
                                                        {errors.receiverLandmark && <p className="text-red-600 text-xs mt-1">{errors.receiverLandmark}</p>}
                                                    </div>
                                                    <div>
                                                        <input
                                                            className={`h-[56px] w-full rounded-full bg-white border px-5 text-sm focus:outline-none ${errors.receiverBuilding ? 'border-red-500' : 'border-gray-300 focus:border-[#338DFF]'}`}
                                                            placeholder={t('createBookingBuildingPlaceholder')}
                                                            value={formData.receiverBuilding}
                                                            onChange={(e) => handleInputChange('receiverBuilding', e.target.value)}
                                                            list="receiver-buildings-list"
                                                            dir={textDirection}
                                                        />
                                                        <datalist id="receiver-buildings-list">
                                                            {savedBuildings.map((building, index) => (
                                                                <option key={index} value={building} />
                                                            ))}
                                                        </datalist>
                                                        {errors.receiverBuilding && <p className="text-red-600 text-xs mt-1">{errors.receiverBuilding}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Return Parcel Details */}
                                            <div className="pt-4 border-t border-[#e5ecfb] px-3 md:px-0 space-y-4">
                                                <h3 className="text-base font-semibold text-gray-800">
                                                    {t('createBookingReturnParcelDetails') || 'Return Parcel Details'}
                                                </h3>

                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-[#338DFF]"
                                                            checked={formData.acceptReturns}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    acceptReturns: checked,
                                                                    returnWindow: checked ? (prev.returnWindow || '3') : ''
                                                                }));
                                                            }}
                                                        />
                                                        <span className='text-gray-600 font-medium'>{t('createBookingAcceptReturn') || 'I accept parcel returns.'}</span>
                                                    </label>

                                                    {formData.acceptReturns && (
                                                        <div className="relative w-full md:w-auto min-w-[150px]">
                                                            <div className="flex items-center border border-gray-200 rounded-full bg-white overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    className="w-10 h-10 text-3xl text-gray-500 hover:bg-gray-50 transition"
                                                                    onClick={() => adjustReturnWindow(-1)}
                                                                    aria-label={t('createBookingDecreaseReturnWindow') || 'Decrease return window'}
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    pattern="[0-9]*"
                                                                    min="1"
                                                                    value={formData.returnWindow}
                                                                    onChange={handleReturnWindowInput}
                                                                    placeholder={t('days')}
                                                                    className={`flex-1 appearance-none text-center text-sm font-medium text-gray-700 bg-transparent focus:outline-none ${errors.returnWindow ? 'border-red-300' : ''}`}
                                                                    onKeyDown={(ev) => {
                                                                        if (['e', 'E', '+', '-', '.'].includes(ev.key)) ev.preventDefault();
                                                                    }}
                                                                    onPaste={(ev) => {
                                                                        const pasted = (ev.clipboardData || window.clipboardData)?.getData('text') || '';
                                                                        if (/[^0-9]/.test(pasted)) ev.preventDefault();
                                                                    }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="w-10 h-10 text-3xl text-gray-500 hover:bg-gray-50 transition"
                                                                    onClick={() => adjustReturnWindow(1)}
                                                                    aria-label={t('createBookingIncreaseReturnWindow') || 'Increase return window'}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                            {errors.returnWindow && <p className="text-red-600 text-xs mt-1">{errors.returnWindow}</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="pb-15"></div>

                                        </div>
                                    )}

                                    {step === 'review' && (
                                        <div className="space-y-8 px-3 md:px-0">
                                            <div className="rounded-2xl bg-white p-4 mt-4 sm:hidden">
                                                <p className="text-base font-semibold text-gray-800 mb-3">{t('deliverySpeedPrompt')}</p>

                                                {/* Direct - Only show if available */}
                                                {showDirectDeliveryCard && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeliverySpeedSelection('direct')}
                                                        disabled={shippingFeeLoading}
                                                        className={`w-full text-left rounded-xl border-2 px-4 py-3 transition ${formData.deliverySpeed === 'direct' ? 'border-[#338DFF] bg-white' : 'border-[#dbe3f5] bg-white'} ${shippingFeeLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <span className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center ${formData.deliverySpeed === 'direct' ? 'border-[#338DFF]' : 'border-gray-300'}`}>
                                                                {formData.deliverySpeed === 'direct' && <span className="w-2 h-2 rounded-full bg-[#338DFF]" />}
                                                            </span>
                                                            <div>
                                                                <p className="text-base font-semibold text-gray-800">{t('deliverySpeedDirect')}</p>
                                                                <p className="text-sm text-gray-500 mt-0.5">{t('createBookingDeliverySpeedDirectDesc')}</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                )}

                                                {/* In-Direct - Only show if available */}
                                                {showIndirectDeliveryCard && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeliverySpeedSelection('indirect')}
                                                        disabled={!isIndirectCardClickable}
                                                        className={`${showDirectDeliveryCard ? 'mt-3' : ''} w-full text-left rounded-xl border-2 px-4 py-3 transition ${formData.deliverySpeed === 'indirect' ? 'border-[#338DFF] bg-white' : 'border-[#dbe3f5] bg-white'} ${isIndirectCardClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <span className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center ${formData.deliverySpeed === 'indirect' ? 'border-[#338DFF]' : 'border-gray-300'}`}>
                                                                {formData.deliverySpeed === 'indirect' && <span className="w-2 h-2 rounded-full bg-[#338DFF]" />}
                                                            </span>
                                                            <div>
                                                                <p className={`text-base font-semibold ${formData.deliverySpeed === 'indirect' ? 'text-gray-800' : 'text-gray-800'}`}>{t('deliverySpeedIndirect')}</p>
                                                                <div className="mt-1 relative inline-block" ref={routeMenuMobileRef}>
                                                                    <span
                                                                        className={`text-sm font-medium inline-flex items-center gap-1 border border-[#dbe3f5] rounded-lg px-2 py-1 bg-white ${formData.deliverySpeed === 'indirect' ? 'text-blue-500' : 'text-gray-400 opacity-60'}`}
                                                                    >
                                                                        {routeLabelMap[formData.deliveryMode] || routeLabelMap.door_to_door}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                )}

                                                {/* City Mismatch Error Message - Mobile */}
                                                {cityMismatchError && (
                                                    <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                                                        <div className="flex items-start gap-2">
                                                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                            </svg>
                                                            <p className="text-sm text-red-700 font-medium">{cityMismatchError}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="rounded-2xl bg-white p-4 mt-4 sm:hidden">
                                                <div className="location-card">
                                                    <div>
                                                        <p className="text-sm font-semibold text-blue-500">{t('createBookingHandOverLocation')}</p>
                                                        <div className="mt-2 flex items-center justify-between border border-[#E6EAF3] rounded-full px-4 py-2 bg-white">
                                                            <p className="text-sm text-gray-800 pr-3 whitespace-normal break-words leading-snug">{locations.handover.address}</p>
                                                            <span className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                                                <img src="/assets/images/map-icon.png" alt="map-icon" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="location-card mt-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-blue-500">{t('createBookingDeliveryLocation')}</p>
                                                        <div className="mt-2 flex items-center justify-between border border-[#E6EAF3] rounded-full px-4 py-2 bg-white">
                                                            <p className="text-sm text-gray-800 pr-3 whitespace-normal break-words leading-snug">{locations.delivery.address}</p>
                                                            <span className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                                                <img src="/assets/images/map-icon.png" alt="map-icon" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {step !== 'courier' && (
                                                    <button
                                                        type="button"
                                                        onClick={redirectToDashboardForAddressEdit}
                                                        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#338DFF] text-[#338DFF] rounded-full font-semibold text-sm hover:bg-[#f0f6ff] transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        {t('createBookingEditAddresses')}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="border border-[#e5ecfb] rounded-2xl p-6 mb-6 bg-white sm:hidden">
                                                <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('commonOrderTracking')}</h2>
                                                <hr className="border-t border-[#E6EAF3] mb-4" />
                                                {(() => {
                                                    const timeline = getFilteredTimeline(formData.deliverySpeed, formData.deliveryMode);
                                                    const idx = Number.isFinite(trackingIndex) && trackingIndex > 0 ? Math.min(timeline.length - 1, trackingIndex - 1) : Math.max(0, timeline.findIndex(s => s.key === trackingStatus));
                                                    const now = new Date();
                                                    const dateLocale = locale.startsWith('ar') ? 'ar-EG' : 'en-GB';
                                                    const fmt = (d) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, ' ');
                                                    return (
                                                        <div className="space-y-0">
                                                            {timeline.map((s, i) => {
                                                                const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
                                                                return (
                                                                    <div key={s.key} className="flex items-start gap-4">
                                                                        <div className="flex flex-col items-center">
                                                                            {state === 'done' ? (
                                                                                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                                                                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                                                </div>
                                                                            ) : state === 'active' ? (
                                                                                <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                                                                                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                                                                                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                                                                                </div>
                                                                            )}
                                                                            {i < timeline.length - 1 && (
                                                                                <div className={`w-0.5 h-10 mt-1 ${i <= idx ? 'bg-gray-300' : 'bg-gray-200'}`}></div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <p className={`text-sm font-medium ${i <= idx ? 'text-gray-400' : 'text-gray-400'}`}>{s.label}</p>
                                                                            {/* <p className={`text-xs ${state === 'done' ? 'text-gray-500' : state === 'active' ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                        {i < idx ? fmt(now) : i === idx ? `Est. ${fmt(new Date(now.getTime() + 30*60000))}` : '--'}
                                                                    </p> */}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="border border-[#e5ecfb] rounded-2xl p-6 mb-6 bg-white sm:hidden">
                                                {/* Timeline */}
                                                <div className="flex gap-4">
                                                    {/* Left timeline column */}
                                                    <div className="flex flex-col items-center mt-1">
                                                        {/* Start point (outlined) */}
                                                        <span className="w-4 h-4 border-2 border-[#338DFF] bg-white rounded-full"></span>
                                                        {/* Connecting line */}
                                                        <span className="flex-1 w-[2px] bg-[#338DFF] my-1"></span>
                                                        {/* End point (filled) */}
                                                        <span className="w-4 h-4 bg-[#338DFF] rounded-full"></span>
                                                    </div>

                                                    {/* Content column */}
                                                    <div className="flex flex-col gap-6">
                                                        {/* Hand Over Location */}
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-blue-500 mb-1">
                                                                {t('commonHandOverLocation')}
                                                            </h3>
                                                            <p className="text-sm text-gray-800">
                                                                {locations.handover.address}
                                                            </p>
                                                        </div>

                                                        {/* Drop-Off Location */}
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-blue-500 mb-1">
                                                                {t('commonDropOffLocation')}
                                                            </h3>
                                                            <p className="text-sm text-gray-800">
                                                                {locations.delivery.address}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Payment Details */}
                                            <div className="border rounded-2xl border-[#e5ecfb] overflow-hidden ">
                                                <div className="px-6 py-4 border-b border-[#e5ecfb]">
                                                    <h2 className="text-lg font-semibold text-gray-800">{t('commonPaymentDetails')}</h2>
                                                </div>
                                                <div className="overflow-x-auto ">
                                                    <table className="w-full payment-table text-sm text-gray-600">
                                                        <tbody>
                                                            {(() => {
                                                                if (shippingFeeLoading) {
                                                                    return (
                                                                        <tr>
                                                                            <td className="text-gray-500">{t('createBookingCalculatingShipmentFee')}</td>
                                                                            <td className="text-right">—</td>
                                                                        </tr>
                                                                    );
                                                                }
                                                                
                                                                const { shipmentFee, goodsAmount, serviceFee, insuranceFee, subtotal, platform, vat, total } = computeTotals(shippingFee, shipmentFeeToggle);
                                                                // Use shippingFee as fallback if shipmentFee is invalid
                                                                const displayFee = (shipmentFee !== null && shipmentFee !== 0) ? shipmentFee : shippingFee;

                                                                return (
                                                                    <>
                                                                        {/* 1. Goods Cost */}
                                                                        {goodsAmount > 0 && (
                                                                            <tr>
                                                                                <td className="font-medium text-gray-700">{t('commonGoodsCost')}</td>
                                                                                <td className="text-right font-medium text-[#595959]">{formatCurrency(goodsAmount)}</td>
                                                                            </tr>
                                                                        )}
                                                                        <tr>
                                                                            <td className="font-medium text-gray-700">{t('commonInsuranceFee')}</td>
                                                                            <td className="text-right font-medium text-[#595959]">{formatCurrency(insuranceFee ?? 0)}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td className="font-medium text-gray-700">{t('commonBasicFee')}</td>
                                                                            <td className="text-right font-medium text-[#595959]">{formatCurrency(serviceFee ?? 0)}</td>
                                                                        </tr>
                                                                        {/* 3. Shipment Fee (with Add/Remove toggle) */}
                                                                        {formData.deliverySpeed === 'indirect' ? (
                                                                            <>
                                                                                <tr>
                                                                                    <td className="font-medium text-gray-700">Sender Door Service Fee</td>
                                                                                    <td className="text-right font-medium text-[#595959]">{formatCurrency(indirectDeliveryFees.sender)}</td>
                                                                                </tr>
                                                                                <tr>
                                                                                    <td className="font-medium text-gray-700">Receiver Door Service Fee</td>
                                                                                    <td className="text-right font-medium text-[#595959]">{formatCurrency(indirectDeliveryFees.receiver)}</td>
                                                                                </tr>
                                                                            </>
                                                                        ) : (
                                                                            <tr>
                                                                                <td className="font-medium text-gray-700">{t('shipmentsDirectDeliveryFee')}</td>
                                                                                <td className="text-right font-medium text-[#595959]">{formatCurrency(displayFee ?? 0)}</td>
                                                                            </tr>
                                                                        )}
                                                                        {/* <td className="text-right font-medium text-[#595959]">
                                                                                <div className="flex items-center justify-end gap-3">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setShipmentFeeToggle((prev) => !prev)}
                                                                                        className={`inline-flex items-center gap-2 text-xs sm:text-sm min-w-fit font-semibold focus:outline-none transition-colors cursor-pointer ${shipmentFeeToggle ? 'text-red-500' : 'text-[#338DFF]'}`}
                                                                                    >
                                                                                        <span
                                                                                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${shipmentFeeToggle
                                                                                                ? 'border-red-200 bg-red-500 text-red-500'
                                                                                                : 'border-[#338DFF] bg-blue-500 text-[#338DFF]'
                                                                                                }`}
                                                                                        >
                                                                                            {shipmentFeeToggle ? (
                                                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                                                                                    <path strokeLinecap="round" d="M6 12h12" />
                                                                                                </svg>
                                                                                            ) : (
                                                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                                                                                    <path strokeLinecap="round" d="M12 5v14" />
                                                                                                    <path strokeLinecap="round" d="M5 12h14" />
                                                                                                </svg>
                                                                                            )}
                                                                                        </span>
                                                                                        <span className="underline">{shipmentFeeToggle ? t('commonRemove') : t('commonAddToTotal')}</span>
                                                                                    </button>
                                                                                    <span>{formatCurrency(displayFee)}</span>
                                                                                </div>
                                                                            </td> */}
                                                                        {/* 4. Platform Fee */}
                                                                        <tr>
                                                                            <td className="font-medium text-gray-700">{t('commonPlatformFee')}</td>
                                                                            <td className="text-right">{formatCurrency(platform)}</td>
                                                                        </tr>
                                                                        {/* 5. SubTotal = sum of 1 to 4 */}
                                                                        <tr>
                                                                            <td className="font-semibold text-gray-900">{t('commonSubtotal')}</td>
                                                                            <td className="text-right text-base font-bold text-gray-900">{formatCurrency(total)}</td>
                                                                        </tr>
                                                                        {/* 6. VAT (% of Total) */}
                                                                        <tr>
                                                                            <td className="font-medium text-gray-700">
                                                                                VAT{' '}
                                                                                {financialSettings.vat_type === 'Percentage'
                                                                                    ? `${financialSettings.vat_value ?? 0}%`
                                                                                    : '(Fixed Amount)'}
                                                                            </td>

                                                                            <td className="text-right">
                                                                                {vat !== null ? formatCurrency(vat) : '—'}
                                                                            </td>
                                                                            </tr>
                                                                        {/* 7. Total = SubTotal + VAT */}
                                                                        <tr>
                                                                            <td className="font-semibold text-gray-900 text-base">{t('shipmentsTotal')}</td>
                                                                            <td className="text-right font-bold text-gray-900">{formatCurrency(subtotal)}</td>
                                                                        </tr>
                                                                    </>
                                                                );
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Insurance */}
                                            <div className="border-t border-[#e5ecfb] py-6 mb-2">
                                                <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('createBookingInsuranceQuestion')}</h3>
                                                <div className="flex flex-col md:flex-row items-center gap-4">
                                                    {/* Insurance */}
                                                    <div className="w-full md:w-[48%]">
                                                        <div className="relative" ref={insuranceMenuRef}>
                                                            <div
                                                                className={`w-full rounded-full border ${errors.insurance ? 'border-red-500' : 'border-[#e5ecfb]'} bg-white px-4 py-3 text-sm flex items-center justify-between cursor-pointer`}
                                                                onClick={() => setShowInsuranceMenu((v) => !v)}
                                                            >
                                                                <span className={`truncate ${formData.insurance ? 'text-gray-900' : 'text-gray-400'}`}>
                                                                    {formData.insurance ? getInsuranceLabel(formData.insurance) : t('createBookingSelectInsurance')}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    aria-label={t('createBookingInsuranceMenuLabel')}
                                                                    className="ml-2 w-7 h-7 rounded-full border border-[#E6EAF3] flex items-center justify-center text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
                                                                    </svg>
                                                                </button>
                                                            </div>

                                                            {showInsuranceMenu && (
                                                                <div className="absolute left-0 mt-2 z-40 w-full">
                                                                    <Menu
                                                                        items={insuranceItems}
                                                                        onItemClick={(item) => {
                                                                            handleInputChange('insurance', item.value);
                                                                            if (item.value === 'No') {
                                                                                setShowInsuranceWarningPopup(true);
                                                                            }
                                                                            setShowInsuranceMenu(false);
                                                                        }}
                                                                        anchorRef={insuranceMenuRef}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {errors.insurance && <p className="text-red-600 text-xs mt-1">{errors.insurance}</p>}
                                                    </div>

                                                    {/* Parcel Amount */}
                                                    <div className="w-full md:w-[48%] mb-0">
                                                        <input
                                                            type='text'
                                                            inputMode='decimal'
                                                            className={`w-full rounded-full bg-white px-4 py-4 text-sm border focus:outline-none focus:border-[#338DFF] ${errors.parcelAmount ? 'border-red-500' : 'border-[#e5ecfb]'}`}
                                                            placeholder={t('createBookingParcelAmountPlaceholder')}
                                                            value={formData.parcelAmount}
                                                            onChange={handleParcelAmountChange}
                                                            onKeyDown={(ev) => {
                                                                if (['e', 'E', '+', '-'].includes(ev.key)) ev.preventDefault();
                                                            }}
                                                            onPaste={(ev) => {
                                                                const pasted = (ev.clipboardData || window.clipboardData).getData('text');
                                                                if (/[-eE+]/.test(pasted)) ev.preventDefault();
                                                            }}
                                                        />
                                                        {errors.parcelAmount && <p className="text-red-600 text-xs mt-1">{errors.parcelAmount}</p>}
                                                    </div>
                                                </div>
                                            </div>



                                            {/* Parcel Details */}
                                            <div className="border-y border-[#e5ecfb] py-6">
                                                <h2 className="text-lg font-semibold text-gray-800 mb-6">{t('commonParcelDetails')}</h2>
                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600">
                                                    <div>
                                                        <p className="text-blue-500 uppercase text-xs font-bold">{t('commonConsignmentType')}</p>
                                                        <p className="font-semibold text-gray-800 mt-2">
                                                            {formData.consignmentType ? (
                                                                formData.consignmentType === 'Other Materials (must be specified)' && formData.consignmentTypeOther
                                                                    ? `${getConsignmentLabel(formData.consignmentType)}: ${formData.consignmentTypeOther}`
                                                                    : getConsignmentLabel(formData.consignmentType)
                                                            ) : t('commonNotSpecified')}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonSize')}</p>
                                                        <p className="font-semibold text-gray-800 mt-2">
                                                            {formData.size === 'custom'
                                                                ? `${t('commonCustom')} (${formData.customLength || '?'} × ${formData.customWidth || '?'} × ${formData.customHeight || '?'})`
                                                                : (selectedSize ? `${selectedSize.name}${(selectedSize.min_weight_kg || selectedSize.max_weight_kg) ? ` (${[selectedSize.min_weight_kg, selectedSize.max_weight_kg].filter(Boolean).join(' - ')} KGs)` : ''}` : t('commonNotSpecified'))
                                                            }
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-blue-500 uppercase text-xs font-bold">{t('commonWeight')}</p>
                                                        <p className="font-semibold text-gray-800 mt-2">{formData.customWeight || (selectedSize ? `${[selectedSize.min_weight_kg, selectedSize.max_weight_kg].filter(Boolean).join(' - ')} kg` : t('commonNotSpecified'))}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-blue-500 uppercase text-xs font-bold">{t('commonSender')}</p>
                                                        <p className="font-semibold text-gray-800 mt-2">{formData.senderName || t('commonNotSpecified')}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-blue-500 uppercase text-xs font-bold">{t('commonInsurance')}</p>
                                                        <p className="font-semibold text-gray-800 mt-2">{formData.insurance ? getInsuranceLabel(formData.insurance) : t('commonNotSpecified')}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-blue-500 uppercase text-xs font-bold">{t('commonScheduleTime')}</p>
                                                        <p className="font-semibold text-gray-800 mt-2">{formData.scheduleTime || t('commonNotSpecified')}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-6 border-t border-[#e5ecfb] pt-5">
                                                    <p className="text-sm font-semibold text-gray-700 mb-3">{t('commonPhotos')}</p>
                                                    <div className="flex gap-3">
                                                        {formData.photos?.length ? (
                                                            formData.photos.map((url, idx) => (
                                                                <div key={idx} className="w-16 h-16 rounded-xl overflow-hidden border border-[#e5ecfb]">
                                                                    <img src={url} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <>
                                                                <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden" />
                                                                <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden" />
                                                                <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden" />
                                                                <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden" />
                                                            </>
                                                        )}
                                                    </div>

                                                    {formData.additionalDocs?.length > 0 && (
                                                        <div className="mt-6">
                                                            <p className="text-sm font-semibold text-gray-700 mb-3">{t('commonAdditionalDocuments')}</p>
                                                            <div className="flex gap-3 flex-wrap">
                                                                {formData.additionalDocs.map((url, idx) => (
                                                                    <a
                                                                        key={idx}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-16 h-16 rounded-xl overflow-hidden border border-[#e5ecfb] flex items-center justify-center bg-blue-50 hover:bg-blue-100 transition-colors"
                                                                    >
                                                                        <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                        </svg>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Special Instruction in Review (only if set) */}
                                                {formData.specialInstruction?.trim() && (
                                                    <div className="mt-6 border-t border-[#e5ecfb] pt-6">
                                                        <p className="text-sm font-semibold text-gray-700 mb-3">{t('commonSpecialInstruction')}</p>
                                                        <div className="py-4 text-sm text-gray-600">
                                                            {formData.specialInstruction}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sender & Receiver Details (below Photos) */}
                                                <div className="mt-6 border-t border-[#e5ecfb] pt-6">
                                                    <div className="grid grid-cols-1 gap-8 text-sm text-gray-600">
                                                        {/* Sender */}
                                                        <div>
                                                            <h3 className="text-base font-semibold text-gray-800 mb-4">{t('commonSenderDetails')}</h3>
                                                            <div className="grid grid-cols-2 gap-6">
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonName')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.senderName || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonContact')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.senderPhone || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonEmail')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.senderEmail || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonNearestLandmark')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.senderLandmark || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonBuildingName')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.senderBuilding || '-'}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Receiver */}
                                                        <div className="pt-6 mt-2 border-t border-[#e5ecfb]">
                                                            <h3 className="text-base font-semibold text-gray-800 mb-4">{t('commonReceiverDetails')}</h3>
                                                            <div className="grid grid-cols-2 gap-6">
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonName')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.receiverName || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonContact')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.receiverPhone || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonEmail')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.receiverEmail || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonNearestLandmark')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.receiverLandmark || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-blue-500 uppercase text-xs font-semibold">{t('commonBuildingName')}</p>
                                                                    <p className="font-semibold text-gray-800 mt-2">{formData.receiverBuilding || '-'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="h-30 md:hidden">
                                                            <div className="text-lg text-[#7F7F7F] sm:hidden">
                                                                <label className="flex items-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                                                                        required
                                                                        checked={termsAccepted}
                                                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                                                    />
                                                                    <span>
                                                                        <a
                                                                            href="/customer/terms-and-conditions"
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-600 hover:text-blue-800 underline"
                                                                            onClick={handleTermsLinkClick}
                                                                        >
                                                                            {t('createBookingAcceptTerms')}
                                                                        </a>
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-lg text-[#7F7F7F] hidden sm:block">
                                                <label className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                                                        required
                                                        checked={termsAccepted}
                                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                                    />
                                                    <span>
                                                        <a
                                                            href="/customer/terms-and-conditions"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-800 underline"
                                                            onClick={handleTermsLinkClick}
                                                        >
                                                            {t('createBookingAcceptTerms')}
                                                        </a>
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer actions */}
                                    <div className="mt-6 md:flex items-center justify-end gap-3 hidden ">
                                        {step !== 'courier' && (
                                            <button
                                                type="button"
                                                onClick={back}
                                                className="h-[52px] hidden md:block px-6 rounded-full border-2 border-[#338DFF] text-blue-500 font-bold cursor-pointer"
                                            >
                                                {t('commonBack')}
                                            </button>
                                        )}
                                        {step === 'review' ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (formData.insurance == "Yes" && !formData.parcelAmount) {
                                                        showNotification(t("createBookingGoodsAmountRequiredError"), "error");
                                                        return;
                                                    }
                                                    setCheckoutOpen(true)
                                                }}
                                                disabled={isBookNowDisabled}
                                                className={`h-[52px] w-full md:w-auto px-5 rounded-full shadow-lg border-2 font-bold ${isBookNowDisabled
                                                    ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed'
                                                    : 'bg-[#338DFF] text-white border-[#338DFF] hover:bg-white hover:text-blue-500 cursor-pointer'
                                                    }`}
                                            >
                                                {t('bookingBookNow')}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={next}
                                                className="h-[52px] px-6 rounded-full text-white shadow border-2 font-bold bg-[#338DFF] border-[#338DFF] hover:bg-white hover:text-blue-500 cursor-pointer"
                                            >
                                                {t('commonContinue')}
                                            </button>
                                        )}
                                    </div>
                                    <div className="w-full backdrop-blur py-2 mt-4 fixed bottom-2 flex items-center justify-end gap-3 md:hidden ">
                                        {step === 'review' ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (formData.insurance == "Yes" && !formData.parcelAmount) {
                                                        showNotification(t("createBookingGoodsAmountRequiredError"), "error");
                                                        return;
                                                    }  
                                                    setCheckoutOpen(true)
                                                }}
                                                disabled={isBookNowDisabled}
                                                className={`h-[52px] w-full md:w-auto px-5 rounded-full shadow-lg border-2 font-bold ${isBookNowDisabled
                                                    ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed'
                                                    : 'bg-[#338DFF] text-white border-[#338DFF] hover:bg-white hover:text-blue-500 cursor-pointer'
                                                    }`}
                                            >
                                                {t('bookingBookNow')}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={next}
                                                className="h-[52px] w-full px-6 rounded-full text-white shadow border-2 font-bold bg-[#338DFF] border-[#338DFF] hover:bg-white hover:text-blue-500 cursor-pointer"
                                            >
                                                {t('commonContinue')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main >
            </div >
            {/* Checkout Drawer */}
            {
                checkoutOpen && (
                    <div className="fixed inset-0 z-40">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setCheckoutOpen(false)}></div>
                        <div className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-2xl">
                            <div className="h-full flex flex-col">
                                <div className="px-6 py-5 border-b border-[#eef2ff] flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-gray-900">{t('createBookingCheckoutTitle')}</h2>
                                    <button className="text-gray-500 hover:text-gray-700" onClick={() => setCheckoutOpen(false)} aria-label={t('commonClose')}>
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="px-6 py-5 space-y-6 overflow-y-auto">
                                    {/* <div className="flex items-center gap-4 bg-[#eef5ff] border border-[#dbe3f5] rounded-2xl px-4 py-3">
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#e5ecfb]">
                                            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-blue-500 font-semibold">{t('createBookingCheckoutShipmentFee')}</p>
                                            <p className="text-sm text-gray-600">{t('createBookingCheckoutShipmentFeeDesc')}</p>
                                        </div>
                                        <div className="text-right">
                                            {(() => {
                                                const totalValue = computeTotals(shippingFee, shipmentFeeToggle).senderPaysAmount;
                                                return (
                                                    <>
                                                        <div className="text-gray-900 font-semibold">{totalValue !== null ? Number(totalValue).toLocaleString('en-US') : '—'}</div>
                                                        <div className="text-[11px] text-gray-500">SYP</div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div> */}

                                    {/* Fee Payer Section */}
                                    <div className="flex items-center gap-4 bg-[#eef5ff] border border-[#dbe3f5] rounded-2xl px-4 py-3">
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#e5ecfb]">
                                            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-blue-500 font-semibold">{t('createBookingCheckoutShipmentFee')}</p>
                                        </div>
                                        <div className="text-right">
                                            {(() => {
                                                const { shipmentFee } = computeTotals(shippingFee, shipmentFeeToggle);
                                                const displayFee = (shipmentFee !== null && shipmentFee !== 0) ? shipmentFee : shippingFee;
                                                return (
                                                    <>
                                                        <div className="text-gray-900 font-semibold">{displayFee !== null ? Number(displayFee).toLocaleString('en-US') : '—'}</div>
                                                        <div className="text-[11px] text-gray-500">SYP</div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 mb-3">{t('createBookingWhoPaysDelivery')}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, deliveryFeePayer: 'sender' }))}
                                                className={`rounded-xl px-4 py-3 border text-left flex items-center gap-3 transition-colors ${formData.deliveryFeePayer === 'sender'
                                                    ? 'border-blue-500 bg-white ring-1 ring-blue-500'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.deliveryFeePayer === 'sender' ? 'border-blue-500' : 'border-gray-300'
                                                    }`}>
                                                    {formData.deliveryFeePayer === 'sender' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                </div>
                                                <span className="font-medium text-gray-900">{t('commonSender')}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, deliveryFeePayer: 'receiver' }))}
                                                className={`rounded-xl px-4 py-3 border text-left flex items-center gap-3 transition-colors ${formData.deliveryFeePayer === 'receiver'
                                                    ? 'border-blue-500 bg-white ring-1 ring-blue-500'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.deliveryFeePayer === 'receiver' ? 'border-blue-500' : 'border-gray-300'
                                                    }`}>
                                                    {formData.deliveryFeePayer === 'receiver' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                </div>
                                                <span className="font-medium text-gray-900">{t('commonReceiver')}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Return Fee Payer Section - Conditional */}
                                    {formData.acceptReturns && (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 mb-3">{t('createBookingWhoPaysReturnDelivery')}</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, returnDeliveryFeePayer: 'sender' }))}
                                                    className={`rounded-xl px-4 py-3 border text-left flex items-center gap-3 transition-colors ${formData.returnDeliveryFeePayer === 'sender'
                                                        ? 'border-blue-500 bg-white ring-1 ring-blue-500'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.returnDeliveryFeePayer === 'sender' ? 'border-blue-500' : 'border-gray-300'
                                                        }`}>
                                                        {formData.returnDeliveryFeePayer === 'sender' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                    </div>
                                                    <span className="font-medium text-gray-900">{t('commonSender')}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, returnDeliveryFeePayer: 'receiver' }))}
                                                    className={`rounded-xl px-4 py-3 border text-left flex items-center gap-3 transition-colors ${formData.returnDeliveryFeePayer === 'receiver'
                                                        ? 'border-blue-500 bg-white ring-1 ring-blue-500'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.returnDeliveryFeePayer === 'receiver' ? 'border-blue-500' : 'border-gray-300'
                                                        }`}>
                                                        {formData.returnDeliveryFeePayer === 'receiver' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                    </div>
                                                    <span className="font-medium text-gray-900">{t('commonReceiver')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 bg-[#eef5ff] border border-[#dbe3f5] rounded-2xl px-4 py-3">
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#e5ecfb]">
                                            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-blue-500 font-semibold">{t('createBookingCheckoutSenderAmount')}</p>
                                            <p className="text-sm text-gray-600">{t('createBookingCheckoutSenderAmountDesc')}</p>
                                        </div>
                                        <div className="text-right">
                                            {(() => {
                                                const totalValue = computeTotals(shippingFee, shipmentFeeToggle).senderPaysAmountWithRDF;
                                                return (
                                                    <>
                                                        <div className="text-gray-900 font-semibold">{totalValue !== null ? Number(totalValue).toLocaleString('en-US') : '—'}</div>
                                                        <div className="text-[11px] text-gray-500">SYP</div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 bg-[#eef5ff] border border-[#dbe3f5] rounded-2xl px-4 py-3">
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#e5ecfb]">
                                            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-blue-500 font-semibold">{t('createBookingCheckoutReceiverAmount')}</p>
                                            <p className="text-sm text-gray-600 ">{t('createBookingCheckoutReceiverAmountDesc')}</p>
                                        </div>
                                        <div className="text-right">
                                            {(() => {
                                                const totalValue = computeTotals(shippingFee, shipmentFeeToggle).receiverPaysAmount;
                                                return (
                                                    <>
                                                        <div className="text-gray-900 font-semibold">{totalValue !== null ? Number(totalValue).toLocaleString('en-US') : '—'}</div>
                                                        <div className="text-[11px] text-gray-500">SYP</div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    {computeTotals(shippingFee, shipmentFeeToggle).senderPaysAmountWithRDF > 0 && <div>
                                        <p className="text-sm font-semibold text-gray-800 mb-3">{t('commonPaymentMethod')}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setPaymentMethod('online')} className={`rounded-xl px-4 py-3 border text-left flex items-center gap-3 transition-colors ${paymentMethod === 'online' ? 'border-[#338DFF] bg-white ring-1 ring-[#338DFF]' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'online' ? 'border-[#338DFF]' : 'border-gray-300'}`}>
                                                    {paymentMethod === 'online' && <div className="w-2 h-2 rounded-full bg-[#338DFF]" />}
                                                </div>
                                                <span className="font-medium text-gray-800">{t('paymentMethodOnline')}</span>
                                            </button>
                                            <button type="button" onClick={() => setPaymentMethod('cash')} className={`rounded-xl px-4 py-3 border text-left flex items-center gap-3 transition-colors ${paymentMethod === 'cash' ? 'border-[#338DFF] bg-white ring-1 ring-[#338DFF]' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'cash' ? 'border-[#338DFF]' : 'border-gray-300'}`}>
                                                    {paymentMethod === 'cash' && <div className="w-2 h-2 rounded-full bg-[#338DFF]" />}
                                                </div>
                                                <span className="font-medium text-gray-800">{t('paymentMethodCash')}</span>
                                            </button>
                                        </div>
                                    </div>}

                                    {paymentMethod === 'online' && (
                                        <OnlinePaymentGatewayForm
                                            t={t}
                                            provider={onlineProvider}
                                            step={onlineStep}
                                            phone={onlinePhone}
                                            otp={otpCode}
                                            error={paymentError}
                                            onProviderChange={(provider) => {
                                                setOnlineProvider(provider);
                                                setOnlineStep('phone');
                                                setPaymentError('');
                                            }}
                                            onPhoneChange={setOnlinePhone}
                                            onOtpChange={setOtpCode}
                                            onResendOtp={
                                                onlineProvider === 'syriatel' && onlineStep === 'otp'
                                                    ? handleResendSyriatelOtp
                                                    : null
                                            }
                                        />
                                    )}

                                </div>

                                <div className="mt-auto p-4 border-t border-[#eef2ff]">
                                    <button
                                        type="button"
                                        onClick={handleConfirmPayment}
                                        disabled={submitting}
                                        aria-busy={submitting}
                                        className={`w-full h-[46px] rounded-full text-white font-semibold shadow transition ${submitting ? 'bg-[#7fb5ff] cursor-not-allowed opacity-70' : 'bg-[#338DFF]'}`}
                                    >
                                        {(() => {
                                            if (submitting) {
                                                return (
                                                    <span className="inline-flex items-center gap-2">
                                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                                        </svg>
                                                        {t('commonSubmitting')}
                                                    </span>
                                                );
                                            }

                                            if (paymentMethod === 'online' && (onlineProvider === 'mtn' || onlineProvider === 'syriatel') && onlineStep === 'otp') {
                                                return t('onlinePaymentVerifyButton');
                                            }

                                            if (paymentMethod === 'online') {
                                                const totals = computeTotals(shippingFee, shipmentFeeToggle);
                                                const senderAmount = totals.senderPaysAmountWithRDF;
                                                const formatted = senderAmount !== null && senderAmount !== undefined ? formatCurrency(senderAmount) : '—';
                                                return `${t('commonPay')} (${formatted})`;
                                            }

                                            return t('commonSubmit');
                                        })()}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {notification && (
                <div className={`fixed top-4 right-4 z-[9999] px-6 py-4 rounded-lg shadow-lg text-white transition-all animate-fade-in ${
                    notification.type === 'info' ? 'bg-blue-500' :
                    notification.type === 'success' ? 'bg-green-500' :
                    notification.type === 'error' ? 'bg-red-500' :
                    'bg-blue-500'
                }`}>
                    <div className="flex items-center gap-3">
                        <span>{notification.message}</span>
                    </div>
                </div>
            )}
            {showPopup && (
                <Popup
                    title={t('createBookingSuccessTitle')}
                    message={t('createBookingSuccessMessage')}
                    buttonLabel={t('createBookingNewOrderButton')}
                    onConfirm={() => {
                        setShowPopup(false);
                        window.location.href = '/customer/dashboard';
                    }}
                    secondaryButtonLabel={t('commonTrackOrder')}
                    onSecondaryConfirm={() => {
                        setShowPopup(false);
                        if (newShipmentId) {
                            window.location.href = `/customer/sending-parcels/${newShipmentId}`;
                        } else {
                            window.location.href = '/customer/sending-parcels';
                        }
                    }}
                />
            )}
            {showInsuranceWarningPopup && (
                <Popup
                    title={t('commonInsuranceNotice')}
                    message={t('commonMaxCompensationMessage', {
                        value: insuranceCompensationValue,
                    })}
                    buttonLabel={t('commonClose')}
                    onConfirm={() => setShowInsuranceWarningPopup(false)}
                    loopAnimation={false}
                />
            )}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
                    <div className="bg-white w-full sm:max-w-2xl sm:rounded-lg rounded-t-lg flex flex-col max-h-[90vh]">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center flex-shrink-0">
                            <h2 className="text-lg font-semibold text-gray-800">{t('createBookingAcceptTerms')}</h2>
                            <button
                                onClick={() => setShowTermsModal(false)}
                                className="text-gray-500 hover:text-gray-700 text-2xl leading-none flex-shrink-0"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <TermsAndConditions isModal={true} />
                        </div>
                        <div className="border-t border-gray-200 px-4 py-3 flex gap-3 flex-shrink-0 bg-gray-50">
                            <button
                                onClick={() => setShowTermsModal(false)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                            >
                                {t('commonClose')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

}
