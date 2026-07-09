import React, { useEffect, useRef, useState } from 'react';
import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../Contexts/LanguageContext';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import SuperAdminAuthenticated from '../Layouts/SuperAdminAuthenticated';
import PrimaryButton from './Components/PrimaryButton';
import Menu from '../../Components/Common/Menu';
import Input from '../../Components/Common/Inputs/Input';
import Popup from './Components/Popup';
import IMask from 'imask';

const PHONE_PREFIX = '+963';
const PHONE_PREFIX_DIGITS = '963';
const PHONE_MASK_PATTERN = '000 000 000';

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
    if (!subscriber) return '';
    return subscriber;
};

const GOVERNORATE_OPTIONS = [
    { labelKey: 'settingsSelectGovernorate', value: '' },
    { labelKey: 'settingsProfileCitiesAleppo', value: 'Aleppo' },
    { labelKey: 'settingsProfileCitiesDamascus', value: 'Damascus' },
    { labelKey: 'settingsProfileCitiesHoms', value: 'Homs' },
];

const FALLBACK_AVATAR = 'https://i.pravatar.cc/100?img=32';

const DEFAULT_FINANCIAL_SETTINGS = {
    vat_type: 'Fixed Amount',
    vat_value: '10,000',
    door_service_fee: '3,000',
    direct_service_fee: '20,000',
    indirect_service_fee: '10,000',
    platform_fee: '5,000',
    insurance_type: 'Percentage of declared value',
    insurance_value: '2',
    insurance_compensation_value: '10,000',
    insurance_min_amount: '10,000',
    insurance_max_amount: '50,000',
    delete_account_enabled: false,
};

const FINANCIAL_SECTION_FIELDS = {
    vat: ['vat_type', 'vat_value'],
    platformFee: ['platform_fee'],
    serviceFees: ['door_service_fee', 'direct_service_fee', 'indirect_service_fee'],
    insurance: [
        'insurance_type',
        'insurance_value',
        'insurance_compensation_value',
        'insurance_min_amount',
        'insurance_max_amount',
    ],
    account: ['delete_account_enabled'],
};

const normalizeFinancialSettings = (settings = {}) => {
    const normalized = { ...DEFAULT_FINANCIAL_SETTINGS };

    Object.entries(settings || {}).forEach(([key, value]) => {
        if (Object.prototype.hasOwnProperty.call(normalized, key) && value !== undefined && value !== null) {
            normalized[key] = value;
        }
    });

    normalized.delete_account_enabled = Boolean(normalized.delete_account_enabled);

    return normalized;
};

const hasEditorHtml = (value = '') => /<\/?[a-z][\s\S]*>/i.test(value);

const escapeEditorHtml = (value = '') =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const plainTextToEditorHtml = (value = '') => {
    const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();

    if (!text || hasEditorHtml(text)) {
        return value ?? '';
    }

    return text
        .split(/\n{2,}/)
        .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
        .filter((lines) => lines.length > 0)
        .map((lines, index) => {
            if (index === 0 || lines.length === 1) {
                return lines.map((line) => `<p>${escapeEditorHtml(line)}</p>`).join('');
            }

            return [
                `<h2>${escapeEditorHtml(lines[0])}</h2>`,
                ...lines.slice(1).map((line) => `<p>${escapeEditorHtml(line)}</p>`),
            ].join('');
        })
        .join('');
};

const normalizeTermsSettings = (settings = {}) => ({
    en: {
        title: settings?.en?.title ?? '',
        body: plainTextToEditorHtml(settings?.en?.body ?? ''),
    },
    ar: {
        title: settings?.ar?.title ?? '',
        body: plainTextToEditorHtml(settings?.ar?.body ?? ''),
    },
});

const sanitizeTextInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
        .replace(/[\u2600-\u27BF]/g, '')
        .replace(/[\uFE0F\u200D]/g, '');
};

// Strictly allow only characters valid in typical emails
// Blocks emojis and other unicode symbols proactively
const sanitizeEmailInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    // allow letters, digits, dot, underscore, percent, plus, hyphen and '@'
    return normalized.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
};

const financialInputClasses =
    'border-[#E2E8F0] text-[#0F172A] focus:ring-2 focus:ring-[#338DFF] focus:border-transparent';

const FinancialInputField = ({
    label,
    value,
    onChange,
    suffix,
    type = 'text',
    inputMode = 'text',
    placeholder = '',
    error = null,
    disabled = false,
}) => (
    <Input
        label={label}
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        suffix={suffix}
        suffixClassName="text-[#94A3B8] top-1/2 -translate-y-1/2 "
        containerClassName="!mb-0"
        inputClassName={`${financialInputClasses} ${suffix ? 'pr-16' : ''}`}
        error={error}
        disabled={disabled}
    />
);

