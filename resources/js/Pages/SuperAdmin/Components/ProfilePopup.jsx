import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const arrowStyles = `
.mp-profile-popup::before {
    content: '';
    position: absolute;
    top: -10px;
    left: var(--mp-arrow-left, 32px);
    width: 20px;
    height: 20px;
    background: #ffffff;
    border-left: 1px solid #EAECF0;
    border-top: 1px solid #EAECF0;
    transform: rotate(45deg);
    box-shadow: -6px -6px 24px rgba(15, 23, 42, 0.08);
    border-radius: 4px 0 0 0;
}
`;

export default function ProfilePopup({
    isOpen,
    onClose,
    anchorRef,
    name,
    email,
    avatarUrl,
    onLogout,
    logoutLabel = null,
}) {
    const { t } = useTranslation();
    const popupRef = useRef(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [arrowLeft, setArrowLeft] = useState(32);
    const isBrowser = typeof window !== 'undefined';
    const isRTL = isBrowser && document?.documentElement?.dir === 'rtl';
    const textAlignClass = isRTL ? 'text-right' : 'text-left';
    const resolvedLogoutLabel = logoutLabel ?? t('commonLogout');

    useLayoutEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const updatePosition = () => {
            if (!anchorRef?.current || !popupRef.current) {
                setPosition((prev) => ({ ...prev, top: 88, left: window.scrollX + window.innerWidth / 2 }));
                setArrowLeft(32);
                return;
            }

            const rect = anchorRef.current.getBoundingClientRect();
            const popupRect = popupRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;
            const anchorCenter = rect.left + rect.width / 2 + scrollX;
            const halfWidth = popupRect.width / 2;
            const minCenter = scrollX + halfWidth + 16;
            const maxCenter = scrollX + window.innerWidth - halfWidth - 16;
            const constrainedCenter = Math.min(Math.max(anchorCenter, minCenter), maxCenter);

            const top = rect.bottom + scrollY + 12;
            setPosition({ top, left: constrainedCenter });

            const popupLeftEdge = constrainedCenter - halfWidth;
            const relativeAnchorCenter = anchorCenter - popupLeftEdge;
            const clampedArrow = Math.min(
                Math.max(relativeAnchorCenter, 16),
                popupRect.width - 36,
            );
            setArrowLeft(clampedArrow);
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, anchorRef]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleClick = (event) => {
            if (!popupRef.current?.contains(event.target) && !anchorRef?.current?.contains(event.target)) {
                onClose?.();
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, anchorRef]);

    const shouldRender = useMemo(() => Boolean(isOpen), [isOpen]);

    if (!shouldRender) {
        return null;
    }

    return (
        <>
            <style>{arrowStyles}</style>
            <div
                ref={popupRef}
                className="fixed z-50 mp-profile-popup"
                dir={isRTL ? 'rtl' : 'ltr'}
                style={{
                    top: position.top,
                    left: position.left,
                    transform: 'translateX(-50%)',
                    '--mp-arrow-left': `${arrowLeft}px`,
                }}
            >
                <div className="w-[260px] rounded-[24px] bg-white border border-[#EAECF0] shadow-[0_20px_60px_rgba(15,23,42,0.15)] p-4 pt-6">
                    <div className={`bg-[#F5F6FA] rounded-[18px] px-4 py-3 flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <img
                            src={avatarUrl}
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/assets/images/user.jpg';
                            }}
                            alt={t('superAdminProfilePopupAvatarAlt', { name: name ?? t('superAdminProfilePopupUserFallback') })}
                            className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className={textAlignClass}>
                            <p className="text-sm font-semibold text-[#111827]">{name}</p>
                            <p className="text-xs text-[#6B7280]">{email}</p>
                        </div>
                    </div>

                    <div className="h-px bg-[#EAECF0] my-4" />

                    <button
                        type="button"
                        onClick={onLogout}
                        className={`w-full flex items-center gap-2 text-sm font-medium text-[#111827] hover:text-blue-500 transition-colors px-2 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="text-current"
                        >
                            <path
                                d="M15 16L20 11L15 6"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M20 11H9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M12 21H6C4.34315 21 3 19.6569 3 18V6C3 4.34315 4.34315 3 6 3H12"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        {resolvedLogoutLabel}
                    </button>
                </div>
            </div>
        </>
    );
}
