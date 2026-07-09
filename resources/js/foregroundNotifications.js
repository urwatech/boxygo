export const FOREGROUND_PUSH_EVENT = 'customer:foreground-push-notification';
export const CUSTOMER_NOTIFICATION_RECEIVED_EVENT = 'customer:notification-received';

export const dispatchForegroundPushNotification = (notification) => {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(FOREGROUND_PUSH_EVENT, {
        detail: notification,
    }));

    window.dispatchEvent(new CustomEvent(CUSTOMER_NOTIFICATION_RECEIVED_EVENT, {
        detail: notification,
    }));
};
