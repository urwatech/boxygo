export const PAGE_SIZE = 10;
export const SUPPORT_PHONE_NUMBER = '0112140042';

export const SHARE_OPTIONS = [
    { id: 'whatsapp', icon: '/assets/images/whatsapp.svg', label: 'WhatsApp' },
    { id: 'facebook', icon: '/assets/images/fb.svg', label: 'Facebook' },
    { id: 'instagram', icon: '/assets/images/ig.svg', label: 'Instagram' },
    { id: 'copy', icon: '/assets/images/link.svg', label: 'Copy link' },
];

export const getCsrfHeaders = () => {
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

export const normalizeValueKey = (value) => {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'boolean') {
        return value ? 'yes' : 'no';
    }
    return value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

const VALUE_TRANSLATION_MAP = {
    pending: 'statusPending',
    pending_payment: 'statusPending',
    unpaid: 'statusPending',
    in_progress: 'statusInProgress',
    progress: 'statusInProgress',
    in_transit: 'statusInTransit',
    transit: 'statusInTransit',
    door_in_transit: 'timelineInTransitToCustomer',
    completed: 'statusCompleted',
    complete: 'statusCompleted',
    delivered: 'statusDelivered',
    delivery: 'statusDelivered',
    paid: 'statusCompleted',
    cancelled: 'statusCancelled',
    canceled: 'statusCancelled',
    assigned: 'statusAssigned',
    pickup: 'statusPickup',
    picked_up: 'statusPickup',
    picked: 'statusPickup',
    ready_for_pickup: 'notificationReadyForPickupTitle',
    ready_pickup: 'notificationReadyForPickupTitle',
    picked_up_by_receiver: 'shipmentsTimelinePickedUpByReceiver',
    picked_by_receiver: 'shipmentsTimelinePickedUpByReceiver',
    pending_handover: 'timelinePendingHandover',
    pendinghandover: 'timelinePendingHandover',
    delivered_to_drop_point_1: 'timelineDeliveredDropPoint1',
    delivered_drop_point_1: 'timelineDeliveredDropPoint1',
    arrived_at_drop_point: 'shipmentsTimelineArrivedDropPoint',
    arrived_drop_point: 'shipmentsTimelineArrivedDropPoint',
    arrived_at_drop_point_1: 'timelineArrivedDropPoint1',
    arrived_drop_point_1: 'timelineArrivedDropPoint1',
    arrived_at_drop_point_2: 'timelineArrivedDropPoint2',
    arrived_drop_point_2: 'timelineArrivedDropPoint2',
    dispatched_to_warehouse: 'timelineDispatchedToWarehouse',
    dispatched_warehouse: 'timelineDispatchedToWarehouse',
    arrived_at_warehouse: 'timelineArrivedWarehouse',
    arrived_warehouse: 'timelineArrivedWarehouse',
    dispatched_from_drop_point_2: 'timelineDispatchedDropPoint2',
    dispatched_drop_point_2: 'timelineDispatchedDropPoint2',
    pickup_from_drop_point_2: 'timelinePickupDropPoint2',
    pickup_drop_point_2: 'timelinePickupDropPoint2',
    door_pickup_point: 'shipmentsDoorPickupPoint',
    documents: 'commonDocuments',
    fragile: 'createBookingConsignmentFragile',
    fragile_materials: 'createBookingConsignmentFragileMaterials',
    electronics: 'createBookingConsignmentElectronics',
    sensitive_electronics: 'createBookingConsignmentSensitiveElectronics',
    clothing_textiles_and_shoes: 'createBookingConsignmentClothingTextilesShoes',
    household_electrical_appliances: 'createBookingConsignmentHouseholdElectricalAppliances',
    furniture: 'createBookingConsignmentFurniture',
    dry_sealed_packaged_food_items: 'createBookingConsignmentDryFoodItems',
    spare_parts: 'createBookingConsignmentSpareParts',
    other_materials_must_be_specified: 'createBookingConsignmentOtherMaterials',
    direct: 'deliverySpeedDirect',
    direct_dd: 'deliverySpeedDirect',
    in_direct: 'deliverySpeedIndirect',
    indirect: 'deliverySpeedIndirect',
    in_direct_dp: 'deliverySpeedIndirect',
    door_to_door: 'createBookingRouteDoorToDoor',
    door_to_drop_point: 'createBookingRouteDoorToDrop',
    drop_point_to_door: 'createBookingRouteDropToDoor',
    drop_point_to_drop_point: 'createBookingRouteDropToDrop',
    yes: 'commonYes',
    true: 'commonYes',
    '1': 'commonYes',
    no: 'commonNo',
    false: 'commonNo',
    '0': 'commonNo',
    receiver: 'shipmentsPaidByReceiver',
    paid_by_receiver: 'shipmentsPaidByReceiver',
    not_assigned: 'statusUnassigned',
    notassigned: 'statusUnassigned',
};

export const getTranslationKeyForValue = (value) => {
    const normalized = normalizeValueKey(value);
    if (!normalized) {
        return null;
    }
    if (VALUE_TRANSLATION_MAP[normalized]) {
        return VALUE_TRANSLATION_MAP[normalized];
    }
    const withoutAt = normalized.replace(/_at_/g, '_').replace(/__+/g, '_');
    if (VALUE_TRANSLATION_MAP[withoutAt]) {
        return VALUE_TRANSLATION_MAP[withoutAt];
    }
    return null;
};

export const translateEnumeratedValue = (value, t, fallback = null) => {
    const key = getTranslationKeyForValue(value);
    if (key) {
        return t(key);
    }
    if (fallback !== null && fallback !== undefined) {
        return fallback;
    }
    return value ?? '';
};

export const toDateOnly = (value) => {
    if (!value) return '';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toISOString().slice(0, 10);
    } catch {
        return String(value);
    }
};

