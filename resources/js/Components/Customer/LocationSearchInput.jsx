import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { searchLocations } from '../../Services/LocationService';
import { useTranslation } from 'react-i18next';

export default function LocationSearchInput({
  value,
  onChange, // (text) => void
  onSelect, // ({ address, lat, lon, components }) => void
  inputRef = null,
  placeholder = '',
  className = '',
  countryCode = 'sy', // Default to Syria
  city = '',
  viewbox = null, // [minLat, maxLat, minLon, maxLon] - defaults to Syria bounds
  minQueryLength = 3,
  inputClassName = 'mt-3 w-full px-3 text-sm text-[#111827] border-none outline-none bg-transparent',
  disabled = false,
  savedAddresses = [],
  onInputFocus,
  onInputBlur,
  provider = 'google', // 'openstreetmap' or 'google'
  rightAdornment = null,
  rightAdornmentClassName = 'absolute right-4 top-1/2 -translate-y-1/2',
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder || t('locationSearchPlaceholder');
  const page = usePage?.() || {};
  const config = page?.props?.config || {};
  const { url } = page;

  // Syria boundaries: [minLat, maxLat, minLon, maxLon] - memoized to prevent infinite loops
  const syriaBounds = useMemo(() => viewbox || [32.31, 37.31, 35.73, 42.45], [viewbox]);

  const currentUrl = url || (typeof window !== 'undefined' ? window.location?.pathname || '' : '');
  const isAddressesRoute = (
    (typeof window !== 'undefined' && window.route && typeof window.route.current === 'function' && window.route.current('customer.addresses.index'))
    || (currentUrl.includes('/customer/addresses')) || (currentUrl.includes('/admin/employees'))
  );

  // Use config from page props if available, otherwise use prop
  const locationProvider = config?.LOCATION_AUTOCOMPLETE_PROVIDER || provider || 'openstreetmap';

  // Debug logging (remove in production)
  if (typeof window !== 'undefined' && !window.__locationSearchLogged) {
    // console.log('[LocationSearchInput] Config:', { locationProvider, hasGoogleKey: !!config?.GOOGLE_PLACES_API_KEY });
    window.__locationSearchLogged = true;
  }

  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Check if direct Google API should be used (from config or prop)
  const useDirectGoogleApi = config?.USE_DIRECT_GOOGLE_API || false;
  // Only show/open suggestions after user interaction (typing)
  const [activated, setActivated] = useState(false);
  const debounceRef = useRef();
  const containerRef = useRef();
  const geocodeDebounceRef = useRef();
  const lastSelectedAddress = useRef('');
  const isInternalChangeRef = useRef(false);
  const hasUserTypedRef = useRef(false);

  useEffect(() => {
    setQuery(value || '');
    if (!isInternalChangeRef.current) {
      lastSelectedAddress.current = value || '';
      hasUserTypedRef.current = false;
    }
    isInternalChangeRef.current = false;
  }, [value]);

  useEffect(() => {
    // Do not fetch suggestions until the user has interacted
    if (disabled || !activated) return;
    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length < minQueryLength) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const mapped = await searchLocations(trimmed, {
          provider: locationProvider,
          googlePlacesApiKey: config?.GOOGLE_PLACES_API_KEY,
          useDirectGoogleApi,
          countryCode,
          city,
          viewbox: syriaBounds,
          limit: 6,
        });
        setResults(mapped);
        setOpen(true);
      } catch (e) {
        console.error('Location search error:', e);
        setError(t('locationSearchLoadError'));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, activated, countryCode, city, syriaBounds, minQueryLength, disabled, locationProvider, useDirectGoogleApi]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setResults([]);
    }
  }, [disabled]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    };
  }, []);

  const handleSelect = (item) => {
    if (disabled) return;
    isInternalChangeRef.current = true;
    hasUserTypedRef.current = false;
    setQuery(item.address);
    setOpen(false);
    onChange?.(item.address);
    onSelect?.(item);
    lastSelectedAddress.current = item.address;
  };

  // Auto-geocode when user types and doesn't select from suggestions
  const handleAutoGeocode = useCallback(async (address) => {
    if (!address || address.trim().length < minQueryLength) return;
    if (address === lastSelectedAddress.current) return; // Already selected from suggestions

    try {
      setLoading(true);
      const mapped = await searchLocations(address, {
        provider: locationProvider,
        googlePlacesApiKey: config?.GOOGLE_PLACES_API_KEY,
        useDirectGoogleApi,
        countryCode,
        city,
        viewbox: syriaBounds,
        limit: 1, // Only need the first result
      });

      if (mapped && mapped.length > 0) {
        const firstResult = mapped[0];
        // Auto-select the first result
        onChange?.(firstResult.address);
        onSelect?.(firstResult);
        lastSelectedAddress.current = firstResult.address;
        hasUserTypedRef.current = false;
      }
    } catch (e) {
      console.error('Auto-geocode error:', e);
    } finally {
      setLoading(false);
    }
  }, [minQueryLength, locationProvider, config?.GOOGLE_PLACES_API_KEY, useDirectGoogleApi, countryCode, city, syriaBounds, onChange, onSelect]);

  /**
   * Build display title and subtitle from address and components
   * For Google results, shows full formatted address
   * For OSM results, intelligently splits the address
   */
  const buildAddressDisplay = (item) => {
    // For saved addresses, use pre-built title/subtitle
    if (item._saved) {
      return {
        title: item._title || item.address,
        subtitle: item._subtitle || '',
      };
    }

    // For Google API results with formatted_address
    if (item.source === 'google' && item.address) {
      // Google returns full formatted address, split intelligently
      const parts = (item.address || '').split(',').map((p) => p.trim()).filter(Boolean);

      if (parts.length === 0) {
        return { title: item.address, subtitle: '' };
      }

      // For single or few parts, show all as title
      if (parts.length <= 2) {
        return {
          title: item.address,
          subtitle: ''
        };
      }

      // For multiple parts, show first part(s) as title, rest as subtitle
      // Take first 2 parts as title (usually building/street + area/district)
      const titleParts = parts.slice(0, Math.min(2, parts.length - 1));
      const subtitleParts = parts.slice(Math.min(2, parts.length - 1));

      return {
        title: titleParts.join(', ') || item.address,
        subtitle: subtitleParts.join(', ') || ''
      };
    }

    // Fallback: Parse address string by commas (for OSM results)
    const parts = (item.address || '').split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) {
      return { title: item.address || t('commonLocation'), subtitle: '' };
    }

    // Show first part as title, rest as subtitle
    const [title, ...rest] = parts;
    const subtitle = rest.join(', ');
    return { title, subtitle };
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          if (disabled) return;
          const next = e.target.value;
          if (!activated && next.trim().length > 0) setActivated(true);
          isInternalChangeRef.current = true;
          hasUserTypedRef.current = true;
          setQuery(next);
          onChange?.(next);
          if (next.trim().length === 0) {
            // When cleared, show saved addresses again
            setActivated(false);
            if (savedAddresses && savedAddresses.length) {
              const mapped = savedAddresses.map((a, i) => {
                const title = a.label || (a.street || t('commonSaved'));
                const subtitle = [a.street, a.area, a.city].filter(Boolean).join(', ');
                return {
                  address: subtitle || title,
                  lat: parseFloat(a.latitude ?? a.lat ?? 0),
                  lon: parseFloat(a.longitude ?? a.lon ?? 0),
                  components: {},
                  _saved: true,
                  _id: a.id ?? i,
                  _title: title,
                  _subtitle: subtitle,
                };
              }).filter(item => item._title || item._subtitle);
              setResults(mapped);
              setOpen(true);
            } else {
              setResults([]);
              setOpen(false);
            }
          }
        }}
        placeholder={resolvedPlaceholder}
        onFocus={() => {
          if (disabled) return;
          const trimmed = (query || '').trim();
          if (!activated || trimmed.length === 0) {
            if (savedAddresses && savedAddresses.length) {
              const mapped = savedAddresses.map((a, i) => {
                const title = a.label || (a.street || t('commonSaved'));
                const subtitle = [a.street, a.area, a.city].filter(Boolean).join(', ');
                return {
                  address: subtitle || title,
                  lat: parseFloat(a.latitude ?? a.lat ?? 0),
                  lon: parseFloat(a.longitude ?? a.lon ?? 0),
                  components: {},
                  _saved: true,
                  _id: a.id ?? i,
                  _title: title,
                  _subtitle: subtitle,
                };
              }).filter(item => item._title || item._subtitle);
              setResults(mapped);
              setOpen(true);
              return;
            }
          }
          if (activated && results.length) setOpen(true);
          if (typeof onInputFocus === 'function') onInputFocus();
        }}
        onBlur={() => {
          // Debounce auto-geocode to avoid conflicts with suggestion selection
          if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
          geocodeDebounceRef.current = setTimeout(() => {
            const trimmed = (query || '').trim();
            if (hasUserTypedRef.current && trimmed && trimmed !== lastSelectedAddress.current) {
              handleAutoGeocode(trimmed);
            }
          }, 300);
          if (typeof onInputBlur === 'function') onInputBlur();
        }}
        aria-autocomplete="list"
        aria-expanded={open}
        disabled={disabled}
        className={`${inputClassName} ${rightAdornment ? 'pr-12' : ''} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      />
      {rightAdornment && (
        <div className={rightAdornmentClassName}>
          {rightAdornment}
        </div>
      )}
      {open && !disabled && (
        <div className={`absolute left-0 right-0 ${isAddressesRoute ? 'top-full mt-2' : 'top-16 md:top-auto md:bottom-full mb-10'} z-999`}>
          <div className="bg-white border border-gray-200 shadow-[0_12px_30px_rgba(0,0,0,0.08)] rounded-[18px] overflow-hidden">
            {activated && loading && (
              <div className="px-4 py-3 text-sm text-gray-500">{t('locationSearchSearching')}</div>
            )}
            {activated && !loading && error && (
              <div className="px-4 py-3 text-sm text-red-500">{error}</div>
            )}
            {!activated && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500">{t('locationSearchNoSaved')}</div>
            )}
            {activated && !loading && !error && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500">{t('locationSearchNoResults')}</div>
            )}
            {results.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                {results.map((item, idx) => {
                  const { title, subtitle } = buildAddressDisplay(item);
                  return (
                    <React.Fragment key={`${item._id ?? ''}-${item.lat}-${item.lon}-${idx}`}>
                      <button
                        type="button"
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#f5f7fb] `}
                        onClick={() => handleSelect(item)}
                      >
                        <span className="mt-1 inline-flex items-center justify-center rounded-full ">
                          <img src="/assets/images/location_icon.png" alt="pin"  />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-[#111827] leading-tight">{ title }</span>
                          {subtitle && (
                            <span className="mt-1 block text-xs text-[#6b7280] leading-tight">{subtitle}</span>
                          )}
                        </span>
                      </button>
                      {idx !== results.length - 1 ?
                       <hr className='border-gray-200 w-[95%] mx-auto'/>
                      : ''}

                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