const FinancialSelectField = ({ label, value, onChange, options, error, disabled = false }) => {
    const [showMenu, setShowMenu] = React.useState(false);
    const triggerRef = React.useRef(null);
    const normalizedOptions = (options ?? []).map((option) =>
        typeof option === 'string' ? { label: option, value: option } : option
    );
    const selectedLabel =
        normalizedOptions.find((option) => option.value === value)?.label ?? '';

    React.useEffect(() => {
        if (!showMenu) return undefined;

        const handleClickOutside = (event) => {
            if (triggerRef.current && !triggerRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside, { passive: true });

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showMenu]);

    React.useEffect(() => {
        if (disabled) {
            setShowMenu(false);
        }
    }, [disabled]);

    const toggleMenu = () => {
        if (disabled) return;
        setShowMenu((prev) => !prev);
    };

    const handleSelect = (item) => {
        if (disabled) return;
        onChange(item.value);
        setShowMenu(false);
    };

    const handleKeyDown = (event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleMenu();
        }
    };

    return (
        <div className="relative">
            <div ref={triggerRef}>
                <Input
                    label={label}
                    value={selectedLabel}
                    onClick={toggleMenu}
                    onKeyDown={handleKeyDown}
                    readOnly
                    placeholder=""
                    disabled={disabled}
                    error={error}
                    containerClassName="!mb-0"
                    inputClassName={`${financialInputClasses} cursor-pointer`}
                    icon={
                        <svg
                            className={`w-4 h-4 transition-transform duration-200 ${
                                showMenu ? 'rotate-180' : ''
                            }`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
                                clipRule="evenodd"
                            />
                        </svg>
                    }
                    iconClassName="pointer-events-none text-gray-400"
                />
            </div>

            {showMenu && (
                <div className="absolute left-0 right-0 z-50 mt-2">
                    <Menu
                        items={normalizedOptions}
                        onItemClick={handleSelect}
                        anchorRef={triggerRef}
                    />
                </div>
            )}
        </div>
    );
};

const FinancialSectionCard = ({ title, description, isOpen, onToggle, children }) => (
    <div
        className={`rounded-[20px] border border-[#E2E8F0] ${
            isOpen ? 'bg-white' : 'bg-[#E9F3FF] overflow-hidden'
        }`}
    >
        <button
            type="button"
            onClick={onToggle}
            className={`w-full flex items-center justify-between px-6 py-4 focus:outline-none ${
                isOpen ? '' : 'bg-[#E9F3FF]'
            }`}
        >
            <h4 className="text-lg font-semibold text-[#0F172A]">{title}</h4>
            <svg
                className={`h-5 w-5 text-[#0F172A] transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                }`}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
        {isOpen && (
            <div className="border-t border-[#E2E8F0] px-6 pt-6 pb-6 space-y-6">
                {description && (
                    <p className="text-sm text-[#64748B] leading-relaxed">{description}</p>
                )}
                {children}
            </div>
        )}
    </div>
);

const EDITOR_ALLOWED_TAGS = new Set([
    'a',
    'b',
    'blockquote',
    'br',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'i',
    'li',
    'ol',
    'p',
    'strong',
    'u',
    'ul',
]);

const isSafeEditorUrl = (value = '') =>
    /^(https?:|mailto:|tel:|#|\/)/i.test(value.trim());

const sanitizeEditorHtml = (html = '') => {
    const raw = typeof html === 'string' ? html : String(html ?? '');

    if (typeof document === 'undefined') {
        return raw;
    }

    const template = document.createElement('template');
    template.innerHTML = raw;
    const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK']);

    const cleanNode = (node) => {
        Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                return;
            }

            if (child.nodeType !== Node.ELEMENT_NODE) {
                child.remove();
                return;
            }

            if (blockedTags.has(child.tagName)) {
                child.remove();
                return;
            }

            const tagName = child.tagName.toLowerCase();

            cleanNode(child);

            if (!EDITOR_ALLOWED_TAGS.has(tagName)) {
                child.replaceWith(...Array.from(child.childNodes));
                return;
            }

            Array.from(child.attributes).forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value;

                if (name.startsWith('on') || ['style', 'class', 'id'].includes(name)) {
                    child.removeAttribute(attribute.name);
                    return;
                }

                if (tagName !== 'a' || !['href', 'target', 'rel'].includes(name)) {
                    child.removeAttribute(attribute.name);
                    return;
                }

                if (name === 'href' && !isSafeEditorUrl(value)) {
                    child.removeAttribute(attribute.name);
                }
            });

            if (tagName === 'a' && child.getAttribute('href')) {
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
            }
        });
    };

    cleanNode(template.content);

    return template.innerHTML.trim();
};

