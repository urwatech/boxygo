import '../css/customer.css';
import './bootstrap';
import './i18n';

import { createInertiaApp } from '@inertiajs/react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './Contexts/LanguageContext'
import { initializeCustomerPushNotifications } from './pushNotifications'
import ForegroundNotificationToast from './Components/Customer/ForegroundNotificationToast'

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/customer/' })
            .then((registration) => {
                // console.log('ServiceWorker registered: ', registration);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60000); // Check every minute
            })
            .catch((error) => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

createInertiaApp({
    resolve: name => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true })
        return pages[`./Pages/${name}.jsx`]
    },
    setup({ el, App, props }) {
        const userLanguage = props.initialPage.props.auth?.user?.language || null;
        const pushEnabled = Boolean(props.initialPage.props.auth?.user?.push_notifications);

        createRoot(el).render(
            <LanguageProvider userLanguage={userLanguage}>
                <App {...props} />
                <ForegroundNotificationToast />
            </LanguageProvider>
        )

        initializeCustomerPushNotifications({ pushEnabled });
    },
})
