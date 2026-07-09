import React, { useEffect, useState } from "react";
import { useForm, Link, usePage } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import Popup from "../../SuperAdmin/Components/Popup";
import AuthShell from "../../../Components/Customer/AuthShell";
import Checkbox from "../../../Components/Common/Inputs/Checkbox";
import PWAInstallModal from "../../../Components/Customer/PWAInstallModal";

// Sanitize email to block emojis, icons, and non-ASCII characters
const sanitizeEmailInput = (value = "") => {
    const normalized = typeof value === "string" ? value : String(value ?? "");
    return normalized.replace(/[^a-zA-Z0-9._%+\-@]/g, "");
};

export default function Login() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        email: "",
        password: "",
        remember: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showMobileForm, setShowMobileForm] = useState(false);
    const { flash = {} } = usePage().props;
    const [showResetSuccess, setShowResetSuccess] = useState(false);
    const [showVerifiedSuccess, setShowVerifiedSuccess] = useState(false);
    const [showPWAInstall, setShowPWAInstall] = useState(false);

    useEffect(() => {
        if (flash?.success) {
            const msg = String(flash.success).toLowerCase();
            if (msg.includes("password")) setShowResetSuccess(true);
            if (msg.includes("verified")) setShowVerifiedSuccess(true);
        }
    }, [flash?.success]);

    useEffect(() => {
        const hasSeenPWAPrompt = localStorage.getItem("pwa-install-prompted");
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

        if (!isStandalone && !hasSeenPWAPrompt) {
            const timer = setTimeout(() => {
                setShowPWAInstall(true);

                localStorage.setItem("pwa-install-prompted", "true");

            }, 2000);

            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(min-width: 768px)");
        const handler = (e) => {
            if (e.matches) setShowMobileForm(false);
        };
        if (mq.matches) setShowMobileForm(false);
        if (mq.addEventListener) {
            mq.addEventListener("change", handler);
        } else if (mq.addListener) {
            mq.addListener(handler);
        }
        return () => {
            if (mq.removeEventListener) {
                mq.removeEventListener("change", handler);
            } else if (mq.removeListener) {
                mq.removeListener(handler);
            }
        };
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        post("/login");
    };

    const handleClosePWAModal = () => {
        setShowPWAInstall(false);
    };

    const desktopRightContent = (
        <>
            <div className="flex justify-center mb-4 mt-10">
                <img src="/assets/images/Logo.svg" alt={t('commonLogoAlt')} />
            </div>

            <div className="mt-2 text-center">
                <h1 className="text-3xl font-semibold text-gray-900">{t('authLoginTitle')}</h1>
                <p className="mt-3 leading-relaxed font-normal text-xl text-gray-500 md:max-w-[70%] mx-auto">
                    {t('authLoginSubtitle')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-12 flex-1 px-12 space-y-5">
                <div>
                    <input
                        type="text"
                        placeholder={t('authLoginEmailOrPhonePlaceholder')}
                        value={data.email}
                        onChange={(e) => setData("email", e.target.value)}
                        className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                    />
                    {errors.email && <div className="text-red-500 text-sm mt-1">{errors.email}</div>}
                    {/* {errors.phone_number && <div className="text-red-500 text-sm mt-1">{errors.phone_number}</div>} */}
                </div>

                <div>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder={t('authLoginPasswordPlaceholder')}
                            value={data.password}
                            onChange={(e) => setData("password", e.target.value)}
                            className="w-full rounded-full border border-gray-200 px-6 py-3 pr-14 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-5 text-gray-400 hover:text-gray-600"
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
                    {errors.password && <div className="text-red-500 text-sm mt-1">{errors.password}</div>}
                </div>

                <div className="flex items-center justify-between text-sm">
                    <Checkbox
                        checked={data.remember}
                        onChange={(e) => setData("remember", e.target.checked)}
                        label={t('authRememberMe')}
                        className="gap-3"
                        labelClassName="text-gray-600 text-sm"
                        checkboxClassName=""
                        toggleBackgroundClass="bg-gray-100 peer-checked:bg-blue-600"
                    />
                    <Link href="/forgot-password" className="text-[#3a70ff] font-medium hover:text-[#2154ff] transition-colors">
                        {t('authForgotPassword')}
                    </Link>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full font-medium rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center cursor-pointer shadow-[0_14px_34px_rgba(48,111,255,0.25)] active:scale-[0.98] bg-[#338DFF] text-white border border-transparent hover:bg-white hover:text-blue-500 hover:border-[#338DFF] focus:ring-[#338DFF] disabled:opacity-60 disabled:cursor-not-allowed py-3 px-10 text-sm font-semibold mt-5"
                    >
                        {t('authSignIn')}
                    </button>
                </div>
            </form>

            <div className="mt-8 text-center text-sm text-gray-500">
                {t('authLoginNoAccount')}
                <Link href="/register" className="ml-1 font-semibold text-[#3a70ff] hover:text-[#2154ff]">
                    {t('authLoginRegister')}
                </Link>
            </div>
        </>
    );

    const mobileCallToAction = (
        <div className="md:hidden absolute bottom-4 left-1/2 w-full max-w-md -translate-x-1/2 flex flex-col items-center space-y-2 bg-[#338DFF] p-6">
            <button
                onClick={() => setShowMobileForm(true)}
                className="w-full h-[48px] rounded-full bg-white text-blue-500 font-medium text-sm hover:bg-blue-50 transition"
            >
                {t('authLogin')}
            </button>
            <Link
                href="/register"
                className="w-full h-[48px] rounded-full border border-white text-white font-medium text-sm hover:bg-white hover:text-blue-500 transition flex items-center justify-center"
            >
                {t('authLoginGetStarted')}
            </Link>
        </div>
    );

    const mobileForm = (
        <section className="md:hidden relative w-full bg-transparent px-6 py-8 flex flex-col min-h-screen rounded-[36px]">
            <div className="mt-2">
                <h1 className="text-3xl leading-8 font-semibold text-gray-900">{t('authLoginTitle')}</h1>
                <p className="mt-3 text-sm leading-6 text-gray-500 max-w-[320px]">
                    {t('authLoginMobileSubtitle')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div className="rounded-full border border-gray-200 overflow-hidden flex items-center h-[48px] focus-within:ring-2 focus-within:ring-[#4c7bff]/70">
                    <input
                        type="email"
                        placeholder={t('authLoginMobileEmailPlaceholder')}
                        value={data.email}
                        onChange={(e) => setData("email", sanitizeEmailInput(e.target.value))}
                        className="flex-1 px-4 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none"
                    />
                </div>
                {errors.email && <div className="text-red-500 text-sm -mt-3">{errors.email}</div>}

                <div className="relative h-[48px]">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder={t('authLoginPasswordPlaceholder')}
                        value={data.password}
                        onChange={(e) => setData("password", e.target.value)}
                        className="w-full h-full rounded-full border border-gray-200 px-5 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-gray-600"
                        aria-label={t('authTogglePasswordVisibility')}
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
                {errors.password && <div className="text-red-500 text-sm -mt-3">{errors.password}</div>}

                <div className="flex items-center justify-between text-sm">
                    <Checkbox
                        checked={data.remember}
                        onChange={(e) => setData("remember", e.target.checked)}
                        label={t('authRememberMe')}
                        className="gap-3"
                        labelClassName="text-gray-600 text-sm"
                        checkboxClassName=""
                        toggleBackgroundClass="bg-gray-100 peer-checked:bg-blue-600"
                    />
                    <Link href="/forgot-password" className="text-[#3a70ff] font-medium hover:text-[#2154ff] transition-colors">
                        {t('authForgotPassword')}
                    </Link>
                </div>

                <div className="pt-1 mb-16">
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide shadow-[0_12px_30px_rgba(48,111,255,0.25)] hover:shadow-lg transition-shadow disabled:opacity-60"
                    >
                        {t('authLogin')}
                    </button>
                </div>
            </form>

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center text-md text-gray-500">
                {t('authLoginNoAccount')}<br/>
                <Link href="/register" className="ml-1 font-semibold text-blue-500 hover:text-[#2154ff]">
                    {t('authLoginRegister')}
                </Link>
            </div>
        </section>
    );

    return (
        <>
            <div className={`${showMobileForm ? "hidden md:block" : "block"}`}>
                <AuthShell
                    rightContent={desktopRightContent}
                    rightClassName="sm:px-10 sm:py-10 py-10 min-h-0 rounded-[36px] md:rounded-l-none md:rounded-r-[36px]"
                    hideRightSectionOnMobile
                    mobileContent={!showMobileForm ? mobileCallToAction : null}
                />
            </div>

            {showMobileForm && mobileForm}

            {showResetSuccess && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={() => setShowResetSuccess(false)}></div>
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                        <div className="w-full max-w-md bg-white rounded-[28px] px-10 py-12 text-center flex flex-col items-center gap-6 shadow-[0_20px_40px_rgba(14,34,64,0.35)]">
                            <div>
                                <h1 className="text-xl font-semibold text-[#3a70ff]">{t('authLoginPasswordResetTitle')}</h1>
                                <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                                    {t('authLoginPasswordResetMessage')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowResetSuccess(false)}
                                className="mt-2 w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide hover:opacity-95 transition-opacity"
                            >
                                {t('commonOkay')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showVerifiedSuccess && (
                <Popup
                    title={t('loginVerifiedTitle')}
                    message={t('loginVerifiedMessage')}
                    buttonLabel={t('commonOkay')}
                    onConfirm={() => setShowVerifiedSuccess(false)}
                />
            )}

            <PWAInstallModal
                show={showPWAInstall}
                onClose={handleClosePWAModal}
            />
        </>
    );
}
