import React, { forwardRef, useState } from 'react';

const Input = forwardRef(({
    type = 'text',
    label,
    value,
    onChange,
    placeholder,
    error,
    icon: Icon,
    name,
    id,
    disabled = false,
    className = '',
    inputClassName = '',
    labelClassName = '',
    errorClassName = '',
    containerClassName = '',
    iconClassName = '',
    required = false,
    showPassword = false,
    suffix = null,
    suffixClassName = '',
    ...props
}, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPasswordType = type === 'password';
    const actualType = isPasswordType && showPassword && isPasswordVisible ? 'text' : type;
    const shouldShowPasswordToggle = isPasswordType && showPassword;
    const displayIcon = shouldShowPasswordToggle ? null : Icon;

    return (
        <div className={`mb-4 text-left ${containerClassName}`}>
            <div className="relative">
                <input
                    ref={ref}
                    type={actualType}
                    id={inputId}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder || ' '}
                    disabled={disabled}
                    required={required}
                    className={`w-full border border-gray-200 rounded-full pt-4 pr-5 pb-4 pl-5 input-field focus:outline-none peer ${displayIcon || shouldShowPasswordToggle ? 'pr-10' : ''} ${error ? 'border-red-500' : ''} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''} ${inputClassName}`}
                    {...props}
                />
                {label && (
                    <label
                        htmlFor={inputId}
                        className={`font-semibold absolute left-6 transition-all duration-200 pointer-events-none
                            top-4.5 text-sm text-[#338DFF]
                            peer-focus:top-[-0.5rem]
                            peer-focus:text-sm
                            peer-focus:text-[#338DFF]
                            peer-focus:bg-white
                            peer-focus:px-1
                            peer-[:not(:placeholder-shown)]:top-[-0.5rem]
                            peer-[:not(:placeholder-shown)]:text-[#338DFF]
                            peer-[:not(:placeholder-shown)]:bg-white
                            peer-[:not(:placeholder-shown)]:px-1
                            peer-[&:-webkit-autofill]:top-[-0.5rem]
                            peer-[&:-webkit-autofill]:text-[#338DFF]
                            peer-[&:-webkit-autofill]:bg-white
                            peer-[&:-webkit-autofill]:px-1
                            ${error ? 'text-red-500 peer-focus:text-red-500' : ''}
                            ${labelClassName}
                        `}
                    >
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
               {shouldShowPasswordToggle ? (
                <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className={`absolute right-5 top-4.5 w-5 h-5 text-gray-400 hover:text-gray-600 focus:outline-none ${iconClassName}`}
                    tabIndex={-1}
                >
                    {!isPasswordVisible ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.1083 7.8916L7.8916 12.1083C7.34994 11.5666 7.0166 10.8249 7.0166 9.99993C7.0166 8.34993 8.34993 7.0166 9.99993 7.0166C10.8249 7.0166 11.5666 7.34994 12.1083 7.8916Z" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14.8501 4.8084C13.3918 3.7084 11.7251 3.1084 10.0001 3.1084C7.05845 3.1084 4.31678 4.84173 2.40845 7.84173C1.65845 9.01673 1.65845 10.9917 2.40845 12.1667C3.06678 13.2001 3.83345 14.0917 4.66678 14.8084" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path opacity="0.4" d="M7.0166 16.2751C7.9666 16.6751 8.97493 16.8917 9.99993 16.8917C12.9416 16.8917 15.6833 15.1584 17.5916 12.1584C18.3416 10.9834 18.3416 9.0084 17.5916 7.8334C17.3166 7.40006 17.0166 6.99173 16.7083 6.6084" stroke="#0C0C0C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path opacity="0.4" d="M12.925 10.584C12.7083 11.759 11.75 12.7173 10.575 12.934" stroke="#0C0C0C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.89175 12.1084L1.66675 18.3334" stroke="#0C0C0C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.3334 1.66699L12.1084 7.89199" stroke="#0C0C0C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                    </svg>
                    )}
                </button>
                ) : displayIcon ? (
                <div className={`absolute right-3 top-4.5 w-5 h-5 text-gray-400 ${iconClassName}`}>
                    {typeof displayIcon === 'function' ? <displayIcon /> : displayIcon}
                </div>
                ) : suffix ? (
                <span
                    className={`absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#94A3B8] pointer-events-none ${suffixClassName}`}
                >
                    {suffix}
                </span>
                ) : null}

            </div>
            {error && (
                <div className={`text-red-500 text-sm mt-1 ${errorClassName}`}>
                    {error}
                </div>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