export const formatPrintDate = (value) => {
    if (!value) return '';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        const formatted = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
        });
        const parts = formatted.split(' ').filter(Boolean);
        if (parts.length === 3) {
            return `${parts[0]} ${parts[1]}, ${parts[2]}`;
        }
        return formatted.replace(/\s+/g, ' ');
    } catch {
        return String(value);
    }
};

export const extractPrimaryLocation = (value) => {
    if (!value && value !== 0) {
        return '';
    }
    const stringValue = String(value);
    const [first] = stringValue.split(',');
    return (first && first.trim()) || stringValue.trim();
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const getCityCodeByCoordinates = (latitude, longitude, citiesArray) => {
    if (!latitude || !longitude || !citiesArray || citiesArray.length === 0) {
        return '';
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return '';
    }

    let closestCity = null;
    let minDistance = Infinity;

    citiesArray.forEach((city) => {
        if (city.latitude && city.longitude) {
            const cityLat = parseFloat(city.latitude);
            const cityLon = parseFloat(city.longitude);

            if (!Number.isNaN(cityLat) && !Number.isNaN(cityLon)) {
                const distance = calculateDistance(lat, lon, cityLat, cityLon);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCity = city;
                }
            }
        }
    });

    return closestCity?.short_code || '';
};

export const statusKeyFromString = (status) => {
    if (!status) return null;
    const normalized = String(status).toLowerCase().replace(/[-_\s]+/g, '');
    if (normalized === 'notassigned' || normalized.includes('notassigned')) return 'not_assigned';
    if (normalized === 'incomplete') return 'incomplete';
    if (normalized.includes('complete') || normalized.includes('deliver')) return 'completed';
    if (normalized.includes('pickedupbyreceiver') || normalized.includes('readyforpickup')) return 'completed';
    if (normalized.includes('progress') || normalized.includes('transit') || normalized.includes('assign')) return 'in_progress';
    if (normalized.includes('cancel') || normalized.includes('fail')) return 'cancelled';
    if (normalized === 'pending' || normalized === 'new') return 'pending';
    if (normalized.includes('pendinghandover')) return 'in_progress';
    return null;
};

export const statusColor = (status) => {
    const key = statusKeyFromString(status);
    switch (key) {
        case 'in_progress':
            return 'blue';
        case 'completed':
            return 'green';
        case 'cancelled':
        case 'incomplete':
            return 'red';
        case 'not_assigned':
            return 'gray';
        default:
            return 'yellow';
    }
};

