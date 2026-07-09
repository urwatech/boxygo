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

const toFiniteNumber = (value) => {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
};

const parseJsonSafe = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return null;
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
};

const normalizeShipmentType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'direct' || normalized === 'indirect' ? normalized : null;
};

const buildCityQuery = ({ lat, lng, city, state, radius = 15 }) => {
    const params = new URLSearchParams();
    if (lat != null) params.set('lat', String(lat));
    if (lng != null) params.set('lon', String(lng));
    if (radius != null) params.set('radius', String(radius));
    if (city) params.set('city', String(city));
    if (state) params.set('state', String(state));
    return params.toString();
};

const fetchCityMatch = async ({ lat, lng, city = '', state = '', signal }) => {
    const query = buildCityQuery({ lat, lng, city, state });
    const response = await fetch(`/api/v1/cities/check?${query}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        signal,
    });

    const body = await parseJsonSafe(response);

    if (!response.ok) {
        return {
            ok: false,
            exists: false,
            message: body?.message || `City check failed (${response.status})`,
            body,
            status: response.status,
        };
    }

    const exists = Boolean(body?.exists && body?.data?.id);

    return {
        ok: true,
        exists,
        id: exists ? body.data.id : null,
        city: String(city || body?.data?.name || '').trim(),
        state: String(state || body?.data?.governate?.name || '').trim(),
        body,
    };
};

export const calculateShipmentPricing = async ({
    sender_lat,
    sender_lng,
    receiver_lat,
    receiver_lng,
    sender_city = '',
    sender_state = '',
    receiver_city = '',
    receiver_state = '',
    size_id = null,
    signal,
}) => {
    const handoverLatitude = toFiniteNumber(sender_lat);
    const handoverLongitude = toFiniteNumber(sender_lng);
    const deliveryLatitude = toFiniteNumber(receiver_lat);
    const deliveryLongitude = toFiniteNumber(receiver_lng);

    if (
        handoverLatitude == null
        || handoverLongitude == null
        || deliveryLatitude == null
        || deliveryLongitude == null
    ) {
        return {
            ok: false,
            errorCode: 'MISSING_COORDINATES',
            message: 'Both sender and receiver coordinates are required.',
        };
    }

    const [fromCity, toCity] = await Promise.all([
        fetchCityMatch({
            lat: handoverLatitude,
            lng: handoverLongitude,
            city: sender_city,
            state: sender_state,
            signal,
        }),
        fetchCityMatch({
            lat: deliveryLatitude,
            lng: deliveryLongitude,
            city: receiver_city,
            state: receiver_state,
            signal,
        }),
    ]);

    if (!fromCity.ok || !toCity.ok) {
        return {
            ok: false,
            errorCode: 'CITY_CHECK_FAILED',
            message: fromCity.message || toCity.message || 'Unable to validate cities.',
            cityMatches: { from: fromCity, to: toCity },
        };
    }

    if (!fromCity.exists || !toCity.exists) {
        return {
            ok: false,
            errorCode: 'CITY_NOT_FOUND',
            message: !fromCity.exists
                ? 'No pickup city found for selected sender coordinates.'
                : 'No dropoff city found for selected receiver coordinates.',
            cityMatches: { from: fromCity, to: toCity },
        };
    }

    const payload = {
        from_city_id: fromCity.id,
        to_city_id: toCity.id,
        handover_latitude: handoverLatitude,
        handover_longitude: handoverLongitude,
        delivery_latitude: deliveryLatitude,
        delivery_longitude: deliveryLongitude,
        size_id: size_id ?? null,
    };

    const response = await fetch('/customer/shipments/calculate-price', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...getCsrfHeaders(),
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
        signal,
    });

    const body = await parseJsonSafe(response);

    if (!response.ok) {
        return {
            ok: false,
            errorCode: response.status === 422 ? 'PRICE_VALIDATION_FAILED' : 'PRICE_API_FAILED',
            message: body?.message || `Price API failed (${response.status}).`,
            status: response.status,
            body,
            cityMatches: { from: fromCity, to: toCity },
        };
    }

    if (!body?.success || !body?.data) {
        return {
            ok: false,
            errorCode: 'INVALID_RESPONSE',
            message: 'Invalid response from shipment calculation API.',
            body,
            cityMatches: { from: fromCity, to: toCity },
        };
    }

    const shipmentType = normalizeShipmentType(body?.data?.type);

    return {
        ok: true,
        shipmentType,
        data: body.data,
        body,
        cityMatches: { from: fromCity, to: toCity },
    };
};
