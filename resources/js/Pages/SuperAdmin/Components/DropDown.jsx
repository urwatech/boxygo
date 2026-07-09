import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
};

export default function DropDown({
  initialSelected = [],
  options = [],
  placeholder = null,
  onChange,
  multiple = true,
  className = 'w-[280px]',
  containerClassName = 'rounded-[16px]',
}) {
  const { t } = useTranslation();
  const normalizedInitialSelected = useMemo(
    () => toArray(initialSelected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(initialSelected)]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedValues, setSelectedValues] = useState(normalizedInitialSelected);
  const containerRef = useRef(null);
  const resolvedPlaceholder = placeholder ?? t('superAdminDropdownSearchAreas');

  const optionLookup = useMemo(() => {
    const m = new Map();
    (options || []).forEach((o) => m.set(o.value, o));
    return m;
  }, [options]);

  useEffect(() => {
    setSelectedValues(normalizedInitialSelected);
  }, [normalizedInitialSelected]);

  if (!options || options.length === 0) {
    return (
      <div
        className={`${className} ${containerClassName} border border-[#E5E7EB] bg-white p-4 text-gray-500 text-sm text-center`}
      >
        {t('superAdminDropdownNoOptionsAvailable')}
      </div>
    );
  }

  const toggleOption = (value) => {
    setSelectedValues((prev) => {
      const exists = prev.includes(value);

      if (multiple) {
        const updated = exists ? prev.filter((v) => v !== value) : [...prev, value];
        onChange && onChange(updated);
        return updated;
      }

      const updated = exists ? [] : [value];
      onChange && onChange(updated);
      setIsOpen(false);
      return updated;
    });
  };

  const handleRemoveChip = (value) => {
    setSelectedValues((prev) => {
      const updated = prev.filter((v) => v !== value);
      onChange && onChange(updated);
      return updated;
    });
  };

  const filteredOptions = useMemo(() => {
    if (!searchValue.trim()) return options;
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchValue.trim().toLowerCase())
    );
  }, [options, searchValue]);

  const selectedOptions = useMemo(() => {
    return selectedValues
      .map((value) => optionLookup.get(value) || { value, label: String(value) })
      .filter(Boolean);
  }, [optionLookup, selectedValues]);

  const renderSelectedChips = (containerClasses = '') => {
    if (!selectedOptions.length) {
      return <span className="text-sm text-gray-900 pl-2 w-full block text-align-left">{resolvedPlaceholder}</span>;
    }

    return (
      <div className={`flex flex-wrap items-center gap-2 ${containerClasses}`}>
        {selectedOptions.map((option) => (
          <span
            key={option.value}
            className="inline-flex items-center gap-1 rounded-full bg-[#338DFF] px-3 py-1 text-xs font-medium text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {option.label}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleRemoveChip(option.value);
              }}
              className="text-white text-xs leading-none hover:opacity-80"
              aria-label={t('superAdminDropdownRemoveOptionAria', { label: option.label })}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
  ref={containerRef}
  className={`
      ${className}
      border border-[#E5E7EB] bg-white overflow-hidden transition-all duration-200 cursor-pointer relative
      ${isOpen ? "rounded-[16px]" : "rounded-[16px]"}
      ${containerClassName}
  `}
>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsOpen((prev) => !prev);
        }}
        className="flex items-start justify-between "
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">{renderSelectedChips()}</div>
        </div>

        <button
          type="button"
          aria-label={isOpen ? t('superAdminDropdownCloseAria') : t('superAdminDropdownOpenAria')}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="ml-2 shrink-0 rounded-full p-1 transition cursor-pointer"
        >
          <svg
            className={`h-5 w-5 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-[#E5E7EB] will-change-auto">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E5E7EB]">
            <svg
              className="h-4 w-4 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={resolvedPlaceholder}
              className="w-full border-none bg-transparent text-sm text-gray-600 placeholder:text-gray-400 focus:outline-none"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto text-sm text-[#0F172A]" role="listbox">
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-3 text-xs text-gray-400">{t('superAdminDropdownNoResultsFound')}</li>
            ) : (
              filteredOptions.map((opt) => {
                const selected = selectedValues.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    className={`px-4 py-3 cursor-pointer border-b border-[#E5E7EB] last:border-none hover:bg-gray-50 ${
                      selected ? 'text-[#338DFF] font-medium' : ''
                    }`}
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggleOption(opt.value)}
                  >
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
