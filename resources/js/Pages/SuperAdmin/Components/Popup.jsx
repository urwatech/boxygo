import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const animationStyles = `
@keyframes mp-popup-grow {
    0% { transform: scale(0); }
    100% { transform: scale(1); }
}

@keyframes mp-popup-check {
    to { stroke-dashoffset: 0; }
}

.mp-popup-circle {
    transform: scale(0);
    transform-origin: center;
    animation: mp-popup-grow 0.4s ease-out forwards;
}

.mp-popup-tick {
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    stroke-width: 4;
    stroke: #ffffff;
    fill: none;
    animation: mp-popup-check 0.4s ease forwards;
    animation-delay: 0.2s;
}
`;

export default function Popup({
    title,
    message,
    buttonLabel = null,
    onConfirm,
    secondaryButtonLabel = null,
    onSecondaryConfirm = null,
    loopAnimation = true,
    showIcon = true,
    showCloseButton = false,
    onClose,
    closeOnOverlayClick = false,
}) {
    const { t } = useTranslation();
    const [animationKey, setAnimationKey] = useState(0);
    const intervalRef = useRef(null);

    const resolvedButtonLabel = buttonLabel ?? t('commonOkay');

    useEffect(() => {
        if (!loopAnimation) return;

        intervalRef.current = setInterval(() => {
            setAnimationKey((prev) => prev + 1);
        }, 1200);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [loopAnimation]);

    const handleConfirm = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        onConfirm?.();
    };

    const handleOverlayClick = () => {
        if (!closeOnOverlayClick) return;

        if (typeof onClose === 'function') {
            onClose();
        } else {
            handleConfirm();
        }
    };

    return (
        <>
            <style>{animationStyles}</style>

            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d3d5c]/90 backdrop-blur-sm px-4 py-6 sm:px-6 sm:py-10"
                onClick={handleOverlayClick}
            >
                {/* Modal */}
                <div
                    className="
                        relative w-full max-w-[95%] sm:max-w-[580px]
                        bg-white rounded-2xl sm:rounded-[30px]
                        shadow-[0_20px_40px_rgba(15,23,42,0.2)]
                        text-center
                        px-4 sm:px-8
                        pt-5 sm:pt-6
                        pb-5 sm:pb-6
                        flex flex-col items-center
                        gap-4 sm:gap-5
                        max-h-[90vh] overflow-y-auto
                    "
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    {showCloseButton && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={t('commonClose')}
                            className="absolute right-3 top-3 sm:right-5 sm:top-5 rounded-full p-1 text-[#94a3b8] hover:text-[#1f2937] transition"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}

                    {/* Icon */}
                    {showIcon && (
                        <div className="w-[70px] h-[70px] sm:w-[100px] sm:h-[100px] flex items-center justify-center mb-2 sm:mb-4">
                            <svg key={animationKey} viewBox="0 0 52 52" className="w-full h-full">
                                <circle
                                    className="mp-popup-circle"
                                    cx="26"
                                    cy="26"
                                    r="25"
                                    fill="#338DFF"
                                />
                                <path
                                    className="mp-popup-tick"
                                    d="M14 27l7 7 17-17"
                                />
                            </svg>
                        </div>
                    )}

                    {/* Title */}
                    <h1 className="text-lg sm:text-2xl font-semibold text-blue-500">
                        {title}
                    </h1>

                    {/* Message */}
                    {typeof message === 'string' ? (
                        <p className="text-sm sm:text-xl text-[#6b7280] leading-relaxed whitespace-pre-line">
                            {message}
                        </p>
                    ) : (
                        <div className="text-sm sm:text-xl text-[#6b7280] leading-relaxed">
                            {message}
                        </div>
                    )}

                    {/* Buttons */}
                    {secondaryButtonLabel ? (
                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button
                                type="button"
                                className="
                                    flex-1 rounded-full border-2 border-[#338DFF] text-[#338DFF]
                                    font-medium text-sm sm:text-base
                                    py-3 sm:py-4
                                    transition transform hover:-translate-y-[1px] active:translate-y-0
                                "
                                onClick={onSecondaryConfirm}
                            >
                                {secondaryButtonLabel}
                            </button>

                            <button
                                type="button"
                                className="
                                    flex-1 rounded-full bg-[#338DFF] text-white
                                    font-medium text-sm sm:text-base
                                    py-3 sm:py-4
                                    shadow-[0_12px_24px_rgba(79,125,249,0.25)]
                                    transition transform hover:-translate-y-[1px]
                                    hover:shadow-[0_14px_28px_rgba(79,125,249,0.3)]
                                    active:translate-y-0 active:shadow-none
                                "
                                onClick={handleConfirm}
                            >
                                {resolvedButtonLabel}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="
                                w-full rounded-full bg-[#338DFF] text-white
                                font-medium text-sm sm:text-base
                                py-3 sm:py-4
                                shadow-[0_12px_24px_rgba(79,125,249,0.25)]
                                transition transform hover:-translate-y-[1px]
                                hover:shadow-[0_14px_28px_rgba(79,125,249,0.3)]
                                active:translate-y-0 active:shadow-none
                            "
                            onClick={handleConfirm}
                        >
                            {resolvedButtonLabel}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}