export const statusLabel = (status, t) => {
    const overrideKey = getTranslationKeyForValue(status);
    if (overrideKey) {
        return t(overrideKey);
    }
    const key = statusKeyFromString(status);
    if (!key) {
        return status ? String(status) : t('statusPending');
    }
    const labelMap = {
        pending: t('statusPending'),
        in_progress: t('statusInProgress'),
        completed: t('statusCompleted'),
        cancelled: t('statusCancelled'),
        incomplete: t('shipmentsStatusIncomplete'),
    };
    return labelMap[key] ?? (status ? String(status) : t('statusPending'));
};

export const resolveDeliverySpeed = (shipment, fallback = '') => {
    if (!shipment) {
        return fallback;
    }

    return shipment.delivery_speed ?? shipment.deliverySpeed ?? shipment.speed ?? fallback;
};

export const isDirectDeliverySpeed = (value) => {
    return `${value ?? ''}`.trim().toLowerCase().startsWith('direct');
};

export const getEmployeeIdentifier = (employee, index) => {
    const candidate =
        employee?.id ??
        employee?.employee_id ??
        employee?.user_id ??
        employee?.user?.id ??
        null;
    return candidate !== null && candidate !== undefined
        ? String(candidate)
        : `employee-${index}`;
};

export const formatTimelineTimestamp = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const time = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const day = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
    });

    return `${time}, ${day.replace(/\s+/g, ' ')}`;
};

export const resolveShipmentAmount = (shipment) => {
    if (!shipment) {
        return null;
    }

    const rawAmount = shipment?.total_fee
        ?? shipment?.totalFee
        ?? shipment?.parcel_amount
        ?? shipment?.parcelAmount
        ?? 80;

    const numericAmount = Number(rawAmount);
    if (Number.isFinite(numericAmount)) {
        return numericAmount;
    }

    return 80;
};

export const parseCurrencyValue = (value) => {
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

export const normalizeDeliverySpeedKey = (value) => {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized.startsWith('direct')) {
        return 'direct';
    }
    if (normalized.startsWith('in') || normalized.includes('indirect')) {
        return 'indirect';
    }
    return 'direct';
};

export const buildVatLabel = (deliverySpeed, financialSettings = {}) => {
    const speedKey = normalizeDeliverySpeedKey(deliverySpeed);
    const typeKey = `${speedKey}_vat_type`;
    const valueKey = `${speedKey}_vat_value`;

    const rawType = financialSettings?.[typeKey];
    const normalizedType = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';

    if (normalizedType === 'percentage') {
        const rawValue = financialSettings?.[valueKey];
        const cleanedValue = rawValue == null
            ? ''
            : String(rawValue).replace('%', '').trim();
        const suffix = cleanedValue ? `${cleanedValue}%` : '%';
        return `VAT ${suffix}`;
    }

    if (rawType) {
        return `VAT (${rawType})`;
    }

    return 'VAT';
};

