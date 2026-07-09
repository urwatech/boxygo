import React, { useEffect, useRef, useState } from "react";
import { Link, router, useForm } from "@inertiajs/react";
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../Contexts/LanguageContext';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';
import FaqContent from '../../Components/Customer/FaqContent';
import Menu from "../../Components/Common/Menu";
import Popup from "../SuperAdmin/Components/Popup";
import Input from '../../Components/Common/Inputs/Input';
import NotificationDropdown from "../../Components/Customer/NotificationDropdown";
import TermsAndConditions from "./TermsAndConditions";
import {
    clearCustomerPushNotificationTokenForLogout,
    disableCustomerPushNotifications,
    enableCustomerPushNotifications,
} from '../../pushNotifications';
import MobileHeader from "../../Components/Customer/MobileHeader";

const PHONE_PREFIX = '+963';
const PHONE_PREFIX_DIGITS = '963';
const extractSubscriberDigits = (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    const withoutPrefix = digits.startsWith(PHONE_PREFIX_DIGITS)
        ? digits.slice(PHONE_PREFIX_DIGITS.length)
        : digits;
    return withoutPrefix.slice(0, 9);
};

const formatPhoneForMask = (value) => {
    const subscriber = extractSubscriberDigits(value);
    if (!subscriber) return `${PHONE_PREFIX} `;
    return `${PHONE_PREFIX} ${subscriber}`;
};


const FALLBACK_AVATAR = "/assets/images/user.jpg";

const FIELD_LABEL_TRANSLATION_KEYS = {
    name: 'settingsProfileYourName',
    email: 'shipmentsEmail',
    phone_number: 'settingsProfilePhoneNumber',
    address: 'settingsProfileAddress',
    governorate: 'settingsProfileCity',
    city: 'settingsProfileCity',
    dob: 'settingsProfileDateOfBirth',
    gender: 'settingsProfileGender',
    avatar: 'settingsProfileUploadPhoto',
    current_password: 'settingsSecurityCurrentPassword',
    password: 'settingsSecurityNewPassword',
    password_confirmation: 'settingsSecurityConfirmPassword',
    email_notifications: 'settingsNotificationEmailNotification',
    push_notifications: 'settingsNotificationPushNotification',
    language: 'settingsLanguageLanguage',
    timezone: 'settingsLanguageTimezone',
};

