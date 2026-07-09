import React, { forwardRef } from 'react';

const Button = forwardRef(({
    children,
    type = 'button',
    variant = 'primary',
    size = 'lg',
    disabled = false,
    loading = false,
    fullWidth = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    className = '',
    onClick,
    ...props
}, ref) => {
    const baseStyles =
        'font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center cursor-pointer shadow-[0_12px_20px_rgba(51,141,255,0.2)] active:scale-[0.98]';

    const variantStyles = {
        primary: `
            bg-[#338dff]
            text-white
            border border-transparent
            hover:bg-white
            hover:text-blue-500
            hover:border-[#338dff]
            focus:ring-[#338dff]
            disabled:opacity-60
            disabled:cursor-not-allowed
        `,
        secondary: 'bg-gray-500 hover:bg-gray-600 text-white focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed',
        danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed',
        success: 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed',
        warning: 'bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed',
        outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
        ghost: 'text-blue-500 hover:bg-blue-50 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
    };

    const sizeStyles = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'py-5 px-10 text-lg',
    };

    const widthStyles = fullWidth ? 'w-full' : '';

    const buttonClasses = `
        ${baseStyles}
        ${variantStyles[variant] || variantStyles.primary}
        ${sizeStyles[size] || sizeStyles.lg}
        ${widthStyles}
        ${className}
    `.trim().replace(/\s+/g, ' ');

    const isDisabled = disabled || loading;

    return (
        <button
            ref={ref}
            type={type}
            className={buttonClasses}
            disabled={isDisabled}
            onClick={onClick}
            {...props}
        >
            {loading && (
                <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            )}

            {!loading && LeftIcon && (
                <span className="mr-2">
                    {typeof LeftIcon === 'function' ? <LeftIcon /> : LeftIcon}
                </span>
            )}

            {children}

            {!loading && RightIcon && (
                <span className="ml-2">
                    {typeof RightIcon === 'function' ? <RightIcon /> : RightIcon}
                </span>
            )}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
