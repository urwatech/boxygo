import React, { forwardRef } from 'react';

const Card = forwardRef(({
    // Header props
    title,
    subtitle,
    headerIcon: HeaderIcon,
    headerActions,

    // Toolbar props
    toolbar,

    // Content props
    children,

    // Footer props
    footer,

    // Styling props
    className = '',
    headerClassName = '',
    toolbarClassName = '',
    contentClassName = '',
    footerClassName = '',

    // Variants
    padding = 'default',
    rounded = 'default',
    shadow = 'default',
    border = true,

    // Additional props
    ...props
}, ref) => {
    const paddingStyles = {
        none: '',
        sm: 'p-3',
        default: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
    };

    const roundedStyles = {
        none: '',
        sm: 'rounded-lg',
        default: 'rounded-[24px]',
        lg: 'rounded-[32px]',
        full: 'rounded-full',
    };

    const shadowStyles = {
        none: '',
        sm: 'shadow-sm',
        default: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
    };

    const baseStyles = 'bg-white';
    const borderStyles = border ? 'border border-[#e2e8f0]' : '';

    const cardClasses = `
        ${baseStyles}
        ${roundedStyles[rounded] || roundedStyles.default}
        ${shadowStyles[shadow] || shadowStyles.default}
        ${borderStyles}
        ${className}
    `.trim().replace(/\s+/g, ' ');

    const hasHeader = title || subtitle || HeaderIcon || headerActions || toolbar;

    return (
        <div ref={ref} className={cardClasses} {...props}>
            {/* Header with Title and Toolbar on same line */}
            {hasHeader && (
                <div className={`flex items-center justify-between gap-4 ${paddingStyles[padding] || paddingStyles.default} ${headerClassName}`}>
                    <div className="flex items-center gap-3">
                        {HeaderIcon && (
                            <div className="flex-shrink-0">
                                {typeof HeaderIcon === 'function' ? <HeaderIcon /> : HeaderIcon}
                            </div>
                        )}
                        <div>
                            {title && (
                                <h2 className="text-lg font-semibold text-[#0f172a]">
                                    {title}
                                </h2>
                            )}
                            {subtitle && (
                                <p className="text-sm text-[#64748b] mt-1">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {toolbar && (
                            <div className={toolbarClassName}>
                                {toolbar}
                            </div>
                        )}
                        {headerActions && (
                            <>
                                {headerActions}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            {children && (
                <div className={(paddingStyles[padding] || paddingStyles.default)+" "+contentClassName}>
                    {children}
                </div>
            )}

            {/* Footer */}
            {footer && (
                <div className={`border-t border-[#e2e8f0] ${paddingStyles[padding] || paddingStyles.default} ${footerClassName}`}>
                    {footer}
                </div>
            )}
        </div>
    );
});

Card.displayName = 'Card';

// Sub-components for more granular control
Card.Header = ({ children, className = '' }) => (
    <div className={className}>
        {children}
    </div>
);

Card.Toolbar = ({ children, className = '' }) => (
    <div className={className}>
        {children}
    </div>
);

Card.Content = ({ children, className = '', padding = 'default' }) => {
    const paddingStyles = {
        none: '',
        sm: 'p-3',
        default: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
    };

    return (
        <div className={`${paddingStyles[padding] || paddingStyles.default} ${className}`}>
            {children}
        </div>
    );
};

Card.Footer = ({ children, className = '' }) => (
    <div className={className}>
        {children}
    </div>
);

export default Card;