export const parseVatNumericValue = (value) => {
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

export const parseVatRate = (value, defaultRate = 0.05) => {
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

export const calculateVatAmount = ({
    deliverySpeed,
    shipmentFee = 0,
    goodsAmount = 0,
    financialSettings = {},
    fallbackVatRate = 0.05,
}) => {
    const baseAmount = (Number(shipmentFee) || 0) + (Number(goodsAmount) || 0);
    const speedKey = normalizeDeliverySpeedKey(deliverySpeed);
    const vatTypeRaw = financialSettings?.[`${speedKey}_vat_type`];
    const vatValueRaw = financialSettings?.[`${speedKey}_vat_value`];
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

export const resolveStageIndexFromStatus = (status, isDirect, stageCount) => {
    if (!status) {
        return null;
    }

    const normalized = String(status)
        .toLowerCase()
        .replace(/\s+/g, '_');

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

export const getLatestStatusFromHistory = (shipment) => {
    const historySource = shipment?.status_history ?? shipment?.statusHistory ?? [];
    const history = Array.isArray(historySource) ? historySource : [];

    if (history.length === 0) {
        return shipment?.status;
    }

    const sortedHistory = [...history].sort((a, b) => {
        const aTime = new Date(a?.created_at ?? 0).getTime();
        const bTime = new Date(b?.created_at ?? 0).getTime();
        return bTime - aTime;
    });

    const deliveredEntry = sortedHistory.find((entry) => {
        const status = entry?.to_status ?? entry?.toStatus ?? '';
        return status.toLowerCase().includes('deliver');
    });

    if (deliveredEntry) {
        return deliveredEntry.to_status ?? deliveredEntry.toStatus;
    }

    return sortedHistory[0]?.to_status ?? sortedHistory[0]?.toStatus ?? shipment?.status;
};

export const mapShipmentToRow = (shipment, t, { mode = 'sending' } = {}) => {
    const id = shipment?.ship_id || shipment?.id || shipment?.reference || '-';
    const orderNumber = shipment?.order_number || shipment?.orderNumber || '';
    const createdAt = shipment?.date || shipment?.created_at || shipment?.createdAt || '';
    const parcelType = shipment?.parcel_type || shipment?.consignment_type || t('shipmentsParcelTypeRegular');
    const parcelTypeLabel = parcelType ? translateEnumeratedValue(parcelType, t, parcelType) : t('shipmentsParcelTypeRegular');
    const speed = resolveDeliverySpeed(shipment, 'direct');
    const isDirect = isDirectDeliverySpeed(speed);
    const indirectMode = shipment?.indirect_delivery_mode ?? shipment?.indirectDeliveryMode ?? '';
    const routeLabel = isDirect
        ? t('createBookingRouteDoorToDoor')
        : (indirectMode
            ? translateEnumeratedValue(indirectMode, t, indirectMode.replace(/_/g, ' '))
            : t('shipmentsDoorPickupPoint'));
    const shipmentType = `${isDirect ? t('deliverySpeedDirect') : t('deliverySpeedIndirect')} / ${routeLabel}`;
    const size = (shipment?.size && shipment.size.name) ? shipment.size.name : (shipment?.parcel_size || shipment?.size || '-');
    let status = shipment?.status || getLatestStatusFromHistory(shipment) || 'pending';

    const requiresRider = isDirect || ['door_to_door', 'door_to_drop_point'].includes(indirectMode);
    const hasRider = shipment?.rider_id || shipment?.rider?.id;
    const isReceiverPaymentRequired = shipment?.payment?.requires_receiver_payment;
    if (requiresRider && !hasRider && (status.toLowerCase() === 'pending' || status.toLowerCase() === 'created') && !isReceiverPaymentRequired) {
        status = 'Not Assigned';
    }

    const commonRow = {
        id,
        shipId: orderNumber || `#${id}`,
        date: toDateOnly(createdAt),
        parcelType: parcelTypeLabel,
        shipmentType,
        status: statusLabel(status, t),
        statusColor: statusColor(status),
        returnStatus: shipment?.return_status || '-',
        rdfPaymentLink: shipment?.rdf_payment_link || null,
        action: t('commonViewDetails'),
        raw: shipment,
    };

    if (mode === 'receiving') {
        return {
            ...commonRow,
            senderName: shipment?.sender_name ?? '-',
            senderAddress: shipment?.sender_address ?? shipment?.handover_address ?? '-',
            bookingType: `${shipment?.booking_type}`,
            href: `/customer/receiving-parcels/${id}`,
        };
    }

    return {
        ...commonRow,
        receiverName: shipment?.receiver_name || '',
        receiverAddress: shipment?.delivery_address || '',
        parcelSize: size ? String(size).charAt(0).toUpperCase() + String(size).slice(1) : '-',
        href: `/customer/sending-parcels/${id}`,
    };
};

export const buildShipmentTimeline = ({
    shipment,
    isDirect,
    includeSecondWarehouse = false,
    compactIndirect = false,
    t,
}) => {
    const directLabels = [
        t('statusAssigned'),
        t('statusPickup'),
        t('statusInTransit'),
        t('statusDelivered'),
    ];
    const directStatuses = ['Assigned', 'Pickup', 'In Transit', 'Delivered'];
    const fullIndirectLabels = [
        t('statusAssigned'),
        t('statusPickup'),
        t('statusInTransit'),
        t('timelineArrivedDropPoint1'),
        t('timelineDeliveredDropPoint1'),
        t('timelineDispatchedToWarehouse'),
        t('timelineArrivedWarehouse'),
        ...(includeSecondWarehouse ? [t('timelineArrivedWarehouse2')] : []),
        t('timelineArrivedDropPoint2'),
        t('notificationReadyForPickupTitle'),
        t('timelineDispatchedDropPoint2'),
        t('timelinePickupDropPoint2'),
        t('timelineInTransitToCustomer'),
        t('statusDelivered'),
    ];
    const fullIndirectStatuses = [
        'Assigned',
        'Pickup',
        'In Transit',
        'Arrived at Drop Point 1',
        'Delivered to Drop Point 1',
        'Dispatched to Warehouse',
        'Arrived at Warehouse',
        ...(includeSecondWarehouse ? ['Arrived at Warehouse 2'] : []),
        'Arrived at Drop Point 2',
        'Ready for Pickup',
        'Dispatched from Drop Point 2',
        'Pickup from Drop Point 2',
        'In Transit to Customer',
        'Delivered',
    ];
    const compactIndirectLabels = fullIndirectLabels.slice(0, includeSecondWarehouse ? 8 : 7);
    const compactIndirectStatuses = fullIndirectStatuses.slice(0, includeSecondWarehouse ? 8 : 7);
    const directObj = shipment?.direct_status ?? shipment?.directStatus;
    const indirectObj = shipment?.indirect_status ?? shipment?.indirectStatus;
    const rawIndex = isDirect
        ? Number(directObj?.current_index ?? directObj?.currentIndex)
        : Number(indirectObj?.current_index ?? indirectObj?.currentIndex);
    const historySource = shipment?.status_history ?? shipment?.statusHistory ?? [];
    const history = Array.isArray(historySource) ? historySource : [];
    const indirectMode = shipment?.indirect_delivery_mode ?? shipment?.indirectDeliveryMode ?? '';
    const isDoorDeliveryMode = ['door_to_door', 'drop_point_to_door'].includes(indirectMode);
    const isDropPointDeliveryMode = ['door_to_drop_point', 'drop_point_to_drop_point'].includes(indirectMode);

    let labels = isDirect ? directLabels : (compactIndirect ? compactIndirectLabels : fullIndirectLabels);
    let statuses = isDirect ? directStatuses : (compactIndirect ? compactIndirectStatuses : fullIndirectStatuses);

    if (!isDirect && isDoorDeliveryMode) {
        const filtered = statuses.reduce(
            (acc, status, index) => {
                if (status === 'Ready for Pickup') {
                    return acc;
                }
                acc.labels.push(labels[index]);
                acc.statuses.push(status);
                return acc;
            },
            { labels: [], statuses: [] },
        );
        labels = filtered.labels;
        statuses = filtered.statuses;
    } else if (!isDirect && isDropPointDeliveryMode) {
        const doorDeliveryStatuses = [
            'Dispatched from Drop Point 2',
            'Pickup from Drop Point 2',
            'In Transit to Customer',
        ];
        const filtered = statuses.reduce(
            (acc, status, index) => {
                if (doorDeliveryStatuses.includes(status)) {
                    return acc;
                }
                acc.labels.push(labels[index]);
                acc.statuses.push(status);
                return acc;
            },
            { labels: [], statuses: [] },
        );
        labels = filtered.labels;
        statuses = filtered.statuses;
    }

    if (!isDirect && ['drop_point_to_door', 'drop_point_to_drop_point'].includes(indirectMode)) {
        const pickupOnlyStatuses = [
            'Assigned',
            'Pickup',
            'In Transit',
            'Arrived at Drop Point 1',
        ];
        const filtered = statuses.reduce(
            (acc, status, index) => {
                if (pickupOnlyStatuses.includes(status)) {
                    return acc;
                }
                acc.labels.push(labels[index]);
                acc.statuses.push(status);
                return acc;
            },
            { labels: [], statuses: [] },
        );
        labels = filtered.labels;
        statuses = filtered.statuses;
    }

    let progressIndex = Number.isFinite(rawIndex) ? rawIndex + 1 : null;
    if (!Number.isFinite(progressIndex) || progressIndex <= 0) {
        const derived = resolveStageIndexFromStatus(shipment?.status, isDirect, labels.length);
        progressIndex = derived != null ? derived + 1 : 1;
    }
    progressIndex = Math.max(1, Math.min(progressIndex, labels.length));

    const items = labels.map((label, index) => {
        const status = statuses[index];
        const matchedHistory = history.find((entry) => entry?.to_status === status);

        return {
            label,
            status,
            timestamp: matchedHistory?.created_at || null,
            user: matchedHistory?.user || null,
        };
    });

    return { items, progressIndex };
};
