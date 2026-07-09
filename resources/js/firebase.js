import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
    deleteToken,
    getMessaging,
    getToken,
    isSupported as isMessagingSupported,
    onMessage,
} from 'firebase/messaging';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const hasFirebaseConfig = Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.projectId
    && firebaseConfig.appId,
);

export const getFirebaseApp = () => {
    if (!hasFirebaseConfig) {
        if (import.meta.env.DEV) {
            console.warn('Firebase is not configured. Add VITE_FIREBASE_* values to your environment.');
        }

        return null;
    }

    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
};

export const getFirebaseFirestore = () => {
    const app = getFirebaseApp();

    return app ? getFirestore(app) : null;
};

export const getFirebaseMessagingInstance = async () => {
    const app = getFirebaseApp();

    if (!app) {
        return null;
    }

    const supported = await isMessagingSupported();

    if (!supported) {
        if (import.meta.env.DEV) {
            console.warn('Firebase Messaging is not supported in this browser.');
        }

        return null;
    }

    return getMessaging(app);
};

export const getFirebaseMessagingToken = async (serviceWorkerRegistration) => {
    if (!firebaseVapidKey) {
        if (import.meta.env.DEV) {
            console.warn('Firebase Messaging VAPID key is missing. Add VITE_FIREBASE_VAPID_KEY to your environment.');
        }

        return null;
    }

    const messaging = await getFirebaseMessagingInstance();

    if (!messaging) {
        return null;
    }

    return getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration,
    });
};

export const deleteFirebaseMessagingToken = async () => {
    const messaging = await getFirebaseMessagingInstance();

    if (!messaging) {
        return false;
    }

    return deleteToken(messaging);
};

export const onFirebaseForegroundMessage = async (callback) => {
    const messaging = await getFirebaseMessagingInstance();

    if (!messaging) {
        return () => {};
    }

    return onMessage(messaging, callback);
};
