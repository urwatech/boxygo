const getCsrfToken = () => {
    if (typeof document === 'undefined') {
        return null;
    }

    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null;
};

const postJson = async (url, payload = {}) => {
    const csrfToken = getCsrfToken();

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
    });

    let result = {};
    try {
        result = await response.json();
    } catch {
        result = {};
    }

    const okFlag = Boolean(result?.ok ?? result?.success ?? false);

    return {
        ok: response.ok && okFlag,
        response,
        result,
    };
};

export const initiateMtnPayment = (payload) => postJson('/customer/payments/initiate', payload);

export const confirmMtnPayment = (payload) => postJson('/customer/payments/confirm', payload);

export const initiateSyriatelPayment = (payload) => postJson('/customer/payments/syriatel/initiate', payload);

export const confirmSyriatelPayment = (payload) => postJson('/customer/payments/syriatel/confirm', payload);

export const resendSyriatelOtp = (payload) => postJson('/customer/payments/syriatel/resend', payload);

export const initiatePaymeraPayment = (payload) => postJson('/customer/payments/paymera/initiate', payload);

export const payShipmentNow = (payload) => postJson('/customer/shipments/paynow', payload);
