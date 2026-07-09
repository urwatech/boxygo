import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import Menu from '../../../Components/Common/Menu';
import IMask from 'imask';
import AuthShell from '../../../Components/Customer/AuthShell';

const PHONE_PREFIX = '+';
const PHONE_PREFIX_DIGITS = '';
const PHONE_MASK_PATTERN = '+{} 000 000 000 000';

const extractSubscriberDigits = (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    const withoutPrefix = digits.startsWith(PHONE_PREFIX_DIGITS)
        ? digits.slice(PHONE_PREFIX_DIGITS.length)
        : digits;
    return withoutPrefix.slice(0, 12);
};

const formatPhoneForMask = (value) => {
    const subscriber = extractSubscriberDigits(value);
    if (!subscriber) return `${PHONE_PREFIX} `;
    return `${PHONE_PREFIX} ${subscriber}`;
};

const sanitizeTextInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
        .replace(/[\u2600-\u27BF]/g, '')
        .replace(/[\uFE0F\u200D]/g, '');
};

// Strict email sanitizer to block emojis and non-ASCII
const sanitizeEmailInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
};

export default function Register() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        first_name: '',
        last_name: '',
        email: '',
        phone_code: '+',
        phone_number: '',
        password: '',
        password_confirmation: '',
        terms: false,
        business_type: '',
        country: '',
        city: '',
        address: '',
        trade_license_number: '',
        license_copy: null,
        shipmentId:  null,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);
    const [isBusiness, setIsBusiness] = useState(false);
    const [showSecondStep, setShowSecondStep] = useState(false);
    const [showCountryMenu, setShowCountryMenu] = useState(false);
    const [showCityMenu, setShowCityMenu] = useState(false);
    const [showBusinessTypeMenu, setShowBusinessTypeMenu] = useState(false);
    const [businessErrors, setBusinessErrors] = useState({});
    const [additionalErrors, setAdditionalErrors] = useState({});
    const licenseFileName = data.license_copy ? data.license_copy.name : '';

    const countryRef = useRef(null);
    const cityRef = useRef(null);
    const businessTypeRef = useRef(null);
    const phoneMaskRefs = useRef({});
    const phoneInputMobileRef = useRef(null);
    const phoneInputBusinessMobileRef = useRef(null);
    const phoneInputBusinessDesktopRef = useRef(null);
    const phoneInputIndividualRef = useRef(null);

    const businessTypes = [
        { label: t('authRegisterBusinessTypeCorporate'), value: 'Business / Corporate' },
        { label: t('authRegisterBusinessTypeEcommerceSeller'), value: 'E-commerce Seller' },
        { label: t('authRegisterBusinessTypeMarketplaceVendor'), value: 'Marketplace Vendor' },
        { label: t('authRegisterBusinessTypeWholesaleDistributor'), value: 'Wholesale / Distributor' },
        { label: t('authRegisterBusinessTypeRetailer'), value: 'Retailer' },
        { label: t('authRegisterBusinessTypeManufacturer'), value: 'Manufacturer' },
        { label: t('authRegisterBusinessTypeSupplier'), value: 'Supplier' },
    ];

    const countries = [
        { label: t('authRegisterCountrySyria'), value: 'Syria' },
    ];

    const [cities, setCities] = useState([]);
    const [citiesLoading, setCitiesLoading] = useState(false);
    const normalizedCountry = (data.country || '').trim().toLowerCase();
    const cityButtonLabel = citiesLoading
        ? t('commonLoadingCities')
        : data.city ||
            (!normalizedCountry
                ? t('authRegisterSelectCity')
                : normalizedCountry === 'syria'
                    ? (cities.length ? t('authRegisterSelectCity') : t('authRegisterNoCitiesFound'))
                    : t('authRegisterNoCitiesAvailable'));

    const clearLocalError = (field) => {
        setBusinessErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setAdditionalErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const fetchCitiesForCountry = useCallback(async (country) => {
        if (typeof window === 'undefined') {
            return;
        }

        const normalized = (country || '').trim().toLowerCase();

        if (!normalized || normalized !== 'syria') {
            setCities([]);
            setCitiesLoading(false);
            return;
        }

        if (typeof window.axios === 'undefined') {
            console.warn('Axios instance is not available. Unable to fetch cities.');
            setCities([]);
            setCitiesLoading(false);
            return;
        }

        setCitiesLoading(true);

        try {
            const response = await window.axios.get('/api/v1/cities', {
                params: { country },
            });

            const items = Array.isArray(response?.data?.data) ? response.data.data : [];
            const uniqueMap = new Map();

            items.forEach((city) => {
                const name = (city?.name ?? '').trim();
                if (!name) {
                    return;
                }

                const key = name.toLowerCase();

                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, {
                        id: city?.id ?? key,
                        label: name,
                        value: name,
                    });
                }
            });

            const dedupedCities = Array.from(uniqueMap.values()).sort((a, b) =>
                a.label.localeCompare(b.label)
            );

            setCities(dedupedCities);

            setAdditionalErrors((prev) => {
                if (!prev.city) {
                    return prev;
                }

                const next = { ...prev };
                delete next.city;
                return next;
            });
        } catch (error) {
            console.error('Unable to fetch cities for country', country, error);
            setCities([]);
            setAdditionalErrors((prev) => ({
                ...prev,
                city: t('authRegisterLoadCitiesError'),
            }));
        } finally {
            setCitiesLoading(false);
        }
    }, [setAdditionalErrors, setCities, setCitiesLoading]);

    const handleCountrySelect = (item) => {
        clearLocalError('country');
        setData('country', item.value);
        setShowCountryMenu(false);

        if (data.city) {
            setData('city', '');
        }

        clearLocalError('city');
        setShowCityMenu(false);
        setCities([]);
        const countryValue = (item.value || '').trim().toLowerCase();
        setCitiesLoading(countryValue === 'syria');
    };

    useEffect(() => {
        const updateMaskValue = (mask, value) => {
            const target = formatPhoneForMask(value);
            if (mask.value !== target) {
                mask.value = target;
            }
        };

        const ensureMask = (key, ref, shouldExist) => {
            const input = shouldExist ? ref.current : null;
            const existing = phoneMaskRefs.current[key];

            if (!input && existing) {
                existing.destroy();
                delete phoneMaskRefs.current[key];
                return;
            }

            if (input && !existing) {
                const mask = IMask(input, {
                    mask: PHONE_MASK_PATTERN,
                    lazy: true,
                    overwrite: true,
                });
                mask.on('accept', () => {
                    const subscriberDigits = extractSubscriberDigits(mask.value);
                    const nextValue = subscriberDigits ? `${PHONE_PREFIX} ${subscriberDigits}` : '';
                    setData('phone_number', nextValue);
                    setData('phone_code', PHONE_PREFIX);
                    clearLocalError('phone_number');
                    clearLocalError('phone_code');
                });
                phoneMaskRefs.current[key] = mask;
                updateMaskValue(mask, data.phone_number);
                return;
            }

            if (input && existing) {
                updateMaskValue(existing, data.phone_number);
            }
        };

        ensureMask('mobile', phoneInputMobileRef, true);
        ensureMask(
            'businessMobile',
            phoneInputBusinessMobileRef,
            isBusiness && !showSecondStep && !isDesktop
        );
        ensureMask(
            'businessDesktop',
            phoneInputBusinessDesktopRef,
            isBusiness && !showSecondStep && isDesktop
        );
        ensureMask('individual', phoneInputIndividualRef, !isBusiness && isDesktop);
    }, [data.phone_number, isBusiness, showSecondStep, isDesktop]);

    useEffect(() => () => {
        Object.values(phoneMaskRefs.current).forEach((mask) => mask.destroy());
        phoneMaskRefs.current = {};
    }, []);
    useEffect(() => {
        if (data.phone_code !== PHONE_PREFIX) {
            setData('phone_code', PHONE_PREFIX);
        }
    }, [data.phone_code]);
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const params = new URLSearchParams(window.location.search);
            
            const sid = params.get('bookingId');
            if (sid) {
                setData('shipmentId', sid);
            }
        } catch (e) {
            // ignore malformed URLSearchParams or other errors
        }
    }, []);
    useEffect(() => {
        const selectedCountry = (data.country || '').trim();

        if (!selectedCountry) {
            setCities([]);
            setCitiesLoading(false);
            return;
        }

        if (selectedCountry.toLowerCase() === 'syria') {
            fetchCitiesForCountry(selectedCountry);
            return;
        }

        setCities([]);
        setCitiesLoading(false);
    }, [data.country, fetchCitiesForCountry, setCities, setCitiesLoading]);
    const validateBusinessDetails = () => {
        const validationErrors = {};
        const businessName = data.first_name.trim();
        const businessType = data.business_type.trim();
        const email = data.email.trim();
        const phoneCode = (data.phone_code ?? PHONE_PREFIX).trim() || PHONE_PREFIX;
        const subscriberDigits = extractSubscriberDigits(data.phone_number);

        if (!businessName) validationErrors.first_name = t('authRegisterBusinessNameRequired');
        if (!businessType) validationErrors.business_type = t('authRegisterBusinessTypeRequired');
        if (!email) validationErrors.email = t('authRegisterBusinessEmailRequired');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validationErrors.email = t('authRegisterValidEmail');
        if (!phoneCode) validationErrors.phone_code = t('authRegisterPhoneCodeRequired');
        if (!subscriberDigits) {
            validationErrors.phone_number = t('authRegisterValidPhone');
            validationErrors.phone_code = validationErrors.phone_number;
        }
        if (!data.password) validationErrors.password = t('validationPasswordRequired');
        if (!data.password_confirmation) validationErrors.password_confirmation = t('authRegisterConfirmPasswordRequired');
        else if (data.password && data.password !== data.password_confirmation) {
            validationErrors.password_confirmation = t('validationPasswordMismatch');
        }
        if (!data.terms) validationErrors.terms = t('authRegisterTermsRequired');

        return validationErrors;
    };

    const validateAdditionalDetails = () => {
        const validationErrors = {};
        if (!data.country) validationErrors.country = t('authRegisterCountryRequired');
        if (!data.city) validationErrors.city = t('authRegisterCityRequired');
        if (!data.address.trim()) validationErrors.address = t('authRegisterFullAddressRequired');
        if (!data.trade_license_number.trim()) validationErrors.trade_license_number = t('authRegisterTradeLicenseRequired');
        if (!data.license_copy) validationErrors.license_copy = t('authRegisterLicenseCopyRequired');
        if (!data.terms) validationErrors.terms = t('authRegisterTermsRequired');
        return validationErrors;
    };

    const handleModeToggle = (mode) => (e) => {
        e.preventDefault();
        setIsBusiness(mode === 'business');
        setShowSecondStep(false);
        setBusinessErrors({});
        setAdditionalErrors({});
    };

    const handleBusinessContinue = (e) => {
        e.preventDefault();
        const validationErrors = validateBusinessDetails();
        if (Object.keys(validationErrors).length) {
            setBusinessErrors(validationErrors);
            return;
        }
        setBusinessErrors({});
        setAdditionalErrors({});
        setShowSecondStep(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isBusiness && showSecondStep) {
            const validationErrors = validateAdditionalDetails();
            if (Object.keys(validationErrors).length) {
                setAdditionalErrors(validationErrors);
                return;
            }
            setAdditionalErrors({});
        }
        post('/register', {
            onError: (errors) => {
                // Check if there are errors in step 1 fields
                const step1Fields = ['first_name', 'business_type', 'email', 'phone_number', 'phone_code', 'password', 'password_confirmation'];
                const hasStep1Errors = step1Fields.some(field => errors[field]);

                if (isBusiness && showSecondStep && hasStep1Errors) {
                    // Go back to step 1 to show the errors
                    setShowSecondStep(false);
                    setBusinessErrors(errors);
                }
            }
        });
    };

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(min-width: 768px)');
        const set = () => setIsDesktop(mq.matches);
        set();
        if (mq.addEventListener) mq.addEventListener('change', set);
        else if (mq.addListener) mq.addListener(set);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener('change', set);
            else if (mq.removeListener) mq.removeListener(set);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (countryRef.current && !countryRef.current.contains(event.target)) {
                setShowCountryMenu(false);
            }
            if (cityRef.current && !cityRef.current.contains(event.target)) {
                setShowCityMenu(false);
            }
            if (businessTypeRef.current && !businessTypeRef.current.contains(event.target)) {
                setShowBusinessTypeMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <>
            {/* Mobile view wrapper */}
            <div className="md:hidden min-h-screen flex items-start justify-center px-4 sm:px-6 ">
                <div className="signup-shell w-full max-w-6xl bg-white rounded-[36px] overflow-hidden flex flex-col gap-10">
                    {/* Mobile: Sign Up form */}
                    {isBusiness ? (
                    // Mobile: Business Registration Form
                    <section className="md:hidden w-full bg-white px-3 py-8 flex flex-col min-h-screen overflow-visible">
                        {!showSecondStep ? (
                            // Step 1: Basic Business Details
                            <>
                                <div className="mt-1">
                                    <h1 className="text-3xl leading-8 font-semibold text-gray-900">{t('authRegisterBusinessDetailsTitle')}</h1>
                                    <p className="mt-3 text-sm leading-6 text-gray-500 max-w-[320px]">
                                        {t('authRegisterBusinessDetailsSubtitle')}
                                    </p>
                                </div>

                                <form onSubmit={handleBusinessContinue} className="mt-7 space-y-5 overflow-visible">
                                    {/* Business Name */}
                                    <div className="space-y-1">
                                        <input
                                            type="text"
                                            placeholder={t('authRegisterBusinessNamePlaceholder')}
                                            value={data.first_name}
                                            onChange={(e) => {
                                                clearLocalError('first_name');
                                                setData('first_name', sanitizeTextInput(e.target.value));
                                            }}
                                            className="w-full rounded-full border border-gray-200 px-5 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                        />
                                        {(businessErrors.first_name || errors.first_name) && (
                                            <p className="text-red-600 text-xs">
                                                {businessErrors.first_name || errors.first_name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Business Type */}
                                    <div className="space-y-1" ref={businessTypeRef}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowBusinessTypeMenu((prev) => !prev);
                                            }}
                                            className={`w-full rounded-full border border-gray-200 bg-white px-5 py-3 pr-12 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 ${data.business_type ? 'text-gray-700' : 'text-gray-400'} relative`}
                                        >
                                            {data.business_type || t('authRegisterBusinessTypePlaceholder')}
                                            <span className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-gray-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                                </svg>
                                            </span>
                                        </button>
                                        {showBusinessTypeMenu && (
                                            <Menu
                                                items={businessTypes}
                                                onItemClick={(item) => {
                                                    clearLocalError('business_type');
                                                    setData('business_type', item.value);
                                                    setShowBusinessTypeMenu(false);
                                                }}
                                                anchorRef={businessTypeRef}
                                            />
                                        )}
                                        {(businessErrors.business_type || errors.business_type) && (
                                            <p className="text-red-600 text-xs">
                                                {businessErrors.business_type || errors.business_type}
                                            </p>
                                        )}
                                    </div>

                                    {/* Business Email */}
                                    <div className="space-y-1">
                                        <input
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            placeholder={t('authRegisterBusinessEmailPlaceholder')}
                                            value={data.email}
                                            onChange={(e) => {
                                                clearLocalError('email');
                                                setData('email', sanitizeEmailInput(e.target.value));
                                            }}
                                            onBeforeInput={(event) => {
                                                const d = event.data ?? '';
                                                if (/[^a-zA-Z0-9._%+\-@]/.test(d)) {
                                                    event.preventDefault();
                                                }
                                            }}
                                            onPaste={(event) => {
                                                const pasted = (event.clipboardData || window.clipboardData).getData('text');
                                                const sanitized = sanitizeEmailInput(pasted);
                                                if (sanitized !== pasted) {
                                                    event.preventDefault();
                                                    const target = event.target;
                                                    const start = target.selectionStart || 0;
                                                    const end = target.selectionEnd || 0;
                                                    const next = (target.value || '').slice(0, start) + sanitized + (target.value || '').slice(end);
                                                    setData('email', next);
                                                }
                                            }}
                                            className="w-full rounded-full border border-gray-200 px-5 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                        />
                                        {(businessErrors.email || errors.email) && (
                                            <p className="text-red-600 text-xs">
                                                {businessErrors.email || errors.email}
                                            </p>
                                        )}
                                    </div>

                                    {/* Phone input with country code */}
                                    <div className="space-y-1">
                                        <div className="rounded-full border border-gray-200 h-[48px] focus-within:ring-2 focus-within:ring-[#4c7bff]/70">
                                            <input
                                                ref={phoneInputBusinessMobileRef}
                                                type="tel"
                                                inputMode="tel"
                                                placeholder={t('authRegisterPhonePlaceholder')}
                                                className="w-full h-full rounded-full px-5 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none"
                                                autoComplete="tel"
                                            />
                                        </div>
                                        {(businessErrors.phone_number ||
                                            businessErrors.phone_code ||
                                            errors.phone_number ||
                                            errors.phone_code) && (
                                            <p className="text-red-600 text-xs">
                                                {businessErrors.phone_number ||
                                                    businessErrors.phone_code ||
                                                    errors.phone_number ||
                                                    errors.phone_code}
                                            </p>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-1">
                                        <div className="relative h-[48px]">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder={t('commonPassword')}
                                                value={data.password}
                                                onChange={(e) => {
                                                    clearLocalError('password');
                                                    const sanitizedPassword = sanitizeTextInput(e.target.value);
                                                    setData('password', sanitizedPassword);
                                                }}
                                                className="w-full h-full rounded-full border border-gray-200 px-5 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(v => !v)}
                                                className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-gray-600"
                                                aria-label={showPassword ? t('authRegisterHidePassword') : t('authRegisterShowPassword')}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </button>
                                        </div>
                                        {(businessErrors.password || errors.password) && (
                                            <p className="text-red-600 text-xs">
                                                {businessErrors.password || errors.password}
                                            </p>
                                        )}
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="space-y-1">
                                        <div className="relative h-[48px]">
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                placeholder={t('authRegisterRetypePasswordPlaceholder')}
                                                value={data.password_confirmation}
                                                onChange={(e) => {
                                                    clearLocalError('password_confirmation');
                                                    const sanitizedConfirmation = sanitizeTextInput(e.target.value);
                                                    setData('password_confirmation', sanitizedConfirmation);
                                                }}
                                                className="w-full h-full rounded-full border border-gray-200 px-5 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirm(v => !v)}
                                                className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-gray-600"
                                                aria-label={showConfirm ? t('authRegisterHidePassword') : t('authRegisterShowPassword')}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </button>
                                        </div>
                                        {(businessErrors.password_confirmation || errors.password_confirmation) && (
                                            <p className="text-red-600 text-xs">
                                                {businessErrors.password_confirmation || errors.password_confirmation}
                                            </p>
                                        )}
                                    </div>

                                    {/* Terms */}
                                    <label className="flex items-start gap-3 text-sm text-gray-500 leading-relaxed cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="mt-[2px] h-4 w-4 rounded border-gray-300"
                                            checked={data.terms}
                                            onChange={(e) => {
                                                clearLocalError('terms');
                                                setData('terms', e.target.checked);
                                            }}
                                        />
                                        <span>
                                            {t('authRegisterTermsAgreementPrefix')}
                                            {/* <Link href="#" onClick={(e) => e.preventDefault()} className="mx-1 underline text-gray-700">{t('authRegisterTermsOfServices')}</Link>
                                            &
                                            <Link href="#" onClick={(e) => e.preventDefault()} className="ml-1 underline text-gray-700">{t('commonPrivacyPolicy')}</Link> */}
                                        </span>
                                    </label>
                                    {(businessErrors.terms || errors.terms) && (
                                        <p className="text-red-600 text-xs">
                                            {businessErrors.terms || errors.terms}
                                        </p>
                                    )}

                                    <div className="pt-1">
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide shadow-[0_12px_30px_rgba(48,111,255,0.25)] hover:shadow-lg transition-shadow disabled:opacity-60"
                                        >
                                            {t('commonContinue')}
                                        </button>
                                    </div>
                                </form>

                                <div className="mt-auto pt-8 text-center text-md text-gray-500">
                                    <div className='mb-4'>
                                        {t('authRegisterRegisteredAs')}
                                        <Link href="#" onClick={(e) => { e.preventDefault(); setIsBusiness(false); }} className="ml-1 underline font-semibold text-blue-500 hover:text-[#2154ff]">
                                            {t('authRegisterIndividualQuestion')}
                                        </Link>
                                    </div>
                                    {t('authRegisterAlreadyHaveAccount')}
                                    <Link href="/login" className="ml-1 font-semibold underline text-blue-500 hover:text-[#2154ff]">{t('authLogin')}</Link>
                                </div>
                            </>
                        ) : (
                            // Step 2: Additional Details
                            <>
                                <div className="mt-1">
                                    <h1 className="text-3xl leading-8 font-semibold text-gray-900">{t('authAdditionalDetails')}</h1>
                                    <p className="mt-3 text-sm leading-6 text-gray-500 max-w-[320px]">
                                        {t('authRegisterAdditionalDetailsSubtitle')}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="mt-7 space-y-5 overflow-visible">
                                    {/* Country */}
                                    <div className="space-y-1" ref={countryRef}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowCountryMenu(!showCountryMenu);
                                            }}
                                            className={`w-full appearance-none rounded-full border border-gray-200 bg-white px-5 py-3 pr-12 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 ${data.country ? 'text-gray-700' : 'text-gray-400'} relative`}
                                        >
                                            {data.country || t('authRegisterSelectCountry')}
                                            <svg
                                                className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                        {showCountryMenu && (
                                            <Menu
                                                items={countries}
                                                onItemClick={handleCountrySelect}
                                                anchorRef={countryRef}
                                            />
                                        )}
                                        {(additionalErrors.country || errors.country) && (
                                            <p className="text-red-600 text-xs">
                                                {additionalErrors.country || errors.country}
                                            </p>
                                        )}
                                    </div>

                                    {/* City */}
                                    <div className="space-y-1" ref={cityRef}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (citiesLoading) return;
                                                setShowCityMenu(!showCityMenu);
                                            }}
                                            className={`w-full appearance-none rounded-full border border-gray-200 bg-white px-5 py-3 pr-12 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 ${data.city ? 'text-gray-700' : 'text-gray-400'} relative`}
                                        >
                                            {cityButtonLabel}
                                            <svg
                                                className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                        {showCityMenu && (
                                            <Menu
                                                items={cities}
                                                onItemClick={(item) => {
                                                    clearLocalError('city');
                                                    setData('city', item.value);
                                                    setShowCityMenu(false);
                                                }}
                                                anchorRef={cityRef}
                                            />
                                        )}
                                        {(additionalErrors.city || errors.city) && (
                                            <p className="text-red-600 text-xs">
                                                {additionalErrors.city || errors.city}
                                            </p>
                                        )}
                                    </div>

                                    {/* Full Address */}
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={data.address}
                                                onChange={(e) => {
                                                    clearLocalError('address');
                                                    setData('address', sanitizeTextInput(e.target.value));
                                                }}
                                                placeholder={t('authRegisterFullAddressPlaceholder')}
                                                className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                            />
                                            <span className="pointer-events-none w-5 absolute right-5 top-1/2 -translate-y-1/2 text-[#338DFF]">
                                                <img src="/assets/images/map-pin.png" alt={t('addressesMapIconAlt')} />
                                            </span>
                                        </div>
                                        {(additionalErrors.address || errors.address) && (
                                            <p className="text-red-600 text-xs">
                                                {additionalErrors.address || errors.address}
                                            </p>
                                        )}
                                    </div>

                                    {/* Trade License Number */}
                                    <div className="space-y-1">
                                        <input
                                            type="text"
                                            value={data.trade_license_number}
                                            onChange={(e) => {
                                                clearLocalError('trade_license_number');
                                                setData('trade_license_number', sanitizeTextInput(e.target.value));
                                            }}
                                            placeholder={t('authRegisterTradeLicensePlaceholder')}
                                            className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                        />
                                        {(additionalErrors.trade_license_number || errors.trade_license_number) && (
                                            <p className="text-red-600 text-xs">
                                                {additionalErrors.trade_license_number || errors.trade_license_number}
                                            </p>
                                        )}
                                    </div>

                                    {/* License Upload */}
                                    <div className="space-y-2">
                                        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-gray-200 bg-white px-4 py-4 text-center text-sm text-gray-500 transition hover:border-[#338DFF]/70">
                                            <input
                                                type="file"
                                                accept=".png,.jpg,.jpeg,.pdf"
                                                className="hidden"
                                                onChange={(e) => {
                                                    clearLocalError('license_copy');
                                                    setData('license_copy', e.target.files?.[0] ?? null);
                                                }}
                                            />
                                            <div className="rounded-full bg-[#E8F1FF] p-3 text-[#338DFF]">
                                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 16a1 1 0 01-1-1V8.414L9.707 9.707a1 1 0 01-1.414-1.414l3-3a1.002 1.002 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 8.414V15a1 1 0 01-1 1z" />
                                                    <path d="M6 18a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 112 0v3a4 4 0 01-4 4H8a4 4 0 01-4-4v-3a1 1 0 112 0v3z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-700">
                                                    {licenseFileName || t('authRegisterUploadLicenseCopy')}
                                                </p>
                                                <p className="mt-1 text-xs text-gray-400">
                                                    {t('authRegisterUploadHint')}
                                                </p>
                                            </div>
                                        </label>
                                        {(additionalErrors.license_copy || errors.license_copy) && (
                                            <p className="text-red-600 text-xs text-center">
                                                {additionalErrors.license_copy || errors.license_copy}
                                            </p>
                                        )}
                                    </div>

                                    {/* Terms */}
                                    <label className="flex items-start gap-3 text-sm text-gray-500 leading-relaxed cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="mt-[2px] h-4 w-4 rounded border-gray-300"
                                            checked={data.terms}
                                            onChange={(e) => {
                                                clearLocalError('terms');
                                                setData('terms', e.target.checked);
                                            }}
                                        />
                                        <span>
                                            {t('authRegisterTermsAgreementPrefix')}
                                            {/* <Link href="#" onClick={(e) => e.preventDefault()} className="mx-1 underline text-gray-700">{t('authRegisterTermsOfServices')}</Link>
                                            &
                                            <Link href="#" onClick={(e) => e.preventDefault()} className="ml-1 underline text-gray-700">{t('commonPrivacyPolicy')}</Link> */}
                                        </span>
                                    </label>
                                    {(additionalErrors.terms || errors.terms) && (
                                        <p className="text-red-600 text-xs">
                                            {additionalErrors.terms || errors.terms}
                                        </p>
                                    )}

                                    <div className="pt-1">
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide shadow-[0_12px_30px_rgba(48,111,255,0.25)] hover:shadow-lg transition-shadow disabled:opacity-60"
                                        >
                                            {t('authLoginRegister')}
                                        </button>
                                    </div>
                                </form>

                                {/* <div className="mt-auto pt-5 text-center text-sm text-gray-500">
                                    <div className="mb-2">
                                        <button
                                            onClick={() => setShowSecondStep(false)}
                                            className="font-semibold text-blue-500 hover:text-[#2154ff] bg-transparent border-none cursor-pointer"
                                        >
                                            Back
                                        </button>
                                    </div>
                                    Already have an account?
                                    <Link href="/login" className="ml-1 font-semibold text-blue-500 hover:text-[#2154ff]">{t('authLogin')}</Link>
                                </div> */}
                            </>
                        )}
                    </section>
                ) : (
                    // Mobile: Individual Registration Form
                    <section className="md:hidden w-full min-h-screen bg-white px-3 pt-8 flex flex-col ">
                                <div className="mt-1">
                                    <h1 className="text-3xl leading-8 font-semibold text-gray-900">{t('authRegisterGetStartedTitle')}</h1>
                                    <p className="mt-3 text-sm leading-6 text-gray-500 max-w-[320px]">
                                        {t('authRegisterGetStartedSubtitle')}
                                    </p>
                                </div>

                        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                            {/* Full name (maps to first+last) */}
                            <input
                                type="text"
                                placeholder={t('commonFullName')}
                                value={`${data.first_name}${data.last_name ? ' ' + data.last_name : ''}`}
                                onChange={(e) => {
                                    const sanitizedInput = sanitizeTextInput(e.target.value);
                                    const trimmed = sanitizedInput.trim();
                                    const parts = trimmed.split(/\s+/);
                                    const last = parts.length > 1 ? parts.pop() : '';
                                    const first = parts.join(' ');
                                    setData('first_name', first);
                                    setData('last_name', last);
                                }}
                                className="w-full rounded-full border border-gray-200 px-5 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                            />
                            {(errors.first_name || errors.last_name) && (
                                <p className="text-red-600 text-xs -mt-3">{errors.first_name || errors.last_name}</p>
                            )}

                            {/* Email */}
                            <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                placeholder={t('commonEnterEmailAddress')}
                                value={data.email}
                                onChange={(e) => setData('email', sanitizeEmailInput(e.target.value))}
                                onBeforeInput={(event) => {
                                    const d = event.data ?? '';
                                    if (/[^a-zA-Z0-9._%+\-@]/.test(d)) {
                                        event.preventDefault();
                                    }
                                }}
                                onPaste={(event) => {
                                    const pasted = (event.clipboardData || window.clipboardData).getData('text');
                                    const sanitized = sanitizeEmailInput(pasted);
                                    if (sanitized !== pasted) {
                                        event.preventDefault();
                                        const target = event.target;
                                        const start = target.selectionStart || 0;
                                        const end = target.selectionEnd || 0;
                                        const next = (target.value || '').slice(0, start) + sanitized + (target.value || '').slice(end);
                                        setData('email', next);
                                    }
                                }}
                                className="w-full rounded-full border border-gray-200 px-5 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                            />
                            {errors.email && (
                                <div className="text-red-600 text-xs -mt-3">{errors.email}</div>
                            )}

                            {/* Phone input with country code */}
                            <div className="rounded-full border border-gray-200 h-[48px] focus-within:ring-2 focus-within:ring-[#4c7bff]/70">
                                <input
                                    ref={phoneInputMobileRef}
                                    type="tel"
                                    inputMode="tel"
                                    placeholder={t('authRegisterPhonePlaceholder')}
                                    className="w-full h-full rounded-full px-5 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none"
                                    autoComplete="tel"
                                />
                            </div>
                            {(errors.phone_number || errors.phone_code) && (
                                <div className="text-red-500 text-sm -mt-3">
                                    {errors.phone_number || errors.phone_code}
                                </div>
                            )}

                            {/* Password */}
                            <div className="relative h-[48px]">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={t('commonPassword')}
                                    value={data.password}
                                    onChange={(e) => setData('password', sanitizeTextInput(e.target.value))}
                                    className="w-full h-full rounded-full border border-gray-200 px-5 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-gray-600"
                                    aria-label={showPassword ? t('authRegisterHidePassword') : t('authRegisterShowPassword')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </div>
                            {errors.password && <p className="text-red-600 text-xs -mt-3">{errors.password}</p>}

                            {/* Confirm Password */}
                            <div className="relative h-[48px]">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder={t('commonConfirmPassword')}
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', sanitizeTextInput(e.target.value))}
                                    className="w-full h-full rounded-full border border-gray-200 px-5 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(v => !v)}
                                    className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-gray-600"
                                    aria-label={showConfirm ? t('authRegisterHidePassword') : t('authRegisterShowPassword')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </div>
                            {errors.password_confirmation && <p className="text-red-600 text-xs -mt-3">{errors.password_confirmation}</p>}

                            {/* Terms */}
                            <label className="flex items-start gap-3 text-sm text-gray-500 leading-relaxed cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="mt-[2px] h-4 w-4 rounded border-gray-300"
                                    checked={data.terms}
                                    onChange={(e) => {
                                        clearLocalError('terms');
                                        setData('terms', e.target.checked);
                                    }}
                                />
                                <span>
                                    {t('authRegisterTermsAgreementPrefix')}
                                    {/* <Link href="#" onClick={(e) => e.preventDefault()} className="mx-1 underline text-gray-700">{t('authRegisterTermsOfServices')}</Link>
                                    &
                                    <Link href="#" onClick={(e) => e.preventDefault()} className="ml-1 underline text-gray-700">{t('commonPrivacyPolicy')}</Link> */}
                                </span>
                            </label>
                            {(businessErrors.terms || errors.terms) && (
                                <p className="text-red-600 text-xs">
                                    {businessErrors.terms || errors.terms}
                                </p>
                            )}

                            <div className="pt-1">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide shadow-[0_12px_30px_rgba(48,111,255,0.25)] hover:shadow-lg transition-shadow disabled:opacity-60"
                                >
                                    {t('commonContinue')}
                                </button>
                            </div>
                        </form>

                        <div className="mt-auto mb-5 text-center text-md text-gray-500 pt-8">

                            <div className='mb-5'>
                                {t('authRegisterRegisteredAs')}
                                {isBusiness ? (
                                    <Link href="#" onClick={(e) => { e.preventDefault(); setIsBusiness(false); }} className="ml-1 font-semibold text-blue-500 underline hover:text-[#2154ff]">
                                        {t('authRegisterIndividualQuestion')}
                                    </Link>
                                ) : (
                                    <Link href="#" onClick={(e) => { e.preventDefault(); setIsBusiness(true); }} className="ml-1 font-semibold text-blue-500 underline hover:text-[#2154ff]">
                                        {t('authRegisterBusinessQuestion')}
                                    </Link>
                                )}
                            </div>
                            {t('authRegisterAlreadyHaveAccount')}
                            <Link href="/login" className="ml-1 font-semibold text-blue-500 underline hover:text-[#2154ff]">{t('authLogin')}</Link>
                        </div>
                    </section>
                )}
                </div>
            </div>

            {/* Desktop: Sign Up form */}
            <div className="hidden md:block">
            {isBusiness ? (
                <AuthShell
                        hideRightSectionOnMobile={true}
                        rightContent={
                            <>
                                {!showSecondStep ? (
                                    <>
                                        <div className="flex flex-col items-center text-center gap-1 -mt-10">
                                            <div className="flex justify-center mb-2">
                                                <img src="/assets/images/Logo.svg" alt={t('commonLogoAlt')} />
                                            </div>
                                            <h2 className="text-3xl font-semibold text-gray-900">{t('authRegisterBusinessDetailsTitle')}</h2>
                                            <p className="mt-3 text-xl font-normal leading-relaxed text-gray-500 md:max-w-[70%] mx-auto">
                                                {t('authRegisterBusinessDetailsSubtitle')}
                                            </p>
                                        </div>

                                        <form onSubmit={handleBusinessContinue} className="mt-6 px-12 space-y-5">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <input
                                                        type="text"
                                                        placeholder={t('authRegisterBusinessNamePlaceholder')}
                                                        value={data.first_name}
                                                        onChange={(e) => {
                                                            clearLocalError('first_name');
                                                            setData('first_name', sanitizeTextInput(e.target.value));
                                                        }}
                                                        className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 bg-white"
                                                    />
                                                    {(businessErrors.first_name || errors.first_name) && (
                                                        <p className="text-red-600 text-xs">
                                                            {businessErrors.first_name || errors.first_name}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-1" ref={businessTypeRef}>
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowBusinessTypeMenu((prev) => !prev);
                                                            }}
                                                            className={`w-full appearance-none rounded-full border border-gray-200 bg-white px-6 py-3 pr-12 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 ${data.business_type ? 'text-gray-700' : 'text-gray-400'}`}
                                                        >
                                                            {data.business_type || t('authRegisterBusinessTypePlaceholder')}
                                                        </button>
                                                        <span className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-gray-400">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                                            </svg>
                                                        </span>
                                                        {showBusinessTypeMenu && (
                                                            <div className="absolute z-50 w-full">
                                                                <Menu
                                                                    items={businessTypes}
                                                                    onItemClick={(item) => {
                                                                        clearLocalError('business_type');
                                                                        setData('business_type', item.value);
                                                                        setShowBusinessTypeMenu(false);
                                                                    }}
                                                                    anchorRef={businessTypeRef}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {(businessErrors.business_type || errors.business_type) && (
                                                        <p className="text-red-600 text-xs">
                                                            {businessErrors.business_type || errors.business_type}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <input
                                                        type="email"
                                                        inputMode="email"
                                                        autoComplete="email"
                                                        placeholder={t('authRegisterBusinessEmailPlaceholder')}
                                                        value={data.email}
                                                        onChange={(e) => {
                                                            clearLocalError('email');
                                                            setData('email', sanitizeEmailInput(e.target.value));
                                                        }}
                                                        onBeforeInput={(event) => {
                                                            const d = event.data ?? '';
                                                            if (/[^a-zA-Z0-9._%+\-@]/.test(d)) {
                                                                event.preventDefault();
                                                            }
                                                        }}
                                                        onPaste={(event) => {
                                                            const pasted = (event.clipboardData || window.clipboardData).getData('text');
                                                            const sanitized = sanitizeEmailInput(pasted);
                                                            if (sanitized !== pasted) {
                                                                event.preventDefault();
                                                                const target = event.target;
                                                                const start = target.selectionStart || 0;
                                                                const end = target.selectionEnd || 0;
                                                                const next = (target.value || '').slice(0, start) + sanitized + (target.value || '').slice(end);
                                                                setData('email', next);
                                                            }
                                                        }}
                                                        className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 bg-white"
                                                    />
                                                    {(businessErrors.email || errors.email) && (
                                                        <p className="text-red-600 text-xs">
                                                            {businessErrors.email || errors.email}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="rounded-full border border-gray-200 focus-within:ring-2 focus-within:ring-[#4c7bff]/70">
                                                        <input
                                                            ref={phoneInputBusinessDesktopRef}
                                                            type="tel"
                                                            inputMode="tel"
                                                            placeholder={t('authRegisterPhonePlaceholder')}
                                                            className="w-full px-5 py-3 text-sm text-gray-700 placeholder-gray-400 rounded-full focus:outline-none"
                                                            autoComplete="tel"
                                                        />
                                                    </div>
                                                    {(businessErrors.phone_number ||
                                                        businessErrors.phone_code ||
                                                        errors.phone_number ||
                                                        errors.phone_code) && (
                                                        <p className="text-red-600 text-xs">
                                                            {businessErrors.phone_number ||
                                                                businessErrors.phone_code ||
                                                                errors.phone_number ||
                                                                errors.phone_code}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                                                <div className="space-y-1">
                                                    <div className="relative">
                                                        <input
                                                            type={showPassword ? 'text' : 'password'}
                                                            placeholder={t('commonPassword')}
                                                            value={data.password}
                                                            onChange={(e) => {
                                                                clearLocalError('password');
                                                                const sanitizedPassword = sanitizeTextInput(e.target.value);
                                                                setData('password', sanitizedPassword);
                                                            }}
                                                            className="w-full rounded-full border border-gray-200 px-6 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 bg-white"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(v => !v)}
                                                            className="absolute inset-y-0 right-3 flex items-center justify-center px-2 text-gray-400 hover:text-gray-600"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                                                {showPassword ? (
                                                                    <>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                                                                    </>
                                                                )}
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    {(businessErrors.password || errors.password) && (
                                                        <p className="text-red-600 text-xs">
                                                            {businessErrors.password || errors.password}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="relative">
                                                        <input
                                                            type={showConfirm ? 'text' : 'password'}
                                                            placeholder={t('authRegisterRetypePasswordPlaceholder')}
                                                            value={data.password_confirmation}
                                                            onChange={(e) => {
                                                                clearLocalError('password_confirmation');
                                                                const sanitizedConfirmation = sanitizeTextInput(e.target.value);
                                                                setData('password_confirmation', sanitizedConfirmation);
                                                            }}
                                                            className="w-full rounded-full border border-gray-200 px-6 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 bg-white"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowConfirm(v => !v)}
                                                            className="absolute inset-y-0 right-3 flex items-center justify-center px-2 text-gray-400 hover:text-gray-600"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                                                {showConfirm ? (
                                                                    <>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                                                                    </>
                                                                )}
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    {(businessErrors.password_confirmation || errors.password_confirmation) && (
                                                        <p className="text-red-600 text-xs">
                                                            {businessErrors.password_confirmation || errors.password_confirmation}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <label className="flex items-start gap-3 text-xs sm:text-sm text-gray-500 leading-relaxed cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 sm:mt-[6px] h-4 w-4 rounded border-gray-300 focus:ring-[#4c7bff]/70"
                                                    checked={data.terms}
                                                    onChange={e => setData('terms', e.target.checked)}
                                                />
                                                <span>
                                                    {t('authRegisterTermsAgreementPrefix')}
                                                    {/* <span className="mx-1 text-[#3a70ff] font-medium hover:text-[#2154ff]">{t('authRegisterTermsOfUse')}</span>
                                                    &
                                                    <span className="ml-1 text-[#3a70ff] font-medium hover:text-[#2154ff]">{t('commonPrivacyPolicy')}</span>. */}
                                                </span>
                                            </label>
                                            {errors.terms && <p className="text-red-600 text-xs">{errors.terms}</p>}

                                            <div>
                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className="w-full font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center cursor-pointer shadow-[0_14px_34px_rgba(48,111,255,0.25)] active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed py-3 px-10 text-sm font-semibold mt-5"
                                                >
                                                    {t('commonContinue')}
                                                </button>
                                            </div>
                                        </form>

                                        <div className="mt-8 flex flex-col sm:flex-row justify-between text-sm text-gray-500 gap-3 text-center sm:text-left">
                                            <div>
                                                {t('authRegisterAlreadyRegistered')}
                                                <Link href="/login" className="ml-1 font-semibold text-[#3a70ff] hover:text-[#2154ff]">{t('authLogin')}</Link>
                                            </div>
                                            <div>
                                                {t('authRegisterRegisteredAs')}
                                                <Link href="#" onClick={handleModeToggle('individual')} className="ml-1 font-semibold text-[#3a70ff] hover:text-[#2154ff]">{t('authRegisterIndividualQuestion')}</Link>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex flex-col items-center text-center gap-2 ">
                                            <div className="flex justify-center mb-2">
                                                <img src="/assets/images/Logo.svg" alt="Logo" />
                                            </div>
                                            <h2 className="text-3xl font-semibold text-gray-900">{t('authAdditionalDetails')}</h2>
                                            <p className="mt-3 text-xl font-normal leading-relaxed text-gray-500 md:max-w-[70%] mx-auto">
                                                We can help verify your business registration in Syria!
                                                <span className="block">{t('authRegisterPleaseProvideMoreDetails')}</span>
                                            </p>
                                        </div>

                                        <form onSubmit={handleSubmit} className="mt-12 px-12 space-y-5">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1" ref={countryRef}>
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowCountryMenu(!showCountryMenu);
                                                            }}
                                                            className="w-full appearance-none rounded-full border border-gray-200 bg-white px-6 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 text-left"
                                                        >
                                                            {data.country || t('authRegisterSelectCountry')}
                                                        </button>
                                                        <svg
                                                            className="pointer-events-none absolute right-6 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                                            viewBox="0 0 20 20"
                                                            fill="currentColor"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                        {showCountryMenu && (
                                                            <div className="absolute z-50 w-full">
                                                                <Menu
                                                                    items={countries}
                                                                    onItemClick={handleCountrySelect}
                                                                    anchorRef={countryRef}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {(additionalErrors.country || errors.country) && (
                                                        <p className="text-red-600 text-xs">
                                                            {additionalErrors.country || errors.country}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-1" ref={cityRef}>
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (citiesLoading) return;
                                                                setShowCityMenu(!showCityMenu);
                                                            }}
                                                        className="w-full appearance-none rounded-full border border-gray-200 bg-white px-6 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 text-left"
                                                    >
                                                            {cityButtonLabel}
                                                        </button>
                                                        <svg
                                                            className="pointer-events-none absolute right-6 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                                            viewBox="0 0 20 20"
                                                            fill="currentColor"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                        {showCityMenu && (
                                                            <div className="absolute z-50 w-full">
                                                                <Menu
                                                                    items={cities}
                                                                    onItemClick={(item) => {
                                                                        clearLocalError('city');
                                                                        setData('city', item.value);
                                                                        setShowCityMenu(false);
                                                                    }}
                                                                    anchorRef={cityRef}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {(additionalErrors.city || errors.city) && (
                                                        <p className="text-red-600 text-xs">
                                                            {additionalErrors.city || errors.city}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={data.address}
                                                        onChange={(e) => {
                                                            clearLocalError('address');
                                                            setData('address', sanitizeTextInput(e.target.value));
                                                        }}
                                                        placeholder={t('authRegisterFullAddressPlaceholder')}
                                                        className="w-full rounded-full border border-gray-200 bg-white px-6 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                                    />
                                                    <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[#338DFF]">
                                                        <svg
                                                            className="h-5 w-5 transform -scale-y-100"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.6"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            d="M12 21c-3.866 0-7-2.91-7-6.5C5 10.46 8.276 5 12 3c3.724 2 7 7.46 7 11.5 0 3.59-3.134 6.5-7 6.5z"
                                                        />
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M12 13.5a2 2 0 100-4 2 2 0 000 4z"
                                                        />
                                                    </svg>
                                                </span>

                                                </div>
                                                {(additionalErrors.address || errors.address) && (
                                                    <p className="text-red-600 text-xs">
                                                        {additionalErrors.address || errors.address}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                    <input
                                                        type="text"
                                                        value={data.trade_license_number}
                                                        onChange={(e) => {
                                                            clearLocalError('trade_license_number');
                                                            setData('trade_license_number', sanitizeTextInput(e.target.value));
                                                        }}
                                                        placeholder={t('authRegisterTradeLicensePlaceholder')}
                                                        className="w-full rounded-full border border-gray-200 bg-white px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                                    />
                                                {(additionalErrors.trade_license_number || errors.trade_license_number) && (
                                                    <p className="text-red-600 text-xs">
                                                        {additionalErrors.trade_license_number || errors.trade_license_number}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-gray-200 bg-white px-4 py-4 text-center text-sm text-gray-500 transition hover:border-[#338DFF]/70">
                                                    <input
                                                        type="file"
                                                        accept=".png,.jpg,.jpeg,.pdf"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            clearLocalError('license_copy');
                                                            setData('license_copy', e.target.files?.[0] ?? null);
                                                        }}
                                                    />
                                                    <div className="rounded-full bg-[#E8F1FF] p-3 text-[#338DFF]">
                                                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 16a1 1 0 01-1-1V8.414L9.707 9.707a1 1 0 01-1.414-1.414l3-3a1.002 1.002 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 8.414V15a1 1 0 01-1 1z" />
                                                            <path d="M6 18a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 112 0v3a4 4 0 01-4 4H8a4 4 0 01-4-4v-3a1 1 0 112 0v3z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-700">
                                                            {licenseFileName || t('authRegisterUploadLicenseCopy')}
                                                        </p>
                                                        <p className="mt-1 text-xs text-gray-400">
                                                            {t('authRegisterUploadHint')}
                                                        </p>
                                                    </div>
                                                </label>
                                                {(additionalErrors.license_copy || errors.license_copy) && (
                                                    <p className="text-red-600 text-xs text-center">
                                                        {additionalErrors.license_copy || errors.license_copy}
                                                    </p>
                                                )}
                                            </div>

                                            <label className="flex cursor-pointer select-none items-start gap-3 text-sm text-gray-500 leading-relaxed">
                                                <input
                                                    type="checkbox"
                                                    checked={data.terms}
                                                    onChange={(e) => {
                                                        clearLocalError('terms');
                                                        setData('terms', e.target.checked);
                                                    }}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#338DFF] focus:ring-[#338DFF]"
                                                />
                                                <span>
                                                    {t('authRegisterTermsAgreementPrefix')}{' '}
                                                    {/* <span className="text-[#338DFF] hover:underline">
                                                        {t('authRegisterTermsOfUse')}
                                                    </span>{' '}
                                                    &amp;{' '}
                                                    <span className="text-[#338DFF] hover:underline">
                                                        {t('commonPrivacyPolicy')}
                                                    </span>
                                                    . */}
                                                </span>
                                            </label>
                                            {(additionalErrors.terms || errors.terms) && (
                                                <p className="text-red-600 text-xs">
                                                    {additionalErrors.terms || errors.terms}
                                                </p>
                                            )}

                                            <div>
                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className="w-full font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center cursor-pointer shadow-[0_14px_34px_rgba(48,111,255,0.25)] active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed py-3 px-10 text-sm font-semibold mt-5"
                                                >
                                                    {t('authLoginRegister')}
                                                </button>
                                            </div>
                                        </form>

                                        <div className="mt-8 flex flex-col sm:flex-row justify-between text-sm text-gray-500 gap-3 text-center sm:text-left">
                                            <div>
                                                {t('authRegisterAlreadyRegistered')}
                                                <Link href="/login" className="ml-1 font-semibold text-[#3a70ff] hover:text-[#2154ff]">{t('authLogin')}</Link>
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => setShowSecondStep(false)}
                                                    className="ml-1 font-semibold text-[#3a70ff] hover:text-[#2154ff] bg-transparent border-none cursor-pointer"
                                                >
                                                    {t('commonBack')}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        }
                    />
                ) : (
                    <AuthShell
                        hideRightSectionOnMobile={true}
                        rightContent={
                            <>
                                <div className="flex justify-center mb-2 -mt-10">
                                    <img src="/assets/images/Logo.svg" alt={t('commonLogoAlt')} />
                                </div>

                                <div className="text-center">
                                    <h1 className="text-3xl font-semibold text-gray-900">{t('authRegisterGetStartedTitle')}</h1>
                                    <p className="mt-2 text-xl font-normal leading-relaxed text-gray-500 md:max-w-[70%] mx-auto">
                                        {t('authRegisterGetStartedSubtitle')}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="mt-8 px-12 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        placeholder={t('authRegisterFirstNamePlaceholder')}
                                        value={data.first_name}
                                        onChange={e => setData('first_name', sanitizeTextInput(e.target.value))}
                                        className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                    />
                                    {errors.first_name && <p className="text-red-600 text-xs">{errors.first_name}</p>}
                                </div>
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        placeholder={t('authRegisterLastNamePlaceholder')}
                                        value={data.last_name}
                                        onChange={e => setData('last_name', sanitizeTextInput(e.target.value))}
                                        className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                    />
                                    {errors.last_name && <p className="text-red-600 text-xs">{errors.last_name}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <input
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        placeholder={t('commonEnterEmailAddress')}
                                        value={data.email}
                                        onChange={e => setData('email', sanitizeEmailInput(e.target.value))}
                                        onBeforeInput={(event) => {
                                            const d = event.data ?? '';
                                            if (/[^a-zA-Z0-9._%+\-@]/.test(d)) {
                                                event.preventDefault();
                                            }
                                        }}
                                        onPaste={(event) => {
                                            const pasted = (event.clipboardData || window.clipboardData).getData('text');
                                            const sanitized = sanitizeEmailInput(pasted);
                                            if (sanitized !== pasted) {
                                                event.preventDefault();
                                                const target = event.target;
                                                const start = target.selectionStart || 0;
                                                const end = target.selectionEnd || 0;
                                                const next = (target.value || '').slice(0, start) + sanitized + (target.value || '').slice(end);
                                                setData('email', next);
                                            }
                                        }}
                                        className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                                    />
                                    {errors.email && <p className="text-red-600 text-xs">{errors.email}</p>}
                                </div>
                                <div className="space-y-1">
                                    <div className="rounded-full border border-gray-200 focus-within:ring-2 focus-within:ring-[#4c7bff]/70">
                                        <input
                                            ref={phoneInputIndividualRef}
                                            type="tel"
                                            inputMode="tel"
                                            placeholder={t('authRegisterPhonePlaceholder')}
                                            className="w-full px-6 py-3 text-sm text-gray-700 placeholder-gray-400 rounded-full focus:outline-none"
                                            autoComplete="tel"
                                        />
                                    </div>
                                    {(errors.phone_number || errors.phone_code) && (
                                        <p className="text-red-600 text-xs">{errors.phone_number || errors.phone_code}</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-1">
                            {/* Password */}
                            <div className="space-y-1">
                                <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={t('commonPassword')}
                                    value={data.password}
                                    onChange={e => setData('password', sanitizeTextInput(e.target.value))}
                                    className="w-full rounded-full border border-gray-200 px-6 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute inset-y-0 right-3 flex items-center justify-center px-2 text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                        {showPassword ? (
                                            <>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </>
                                        ) : (
                                            <>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                                            </>
                                        )}
                                    </svg>
                                </button>
                                </div>
                                {/* reserve space so both columns stay aligned */}
                                <p className={`text-xs ${errors.password ? 'text-red-600' : 'invisible'}`}>
                                {errors.password || ' '}
                                </p>
                            </div>

                            {/* Password confirmation */}
                            <div className="space-y-1 pt-2">
                                <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder={t('authRegisterRetypePasswordPlaceholder')}
                                    value={data.password_confirmation}
                                    onChange={e => setData('password_confirmation', sanitizeTextInput(e.target.value))}
                                    className="w-full rounded-full border border-gray-200 px-6 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(v => !v)}
                                    className="absolute inset-y-0 right-3 flex items-center justify-center px-2 text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                        {showConfirm ? (
                                            <>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </>
                                        ) : (
                                            <>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                                            </>
                                        )}
                                    </svg>
                                </button>
                                </div>
                                {/* same reserved space */}
                                <p className={`text-xs ${errors.password_confirmation ? 'text-red-600' : 'invisible'}`}>
                                {errors.password_confirmation || ' '}
                                </p>
                            </div>
                            </div>

                            <label className="flex items-start gap-3 text-xs sm:text-sm text-gray-500 leading-relaxed cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="mt-1 sm:mt-[6px] h-4 w-4 rounded border-gray-300 focus:ring-[#4c7bff]/70"
                                    checked={data.terms}
                                    onChange={e => setData('terms', e.target.checked)}
                                />
                                <span>
                                    {t('authRegisterTermsAgreementPrefix')}
                                    {/* <span className="mx-1 text-[#3a70ff] font-medium hover:text-[#2154ff]">{t('authRegisterTermsOfUse')}</span>
                                    &
                                    <span className="ml-1 text-[#3a70ff] font-medium hover:text-[#2154ff]">{t('commonPrivacyPolicy')}</span>. */}
                                </span>
                            </label>
                            {errors.terms && <p className="text-red-600 text-xs">{errors.terms}</p>}

                            <div>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center cursor-pointer shadow-[0_14px_34px_rgba(48,111,255,0.25)] active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed py-3 px-10 text-sm font-semibold mt-5"
                                >
                                    {t('authLoginRegister')}
                                </button>
                            </div>
                        </form>

                        <div className="mt-8 flex flex-col sm:flex-row justify-between text-md text-gray-500 gap-3 text-center sm:text-left">
                            <div>
                                {t('authRegisterAlreadyRegistered')}
                                <Link href="/login" className="ml-1 underline font-semibold text-blue-500 hover:text-[#2154ff]">{t('authLogin')}</Link>
                            </div>
                            <div>
                                {t('authRegisterRegisteredAs')}
                                <Link href="#" onClick={handleModeToggle('business')} className="ml-1 underline font-semibold text-blue-500 hover:text-[#2154ff]">{t('authRegisterBusinessQuestion')}</Link>
                            </div>
                        </div>
                            </>
                        }
                    />
                )}
            </div>
        </>
    );
}
