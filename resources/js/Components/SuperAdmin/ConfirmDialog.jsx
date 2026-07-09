import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export default function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    cancelText,
    confirmButtonClass = 'bg-red-600 hover:bg-red-700 text-white',
    isProcessing = false
}) {
    const { t } = useTranslation();
    const resolvedTitle = title ?? t('commonConfirmAction');
    const resolvedConfirmText = confirmText ?? t('commonConfirm');
    const resolvedCancelText = cancelText ?? t('commonCancel');
    const confirmButtonRef = useRef(null);
    const processingLabel = t('commonProcessing');

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);

        // Focus the confirm button when dialog opens
        if (confirmButtonRef.current) {
            confirmButtonRef.current.focus();
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div
                className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
            >
                <div className="p-6">
                    {/* Icon */}
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                        <svg
                            className="h-6 w-6 text-red-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                            />
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="mt-4 text-center">
                        <h3
                            id="dialog-title"
                            className="text-lg font-semibold text-gray-900"
                        >
                            {resolvedTitle}
                        </h3>
                        {message && (
                            <p className="mt-2 text-sm text-gray-500">
                                {message}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {resolvedCancelText}
                        </button>
                        <button
                            ref={confirmButtonRef}
                            type="button"
                            onClick={onConfirm}
                            disabled={isProcessing}
                            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition ${confirmButtonClass}`}
                        >
                            {isProcessing ? processingLabel : resolvedConfirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
