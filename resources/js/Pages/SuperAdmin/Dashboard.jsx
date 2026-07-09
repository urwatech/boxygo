import React, { useEffect, useMemo, useRef, useState } from 'react';
import SuperAdminAuthenticated from '../Layouts/SuperAdminAuthenticated';
import { Head, router } from '@inertiajs/react';
import Menu from '../../Components/Common/Menu';
import StatsCard from './Components/StatsCard';
import QRCode from '../../Components/Shared/QRCode';
import Table from '../../Components/Common/Table';
import Card from '../../Components/Common/Card';
import PrimaryButton from './Components/PrimaryButton';
import OutlineButton from './Components/OutlineButton';
import HeatmapWidget from '../../Components/Common/HeatmapWidget';
import Drawer from './Components/Drawer';
import ImagePreviewGallery from '../../Components/Customer/ImagePreviewGallery';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFirebaseFirestore } from '../../firebase';

const DETAIL_STATUS_STYLES = {
    amber: 'bg-amber-50 text-amber-500 border border-amber-500',
    blue: 'bg-blue-50 text-blue-500 border border-blue-500',
    green: 'bg-green-50 text-green-600 border border-green-600',
};

const toHumanPaymentMethod = (method, t) => {
    if (!method) {
        return '--';
    }

    const normalized = String(method).trim().toLowerCase();
    if (normalized === 'cash' || normalized === 'cod' || normalized === 'cash_on_delivery') {
        return t('paymentMethodCod');
    }

    if (normalized === 'online' || normalized === 'card' || normalized === 'bank') {
        return t('paymentMethodOnlineAdmin');
    }

    return method;
};

const formatTimelineTimestamp = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

    return `${time}, ${day.replace(/\s+/g, ' ')}`;
};

const resolveStageIndexFromStatus = (status, isDirect, stageCount) => {
    if (!status) return null;

    const normalized = String(status).toLowerCase().replace(/\s+/g, '_');

    if (isDirect) {
        if (normalized.includes('delivered') || normalized.includes('completed')) {
            return Math.min(stageCount - 1, 4);
        }

        if (normalized.includes('out_for_delivery') || normalized.includes('out-for-delivery')) {
            return 3;
        }

        if (normalized.includes('in_transit') || normalized.includes('in-transit') || normalized.includes('transit')) {
            return 3;
        }

        if (
            normalized.includes('picked_up')
            || normalized.includes('pickup')
            || normalized.includes('collected')
        ) {
            return 1;
        }

        if (normalized.includes('assigned') || normalized.includes('ready_for_pickup')) {
            return 0;
        }
    }

    return null;
};

const collectStageTimestamps = (history, isDirect, stageCount, statuses = []) => {
    if (!Array.isArray(history) || stageCount <= 0) {
        return Array(Math.max(stageCount, 0)).fill(null);
    }

    const stageDates = Array(stageCount).fill(null);
    const sortedHistory = [...history].sort((a, b) => {
        const aTime = new Date(a?.created_at ?? a?.createdAt ?? 0).getTime();
        const bTime = new Date(b?.created_at ?? b?.createdAt ?? 0).getTime();
        return aTime - bTime;
    });

    sortedHistory.forEach((entry) => {
        if (!entry) {
            return;
        }

        const progressIndexRaw = entry?.progress_index ?? entry?.progressIndex;
        let stageIndex = Number(progressIndexRaw);
        if (Number.isFinite(stageIndex)) {
            stageIndex -= 1; // convert to 0-based
        } else {
            const toStatus = entry?.to_status ?? entry?.toStatus ?? '';
            stageIndex = statuses.findIndex((s) => s === toStatus);
            if (stageIndex === -1) {
                stageIndex = resolveStageIndexFromStatus(toStatus, isDirect, stageCount);
            }
        }

        if (
            typeof stageIndex === 'number'
            && stageIndex >= 0
            && stageIndex < stageCount
            && !stageDates[stageIndex]
        ) {
            stageDates[stageIndex] = entry?.created_at ?? entry?.createdAt ?? null;
        }
    });

    return stageDates;
};

const parseCurrencyValue = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]+/g, '');
        const parsed = Number.parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

const clampRatingValue = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return 0;
    }
    return Math.max(0, Math.min(5, Math.round(numericValue)));
};

const mapReviewDetails = (review, t) => {
    if (!review) {
        return null;
    }

    const metrics = [
        { label: t('superAdminRatingsBehaviorTag'), score: clampRatingValue(review?.rider_behavior) },
        { label: t('commonOnTimeDelivery'), score: clampRatingValue(review?.on_time_delivery) },
        { label: t('superAdminRatingsPriceTag'), score: clampRatingValue(review?.affordability) },
    ];

    const comment = review?.comment?.trim() ? review.comment.trim() : null;

    return {
        comment,
        metrics,
    };
};

const normalizeDeliverySpeedKey = (value) => {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized.startsWith('direct')) {
        return 'direct';
    }
    if (normalized.startsWith('in') || normalized.includes('indirect')) {
        return 'indirect';
    }
    return 'direct';
};

const normalizeDeliverySpeedMode = (value) => {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    if (normalized.includes('both') || normalized.includes('direct+indirect') || normalized.includes('direct + indirect')) {
        return 'both';
    }

    if (
        normalized.includes('indirect')
        || normalized.includes('in_direct')
        || normalized.includes('in-direct')
        || normalized.includes('dp')
    ) {
        return 'indirect';
    }

    if (normalized.includes('direct') || normalized.includes('dd')) {
        return 'direct';
    }

    return null;
};

const riderSupportsDeliveryMode = (riderMode, jobMode) => {
    if (!jobMode) {
        return true;
    }
    if (!riderMode) {
        return false;
    }
    if (riderMode === 'both') {
        return true;
    }
    return riderMode === jobMode;
};

const buildVatLabel = (financialSettings = {}, t) => {
    const rawType = financialSettings?.vat_type;
    const normalizedType = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';

    if (normalizedType === 'percentage') {
        const rawValue = financialSettings?.vat_value;
        const cleanedValue = rawValue == null
            ? ''
            : String(rawValue).replace('%', '').trim();
        const suffix = cleanedValue ? `${cleanedValue}%` : '%';
        return `${t('commonVat')} ${suffix}`;
    }

    if (rawType) {
        return `${t('commonVat')} (${rawType})`;
    }

    return t('commonVat');
};

const parseVatNumericValue = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]+/g, '');
        const parsed = Number.parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const parseVatRate = (value, defaultRate = 0.05) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : defaultRate;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return defaultRate;
        }

        if (trimmed.includes('%')) {
            const numeric = parseVatNumericValue(trimmed);
            return numeric != null ? numeric / 100 : defaultRate;
        }

        const numeric = parseVatNumericValue(trimmed);
        return numeric != null ? numeric : defaultRate;
    }

    return defaultRate;
};

const calculateVatAmount = ({
    shipmentFee = 0,
    goodsAmount = 0,
    financialSettings = {},
    fallbackVatRate = 0.05,
}) => {
    /*
    const baseAmount = (Number(shipmentFee) || 0) + (Number(goodsAmount) || 0);
    */
    const baseAmount = (Number(shipmentFee) || 0);
    const vatTypeRaw = financialSettings?.vat_type;
    const vatValueRaw = financialSettings?.vat_value;
    const normalizedType = typeof vatTypeRaw === 'string' ? vatTypeRaw.trim().toLowerCase() : '';
    const numericVatValue = parseVatNumericValue(vatValueRaw);

    if (normalizedType === 'percentage' && numericVatValue != null) {
        return Math.round(baseAmount * (numericVatValue / 100));
    }

    if (normalizedType && normalizedType !== 'percentage' && numericVatValue != null) {
        return Math.round(numericVatValue);
    }

    const rate = parseVatRate(fallbackVatRate, 0.05);
    return Math.round(baseAmount * rate);
};

const isRiderAvailable = (rider) => {
    if (!rider) {
        return false;
    }

    const statusKey = rider.statusKey ?? rider.status_key;
    return statusKey === 'available' && rider.availability === 'online';
};

const createInitialZoneLookupState = () => ({
    status: 'idle',
    zoneId: null,
    zoneName: null,
    error: null,
    fromCoordinates: false,
});

const formatAdminNotesPreview = (value, limit = 60) => {
    if (value === null || value === undefined) {
        return '--';
    }

    const text = String(value).trim();
    if (!text) {
        return '--';
    }

    if (text.length <= limit) {
        return text;
    }

    const clipped = text.slice(0, limit).trimEnd();
    return `${clipped} (...)`;
};

const formatExportCurrency = (value, t) => {
    const parsed = parseCurrencyValue(value);
    if (parsed == null) {
        return '';
    }

    return `${parsed} ${t('commonCurrencySyp')}`;
};

const resolveJobConsignmentDetails = (job, t) => {
    if (!job) {
        return {
            consignmentType: '',
            size: '',
            weight: '',
            value: '',
            insurance: '',
            paymentMethod: '',
            acceptReturns: '',
        };
    }

    const rawSize = job.sizeText
        ?? (typeof job.size === 'object' ? job.size?.name : job.size)
        ?? '';
    const rawWeight = job.weightText
        ?? (job.weight != null && job.weight !== '' ? `${job.weight} ${t('superAdminDashboardWeightUnitKg')}` : '')
        ?? '';
    const rawValue = parseCurrencyValue(job.valueText ?? job.totalFee ?? job.raw?.parcel_amount);
    const acceptReturns = job.raw?.accept_returns === 1
        || job.raw?.accept_returns === true
        || job.raw?.accept_returns === '1';

    return {
        consignmentType: job.consignmentType ?? job.shipmentType ?? '',
        size: rawSize,
        weight: rawWeight,
        value: rawValue != null ? formatExportCurrency(rawValue, t) : '',
        insurance: job.insuranceText ?? job.insurance ?? '',
        paymentMethod: toHumanPaymentMethod(job.paymentMethod ?? job.raw?.payment_method, t),
        acceptReturns: acceptReturns ? t('commonYes') : t('commonNo'),
    };
};

const resolveJobPaymentSummary = (job, t) => {
    if (!job) {
        return {
            shipmentFee: '',
            senderZoneDeliveryFee: '',
            receiverZoneDeliveryFee: '',
            isDirectDelivery: true,
            goodsAmount: '',
            insuranceFee: '',
            subtotal: '',
            platformFee: '',
            vat: '',
            total: '',
        };
    }

    const paymentDetails = job.payment ?? job.raw?.payment ?? {};
    const shipmentFee = parseCurrencyValue(paymentDetails.shipment_fee) ?? 0;
    const senderZoneDeliveryFee =
        parseCurrencyValue(paymentDetails.sender_zone_delivery_fee ?? job.sender_zone_delivery_fee ?? job.raw?.sender_zone_delivery_fee) ?? 0;
    const receiverZoneDeliveryFee =
        parseCurrencyValue(paymentDetails.reciever_zone_delivery_fee ?? job.reciever_zone_delivery_fee ?? job.raw?.reciever_zone_delivery_fee) ?? 0;
    const goodsAmount = parseCurrencyValue(paymentDetails.goods_amount) ?? 0;
    const serviceFee = parseCurrencyValue(paymentDetails.service_fee ?? job.service_fee ?? job.raw?.service_fee) ?? 0;
    const insuranceFee = parseCurrencyValue(paymentDetails.insurance_fee) ?? 0;
    const platformFee = parseCurrencyValue(paymentDetails.platform_fee) ?? 0;
    const vatAmount = parseCurrencyValue(paymentDetails.vat_amount) ?? parseCurrencyValue(job.vat_amount) ?? 0;
    const subtotal = shipmentFee + goodsAmount + insuranceFee + serviceFee;
    const total = subtotal + platformFee + vatAmount;
    const deliverySpeedKey = normalizeDeliverySpeedKey(
        job.deliverySpeed ?? job.raw?.delivery_speed ?? job.shipmentType,
    );

    return {
        shipmentFee: formatExportCurrency(shipmentFee, t),
        senderZoneDeliveryFee: formatExportCurrency(senderZoneDeliveryFee, t),
        receiverZoneDeliveryFee: formatExportCurrency(receiverZoneDeliveryFee, t),
        isDirectDelivery: deliverySpeedKey === 'direct',
        goodsAmount: formatExportCurrency(goodsAmount, t),
        serviceFee: formatExportCurrency(serviceFee, t),
        insuranceFee: formatExportCurrency(insuranceFee, t),
        subtotal: formatExportCurrency(subtotal, t),
        platformFee: formatExportCurrency(platformFee, t),
        vat: formatExportCurrency(vatAmount, t),
        total: formatExportCurrency(total, t),
    };
};

const resolveJobNotes = (job) => {
    if (!job) {
        return '';
    }

    return [
        job.specialInstruction,
        job.adminNotes,
    ]
        .map((value) => (value == null ? '' : String(value).trim()))
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .join(' | ');
};

const toCollectionArray = (source) => {
    if (Array.isArray(source)) {
        return source;
    }

    if (Array.isArray(source?.data)) {
        return source.data;
    }

    if (Array.isArray(source?.items)) {
        return source.items;
    }

    if (Array.isArray(source?.results)) {
        return source.results;
    }

    return [];
};



const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
const DASHBOARD_REFRESH_INTERVAL = 1000;

