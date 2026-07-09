import { useEffect, useState } from 'react';
import { useForm, Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthShell from '../../../Components/Customer/AuthShell';

// Sanitize email to block emojis, icons, and non-ASCII characters
const sanitizeEmailInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
};

const sanitizePhoneInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized.replace(/\D/g, '').slice(0, 12);
};

export default function ForgotPassword() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, clearErrors, transform } = useForm({
        email: '',
        phone_number: '',
    });
    const { flash = {} } = usePage().props;
    const [showSuccess, setShowSuccess] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState('email');

    useEffect(() => {
        if (flash?.success) {
            setShowSuccess(true);
        }
    }, [flash?.success]);

    const isPhoneSelected = deliveryMethod === 'phone_number';
    const activeValue = isPhoneSelected ? data.phone_number : data.email;
    const activeField = isPhoneSelected ? 'phone_number' : 'email';
    const activeError = isPhoneSelected ? (errors.phone_number || errors.email) : errors.email;
    const redirectQuery = isPhoneSelected
        ? `phone_number=${encodeURIComponent(data.phone_number)}`
        : `email=${encodeURIComponent(data.email)}`;

    const handleMethodChange = (method) => {
        setDeliveryMethod(method);
        clearErrors('email', 'phone_number');
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // transform((currentData) =>
        //     isPhoneSelected
        //         ? { phone_number: sanitizePhoneInput(currentData.phone_number) }
        //         : { email: sanitizeEmailInput(currentData.email) }
        // );

        post('/forgot-password', {
            onSuccess: (page) => {
                const successMessage = page.props.flash?.success;
                if (successMessage) {
                    setShowSuccess(true);
                    // Redirect after showing success message for 2 seconds
                    setTimeout(() => {
                        window.location.href = `/verify-reset-code?${redirectQuery}`;
                    }, 2000);
                }
            },
            onFinish: () => {
                transform((currentData) => currentData);
            }
        });
    };

    const rightContent = (
        <>
            <div className="flex justify-center md:mb-4 md:mt-10 mb-0 mt-12">
                <img src="/assets/images/Logo.svg" alt={t('commonLogoAlt')} />
            </div>

            <div className="mt-2 text-center">
                <h1 className="text-3xl font-semibold text-gray-900">{t('authForgotPasswordTitle')}</h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-500 md:max-w-[70%] mx-auto">
                    {t('authForgotPasswordSubtitle', {
                        deliveryTarget: isPhoneSelected ? t('authForgotPasswordPhoneNumber') : t('authForgotPasswordEmailAddress'),
                    })}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex-1 space-y-5">
                <div>
                    <div className="mx-auto flex w-full max-w-md rounded-full bg-[#eef4ff] p-1">
                        <button
                            type="button"
                            onClick={() => handleMethodChange('email')}
                            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                !isPhoneSelected
                                    ? 'bg-[#338DFF] text-white shadow-[0_10px_24px_rgba(48,111,255,0.25)]'
                                    : 'text-[#4f5f7a]'
                            }`}
                        >
                            {t('commonEmail')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleMethodChange('phone_number')}
                            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                isPhoneSelected
                                    ? 'bg-[#338DFF] text-white shadow-[0_10px_24px_rgba(48,111,255,0.25)]'
                                    : 'text-[#4f5f7a]'
                            }`}
                        >
                            {t('commonPhoneNumber')}
                        </button>
                    </div>
                </div>

                <div>
                    {isPhoneSelected ? (
                        <div className="flex w-full items-center rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 focus-within:ring-2 focus-within:ring-[#4c7bff]/70">
                            <span className="mr-2 font-medium text-gray-500">+</span>
                            <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={12}
                                placeholder={t('authForgotPasswordPhonePlaceholder')}
                                value={data.phone_number}
                                onChange={(e) => {
                                    setData('phone_number', sanitizePhoneInput(e.target.value));
                                    clearErrors('phone_number');
                                }}
                                className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                            />
                        </div>
                    ) : (
                        <input
                            type="email"
                            inputMode="email"
                            placeholder={t('commonEnterEmailAddress')}
                            value={activeValue}
                            onChange={(e) => {
                                setData(activeField, sanitizeEmailInput(e.target.value));
                                clearErrors(activeField);
                            }}
                            className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                        />
                    )}
                    {activeError && <div className="text-red-500 text-sm mt-1">{activeError}</div>}
                </div>

                <div className="pt-3">
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide shadow-[0_12px_30px_rgba(48,111,255,0.25)] hover:shadow-lg transition-shadow disabled:opacity-60"
                    >
                        {t('commonSubmit')}
                    </button>
                </div>
            </form>

            <div className="mt-4 text-center text-sm text-gray-500 mb-10">
                {t('authForgotPasswordRemembered')}
                <Link href="/login" className="ml-1 font-semibold text-[#3a70ff] hover:text-[#2154ff]">
                    {t('authForgotPasswordBackToLogin')}
                </Link>
            </div>
        </>
    );

    return (
        <>
            <div className="hidden lg:block">
                <AuthShell
                    rightContent={rightContent}
                    rightClassName="md:rounded-l-none md:rounded-r-[36px]"
                    />
            </div>
            <div className='px-5 lg:hidden sm:max-w-[70%] sm:mx-auto'>
                {rightContent}
            </div>

            {showSuccess && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                        <div className="w-full max-w-md bg-white rounded-[28px] px-10 py-12 text-center flex flex-col items-center gap-6 shadow-[0_20px_40px_rgba(14,34,64,0.35)]">
                            <div>
                                <h1 className="text-xl font-semibold text-[#3a70ff]">{t('authForgotPasswordSuccessTitle')}</h1>
                                <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                                    {flash.success}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => window.location.href = `/verify-reset-code?${redirectQuery}`}
                                className="mt-2 w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide hover:opacity-95 transition-opacity"
                            >
                                {t('commonContinue')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
