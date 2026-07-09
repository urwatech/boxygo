import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { router } from '@inertiajs/react';
import { FOREGROUND_PUSH_EVENT } from '../../foregroundNotifications';

const AUTO_DISMISS_MS = 7000;
const MAX_VISIBLE_TOASTS = 3;

const normalizeNotification = (detail = {}) => ({
    id: detail.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: detail.title || 'Boxygo',
    body: detail.body || '',
    url: detail.url || '/customer/notifications',
    icon: detail.icon || '/pwa-icons/manifest-icon-192.maskable.png',
});

export default function ForegroundNotificationToast() {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    const dismissToast = useCallback((id) => {
        const timer = timersRef.current.get(id);

        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }

        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    useEffect(() => {
        const handleForegroundNotification = (event) => {
            const toast = normalizeNotification(event.detail);

            setToasts((current) => [toast, ...current.filter((item) => item.id !== toast.id)].slice(0, MAX_VISIBLE_TOASTS));

            const existingTimer = timersRef.current.get(toast.id);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS);
            timersRef.current.set(toast.id, timer);
        };

        window.addEventListener(FOREGROUND_PUSH_EVENT, handleForegroundNotification);

        return () => {
            window.removeEventListener(FOREGROUND_PUSH_EVENT, handleForegroundNotification);
            timersRef.current.forEach((timer) => clearTimeout(timer));
            timersRef.current.clear();
        };
    }, [dismissToast]);

    if (toasts.length === 0 || typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[10000] flex flex-col items-center gap-3 px-4 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[380px] sm:items-stretch">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto flex w-full max-w-[380px] items-start overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black/5" role="status">
                    <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                        onClick={() => {
                            dismissToast(toast.id);
                            router.visit(toast.url);
                        }}
                    >
                        <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
                            <img src={toast.icon} alt="" className="h-6 w-6 rounded object-cover" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">{toast.title}</span>
                            {toast.body && (
                                <span className="mt-1 block break-words text-sm leading-5 text-gray-600">{toast.body}</span>
                            )}
                        </span>
                    </button>
                    <button
                        type="button"
                        aria-label="Dismiss notification"
                        className="mr-3 mt-3 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        onClick={() => dismissToast(toast.id)}
                    >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>,
        document.body,
    );
}
