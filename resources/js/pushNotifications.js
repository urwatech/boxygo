import {
    deleteFirebaseMessagingToken,
    getFirebaseMessagingToken,
    onFirebaseForegroundMessage,
} from './firebase';
import { dispatchForegroundPushNotification } from './foregroundNotifications';

const FIREBASE_MESSAGING_SW_URL = '/firebase-messaging-sw.js';
const DEFAULT_NOTIFICATION_URL = '/customer/notifications';

let firebaseMessagingRegistrationPromise = null;
let foregroundUnsubscribePromise = null;

const canUseWebPush = () => (
    typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
);

const resolveRoute = (routeName, fallback) => {
    if (typeof route === 'function') {
        return route(routeName);
    }

    return fallback;
};

const notificationUrlFromPayload = (payload = {}) => {
    const data = payload.data || {};

    return data.url
        || data.web_url
        || (data.shipment_id ? `/customer/shipments/${data.shipment_id}` : DEFAULT_NOTIFICATION_URL);
};

export const getFirebaseMessagingServiceWorkerRegistration = async () => {
    if (!canUseWebPush()) {
        return null;
    }

    if (!firebaseMessagingRegistrationPromise) {
        firebaseMessagingRegistrationPromise = navigator.serviceWorker.register(FIREBASE_MESSAGING_SW_URL);
    }

    return firebaseMessagingRegistrationPromise;
};

export const enableCustomerPushNotifications = async ({ requestPermission = true } = {}) => {
    if (!canUseWebPush()) {
        return { ok: false, reason: 'unsupported' };
    }

    let permission = Notification.permission;

    if (permission === 'default' && requestPermission) {
        permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
        return { ok: false, reason: permission === 'denied' ? 'denied' : 'not_granted' };
    }

    const serviceWorkerRegistration = await getFirebaseMessagingServiceWorkerRegistration();
    const token = await getFirebaseMessagingToken(serviceWorkerRegistration);

    if (!token) {
        return { ok: false, reason: 'token_unavailable' };
    }

    await window.axios.post(
        resolveRoute('customer.push_notifications.token.store', '/customer/push-notifications/token'),
        {
            fcm_token: token,
            device_type: 'web',
        },
    );

    return { ok: true, token };
};

export const disableCustomerPushNotifications = async () => {
    try {
        await deleteFirebaseMessagingToken();
    } catch (error) {
        console.warn('Unable to delete local Firebase Messaging token.', error);
    }

    await window.axios.delete(
        resolveRoute('customer.push_notifications.token.destroy', '/customer/push-notifications/token'),
    );
};

export const clearCustomerPushNotificationTokenForLogout = async () => {
    try {
        await deleteFirebaseMessagingToken();
    } catch (error) {
        console.warn('Unable to delete local Firebase Messaging token during logout.', error);
    }

    try {
        await window.axios.delete(
            resolveRoute('customer.push_notifications.token.destroy', '/customer/push-notifications/token'),
        );
    } catch (error) {
        console.warn('Unable to remove backend push notification token during logout.', error);
    }
};

export const initializeCustomerPushNotifications = async ({ pushEnabled = false } = {}) => {
    if (!canUseWebPush()) {
        return;
    }

    try {
        await getFirebaseMessagingServiceWorkerRegistration();

        if (!foregroundUnsubscribePromise) {
            const handleForegroundMessage = (payload) => {
                const notification = payload.notification || {};
                const data = payload.data || {};
                const title = notification.title || data.title || 'Boxygo';
                const body = notification.body || data.body || '';
                const url = notificationUrlFromPayload(payload);

                dispatchForegroundPushNotification({
                    id: payload.messageId || data.notification_id || data.id,
                    title,
                    body,
                    url,
                    icon: notification.icon || data.icon || '/pwa-icons/manifest-icon-192.maskable.png',
                    payload,
                });
            };

            foregroundUnsubscribePromise = onFirebaseForegroundMessage(handleForegroundMessage)
                .catch((error) => {
                    foregroundUnsubscribePromise = null;
                    console.warn('Unable to listen for foreground push notifications.', error);

                    return () => {};
                });
        }

        if (pushEnabled && Notification.permission === 'granted') {
            await enableCustomerPushNotifications({ requestPermission: false });
        }
    } catch (error) {
        console.warn('Unable to initialize push notifications.', error);
    }
};
