import React from 'react';

const Checkbox = ({
    checked = false,
    onChange,
    label,
    id,
    disabled = false,
    className = '',
    labelClassName = '',
    checkboxClassName = '',
    toggleBackgroundClass = 'bg-gray-300 peer-checked:bg-blue-500',
    toggleDotClass = 'bg-white',
    name,
    ...props
}) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <label
            className={`flex items-center text-lg cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
            htmlFor={checkboxId}
        >
            <div className={`relative mr-2 ${checkboxClassName}`}>
                <input
                    type="checkbox"
                    id={checkboxId}
                    name={name}
                    className="sr-only peer"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    {...props}
                />
                <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${toggleBackgroundClass}`}></div>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-5 ${toggleDotClass}`}></div>
            </div>
            {label && (
                <span className={labelClassName}>{label}</span>
            )}
        </label>
    );
};

export default Checkbox;
