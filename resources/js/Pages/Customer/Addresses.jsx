import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import Popup from '../SuperAdmin/Components/Popup';
import ConfirmModal from '../SuperAdmin/Components/ConfirmModal';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';
import LocationSearchInput from '../../Components/Customer/LocationSearchInput';
import PrimaryButton from '../SuperAdmin/Components/PrimaryButton';
import MapView from '../../Components/Customer/MapView';
import IMask from 'imask';
import { useTranslation } from 'react-i18next';

const LABEL_VALUES = ['Home', 'Work', 'Company', 'Handover', 'Delivery'];
const LABEL_TRANSLATION_MAP = {
  home: 'addressesLabelHome',
  work: 'addressesLabelWork',
  company: 'addressesLabelCompany',
  handover: 'addressesLabelHandover',
  delivery: 'addressesLabelDelivery',
};

const toMakaaniDigits = (value) => (value ?? '').toString().replace(/\D/g, '').slice(0, 10);
// const sanitizeMobileInput = (value = '') => {
//   const normalized = typeof value === 'string' ? value : String(value ?? '');
//   return normalized.replace(/\D/g, '').slice(0, 12);
// };

const sanitizePhoneInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized.replace(/\D/g, '').slice(0, 12);
};
const MOBILE_REGEX = /^\d{1,12}$/;

const formatMakaani = (value) => {
  const digits = toMakaaniDigits(value);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  const first = digits.slice(0, 5);
  const second = digits.slice(5);
  return second ? `${first} ${second}` : first;
};

// No static fallback; empty state is shown when there are no addresses.

const LabelIcon = ({ type = 'home', className = 'w-4 h-4 md:w-5 md:h-5', active = false, mode = 'image', tint = null }) => {
  const cn = `inline-block ${className}`;

  if (mode === 'svg') {
    // Original SVGs used elsewhere (e.g. cards) to keep existing look
    switch (type) {
      case 'work':
        return (
          <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        );
      case 'company':
        return (
          <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18"/><path d="M4 21V8l8-5 8 5v13"/><path d="M8 21v-6h4v6"/></svg>
        );
      case 'handover':
        return (
          <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l7 7-7 7-7-7 7-7z"/></svg>
        );
      case 'delivery':
        return (
          <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7V10z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="17.5" cy="17" r="1.5"/></svg>
        );
      default:
        return (
          <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10.5l9-7 9 7V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z"/></svg>
        );
    }
  }

  // PNG icons for the label selector. Use CSS mask so we can control color
  const pathMap = {
    home: '/assets/images/home_label.png',
    work: '/assets/images/work_label.png',
    company: '/assets/images/buildings_label.png',
    handover: '/assets/images/handover_label.png',
    delivery: '/assets/images/delivery_label.png',
  };
  const src = pathMap[type] || pathMap.home;
  let colorClass = '';
  const styleObj = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };
  if (tint) {
    if (tint === 'current') {
      styleObj.backgroundColor = 'currentColor';
    } else if (tint.startsWith('#') || tint.startsWith('rgb')) {
      styleObj.backgroundColor = tint;
    } else {
      // allow passing a class like 'bg-red-500'
      colorClass = tint;
    }
  } else {
    colorClass = active ? 'bg-white' : 'bg-[#637381] opacity-90';
  }
  return <span aria-hidden className={`${cn} block ${colorClass}`} style={styleObj} />;
};

const LabelItem = ({ value, label, active, onClick }) => {
  const type = value.toLowerCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center w-20"
    >
      <span
        className={`w-12 h-12 rounded-full border flex items-center justify-center transition-colors ${
          active ? 'bg-[#338DFF] border-[#338DFF] text-white shadow-[0_6px_16px_rgba(51,141,255,0.25)]' : 'bg-white border-[#e5ecfb] text-[#637381]'
        }`}
      >
        <LabelIcon type={type} className="w-5 h-5" active={active} />
      </span>
      <span className={`mt-2 text-sm font-medium ${active ? 'text-blue-500' : 'text-[#111827]'}`}>{label}</span>
    </button>
  );
};