const normalizeFieldKey = (value = '') => {
    if (value === null || value === undefined) {
        return '';
    }
    return value.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
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

const InlineSpinner = ({ className = 'h-4 w-4' }) => (
    <span
        aria-hidden="true"
        className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`}
    />
);

const NotificationPreferenceLoadingOverlay = ({ label }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#2d3d5c]/90 px-4 py-6 backdrop-blur-sm" role="status" aria-live="polite" aria-busy="true">
        {/* <div className="flex w-full max-w-[320px] flex-col items-center gap-5 rounded-2xl bg-white px-8 py-8 text-center shadow-[0_20px_40px_rgba(15,23,42,0.2)] sm:max-w-[360px]"> */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#338DFF]/10 text-[#338DFF]">
                <InlineSpinner className="h-9 w-9" />
            </div>
        {/* </div> */}
    </div>
);

export default function Settings({
    profile = {},
    notification = {},
    language = 'en',
    cities = [],
    deleteAccountEnabled = false,
    termsContent = null,
}) {
    const { t, i18n } = useTranslation();
    const { currentLanguage, changeLanguage, isRTL } = useLanguage();
    const resolveFieldLabel = (fieldCandidate, fallback = '') => {
        if (!fieldCandidate && !fallback) {
            return '';
        }
        const normalized = normalizeFieldKey(fieldCandidate || fallback);
        if (normalized && FIELD_LABEL_TRANSLATION_KEYS[normalized]) {
            return t(FIELD_LABEL_TRANSLATION_KEYS[normalized]);
        }
        const base = fieldCandidate || fallback;
        if (typeof base === 'string' && base.trim()) {
            const trimmed = base.trim();
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        }
        return '';
    };

    const translateFieldError = (field, message) => {
        if (!message) return '';
        const normalizedMessage = String(message).trim();
        const labelFromField = resolveFieldLabel(field, field);
        const labelFromMatch = (rawField) => resolveFieldLabel(rawField, rawField);

        const requiredMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?is\s+required\.?$/i);
        if (requiredMatch) {
            return t('validationFieldRequired', { field: labelFromMatch(requiredMatch[1]) });
        }

        const takenMatch = normalizedMessage.match(/^The\s+(.+?)\s+has\s+already\s+been\s+taken\.?$/i);
        if (takenMatch) {
            return t('validationFieldTaken', { field: labelFromMatch(takenMatch[1]) });
        }

        const maxCharactersMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?may\s+not\s+be\s+greater\s+than\s+(\d+)\s+characters\.?$/i);
        if (maxCharactersMatch) {
            return t('validationFieldMaxCharacters', {
                field: labelFromMatch(maxCharactersMatch[1]),
                count: maxCharactersMatch[2],
            });
        }

        const minCharactersMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?must\s+be\s+at\s+least\s+(\d+)\s+characters\.?$/i);
        if (minCharactersMatch) {
            return t('validationFieldMinCharacters', {
                field: labelFromMatch(minCharactersMatch[1]),
                count: minCharactersMatch[2],
            });
        }

        const kilobyteMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?may\s+not\s+be\s+greater\s+than\s+(\d+)\s+kilobytes\.?$/i);
        if (kilobyteMatch) {
            return t('validationFieldMaxKilobytes', {
                field: labelFromMatch(kilobyteMatch[1]),
                max: kilobyteMatch[2],
            });
        }

        const stringMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?must\s+be\s+a\s+string\.?$/i);
        if (stringMatch) {
            return t('validationFieldMustBeString', { field: labelFromMatch(stringMatch[1]) });
        }

        const formatMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?format\s+is\s+invalid\.?$/i);
        if (formatMatch) {
            return t('validationFieldInvalidFormat', { field: labelFromMatch(formatMatch[1]) });
        }

        const dateMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?is\s+not\s+a\s+valid\s+date\.?$/i);
        if (dateMatch) {
            return t('validationFieldDate', { field: labelFromMatch(dateMatch[1]) });
        }

        const imageMatch = normalizedMessage.match(/^The\s+(.+?)\s+(?:field\s+)?must\s+be\s+an?\s+image\.?$/i);
        if (imageMatch) {
            return t('validationFieldImage', { field: labelFromMatch(imageMatch[1]) });
        }

        const selectedInvalidMatch = normalizedMessage.match(/^The\s+selected\s+(.+?)\s+is\s+invalid\.?$/i);
        if (selectedInvalidMatch) {
            return t('validationFieldInvalidSelection', { field: labelFromMatch(selectedInvalidMatch[1]) });
        }

        const confirmationMatch = normalizedMessage.match(/^The\s+(.+?)\s+confirmation\s+does\s+not\s+match\.?$/i);
        if (confirmationMatch) {
            return t('validationFieldConfirmationMismatch', { field: labelFromMatch(confirmationMatch[1]) });
        }

        if (/must\s+be\s+a\s+valid\s+email\s+address/i.test(normalizedMessage)) {
            return t('validationEmailInvalid');
        }

        return labelFromField ? `${labelFromField}: ${normalizedMessage}` : normalizedMessage;
    };
    const toggleThumbClass = (active) => {
        if (isRTL) {
            return active ? '-translate-x-0.5' : '-translate-x-5';
        }
        return active ? 'translate-x-5' : 'translate-x-0.5';
    };
    const translatePasswordError = (field, message) => {
        if (!message) return '';
        const normalizedMessage = String(message).toLowerCase();
        const normalizedField = normalizeFieldKey(field);

        const mismatchPattern = /(passwords?\s+do\s+not\s+match|confirmation\s+does\s+not\s+match)/;
        if (mismatchPattern.test(normalizedMessage) || (normalizedField === 'password_confirmation' && normalizedMessage.includes('match'))) {
            return t('validationPasswordMismatch');
        }

        const minLengthMatch = normalizedMessage.match(/(?:the\s+)?(.+?)\s+(?:field\s+)?must\s+be\s+at\s+least\s+(\d+)\s+characters?\.?/i);
        if (minLengthMatch) {
            const label = resolveFieldLabel(normalizedField, minLengthMatch[1]);
            return t('validationFieldMinCharacters', { field: label, count: minLengthMatch[2] });
        }

        const incorrectPattern = /(incorrect|not\s+correct|invalid|does\s+not\s+match)/;
        if (
            normalizedField === 'current_password' &&
            (incorrectPattern.test(normalizedMessage) || normalizedMessage.includes('current password'))
        ) {
            return t('validationCurrentPasswordIncorrect');
        }
        if (normalizedMessage.includes('current password') && incorrectPattern.test(normalizedMessage)) {
            return t('validationCurrentPasswordIncorrect');
        }

        if (/required/.test(normalizedMessage)) {
            if (normalizedField === 'current_password') {
                return t('validationCurrentPasswordRequired');
            }
            if (normalizedField === 'password_confirmation') {
                return t('validationPasswordConfirmationRequired');
            }
            if (normalizedField === 'password') {
                return t('validationPasswordRequired');
            }
        }

        return message;
    };

    const [section, setSection] = useState("profile");
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [showProfileCityMenu, setShowProfileCityMenu] = useState(false);
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);
    const [showTimezoneMenu, setShowTimezoneMenu] = useState(false);
    const [showGenderMenu, setShowGenderMenu] = useState(false);
    const [showPasswordSuccess, setShowPasswordSuccess] = useState(false);
    const [showProfileSuccess, setShowProfileSuccess] = useState(false);
    const [showLanguageSuccess, setShowLanguageSuccess] = useState(false);
    const [showNotificationSuccess, setShowNotificationSuccess] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileSection, setMobileSection] = useState(null); // one of keys used in `section`
    const mobileOpenRef = useRef(false);
    const mobileHistoryEntryRef = useRef(false);
    // Notification toggles (initial from server)
    const [emailNotif, setEmailNotif] = useState(notification.email_notifications ?? true);
    const [pushNotif, setPushNotif] = useState(notification.push_notifications ?? false);
    const [pushNotificationError, setPushNotificationError] = useState('');
    const [pushTokenProcessing, setPushTokenProcessing] = useState(false);
    const [notificationPreferenceProcessing, setNotificationPreferenceProcessing] = useState(false);
    const [deleteAccountProcessing, setDeleteAccountProcessing] = useState(false);
    const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
    const notificationProcessing = pushTokenProcessing || notificationPreferenceProcessing;
    // Keep local state in sync when server props change (after successful updates)
    useEffect(() => {
        setEmailNotif(notification.email_notifications ?? true);
        setPushNotif(notification.push_notifications ?? false);
    }, [notification.email_notifications, notification.push_notifications]);
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false; // treat < lg as mobile/tablet

    const pushNotificationErrorMessage = (reason) => {
        const messages = {
            unsupported: t('settingsPushNotificationsUnsupported'),
            denied: t('settingsPushNotificationsPermissionDenied'),
            not_granted: t('settingsPushNotificationsPermissionRequired'),
            token_unavailable: t('settingsPushNotificationsTokenUnavailable'),
        };

        return messages[reason] || t('settingsPushNotificationsTokenUnavailable');
    };

    const preparePushNotificationPreference = async (enabled) => {
        setPushNotificationError('');

        if (!enabled) {
            setPushTokenProcessing(true);

            try {
                await disableCustomerPushNotifications();
                return true;
            } catch (error) {
                console.warn('Unable to disable push notifications.', error);
                return true;
            } finally {
                setPushTokenProcessing(false);
            }
        }

        setPushTokenProcessing(true);

        try {
            const result = await enableCustomerPushNotifications({ requestPermission: true });

            if (!result.ok) {
                setPushNotificationError(pushNotificationErrorMessage(result.reason));
                return false;
            }

            return true;
        } catch (error) {
            console.warn('Unable to enable push notifications.', error);
            setPushNotificationError(t('settingsPushNotificationsTokenUnavailable'));
            return false;
        } finally {
            setPushTokenProcessing(false);
        }
    };

    const persistNotificationPreferences = (emailEnabled, pushEnabled) => new Promise((resolve) => {
        const payload = {
            _method: 'put',
            email_notifications: !!emailEnabled,
            push_notifications: !!pushEnabled,
        };

        setNotificationPreferenceProcessing(true);

        router.post(
            route('customer.settings.notification'),
            payload,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowNotificationSuccess(true);
                    // Ensure we get fresh server props for notification
                    router.reload({ only: ['notification'], preserveScroll: true });
                },
                onFinish: () => {
                    setNotificationPreferenceProcessing(false);
                    resolve();
                },
            }
        );
    });

    const handlePushToggleChange = async () => {
        if (notificationProcessing) {
            return;
        }

        const next = !pushNotif;

        if (next) {
            const prepared = await preparePushNotificationPreference(true);

            if (!prepared) {
                setPushNotif(false);
                return;
            }
        } else {
            setPushNotificationError('');
        }

        setPushNotif(next);
    };

    const submitNotification = async (e) => {
        e.preventDefault();

        if (notificationProcessing) {
            return;
        }

        const prepared = await preparePushNotificationPreference(!!pushNotif);

        if (!prepared) {
            return;
        }

        await persistNotificationPreferences(emailNotif, pushNotif);
    };
    const fileRef = useRef(null);
    const dobInputRef = useRef(null);
    const profileCityMenuRef = useRef(null);
    const languageMenuRef = useRef(null);
    const timezoneMenuRef = useRef(null);
    const genderMenuRef = useRef(null);
    const avatarObjectUrlRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || FALLBACK_AVATAR);
    const maxDob = new Date().toISOString().split('T')[0];

    const clearAvatarObjectUrl = () => {
        if (avatarObjectUrlRef.current) {
            URL.revokeObjectURL(avatarObjectUrlRef.current);
            avatarObjectUrlRef.current = null;
        }
    };

    const handleAvatarChange = (event) => {
        const file = event.target.files?.[0] || null;
        setData('avatar', file);

        clearAvatarObjectUrl();

        if (file) {
            const previewUrl = URL.createObjectURL(file);
            avatarObjectUrlRef.current = previewUrl;
            setAvatarPreview(previewUrl);
        } else {
            setAvatarPreview(profile.avatar_url || FALLBACK_AVATAR);
        }
    };

    const openDobPicker = () => {
        if (dobInputRef.current) {
            dobInputRef.current.showPicker?.();
            dobInputRef.current.focus();
        }
    };

    // Profile form
    const { data, setData, post, processing, errors, reset, progress, transform } = useForm({
        _method: 'put',
        name: profile.name || '',
        email: profile.email || '',
        phone_number: profile.phone_number || '',
        governorate: profile.governorate || '',
        address: profile.address || '',
        dob: profile.dob || '',
        gender: profile.gender || '',
        avatar: null,
    });

    const [profileCity, setProfileCity] = useState(profile.governorate || '');

    // Initialize language from context or profile
    const [languageValue, setLanguageValue] = useState(language === 'ar' ? 'ar_SY' : 'en_US');

    const [timezoneValue, setTimezoneValue] = useState(profile.timezone || 'EEST');

    const [genderValue, setGenderValue] = useState(profile.gender || '');

    // Dynamic language options based on translations
    const getLanguageOptions = () => [
        { label: t('settingsLanguageLanguagesEnUS'), value: 'en_US', lang: 'en' },
        { label: t('settingsLanguageLanguagesArSY'), value: 'ar_SY', lang: 'ar' },
    ];

    const getCityOptions = () => {
        if (!cities || cities.length === 0) {
            // Fallback to hardcoded cities if no cities data from backend
            return [
                { label: t('cityAleppo'), value: 'Aleppo' },
                { label: t('cityDamascus'), value: 'Damascus' },
            ];
        }

        // Use dynamic cities from database
        return cities.map(city => ({
            label: currentLanguage === 'ar' && city.name_arabic ? city.name_arabic : city.name,
            value: city.name
        }));
    };

    const getTimezoneOptions = () => [
        { label: t('settingsLanguageTimezonesEEST'), value: 'EEST' },
        { label: t('settingsLanguageTimezonesGMT'), value: 'GMT' },
    ];

    const getGenderOptions = () => [
        { label: t('settingsProfileGendersMale'), value: 'Male' },
        { label: t('settingsProfileGendersFemale'), value: 'Female' },
    ];

    const profileCityLabel =
        getCityOptions().find((option) => option.value === profileCity)?.label ?? t('commonSelectCity');
    const languageLabel =
        getLanguageOptions().find((option) => option.value === languageValue)?.label ?? getLanguageOptions()[0].label;
    const timezoneLabel =
        getTimezoneOptions().find((option) => option.value === timezoneValue)?.label ?? getTimezoneOptions()[0].label;
    const genderLabel =
        getGenderOptions().find((option) => option.value === genderValue)?.label ?? (genderValue ? genderValue : "");

    // Handle language change
    const handleLanguageSelect = (value) => {
        setLanguageValue(value);
        setShowLanguageMenu(false);
    };

    const submitLanguageUpdate = (event) => {
        event.preventDefault();
        const lang = languageValue === 'ar_SY' ? 'ar' : 'en';

        router.put(route('customer.settings.language'), {
            language: lang
        }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                changeLanguage(lang);
                setShowLanguageSuccess(true);
            },
        });
    };

    useEffect(() => {
        if (!showProfileCityMenu && !showLanguageMenu && !showTimezoneMenu && !showGenderMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            const cityNode = profileCityMenuRef.current;
            const languageNode = languageMenuRef.current;
            const timezoneNode = timezoneMenuRef.current;
            const genderNode = genderMenuRef.current;

            if (showProfileCityMenu && cityNode && !cityNode.contains(event.target)) {
                setShowProfileCityMenu(false);
            }
            if (showLanguageMenu && languageNode && !languageNode.contains(event.target)) {
                setShowLanguageMenu(false);
            }
            if (showTimezoneMenu && timezoneNode && !timezoneNode.contains(event.target)) {
                setShowTimezoneMenu(false);
            }
            if (showGenderMenu && genderNode && !genderNode.contains(event.target)) {
                setShowGenderMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside, { passive: true });

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [showProfileCityMenu, showLanguageMenu, showTimezoneMenu, showGenderMenu]);

    useEffect(() => {
        return () => {
            clearAvatarObjectUrl();
        };
    }, []);

    useEffect(() => {
        clearAvatarObjectUrl();
        setAvatarPreview(profile.avatar_url || FALLBACK_AVATAR);
    }, [profile.avatar_url]);

    const handleProfileCitySelect = (value) => {
        // Update local selection state and sync to form data
        setProfileCity(value);
        setData('governorate', value);
        setShowProfileCityMenu(false);
    };

    const handleTimezoneSelect = (value) => {
        setTimezoneValue(value);
        setShowTimezoneMenu(false);
    };

    const handleGenderSelect = (value) => {
        setGenderValue(value);
        setData('gender', value);
        setShowGenderMenu(false);
    };

    const handlePhoneInputChange = (event) => {
        const digits = extractSubscriberDigits(event.target.value);
        const nextValue = digits ? `${PHONE_PREFIX}${digits}` : '';
        setData('phone_number', nextValue);
    };

    // Password form
    const passwordForm = useForm({
        _method: 'put',
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const textDirection = i18n.language === 'ar' ? 'rtl' : 'ltr';

    // Logout form for POST logout
    const logoutForm = useForm({});
    const handleLogout = async () => {
        await clearCustomerPushNotificationTokenForLogout();
        logoutForm.post(route('customer.logout'));
    };

    const confirmDeleteAccount = () => {
        if (deleteAccountProcessing) {
            return;
        }

        setShowDeleteAccountConfirm(false);

        setDeleteAccountProcessing(true);

        router.delete(route('customer.account.delete'), {
            preserveScroll: true,
            onFinish: () => {
                setDeleteAccountProcessing(false);
            },
        });
    };

    const handleDeleteAccount = () => {
        if (deleteAccountProcessing) {
            return;
        }

        setShowDeleteAccountConfirm(true);
    };

    const submitProfile = (e) => {
        e.preventDefault();
        post(route('customer.settings.profile'), {
            preserveScroll: true,
            onSuccess: () => {
                setData('avatar', null);
                setShowProfileSuccess(true);
                router.reload({ only: ['auth', 'profile'] });
            },
        });
    };

    const submitPassword = (e) => {
        e.preventDefault();

        // Validate password confirmation matches
        if (passwordForm.data.password !== passwordForm.data.password_confirmation) {
            const mismatchMessage = t('validationPasswordMismatch');
            passwordForm.setError('password', mismatchMessage);
            passwordForm.setError('password_confirmation', mismatchMessage);
            return;
        }

        passwordForm.post(route('customer.settings.password'), {
            onSuccess: () => {
                passwordForm.reset();
                setShowPasswordSuccess(true);
            },
        });
    };

    // --- Mobile off-canvas state ---
    useEffect(() => {
        mobileOpenRef.current = mobileOpen;
    }, [mobileOpen]);

    useEffect(() => {
        const handlePopState = () => {
            if (!mobileHistoryEntryRef.current && !mobileOpenRef.current) {
                return;
            }

            mobileHistoryEntryRef.current = false;
            mobileOpenRef.current = false;
            setMobileOpen(false);
            setMobileSection(null);
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const openMobile = (key) => {
        setMobileSection(key);
        setSection(key);
        setMobileOpen(true);
        mobileOpenRef.current = true;

        if (window.matchMedia('(max-width: 1023px)').matches && !mobileHistoryEntryRef.current) {
            window.history.pushState(window.history.state, '', window.location.href);
            mobileHistoryEntryRef.current = true;
        }
    };

    const closeMobile = () => {
        setMobileOpen(false);
        setMobileSection(null);
        mobileOpenRef.current = false;

        if (mobileHistoryEntryRef.current) {
            mobileHistoryEntryRef.current = false;
            window.history.back();
        }
    };

    // quick-submit toggles for mobile list
    const togglePush = async () => {
        if (notificationProcessing) {
            return;
        }

        const next = !pushNotif;
        const prepared = await preparePushNotificationPreference(next);

        if (!prepared) {
            setPushNotif(false);
            return;
        }

        setPushNotif(next);
        await persistNotificationPreferences(emailNotif, next);
    };

    const toggleSmsAliasEmail = async () => {
        if (notificationProcessing) {
            return;
        }

        const next = !emailNotif;
        setEmailNotif(next);
        await persistNotificationPreferences(next, pushNotif);
    };

    // --- Section components (to reuse in desktop and mobile off‑canvas) ---
    const ProfileSection = () => (
        <form id="section-profile" className="text-sm h-full" onSubmit={submitProfile} encType="multipart/form-data">

            <div className="rounded-t-[14px] ">
                <div className="">
                    <h3 className="text-base font-bold text-black">{t('settingsMenuProfileInfo')}</h3>
                </div>

                <div className="">
                    {/* Avatar upload */}
                    <div className="mt-3 flex items-center gap-4">
                        <label className="relative cursor-pointer">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />

                            <div className="w-16 h-16 rounded-full overflow-hidden border border-[#E5E7EB]">
                                <img
                                    src={avatarPreview}
                                    alt="Avatar preview"
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#338dff] text-white grid place-items-center text-xs">+
                            </span>
                        </label>

                        <div className="flex flex-col">
                            <p className="text-lg font-bold text-[#0C0C0C]">{t('settingsProfileUploadPhoto')}</p>
                            <p className="text-base font-normal text-slate-500">{t('settingsProfilePhotoHint')}</p>
                            {errors.avatar && (
                                <p className="text-xs text-red-500 mt-1">{translateFieldError('avatar', errors.avatar)}</p>
                            )}
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid grid-cols-2 gap-4  ">
                            <div>
                                <input
                                    className="w-full input-pill"
                                    placeholder={t('settingsProfilePlaceholdersName')}
                                    value={data.name}
                                    onChange={(e) => setData('name', sanitizeTextInput(e.target.value))}
                                />
                                {errors.name && <div className="text-xs text-red-500 mt-1">{translateFieldError('name', errors.name)}</div>}
                            </div>
                            <div>
                                {/* <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('commonCity')}
                                </label> */}
                                <div className="relative" ref={profileCityMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowProfileCityMenu((prev) => !prev)}
                                        className="w-full input-pill appearance-none pr-12 flex items-center justify-between text-left"
                                    >
                                        <span className="truncate">{profileCityLabel}</span>
                                        <svg
                                            className="ml-3 h-4 w-4 text-gray-400"
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
                                    {showProfileCityMenu && (
                                        <div className="absolute left-0 right-0 z-50 mt-2">
                                            <Menu
                                                items={getCityOptions()}
                                                onItemClick={(item) => handleProfileCitySelect(item.value)}
                                                anchorRef={profileCityMenuRef}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="relative flex items-center input-pill bg-gray-50">
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    dir={textDirection}
                                    className="flex-1 px-3 outline-none"
                                    placeholder={t('commonPhonePlaceholder')}
                                    value={formatPhoneForMask(data.phone_number)}
                                    onChange={handlePhoneInputChange}
                                />
                            </div>
                            {errors.phone_number && <div className="text-xs text-red-500 mt-1">{translateFieldError('phone_number', errors.phone_number)}</div>}
                        </div>
                        <div>
                            <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                className="w-full input-pill"
                                value={data.email}
                                dir={textDirection}
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
                                placeholder={t('commonEnterEmailAddress')}
                            />
                            {errors.email && <div className="text-xs text-red-500 mt-1">{translateFieldError('email', errors.email)}</div>}
                        </div>

                        <div className="md:col-span-2">
                            <input
                                className="w-full input-pill"
                                value={data.address}
                                onChange={(e) => setData('address', sanitizeTextInput(e.target.value))}
                                placeholder={t('settingsProfilePlaceholdersAddress')}
                            />
                            {errors.address && <div className="text-xs text-red-500 mt-1">{translateFieldError('address', errors.address)}</div>}
                        </div>
                    </div>

                    <div className="grid mt-5 grid-cols-2 gap-4">
                        <div>
                            <div className="relative">
                                <input
                                    ref={dobInputRef}
                                    type="date"
                                    max={maxDob}
                                    value={data.dob || ''}
                                    onChange={(e) => setData('dob', sanitizeTextInput(e.target.value))}
                                    className="w-full input-pill"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="relative" ref={genderMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowGenderMenu((prev) => !prev)}
                                    className="w-full input-pill appearance-none pr-12 flex items-center justify-between text-left text-sm text-gray-700"
                                >
                                    <span className="truncate">{genderLabel}</span>
                                    <svg
                                        className="ml-3 h-4 w-4 text-gray-400"
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
                                {showGenderMenu && (
                                    <div className="absolute left-0 right-0 z-50 mt-2">
                                        <Menu
                                            items={getGenderOptions()}
                                            onItemClick={(item) => handleGenderSelect(item.value)}
                                            anchorRef={genderMenuRef}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4">
                <div className="hidden lg:flex justify-end">
                    <button type="submit" disabled={processing} className="bg-[#338DFF] text-white px-6 py-3 rounded-full font-medium shadow-md hover:shadow-lg disabled:opacity-60">
                        {t('settingsSaveChanges')}
                    </button>
                </div>
            </div>
        </form>
    );

    const NotificationSection = () => (
        <form id="section-notification" onSubmit={submitNotification} className="text-sm">
            <h2 className="text-xl font-semibold size-[18px]">{t('commonNotifications')}</h2>
            <div className="border-t border-[#E6EAF3] mt-3" />

            <div className="mt-6 space-y-8 text-base">
                {/* Email Notifications */}
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <span className="text-gray-800 font-medium">{t('settingsNotificationEmailNotification')}</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={emailNotif}
                        disabled={notificationProcessing}
                        onClick={() => setEmailNotif(v => !v)}
                        className={
                            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors ' +
                            (emailNotif ? 'bg-[#338DFF]' : 'bg-gray-300') +
                            (notificationProcessing ? ' opacity-60 cursor-wait' : '')
                        }
                    >
                        <span
                            className={
                                'inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ' +
                                toggleThumbClass(emailNotif)
                            }
                        />
                    </button>
                </div>

                {/* Push Notifications */}
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <span className="text-gray-800 font-medium">{t('settingsNotificationPushNotification')}</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={pushNotif}
                        disabled={notificationProcessing}
                        onClick={handlePushToggleChange}
                        className={
                            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors ' +
                            (pushNotif ? 'bg-[#338DFF]' : 'bg-gray-300') +
                            (notificationProcessing ? ' opacity-60 cursor-wait' : '')
                        }
                    >
                        <span
                            className={
                                'inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ' +
                                toggleThumbClass(pushNotif)
                            }
                        />
                    </button>
                </div>
                {pushNotificationError && (
                    <p className={`text-xs text-red-500 ${isRTL ? 'text-right' : ''}`}>{pushNotificationError}</p>
                )}
            </div>

            <div className="mt-20 flex justify-end">
                <button type="submit" disabled={notificationProcessing} className="inline-flex items-center justify-center gap-2 bg-[#338DFF] text-white px-6 py-3 rounded-full font-medium shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
                    {t('commonUpdate')}
                </button>
            </div>
        </form>
    );

    const TermsSection = () => (
        <div id="section-terms" className="text-sm text-gray-700 leading-relaxed">
            <TermsAndConditions isModal termsContent={termsContent} />
        </div>
    );

    const PrivacySection = () => {
        const [openPrivacyIndex, setOpenPrivacyIndex] = useState(null);

        const privacyItems = [
            {
                title: t('settingsPrivacyIntroduction'),
                content: t('settingsPrivacyIntroductionContent')
            },
            {
                title: t('settingsPrivacyCollectionTitle'),
                content: (
                    <ul className="list-disc ml-6 mt-1">
                        <li>{t('settingsPrivacyCollectionPersonal')}</li>
                        <li>{t('settingsPrivacyCollectionId')}</li>
                        <li>{t('settingsPrivacyCollectionBooking')}</li>
                        <li>{t('settingsPrivacyCollectionPayment')}</li>
                        <li>{t('settingsPrivacyCollectionUsage')}</li>
                    </ul>
                )
            },
            {
                title: t('settingsPrivacyUseTitle'),
                content: (
                    <ul className="list-disc ml-6 mt-1">
                        <li>{t('settingsPrivacyUseProcess')}</li>
                        <li>{t('settingsPrivacyUseCommunicate')}</li>
                        <li>{t('settingsPrivacyUseVerify')}</li>
                        <li>{t('settingsPrivacyUseImprove')}</li>
                        <li>{t('settingsPrivacyUseEnsure')}</li>
                    </ul>
                )
            },
            {
                title: t('settingsPrivacyProtectionTitle'),
                content: t('settingsPrivacyProtectionContent')
            },
            {
                title: t('settingsPrivacyRightsTitle'),
                content: (<ul className="list-disc ml-6 mt-1">
                                <li>{t('settingsPrivacyRightsView')}</li>
                                <li>{t('settingsPrivacyRightsRequest')}</li>
                                <li>{t('settingsPrivacyRightsContact')}{' '}
                                <a href={`mailto:${t('settingsPrivacyRightsEmail')}`} className="underline">
                                    {t('settingsPrivacyRightsEmail')}
                                </a>
                                </li>
                            </ul>
                    )
            },
            {
                title: t('settingsPrivacyChangesTitle'),
                content: t('settingsPrivacyChangesContent')
            }
        ];

        const togglePrivacyIndex = (idx) => {
            setOpenPrivacyIndex(openPrivacyIndex === idx ? null : idx);
        };

        return (
            <div id="section-privacy" className="text-sm text-gray-700 leading-relaxed">
                    <div className="divide-y divide-[#E3E3E3] mt-4">
                        {privacyItems.map((item, idx) => {
                            const isOpen = openPrivacyIndex === idx;
                            return (
                                <div
                                key={idx}
                                className={`bg-white mb-4 border border-gray-200 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)] ${
                                isOpen ? 'rounded-xl' : 'rounded-full'
                                }`}
                            >
                                    <button
                                        type="button"
                                        onClick={() => togglePrivacyIndex(idx)}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <h3 className="text-base font-semibold text-gray-800 pr-4">{idx + 1}. {item.title}</h3>
                                        <img
                                            src="/assets/images/Drop Down Icon.png"
                                            alt={isOpen ? 'collapse' : 'expand'}
                                            className={['w-5 h-5 opacity-80 transition-transform', isOpen ? 'rotate-180' : 'rotate-0'].join(' ')}
                                        />
                                    </button>
                                    {isOpen && (
                                        <div className="mt-3 text-sm text-[#595959] leading-6">
                                            {item.content}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
            </div>
        );
    };

const menuBtn = (key, icon, label) => {
    const active = section === key;

    return (
        <button
            key={key}
            onClick={() => setSection(key)}
            className={[
                "menu-item w-full flex items-center justify-between gap-3 px-4 py-3 rounded transition-all",
                active ? "bg-[#f2f2f2] text-blue-500" : "bg-transparent text-gray-900"
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span className="flex items-center gap-3">
                <img
                    src={icon}
                    alt=""
                    className={`w-5 h-5 transition-all duration-200 ${
                        active ? "filter-blue" : "filter-black"
                    }`}
                />
                <span className="text-base font-semibold">{label}</span>
            </span>

            {active && (
                <span className="flex items-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M9 18l6-6-6-6"
                            stroke="#000000"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            )}
        </button>
    );
};


    return (
        <div className="min-h-screen sm:bg-[#f8f9fb] text-[#1f2937] flex flex-col md:flex-row scrollbar-hide overflow-x-hidden">
            {" "}
            <style>{`
        .menu-item { height:52px; border-radius:0; border:none; transition: all 0.2s ease; padding:14px 16px; display:flex; align-items:center; justify-content:space-between;}
        .menu-item.active { background:#F1F1F1; border:none; border-radius:0; box-shadow:none; color:#338DFF; font-weight:600; }
        @media (min-width: 500px) {
            .menu-item:hover { background:#F1F1F1; }
        }
        .input-pill { height:52px; border-radius:999px; border:1.2px solid #e2e8f0; padding:11px 16px; font-size:14px; transition: border-color .2s ease, box-shadow .2s ease; }
        .input-pill:focus { outline: none; border-color:#338dff; box-shadow:0 0 0 4px rgba(51,141,255,0.16); }
        .filter-blue {
        filter: brightness(0) saturate(100%) invert(37%) sepia(91%) saturate(2222%) hue-rotate(196deg) brightness(100%) contrast(101%);
        }

        .filter-black {
        filter: brightness(0) saturate(100%) invert(0%) sepia(100%) saturate(7487%) hue-rotate(222deg) brightness(100%) contrast(107%);
        }

      `}</style>
            {/* Sidebar */}
            <CustomerSidebar />
            {/* Main content */}
            <main className="flex-1 px-3 sm:px-6 mt-6 sm:mt-0 sm:md-0 md:px-10 py-6 md:ml-[72px] md:overflow-y-auto scrollbar-hide">
                {/* Header */}
                <MobileHeader title={t('commonSettings')}/>

                 <div className="-mt-6 md:-mt-6 -mx-4 md:-mx-10 hidden md:block">
                    <CustomerHeader title={t('commonSettings')} mobileTitle={t('commonSettings')} breadcrumbs={[{ label: t('commonHome'), href: '/customer/dashboard' },{ label: t('commonSettings') }]}/>
                </div>
                <div className="pt-0 md:pt-6 ml-0">

                {/* Mobile list + off‑canvas */}
                <section className="lg:hidden">
                    <div className="bg-white sm:rounded-2xl sm:shadow-sm sm:border border-gray-200 overflow-hidden">
                        <div className="pl-0 pr-4 py-4">
                            <p className="text-[#338DFF] font-semibold">{t('commonAccounts')}</p>
                        </div>
                        <div className="divide-y divide-[#E3E3E3]">
                        <button
                            className="w-full text-left px-4 py-3 flex items-center justify-between"
                            onClick={() => openMobile('profile')}
                        >
                            <span className="text-gray-900">{t('commonEditProfile')}</span>
                            <img
                            src="/assets/images/left_arrow_icon.svg"
                            alt="arrow"
                            className="w-4 h-4 rotate-180 text-gray-400"
                            />
                        </button>

                        <button
                            className="w-full text-left px-4 py-3 flex items-center justify-between"
                            onClick={() => openMobile('language')}
                        >
                            <span className="text-gray-900">{t('commonLanguageRegion')}</span>
                            <img
                            src="/assets/images/left_arrow_icon.svg"
                            alt="arrow"
                            className="w-4 h-4 rotate-180 text-gray-400"
                            />
                        </button>

                        <button
                            className="w-full text-left px-4 py-3 flex items-center justify-between"
                            onClick={() => openMobile('security')}
                        >
                            <span className="text-gray-900">{t('commonSecurity')}</span>
                            <img
                            src="/assets/images/left_arrow_icon.svg"
                            alt="arrow"
                            className="w-4 h-4 rotate-180 text-gray-400"
                            />
                        </button>
                        </div>
                        <div className="pl-0 pr-4 py-4">
                            <p className="text-[#338DFF] font-semibold">{t('commonSupport')}</p>
                        </div>
                        <div className="divide-y divide-[#E3E3E3]">
                            <button className="w-full text-left px-4 py-3 flex items-center justify-between" onClick={() => openMobile('contact')}>
                                <span className="text-gray-900">{t('commonContactUs')}</span>
                                <img
                                src="/assets/images/left_arrow_icon.svg"
                                alt="arrow"
                                className="w-4 h-4 rotate-180 text-gray-400"
                                />
                            </button>
                            <button className="w-full text-left px-4 py-3 flex items-center justify-between" onClick={() => openMobile('help')}>
                                <span className="text-gray-900">{t('commonHelpSupport')}</span>
                                <img
                                src="/assets/images/left_arrow_icon.svg"
                                alt="arrow"
                                className="w-4 h-4 rotate-180 text-gray-400"
                                />
                            </button>
                        </div>

                        <div className="pl-0 pr-4 py-4">
                            <p className="text-[#338DFF] font-semibold">{t('commonNotifications')}</p>
                        </div>
                        <div className="divide-y divide-[#E3E3E3]">
                            <div className={`px-4 py-3 flex items-center justify-between ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                <span className="text-gray-900">{t('settingsNotificationPushNotification')}</span>
                                <button type="button" role="switch" aria-checked={pushNotif} disabled={notificationProcessing} onClick={togglePush} className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (pushNotif ? 'bg-[#338DFF]' : 'bg-gray-300') + (notificationProcessing ? ' opacity-60 cursor-wait' : '')}>
                                    <span className={'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' + toggleThumbClass(pushNotif)} />
                                </button>
                            </div>
                            {pushNotificationError && (
                                <p className={`px-4 pb-3 text-xs text-red-500 ${isRTL ? 'text-right' : ''}`}>{pushNotificationError}</p>
                            )}
                            <div className={`px-4 py-3 flex items-center justify-between ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                <span className="text-gray-900">{t('settingsNotificationSmsNotification')}</span>
                                <button type="button" role="switch" aria-checked={emailNotif} disabled={notificationProcessing} onClick={toggleSmsAliasEmail} className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (emailNotif ? 'bg-[#338DFF]' : 'bg-gray-300') + (notificationProcessing ? ' opacity-60 cursor-wait' : '')}>
                                    <span className={'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' + toggleThumbClass(emailNotif)} />
                                </button>
                            </div>
                        </div>

                        <div className="pl-0 pr-4 py-4">
                            <p className="text-[#338DFF] font-semibold">{t('commonOther')}</p>
                        </div>
                        <div className="divide-y divide-[#E3E3E3]">
                            <button className="w-full text-left px-4 py-3 flex items-center justify-between" onClick={() => openMobile('privacy')}>
                                <span className="text-gray-900">{t('commonPrivacyPolicy')}</span>
                                <img
                                src="/assets/images/left_arrow_icon.svg"
                                alt="arrow"
                                className="w-4 h-4 rotate-180 text-gray-400"
                                />
                            </button>
                            <button className="w-full text-left px-4 py-3 flex items-center justify-between" onClick={() => openMobile('terms')}>
                                <span className="text-gray-900">{t('commonTermsConditions')}</span>
                                <img
                                src="/assets/images/left_arrow_icon.svg"
                                alt="arrow"
                                className="w-4 h-4 rotate-180 text-gray-400"
                                />
                            </button>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="menu-item text-red-600 "
                        >
                            <span className="flex items-center gap-3">
                                <img src="/assets/images/logout.svg" alt="logout" />
                                {t('commonLogout')}
                            </span>
                        </button>
                        <div className="h-15"></div>
                    </div>

                    {/* Off‑canvas */}
                    <div className={(mobileOpen ? 'pointer-events-auto' : 'pointer-events-none') + ' fixed inset-0 z-50'} aria-hidden={!mobileOpen}>
                        <div className={(mobileOpen ? 'bg-black/40' : 'bg-transparent') + ' absolute inset-0 transition-colors duration-200'} onClick={closeMobile} />
                        <div className={(mobileOpen ? 'translate-x-0' : 'translate-x-full') + ' absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform duration-300 flex flex-col'} onClick={(e) => e.stopPropagation()}>
                            <div className="md:hidden flex justify-center items-center fixed top-0 left-0 right-0 z-20 font-bold bg-white/95 backdrop-blur border-b border-[#E6EAF3] h-14">
                                <button
                                    onClick={closeMobile}
                                    className={`absolute top-1/2 -translate-y-1/2 text-[#338DFF] text-lg ${isRTL ? 'right-4' : 'left-4'}`}
                                    aria-label="Back"
                                >
                                    <img src="/assets/images/left_arrow_icon.svg" alt="back" className="w-5 h-5"/>
                                </button>

                                <h1 className="text-lg text-gray-900 text-center font-semibold">
                                    {mobileSection === 'profile' && t('commonProfile')}
                                    {mobileSection === 'language' && t('commonLanguageRegion')}
                                    {mobileSection === 'security' && t('commonSecurity')}
                                    {mobileSection === 'notification' && t('settingsSectionsNotification')}
                                    {mobileSection === 'terms' && t('commonTermsConditions')}
                                    {mobileSection === 'privacy' && t('commonPrivacyPolicy')}
                                    {mobileSection === 'contact' && t('commonContactUs')}
                                    {mobileSection === 'help' && t('commonHelpSupport')}
                                </h1>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 mt-14 bg-gray-50">
                                {mobileSection === 'profile' && ProfileSection()}
                                {mobileSection === 'language' && (
                                    <form id="section-language" onSubmit={submitLanguageUpdate}>
                                        <h2 className="text-base font-normal text-[#767676]">{t('settingsLanguageDescription')}</h2>
                                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                                            <div className="relative" ref={languageMenuRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLanguageMenu((prev) => !prev)}
                                                    className="w-full h-[52px] rounded-full border border-gray-200 px-4 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none appearance-none flex items-center justify-between text-left text-gray-700"
                                                >
                                                    <span className="truncate">{languageLabel}</span>
                                                    <svg
                                                        className="ml-3 h-4 w-4 text-gray-400"
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
                                                {showLanguageMenu && (
                                                    <div className="absolute left-0 right-0 z-50 mt-2">
                                                        <Menu
                                                            items={getLanguageOptions()}
                                                            onItemClick={(item) => handleLanguageSelect(item.value)}
                                                            anchorRef={languageMenuRef}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative" ref={timezoneMenuRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTimezoneMenu((prev) => !prev)}
                                                    className="w-full h-[52px] rounded-full border border-gray-200 px-4 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none appearance-none flex items-center justify-between text-left text-gray-700"
                                                >
                                                    <span className="truncate">{timezoneLabel}</span>
                                                    <svg
                                                        className="ml-3 h-4 w-4 text-gray-400"
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
                                                {showTimezoneMenu && (
                                                    <div className="absolute left-0 right-0 z-50 mt-2">
                                                        <Menu
                                                            items={getTimezoneOptions()}
                                                            onItemClick={(item) => handleTimezoneSelect(item.value)}
                                                            anchorRef={timezoneMenuRef}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* <div className="mt-20 flex justify-end">
                                            <button className="bg-[#338DFF] text-white px-6 py-3 rounded-full font-medium shadow-md hover:shadow-lg">{t('commonUpdate')}</button>
                                        </div> */}
                                    </form>
                                )}
                                {mobileSection === 'security' && (
                                    <form id="section-security" onSubmit={submitPassword}>
                                        <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('commonSecurity')}</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="relative md:col-span-2">
                                                <label className="text-xs text-gray-500 block mb-1">{t('settingsSecurityCurrentPassword')}</label>
                                                <input
                                                    type={showCurrentPass ? 'text' : 'password'}
                                                    value={passwordForm.data.current_password}
                                                    onChange={(e) => passwordForm.setData('current_password', sanitizeTextInput(e.target.value))}
                                                    className="w-full h-[52px] rounded-full border border-gray-200 px-4 pr-12 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none"
                                                    placeholder={t('settingsSecurityPlaceholdersCurrentPassword')}
                                                />
                                                <button type="button" onClick={() => setShowCurrentPass(v => !v)} className="absolute right-4 mt-1 top-8 text-gray-400 hover:text-gray-600" aria-label={t('commonTogglePassword')}>
                                                    {showCurrentPass ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    ) : (
                                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18"></path></svg>
                                                    )}
                                                </button>
                                                {passwordForm.errors.current_password && (<div className="text-xs text-red-500 mt-1">{translatePasswordError('current_password', passwordForm.errors.current_password)}</div>)}
                                            </div>
                                            <div className="relative">
                                                <label className="text-xs text-gray-500 block mb-1">{t('settingsSecurityNewPassword')}</label>
                                                <input
                                                    type={showNewPass ? 'text' : 'password'}
                                                    value={passwordForm.data.password}
                                                    onChange={(e) => passwordForm.setData('password', sanitizeTextInput(e.target.value))}
                                                    className="w-full h-[52px] rounded-full border border-gray-200 px-4 pr-12 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none"
                                                    placeholder={t('authSetPasswordNewPlaceholder')}
                                                />
                                                <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute right-4 mt-1 top-8 text-gray-400 hover:text-gray-600" aria-label={t('commonTogglePassword')}>
                                                    {showNewPass ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    ) : (
                                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18"></path></svg>
                                                    )}
                                                </button>
                                                {passwordForm.errors.password && (<div className="text-xs text-red-500 mt-1">{translatePasswordError('password', passwordForm.errors.password)}</div>)}
                                            </div>
                                            <div className="relative">
                                                <label className="text-xs text-gray-500 block mb-1">{t('commonConfirmPassword')}</label>
                                                <input
                                                    type={showConfirmPass ? 'text' : 'password'}
                                                    value={passwordForm.data.password_confirmation}
                                                    onChange={(e) => passwordForm.setData('password_confirmation', sanitizeTextInput(e.target.value))}
                                                    className="w-full h-[52px] rounded-full border border-gray-200 px-4 pr-12 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none"
                                                    placeholder={t('settingsSecurityPlaceholdersConfirmPassword')}
                                                />
                                                <button type="button" onClick={() => setShowConfirmPass(v => !v)} className="absolute right-4 mt-1 top-8 text-gray-400 hover:text-gray-600" aria-label={t('commonTogglePassword')}>
                                                    {showConfirmPass ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    ) : (
                                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18"></path></svg>
                                                    )}
                                                </button>
                                                {passwordForm.errors.password_confirmation && (<div className="text-xs text-red-500 mt-1">{translatePasswordError('password_confirmation', passwordForm.errors.password_confirmation)}</div>)}
                                            </div>
                                        </div>
                                        {deleteAccountEnabled && (
                                            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4">
                                                <h3 className="text-sm font-semibold text-red-700">
                                                    {t('settingsDeleteAccountSectionTitle')}
                                                </h3>
                                                <p className="mt-1 text-xs text-red-600">
                                                    {t('settingsDeleteAccountDescription')}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={handleDeleteAccount}
                                                    disabled={deleteAccountProcessing}
                                                    className="mt-4 inline-flex h-[44px] min-w-[140px] items-center justify-center rounded-full border border-red-500 px-5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {deleteAccountProcessing ? t('settingsDeletingAccount') : t('settingsDeleteAccountButton')}
                                                </button>
                                            </div>
                                        )}
                                        {/* Button moved to sticky footer on mobile */}
                                    </form>
                                )}
                                {mobileSection === 'terms' && <TermsSection />}
                                {mobileSection === 'privacy' && <PrivacySection />}
                                {mobileSection === 'contact' && (
                                    <div className="space-y-5">
                                        <p className="text-sm text-[#595959]">
                                            {t('settingsSupportContactIntro')}
                                        </p>

                                        <div className="space-y-4">
                                            <a href="tel:+963555000000" className="block rounded-2xl bg-white p-4 border border-gray-200 shadow-sm">
                                                <div className="flex items-start gap-3">
                                                    <span className="shrink-0 w-10 h-10 rounded-full bg-[#EAF2FF] grid place-items-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#338DFF]">
                                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.58 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.11a2 2 0 0 1 2.11-.45c.84.26 1.71.46 2.61.58A2 2 0 0 1 22 16.92z" fill="currentColor"/>
                                                        </svg>
                                                    </span>
                                                    <div>
                                                        <div className="text-[#338DFF] font-semibold">{t('commonCallUs')}</div>
                                                        <div className="text-sm text-[#595959]">+963 (555) 000 0000</div>
                                                    </div>
                                                </div>
                                            </a>

                                            <a href="mailto:hello@BoxyGomail.com" className="block rounded-2xl bg-white p-4 border border-gray-200 shadow-sm">
                                                <div className="flex items-start gap-3">
                                                    <span className="shrink-0 w-10 h-10 rounded-full bg-[#EAF2FF] grid place-items-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#338DFF]">
                                                            <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm16 0-8 7L4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </span>
                                                    <div>
                                                        <div className="text-[#338DFF] font-semibold">{t('commonEmailUs')}</div>
                                                        <div className="text-sm text-[#595959]">hello@BoxyGomail.com</div>
                                                    </div>
                                                </div>
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {mobileSection === 'help' && (
                                    <div className="-mx-2">
                                        <FaqContent />
                                    </div>
                                )}
                            </div>
                            {(mobileSection === 'profile' || mobileSection === 'language' || mobileSection === 'security') && (
                                <div className="p-4 border-t border-[#E3E3E3] bg-white">
                                    {mobileSection === 'profile' && (
                                        <button onClick={() => document.getElementById('section-profile')?.requestSubmit()} className="w-full rounded-full bg-[#338DFF] text-white py-3 font-semibold">
                                            {t('settingsSaveChanges')}
                                        </button>
                                    )}
                                    {mobileSection === 'language' && (
                                        <button onClick={() => document.getElementById('section-language')?.requestSubmit()} className="w-full rounded-full bg-[#338DFF] text-white py-3 font-semibold">
                                            {t('commonUpdate')}
                                        </button>
                                    )}
                                    {mobileSection === 'security' && (
                                        <button onClick={() => document.getElementById('section-security')?.requestSubmit()} className="w-full rounded-full bg-[#338DFF] text-white py-3 font-semibold" disabled={passwordForm.processing}>
                                            {passwordForm.processing ? t('commonUpdating') : t('settingsUpdatePassword')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Settings Card (desktop) */}{" "}
                <section className="hidden lg:block bg-white sm:rounded-[20px] sm:shadow-sm sm:border border-gray-200 px-0 py-6 sm:p-6 md:p-8">
                    {" "}
                    <div className="flex flex-col lg:flex-row w-full max-w-full h-auto lg:h-[756px] gap-[30px] rounded-[15px] p-[5px] relative">
                        {" "}
                        {/* Sidebar Menu */}{" "}
                <aside className="sm:w-[410px] h-[398px] gap-[20px] flex flex-col font-bold opacity-100">

                            {" "}
                            {menuBtn(
                                "profile",
                                "/assets/images/user-edit.svg",
                                t('settingsMenuProfileInfo')
                            )}{" "}
                            {menuBtn(
                                "notification",
                                "/assets/images/notification-status.svg",
                                t('settingsSectionsNotification')
                            )}{" "}
                            {menuBtn(
                                "language",
                                "/assets/images/language-square.svg",
                                t('commonLanguageRegion')
                            )}{" "}
                            {menuBtn(
                                "security",
                                "/assets/images/lock.svg",
                                t('commonSecurity')
                            )}{" "}
                            {menuBtn(
                                "terms",
                                "/assets/images/clipboard-text.svg",
                                t('commonTermsConditions')
                            )}{" "}
                            {menuBtn(
                                "privacy",
                                "/assets/images/security-user.svg",
                                t('commonPrivacyPolicy')
                            )}{" "}
                            {/* Logout item */}
                            <button
                                onClick={handleLogout}
                                className="menu-item text-red-600 "
                            >
                                <span className="flex items-center gap-3">
                                    <img src="/assets/images/logout.svg" alt="logout" />
                                    {t('commonLogout')}
                                </span>
                            </button>
                    </aside>{" "}
                        {/* Vertical divider between menu and content */}
                        <div className="hidden lg:block w-px bg-[#E6EAF3] self-stretch" />
                        {/* Content */}{" "}
                        <div className="flex-1 overflow-y-auto">
                            {" "}
                            {/* Profile Info */}
                            {section === "profile" && (
                                <form id="section-profile" className="text-sm h-[650px]" onSubmit={submitProfile} encType="multipart/form-data">
                                    <h2 className="text-lg font-bold text-gray-900">{t('settingsProfileSettingsTitle')}</h2>
                                    <hr className="mt-4 border-gray-200" />

                                    <div className="mt-6 rounded-t-[14px] border border-gray-200 border-b-0">
                                        <div className="px-6 py-4 border-b border-gray-200">
                                            <h3 className="text-base font-bold text-gray-900">{t('settingsPersonalDetails')}</h3>
                                        </div>
                                        <div className="p-4">
                                            {/* Avatar upload */}
                                            <div className="mt-3 flex items-center gap-4">
                                            <label className="relative cursor-pointer">
                                                <input
                                                ref={fileRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleAvatarChange}
                                                />

                                                <div className="w-16 h-16 rounded-full overflow-hidden border border-[#E5E7EB]">
                                                <img
                                                    src={avatarPreview}
                                                    alt="Avatar preview"
                                                    className="w-full h-full object-cover"
                                                />
                                                </div>

                                                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#338dff] text-white grid place-items-center text-xs">
                                                +
                                                </span>
                                            </label>

                                            <div className="flex flex-col">
                                                <p className="text-lg font-bold text-[#0C0C0C]">{t('settingsProfileUploadPhoto')}</p>
                                                <p className="text-base font-normal text-slate-500">{t('settingsProfilePhotoHint')}</p>
                                                {errors.avatar && (
                                                <p className="text-xs text-red-500 mt-1">{translateFieldError('avatar', errors.avatar)}</p>
                                                )}
                                            </div>
                                            </div>

                                            {/* Inputs */}
                                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="mt-4 !mb-0">
                                                    <Input
                                                    label={t('settingsProfileYourName')}
                                                    type="text"
                                                    value={data.name}
                                                    onChange={(e) => setData('name', sanitizeTextInput(e.target.value))}
                                                    error={translateFieldError('name', errors.name)}
                                                    containerClassName="!mb-0"
                                                    />
                                                </div>
                                                <div>
                                                    {/* <label className="text-xs text-gray-500 mb-1 block">{t('commonCity') || 'City'}</label> */}
                                                    <div className="relative mt-4 !mb-0" ref={profileCityMenuRef}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowProfileCityMenu((prev) => !prev)}
                                                            className="w-full input-pill appearance-none pr-12 flex items-center justify-between text-left text-sm text-gray-700"
                                                        >
                                                            <span className="truncate">{profileCityLabel}</span>
                                                            <svg
                                                                className="ml-3 h-4 w-4 text-gray-400"
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
                                                        {showProfileCityMenu && (
                                                            <div className="absolute left-0 right-0 z-50 mt-2">
                                                                <Menu
                                                                    items={getCityOptions()}
                                                                    onItemClick={(item) => handleProfileCitySelect(item.value)}
                                                                    anchorRef={profileCityMenuRef}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    {/* <label className="text-xs text-gray-500 block mb-1">{t('commonEnterEmailAddress')}</label> */}
                                                    <Input
                                                        label={t('commonEmailAddress')}
                                                        type="email"
                                                        inputMode="email"
                                                        autoComplete="email"
                                                        className="w-full input-pill"
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
                                                        placeholder={t('commonEnterEmailAddress')}
                                                    />
                                                    {errors.email && <div className="text-xs text-red-500 mt-1">{translateFieldError('email', errors.email)}</div>}
                                                </div>
                                                <div>
                                                    {/* <label className="text-xs text-gray-500 block mb-1">{t('authForgotPasswordPhoneNumber')}</label> */}
                                                        <Input
                                                            label={ t('authForgotPasswordPhoneNumber')}
                                                            type="tel"
                                                            inputMode="tel"
                                                            autoComplete="tel"
                                                            className="flex-1 px-3 outline-none"
                                                            placeholder={t('commonPhonePlaceholder')}
                                                            value={formatPhoneForMask(data.phone_number)}
                                                            onChange={handlePhoneInputChange}
                                                        />
                                                    {errors.phone_number && (
                                                        <div className="text-xs text-red-500 mt-1">{translateFieldError('phone_number', errors.phone_number)}</div>
                                                    )}
                                                </div>

                                                <div className="md:col-span-2">
                                                    {/* <label className="text-xs text-gray-500 block mb-1">{t('commonAddress')}</label> */}
                                                    <Input
                                                        label={t('commonAddress')}
                                                        className="w-full input-pill"
                                                        value={data.address}
                                                        onChange={(e) => setData('address', sanitizeTextInput(e.target.value))}
                                                        placeholder={t('settingsProfilePlaceholdersAddress')}
                                                    />
                                                    {errors.address && <div className="text-xs text-red-500 mt-1">{translateFieldError('address', errors.address)}</div>}
                                                </div>
                                            </div>

                                            <hr className="my-6 border border-gray-200" />

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    {/* <label className="text-xs text-gray-500 block mb-1">{t('settingsProfileDateOfBirth')}</label> */}
                                                    <div className="relative">
                                                        <Input
                                                            label={t('settingsProfileDateOfBirth')}
                                                            type="date"
                                                            ref={dobInputRef}
                                                            className="w-full input-pill pr-12 bg-white text-sm outline-none appearance-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20"
                                                            value={data.dob || ''}
                                                            onChange={(e) => setData('dob', sanitizeTextInput(e.target.value))}
                                                            max={maxDob}
                                                        />
                                                        <div>
                                                            <button
                                                                type="button"
                                                                onClick={openDobPicker}
                                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                                aria-label={t('settingsAriaOpenDatePicker')}
                                                                >
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {errors.dob && <div className="text-xs text-red-500 mt-1">{translateFieldError('dob', errors.dob)}</div>}
                                                </div>
                                                <div>
                                                    {/* <label className="text-xs text-gray-500 block mb-1">{t('settingsProfileGender')}</label> */}
                                                    <div className="relative" ref={genderMenuRef}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowGenderMenu((prev) => !prev)}
                                                            className="w-full input-pill appearance-none pr-12 flex items-center justify-between text-left text-sm text-gray-700"
                                                        >
                                                            <span className="truncate">{genderLabel}</span>
                                                            <svg
                                                                className="ml-3 h-4 w-4 text-gray-400"
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
                                                        {showGenderMenu && (
                                                            <div className="absolute left-0 right-0 z-50 mt-2">
                                                                <Menu
                                                                    items={getGenderOptions()}
                                                                    onItemClick={(item) => handleGenderSelect(item.value)}
                                                                    anchorRef={genderMenuRef}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {errors.gender && <div className="text-xs text-red-500 mt-1">{translateFieldError('gender', errors.gender)}</div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end mt-6">
                                                <button
                                                disabled={processing}
                                                className="w-[140px] h-[60px] gap-[10px] px-[40px] py-[20px] font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none inline-flex items-center justify-center active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold mt-5"
                                                >
                                                {processing ? t('commonUpdating') : t('commonUpdate')}
                                                </button>
                                    </div>
                                </form>
                            )}
                            {/* Notification */}{" "}
                            {section === "notification" && (
                                <form id="section-notification" onSubmit={submitNotification}>
                                    <h2 className="text-xl font-semibold size-[18px]">{t('commonNotifications')}</h2>
                                    <div className="border-t border-[#E6EAF3] mt-3" />

                                    <div className="mt-6 space-y-8 text-base">
                                        {/* Email Notifications */}
                                        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                            <span className="text-gray-800 font-medium">{t('settingsNotificationEmailNotification')}</span>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={emailNotif}
                                                disabled={notificationProcessing}
                                                onClick={() => setEmailNotif(v => !v)}
                                                className={
                                                    'relative inline-flex h-7 w-12 items-center rounded-full transition-colors ' +
                                                    (emailNotif ? 'bg-[#338DFF]' : 'bg-gray-300') +
                                                    (notificationProcessing ? ' opacity-60 cursor-wait' : '')
                                                }
                                            >
                                                <span
                                                className={
                                                    'inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ' +
                                                    toggleThumbClass(emailNotif)
                                                }
                                                />
                                            </button>
                                        </div>

                                        {/* Push Notifications */}
                                        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                            <span className="text-gray-800 font-medium">{t('settingsNotificationPushNotification')}</span>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={pushNotif}
                                                disabled={notificationProcessing}
                                                onClick={handlePushToggleChange}
                                                className={
                                                    'relative inline-flex h-7 w-12 items-center rounded-full transition-colors ' +
                                                    (pushNotif ? 'bg-[#338DFF]' : 'bg-gray-300') +
                                                    (notificationProcessing ? ' opacity-60 cursor-wait' : '')
                                                }
                                            >
                                                <span
                                                className={
                                                    'inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ' +
                                                    toggleThumbClass(pushNotif)
                                                }
                                                />
                                            </button>
                                        </div>
                                        {pushNotificationError && (
                                            <p className={`text-xs text-red-500 ${isRTL ? 'text-right' : ''}`}>{pushNotificationError}</p>
                                        )}
                                    </div>

                                    <div className="mt-20 flex justify-end">
                                        <button type="submit" disabled={notificationProcessing} className="min-w-[120px] h-[60px] gap-[10px] px-[28px] py-[20px] font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none inline-flex items-center justify-center active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold mt-5">
                                            {t('commonUpdate')}
                                        </button>
                                    </div>
                                </form>
                            )}{" "}
                            {/* Language */}{" "}
                            {section === "language" && (
                                <form id="section-language" onSubmit={submitLanguageUpdate}>
                                    <h2 className="text-xl font-semibold text-gray-800">{t('commonLanguageRegion')}</h2>
                                    <div className="border-t border-[#E6EAF3] mt-3" />

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                                        <div className="relative" ref={languageMenuRef}>
                                            <button
                                                type="button"
                                                onClick={() => setShowLanguageMenu((prev) => !prev)}
                                                className="w-full h-[52px] rounded-full border border-gray-200 px-4 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none appearance-none flex items-center justify-between text-left text-gray-700"
                                            >
                                                <span className="truncate">{languageLabel}</span>
                                                <svg
                                                    className="ml-3 h-4 w-4 text-gray-400"
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
                                            {showLanguageMenu && (
                                                <div className="absolute left-0 right-0 z-50 mt-2">
                                                    <Menu
                                                        items={getLanguageOptions()}
                                                        onItemClick={(item) => handleLanguageSelect(item.value)}
                                                        anchorRef={languageMenuRef}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative" ref={timezoneMenuRef}>
                                            <button
                                                type="button"
                                                onClick={() => setShowTimezoneMenu((prev) => !prev)}
                                                className="w-full h-[52px] rounded-full border border-gray-200 px-4 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none appearance-none flex items-center justify-between text-left text-gray-700"
                                            >
                                                <span className="truncate">{timezoneLabel}</span>
                                                <svg
                                                    className="ml-3 h-4 w-4 text-gray-400"
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
                                            {showTimezoneMenu && (
                                                <div className="absolute left-0 right-0 z-50 mt-2">
                                                    <Menu
                                                        items={getTimezoneOptions()}
                                                        onItemClick={(item) => handleTimezoneSelect(item.value)}
                                                        anchorRef={timezoneMenuRef}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-20 flex justify-end">
                                        <button type="submit" className="w-[120px] h-[52px] gap-[10px] px-[40px] py-[20px] font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none inline-flex items-center justify-center active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold mt-5">{t('commonUpdate')}</button>
                                    </div>
                                </form>
                            )}{" "}
                            {/* Security */}{" "}
                            {section === "security" && (
                                <form id="section-security" onSubmit={submitPassword}>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                        {t('commonSecurity')}
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="relative md:col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1">
                                                {t('settingsSecurityCurrentPassword')}
                                            </label>
                                            <input
                                                type={showCurrentPass ? "text" : "password"}
                                                value={passwordForm.data.current_password}
                                                onChange={(e) => passwordForm.setData('current_password', sanitizeTextInput(e.target.value))}
                                                className="w-full h-[52px] rounded-full border border-gray-200 px-4 pr-12 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none"
                                                placeholder={t('settingsSecurityCurrentPassword')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPass((v) => !v)}
                                                className="absolute right-4 top-8 text-gray-400 hover:text-gray-600 mt-1"
                                                aria-label={t('commonTogglePassword')}
                                            >
                                                {showCurrentPass ? (
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
                                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18"></path></svg>
                                                )}
                                            </button>
                                            {passwordForm.errors.current_password && (
                                                <div className="text-xs text-red-500 mt-1">{translatePasswordError('current_password', passwordForm.errors.current_password)}</div>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <label className="text-xs text-gray-500 block mb-1">
                                                {t('settingsSecurityNewPassword')}
                                            </label>
                                            <input
                                                type={showNewPass ? "text" : "password"}
                                                value={passwordForm.data.password}
                                                onChange={(e) => passwordForm.setData('password', sanitizeTextInput(e.target.value))}
                                                className="w-full h-[52px] rounded-full border border-gray-200 px-4 pr-12 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none"
                                                placeholder={t('settingsSecurityNewPassword')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPass((v) => !v)}
                                                className="absolute right-4 top-8 text-gray-400 hover:text-gray-600 mt-1"
                                                aria-label={t('commonTogglePassword')}
                                            >
                                                {showNewPass ? (
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
                                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18"></path></svg>
                                                )}
                                            </button>
                                            {passwordForm.errors.password && (
                                                <div className="text-xs text-red-500 mt-1">{translatePasswordError('password', passwordForm.errors.password)}</div>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <label className="text-xs text-gray-500 block mb-1">
                                                {t('commonConfirmPassword')}
                                            </label>
                                            <input
                                                type={showConfirmPass ? "text" : "password"}
                                                value={passwordForm.data.password_confirmation}
                                                onChange={(e) => passwordForm.setData('password_confirmation', sanitizeTextInput(e.target.value))}
                                                className="w-full h-[52px] rounded-full border border-gray-200 px-4 pr-12 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none"
                                                placeholder={t('commonConfirmPassword')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPass((v) => !v)}
                                                className="absolute right-4 top-8 text-gray-400 hover:text-gray-600 mt-1"
                                                aria-label={t('commonTogglePassword')}
                                            >
                                                {showConfirmPass ? (
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
                                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18"></path></svg>
                                                )}
                                            </button>
                                            {passwordForm.errors.password_confirmation && (
                                                <div className="text-xs text-red-500 mt-1">{translatePasswordError('password_confirmation', passwordForm.errors.password_confirmation)}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-6">
                                        <button type="submit" disabled={passwordForm.processing} className="w-[180px] h-[52px] gap-[10px] py-[20px] font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none inline-flex items-center justify-center active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold mt-5">
                                            {passwordForm.processing ? t('commonUpdating') : t('settingsUpdatePassword')}
                                        </button>
                                    </div>
                                    {deleteAccountEnabled && (
                                        <div className="mt-10 max-w-[520px] rounded-2xl border border-red-100 bg-red-50 p-5">
                                            <h3 className="text-base font-semibold text-red-700">
                                                {t('settingsDeleteAccountSectionTitle')}
                                            </h3>
                                            <p className="mt-2 text-sm text-red-600">
                                                {t('settingsDeleteAccountDescription')}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleDeleteAccount}
                                                disabled={deleteAccountProcessing}
                                                className="mt-5 inline-flex h-[48px] min-w-[160px] items-center justify-center rounded-full border border-red-500 px-6 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {deleteAccountProcessing ? t('settingsDeletingAccount') : t('settingsDeleteAccountButton')}
                                            </button>
                                        </div>
                                    )}
                                </form>
                            )}{" "}
                            {/* Terms */}{" "}
                            {section === "terms" && <TermsSection />}{" "}
                            {/* Privacy */}{" "}
                            {section === "privacy" && (
                                <div id="section-privacy">
                                    {" "}
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                        {t('commonPrivacyPolicy')}
                                    </h2>{" "}
                                    <div className="border-t border-gray-200 pt-6 space-y-6 text-sm text-gray-700 leading-relaxed">
                                        {" "}
                                        <div>
                                            {" "}
                                            <h3 className="font-bold text-sm text-gray-900 mb-4 border-b border-gray-200 space-y-6">
                                                {t('settingsPrivacyIntroduction')}
                                            </h3>{" "}
                                            <p>
                                                {t('settingsPrivacyIntroductionContent')}
                                            </p>{" "}
                                        </div>{" "}
                                        <div>
                                            {" "}
                                            <h3 className="font-bold text-sm text-gray-900 mb-4 border-b border-gray-200 space-y-6">
                                                {t('settingsPrivacyCollectionTitle')}
                                            </h3>{" "}
                                            <ul className="list-disc ml-6 mt-1">
                                                {" "}
                                                <li>
                                                    {t('settingsPrivacyCollectionPersonal')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyCollectionId')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyCollectionBooking')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyCollectionPayment')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyCollectionUsage')}
                                                </li>{" "}
                                            </ul>{" "}
                                        </div>{" "}
                                        <div>
                                            {" "}
                                            <h3 className="font-bold text-sm text-gray-900 mb-4 border-b border-gray-200 space-y-6">
                                                {t('settingsPrivacyUseTitle')}
                                            </h3>{" "}
                                            <ul className="list-disc ml-6 mt-1">
                                                {" "}
                                                <li>
                                                    {t('settingsPrivacyUseProcess')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyUseCommunicate')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyUseVerify')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyUseImprove')}
                                                </li>{" "}
                                                <li>
                                                    {t('settingsPrivacyUseEnsure')}
                                                </li>{" "}
                                            </ul>{" "}
                                        </div>{" "}
                                        <div>
                                            {" "}
                                            <h3 className="font-bold text-sm text-gray-900 mb-4 border-b border-gray-200 space-y-6">
                                                {t('settingsPrivacyProtectionTitle')}
                                            </h3>{" "}
                                            <p>
                                                {t('settingsPrivacyProtectionContent')}
                                            </p>{" "}
                                        </div>{" "}
                                        <div>
                                            {" "}
                                            <h3 className="font-bold text-sm text-gray-900 mb-4 border-b border-gray-200 space-y-6">
                                                {t('settingsPrivacyRightsTitle')}
                                            </h3>{" "}
                                            <ul className="list-disc ml-6 mt-1">
                                                <li>{t('settingsPrivacyRightsView')}</li>
                                                <li>{t('settingsPrivacyRightsRequest')}</li>
                                                <li>
                                                    {t('settingsPrivacyRightsContact')}{' '}
                                                    <a href={`mailto:${t('settingsPrivacyRightsEmail')}`} className="underline">
                                                        {t('settingsPrivacyRightsEmail')}
                                                    </a>
                                                </li>
                                            </ul>{" "}
                                        </div>{" "}
                                        <div>
                                            {" "}
                                            <h3 className="font-bold text-sm text-gray-900 mb-4 border-b border-gray-200 space-y-6">
                                                {t('settingsPrivacyChangesTitle')}
                                            </h3>{" "}
                                            <p>
                                                {t('settingsPrivacyChangesContent')}
                                            </p>{" "}
                                        </div>{" "}
                                    </div>{" "}
                                </div>
                            )}{" "}
                        </div>{" "}
                    </div>{" "}
                </section>{" "}
                </div>
            </main>{" "}
            {notificationProcessing && (
                <div className="block md:hidden">
                    <NotificationPreferenceLoadingOverlay label={t('commonUpdating')} />
                </div>
            )}
            {showDeleteAccountConfirm && (
                <Popup
                    title={t('settingsDeleteAccountSectionTitle')}
                    message={t('settingsDeleteAccountConfirmMessage')}
                    buttonLabel={t('commonDelete')}
                    secondaryButtonLabel={t('commonCancel')}
                    onConfirm={confirmDeleteAccount}
                    onSecondaryConfirm={() => setShowDeleteAccountConfirm(false)}
                    showIcon={false}
                    loopAnimation={false}
                    showCloseButton
                    onClose={() => setShowDeleteAccountConfirm(false)}
                    closeOnOverlayClick
                />
            )}
            {showPasswordSuccess && (
                <Popup
                    title={t('settingsPasswordSuccessTitle')}
                    message={t('settingsPasswordSuccessMessage')}
                    buttonLabel={t('commonGreat')}
                    onConfirm={() => setShowPasswordSuccess(false)}
                />
            )}
            {showProfileSuccess && (
                <Popup
                    title={t('settingsProfileSuccessTitle')}
                    message={t('settingsProfileSuccessMessage')}
                    buttonLabel={t('commonGreat')}
                    onConfirm={() => setShowProfileSuccess(false)}
                />
            )}
            {showLanguageSuccess && (
                <Popup
                    title={t('settingsLanguageSuccessTitle')}
                    message={t('settingsLanguageSuccessMessage')}
                    buttonLabel={t('commonGreat')}
                    onConfirm={() => setShowLanguageSuccess(false)}
                />
            )}
            {showNotificationSuccess && (
                <Popup
                    title={t('settingsNotificationSuccessTitle')}
                    message={t('settingsNotificationSuccessMessage')}
                    buttonLabel={t('commonGreat')}
                    onConfirm={() => setShowNotificationSuccess(false)}
                />
            )}
        </div>
    );
}