const CK_TERMS_EDITOR_CONFIG = {
    toolbar: {
        items: [
            'heading',
            '|',
            'bold',
            'italic',
            'link',
            'bulletedList',
            'numberedList',
            '|',
            'outdent',
            'indent',
            'blockQuote',
            'insertTable',
            'undo',
            'redo',
        ],
        shouldNotGroupWhenFull: true,
    },
    heading: {
        options: [
            { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
            { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
            { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
            { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        ],
    },
    link: {
        addTargetToExternalLinks: true,
        defaultProtocol: 'https://',
    },
    table: {
        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
    },
};

const CkTermsEditor = ({ label, value, onChange, locale = 'en', error = null, disabled = false }) => {
    const isArabic = locale === 'ar';

    return (
        <div>
            <label className="mb-2 block text-sm font-medium text-[#0F172A]">{label}</label>
            <div className={`terms-ckeditor ${isArabic ? 'terms-ckeditor-rtl' : ''} ${disabled ? 'opacity-70 pointer-events-none' : ''}`}>
                <CKEditor
                    editor={ClassicEditor}
                    data={value ?? ''}
                    config={CK_TERMS_EDITOR_CONFIG}
                    disabled={disabled}
                    onChange={(event, editor) => onChange(editor.getData())}
                    onBlur={(event, editor) => onChange(sanitizeEditorHtml(editor.getData()))}
                    onReady={(editor) => {
                        const editable = editor.ui.view.editable.element;
                        editable.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
                    }}
                />
            </div>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            <style>{`
                .terms-ckeditor .ck-editor__editable_inline { min-height: 420px; font-size: 14px; line-height: 1.7; color: #0F172A; }
                .terms-ckeditor .ck.ck-editor__main > .ck-editor__editable { border-color: #E2E8F0; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; }
                .terms-ckeditor .ck.ck-toolbar { border-color: #E2E8F0; border-top-left-radius: 16px; border-top-right-radius: 16px; }
                .terms-ckeditor-rtl .ck-editor__editable_inline { direction: rtl; text-align: right; }
                .terms-ckeditor-rtl .ck-content ul,
                .terms-ckeditor-rtl .ck-content ol { padding-left: 0; padding-right: 1.5rem; }
            `}</style>
        </div>
    );
};

export default function Settings({
    profile = {},
    permissions = {},
    financialSettings: initialFinancialSettings = {},
    termsSettings: initialTermsSettings = {},
    accountSettings = {},
    language = 'en',
}) {
    const { t } = useTranslation();
    const { currentLanguage, changeLanguage, isRTL } = useLanguage();
    const { auth } = usePage().props;

    // Determine which tabs are available based on permissions
    const canUpdateProfile = permissions.canUpdateProfile ?? false;
    const canUpdatePassword = permissions.canUpdatePassword ?? false;

    // Set initial active tab to the first available tab
    const getInitialTab = () => {
        if (canUpdateProfile) return 'profile';
        if (canUpdatePassword) return 'security';
        return 'financial'; // fallback to financial settings tab
    };

    const [activeTab, setActiveTab] = useState(getInitialTab());
    const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url ?? FALLBACK_AVATAR);
    const [showGovernorateMenu, setShowGovernorateMenu] = useState(false);
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);
    const [showLanguageSuccess, setShowLanguageSuccess] = useState(false);
    const avatarInputRef = useRef(null);
    const governorateMenuRef = useRef(null);
    const governorateMenuTriggerRef = useRef(null);
    const languageMenuRef = useRef(null);
    const phoneInputRef = useRef(null);
    const phoneMaskRef = useRef(null);
    const [financialSectionsOpen, setFinancialSectionsOpen] = useState({
        vat: true,
        platformFee: true,
        serviceFees: true,
        insurance: true,
        account: true,
    });
    const [showFinancialSuccess, setShowFinancialSuccess] = useState(false);
    const [financialSavingSection, setFinancialSavingSection] = useState(null);

    const isSavingSection = (sectionKey) => financialSavingSection === sectionKey;

    const resolvedProfileData = {
        name: profile.name ?? auth?.user?.name ?? '',
        email: profile.email ?? auth?.user?.email ?? '',
        avatarUrl: profile.avatar_url ?? auth?.user?.avatar_url ?? FALLBACK_AVATAR,
    };

    const profileForm = useForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
        phone_number: profile.phone_number ?? '',
        governorate: profile.governorate ?? 'Aleppo',
        avatar: null,
    });

    const governorateOptions = GOVERNORATE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
    }));
    const selectedGovernorateLabel =
        governorateOptions.find((item) => item.value === profileForm.data.governorate)?.label ??
        t('settingsSelectGovernorate');

    const passwordForm = useForm({
        current_password: '',
        password: '',
    });

    const [languageValue, setLanguageValue] = useState(language === 'ar' ? 'ar_SY' : 'en_US');

    const buildSettingsPayload = (financialSettings = initialFinancialSettings, account = accountSettings) => ({
        ...(financialSettings ?? {}),
        delete_account_enabled: Boolean(account?.delete_account_enabled),
    });

    const financialForm = useForm(normalizeFinancialSettings(buildSettingsPayload()));
    const [financialData, setFinancialData] = useState(normalizeFinancialSettings(buildSettingsPayload()));
    const termsForm = useForm(normalizeTermsSettings(initialTermsSettings));

    // Dynamic language options based on translations
    const getLanguageOptions = () => [
        { label: t('settingsLanguageLanguagesEnUS'), value: 'en_US', lang: 'en' },
        { label: t('settingsLanguageLanguagesArSY'), value: 'ar_SY', lang: 'ar' },
    ];

    const languageLabel =
        getLanguageOptions().find((option) => option.value === languageValue)?.label ?? getLanguageOptions()[0].label;

    // Handle language change
    const handleLanguageSelect = (value) => {
        setLanguageValue(value);
        setShowLanguageMenu(false);
    };

    const submitLanguageUpdate = (event) => {
        event.preventDefault();
        const lang = languageValue === 'ar_SY' ? 'ar' : 'en';

        router.put(route('admin.settings.language'), {
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

    // Phone mask management
    const updateMaskValue = (mask, value) => {
        if (!mask) return;
        const formatted = formatPhoneForMask(value);
        if (mask.value !== formatted) {
            mask.value = formatted;
        }
    };

    const initOrUpdatePhoneMask = () => {
        const input = phoneInputRef.current;
        const existing = phoneMaskRef.current;

        if (!input && existing) {
            existing.destroy();
            phoneMaskRef.current = null;
            return;
        }

        if (input && !existing) {
            const mask = IMask(input, {
                mask: PHONE_MASK_PATTERN,
                lazy: false,
                overwrite: true,
            });
            mask.on('accept', () => {
                const subscriberDigits = extractSubscriberDigits(mask.value);
                const nextValue = subscriberDigits ? `${PHONE_PREFIX}${subscriberDigits}` : '';
                profileForm.setData('phone_number', nextValue);
            });
            phoneMaskRef.current = mask;
            updateMaskValue(mask, profileForm.data.phone_number);
            return;
        }

        if (input && existing) {
            updateMaskValue(existing, profileForm.data.phone_number);
        }
    };

    useEffect(() => {
        if (activeTab !== 'profile') {
            if (phoneMaskRef.current) {
                phoneMaskRef.current.destroy();
                phoneMaskRef.current = null;
            }
            return;
        }

        initOrUpdatePhoneMask();

        return () => {
            if (phoneMaskRef.current) {
                phoneMaskRef.current.destroy();
                phoneMaskRef.current = null;
            }
        };
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'profile' && phoneMaskRef.current) {
            updateMaskValue(phoneMaskRef.current, profileForm.data.phone_number);
        }
    }, [activeTab, profileForm.data.phone_number]);

    useEffect(() => {
        setAvatarPreview(profile.avatar_url ?? FALLBACK_AVATAR);
    }, [profile.avatar_url]);

    useEffect(() => {
        profileForm.setData((data) => ({
            ...data,
            name: profile.name ?? '',
            email: profile.email ?? '',
            phone_number: profile.phone_number ?? '',
            governorate: profile.governorate ?? 'Aleppo',
        }));
    }, [profile.name, profile.email, profile.phone_number, profile.governorate]);

    useEffect(() => {
        if (!avatarPreview || !avatarPreview.startsWith('blob:')) {
            return undefined;
        }

        return () => {
            URL.revokeObjectURL(avatarPreview);
        };
    }, [avatarPreview]);

    useEffect(() => {
        if (!showGovernorateMenu && !showLanguageMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            const governorateContainer = governorateMenuRef.current;
            const languageContainer = languageMenuRef.current;
            
            if (governorateContainer && !governorateContainer.contains(event.target)) {
                setShowGovernorateMenu(false);
            }
            if (languageContainer && !languageContainer.contains(event.target)) {
                setShowLanguageMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside, { passive: true });

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showGovernorateMenu, showLanguageMenu]);

    useEffect(() => {
        const normalized = normalizeFinancialSettings(buildSettingsPayload(initialFinancialSettings, accountSettings));
        financialForm.setData(() => normalized);
        setFinancialData(normalized);
        if (typeof financialForm.setDefaults === 'function') {
            financialForm.setDefaults(normalized);
        }
    }, [initialFinancialSettings, accountSettings?.delete_account_enabled]);

    useEffect(() => {
        const normalized = normalizeTermsSettings(initialTermsSettings);
        termsForm.setData(() => normalized);
        if (typeof termsForm.setDefaults === 'function') {
            termsForm.setDefaults(normalized);
        }
    }, [initialTermsSettings]);

    const handleGovernorateSelect = (value) => {
        profileForm.setData('governorate', value);
        if (profileForm.clearErrors && profileForm.errors.governorate) {
            profileForm.clearErrors('governorate');
        }
        setShowGovernorateMenu(false);
    };

    const handleAvatarChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        profileForm.setData('avatar', file);
        setAvatarPreview((prev) => {
            if (prev && prev.startsWith('blob:')) {
                URL.revokeObjectURL(prev);
            }
            return URL.createObjectURL(file);
        });
    };

    const submitProfile = (event) => {
        event.preventDefault();

        profileForm.transform((data) => ({
            ...data,
            _method: 'put',
        }));

        profileForm.post(route('admin.settings.profile'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                profileForm.setData('avatar', null);
                if (avatarInputRef.current) {
                    avatarInputRef.current.value = '';
                }
            },
        });
    };

    const submitPassword = (event) => {
        event.preventDefault();

        passwordForm.transform((data) => ({
            ...data,
            _method: 'put',
        }));

        passwordForm.post(route('admin.settings.password'), {
            preserveScroll: true,
            onSuccess: () => {
                passwordForm.reset('current_password', 'password');
            },
        });
    };

    const transformFinancialPayload = (data) =>
        Object.entries(data).reduce((acc, [key, value]) => {
            acc[key] = typeof value === 'string' ? value.trim() : value ?? '';
            return acc;
        }, {});

    const getSectionPayload = (sectionKey) => {
        const fields = FINANCIAL_SECTION_FIELDS[sectionKey] ?? [];
        return fields.reduce((acc, field) => {
            acc[field] = financialData[field];
            return acc;
        }, {});
    };

    const applyFinancialUpdates = (updates) => {
        setFinancialData((prev) => ({
            ...prev,
            ...updates,
        }));
        financialForm.setData((data) => ({
            ...data,
            ...updates,
        }));

        if (typeof financialForm.setDefaults === 'function') {
            const currentDefaults =
                (financialForm.defaults && typeof financialForm.defaults === 'object'
                    ? financialForm.defaults
                    : {});
            financialForm.setDefaults({
                ...currentDefaults,
                ...updates,
            });
        }
    };

    const updateFinancialSetting = (field, value) => {
        setFinancialData((prev) => ({
            ...prev,
            [field]: value,
        }));

        if (financialForm.errors[field]) {
            financialForm.clearErrors(field);
        }
    };

    const toggleFinancialSection = (section) => {
        setFinancialSectionsOpen((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const submitFinancialSettings = (sectionKey) => {
        if (financialSavingSection || financialForm.processing) {
            return;
        }

        const sectionData = getSectionPayload(sectionKey);
        const payload = transformFinancialPayload(sectionData);

        if (Object.keys(payload).length === 0) {
            return;
        }

        setFinancialSavingSection(sectionKey);

        financialForm.transform(() => payload);
        financialForm.put(route('admin.settings.financial'), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                applyFinancialUpdates(payload);
                setShowFinancialSuccess(true);
            },
            onFinish: () => {
                financialForm.transform((data) => data);
                setFinancialSavingSection(null);
            },
        });
    };

    const updateTermsField = (locale, field, value) => {
        termsForm.setData((data) => ({
            ...data,
            [locale]: {
                ...(data[locale] ?? {}),
                [field]: value,
            },
        }));

        const errorKey = `${locale}.${field}`;
        if (termsForm.errors[errorKey]) {
            termsForm.clearErrors(errorKey);
        }
    };

    const submitTermsSettings = (event) => {
        event.preventDefault();

        const payload = {
            en: {
                title: termsForm.data.en?.title ?? '',
                body: sanitizeEditorHtml(termsForm.data.en?.body ?? ''),
            },
            ar: {
                title: termsForm.data.ar?.title ?? '',
                body: sanitizeEditorHtml(termsForm.data.ar?.body ?? ''),
            },
        };

        termsForm.transform(() => payload);
        termsForm.put(route('admin.settings.terms'), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                termsForm.setData(() => payload);
            },
            onFinish: () => {
                termsForm.transform((data) => data);
            },
        });
    };

    const tabLabelClasses = (tab) =>
        `text-base font-bold ${activeTab === tab ? 'text-blue-500' : 'text-[#0F172A]'}`;


    const vatAmountOptions = [
        { label: t('settingsFinancialFixedAmount'), value: 'Fixed Amount' },
        { label: t('settingsFinancialPercentage'), value: 'Percentage' },
    ];
    const insuranceTypeOptions = [
        { label: t('settingsFinancialPercentageDeclaredValue'), value: 'Percentage of declared value' },
        { label: t('settingsFinancialFixedAmount'), value: 'Fixed Amount' },
    ];

    const headerContent = (
        <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-[#0f172a]">{t('commonSettings')}</h1>
            <nav className="flex items-center gap-2 text-sm  text-blue-500">
                <span>{t('commonHome')}</span>
                <span className="text-slate-500">&gt;</span>
                <span className="font-medium text-[#64748b]">{t('commonSettings')}</span>
            </nav>
        </div>
    );

    const tabHeadingMap = {
        profile: t('settingsProfileSettingsTitle'),
        financial: t('settingsFinancialIconAlt'),
        terms: t('commonTermsConditions'),
        security: t('commonSecurity'),
        language: t('settingsLanguageSettingsTitle'),
    };

    const activeTabHeading = tabHeadingMap[activeTab] ?? t('commonSettings');

    return (
        <SuperAdminAuthenticated headerContent={headerContent} profileData={resolvedProfileData}>
            <Head title={t('commonSettings')} />

            <div className="space-y-6">
                <section className=" rounded-[14px] p-4 md:p-6 ">
                    <div className="grid grid-cols-12 gap-0 md:gap-0 bg-white p-[30px] rounded-[15px] ">
                        {/* Tabs Navigation */}
                    <aside className="col-span-12 md:col-span-4 lg:col-span-3 pr-6 md:pr-8 border-r border-[#E5E7EB]">
                        <div className="bg-white overflow-hidden flex flex-col gap-5">
                            {/* Profile / Company Info - Only show if user can update profile */}
                            {canUpdateProfile && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('profile')}
                                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${
                                        activeTab === 'profile'
                                            ? 'bg-[#f2f2f2] text-blue-500'
                                            : 'hover:bg-[#F8FAFC] text-gray-500'
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-3">
                                        <span className="w-5 h-5 grid place-items-center">
                                            <img
                                                src="/assets/images/user-edit.svg"
                                                alt={t('commonProfile')}
                                                className={`w-5 h-5 transition-all duration-200 ${
                                                    activeTab === 'profile' ? 'filter-blue' : 'filter-black'
                                                }`}
                                            />
                                        </span>
                                        <span className={tabLabelClasses('profile')}>{t('settingsTabProfileCompanyInfo')}</span>
                                    </span>

                                    {activeTab === 'profile' && (
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
                                    )}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setActiveTab('financial')}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${
                                    activeTab === 'financial'
                                        ? 'bg-[#f2f2f2] text-blue-500'
                                        : 'hover:bg-[#F8FAFC] text-gray-500'
                                }`}
                            >
                                <span className="inline-flex items-center gap-3">
                                    <span className="w-5 h-5 grid place-items-center">
                                            <img
                                                src="/assets/images/dollar-circle.svg"
                                                alt={t('settingsFinancialIconAlt')}
                                                className={`w-5 h-5 transition-all duration-200 ${
                                                    activeTab === 'financial' ? 'filter-blue' : 'filter-black'
                                                }`}
                                            />
                                        </span>
                                    <span className={tabLabelClasses('financial')}>{t('settingsFinancialIconAlt')}</span>
                                </span>

                                {activeTab === 'financial' && (
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
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('terms')}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${
                                    activeTab === 'terms'
                                        ? 'bg-[#f2f2f2] text-blue-500'
                                        : 'hover:bg-[#F8FAFC] text-gray-500'
                                }`}
                            >
                                <span className="inline-flex items-center gap-3">
                                    <span className="w-5 h-5 grid place-items-center">
                                        <img
                                            src="/assets/images/clipboard-text.svg"
                                            alt={t('commonTermsConditions')}
                                            className={`w-5 h-5 transition-all duration-200 ${
                                                activeTab === 'terms' ? 'filter-blue' : 'filter-black'
                                            }`}
                                        />
                                    </span>
                                    <span className={tabLabelClasses('terms')}>{t('commonTermsConditions')}</span>
                                </span>

                                {activeTab === 'terms' && (
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
                                )}
                            </button>

                            {/* Security - Only show if user can update password */}
                            {canUpdatePassword && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('security')}
                                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${
                                        activeTab === 'security'
                                            ? 'bg-[#f2f2f2] text-blue-500'
                                            : 'hover:bg-[#F8FAFC] text-gray-500'
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-3">
                                        <span className="grid place-items-center">
                                            <img
                                                src="/assets/images/lock.svg"
                                                alt={t('commonSecurity')}
                                                className={`w-5 h-5 transition-all duration-200 ${
                                                    activeTab === 'security' ? 'filter-blue' : 'filter-black'
                                                }`}
                                            />
                                        </span>
                                        <span className={tabLabelClasses('security')}>{t('commonSecurity')}</span>
                                    </span>

                                    {activeTab === 'security' && (
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
                                    )}
                                </button>
                            )}

                            {/* Language */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('language')}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${
                                    activeTab === 'language'
                                        ? 'bg-[#f2f2f2] text-blue-500'
                                        : 'hover:bg-[#F8FAFC] text-gray-500'
                                }`}
                            >
                                <span className="inline-flex items-center gap-3">
                                    <img  
                                        src="/assets/images/language-square.svg" 
                                        className={`w-5 h-5 transition-all duration-200 ${ activeTab === 'language' ? "filter-blue" : "filter-black"}`} 
                                        alt={t('commonLanguage')} />
                                    <span className={tabLabelClasses('language')}>{t('commonLanguage')}</span>
                                </span>

                                {activeTab === 'language' && (
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
                                )}
                            </button>

                            {/* Logout */}
                            <div className="px-4 py-3">
                                <Link
                                    href={route('admin.logout')}
                                    method="post"
                                    as="button"
                                    type="button"
                                    className="inline-flex items-center gap-2 text-[#EF4444] text-base font-bold hover:opacity-80"
                                >
                                    <img
                                        src="/assets/images/logout.svg"
                                        alt={t('commonLogout')}
                                        className="w-4 h-4"
                                    />
                                    {t('commonLogout')}
                                </Link>
                            </div>
                        </div>
                    </aside>


                        {/* Right Content */}
                        <div className="col-span-12 md:col-span-8 lg:col-span-9">
                            <div className="bg-white rounded-[12px] md:min-h-[540px] pl-6 pr-6 md:pl-8 md:pr-10">
                                <div className="pb-4 mb-8 border-b border-[#E5E7EB]">
                                    <h2 className="text-xl font-semibold text-[#0F172A]">{activeTabHeading}</h2>
                                </div>

                                {activeTab === 'profile' && canUpdateProfile && (
                                    <form onSubmit={submitProfile} className="space-y-6">
                                        <div className="flex items-end justify-between pb-4 mb-4 border-b border-[#E5E7EB]">
                                            <div>
                                                <h3 className="font-semibold text-[#0F172A] ">{t('settingsAdminDetailsTitle')}</h3>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <div className="mt-3 flex items-center gap-4">
                                                <label className="relative cursor-pointer">
                                                    <input
                                                        ref={avatarInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={handleAvatarChange}
                                                    />

                                                    <div className="w-16 h-16 rounded-full overflow-hidden border border-[#E5E7EB]">
                                                        <img
                                                            src={avatarPreview}
                                                            alt={t('settingsAvatarPreviewAlt')}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#338dff] text-white grid place-items-center text-xs">
                                                        +
                                                    </span>
                                                </label>
                                                <div className="flex flex-col">
                                                    <p className="text-lg font-bold text-[#0C0C0C]">{t('settingsAdminUploadLogo')}</p>
                                                    <p className="text-base font-normal text-slate-500">{t('settingsProfilePhotoHint')}</p>
                                                </div>
                                                {profileForm.errors.avatar && (
                                                    <p className="text-xs text-red-500">{profileForm.errors.avatar}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4 pt-1">
                                            <Input
                                                label={t('commonFullName')}
                                                type="text"
                                                value={profileForm.data.name}
                                                onChange={(event) => {
                                                    const sanitizedValue = sanitizeTextInput(event.target.value);
                                                    profileForm.setData('name', sanitizedValue);
                                                }}
                                                placeholder=""
                                                error={profileForm.errors.name}
                                                containerClassName="!mb-0"
                                            />

                                            <div className="space-y-1">
                                                <div className="relative" ref={governorateMenuRef}>
                                                    <Input
                                                        ref={governorateMenuTriggerRef}
                                                        type="text"
                                                        label={t('commonGovernorate')}
                                                        value={profileForm.data.governorate ? selectedGovernorateLabel : ''}
                                                        readOnly
                                                        onClick={() => setShowGovernorateMenu((prev) => !prev)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                setShowGovernorateMenu((prev) => !prev);
                                                            }
                                                        }}
                                                        placeholder=""
                                                        error={profileForm.errors.governorate}
                                                        containerClassName="!mb-0"
                                                        inputClassName={`cursor-pointer text-sm ${
                                                            profileForm.data.governorate ? 'text-[#1f2937]' : 'text-gray-500'
                                                        }`}
                                                        icon={
                                                            <svg
                                                                className={`w-4 h-4 transition-transform duration-200 ${showGovernorateMenu ? 'rotate-180' : ''}`}
                                                                viewBox="0 0 20 20"
                                                                fill="currentColor"
                                                            >
                                                                <path
                                                                    fillRule="evenodd"
                                                                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
                                                                    clipRule="evenodd"
                                                                />
                                                            </svg>
                                                        }
                                                        iconClassName="pointer-events-none text-gray-400"
                                                        aria-haspopup="listbox"
                                                        aria-expanded={showGovernorateMenu}
                                                        aria-controls="governorate-menu"
                                                    />
                                                    {showGovernorateMenu && (
                                                        <div id="governorate-menu" className="absolute left-0 right-0 z-50 mt-2">
                                                            <Menu
                                                                items={governorateOptions}
                                                                onItemClick={(item) => handleGovernorateSelect(item.value)}
                                                                anchorRef={governorateMenuTriggerRef}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {profileForm.errors.governorate && (
                                                    <p className="mt-1 text-xs text-red-500">
                                                        {profileForm.errors.governorate}
                                                    </p>
                                                )}
                                            </div>

                                            <Input
                                                label={t('commonEmailAddress')}
                                                type="email"
                                                inputMode="email"
                                                autoComplete="email"
                                                value={profileForm.data.email}
                                                onChange={(event) => {
                                                    const sanitizedValue = sanitizeEmailInput(event.target.value);
                                                    profileForm.setData('email', sanitizedValue);
                                                }}
                                                onBeforeInput={(event) => {
                                                    const data = event.data ?? '';
                                                    if (/[^a-zA-Z0-9._%+\-@]/.test(data)) {
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
                                                        profileForm.setData('email', next);
                                                    }
                                                }}
                                                placeholder=""
                                                error={profileForm.errors.email}
                                                containerClassName="!mb-0"
                                            />

                                            <div className="relative">
                                                <span className="pointer-events-none absolute inset-y-0 left-6 z-10 flex items-center text-[#64748B]">
                                                    +963
                                                </span>
                                                <Input
                                                    ref={phoneInputRef}
                                                    type="text"
                                                    placeholder={t('settingsPhoneSubscriberPlaceholder')}
                                                    error={profileForm.errors.phone_number}
                                                    containerClassName="!mb-0"
                                                    inputClassName="pl-16 text-[#1f2937]"
                                                    labelClassName="!left-16"
                                                />
                                            </div>

                                        </div>

                                        <div className="pt-10 md:pt-16 pb-2">
                                            <div className="flex justify-end">
                                                <PrimaryButton
                                                    type="submit"
                                                    disabled={profileForm.processing}
                                                    text={profileForm.processing ? t('commonUpdating') : t('commonUpdate')}
                                                    width="140px"
                                                    height="60px"
                                                />
                                            </div>
                                        </div>
                                    </form>
                                )}

                                {activeTab === 'financial' && (
                                    <div className="space-y-5 pb-8">

                                        <FinancialSectionCard
                                            title={t('settingsFinancialVatConfiguration')}
                                            description={t('settingsFinancialVatDescription')}
                                            isOpen={financialSectionsOpen.vat}
                                            onToggle={() => toggleFinancialSection('vat')}
                                        >
                                            <div className="grid md:grid-cols-2 gap-5">
                                                <FinancialSelectField
                                                    label={t('settingsFinancialVatAmountType')}
                                                    value={financialData.vat_type}
                                                    onChange={(value) => updateFinancialSetting('vat_type', value)}
                                                    options={vatAmountOptions}
                                                    error={financialForm.errors.vat_type}
                                                    disabled={isSavingSection('vat')}
                                                />
                                                <FinancialInputField
                                                    label={t('settingsFinancialVatAmount')}
                                                    value={financialData.vat_value}
                                                    onChange={(value) => updateFinancialSetting('vat_value', value)}
                                                    suffix={financialData.vat_type === 'Percentage' ? '%' : t('commonCurrencySyp')}
                                                    inputMode="decimal"
                                                    error={financialForm.errors.vat_value}
                                                    disabled={isSavingSection('vat')}
                                                />
                                            </div>
                                            <div className="flex">
                                                <button
                                                    type="button"
                                                    onClick={() => submitFinancialSettings('vat')}
                                                    className={`text-base font-semibold transition-colors ${
                                                        isSavingSection('vat')
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-blue-500 hover:text-blue-600'
                                                    }`}
                                                    disabled={isSavingSection('vat')}
                                                >
                                                    {isSavingSection('vat') ? t('commonSaving') : t('commonSave')}
                                                </button>
                                            </div>
                                        </FinancialSectionCard>

                                        <FinancialSectionCard
                                            title={t('commonPlatformFee')}
                                            description={t('settingsFinancialPlatformFeeDescription')}
                                            isOpen={financialSectionsOpen.platformFee}
                                            onToggle={() => toggleFinancialSection('platformFee')}
                                        >
                                            <div className="grid md:grid-cols-2 gap-5">
                                                <FinancialInputField
                                                    label={t('commonPlatformFee')}
                                                    value={financialData.platform_fee}
                                                    onChange={(value) => updateFinancialSetting('platform_fee', value)}
                                                    suffix={t('commonCurrencySyp')}
                                                    inputMode="decimal"
                                                    error={financialForm.errors.platform_fee}
                                                    disabled={isSavingSection('platformFee')}
                                                />
                                            </div>
                                            <div className="flex">
                                                <button
                                                    type="button"
                                                    onClick={() => submitFinancialSettings('platformFee')}
                                                    className={`text-base font-semibold transition-colors ${
                                                        isSavingSection('platformFee')
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-blue-500 hover:text-blue-600'
                                                    }`}
                                                    disabled={isSavingSection('platformFee')}
                                                >
                                                    {isSavingSection('platformFee') ? t('commonSaving') : t('commonSave')}
                                                </button>
                                            </div>
                                        </FinancialSectionCard>

                                        {/* Service Fees section hidden per request. */}
                                        {/*
                                        <FinancialSectionCard
                                            title="Service Fees"
                                            description="Set base service fees for door, direct, and indirect deliveries."
                                            isOpen={financialSectionsOpen.serviceFees}
                                            onToggle={() => toggleFinancialSection('serviceFees')}
                                        >
                                            <div className="grid md:grid-cols-2 gap-5">
                                                <FinancialInputField
                                                    label="Door Service Fee"
                                                    value={financialData.door_service_fee}
                                                    onChange={(value) =>
                                                        updateFinancialSetting('door_service_fee', value)
                                                    }
                                                    suffix="SYP"
                                                    inputMode="decimal"
                                                    error={financialForm.errors.door_service_fee}
                                                    disabled={isSavingSection('serviceFees')}
                                                />
                                                <FinancialInputField
                                                    label="Direct Service Fee"
                                                    value={financialData.direct_service_fee}
                                                    onChange={(value) =>
                                                        updateFinancialSetting('direct_service_fee', value)
                                                    }
                                                    suffix="SYP"
                                                    inputMode="decimal"
                                                    error={financialForm.errors.direct_service_fee}
                                                    disabled={isSavingSection('serviceFees')}
                                                />
                                                <FinancialInputField
                                                    label="In-Direct Service Fee"
                                                    value={financialData.indirect_service_fee}
                                                    onChange={(value) =>
                                                        updateFinancialSetting('indirect_service_fee', value)
                                                    }
                                                    suffix="SYP"
                                                    inputMode="decimal"
                                                    error={financialForm.errors.indirect_service_fee}
                                                    disabled={isSavingSection('serviceFees')}
                                                />
                                            </div>
                                            <div className="flex">
                                                <button
                                                    type="button"
                                                    onClick={() => submitFinancialSettings('serviceFees')}
                                                    className={`text-base font-semibold transition-colors ${
                                                        isSavingSection('serviceFees')
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-blue-500 hover:text-blue-600'
                                                    }`}
                                                    disabled={isSavingSection('serviceFees')}
                                                >
                                                    {isSavingSection('serviceFees') ? 'Saving...' : 'Save'}
                                                </button>
                                            </div>
                                        </FinancialSectionCard>
                                        */}

                                        <FinancialSectionCard
                                            title={t('commonInsurance')}
                                            description={t('settingsFinancialInsuranceDescription')}
                                            isOpen={financialSectionsOpen.insurance}
                                            onToggle={() => toggleFinancialSection('insurance')}
                                        >
                                            <div className="grid md:grid-cols-2 gap-5">
                                                <FinancialSelectField
                                                    label={t('settingsFinancialInsuranceType')}
                                                    value={financialData.insurance_type}
                                                    onChange={(value) => updateFinancialSetting('insurance_type', value)}
                                                    options={insuranceTypeOptions}
                                                    error={financialForm.errors.insurance_type}
                                                    disabled={isSavingSection('insurance')}
                                                />
                                                <FinancialInputField
                                                    label={t('settingsFinancialInsuranceValue')}
                                                    value={financialData.insurance_value}
                                                    onChange={(value) =>
                                                        updateFinancialSetting('insurance_value', value)
                                                    }
                                                    suffix={
                                                        financialData.insurance_type === 'Fixed Amount' ? t('commonCurrencySyp') : '%'
                                                    }
                                                    inputMode="decimal"
                                                    error={financialForm.errors.insurance_value}
                                                    disabled={isSavingSection('insurance')}
                                                />
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-5">
                                                <FinancialInputField
                                                    label={t('settingsFinancialCompensationValue')}
                                                    value={financialData.insurance_compensation_value}
                                                    onChange={(value) =>
                                                        updateFinancialSetting('insurance_compensation_value', value)
                                                    }
                                                    suffix={t('commonCurrencySyp')}
                                                    inputMode="decimal"
                                                    error={financialForm.errors.insurance_compensation_value}
                                                    disabled={isSavingSection('insurance')}
                                                />
                                                <FinancialInputField
                                                    label={t('settingsFinancialMinimumInsuranceAmount')}
                                                    value={financialData.insurance_min_amount}
                                                    onChange={(value) =>
                                                        updateFinancialSetting('insurance_min_amount', value)
                                                    }
                                                    suffix={t('commonCurrencySyp')}
                                                    inputMode="decimal"
                                                    error={financialForm.errors.insurance_min_amount}
                                                    disabled={isSavingSection('insurance')}
                                                />
                                                <FinancialInputField
                                                    label={t('settingsFinancialMaximumInsuranceAmount')}
                                                    value={financialData.insurance_max_amount}
                                                    onChange={(value) =>
                                                        updateFinancialSetting('insurance_max_amount', value)
                                                    }
                                                    suffix={t('commonCurrencySyp')}
                                                    inputMode="decimal"
                                                    error={financialForm.errors.insurance_max_amount}
                                                    disabled={isSavingSection('insurance')}
                                                />
                                            </div>
                                            <div className="flex">
                                                <button
                                                    type="button"
                                                    onClick={() => submitFinancialSettings('insurance')}
                                                    className={`text-base font-semibold transition-colors ${
                                                        isSavingSection('insurance')
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-blue-500 hover:text-blue-600'
                                                    }`}
                                                    disabled={isSavingSection('insurance')}
                                                >
                                                    {isSavingSection('insurance') ? t('commonSaving') : t('commonSave')}
                                                </button>
                                            </div>
                                        </FinancialSectionCard>

                                        <FinancialSectionCard
                                            title={t('settingsAccountDeleteSectionTitle')}
                                            description={t('settingsAccountDeleteSectionDescription')}
                                            isOpen={financialSectionsOpen.account}
                                            onToggle={() => toggleFinancialSection('account')}
                                        >
                                            <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] px-4 py-4">
                                                <div className="pr-4">
                                                    <p className="text-sm font-semibold text-[#0F172A]">
                                                        {t('settingsAccountDeleteToggleLabel')}
                                                    </p>
                                                    <p className="mt-1 text-xs text-[#64748B]">
                                                        {t('settingsAccountDeleteToggleDescription')}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={Boolean(financialData.delete_account_enabled)}
                                                    onClick={() =>
                                                        updateFinancialSetting(
                                                            'delete_account_enabled',
                                                            !Boolean(financialData.delete_account_enabled)
                                                        )
                                                    }
                                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                                        financialData.delete_account_enabled ? 'bg-[#338DFF]' : 'bg-gray-300'
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                                                            isRTL
                                                                ? (financialData.delete_account_enabled
                                                                    ? '-translate-x-0.5'
                                                                    : '-translate-x-5')
                                                                : (financialData.delete_account_enabled
                                                                    ? 'translate-x-5'
                                                                    : 'translate-x-0.5')
                                                        }`}
                                                    />
                                                </button>
                                            </div>
                                            <div className="flex">
                                                <button
                                                    type="button"
                                                    onClick={() => submitFinancialSettings('account')}
                                                    className={`text-base font-semibold transition-colors ${
                                                        isSavingSection('account')
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-blue-500 hover:text-blue-600'
                                                    }`}
                                                    disabled={isSavingSection('account')}
                                                >
                                                    {isSavingSection('account') ? t('settingsFinancialSaving') : t('commonSave')}
                                                </button>
                                            </div>
                                        </FinancialSectionCard>
                                    </div>
                                )}

                                {activeTab === 'terms' && (
                                    <form onSubmit={submitTermsSettings} className="space-y-6 pb-8">
                                        <div className="pb-4 border-b border-[#E5E7EB]">
                                            <p className="text-sm text-[#64748B] leading-relaxed">
                                                {t('settingsTermsEditorDescription')}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                            {[
                                                ['en', t('settingsTermsEnglishContent')],
                                                ['ar', t('settingsTermsArabicContent')],
                                            ].map(([locale, label]) => (
                                                <div key={locale} className="rounded-[20px] border border-[#E2E8F0] bg-white p-5 space-y-4">
                                                    <h3 className="text-base font-semibold text-[#0F172A]">{label}</h3>
                                                    <Input
                                                        label={t('settingsTermsTitleLabel')}
                                                        type="text"
                                                        value={termsForm.data[locale]?.title ?? ''}
                                                        onChange={(event) => updateTermsField(locale, 'title', event.target.value)}
                                                        placeholder=""
                                                        error={termsForm.errors[`${locale}.title`]}
                                                        containerClassName="!mb-0"
                                                    />
                                                    <CkTermsEditor
                                                        label={t('settingsTermsBodyLabel')}
                                                        value={termsForm.data[locale]?.body ?? ''}
                                                        onChange={(value) => updateTermsField(locale, 'body', value)}
                                                        locale={locale}
                                                        disabled={termsForm.processing}
                                                        error={termsForm.errors[`${locale}.body`]}
                                                    />
                                                    <p className="text-xs text-[#64748B]">
                                                        {t('settingsTermsBodyHelp')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-end">
                                            <PrimaryButton
                                                type="submit"
                                                disabled={termsForm.processing}
                                                text={termsForm.processing ? t('commonSaving') : t('commonSave')}
                                                width="140px"
                                                height="60px"
                                            />
                                        </div>
                                    </form>
                                )}

                                {activeTab === 'security' && canUpdatePassword && (
                                    <form onSubmit={submitPassword} className="space-y-6">
                                        {/* <div className="pb-2 border-b border-[#E5E7EB]">
                                            <h3 className="text-xl font-semibold text-[#0C0C0C]">Security</h3>
                                        </div> */}

                                        <p className="text-lg font-semibold text-[#0C0C0C] border-b border-[#E5E7EB] pb-4">{t('settingsSecurityChangePassword')}</p>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <Input
                                                label={t('settingsSecurityCurrentPassword')}
                                                type="password"
                                                value={passwordForm.data.current_password}
                                                onChange={(event) => {
                                                    const sanitizedValue = sanitizeTextInput(event.target.value);
                                                    passwordForm.setData('current_password', sanitizedValue);
                                                }}
                                                placeholder=""
                                                error={passwordForm.errors.current_password}
                                                containerClassName="!mb-0"
                                                showPassword
                                            />

                                            <Input
                                                label={t('settingsSecurityNewPassword')}
                                                type="password"
                                                value={passwordForm.data.password}
                                                onChange={(event) => {
                                                    const sanitizedValue = sanitizeTextInput(event.target.value);
                                                    passwordForm.setData('password', sanitizedValue);
                                                }}
                                                placeholder=""
                                                error={passwordForm.errors.password}
                                                containerClassName="!mb-0"
                                                showPassword
                                            />
                                        </div>

                                        <div className="pt-10 pb-2">
                                            <div className="flex justify-end">
                                                <PrimaryButton
                                                    type="submit"
                                                    disabled={passwordForm.processing}
                                                    text={passwordForm.processing ? t('commonUpdating') : t('commonUpdate')}
                                                    width="133px"
                                                    height="60px"
                                                />
                                            </div>
                                        </div>
                                    </form>
                                )}

                                {activeTab === 'language' && (
                                    <form onSubmit={submitLanguageUpdate} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                                            <div className="relative" ref={languageMenuRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLanguageMenu((prev) => !prev)}
                                                    className="w-full h-[52px] rounded-full border border-gray-200 px-4 text-sm focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff]/20 outline-none appearance-none flex items-center justify-between text-left text-gray-700"
                                                >
                                                    <span className="truncate">{languageLabel}</span>
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
                                        </div>

                                        <div className="pt-10 pb-2">
                                            <div className="flex justify-end">
                                                <PrimaryButton
                                                    type="submit"
                                                    text={t('settingsLanguageSave')}
                                                    width="140px"
                                                    height="60px"
                                                />
                                            </div>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
            {/* {showFinancialSuccess && (
                <Popup
                    title="Financial Settings Updated"
                    message="Financial settings were saved successfully."
                    buttonLabel="Great!"
                    onConfirm={() => setShowFinancialSuccess(false)}
                />
            )} */}
        </SuperAdminAuthenticated>
    );
}