export default function Addresses({ addresses = [] }) {
  const { t } = useTranslation();
  const translateErrorMessage = useCallback(
    (message) => {
      if (!message || typeof message !== 'string') return message;
      const translated = t(message);
      return translated === message ? message : translated;
    },
    [t]
  );
  const initial = useMemo(() => (Array.isArray(addresses) ? addresses : []), [addresses]);
  const resolveLabelText = useCallback((value) => {
    const normalized = (value ?? '').toString().toLowerCase();
    const key = LABEL_TRANSLATION_MAP[normalized];
    return key ? t(key) : value || '';
  }, [t]);

  const [items, setItems] = useState(initial);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [updatedPopUp, setUpdatedPopUp] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const makaaniInputRef = useRef(null);
  const makaaniMaskRef = useRef(null);
  const makaaniDigitsRef = useRef('');

  const form = useForm({
    label: '',
    location_name: '',
    name: '',
    email: '',
    mobile: '',
    country: '',
    country_code: '',
    building_name: '',
    apartment: '',
    street: '',
    area: '',
    city: '',
    makaani_number: '',
    landmark: '',
    latitude: '',
    longitude: '',
  });
  const { data, setData, processing, errors, setError, clearErrors } = form;

  useEffect(() => setItems(initial), [initial]);

  // Fetch cities from API
  useEffect(() => {
    setLoadingCities(true);
    fetch('/api/v1/cities')
      .then(res => res.json())
      .then(data => {
        setCities(data.data || []);
      })
      .catch(err => {
        console.error('Failed to load cities:', err);
        setCities([]);
      })
      .finally(() => {
        setLoadingCities(false);
      });
  }, []);

  useEffect(() => {
    makaaniDigitsRef.current = data.makaani_number ?? '';
  }, [data.makaani_number]);

  useEffect(() => {
    if (!drawerVisible || !makaaniInputRef.current) {
      return undefined;
    }

    const mask = IMask(makaaniInputRef.current, {
      mask: '00000 00000',
      lazy: true,
      placeholderChar: ' ',
    });

    makaaniMaskRef.current = mask;

    const formatted = formatMakaani(data.makaani_number);
    mask.value = formatted;

    mask.on('accept', () => {
      const digits = mask.unmaskedValue;
      if (digits !== makaaniDigitsRef.current) {
        setData('makaani_number', digits);
      }
      clearErrors('makaani_number');
    });

    return () => {
      mask.destroy();
      makaaniMaskRef.current = null;
    };
  }, [drawerVisible, drawerOpen, clearErrors, setData]);

  useEffect(() => {
    if (!makaaniMaskRef.current) return;
    const formatted = formatMakaani(data.makaani_number);
    if (makaaniMaskRef.current.value !== formatted) {
      makaaniMaskRef.current.value = formatted;
    }
  }, [data.makaani_number]);

  const formatCoordinate = (value) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return value;
    }
    return numberValue.toFixed(6);
  };

  const handleFieldChange = (field, value) => {
    setData(field, value);
    if (errors[field]) {
      clearErrors(field);
    }
  };

  const openCreate = () => {
    setIsEditing(false);
    setActiveId(null);
    form.reset();
    clearErrors();
    setSelectedLocation(null);
    setDrawerVisible(true);
    requestAnimationFrame(() => setDrawerOpen(true));
  };
  const openEdit = (address) => {
    setIsEditing(true);
    setActiveId(address.id);
    const lbl = (address.label ?? '').toString();
    setData({
      label: lbl,
      location_name: address.location_name ?? '',
      name: address.name ?? '',
      email: address.email ?? '',
      mobile: sanitizePhoneInput(address.mobile ?? ''),
      building_name: address.building_name ?? address.building ?? '',
      apartment: address.apartment ?? '',
      street: address.street ?? '',
      area: address.area ?? '',
      city: address.city ?? '',
      makaani_number: toMakaaniDigits(address.makaani_number ?? address.makaani ?? ''),
      landmark: address.landmark ?? '',
      latitude: address.latitude ?? '',
      longitude: address.longitude ?? '',
    });
    setSelectedLocation(
      address.street && address.latitude && address.longitude
        ? {
            address: address.street,
            lat: parseFloat(address.latitude),
            lon: parseFloat(address.longitude),
          }
        : null
    );
    clearErrors();
    setDrawerVisible(true);
    requestAnimationFrame(() => setDrawerOpen(true));
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerVisible(false);
      setSubmitting(false);
    }, 250);
  };

  // Handle city selection from dropdown
  const handleCityChange = useCallback((cityId) => {
    const selectedCity = cities.find(c => c.id === parseInt(cityId));
    if (selectedCity) {
      setData('city', selectedCity.name);
      // Update map location if city has coordinates
      if (selectedCity.latitude && selectedCity.longitude) {
        const lat = parseFloat(selectedCity.latitude);
        const lon = parseFloat(selectedCity.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setSelectedLocation({
            address: selectedCity.name,
            lat: lat,
            lon: lon,
          });
          setData('latitude', lat);
          setData('longitude', lon);
        }
      }
    } else {
      setData('city', '');
    }
    if (errors.city) clearErrors('city');
  }, [cities, setData, errors.city, clearErrors]);

  const handleLocationChange = (value) => {
    setData('street', value);
    setData('latitude', '');
    setData('longitude', '');
    setSelectedLocation(null);
    ['street', 'latitude', 'longitude'].forEach((field) => {
      if (errors[field]) clearErrors(field);
    });
  };

  const handleLocationSelect = ({ address: addressText, lat, lon, components }) => {
    const latitude = typeof lat === 'number' ? lat : parseFloat(lat);
    const longitude = typeof lon === 'number' ? lon : parseFloat(lon);
    setSelectedLocation({ address: addressText, lat: latitude, lon: longitude });
    setData('street', addressText);
    setData('latitude', latitude);
    setData('longitude', longitude);
    if (components) {
      const inferredCity = components.city || components.town || components.village || components.municipality || components.suburb;
      if (inferredCity && !data.city) setData('city', inferredCity);
    }
    ['street', 'latitude', 'longitude'].forEach((field) => {
      if (errors[field]) clearErrors(field);
    });
  };

  const handleMapMarkerChange = useCallback((locationData) => {
    if (!locationData) {
      return;
    }
    const { lat, lon, address, components, city, state } = locationData;
    const latNum = typeof lat === 'number' ? lat : parseFloat(lat);
    const lonNum = typeof lon === 'number' ? lon : parseFloat(lon);
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lonNum);
    const fallbackAddress = hasCoords ? `${latNum.toFixed(6)}, ${lonNum.toFixed(6)}` : '';
    handleLocationSelect({
      address: address || fallbackAddress,
      lat: latNum,
      lon: lonNum,
      components: components || {
        city,
        state,
      },
    });
  }, [handleLocationSelect]);

  const mapMarker = useMemo(() => {
    const latFromForm = parseFloat(data.latitude);
    const lonFromForm = parseFloat(data.longitude);
    const latValue = Number.isFinite(selectedLocation?.lat) ? selectedLocation.lat : (Number.isFinite(latFromForm) ? latFromForm : null);
    const lonValue = Number.isFinite(selectedLocation?.lon) ? selectedLocation.lon : (Number.isFinite(lonFromForm) ? lonFromForm : null);
    if (Number.isFinite(latValue) && Number.isFinite(lonValue)) {
      return [latValue, lonValue];
    }
    return null;
  }, [selectedLocation, data.latitude, data.longitude]);

  const handleSave = (e) => {
    e?.preventDefault?.();

    // Prevent duplicate submissions
    if (submitting) {
      return;
    }

    const payload = {
      ...data,
      label: (data.label ?? '').toString().trim() || null,
    };

    clearErrors();

    const requiredFields = {
      location_name: t('addressesErrorLocationNameRequired'),
      city: t('addressesErrorCityRequired'),
      street: t('addressesErrorStreetRequired'),
      building_name: t('addressesErrorBuildingRequired'),
      apartment: t('addressesErrorApartmentRequired'),
      area: t('addressesErrorAreaRequired'),
      makaani_number: t('addressesErrorMakaaniRequired'),
      landmark: t('addressesErrorLandmarkRequired'),
      latitude: t('addressesErrorLocationRequired'),
      longitude: t('addressesErrorLocationRequired'),
    };

    let hasError = false;
    Object.entries(requiredFields).forEach(([field, message]) => {
      const value = (payload[field] ?? '').toString().trim();
      if (!value) {
        setError(field, message);
        hasError = true;
      }
    });

    if (hasError) {
      return;
    }

    const mobileValue = (payload.mobile ?? '').toString().trim();
    if (mobileValue && !MOBILE_REGEX.test(mobileValue)) {
      setError('mobile', 'Please enter a valid mobile number.');
      return;
    }

    // Mark submission as in progress
    setSubmitting(true);

    if (isEditing && activeId) {
      router.put(`/customer/addresses/${activeId}`, payload, {
        preserveScroll: true,
        onSuccess: () => {
          closeDrawer();
          setUpdatedPopUp(true);
        },
        onError: () => setSubmitting(false),
      });
    } else {
      router.post('/customer/addresses', payload, {
        preserveScroll: true,
        onSuccess: () => {
          closeDrawer();
          setShowPopup(true);
        },
        onError: () => setSubmitting(false),
      });
    }
  };

  const card = (a) => {
    const labelValue = resolveLabelText(a.label);
    const locationName = (a.location_name ?? '').trim();
    const iconType = (a.icon ?? a.label ?? '').toString().trim();
    const hasIcon = Boolean(iconType);
    const cardTitle = hasIcon ? (labelValue || locationName) : locationName;
    return (
      <div key={a.id} className="bg-white md:bg-[#f3f5f9] rounded-xl px-3 py-5 md:p-5 border border-[#e5ecfb]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="inline-flex items-center gap-2 font-bold text-blue-500">
              {hasIcon && <LabelIcon type={iconType.toLowerCase()} tint="current" />}
              <span className='text-gray-900 md:text-gray-900 font-bold'>{cardTitle}</span>
            </div>
            {hasIcon && locationName && labelValue && locationName !== labelValue && (
              <p className="ml-7 md:ml-8 mt-1 text-xs font-semibold text-[#6b7280]">{locationName}</p>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-500">
            <button type="button" title={t('commonDelete')} className="hover:opacity-80" onClick={() => setConfirmDeleteId(a.id)}>
              <img src="/assets/images/delete_icon.png" alt={t('commonDelete')} className="w-4 h-4" />
            </button>
            <button type="button" title={t('commonEdit')} className="hover:opacity-80" onClick={() => openEdit(a)}>
              <img src="/assets/images/edit_icon.png" alt={t('commonEdit')} className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="md:hidden space-y-1">
          <p className="font-semibold text-[#898989]">{a.street}</p>
          <p className="text-sm text-[#6b7280]"><span className="font-semibold text-[#4b5563]">{t('commonName')}:</span> {a.name || t('commonNotAvailable')}</p>
          <p className="text-sm text-[#6b7280]"><span className="font-semibold text-[#4b5563]">{t('commonEmail')}:</span> {a.email || t('commonNotAvailable')}</p>
          <p className="text-sm text-[#6b7280]"><span className="font-semibold text-[#4b5563]">{t('commonMobile')}:</span> {a.mobile || t('commonNotAvailable')}</p>
        </div>

        <div className="hidden md:grid grid-cols-2 gap-x-10 gap-y-4 text-sm">
          <div>
            <div className="text-[#8c8f93]">{t('commonName')}</div>
            <div className="font-semibold text-[#111827]">{a.name || t('commonNotAvailable')}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('commonEmail')}</div>
            <div className="font-semibold text-[#111827]">{a.email || t('commonNotAvailable')}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('commonMobile')}</div>
            <div className="font-semibold text-[#111827]">{a.mobile || t('commonNotAvailable')}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('commonBuildingName')}</div>
            <div className="font-semibold text-[#111827]">{a.building ?? a.building_name}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('addressesCardStreet')}</div>
            <div className="font-semibold text-[#111827]">{a.street}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('addressesCardApartment')}</div>
            <div className="font-semibold text-[#111827]">{a.apartment}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('commonCity')}</div>
            <div className="font-semibold text-[#111827]">{a.city}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('addressesCardArea')}</div>
            <div className="font-semibold text-[#111827]">{a.area}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('commonNearestLandmark')}</div>
            <div className="font-semibold text-[#111827]">{a.landmark}</div>
          </div>
          <div>
            <div className="text-[#8c8f93]">{t('addressesCardMakaaniNumber')}</div>
            <div className="font-semibold text-[#111827]">{a.makaani ?? a.makaani_number}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#1f2937] flex flex-col md:flex-row overflow-x-hidden rounded-b-xl shadow-lg">
      <Head title={t('addressSavedAddresses')} />
      <CustomerSidebar />
      <main className="flex-1 md:px-10 py-6 md:ml-[72px] md:overflow-y-auto scrollbar-hide">
        <div className="-mt-6 md:-mt-6 -mx-4 md:-mx-10">
        <CustomerHeader
            title={t('addressesHeaderTitle')}
            mobileTitle={t('addressesMobileTitle')}
            breadcrumbs={[
            { label: t('commonHome'), href: '/customer/dashboard' },
            { label: t('addressesBreadcrumbsSavedAddresses') }
            ]}
        />
        </div>
        <div className="px-4 sm:px-6 lg:px-6 pt-15 md:pt-8 pb-3 scrollbar-hide">
          <div className="rounded-2xl md:p-5 py-5 bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-2xl font-semibold hidden md:block text-gray-900">{t('addressSavedAddresses')}</h2>
              <button
                type="button"
                onClick={openCreate}
                className="hidden md:inline-flex items-center gap-2 text-sm font-semibold text-[#338DFF] hover:text-[#1f5fe0] transition-colors"
              >
                <span className="inline-flex items-center justify-center w-6 h-6">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="11" fill="#338DFF" />
                    <path d="M12 8v8M8 12h8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t('addressAddNew')}
              </button>
            </div>
            <hr className="my-4 hidden md:block border-[#E6EAF3]" />
            {items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-15">
                {items.map(card)}
              </div>
            ) : (
              <div className="flex items-center justify-center text-center py-16 text-gray-500">
                <div>
                  <p className="text-base">{t('addressesEmptyTitle')}</p>
                  <p className="text-sm mt-1">{t('addressesEmptySubtitle')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Drawer */}
      {drawerVisible && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeDrawer}
            aria-hidden
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl transition-transform duration-200 ${
              drawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleSave} className="h-full flex flex-col">
              <div className="px-8 py-6 border-b border-[#eef2ff] flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">{isEditing ? t('addressesDrawerTitleEdit') : t('addressAddNew')}</h2>
                <button type="button" onClick={closeDrawer} className="text-gray-500 hover:text-gray-700" aria-label={t('commonCancel')}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="px-8 py-6 space-y-6 overflow-y-auto scrollbar-hide flex-1 overflow-x-hidden bg-white">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('addressesFormLocationNameLabel')}</label>
                  <input
                    className="rounded-full px-4 py-3 text-sm border border-[#D6D9E3] w-full focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20"
                    placeholder={t('addressesFormPlaceholderLocationName')}
                    value={data.location_name}
                    onChange={(e) => handleFieldChange('location_name', e.target.value)}
                  />
                  {errors.location_name && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.location_name)}</p>}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        className="rounded-full w-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20"
                        placeholder={t('commonName')}
                        value={data.name}
                        onChange={(e)=>handleFieldChange('name', e.target.value)}
                      />
                      {errors.name && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.name)}</p>}
                    </div>
                    <div>
                      <input
                        type="email"
                        className="rounded-full w-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20"
                        placeholder={t('commonEmail')}
                        value={data.email}
                        onChange={(e)=>handleFieldChange('email', e.target.value)}
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.email)}</p>}
                    </div>
                  </div>

                  <div>
                    <input
                      className="rounded-full w-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20"
                      placeholder={t('commonMobile')}
                      inputMode="numeric"
                      maxLength={12}
                      value={data.mobile}
                      onChange={(e) => {
                        handleFieldChange('mobile', sanitizePhoneInput(e.target.value));
                      }}
                    />
                    {errors.mobile && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.mobile)}</p>}
                  </div>

                  <div className="relative">
                    <select
                      className="w-full rounded-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20 appearance-none bg-white"
                      value={cities.find(c => c.name === data.city)?.id || ''}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={loadingCities}
                    >
                      <option value="">{loadingCities ? t('commonLoadingCities') : t('addressesFormPlaceholderCity')}</option>
                      {cities.map(city => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                    <svg className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"/></svg>
                    {errors.city && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.city)}</p>}
                  </div>

                  <div className="relative">
                    <div className="w-full rounded-full border border-[#D6D9E3] bg-white focus-within:border-[#338DFF] focus-within:ring-2 focus-within:ring-[#338DFF]/20">
                      <LocationSearchInput
                        value={data.street}
                        onChange={handleLocationChange}
                        onSelect={handleLocationSelect}
                        placeholder={t('addressesFormPlaceholderAddress')}
                        className="pl-4 pr-10 py-1"
                        inputClassName="w-full px-0 py-3 text-sm text-[#111827] border-none outline-none bg-transparent"
                        minQueryLength={3}
                        disabled={false}
                      />
                    </div>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500">
                      <img src="/assets/images/map-icon.png" alt={t('addressesMapIconAlt')} />
                    </span>
                  </div>
                  {(errors.street || errors.latitude || errors.longitude) && (
                    <p className="mt-1 text-xs text-red-500">
                      {translateErrorMessage(errors.street || errors.latitude || errors.longitude)}
                    </p>
                  )}
                  {drawerVisible && (
                    <div className="rounded-2xl border border-[#E6EAF3] overflow-hidden">
                      <MapView
                        marker={mapMarker || undefined}
                        heightClass="h-[260px]"
                        hideViewLargerLink
                        draggableMarker
                        onMarkerChange={handleMapMarkerChange}
                      />
                    </div>
                  )}

                  <input className="rounded-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20" placeholder={t('addressesFormPlaceholderBuilding')} value={data.building_name} onChange={(e)=>handleFieldChange('building_name', e.target.value)} />
                  {errors.building_name && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.building_name)}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <input className="rounded-full w-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20" placeholder={t('addressesFormPlaceholderApartment')} value={data.apartment} onChange={(e)=>handleFieldChange('apartment', e.target.value)} />
                      {errors.apartment && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.apartment)}</p>}
                    </div>
                    <div>
                      <input className="rounded-full w-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20" placeholder={t('addressesFormPlaceholderArea')} value={data.area} onChange={(e)=>handleFieldChange('area', e.target.value)} />
                      {errors.area && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.area)}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        ref={makaaniInputRef}
                        className="rounded-full w-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20"
                        placeholder={t('addressesFormPlaceholderMakaani')}
                        defaultValue={formatMakaani(data.makaani_number)}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={t('addressesFormPlaceholderMakaani')}
                      />
                      {errors.makaani_number && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.makaani_number)}</p>}
                    </div>
                    <div>
                      <input className="rounded-full w-full px-4 py-3 text-sm border border-[#D6D9E3] focus:border-[#338DFF] focus:ring-2 focus:ring-[#338DFF]/20" placeholder={t('addressesFormPlaceholderLandmark')} value={data.landmark} onChange={(e)=>handleFieldChange('landmark', e.target.value)} />
                      {errors.landmark && <p className="mt-1 text-xs text-red-500">{translateErrorMessage(errors.landmark)}</p>}
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="text-base font-semibold text-gray-800 mb-3 border-b border-[#E6EAF3] pb-3">{t('addressesFormAddressType')}</div>
                    <div className="flex items-center gap-3 sm:gap-5 scrollbar-hide overflow-x-auto pb-1">
                      {LABEL_VALUES.map((value) => (
                        <LabelItem
                          key={value}
                          value={value}
                          label={resolveLabelText(value)}
                          active={data.label === value}
                          onClick={() => {
                            handleFieldChange('label', data.label === value ? '' : value);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 border-t border-[#eef2ff] flex items-center justify-center gap-4 bg-white">
                <button type="button" onClick={closeDrawer} disabled={submitting} className="h-[46px] px-6 rounded-full border-2 border-[#338DFF] text-[#338DFF] font-semibold disabled:opacity-60 disabled:cursor-not-allowed">{t('commonCancel')}</button>
                <PrimaryButton
                  type="submit"
                  disabled={processing || submitting}
                  text={isEditing ? t('addressesButtonUpdate') : t('addressesButtonSave')}
                  className="h-[46px] px-6 rounded-full"
                />
              </div>
            </form>
          </aside>
        </div>
      )}
      {showPopup && (
        <Popup
          title={t('commonSuccess')}
          message={t('addressesSuccessMessage')}
          buttonLabel={t('commonOkay')}
          onConfirm={() => setShowPopup(false)}
        />
      )}
      {updatedPopUp && (
        <Popup
          title={t('addressesUpdateTitle')}
          message={t('addressesUpdateMessage')}
          buttonLabel={t('commonOkay')}
          onConfirm={() => setUpdatedPopUp(false)}
        />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title={t('addressesDeleteConfirmTitle')}
          message={t('addressesDeleteConfirmMessage')}
          cancelLabel={t('commonNo')}
          confirmLabel={t('addressesDeleteConfirmYes')}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            router.delete(`/customer/addresses/${confirmDeleteId}`, {
              preserveScroll: true,
              onFinish: () => setConfirmDeleteId(null),
            });
          }}
        />
      )}
      <button className="fixed top-6 md:hidden right-5 z-10" onClick={openCreate}>
        <img src="/assets/images/add_icon.png" alt={t('addressesAddIconAlt')} />
      </button>
    </div>
  );
}
