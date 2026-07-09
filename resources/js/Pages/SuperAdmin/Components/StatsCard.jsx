import React from 'react';

export default function StatsCard({
    title,
    value,
    subtitle,
    valuePrefix,
    iconSrc,
    accentColor = '#4F7DF9',
    width,
    height,
    className = '',
    iconAlt,
    rightIconSrc,
    onClick,
    style,
    isSpecialCard = false,
}) {
    const mergedStyle = {
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        ...style,
    };

    return (
        <div
            className={`rounded-xl p-4 ${className}`+
                (!isSpecialCard ? "bg-white border border-[#E5E7EB]" :
                    "bg-white shadow-[18px_20px_56px_0_rgba(17,0,54,0.16)]")}
            style={mergedStyle}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={(event) => {
                if (onClick && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onClick(event);
                }
            }}
        >
            <div className="flex justify-between items-center mb-2">
                <p className="font-medium text-sm text-neutral-700">
                    {title}
                </p>
                {iconSrc && (
                    <img
                        src={iconSrc}
                        alt={iconAlt ?? title ?? 'stat icon'}
                        className="w-6 h-6 object-contain opacity-60"
                    />
                )}
            </div>

            <div className="flex items-baseline gap-1">
                {valuePrefix && (
                    <span
                        className="text-xs font-semibold uppercase"
                        style={{ color: accentColor }}
                    >
                        {valuePrefix}
                    </span>
                )}
                <span
                    className="font-bold text-3xl"
                    style={{ color: accentColor }}
                >
                    {value}
                </span>
                {subtitle && (
                    <span className="text-xs text-gray-500 font-light">
                        {subtitle}
                    </span>
                )}
                   {rightIconSrc && (
                    <img
                    src={rightIconSrc}
                    className="w-[28px] h-[20px] object-contain cursor-pointer"
                    />
                )}

            </div>
        </div>
    );
}
