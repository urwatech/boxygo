import '../css/superadmin.css';
import './bootstrap';
import './i18n';

import { createInertiaApp } from '@inertiajs/react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './Contexts/LanguageContext'

createInertiaApp({
    resolve: name => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        return pages[`./Pages/${name}.jsx`]
    },
    setup({ el, App, props }) {
        const userLanguage = props.initialPage.props.auth?.user?.language || null;

        createRoot(el).render(
            <LanguageProvider userLanguage={userLanguage}>
                <App {...props} />
            </LanguageProvider>
        )
    },
})