export default function Dashboard({ auth, stats: backendStats = {}, shipments: backendShipments = [], riders: backendRiders = [], heatmapShipments = [], heatmapRiders = [], financialSettings = {} }) {
    const { t: rawT } = useTranslation();
    const t = (key, options) => {
        const translated = rawT(key, options);

        if (translated !== key || typeof key !== 'string' || !key.startsWith('superAdminDashboard')) {
            return translated;
        }

        const explicitFallbacks = {
            superAdminDashboardViewDetail: 'View Details',
            superAdminDashboardAssignButton: 'Assign',
        };

        if (explicitFallbacks[key]) {
            return explicitFallbacks[key];
        }

        return key
            .replace(/^superAdminDashboard/, '')
            .replace(/([A-Z])/g, ' $1')
            .replace(/\bId\b/g, 'ID')
            .replace(/\bQr\b/g, 'QR')
            .trim();
    };
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [sortBy, setSortBy] = useState('Date');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const sortTriggerRef = useRef(null);
    const sortMenuRef = useRef(null);
    const exportTriggerRef = useRef(null);
    const exportMenuRef = useRef(null);
    const pollingInFlightRef = useRef(false);
    const [showAssignDrawer, setShowAssignDrawer] = useState(false);
    const [showRidersModal, setShowRidersModal] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [showDetailDrawer, setShowDetailDrawer] = useState(false);
    const [detailJob, setDetailJob] = useState(null);
    const [adminNotesInput, setAdminNotesInput] = useState('');
    const [savingAdminNotes, setSavingAdminNotes] = useState(false);
    const [riderSearch, setRiderSearch] = useState('');
    const [selectedRiderId, setSelectedRiderId] = useState(null);
    const [selectedDeliveryRiderId, setSelectedDeliveryRiderId] = useState(null);
    const [assignStep, setAssignStep] = useState('pickup'); // 'pickup' | 'delivery'
    const [isDeliveryRiderModal, setIsDeliveryRiderModal] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [sendRiderSms, setSendRiderSms] = useState(true);
    const [unassigning, setUnassigning] = useState(false);
    const [showUnassignModal, setShowUnassignModal] = useState(false);
    const [unassignTarget, setUnassignTarget] = useState(null);
    const [notification, setNotification] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [jobZoneLookup, setJobZoneLookup] = useState(() => createInitialZoneLookupState());
    const [dropPointZoneLookup, setDropPointZoneLookup] = useState(() => createInitialZoneLookupState());
    const shipmentCollection = useMemo(() => toCollectionArray(backendShipments), [backendShipments]);
    const riderCollection = useMemo(() => toCollectionArray(backendRiders), [backendRiders]);

    useEffect(() => {
        const firestore = getFirebaseFirestore();
        if (!firestore) {
            return undefined;
        }
        const ridersRef = collection(firestore, 'tracking');
        const unsubscribe = onSnapshot(
            ridersRef,
            (snapshot) => {
                const allRiders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            },
            (error) => {
                console.error("Error fetching tracking data:", error);
            }
        );

        return () => unsubscribe();
    }, []);

    // useEffect(() => {
    //     if (!showSuccessModal) {
    //         return undefined;
    //     }

    //     const timeoutId = setTimeout(() => {
    //         setShowSuccessModal(false);
    //     }, 1500);

    //     return () => clearTimeout(timeoutId);
    // }, [showSuccessModal]);

    const showNotification = (message, type = 'info', duration = 4000) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), duration);
    };

    const userPermissions = Array.isArray(auth?.permissions) ? auth.permissions : [];

    const hasPermission = (permission) => {
        if (!permission) {
            return true;
        }

        const permissionsToCheck = Array.isArray(permission) ? permission : [permission];

        return permissionsToCheck.some((perm) => userPermissions.includes(perm));
    };

    const closeDetailDrawer = () => {
        setShowDetailDrawer(false);
        setDetailJob(null);
    };

    const stats = useMemo(() => [
        {
            title: t('statusInProgress'), value: String(backendStats.in_progress || 0),
            subtitle: t('commonToday'), icon: '/assets/images/Parcel.svg', color: '#4F7DF9',
            isSpecialCard: true,
        },
        { title: t('superAdminDashboardStatNewBookings'), value: String(backendStats.new_bookings || 0), icon: '/assets/images/frame1000006149.svg', color: '#4F7DF9' },
        { title: t('statusDelayed'), value: String(backendStats.delayed || 0), icon: '/assets/images/frame1000006149.svg', color: '#4F7DF9' },
        { title: t('statusDelivered'), value: String(backendStats.delivered || 0), icon: '/assets/images/frame1000006158.svg', color: '#4F7DF9' },
    ], [backendStats]);

    const normalizeZoneId = (value) => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        return String(value);
    };

    const parseCoordinateValue = (value) => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    };

    const handleOpenAssignDrawer = (job) => {
        if (!job) {
            return;
        }

        const derivedZoneId = normalizeZoneId(
            job.zoneId
            ?? job.zone_id
            ?? job.raw?.zone_id
        );

        setJobZoneLookup(
            derivedZoneId
                ? {
                    status: 'success',
                    zoneId: derivedZoneId,
                    zoneName: null,
                    error: null,
                    fromCoordinates: false,
                }
                : createInitialZoneLookupState(),
        );

        setSelectedJob(job);
        setSelectedRiderId(null);
        setSelectedDeliveryRiderId(null);
        setAssignStep('pickup');
        setRiderSearch('');
        setSendRiderSms(true);
        setShowAssignDrawer(true);
        setShowRidersModal(false);
        setShowDetailDrawer(false);
        setDetailJob(null);
    };

    const handleCloseAssignDrawer = () => {
        setShowAssignDrawer(false);
        setShowRidersModal(false);
        setIsDeliveryRiderModal(false);
        setSelectedJob(null);
        setSelectedRiderId(null);
        setSelectedDeliveryRiderId(null);
        setAssignStep('pickup');
        setRiderSearch('');
        setJobZoneLookup(createInitialZoneLookupState());
        setDropPointZoneLookup(createInitialZoneLookupState());
    };

    const handleOpenDeliveryRiderModal = (job) => {
        if (!job) return;
        setSelectedJob(job);
        setSelectedDeliveryRiderId(null);
        setRiderSearch('');
        setSendRiderSms(true);
        setIsDeliveryRiderModal(true);
        setShowRidersModal(true);
        setShowDetailDrawer(false);
        setDetailJob(null);
    };

    const jobs = useMemo(() => shipmentCollection.map((shipment) => ({
        id: shipment.id,
        shipId: shipment.order_number ?? shipment.orderNumber ?? shipment.ship_id ?? shipment.shipId,
        zoneId: normalizeZoneId(shipment.zone_id ?? shipment.zoneId),
        rider: shipment.rider,
        riderRole: shipment.rider_role ?? (shipment.rider ? t('commonRider') : t('statusUnassigned')),
        riderRoleKey: shipment.rider_role_key ?? (shipment.rider ? 'rider' : 'unassigned'),
        riderPhone: shipment.rider_phone ?? shipment.riderPhone ?? '+963 (555) 123 0000',
        riderAvatar: shipment.rider_avatar ?? shipment.riderAvatar ?? null,
        deliveryRider: shipment.delivery_rider ?? shipment.deliveryRider ?? null,
        deliveryRiderId: shipment.delivery_rider_id ?? shipment.deliveryRiderId ?? null,
        deliveryRiderRole: shipment.delivery_rider_role ?? (shipment.delivery_rider ? t('commonRider') : t('statusUnassigned')),
        deliveryRiderPhone: shipment.delivery_rider_phone ?? shipment.deliveryRiderPhone ?? null,
        deliveryRiderAvatar: shipment.delivery_rider_avatar ?? shipment.deliveryRiderAvatar ?? null,
        deliveryFeePayer: shipment?.delivery_fee_payer ?? null,
        customerAvatar: shipment.customer_avatar ?? shipment.customerAvatar ?? null,
        customerName: shipment.customer_name ?? shipment.customerName ?? null,
        customerPhone: shipment.customer_phone ?? shipment.customerPhone ?? null,
        date: shipment.date,
        sender: shipment.sender,
        senderPhone: shipment.sender_phone ?? shipment.senderPhone ?? null,
        receiver: shipment.receiver,
        receiverPhone: shipment.receiver_phone ?? shipment.receiverPhone ?? null,
        receiverCity: shipment.receiver_city ?? shipment.receiverCity ?? shipment.receiver,
        shipmentType: shipment.shipment_type ?? shipment.shipmentType,
        deliverySpeed: shipment.delivery_speed ?? shipment.deliverySpeed,
        deliverySpeedDescription: shipment.delivery_speed_description ?? shipment.deliverySpeedDescription,
        senderDroppoint: shipment?.sender_drop_point?.name || "-",
        receiverDroppoint: shipment?.receiver_drop_point?.name || "-",
        isDiffCity: shipment?.is_diff_city ?? false,
        vehicleType: shipment.vehicle_type ?? shipment.vehicleType,
        status: shipment.status,
        statusColor: shipment.status_color ?? shipment.statusColor,
        action: shipment?.status == "Cancelled" || shipment?.status == "Incomplete" ? "View Detail" : shipment.action,
        pickupLocation: shipment.pickup_location ?? shipment.pickupLocation,
        dropoffLocation: shipment.dropoff_location ?? shipment.dropoffLocation,
        is_returned: shipment?.booking_type == "return",
        return_reason: shipment?.return_reason || null,
        return_images: shipment?.return_images || [],
        handoverLatitude: parseCoordinateValue(
            shipment.handover_latitude
            ?? shipment.raw?.handover_latitude
        ),
        handoverLongitude: parseCoordinateValue(
            shipment.handover_longitude
            ?? shipment.raw?.handover_longitude
        ),
        weightText: shipment.weight_text ?? shipment.weightText,
        sizeText: shipment.size_text ?? shipment.sizeText,
        valueText: shipment.value_text ?? shipment.valueText,
        insuranceText: shipment.insurance_text ?? shipment.insuranceText,
        paymentStatus: shipment.payment_status ?? shipment.paymentStatus,
        paymentMethod: shipment.payment_method ?? shipment.paymentMethod,
        totalFee: shipment.total_fee ?? shipment.totalFee ?? shipment.parcel_amount ?? shipment.parcelAmount,
        serviceFee: shipment.service_fee ?? shipment.serviceFee ?? null,
        platformFee: shipment.platform_fee ?? shipment.platform_fee_amount ?? shipment.platformFee,
        vatRate: shipment.vat_rate ?? shipment.vat_percentage ?? shipment.vatRate,
        photos: shipment.photos ?? [],
        additionalDocs: shipment.additional_docs ?? [],
        specialInstruction: shipment.special_instruction ?? shipment.notes ?? '',
        adminNotes: shipment.admin_notes ?? shipment.adminNotes ?? '',
        statusHistory: shipment.status_history ?? shipment.statusHistory ?? [],
        trackingEvents: shipment.tracking_events ?? shipment.trackingEvents ?? [],
        directStatus: shipment.direct_status ?? shipment.directStatus ?? null,
        indirectStatus: shipment.indirect_status ?? shipment.indirectStatus ?? null,
        consignmentType: shipment.consignment_type ?? shipment.consignmentType ?? shipment.shipment_type,
        returnStatus: shipment?.return_status || "--",
        size: shipment.size,
        weight: shipment.weight,
        insurance: shipment.insurance,
        review: shipment.review ?? null,
        raw: shipment,
        payment: shipment?.payment
    })), [shipmentCollection, t]);

    const riders = useMemo(() => riderCollection.map((r) => {
        const deliverySpeedMode = normalizeDeliverySpeedMode(
            r.delivery_speed_mode
            ?? r.deliverySpeedMode
            ?? r.shipment_type_key
            ?? r.shipment_type,
        ) ?? 'direct';

        const deliverySpeedLabel = r.delivery_speed_label
            ?? r.deliverySpeedLabel
            ?? (deliverySpeedMode === 'indirect'
                ? t('shipmentTypeIndirectDp')
                : deliverySpeedMode === 'both'
                ? t('superAdminDashboardDeliveryModeBoth')
                : t('shipmentTypeDirectDd'));

        const shipmentTypeKey = deliverySpeedMode === 'indirect'
            ? 'in_direct'
            : deliverySpeedMode === 'both'
            ? 'both'
            : 'direct';

        return {
            id: r.id,
            code: r.code,
            name: r.name,
            shipmentType: deliverySpeedLabel,
            shipmentTypeKey,
            deliverySpeedMode,
            deliverySpeedLabel,
            vehicleType: r.vehicle_type ?? t('superAdminDashboardVehicleBike'),
            estFreeTime: r.est_free_time ?? '--',
            estDeliveryTime: r.est_delivery_time ?? '--',
            status: r.status ?? t('commonAvailable'),
            statusKey: r.status_key ?? 'available',
            availability: r.availability ?? 'offline',
            zoneId: normalizeZoneId(r.zone_id ?? r.zoneId ?? null),
            zone_id: normalizeZoneId(r.zone_id ?? null),
            zoneIds: Array.isArray(r.zone_ids) ? r.zone_ids.map(String) : [],
        };
    }), [riderCollection, t]);

    useEffect(() => {
        if (!selectedJob) {
            setJobZoneLookup(createInitialZoneLookupState());
            return undefined;
        }

        const existingZoneId = normalizeZoneId(
            selectedJob.zoneId
            ?? selectedJob.zone_id
            ?? selectedJob.raw?.zone_id
        );

        if (existingZoneId) {
            setJobZoneLookup((current) => {
                if (current.zoneId === existingZoneId && current.status === 'success') {
                    return current;
                }
                return {
                    status: 'success',
                    zoneId: existingZoneId,
                    zoneName: current.zoneId === existingZoneId ? current.zoneName : null,
                    error: null,
                    fromCoordinates: false,
                };
            });
            return undefined;
        }

        const latitude = parseCoordinateValue(
            selectedJob.handoverLatitude
            ?? selectedJob.raw?.handover_latitude
        );
        const longitude = parseCoordinateValue(
            selectedJob.handoverLongitude
            ?? selectedJob.raw?.handover_longitude
        );

        if (latitude == null || longitude == null) {
            setJobZoneLookup({
                status: 'empty',
                zoneId: null,
                zoneName: null,
                error: 'Pickup location is missing coordinates.',
                fromCoordinates: true,
            });
            return undefined;
        }

        const controller = new AbortController();
        setJobZoneLookup({
            status: 'loading',
            zoneId: null,
            zoneName: null,
            error: null,
            fromCoordinates: true,
        });

        const fetchZone = async () => {
            try {
                const params = new URLSearchParams({
                    lat: latitude.toString(),
                    lon: longitude.toString(),
                });
                const response = await fetch(`/api/v1/zones/check?${params.toString()}`, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Failed to detect zone');
                }

                const payload = await response.json();
                if (payload?.exists && payload?.data?.id != null) {
                    setJobZoneLookup({
                        status: 'success',
                        zoneId: normalizeZoneId(payload.data.id),
                        zoneName: payload?.data?.name ?? null,
                        error: null,
                        fromCoordinates: true,
                    });
                    return;
                }

                setJobZoneLookup({
                    status: 'empty',
                    zoneId: null,
                    zoneName: null,
                    error: payload?.message ?? 'No zone found for this pickup location.',
                    fromCoordinates: true,
                });
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                setJobZoneLookup({
                    status: 'error',
                    zoneId: null,
                    zoneName: null,
                    error: 'Unable to determine pickup zone. Please try again.',
                    fromCoordinates: true,
                });
            }
        };

        fetchZone();

        return () => controller.abort();
    }, [selectedJob]);

    // Drop point zone detection is no longer needed
    // All riders (direct and indirect) are now filtered by pickup zone only

    const isDoorToDoorJob = (job) => job?.deliverySpeed === 'indirect'
        && (job?.raw?.indirect_delivery_mode ?? '') === 'door_to_door';

    const submitAssignment = () => {
        if (!selectedJob || !selectedRiderId) return;

        const picked = riders.find((r) => r.id === selectedRiderId);
        const available = isRiderAvailable(picked);
        if (!available) {
            showNotification(t('superAdminDashboardSelectedRiderUnavailable'), 'error');
            return;
        }

        const payload = { rider_id: selectedRiderId, send_rider_sms: sendRiderSms };

        setAssigning(true);
        router.patch(
            route('admin.shipments.assign-rider', selectedJob.id),
            payload,
            {
                preserveScroll: true,
                onFinish: () => setAssigning(false),
                onSuccess: (page) => {
                    handleCloseAssignDrawer();
                    const flashError = page?.props?.flash?.error;
                    if (flashError) {
                        setErrorMessage(flashError);
                        setShowErrorModal(true);
                    } else {
                        setShowSuccessModal(true);
                    }
                },
                onError: (errors) => {
                    handleCloseAssignDrawer();
                    const errMsg = errors?.rider || Object.values(errors)[0] || t('superAdminDashboardAssignRiderFailed');
                    setErrorMessage(errMsg);
                    setShowErrorModal(true);
                },
            },
        );
    };

    const submitDeliveryRiderAssignment = () => {
        if (!selectedJob || !selectedDeliveryRiderId) return;

        const picked = riders.find((r) => r.id === selectedDeliveryRiderId);
        if (!isRiderAvailable(picked)) {
            showNotification(t('superAdminDashboardSelectedDeliveryRiderUnavailable'), 'error');
            return;
        }

        const payload = { delivery_rider_id: selectedDeliveryRiderId, send_rider_sms: sendRiderSms };

        setAssigning(true);
        router.patch(
            route('admin.shipments.assign-delivery-rider', selectedJob.id),
            payload,
            {
                preserveScroll: true,
                onFinish: () => setAssigning(false),
                onSuccess: (page) => {
                    setShowRidersModal(false);
                    setIsDeliveryRiderModal(false);
                    setSelectedDeliveryRiderId(null);
                    setRiderSearch('');
                    const flashError = page?.props?.flash?.error;
                    if (flashError) {
                        setErrorMessage(flashError);
                        setShowErrorModal(true);
                    } else {
                        setShowSuccessModal(true);
                    }
                },
                onError: (errors) => {
                    setShowRidersModal(false);
                    setIsDeliveryRiderModal(false);
                    const errMsg = errors?.delivery_rider_id || Object.values(errors)[0] || t('superAdminDashboardAssignDeliveryRiderFailed');
                    setErrorMessage(errMsg);
                    setShowErrorModal(true);
                },
            },
        );
    };

    const handleUnassignRider = (job) => {
        if (!job || unassigning) return;
        setUnassignTarget(job);
        setShowUnassignModal(true);
    };

    const confirmUnassignRider = () => {
        if (!unassignTarget || unassigning) {
            setShowUnassignModal(false);
            return;
        }

        setUnassigning(true);
        router.patch(
            route('admin.shipments.unassign-rider', unassignTarget.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => setUnassigning(false),
                onSuccess: () => {
                    closeDetailDrawer();
                    showNotification(t('commonRiderUnassigned'), 'success');
                    setShowUnassignModal(false);
                    setUnassignTarget(null);
                },
                onError: (errors) => {
                    const errMsg = errors?.rider || Object.values(errors)[0] || t('superAdminDashboardUnassignRiderFailed');
                    showNotification(errMsg, 'error');
                    setShowUnassignModal(false);
                    setUnassignTarget(null);
                },
            },
        );
    };

    const handleAutoAssign = () => {
        if (!selectedJob) return;

        const resolvedZoneId = jobZoneLookup.zoneId;
        if (!resolvedZoneId) {
            const pendingMessage = jobZoneLookup.status === 'loading'
                ? 'Detecting pickup zone. Please wait...'
                : (jobZoneLookup.error ?? 'Pickup zone could not be determined for this shipment.');
            showNotification(pendingMessage, 'error');
            return;
        }

        const jobDeliveryMode = normalizeDeliverySpeedMode(
            selectedJob.deliverySpeed ?? selectedJob.shipmentType ?? selectedJob.consignmentType,
        );

        // Find the first available rider (online status) whose zone matches the shipment (when both exist)
        const availableRider = riders.find((r) => {
            if (!isRiderAvailable(r)) {
                return false;
            }

            const riderZoneId = normalizeZoneId(r.zoneId ?? r.zone_id);
            const riderZoneIds = r.zoneIds ?? [];
            if (riderZoneId !== resolvedZoneId && !riderZoneIds.includes(resolvedZoneId)) {
                return false;
            }

            if (!riderSupportsDeliveryMode(r.deliverySpeedMode, jobDeliveryMode)) {
                return false;
            }

            return true;
        });

        if (!availableRider) {
            showNotification(t('superAdminDashboardNoAvailableRiders'), 'info');
            return;
        }

        const payload = { rider_id: availableRider.id, send_rider_sms: sendRiderSms };

        setSelectedRiderId(availableRider.id);

        setAssigning(true);
        router.patch(
            route('admin.shipments.assign-rider', selectedJob.id),
            payload,
            {
                preserveScroll: true,
                onFinish: () => setAssigning(false),
                onSuccess: (page) => {
                    handleCloseAssignDrawer();
                    const flashError = page?.props?.flash?.error;
                    if (flashError) {
                        setErrorMessage(flashError);
                        setShowErrorModal(true);
                    } else {
                        setShowSuccessModal(true);
                    }
                },
                onError: (errors) => {
                    handleCloseAssignDrawer();
                    const errMsg = errors?.rider || Object.values(errors)[0] || t('superAdminDashboardAssignRiderFailed');
                    setErrorMessage(errMsg);
                    setShowErrorModal(true);
                },
            },
        );
    };

    const handleAdminNotesCancel = () => {
        setAdminNotesInput(resolvedDetailAdminNotes);
        setShowDetailDrawer(false);
        setDetailJob(null);
    };

    const handleAdminNotesUpdate = () => {
        if (!detailJob || savingAdminNotes || !adminNotesDirty) {
            return;
        }
        const shipmentId = detailJob.id ?? detailJob?.raw?.id;
        if (!shipmentId) {
            return;
        }

        setSavingAdminNotes(true);
        router.patch(
            route('admin.shipments.admin-notes', shipmentId),
            { admin_notes: adminNotesInput },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setDetailJob((prev) => {
                        if (!prev) {
                            return prev;
                        }
                        return {
                            ...prev,
                            adminNotes: adminNotesInput,
                            raw: {
                                ...(prev.raw ?? {}),
                                admin_notes: adminNotesInput,
                            },
                        };
                    });
                    showNotification(t('superAdminDashboardNotesUpdated'), 'success');
                },
                onError: () => {
                    showNotification(t('superAdminDashboardNotesUpdateFailed'), 'error');
                },
                onFinish: () => setSavingAdminNotes(false),
            },
        );
    };

    const { filteredRiders, zoneFilterMessage } = useMemo(() => {
        const response = {
            filteredRiders: [],
            zoneFilterMessage: null,
        };

        if (!selectedJob) {
            response.filteredRiders = [];
            response.zoneFilterMessage = 'Select a shipment to view riders.';
            return response;
        }

        if (jobZoneLookup.status === 'loading') {
            response.filteredRiders = [];
            response.zoneFilterMessage = 'Detecting pickup zone...';
            return response;
        }

        const jobDeliveryMode = normalizeDeliverySpeedMode(
            selectedJob.deliverySpeed ?? selectedJob.shipmentType ?? selectedJob.consignmentType,
        );

        const filteredByMode = riders.filter((r) => riderSupportsDeliveryMode(r.deliverySpeedMode, jobDeliveryMode));

        if (!jobZoneLookup.zoneId) {
            response.filteredRiders = [];
            response.zoneFilterMessage = jobZoneLookup.error
                ?? 'Pickup zone could not be determined. Please ensure the shipment has valid pickup coordinates.';
            return response;
        }

        // For all delivery types (direct and indirect), use pickup zone only
        const zoneLabel = jobZoneLookup.zoneName ?? `Zone #${jobZoneLookup.zoneId}`;
        const matchingRiders = filteredByMode.filter((r) => {
            const riderZoneId = normalizeZoneId(r.zoneId ?? r.zone_id);
            const riderZoneIds = r.zoneIds ?? [];
            const targetZone = jobZoneLookup.zoneId;
            return riderZoneId === targetZone || riderZoneIds.includes(targetZone);
        });
        const availableRiders = matchingRiders.filter((r) => isRiderAvailable(r));

        const term = riderSearch.trim().toLowerCase();
        const searched = term
            ? availableRiders.filter((r) =>
                [r.code, r.name, r.vehicleType, r.shipmentType, r.status, r.deliverySpeedLabel]
                    .filter(Boolean)
                    .some((v) => v.toString().toLowerCase().includes(term)),
            )
            : availableRiders;

        response.filteredRiders = searched;
        response.zoneFilterMessage = searched.length > 0
            ? t('superAdminDashboardZoneFilterShowingRiders', { zone: zoneLabel })
            : t('superAdminDashboardZoneFilterNoRiders', { zone: zoneLabel });

        return response;
    }, [selectedJob, jobZoneLookup, riders, riderSearch, t]);

    const filteredJobs = useMemo(() => {
        const normalize = (value) => (value ?? '').toString().toLowerCase();
        const normalizedSearch = searchQuery.trim().toLowerCase();

        let result = jobs;

        if (normalizedSearch) {
            result = result.filter((job) => {
                const searchableFields = [
                    job.shipId,
                    job.rider,
                    job.sender,
                    job.receiver,
                    job.shipmentType,
                    job.vehicleType,
                    job.status,
                ];

                return searchableFields.some(
                    (field) => field && normalize(field).includes(normalizedSearch),
                );
            });
        }

        if (selectedDate) {
            result = result.filter((job) => job.date === selectedDate);
        }

        const comparators = {
            Rider: (a, b) => normalize(a.rider).localeCompare(normalize(b.rider)),
            Date: (a, b) => new Date(b.date) - new Date(a.date), // DESC: newest first
            Status: (a, b) => normalize(a.status).localeCompare(normalize(b.status)),
            Location: (a, b) => normalize(a.receiver).localeCompare(normalize(b.receiver)),
        };

        const comparator = comparators[sortBy] ?? comparators.Rider;

        return [...result].sort((a, b) => comparator(a, b));
    }, [jobs, searchQuery, selectedDate, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
    const sortOptions = useMemo(() => ([
        { label: t('commonRider'), value: 'Rider' },
        { label: t('commonDate'), value: 'Date' },
        { label: t('commonStatus'), value: 'Status' },
        { label: t('commonLocation'), value: 'Location' },
    ]), [t]);
    const exportMenuItems = useMemo(() => ([
        { label: t('commonExportCsv'), value: 'csv' },
        { label: t('commonExportExcel'), value: 'excel' },
    ]), [t]);

    // Poll backend frequently so new shipments appear without manual refresh.
    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        const intervalId = setInterval(() => {
            if (document.hidden || pollingInFlightRef.current) {
                return;
            }

            pollingInFlightRef.current = true;
            router.reload({
                only: ['shipments', 'stats'],
                preserveScroll: true,
                preserveState: true,
                onFinish: () => {
                    pollingInFlightRef.current = false;
                },
                onError: () => {
                    pollingInFlightRef.current = false;
                },
                onCancel: () => {
                    pollingInFlightRef.current = false;
                },
            });
        }, DASHBOARD_REFRESH_INTERVAL);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (!showSortMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                !sortTriggerRef.current?.contains(event.target) &&
                !sortMenuRef.current?.contains(event.target)
            ) {
                setShowSortMenu(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowSortMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showSortMenu]);

    useEffect(() => {
        if (!showExportMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                !exportTriggerRef.current?.contains(event.target) &&
                !exportMenuRef.current?.contains(event.target)
            ) {
                setShowExportMenu(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowExportMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showExportMenu]);

    useEffect(() => {
        if (!showDetailDrawer) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeDetailDrawer();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showDetailDrawer]);

    const paginatedJobs = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredJobs.slice(startIndex, startIndex + pageSize);
    }, [filteredJobs, currentPage, pageSize]);

    const paginationMeta = useMemo(() => {
        if (filteredJobs.length === 0) {
            return { from: 0, to: 0, total: 0 };
        }
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + paginatedJobs.length, filteredJobs.length);
        return {
            from: startIndex + 1,
            to: endIndex,
            total: filteredJobs.length,
        };
    }, [filteredJobs.length, paginatedJobs.length, currentPage, pageSize]);

    const formatCSVValue = (value) => {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value);
        if (/[",\n\r]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
    };

    const handleExportOrders = (format) => {
        if (!filteredJobs.length) {
            window.alert(t('superAdminDashboardExportNoOrders'));
            return;
        }

        const headers = [
            t('superAdminDashboardExportOrderNumber'),
            t('commonDate'),
            t('commonCustomerName'),
            t('superAdminDashboardExportCustomerPhone'),
            t('commonSenderName'),
            t('superAdminDashboardExportSenderPhone'),
            t('commonReceiverName'),
            t('superAdminDashboardExportReceiverPhone'),
            t('commonShipmentType'),
            // 'Delivery Type',
            t('commonStatus'),
            t('commonReturnStatus'),
            t('superAdminDashboardColumnSenderDroppoint'),
            t('superAdminDashboardColumnReceiverDroppoint'),
            t('superAdminDashboardColumnPickupRider'),
            t('superAdminDashboardExportPickupRiderPhone'),
            t('superAdminDashboardColumnDeliveryRider'),
            t('superAdminDashboardExportDeliveryRiderPhone'),
            t('commonConsignmentType'),
            t('commonSize'),
            t('commonWeight'),
            t('commonValue'),
            t('commonInsurance'),
            t('commonPaymentMethod'),
            t('commonAcceptReturns'),
            t('superAdminDashboardExportNotes'),
            t('commonPickupLocation'),
            t('commonDropOffLocation'),
            t('commonDeliveryFee'),
            t('commonGoodsCost'),
            t('commonBasicFee'),
            t('commonInsuranceFee'),
            t('commonSubtotal'),
            t('commonPlatformFee'),
            t('commonVat'),
            t('commonTotal'),
        ];

        const rows = filteredJobs.map((job) => {
            const consignmentDetails = resolveJobConsignmentDetails(job, t);
            const paymentSummary = resolveJobPaymentSummary(job, t);
            return [
                job.shipId ?? '',
                job.date ?? '',
                job.customerName ?? '',
                job.customerPhone ?? '',
                job.sender ?? '',
                job.senderPhone ?? '',
                job.receiver ?? '',
                job.receiverPhone ?? '',
                job.shipmentType ?? '',
                // job.deliverySpeed ?? '',
                job.status ?? '',
                job.returnStatus ?? '',
                job.senderDroppoint ?? '',
                job.receiverDroppoint ?? '',
                job.rider ?? '',
                job?.riderPhone ?? '',
                job.deliveryRider,
                job?.deliveryRiderPhone ?? '',
                consignmentDetails.consignmentType ?? "",
                consignmentDetails.size ?? "",
                consignmentDetails.weight ?? "",
                consignmentDetails.value  ?? "",
                consignmentDetails.insurance ?? "",
                consignmentDetails.paymentMethod ?? "",
                consignmentDetails.acceptReturns ?? '',
                job?.adminNotes ?? '',
                job.pickupLocation ?? '',
                job.dropoffLocation ?? '',
                paymentSummary.shipmentFee ?? '',
                paymentSummary.goodsAmount ?? '',
                paymentSummary.serviceFee ?? '',
                paymentSummary.insuranceFee ?? '',
                paymentSummary.subtotal ?? '',
                paymentSummary.platformFee ?? '',
                paymentSummary.vat ?? '',
                paymentSummary.total ?? '',
            ];
        });

        const dateSuffix = new Date().toISOString().slice(0, 10);

        if (format === 'excel') {
            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, t('commonOrders'));
            XLSX.writeFile(workbook, `orders-export-${dateSuffix}.xlsx`);
            return;
        }

        const csvContent = [headers, ...rows]
            .map((row) => row.map((value) => formatCSVValue(value)).join(','))
            .join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `orders-export-${dateSuffix}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const getStatusClasses = (color) => {
        const colors = {
            amber: 'bg-amber-50 text-amber-500 border border-amber-500',
            blue: 'bg-blue-50 text-blue-500 border border-blue-500',
            green: 'bg-green-50 text-green-600 border border-green-600',
        };

        return colors[color] || colors.amber;
    };

    const columnLabel = (key) => {
        const translated = t(key);
        return translated === key ? key : translated;
    };

    const jobColumns = useMemo(() => [
        {
            key: 'shipId',
            label: columnLabel('commonShipId'),
            className: 'whitespace-nowrap text-[#0f172a] font-medium',
        },
        {
            key: 'rider',
            label: t('superAdminDashboardColumnPickupRider'),
            render: (_value, row) => (
                <div className="flex flex-col">
                    <span className="text-[#0f172a]">{row.rider ?? t('statusUnassigned')}</span>
                    {row.riderRole && (
                        <span className="text-xs text-gray-500">{row.riderRole}</span>
                    )}
                </div>
            ),
            className: 'whitespace-nowrap text-[#0f172a]',
        },
        // {
        //     key: 'rider',
        //     label: columnLabel('superAdminDashboardColumnEmployee', 'Employee'),
        //     render: (_value, row) => (
        //         <div className="flex flex-col">
        //             <span className="text-[#0f172a]">{row.rider ?? 'Unassigned'}</span>
        //             {row.riderRole && (
        //                 <span className="text-xs text-gray-500">{row.riderRole}</span>
        //             )}
        //         </div>
        //     ),
        //     className: 'whitespace-nowrap text-[#0f172a]',
        // },
        {
            key: 'deliveryRider',
            label: t('superAdminDashboardColumnDeliveryRider'),
            render: (_value, row) => {
                const indirectMode = row.raw?.indirect_delivery_mode ?? '';
                const needsDeliveryRider = ['door_to_door', 'drop_point_to_door'].includes(indirectMode);
                if (!needsDeliveryRider) {
                    return <span className="text-xs text-slate-400">{t('commonNotApplicable')}</span>;
                }
                const status = String(row.raw?.status ?? row.status ?? '').trim().toLowerCase();
                const atDropPoint2Statuses = [
                    'arrived at drop point 2', 'ready for pickup',
                    'dispatched from drop point 2', 'pickup from drop point 2', 'in transit to customer',
                    'action required', 'action_required',
                ];
                const isAtDP2 = atDropPoint2Statuses.some((s) => status === s);
                const hasDeliveryRider = row.deliveryRider && row.deliveryRider !== '--' && row.deliveryRider !== 'Unassigned';
                if (hasDeliveryRider) {
                    return (
                        <div className="flex flex-col">
                            <span className="text-[#0f172a]">{row.deliveryRider}</span>
                            {row.deliveryRiderRole && (
                                <span className="text-xs text-gray-500">{row.deliveryRiderRole}</span>
                            )}
                        </div>
                    );
                }
                if (isAtDP2) {
                    return (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-300 whitespace-nowrap">
                            {t('superAdminDashboardActionRequired')}
                        </span>
                    );
                }
                return <span className="text-xs text-slate-400">{t('superAdminDashboardPendingDp2')}</span>;
            },
            className: 'whitespace-nowrap text-[#0f172a]',
        },
        {
            key: 'date',
            label: columnLabel('superAdminDashboardColumnDate'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'sender',
            label: columnLabel('superAdminDashboardColumnSender'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'receiver',
            label: columnLabel('commonReceiver'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'shipmentType',
            label: columnLabel('commonShipmentType'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'senderDroppoint',
            label: columnLabel('superAdminDashboardColumnSenderDroppoint'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'receiverDroppoint',
            label: columnLabel('superAdminDashboardColumnReceiverDroppoint'),
            className: 'whitespace-nowrap',
        },
        // {
        //     key: 'adminNotes',
        //     label: columnLabel('superAdminDashboardColumnAdminNotes', 'Admin Notes'),
        //     render: (_value, row) => {
        //         const original = row.adminNotes ?? row.raw?.admin_notes ?? '';
        //         const preview = formatAdminNotesPreview(original);
        //         return (
        //             <span
        //                 title={original || undefined}
        //                 className="inline-block max-w-[220px] truncate align-middle"
        //             >
        //                 {preview}
        //             </span>
        //         );
        //     },
        //     className: 'whitespace-nowrap',
        // },
        {
            key: 'status',
            label: columnLabel('commonStatus'),
            render: (_value, row) => (
                <span className={`inline-flex items-center justify-center border text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${getStatusClasses(row.statusColor)}`}>
                    {row.status}
                </span>
            ),
            className: 'whitespace-nowrap',
        },
        {
            key: 'returnStatus',
            label: columnLabel('commonReturnStatus'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'action',
            label: t('commonAction'),
            align: 'right',
            render: (_value, row) => {
                const indirectMode = row.raw?.indirect_delivery_mode ?? row.indirectDeliveryMode ?? '';
                const deliverySpeedKey = normalizeDeliverySpeedKey(
                    row.deliverySpeed ?? row.raw?.delivery_speed ?? row.shipmentType,
                );
                const isIndirect = deliverySpeedKey === 'indirect';
                const isDropPointToDropPoint = isIndirect && indirectMode === 'drop_point_to_drop_point';
                const isDoorDeliveryMode = isIndirect && ['door_to_door', 'drop_point_to_door'].includes(indirectMode);
                const rowStatus = String(row.raw?.status ?? row.status ?? '').trim().toLowerCase();
                const rowAtDP2 = [
                    'arrived at drop point 2',
                    'ready for pickup',
                    'dispatched from drop point 2',
                    'pickup from drop point 2',
                    'in transit to customer',
                    'action required',
                    'action_required',
                ].includes(rowStatus);
                const rowHasDeliveryRider = row.deliveryRider && row.deliveryRider !== '--' && row.deliveryRider !== 'Unassigned';
                const needsDeliveryRiderAction = isDoorDeliveryMode && rowAtDP2 && !rowHasDeliveryRider;

                return row.action === 'Assign' ? (
                    <button
                        type="button"
                        disabled={isDropPointToDropPoint}
                        onClick={() => {
                            if (row?.deliveryFeePayer == "receiver" && row.paymentStatus == "pending") {
                                showNotification(t("superAdminDashboardReceiverPaymentPending"), "error", 3000);
                                return
                            }
                            if (row?.sender_payment_status == "pending" && row.paymentMethod == "online") {
                                showNotification(t("superAdminDashboardSenderPaymentPending"), "error", 3000);
                                return
                            }
                            if (isDropPointToDropPoint) {
                                return;
                            }
                            if (needsDeliveryRiderAction) {
                                handleOpenDeliveryRiderModal(row);
                            } else {
                                handleOpenAssignDrawer(row);
                            }
                        }}
                        className={`text-sm font-14px underline ${
                            isDropPointToDropPoint
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-neutral-900 cursor-pointer hover:text-blue-600'
                        }`}
                        title={isDropPointToDropPoint ? t('superAdminDashboardDropPointRestriction') : ''}
                    >
                        {needsDeliveryRiderAction ? t('superAdminDashboardButtonAssignDelivery') : t('commonAssign')}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            if (hasPermission('shipments.tracking')) {
                                setDetailJob(row);
                                setShowDetailDrawer(true);
                                handleCloseAssignDrawer();
                            }
                        }}
                        disabled={!hasPermission('shipments.tracking')}
                        className={`text-sm font-14px underline ${
                            hasPermission('shipments.tracking')
                                ? 'text-neutral-900 cursor-pointer hover:text-blue-600'
                                : 'text-gray-400 cursor-not-allowed'
                        }`}
                        title={!hasPermission('shipments.tracking') ? t('superAdminDashboardTrackingPermissionRequired') : ''}
                    >
                        {t('commonViewDetail')}
                    </button>
                );
            },
            className: 'whitespace-nowrap',
        },
        // {
        //     key: 'action',
        //     label: columnLabel('superAdminDashboardColumnAction', 'Action'),
        //     align: 'right',
        //     render: (_value, row) => {
        //         // Check if shipment is a drop point type
        //         const indirectMode = row.raw?.indirect_delivery_mode ?? row.indirectDeliveryMode ?? '';
        //         const isDropPointMode = row.deliverySpeed === 'indirect' &&
        //             indirectMode === 'drop_point_to_drop_point';
        //         const isDoorToDoor = row.deliverySpeed === 'indirect' && indirectMode === 'door_to_door';
        //         const isDropPointToDoor = row.deliverySpeed === 'indirect' && indirectMode === 'drop_point_to_door';

        //         // For door_to_door or drop_point_to_door at DP2+ without delivery rider, open delivery rider modal
        //         const rowStatus = String(row.raw?.status ?? row.status ?? '').trim().toLowerCase();
        //         const rowAtDP2 = ['arrived at drop point 2', 'ready for pickup', 'dispatched from drop point 2', 'pickup from drop point 2', 'in transit to customer'].some((s) => rowStatus === s);
        //         const rowHasDeliveryRider = row.deliveryRider && row.deliveryRider !== '--' && row.deliveryRider !== 'Unassigned';
        //         const needsDeliveryRiderAction = (isDoorToDoor || isDropPointToDoor) && rowAtDP2 && !rowHasDeliveryRider;

        //         return row.action === 'Assign' ? (
        //             <button
        //                 type="button"
        //                 disabled={isDropPointMode}
        //                 onClick={() => {
        //                     if (row.paymentMethod == "online" && row.paymentStatus == "pending") {
        //                         showNotification("Payment is pending for this shipment from receiver.", "error", 3000);
        //                         return
        //                     }
                            
        //                     if (!isDropPointMode) {
        //                         if (needsDeliveryRiderAction) {
        //                             handleOpenDeliveryRiderModal(row);
        //                         } else {
        //                             handleOpenAssignDrawer(row);
        //                         }
        //                     }
        //                 }}
        //                 className={`text-sm font-14px underline ${
        //                     isDropPointMode
        //                         ? 'text-gray-400 cursor-not-allowed'
        //                         : 'text-neutral-900 cursor-pointer hover:text-blue-600'
        //                 }`}
        //                 title={isDropPointMode ? 'Drop point to drop point deliveries do not require a rider assignment here' : ''}
        //             >
        //                 {needsDeliveryRiderAction ? 'Assign Delivery' : 'Assign'}
        //             </button>
        //         ) : (
        //             <button
        //                 type="button"
        //                 onClick={() => {
        //                     if (hasPermission('shipments.tracking')) {
        //                         setDetailJob(row);
        //                         setShowDetailDrawer(true);
        //                         handleCloseAssignDrawer();
        //                     }
        //                 }}
        //                 disabled={!hasPermission('shipments.tracking')}
        //                 className={`text-sm font-14px underline ${
        //                     hasPermission('shipments.tracking')
        //                         ? 'text-neutral-900 cursor-pointer hover:text-blue-600'
        //                         : 'text-gray-400 cursor-not-allowed'
        //                 }`}
        //                 title={!hasPermission('shipments.tracking') ? 'You do not have permission to track shipments' : ''}
        //             >
        //                 {columnLabel('superAdminDashboardViewDetail', 'View Details')}
        //             </button>
        //         );
        //     },
        //     className: 'whitespace-nowrap',
        // },
    ], [getStatusClasses, handleOpenAssignDrawer, handleCloseAssignDrawer, handleOpenDeliveryRiderModal, hasPermission, setDetailJob, setShowDetailDrawer, t]);

    const detailTrackingEvents = useMemo(() => {
        if (!detailJob) {
            return [];
        }

        // Align stage labels with Customer Shipments page
        const directStageLabels = [t('statusAssigned'), t('statusPickup'), t('statusInTransit'), t('statusDelivered')];
        const indirectStageLabels = [
            t('statusAssigned'),
            t('statusPickup'),
            t('statusInTransit'),
            t('timelineArrivedDropPoint1'),
            t('timelineDeliveredDropPoint1'),
            t('timelineDispatchedToWarehouse'),
            t('timelineArrivedWarehouse'),
            detailJob?.isDiffCity && t('timelineArrivedWarehouse2'),
            t('timelineArrivedDropPoint2'),
            t('notificationReadyForPickupTitle'),
            t('timelineDispatchedDropPoint2'),
            t('timelinePickupDropPoint2'),
            t('timelineInTransitToCustomer'),
            t('statusDelivered'),
        ];
        const directStatusList = [t('statusAssigned'), t('statusPickup'), t('statusInTransit'), t('statusDelivered')];
        const baseIndirectStatusList = [
            t('statusAssigned'),
            t('statusPickup'),
            t('statusInTransit'),
            t('timelineArrivedDropPoint1'),
            t('timelineDeliveredDropPoint1'),
            t('timelineDispatchedToWarehouse'),
            t('timelineArrivedWarehouse'),
            detailJob?.isDiffCity && t('timelineArrivedWarehouse2'),
            t('timelineArrivedDropPoint2'),
            t('notificationReadyForPickupTitle'),
            t('timelineDispatchedDropPoint2'),
            t('timelinePickupDropPoint2'),
            t('timelineInTransitToCustomer'),
            t('statusDelivered'),
        ];

        const rawTracking = Array.isArray(detailJob?.trackingEvents) ? detailJob.trackingEvents : [];
        if (rawTracking.length > 0) {
            return rawTracking.map((event, index) => ({
                label: event?.label ?? `Event ${index + 1}`,
                timestamp: event?.timestamp ?? event?.time ?? '--',
                description: event?.description ?? event?.status ?? '',
                completed: event?.completed ?? index === 0,
                connectorCompleted: event?.connectorCompleted ?? index > 0,
                isLast: index === rawTracking.length - 1,
            }));
        }

        const speedValue = `${detailJob?.deliverySpeed ?? ''}`.trim().toLowerCase();
        let isDirect;
        if (speedValue) {
            isDirect = speedValue === 'direct';
        } else {
            const typeValue = `${detailJob?.shipmentType ?? ''}`.trim().toLowerCase();
            isDirect = typeValue.startsWith('direct');
        }
        const indirectMode = detailJob?.raw?.indirect_delivery_mode ?? detailJob?.indirectDeliveryMode ?? '';
        const isDoorDeliveryMode = ['door_to_door', 'drop_point_to_door'].includes(indirectMode);
        const isDropPointDeliveryMode = ['door_to_drop_point', 'drop_point_to_drop_point'].includes(indirectMode);
        let stageLabels = isDirect ? directStageLabels : indirectStageLabels;
        let statusList = isDirect ? directStatusList : baseIndirectStatusList;
        if (!isDirect && isDoorDeliveryMode) {
            // For door delivery modes, remove "Ready for Pickup" status
            const filtered = statusList.reduce(
                (acc, status, idx) => {
                    if (status === 'Ready for Pickup') {
                        return acc;
                    }
                    acc.labels.push(stageLabels[idx]);
                    acc.statuses.push(status);
                    return acc;
                },
                { labels: [], statuses: [] },
            );
            stageLabels = filtered.labels;
            statusList = filtered.statuses;
        } else if (!isDirect && isDropPointDeliveryMode) {
            // For drop point delivery modes, remove door delivery statuses
            const doorDeliveryStatuses = [
                'Dispatched from Drop Point 2',
                'Pickup from Drop Point 2',
                'In Transit to Customer'
            ];
            const filtered = statusList.reduce(
                (acc, status, idx) => {
                    if (doorDeliveryStatuses.includes(status)) {
                        return acc;
                    }
                    acc.labels.push(stageLabels[idx]);
                    acc.statuses.push(status);
                    return acc;
                },
                { labels: [], statuses: [] },
            );
            stageLabels = filtered.labels;
            statusList = filtered.statuses;
        }

        // For drop_point_to_* modes, also remove initial pickup statuses
        // Customer brings parcel to drop point, so no rider pickup/transit needed
        if (!isDirect && ['drop_point_to_door', 'drop_point_to_drop_point'].includes(indirectMode)) {
            const pickupOnlyStatuses = [
                'Assigned',
                'Pickup',
                'In Transit',
                'Arrived at Drop Point 1'
            ];
            const filtered = statusList.reduce(
                (acc, status, idx) => {
                    if (pickupOnlyStatuses.includes(status)) {
                        return acc;
                    }
                    acc.labels.push(stageLabels[idx]);
                    acc.statuses.push(status);
                    return acc;
                },
                { labels: [], statuses: [] },
            );
            stageLabels = filtered.labels;
            statusList = filtered.statuses;
        }
        const stageCount = stageLabels.length;

        // Prefer camelCase history; fallback to raw snake_case as seen in Earnings/Shipments pages
        const historySource = detailJob?.statusHistory ?? detailJob?.raw?.status_history ?? detailJob?.status_history ?? [];
        const history = Array.isArray(historySource) ? historySource : [];
        const stageTimestamps = collectStageTimestamps(history, isDirect, stageCount, statusList);

        const statusObject = isDirect
            ? detailJob?.directStatus ?? detailJob?.raw?.direct_status
            : detailJob?.indirectStatus ?? detailJob?.raw?.indirect_status;

        // Convert 0-based current_index into a completed count (+1)
        let progressIndex = Number(statusObject?.current_index ?? statusObject?.currentIndex);
        if (Number.isFinite(progressIndex)) {
            progressIndex = progressIndex + 1;
        } else {
            const derived = resolveStageIndexFromStatus(detailJob?.status, isDirect, stageCount);
            progressIndex = derived != null ? derived + 1 : 1;
        }
        progressIndex = Math.max(1, Math.min(progressIndex, stageCount));

        return stageLabels.map((label, index) => {
            const timestamp = stageTimestamps[index];
            const timestampLabel = formatTimelineTimestamp(timestamp);
            const hasTimestamp = Boolean(timestampLabel);
            // Match customer page logic: only show checkmark if there's an actual timestamp
            const checked = hasTimestamp;

            return {
                label,
                timestamp: timestampLabel ?? '--',
                description: '',
                completed: checked,
                connectorCompleted: index < progressIndex - 1,
                isLast: index === stageCount - 1,
            };
        });
    }, [detailJob, t]);

    const detailRiderActions = useMemo(() => {
        if (!detailJob) {
            return {
                hasRider: false,
                canManage: false,
                canManagePickup: false,
                canUnassign: false,
                canReassign: false,
                isDropPointMode: false,
                isDropPointToDoor: false,
                isDoorToDoorMode: false,
                needsDeliveryRider: false,
                hasDeliveryRider: false,
                canAssignDelivery: false,
                canUnassignDelivery: false,
            };
        }

        const raw = detailJob.raw ?? {};
        const deliverySpeed = raw.delivery_speed ?? detailJob.deliverySpeed ?? detailJob.shipmentType ?? '';
        const indirectMode = raw.indirect_delivery_mode
            ?? detailJob.indirectDeliveryMode
            ?? raw.indirectDeliveryMode
            ?? '';
        const isDropPointToDoor = String(deliverySpeed).toLowerCase() === 'indirect'
            && String(indirectMode) === 'drop_point_to_door';
        const isDropPointMode = String(deliverySpeed).toLowerCase() === 'indirect'
            && ['drop_point_to_door', 'drop_point_to_drop_point'].includes(String(indirectMode));
        const isDoorToDoorMode = String(deliverySpeed).toLowerCase() === 'indirect'
            && String(indirectMode) === 'door_to_door';
        const hasRider = Boolean(detailJob.rider && detailJob.rider !== '--' && detailJob.rider !== 'Unassigned');
        const hasDeliveryRider = Boolean(detailJob.deliveryRider && detailJob.deliveryRider !== '--' && detailJob.deliveryRider !== 'Unassigned');
        const status = String(raw.status ?? detailJob.status ?? '').trim().toLowerCase();
        // Statuses that indicate the shipment is at/past Drop Point 2 and ready for delivery rider
        const atDropPoint2Statuses = [
            'arrived at drop point 2',
            'ready for pickup',
            'dispatched from drop point 2',
            'pickup from drop point 2',
            'in transit to customer',
            'action required',
            'action_required',
        ];
        const isAtOrPastDropPoint2 = atDropPoint2Statuses.some((s) => status === s.toLowerCase());
        const needsDeliveryRider = (isDoorToDoorMode || isDropPointToDoor) && isAtOrPastDropPoint2 && !hasDeliveryRider;
        const canAssignDelivery = hasDeliveryRider || needsDeliveryRider;
        const canManage = !isDropPointMode;
        // Statuses where pickup has been completed and rider cannot be reassigned/unassigned
        const pickupCompletedStatuses = [
            'pickup',
            'in transit',
            'arrived at drop point 1',
            'delivered to drop point 1',
            'dispatched to warehouse',
            'arrived at warehouse',
            'arrived at warehouse 2',
            'arrived at drop point 2',
            'ready for pickup',
            'dispatched from drop point 2',
            'pickup from drop point 2',
            'in transit to customer',
            'delivered'
        ];
        const hasPickupCompleted = pickupCompletedStatuses.some(s => status.includes(s.toLowerCase()));
        const canManagePickup = canManage && !hasPickupCompleted;
        const canUnassign = canManage && hasRider && (status === 'assigned' || status === 'pending');
        const canReassign = canManage && (status === 'assigned' || status === 'pending');
        const canUnassignDelivery = hasDeliveryRider && (isDoorToDoorMode || isDropPointToDoor);

        return {
            hasRider,
            canManage,
            canManagePickup,
            canUnassign,
            canReassign,
            isDropPointMode,
            isDropPointToDoor,
            isDoorToDoorMode,
            needsDeliveryRider,
            hasDeliveryRider,
            canAssignDelivery,
            canUnassignDelivery,
        };
    }, [detailJob, t]);

    const paymentSummary = useMemo(() => {
        const job = selectedJob ?? detailJob;
        if (!job) {
            return null;
        }

        const paymentDetails = job.payment ?? job.raw?.payment ?? {};

        const shipmentFee = parseCurrencyValue(paymentDetails.shipment_fee) ?? 0;
        const senderZoneDeliveryFee =
            parseCurrencyValue(paymentDetails.sender_zone_delivery_fee ?? job.sender_zone_delivery_fee ?? job.raw?.sender_zone_delivery_fee) ?? 0;
        const receiverZoneDeliveryFee =
            parseCurrencyValue(paymentDetails.reciever_zone_delivery_fee ?? job.reciever_zone_delivery_fee ?? job.raw?.reciever_zone_delivery_fee) ?? 0;
        const goodsAmount = parseCurrencyValue(paymentDetails.goods_amount) ?? 0;
        const serviceFee = parseCurrencyValue(paymentDetails.service_fee ?? job.service_fee ?? job.raw?.service_fee) ?? 0;
        const insuranceFee = parseCurrencyValue(paymentDetails.insurance_fee) ?? 0;
        const platformFee = parseCurrencyValue(paymentDetails.platform_fee) ?? 0;
        const vatAmount = parseCurrencyValue(paymentDetails.vat_amount) ?? parseCurrencyValue(job.vat_amount) ?? 0;

        const subtotal = shipmentFee + goodsAmount + insuranceFee + serviceFee;
        const total = subtotal + platformFee + vatAmount;

        const deliverySpeedKey = normalizeDeliverySpeedKey(
            job.deliverySpeed ?? job.raw?.delivery_speed ?? job.shipmentType,
        );
        const feeLabel = deliverySpeedKey === 'direct'
            ? t('commonDirectDeliveryFee')
            : deliverySpeedKey === 'indirect'
                ? t('superAdminDashboardIndirectDeliveryFee')
                : t('commonDeliveryFee');
        const vatLabel = buildVatLabel(financialSettings, t);

        return {
            feeLabel,
            isDirectDelivery: deliverySpeedKey === 'direct',
            shipmentFee,
            senderZoneDeliveryFee,
            receiverZoneDeliveryFee,
            goodsAmount,
            serviceFee,
            insuranceFee,
            subtotal,
            platformFee,
            vat: vatAmount,
            total,
            vatLabel,
        };
    }, [selectedJob, detailJob, financialSettings, t]);
    const formatDashboardCurrency = (value) => `${value ?? 0} ${t('commonCurrencySyp')}`;
    const isReturnedDetailJob = detailJob?.is_returned === true;
    const detailReturnReason = String(detailJob?.return_reason ?? '').trim();
    const detailReturnImages = Array.isArray(detailJob?.return_images) ? detailJob.return_images : [];

    const resolvedDetailAdminNotes = useMemo(() => {
        if (!detailJob) {
            return '';
        }
        const candidate = detailJob.adminNotes
            ?? detailJob?.raw?.admin_notes
            ?? detailJob?.raw?.adminNotes
            ?? '';
        return typeof candidate === 'string' ? candidate : String(candidate ?? '');
    }, [detailJob, t]);

    useEffect(() => {
        setAdminNotesInput(resolvedDetailAdminNotes);
    }, [resolvedDetailAdminNotes]);

    const adminNotesDirty = adminNotesInput !== resolvedDetailAdminNotes;

    const detailReviewList = useMemo(() => {
        const source = detailJob?.review ?? detailJob?.raw?.review;
        if (!source) {
            return [];
        }

        if (Array.isArray(source)) {
            return source.filter(Boolean);
        }

        if (Array.isArray(source?.reviews)) {
            return source.reviews.filter(Boolean);
        }

        if (Array.isArray(source?.review)) {
            return source.review.filter(Boolean);
        }

        return [source];
    }, [detailJob]);

    const detailPrimaryReview = detailReviewList[0] ?? null;

    const detailReviewDetails = useMemo(
        () => mapReviewDetails(detailPrimaryReview, t),
        [detailPrimaryReview, t],
    );

    const detailDeliveryModeKey = useMemo(() => {
        if (!detailJob) {
            return null;
        }
        const candidate = detailJob.deliverySpeed
            ?? detailJob.shipmentType
            ?? detailJob.raw?.delivery_speed
            ?? detailJob.raw?.shipment_type
            ?? '';
        return normalizeDeliverySpeedKey(candidate);
    }, [detailJob]);

    const detailIsDirectDelivery = detailDeliveryModeKey === 'direct';

    const detailRatedEmployees = useMemo(
        () => detailReviewList.filter((review) => {
            const numericRating = Number(review?.rating);
            return Number.isFinite(numericRating) && numericRating > 0;
        }),
        [detailReviewList],
    );

    // const assignPaymentSummary = useMemo(() => {
    //     Shared summary logic now lives in `paymentSummary`.
    // }, [selectedJob, financialSettings]);

    const assignReviewDetails = useMemo(
        () => mapReviewDetails(selectedJob?.review ?? selectedJob?.raw?.review, t),
        [selectedJob, t],
    );
    const isReturnedAssignJob = selectedJob?.is_returned === true;
    const assignReturnReason = String(selectedJob?.return_reason ?? '').trim();
    const assignReturnImages = Array.isArray(selectedJob?.return_images) ? selectedJob.return_images : [];
    const detailParcelItems = useMemo(() => {
        if (!detailJob) {
            return [];
        }

        const fallback = '--';
        const resolvedSize = detailJob.sizeText
            ?? (typeof detailJob.size === 'object' ? detailJob.size?.name : detailJob.size)
            ?? fallback;
        const resolvedWeight = detailJob.weightText
            ?? (detailJob.weight != null && detailJob.weight !== '' ? `${detailJob.weight} ${t('superAdminDashboardWeightUnitKg')}` : null)
            ?? fallback;

        const declaredValue = (() => {
            const parsed = parseCurrencyValue(detailJob.valueText ?? detailJob.totalFee ?? detailJob.raw?.parcel_amount);
            return parsed != null ? `${parsed} ${t('commonCurrencySyp')}` : fallback;
        })();

        return [
            { label: t('commonConsignmentType'), value: detailJob.consignmentType ?? detailJob.shipmentType ?? fallback },
            { label: t('commonSize'), value: resolvedSize },
            { label: t('commonWeight'), value: resolvedWeight },
            { label: t('commonValue'), value: declaredValue },
            { label: t('commonInsurance'), value: detailJob.insuranceText ?? detailJob.insurance ?? fallback },
            { label: t('commonPaymentMethod'), value: toHumanPaymentMethod(detailJob.paymentMethod ?? detailJob.raw?.payment_method, t) },
            { label: t('commonAcceptReturns'), value: (detailJob.raw?.accept_returns === 1 || detailJob.raw?.accept_returns === true || detailJob.raw?.accept_returns === '1') ? t('commonYes') : t('commonNo') },
        ];
    }, [detailJob, t]);

    const detailDeliverySpeedLabel = useMemo(() => {
        if (!detailJob) {
            return '--';
        }

        return detailJob.deliverySpeed ?? detailJob.shipmentType ?? '--';
    }, [detailJob]);

    const detailDeliverySpeedDescription = useMemo(() => {
        if (!detailJob) {
            return t('deliverySpeedUnavailable');
        }

        if (detailJob.deliverySpeedDescription) {
            return detailJob.deliverySpeedDescription;
        }

        const descriptor = `${detailJob.deliverySpeed ?? detailJob.shipmentType ?? ''}`
            .trim()
            .toLowerCase();

        if (!descriptor) {
            return t('deliverySpeedUnavailable');
        }

        if (descriptor.startsWith('direct')) {
            return t('deliverySpeedWithinCity');
        }

        if (descriptor.startsWith('in')) {
            return t('deliverySpeedIntercity');
        }

        return t('deliverySpeedSelected');
    }, [detailJob, t]);

    return (
        <SuperAdminAuthenticated auth={auth}>
            <Head title={t('commonDashboard')} />

            {/* Stats + Heatmap Section */}
            <div className="grid grid-cols-1 md:grid-cols-[0.85fr_0.85fr_2.3fr] gap-5 mb-8">
                {/* Left Side (2x2 Stats Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 md:col-span-2">
                    {stats.map((stat, index) => (
                        <StatsCard
                            key={index}
                            title={stat.title}
                            value={stat.value}
                            subtitle={stat.subtitle}
                            iconSrc={stat.icon}
                            isSpecialCard={stat.isSpecialCard ?? false}
                            accentColor={stat.color}
                        />
                    ))}
                </div>

                {/* Right Side (Heatmap Card) */}
                <HeatmapWidget shipments={heatmapShipments} riders={heatmapRiders} compact={true} showFullscreenButton={true} />
            </div>

            <Card
                className="mb-6"
                title={t('superAdminDashboardNewJobsTitle')}
                padding="none"
                headerClassName="px-5 py-4"
                toolbarClassName="flex-1"
                toolbar={(
                    <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3 w-full">
                        <div className="w-full md:w-auto">
                            <label className="sr-only" htmlFor="dashboard-page-size">{t('superAdminDashboardLabelRowsPerPage')}</label>
                            <div className="relative">
                                <select
                                    id="dashboard-page-size"
                                    className="w-full md:w-[120px] rounded-full border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={pageSize}
                                    onChange={(event) => {
                                        const nextSize = Number(event.target.value);
                                        setPageSize(Number.isFinite(nextSize) ? nextSize : DEFAULT_PAGE_SIZE);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {PAGE_SIZE_OPTIONS.map((size) => (
                                        <option key={size} value={size}>
                                            {size} / {t('superAdminDashboardLabelPage')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="relative w-full md:w-60 lg:w-72">
                            <img
                                src="/assets/images/search.png"
                                alt="search icon"
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]"
                            />
                            <input
                                type="text"
                                placeholder={t('commonSearch')}
                                className="w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>

                        <input
                            type="date"
                            className="w-full md:w-auto rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                            value={selectedDate}
                            onChange={(event) => {
                                setSelectedDate(event.target.value);
                                setCurrentPage(1);
                            }}
                        />

                        <div className="relative md:ml-2" ref={exportTriggerRef}>
                            <PrimaryButton
                                text={t('superAdminDashboardButtonExportOrders')}
                                onClick={() => setShowExportMenu((prev) => !prev)}
                                className="whitespace-nowrap"
                                style={{ padding: '0.5rem 2.5rem' }}
                            />

                            {showExportMenu && (
                                <div ref={exportMenuRef} className="absolute right-0 mt-2 z-40">
                                    <Menu
                                        items={exportMenuItems}
                                        onItemClick={(item) => {
                                            setShowExportMenu(false);
                                            handleExportOrders(item.value);
                                        }}
                                        anchorRef={exportTriggerRef}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="relative md:ml-2">
                            <button
                                type="button"
                                ref={sortTriggerRef}
                                onClick={() => setShowSortMenu((prev) => !prev)}
                                className="inline-flex items-center gap-[6px] rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm transition hover:border-[#94A3B8]"
                                aria-haspopup="menu"
                                aria-expanded={showSortMenu}
                            >
                                <span className="flex items-center gap-[6px]">
                                    <img
                                        src="/assets/images/filter.png"
                                        alt="filter icon"
                                        className="w-[18px] h-[18px] flex-shrink-0"
                                    />
                                    <span className="font-normal text-xs text-gray-500 whitespace-nowrap">
                                        {t('superAdminDashboardLabelSortBy')}
                                    </span>
                                </span>
                                <span className="text-sm">
                                    {sortBy}
                                </span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3.5 h-3.5 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                </svg>
                            </button>

                            {showSortMenu && (
                                <div
                                    ref={sortMenuRef}
                                    className="absolute right-0 mt-2 z-40"
                                >
                                    <Menu
                                        items={sortOptions}
                                        onItemClick={(item) => {
                                            setSortBy(item.value);
                                            setCurrentPage(1);
                                            setShowSortMenu(false);
                                        }}
                                        anchorRef={sortTriggerRef}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
                contentClassName="px-5 pb-5"
            >
                <Table
                    columns={jobColumns}
                    data={filteredJobs}
                    keyField="shipId"
                    emptyMessage={t('commonNoJobsFound')}
                    minWidth="720px"
                    tableClassName="min-w-[720px]"
                    theadClassName="text-[#0f172a]"
                    tbodyClassName="bg-white text-[#1f2937]"
                    thClassName="font-medium"
                    tdClassName="text-sm"
                    striped
                    hoverable
                    pagination
                    paginationMode="client"
                    pageSize={pageSize}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    paginationMeta={paginationMeta}
                    paginationClassName="border-t border-gray-100 bg-[#f8fafc] px-5"
                    paginationDisabled={totalPages <= 1}
                    showPaginationControls={totalPages > 1}
                    showPaginationInfo
                />
            </Card>

            <Drawer
                open={showDetailDrawer}
                onClose={closeDetailDrawer}
                showCloseButton={false}
                closeOnOverlayClick
                closeOnEsc
                panelClassName="flex h-full w-full max-w-[420px] sm:max-w-[440px] flex-col border border-[#d8dee9] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.25)] rounded-l-[28px]"
                containerClassName="flex items-stretch justify-end"
                headerClassName="px-6 pt-6 pb-4 border-b border-[#e2e8f0]"
                bodyClassName="flex-1 overflow-y-auto px-6 pb-6 mt-5 space-y-6"
                overlayClassName="bg-black/30 backdrop-blur-[1px]"
                header={
                    detailJob && (() => {
                        const profileAvatar = detailJob.customerAvatar ?? detailJob.riderAvatar ?? null;
                        const hasCustomerName = typeof detailJob.customerName === 'string' && detailJob.customerName.trim().length > 0;
                        const hasCustomerPhone = typeof detailJob.customerPhone === 'string' && detailJob.customerPhone.trim().length > 0;
                        const profileName = hasCustomerName ? detailJob.customerName.trim() : t('commonNotApplicable');
                        const profilePhone = hasCustomerPhone ? detailJob.customerPhone.trim() : t('commonNotApplicable');
                        const profileAlt = hasCustomerName ? profileName : t('commonCustomer');
                        const profileInitial = hasCustomerName ? profileName.charAt(0) : 'C';
                        return (
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    {profileAvatar ? (
                                        <img
                                            src={profileAvatar}
                                            alt={profileAlt}
                                            className="h-11 w-11 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-200">
                                            <span className="text-lg font-semibold text-gray-600">
                                                {profileInitial}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="text-base font-semibold text-[#0f172a]">{profileName}</h2>
                                        <p className="text-sm text-[#64748b]">{profilePhone}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`inline-flex items-center justify-center rounded-full text-xs font-medium px-3 py-1 ${
                                            (detailJob.statusColor && (DETAIL_STATUS_STYLES[detailJob.statusColor] ?? getStatusClasses(detailJob.statusColor)))
                                            || 'bg-slate-100 text-slate-600 border border-slate-200'
                                        }`}
                                    >
                                        {detailJob.status ?? 'Status'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={closeDetailDrawer}
                                        className="rounded-full p-1 text-[#64748b] text-4xl leading-none hover:text-[#1f2937]"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        );
                    })()
                }
                footerClassName="px-6 pb-6 pt-4 border-t border-[#e2e8f0]"
                footer={detailJob ? (
                    <div className="flex w-full flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={handleAdminNotesCancel}
                            disabled={savingAdminNotes}
                            className="flex-1 h-12 rounded-full border border-[#2563eb] bg-white px-6 text-sm font-medium text-[#2563eb] transition hover:border-[#2563eb] hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t('commonCancel')}
                        </button>
                        <PrimaryButton
                            type="button"
                            text={savingAdminNotes ? t('commonUpdating') : t('commonUpdate')}
                            disabled={savingAdminNotes || !adminNotesDirty}
                            onClick={handleAdminNotesUpdate}
                            className="flex-1 h-12"
                        />
                    </div>
                ) : null}
            >
                {detailJob && detailRiderActions.canManagePickup && (
                    <div className="rounded-2xl border border-[#e5e7eb] p-4">
                        <div className="text-sm font-semibold text-[#0f172a]">
                            {detailRiderActions.isDoorToDoorMode ? t('superAdminDashboardPickupRiderActions') : t('superAdminDashboardPickupRiderActions')}
                        </div>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => handleOpenAssignDrawer(detailJob)}
                                disabled={!detailRiderActions.canReassign}
                                className="flex-1 h-11 rounded-full border border-[#4f7df9] bg-white px-4 text-sm font-medium text-[#4f7df9] transition hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {detailRiderActions.hasRider ? t('superAdminDashboardReassignPickupRider') : t('superAdminDashboardAssignPickupRider')}
                            </button>
                            {detailRiderActions.hasRider && (
                                <button
                                    type="button"
                                    onClick={() => handleUnassignRider(detailJob)}
                                    disabled={!detailRiderActions.canUnassign || unassigning}
                                    className="flex-1 h-11 rounded-full border border-[#fca5a5] bg-[#fff5f5] px-4 text-sm font-medium text-[#b91c1c] transition hover:bg-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {unassigning ? t('superAdminDashboardUnassigning') : t('superAdminDashboardUnassignRider')}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {detailJob && (detailRiderActions.isDoorToDoorMode || detailRiderActions.isDropPointToDoor) && (
                    <div className={`rounded-2xl border p-4 ${detailRiderActions.needsDeliveryRider ? 'border-amber-400 bg-amber-50' : 'border-[#e5e7eb]'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-sm font-semibold text-[#0f172a]">{t('superAdminDashboardColumnDeliveryRider')}</div>
                            {detailRiderActions.needsDeliveryRider && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-300">
                                    {t('superAdminDashboardActionRequired')}
                                </span>
                            )}
                        </div>
                        {detailRiderActions.needsDeliveryRider && (
                            <p className="text-xs text-amber-700 mb-3">
                                {t('superAdminDashboardDeliveryRiderActionRequiredDescription')}
                            </p>
                        )}
                        {detailRiderActions.hasDeliveryRider ? (
                            <div className="mb-3 text-sm text-[#374151]">
                                {t('statusAssigned')}: <span className="font-medium">{detailJob.deliveryRider}</span>
                            </div>
                        ) : !detailRiderActions.needsDeliveryRider && (
                            <p className="text-xs text-[#64748b] mb-3">
                                {t('superAdminDashboardDeliveryRiderDeferredDescription')}
                            </p>
                        )}
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => handleOpenDeliveryRiderModal(detailJob)}
                                disabled={!detailRiderActions.canAssignDelivery}
                                title={!detailRiderActions.canAssignDelivery ? t('superAdminDashboardDeliveryRiderDeferredTitle') : undefined}
                                className="flex-1 h-11 rounded-full border border-[#4f7df9] bg-white px-4 text-sm font-medium text-[#4f7df9] transition hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {detailRiderActions.hasDeliveryRider ? t('superAdminDashboardReassignDeliveryRider') : t('superAdminDashboardAssignDeliveryRider')}
                            </button>
                            {detailRiderActions.canUnassignDelivery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        router.patch(
                                            route('admin.shipments.unassign-delivery-rider', detailJob.id),
                                            {},
                                            {
                                                preserveScroll: true,
                                                onSuccess: () => {
                                                    closeDetailDrawer();
                                                    showNotification(t('commonDeliveryRiderUnassigned'), 'success');
                                                },
                                                onError: (errors) => {
                                                    const errMsg = Object.values(errors)[0] || t('superAdminDashboardUnassignDeliveryRiderFailed');
                                                    showNotification(errMsg, 'error');
                                                },
                                            },
                                        );
                                    }}
                                    className="flex-1 h-11 rounded-full border border-[#fca5a5] bg-[#fff5f5] px-4 text-sm font-medium text-[#b91c1c] transition hover:bg-[#fee2e2]"
                                >
                                    {t('superAdminDashboardUnassignDeliveryRider')}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="rounded-2xl border border-[#e5e7eb]">
                    <div className="p-5">
                        <div className="flex items-stretch gap-4">
                            <div className="flex flex-col items-center">
                                <span className="w-3 h-3 rounded-full border-2 border-[#4f7df9]" />
                                <span className="flex-1 w-px bg-[#e5e7eb]" />
                                <span className="w-3 h-3 rounded-full border-2 border-[#4f7df9] bg-[#2563eb]" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <div className="text-blue-500 text-sm font-semibold">{t('commonPickupLocation')}</div>
                                    <div className="text-sm text-[#111827]">{detailJob?.pickupLocation ?? detailJob?.sender ?? '--'}</div>
                                </div>
                                <div className="pt-2 border-t border-[#e5e7eb]">
                                    <div className="text-blue-500 text-sm font-semibold">{t('commonDropOffLocation')}</div>
                                    <div className="text-sm text-[#111827]">{detailJob?.dropoffLocation ?? detailJob?.receiver ?? '--'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1">
                    <div className="rounded-2xl border border-[#e5e7eb] mb-6">
                        <div className="p-5">
                            <h3 className="text-sm font-medium text-[#0f172a] mb-4">{t('commonOrderTracking')}</h3>
                            <div className="space-y-4">
                                {detailTrackingEvents.map((event, index) => (
                                    <div key={`${event.label}-${index}`} className="flex items-start gap-3">
                                        <div className="flex flex-col items-center pt-1">
                                            <span
                                                className={`w-3 h-3 rounded-full flex items-center justify-center ${
                                                    event.completed ? 'bg-[#2563eb]' : 'border-2 border-[#cbd5f5]'
                                                }`}
                                            />
                                            {!event.isLast && (
                                                <span
                                                    className={`w-px h-8 ${
                                                        event.connectorCompleted ? 'bg-[#2563eb]' : 'bg-[#e5e7eb]'
                                                    }`}
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <div
                                                className={`text-sm font-medium ${
                                                    event.completed ? 'text-[#111827]' : 'text-[#94a3b8]'
                                                }`}
                                            >
                                                {event.label}
                                            </div>
                                            <div className="text-xs text-[#64748b] mt-1">
                                                {event.timestamp || '--'}
                                            </div>
                                            {event.description && (
                                                <div className="text-xs text-[#94a3b8] mt-0.5">
                                                    {event.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {detailTrackingEvents.length === 0 && (
                                    <p className="text-xs text-[#94a3b8]">{t('superAdminDashboardTrackingUnavailable')}</p>
                                )}
                            </div>
                        </div>
                        </div>

                        <div className="border-t border-[#e5ecfb] pt-6">
                            <h3 className="text-base font-semibold text-[#0f172a] mb-4">{t('commonParcelDetails')}</h3>
                            <div className="bg-white divide-y divide-[#e5e7eb]">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 gap-x-10">
                                    {detailParcelItems.map((detail) => (
                                        <div key={detail.label} className="space-y-1">
                                            <p className="text-[#2563eb] uppercase text-xs font-semibold tracking-wide">{detail.label}</p>
                                            <p className="text-sm text-[#111827] font-medium">{detail.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-6">
                                    <div className="rounded-2xl border border-[#e5e7eb] p-4 bg-white">
                                        <h3 className="text-sm font-semibold text-[#0f172a] mb-2">{t('commonSenderDetails')}</h3>
                                        <p className="text-sm text-[#1f2937]"><span className="font-medium">{t('commonName')}:</span> {detailJob?.sender ?? detailJob?.raw?.sender ?? '--'}</p>
                                        <p className="text-sm text-[#1f2937]"><span className="font-medium">{t('commonPhone')}:</span> {detailJob?.senderPhone ?? detailJob?.raw?.sender_phone ?? detailJob?.raw?.senderPhone ?? '--'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-[#e5e7eb] p-4 bg-white">
                                        <h3 className="text-sm font-semibold text-[#0f172a] mb-2">{t('commonReceiverDetails')}</h3>
                                        <p className="text-sm text-[#1f2937]"><span className="font-medium">{t('commonName')}:</span> {detailJob?.receiver ?? detailJob?.raw?.receiver ?? '--'}</p>
                                        <p className="text-sm text-[#1f2937]"><span className="font-medium">{t('commonPhone')}:</span> {detailJob?.receiverPhone ?? detailJob?.raw?.receiver_phone ?? detailJob?.raw?.receiverPhone ?? '--'}</p>
                                    </div>
                                </div>

                                {isReturnedDetailJob && detailReturnReason && (
                                    <div className="p-6 pl-0">
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                                            <h3 className="text-sm font-semibold text-[#0f172a] mb-2">{t('commonReturnReason')}</h3>
                                            <p className="text-sm text-[#64748b]">{detailReturnReason}</p>
                                        </div>
                                    </div>
                                )}

                                {(!isReturnedDetailJob || detailReturnImages.length > 0) && (
                                    <div className="p-6 pl-0">
                                        <p className="text-sm font-semibold text-[#0f172a] mb-3">
                                            {isReturnedDetailJob ? t('superAdminDashboardReturnImages') : t('commonPhotos')}
                                        </p>
                                        <ImagePreviewGallery
                                            images={isReturnedDetailJob ? detailReturnImages : detailJob?.photos}
                                            altPrefix={isReturnedDetailJob ? 'dashboard-return-image' : 'dashboard-photo'}
                                            galleryLabel={isReturnedDetailJob ? t('superAdminDashboardReturnImages') : t('commonPhotos')}
                                            containerClassName="flex flex-wrap gap-3"
                                            thumbnailClassName="w-16 h-16 rounded-xl overflow-hidden border border-[#e5ecfb] bg-[#f8fafc]"
                                            emptyPlaceholderCount={isReturnedDetailJob ? 0 : 4}
                                            emptyPlaceholderClassName="w-16 h-16 rounded-xl overflow-hidden border border-[#e5ecfb] bg-[#f8fafc] border-dashed border-[#dbe4f3]"
                                        />
                                        {!isReturnedDetailJob && Array.isArray(detailJob?.additionalDocs) && detailJob.additionalDocs.length > 0 && (
                                            <div className="mt-6">
                                                <p className="text-sm font-semibold text-[#0f172a] mb-3">{t('commonAdditionalDocuments')}</p>
                                                <div className="flex gap-3 flex-wrap">
                                                    {detailJob.additionalDocs.map((url, idx) => (
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
                                )}

                                <div className="p-6 pl-0">
                                    <h3 className="text-sm font-semibold text-[#0f172a] mb-4">{t('superAdminDashboardSelectDeliverySpeed')}</h3>
                                    <div className="flex items-center gap-4 rounded-2xl border border-[#cbd5f5] bg-[#f8fbff] px-4 py-5">
                                        <span className="w-5 h-5 rounded-full border-2 border-[#2563eb] flex items-center justify-center">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-[#0f172a] capitalize">
                                                {detailDeliverySpeedLabel !== '--' ? detailDeliverySpeedLabel : t('commonNotSpecified')}
                                            </p>
                                            <p className="text-xs text-[#94a3b8] mt-0.5">{detailDeliverySpeedDescription}</p>
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const specialInstruction = detailJob?.specialInstruction
                                        ?? detailJob?.raw?.special_instruction
                                        ?? (detailJob?.raw?.specialInstructions ?? detailJob?.specialInstructions);
                                    if (!specialInstruction || !String(specialInstruction).trim()) {
                                        return null;
                                    }
                                    return (
                                        <div className="p-6 pl-0">
                                            <h3 className="text-sm font-semibold text-[#0f172a] mb-3">{t('commonSpecialInstruction')}</h3>
                                            <p className="text-sm text-[#64748b] leading-relaxed">
                                                {specialInstruction}
                                            </p>
                                        </div>
                                    );
                                })()}

                                <div className="p-6 pl-0">
                                    <h3 className="text-sm font-semibold text-[#0f172a] mb-3">{t('superAdminDashboardAddNotes')}</h3>
                                    <textarea
                                        value={adminNotesInput}
                                        onChange={(event) => setAdminNotesInput(event.target.value)}
                                        placeholder={t('superAdminDashboardNotesPlaceholder')}
                                        rows={4}
                                        maxLength={5000}
                                        disabled={!detailJob || savingAdminNotes}
                                        className="w-full rounded-xl border border-[#e2e8f0] px-4 py-3 text-sm text-[#0f172a] outline-none transition focus:border-[#4f7df9] focus:ring-2 focus:ring-[#4f7df933] disabled:cursor-not-allowed disabled:opacity-70"
                                    />
                                </div>

                                {detailReviewDetails && detailJob?.review?.some(item => item?.rating != null) && (
                                    <div className="p-6 px-0">
                                        {detailIsDirectDelivery && detailJob?.review?.rider && (
                                            <div className="mb-4">
                                                <p className="text-sm font-semibold text-[#2563eb] mb-1">{t('commonRider')}</p>
                                                <div className="flex items-center gap-2">
                                                    {detailJob.review.rider.avatar_path ? (
                                                        <img
                                                            src={detailJob.review.rider.avatar_path}
                                                            alt={detailJob.review.rider.name}
                                                            className="w-8 h-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                                            {detailJob.review.rider.name ? detailJob.review.rider.name.charAt(0).toUpperCase() : 'U'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{detailJob.review.rider.name || t('commonNotApplicable')}</p>
                                                        <p className="text-xs text-gray-500">{detailJob.review.rider.phone_number || ''}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <h3 className="text-base font-semibold text-[#0f172a] mb-2">{t('superAdminDashboardReviewsFeedback')}</h3>
                                        <p className="text-sm font-semibold text-[#2563eb] mt-4">{t('superAdminDashboardFeedbackLabel')}</p>
                                        <p className="text-sm text-[#111827] leading-relaxed mt-1">
                                            {detailReviewDetails.comment ?? t('superAdminDashboardNoFeedbackMessage')}
                                        </p>
                                        <div className="mt-5">
                                            {detailIsDirectDelivery ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {detailReviewDetails.metrics.map((metric) => (
                                                        <div key={metric.label} className="space-y-2">
                                                            <p className="text-xs font-semibold text-[#2563eb]">{metric.label}</p>
                                                            <div className="flex items-center gap-1">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <svg
                                                                        key={`${metric.label}-${star}`}
                                                                        viewBox="0 0 24 24"
                                                                        className={`w-5 h-5 ${star <= metric.score ? 'text-[#FFB31A]' : 'text-[#e2e8f0]'}`}
                                                                        fill="currentColor"
                                                                    >
                                                                        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
                                                                    </svg>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    {detailRatedEmployees.length > 0 ? (
                                                        detailRatedEmployees.map((review, index) => {
                                                            const keyBase = review?.employee_id ?? review?.id ?? review?.name ?? index;
                                                            const numericRating = Number(review?.rating);
                                                            const starCount = clampRatingValue(numericRating);
                                                            const ratingLabel = Number.isFinite(numericRating)
                                                                ? numericRating
                                                                : starCount;
                                                            return (
                                                                <div
                                                                    key={`${keyBase}-${review?.rating ?? index}`}
                                                                    className="flex items-center justify-between gap-3 border border-[#e5e7eb] rounded-[20px] px-4 py-3"
                                                                >
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-[#0f172a]">{review?.name || t('commonEmployee')}</p>
                                                                        <p className="text-xs text-[#64748b] capitalize">{review?.roles && review?.roles === "drop point keeper" ? t('commonDropPoint') : review?.roles}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-0.5">
                                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                                <svg
                                                                                    key={star}
                                                                                    className={`w-4 h-4 ${star <= starCount ? 'text-[#FFB31A]' : 'text-[#e2e8f0]'}`}
                                                                                    viewBox="0 0 24 24"
                                                                                    fill="currentColor"
                                                                                >
                                                                                    <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
                                                                                </svg>
                                                                            ))}
                                                                        </span>
                                                                        <span className="text-xs text-[#0f172a] font-semibold">
                                                                            {`${ratingLabel}/5`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <p className="text-sm text-[#64748b]">{t('superAdminDashboardNoEmployeeRatings')}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 pl-0 grid grid-cols-1 md:grid-cols-1 gap-8">
                                    {detailJob?.rider && detailJob.rider !== '--' && (
                                        <div>
                                            <h4 className="mb-3 text-sm font-semibold text-[#0f172a]">{t('commonRiderDetails')}</h4>
                                            <div className="overflow-hidden">
                                                <table className="w-full text-sm text-[#0f172a]">
                                                    <thead className="text-xs text-[#338dff]">
                                                        <tr>
                                                            <th className="text-left pb-2">{t('commonName')}</th>
                                                            <th className="text-right pb-2">{t('commonVehicleType')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td className="font-medium pb-2">{detailJob.rider}</td>
                                                            <td className="text-right font-medium pb-2">{detailJob?.vehicleType ?? '--'}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="mb-3 text-sm font-semibold text-[#0f172a]">{t('commonPaymentDetails')}</h4>
                                        <div className="overflow-hidden">
                                            {paymentSummary ? (
                                                <table className="w-full text-sm text-gray-600 details-table">
                                                    <tbody>
                                                        {isReturnedDetailJob ? (
                                                            <tr>
                                                                <td className="font-medium border-b border-[#e5e7eb] text-gray-700">{t('commonReturnDeliveryFee')}</td>
                                                                <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959]">
                                                                    {formatDashboardCurrency(paymentSummary.shipmentFee)}
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            <>
                                                                {paymentSummary.isDirectDelivery ? (
                                                                    <tr>
                                                                        <td className="font-medium border-b border-[#e5e7eb] text-gray-700">{paymentSummary.feeLabel}</td>
                                                                        <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959]">
                                                                            {formatDashboardCurrency(paymentSummary.shipmentFee)}
                                                                        </td>
                                                                    </tr>
                                                                ) : (
                                                                    <>
                                                                        <tr>
                                                                            <td className="font-medium border-b border-[#e5e7eb] text-gray-700">{t('commonSenderDoorServiceFee')}</td>
                                                                            <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959]">
                                                                                {formatDashboardCurrency(paymentSummary.senderZoneDeliveryFee)}
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td className="font-medium border-b border-[#e5e7eb] text-gray-700">{t('commonReceiverDoorServiceFee')}</td>
                                                                            <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959]">
                                                                                {formatDashboardCurrency(paymentSummary.receiverZoneDeliveryFee)}
                                                                            </td>
                                                                        </tr>
                                                                    </>
                                                                )}
                                                                {paymentSummary.goodsAmount > 0 && (
                                                                    <tr>
                                                                        <td className="py-3 font-medium border-b border-[#e5e7eb] text-gray-700 text-sm">{t('commonGoodsCost')}</td>
                                                                        <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959] text-sm">{formatDashboardCurrency(paymentSummary.goodsAmount)}</td>
                                                                    </tr>
                                                                )}
                                                                <tr>
                                                                    <td className="py-3 font-medium border-b border-[#e5e7eb] text-gray-700 text-sm">{t('commonBasicFee')}</td>
                                                                    <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959] text-sm">{formatDashboardCurrency(paymentSummary.serviceFee)}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="py-3 font-medium border-b border-[#e5e7eb] text-gray-700 text-sm">{t('commonInsuranceFee')}</td>
                                                                    <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959] text-sm">{formatDashboardCurrency(paymentSummary.insuranceFee)}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="py-3 font-semibold border-b border-[#e5e7eb] text-gray-900 text-sm">{t('commonSubtotal')}</td>
                                                                    <td className="py-3 text-right border-b border-[#e5e7eb] text-sm font-bold text-gray-900">
                                                                        {formatDashboardCurrency(paymentSummary.subtotal)}
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="py-3 font-medium border-b border-[#e5e7eb] text-gray-700 text-sm">{t('commonPlatformFee')}</td>
                                                                    <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959] text-sm">{formatDashboardCurrency(paymentSummary.platformFee)}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="py-3 font-medium border-b border-[#e5e7eb] text-gray-700 text-sm">{paymentSummary.vatLabel ?? t('commonVat')}</td>
                                                                    <td className="py-3 text-right border-b border-[#e5e7eb] font-medium text-[#595959] text-sm">{formatDashboardCurrency(paymentSummary.vat)}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="py-3 font-semibold border-b border-[#e5e7eb] text-gray-900 text-sm">{t('commonTotal')}</td>
                                                                    <td className="py-3 text-right border-b border-[#e5e7eb] font-bold text-gray-900 text-sm">
                                                                        {formatDashboardCurrency(paymentSummary.total)}
                                                                    </td>
                                                                </tr>
                                                            </>
                                                        )}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="px-4 py-6 text-sm text-[#64748b]">
                                                    {t('commonPaymentSummaryUnavailable')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                </div>
            </Drawer>

            {showAssignDrawer && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={handleCloseAssignDrawer} aria-hidden="true" />
                    <div className="absolute inset-y-0 right-0 w-full max-w-[440px] bg-white rounded-l-[28px] border border-[#e5e7eb] shadow-[0_20px_45px_rgba(15,23,42,0.25)] transition-transform duration-300 ease-out flex flex-col h-full">
                        <div className="px-6 pt-6 pb-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    {/* {selectedJob?.rider && selectedJob.rider.trim() !== '' && (
                                        <h2 className="text-lg font-semibold text-[#0f172a]">{selectedJob.receiver}</h2>
                                    )} */}
                                    <p className="text-sm text-[#64748b] mt-1">{selectedJob?.shipId} • {selectedJob?.shipmentType}</p>
                                </div>
                                <button
                                type="button"
                                onClick={handleCloseAssignDrawer}
                                className="text-[#64748b] hover:text-gray-500"
                                aria-label={t('commonClose')}
                                >
                                <svg
                                    className="w-6 h-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                                </button>
                            </div>
                            <div className="mt-4 h-px bg-[#e5e7eb]" />
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">

                                {/* Pickup/Drop-off section */}
                                <div className="rounded-2xl border border-[#e5e7eb]">
                                    <div className="p-5">
                                        <div className="flex items-start gap-4">
                                            <div className="flex flex-col items-center pt-1">
                                                <span className="w-3 h-3 rounded-full border-2 border-[#4f7df9]" />
                                                <span className="w-px h-8 bg-[#e5e7eb]" />
                                                <span className="w-3 h-3 rounded-full bg-[#2563eb]" />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <div className="text-[#2563eb] font-medium">{t('commonPickupLocation')}</div>
                                                    <div className="text-sm text-[#111827]">{selectedJob?.pickupLocation ?? '--'}</div>
                                                </div>
                                                <div className="pt-2 border-t border-[#e5e7eb]">
                                                    <div className="text-[#2563eb] font-medium">{t('commonDropOffLocation')}</div>
                                                    <div className="text-sm text-[#111827]">{selectedJob?.dropoffLocation ?? '--'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* QR + Shipment details grid */}
                                <div className="rounded-2xl border border-[#e5e7eb] p-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                                        <div className="sm:col-span-1">
                                            <QRCode
                                                size={120}
                                                className="rounded-lg border border-[#e5e7eb]"
                                                data={JSON.stringify({
                                                    id: selectedJob?.id || selectedJob?.raw?.id || null,
                                                    order_number: selectedJob?.raw?.order_number || selectedJob?.raw?.orderNumber || null,
                                                    tracking_number: selectedJob?.raw?.tracking_number || `SHIP-${String(selectedJob?.id || '').padStart(8, '0')}`,
                                                    ship_id: selectedJob?.shipId || null,
                                                    weight: selectedJob?.weight || selectedJob?.raw?.weight || null,
                                                    size: selectedJob?.size?.name || selectedJob?.size || selectedJob?.raw?.size?.name || null,
                                                    dimensions: (selectedJob?.raw?.custom_length || selectedJob?.raw?.custom_width || selectedJob?.raw?.custom_height) ? {
                                                        length: selectedJob?.raw?.custom_length || null,
                                                        width: selectedJob?.raw?.custom_width || null,
                                                        height: selectedJob?.raw?.custom_height || null
                                                    } : null,
                                                    value: selectedJob?.raw?.parcel_amount || selectedJob?.totalFee || null,
                                                    insurance: selectedJob?.insurance || selectedJob?.raw?.insurance || null,
                                                    payment: {
                                                        method: selectedJob?.paymentMethod || selectedJob?.raw?.payment_method || null,
                                                        status: selectedJob?.paymentStatus || selectedJob?.raw?.payment_status || null,
                                                        total_fee: selectedJob?.totalFee || selectedJob?.raw?.total_fee || 0
                                                    },
                                                    delivery_speed: selectedJob?.deliverySpeed || selectedJob?.raw?.delivery_speed || null,
                                                    status: selectedJob?.status || selectedJob?.raw?.status || null
                                                })}
                                            />
                                        </div>
                                        <div className="sm:col-span-2 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                                            <div className="text-[#64748b]">{t('commonShipId')}</div>
                                            <div className="text-[#111827] font-medium">{selectedJob?.shipId}</div>
                                            <div className="text-[#64748b]">{t('commonWeight')}</div>
                                            <div className="text-[#111827] font-medium">{selectedJob?.weightText ?? '--'}</div>
                                            <div className="text-[#64748b]">{t('commonInsurance')}</div>
                                            <div className="text-[#111827] font-medium">{selectedJob?.insuranceText ?? '--'}</div>
                                            <div className="text-[#64748b]">{t('commonSize')}</div>
                                            <div className="text-[#111827] font-medium">{selectedJob?.sizeText ?? '--'}</div>
                                            <div className="text-[#64748b]">{t('commonValue')}</div>
                                            <div className="text-[#111827] font-medium">{selectedJob?.valueText ?? '--'}</div>
                                            <div className="text-[#64748b]">{t('commonPaymentStatus')}</div>
                                            <div className="text-[#111827] font-medium">{selectedJob?.paymentStatus ?? '--'}</div>
                                            <div className="text-[#64748b]">{t('commonAcceptReturns')}</div>
                                            <div className="text-[#111827] font-medium">{(selectedJob?.raw?.accept_returns === 1 || selectedJob?.raw?.accept_returns === true || selectedJob?.raw?.accept_returns === '1') ? t('commonYes') : t('commonNo')}</div>
                                        </div>
                                    </div>
                                </div>
                                {isReturnedAssignJob && assignReturnReason && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                                        <h3 className="text-sm font-medium text-[#0f172a] mb-2">{t('commonReturnReason')}</h3>
                                        <p className="text-sm text-[#64748b]">{assignReturnReason}</p>
                                    </div>
                                )}
                                {(!isReturnedAssignJob || assignReturnImages.length > 0) && (
                                    <div>
                                        <h3 className="text-sm font-medium text-[#0f172a] mb-2">
                                            {isReturnedAssignJob ? t('superAdminDashboardReturnImages') : t('commonPhotos')}
                                        </h3>
                                        <ImagePreviewGallery
                                            images={isReturnedAssignJob ? assignReturnImages : selectedJob?.photos}
                                            altPrefix={isReturnedAssignJob ? 'dashboard-assign-return-image' : 'dashboard-assign-photo'}
                                            galleryLabel={isReturnedAssignJob ? t('superAdminDashboardReturnImages') : t('commonPhotos')}
                                            containerClassName="flex gap-3"
                                            thumbnailClassName="w-[64px] h-[64px] rounded-xl bg-[#f3f4f6] border border-[#e5e7eb] overflow-hidden"
                                            emptyPlaceholderCount={isReturnedAssignJob ? 0 : 4}
                                            emptyPlaceholderClassName="w-[64px] h-[64px] rounded-xl bg-[#f3f4f6] border border-[#e5e7eb] overflow-hidden"
                                        />
                                        {!isReturnedAssignJob && Array.isArray(selectedJob?.additionalDocs) && selectedJob.additionalDocs.length > 0 && (
                                            <div className="mt-6">
                                                <p className="text-sm font-semibold text-[#0f172a] mb-3">{t('commonAdditionalDocuments')}</p>
                                                <div className="flex gap-3 flex-wrap">
                                                    {selectedJob.additionalDocs.map((url, idx) => (
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
                                )}
                                {(() => {
                                    const specialInstruction = selectedJob?.specialInstruction
                                        ?? selectedJob?.raw?.special_instruction
                                        ?? (selectedJob?.raw?.specialInstructions ?? selectedJob?.specialInstructions);
                                    if (!specialInstruction || !String(specialInstruction).trim()) {
                                        return null;
                                    }
                                    return (
                                        <div>
                                            <h3 className="text-sm font-medium text-[#0f172a] mb-2">{t('commonSpecialInstruction')}</h3>
                                            <p className="text-sm text-[#64748b]">{specialInstruction}</p>
                                        </div>
                                    );
                                })()}

                                <div>
                                    <h3 className="text-sm font-medium text-[#0f172a] mb-3">{t('commonPaymentDetails')}</h3>
                                    <div className="divide-y rounded-2xl border border-[#e5e7eb]">
                                        {paymentSummary ? (
                                            isReturnedAssignJob ? (
                                                <div className="px-5 py-3 flex items-center justify-between rounded-2xl bg-transparent">
                                                    <span className="text-sm text-[#475569]">{t('commonReturnDeliveryFee')}</span>
                                                    <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.shipmentFee)}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    {paymentSummary.isDirectDelivery ? (
                                                        <div className="px-5 py-3 flex items-center justify-between rounded-t-2xl bg-transparent">
                                                            <span className="text-sm text-[#475569]">{paymentSummary.feeLabel}</span>
                                                            <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.shipmentFee)}</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="px-5 py-3 flex items-center justify-between rounded-t-2xl bg-transparent">
                                                                <span className="text-sm text-[#475569]">{t('commonSenderDoorServiceFee')}</span>
                                                                <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.senderZoneDeliveryFee)}</span>
                                                            </div>
                                                            <div className="px-5 py-3 flex items-center justify-between">
                                                                <span className="text-sm text-[#475569]">{t('commonReceiverDoorServiceFee')}</span>
                                                                <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.receiverZoneDeliveryFee)}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    {paymentSummary.goodsAmount > 0 && (
                                                        <div className="px-5 py-3 flex items-center justify-between">
                                                            <span className="text-sm text-[#475569]">{t('commonGoodsCost')}</span>
                                                            <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.goodsAmount)}</span>
                                                        </div>
                                                    )}
                                                    <div className="px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm text-[#475569]">{t('commonBasicFee')}</span>
                                                        <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.serviceFee)}</span>
                                                    </div>
                                                    <div className="px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm text-[#475569]">{t('commonInsuranceFee')}</span>
                                                        <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.insuranceFee)}</span>
                                                    </div>
                                                    <div className="px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm text-[#0f172a] font-semibold">{t('commonSubtotal')}</span>
                                                        <span className="text-sm font-bold text-gray-900">{formatDashboardCurrency(paymentSummary.subtotal)}</span>
                                                    </div>
                                                    <div className="px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm text-[#475569]">{t('commonPlatformFee')}</span>
                                                        <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.platformFee)}</span>
                                                    </div>
                                                    <div className="px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm text-[#475569]">{paymentSummary.vatLabel ?? t('commonVat')}</span>
                                                        <span className="text-sm text-[#111827]">{formatDashboardCurrency(paymentSummary.vat)}</span>
                                                    </div>
                                                    <div className="px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm text-[#0f172a] font-semibold">{t('commonTotal')}</span>
                                                        <span className="text-sm font-bold text-gray-900">{formatDashboardCurrency(paymentSummary.total)}</span>
                                                    </div>
                                                </>
                                            )
                                        ) : (
                                            <div className="px-5 py-3 text-sm text-[#64748b]">{t('commonPaymentSummaryUnavailable')}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        <div className="px-6 pb-6 pt-3 mt-auto">
                            {isDoorToDoorJob(selectedJob) && (
                                <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
                                    <span className="font-semibold">{t('superAdminDashboardDoorToDoorOrderLabel')}:</span> {t('superAdminDashboardDoorToDoorOrderDescription')}
                                </div>
                            )}
                            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#475569]">
                                <span>{t('superAdminDashboardSendSmsToRider')}</span>
                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-[#338DFF] focus:ring-[#338DFF]"
                                        checked={sendRiderSms}
                                        onChange={(event) => setSendRiderSms(event.target.checked)}
                                    />
                                </label>
                            </div>
                            <div className="flex items-center gap-4">
                                <OutlineButton
                                    text={t('superAdminDashboardManualButton')}
                                    onClick={() => { setAssignStep('pickup'); setShowRidersModal(true); }}
                                    className="flex-1 h-[54px] rounded-full border-2 border-[#6eb0ff] text-blue-500 font-medium ">
                                </OutlineButton>
                                <PrimaryButton
                                    text={t('superAdminDashboardAutoAssignButton')}
                                    onClick={handleAutoAssign}
                                    disabled={assigning}
                                    className="flex-1 h-[54px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showRidersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d3d5c]/90 px-6 py-10">
                    <div className="w-full max-w-[880px] bg-white rounded-[28px] shadow-[0_25px_55px_rgba(15,23,42,0.25)] flex flex-col gap-6 p-6 sm:p-8 lg:p-10">
                        <style>{`.mp-checkbox{width:18px;height:18px;border-radius:4px;border:1.5px solid #cbd5f5;display:inline-flex;align-items:center;justify-content:center;background:#fff;font-size:12px;color:#4f7df9;appearance:none;-webkit-appearance:none;cursor:pointer;transition:background 120ms ease,border 120ms ease}.mp-checkbox:checked{background:#4f7df9;border-color:#4f7df9;color:#fff}.mp-checkbox:checked::after{content:'✓';font-size:12px;line-height:1}.mp-checkbox:focus-visible{outline:2px solid rgba(79,125,249,.6);outline-offset:2px}`}</style>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-[1.5rem] font-semibold text-[#4f7df9]">
                                    {isDeliveryRiderModal ? t('superAdminDashboardSelectDeliveryRiderTitle') : t('superAdminDashboardSelectRiderTitle')}
                                </h1>
                                {isDeliveryRiderModal && (
                                    <p className="text-xs text-amber-700 mt-1">{t('superAdminDashboardSelectDeliveryRiderDescription')}</p>
                                )}
                            </div>
                            <div className="w-full sm:w-auto flex-1 sm:flex-none max-w-[320px]">
                                <input type="text" placeholder={t('superAdminDashboardSearchRidersPlaceholder')} value={riderSearch} onChange={(e)=>setRiderSearch(e.target.value)} className="w-full rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-5 py-3 text-[0.95rem] text-[#1f2937] outline-none transition focus:border-[#4f7df9] focus:ring-4 focus:ring-[#4f7df933]" />
                            </div>
                        </div>
                        {zoneFilterMessage && (
                            <div className="text-xs text-[#64748b] -mt-2">
                                {zoneFilterMessage}
                            </div>
                        )}
                        <div className="border border-[#e5e7eb] rounded-[20px] overflow-hidden overflow-x-auto overflow-y-auto max-h-[370px] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
                            <table className="w-full min-w-[640px] sm:min-w-[720px] border-collapse text-left text-[0.95rem]">
                                <thead>
                                    <tr className="bg-[#f9fafb] text-[#6b7280]">
                                        <th className="px-5 py-[14px] border-b border-[#e5e7eb] font-medium text-[0.9rem] whitespace-nowrap">{t('superAdminDashboardAssignSheetColumnRiderId')}</th>
                                        <th className="px-5 py-[14px] border-b border-[#e5e7eb] font-medium text-[0.9rem] whitespace-nowrap">{t('superAdminDashboardAssignSheetColumnRiderName')}</th>
                                        <th className="px-5 py-[14px] border-b border-[#e5e7eb] font-medium text-[0.9rem] whitespace-nowrap">{t('commonShipmentType')}</th>
                                        <th className="px-5 py-[14px] border-b border-[#e5e7eb] font-medium text-[0.9rem] whitespace-nowrap">{t('commonVehicleType')}</th>
                                        <th className="px-5 py-[14px] border-b border-[#e5e7eb] font-medium text-[0.9rem] whitespace-nowrap">{t('commonStatus')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[#1f2937]">
                                    {filteredRiders.map((rider) => {
                                        const currentSelectedId = isDeliveryRiderModal ? selectedDeliveryRiderId : selectedRiderId;
                                        const available = isRiderAvailable(rider);
                                        return (
                                            <tr key={rider.id} className="even:bg-[#f5f7fb] hover:bg-[#4f7df914] transition-colors">
                                                <td className="px-5 py-[14px] whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            className="mp-checkbox shrink-0"
                                                            checked={currentSelectedId === rider.id}
                                                            onChange={() => {
                                                                if (isDeliveryRiderModal) {
                                                                    setSelectedDeliveryRiderId(selectedDeliveryRiderId === rider.id ? null : rider.id);
                                                                } else {
                                                                    setSelectedRiderId(selectedRiderId === rider.id ? null : rider.id);
                                                                }
                                                            }}
                                                            aria-label={t('superAdminDashboardSelectRiderAria', { code: rider.code })}
                                                        />
                                                        {rider.code}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-[14px] whitespace-nowrap">{rider.name}</td>
                                                <td className="px-5 py-[14px] whitespace-nowrap">{rider.deliverySpeedLabel ?? rider.shipmentType ?? '--'}</td>
                                                <td className="px-5 py-[14px] whitespace-nowrap">{rider.vehicleType}</td>
                                                <td className="px-5 py-[14px] whitespace-nowrap">{available ? (
                                                    <span className="inline-flex min-w-[112px] justify-center rounded-full border border-[rgba(56,189,149,0.4)] bg-[rgba(56,189,149,0.12)] px-4 py-1 text-[0.9rem] font-medium text-[#1f8a70]">{t('commonAvailable')}</span>
                                                ) : (
                                                    <span className="inline-flex min-w-[112px] justify-center rounded-full border border-[rgba(156,163,175,0.35)] bg-[rgba(156,163,175,0.15)] px-4 py-1 text-[0.9rem] font-medium text-[#6b7280]">{t('commonNotAvailable')}</span>
                                                )}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-[#4f7df9] focus:ring-[#4f7df9]"
                                    checked={sendRiderSms}
                                    onChange={(event) => setSendRiderSms(event.target.checked)}
                                />
                                {t('superAdminDashboardSendSmsToRider')}
                            </label>
                        </div>
                        <div className="mt-3 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 sm:justify-end justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRidersModal(false);
                                    setIsDeliveryRiderModal(false);
                                    setAssignStep('pickup');
                                    setRiderSearch('');
                                }}
                                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-[#4f7df9] px-8 py-3 text-base font-medium text-[#4f7df9]"
                            >
                                {t('commonCancel')}
                            </button>
                            <PrimaryButton
                                type="button"
                                disabled={assigning || (isDeliveryRiderModal ? !selectedDeliveryRiderId : !selectedRiderId)}
                                onClick={isDeliveryRiderModal ? submitDeliveryRiderAssignment : submitAssignment}
                                width="170px"
                                text={assigning ? t('commonAssigning') : t('commonAssign')}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Notification */}
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

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateX(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-in-out;
                }
            `}</style>

            {/* Error Modal */}
            {showErrorModal && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30"
                    onClick={() => setShowErrorModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center">
                            {/* Error Icon */}
                            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            {/* Error Title */}
                            <h2 className="text-2xl font-bold text-blue-500 mb-4">{t('commonPleaseReview')}</h2>

                            {/* Error Message */}
                            <p className="text-gray-600 mb-8">{errorMessage}</p>

                            {/* Got it Button */}
                            <button
                                onClick={() => setShowErrorModal(false)}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-full transition-colors"
                            >
                                {t('commonGotIt')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30"
                    onClick={() => setShowSuccessModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center">
                            {/* Success Icon */}
                            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            {/* Success Title */}
                            <h2 className="text-2xl font-bold text-blue-500 mb-4">{t('commonSuccess')}</h2>

                            {/* Success Message */}
                            <p className="text-gray-600 mb-8">{t('superAdminDashboardAssignmentSuccessMessage')}</p>

                            {/* Great Button */}
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-full transition-colors"
                            >
                                {t('commonGreat')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unassign Confirmation Modal */}
            {showUnassignModal && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30"
                    onClick={() => {
                        if (!unassigning) {
                            setShowUnassignModal(false);
                            setUnassignTarget(null);
                        }
                    }}
                >
                    <div
                        className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4m0 4h.01" />
                                </svg>
                            </div>

                            <h2 className="text-2xl font-bold text-blue-500 mb-4">{t('commonConfirm')}</h2>
                            <p className="text-gray-600 mb-8">
                                {t('superAdminDashboardUnassignConfirmMessage')}
                            </p>

                            <div className="flex w-full flex-col gap-3 sm:flex-row">
                                <button
                                    onClick={() => {
                                        if (!unassigning) {
                                            setShowUnassignModal(false);
                                            setUnassignTarget(null);
                                        }
                                    }}
                                    disabled={unassigning}
                                    className="flex-1 border border-blue-500 text-blue-500 font-semibold py-4 px-6 rounded-full transition-colors hover:bg-blue-50 disabled:opacity-60"
                                >
                                    {t('commonCancel')}
                                </button>
                                <button
                                    onClick={confirmUnassignRider}
                                    disabled={unassigning}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-60"
                                >
                                    {unassigning ? t('superAdminDashboardUnassigning') : t('commonOk')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminAuthenticated>
    );
}
