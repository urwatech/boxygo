import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function Menu({ items, onItemClick, anchorRef, className = '', autoHeight = false }) {
  const menuRef = useRef(null);
  const [style, setStyle] = useState({});
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const MARGIN = 8;

    const updateStyle = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const isMobile = window.innerWidth <= 750;

      if (isMobile) {
        setStyle({
          width: '100%',
          minWidth: '100%',
          maxHeight: autoHeight ? 'none' : '300px',
          overflow: autoHeight ? 'visible' : 'auto',
          WebkitOverflowScrolling: 'touch',
          zIndex: 50,
        });
      } else {
        const availableWidth = Math.max(0, window.innerWidth - MARGIN * 2);
        const width = Math.min(rect.width, availableWidth);
        const left = Math.min(
          Math.max(rect.left, MARGIN),
          window.innerWidth - width - MARGIN
        );
        const top = Math.round(rect.bottom) + 4;
        const maxHeight = Math.max(0, window.innerHeight - rect.bottom - 20);

        setStyle({
          top,
          left: Math.round(left),
          width,
          minWidth: width,
          maxWidth: availableWidth,
          maxHeight: autoHeight ? 'none' : maxHeight,
          overflow: autoHeight ? 'visible' : 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          zIndex: 60,
        });
      }
    };

    updateStyle();
    window.addEventListener('resize', updateStyle, { passive: true });

    return () => {
      window.removeEventListener('resize', updateStyle);
    };
  }, [anchorRef, autoHeight]);

  if (!items || items.length === 0) {
    return <div className="text-gray-500 p-4">{t('commonNoMenuItemsFound')}</div>;
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className={`relative !left-0 !top-0 rounded-[16px] bg-white shadow-[0px_20px_60px_rgba(15,23,42,0.15)] border border-[#E2E8F0] overflow-auto max-w-[100vw] ${className}`}
      role="menu"
      aria-orientation="vertical"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <ul className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
        {items.map((item, index) => {
          const isDisabled = Boolean(item.disabled);
          return (
            <li key={item.id ?? item.value ?? index}>
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onItemClick?.(item);
                  }
                }}
                className={`w-full text-start px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isDisabled
                    ? 'text-gray-400 bg-gray-100 cursor-not-allowed opacity-70'
                    : 'hover:bg-gray-50 cursor-pointer'
                }`}
                role="menuitem"
                aria-disabled={isDisabled}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
