import React, { useEffect, useState } from 'react';
import { useForm, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthShell from '../../../Components/Customer/AuthShell';

export default function SetPassword({ email }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        email: email || '',
        phone_number: '',
        password: '',
        password_confirmation: '',
    });
    const [show1, setShow1] = useState(false);
    const [show2, setShow2] = useState(false);
    const [showMobileForm, setShowMobileForm] = useState(false);

    const onSubmit = (e) => {
        e.preventDefault();
        post('/reset-password');
    };

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(min-width: 768px)');
        const handler = (e) => {
            if (e.matches) setShowMobileForm(false);
        };
        if (mq.matches) setShowMobileForm(false);
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else if (mq.addListener) mq.addListener(handler);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener('change', handler);
            else if (mq.removeListener) mq.removeListener(handler);
        };
    }, []);

    const desktopRightContent = (
        <div className="flex flex-col flex-1">
            <div className="flex justify-center mb-4 mt-10">
                <img src="/assets/images/Logo.svg" alt={t('commonLogoAlt')} />
            </div>

            <div className="mt-2 text-center">
                <h1 className="text-3xl font-semibold text-gray-900">{t('authSetPasswordTitle')}</h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-500 md:max-w-[70%] mx-auto">
                    {t('authSetPasswordSubtitle')}
                </p>
            </div>

            <form onSubmit={onSubmit} className="mt-8 flex-1 space-y-5">
                <input type="hidden" name="email" value={data.email} />

                <div>
                    <div className="relative">
                        <input
                            type={show1 ? 'text' : 'password'}
                            placeholder={t('authSetPasswordNewPlaceholder')}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            className="w-full rounded-full border border-gray-200 px-6 py-3 pr-14 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                        />
                        <button
                            type="button"
                            onClick={() => setShow1((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-5 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                {show1 ? (
                                    <>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </>
                                ) : (
                                    <>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </>
                                )}
                            </svg>
                        </button>
                    </div>
                    {errors.password && <div className="text-red-500 text-sm mt-1">{errors.password}</div>}
                </div>

                <div>
                    <div className="relative">
                        <input
                            type={show2 ? 'text' : 'password'}
                            placeholder={t('authSetPasswordConfirmPlaceholder')}
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            className="w-full rounded-full border border-gray-200 px-6 py-3 pr-14 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                        />
                        <button
                            type="button"
                            onClick={() => setShow2((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-5 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                {show2 ? (
                                    <>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </>
                                ) : (
                                    <>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </>
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="pt-3">
                    <button type="submit" disabled={processing} className="w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide shadow-[0_12px_30px_rgba(48,111,255,0.25)] hover:shadow-lg transition-shadow disabled:opacity-60">
                        {t('authSetPasswordSubmit')}
                    </button>
                </div>
                {errors.email && <div className="text-red-500 text-sm">{errors.email}</div>}
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
                <Link href="/login" className="font-semibold text-[#3a70ff] hover:text-[#2154ff]">
                    {t('authForgotPasswordBackToLogin')}
                </Link>
            </div>
        </div>
    );

    const mobileCallToAction = (
        <div className="md:hidden absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-2 bg-[#338DFF] p-6">
            <button onClick={() => setShowMobileForm(true)} className="w-[345px] h-[48px] rounded-full bg-white text-blue-500 font-medium text-sm hover:bg-blue-50 transition">
                {t('authSetPasswordTitle')}
            </button>
            <Link href="/login" className="w-[345px] h-[48px] rounded-full border border-white text-white font-medium text-sm hover:bg-white hover:text-blue-500 transition flex items-center justify-center">
                {t('authForgotPasswordBackToLogin')}
            </Link>
        </div>
    );

    const mobileForm = (
        <div className="md:hidden min-h-screen flex items-start justify-center px-4 sm:px-6 py-8 bg-white">
            <div className="w-[1440px] max-w-full rounded-[36px] login-shell overflow-hidden bg-white">
                <section className="w-full bg-white px-6 py-8 flex flex-col min-h-0 rounded-[36px]">
                    <div className="mt-2">
                        <h1 className="text-3xl leading-8 font-semibold text-gray-900">{t('authSetPasswordTitle')}</h1>
                        <p className="mt-3 text-sm leading-6 text-gray-500 max-w-[320px]">
                            {t('authSetPasswordSubtitle')}
                        </p>
                    </div>

                    <form onSubmit={onSubmit} className="mt-7 space-y-5">
                        <input type="hidden" name="email" value={data.email} />

                        <div className="relative h-[48px]">
                            <input
                                type={show1 ? 'text' : 'password'}
                                placeholder={t('authSetPasswordNewPlaceholder')}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                className="w-full h-full rounded-full border border-gray-200 px-5 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                            />
                            <button
                                type="button"
                                onClick={() => setShow1((v) => !v)}
                                className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                    {show1 ? (
                                        <>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </>
                                    ) : (
                                        <>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </>
                                    )}
                                </svg>
                            </button>
                        </div>
                        {errors.password && <div className="text-red-500 text-sm -mt-3">{errors.password}</div>}

                        <div className="relative h-[48px]">
                            <input
                                type={show2 ? 'text' : 'password'}
                                placeholder={t('authSetPasswordConfirmPlaceholder')}
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                className="w-full h-full rounded-full border border-gray-200 px-5 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                            />
                            <button
                                type="button"
                                onClick={() => setShow2((v) => !v)}
                                className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                                    {show2 ? (
                                        <>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.5 7.5 7.32 4.5 12 4.5s8.5 3 9.75 7.5c-1.25 4.5-5.07 7.5-9.75 7.5s-8.5-3-9.75-7.5z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </>
                                    ) : (
                                        <>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </>
                                    )}
                                </svg>
                            </button>
                        </div>

                        <div className="pt-1">
                            <button type="submit" disabled={processing} className="w-full rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wide shadow-[0_12px_30px_rgba(48,111,255,0.25)] hover:shadow-lg transition-shadow disabled:opacity-60">
                                {t('authSetPasswordSubmit')}
                            </button>
                        </div>
                        {errors.email && <div className="text-red-500 text-sm">{errors.email}</div>}
                    </form>

                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 mt-10 text-center text-sm text-gray-500">
                        <Link href="/login" className="font-semibold text-blue-500 hover:text-[#2154ff]">
                            {t('authForgotPasswordBackToLogin')}
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );

    return (
        <>
            <div className={`${showMobileForm ? "hidden md:block" : "block"} bg-[#338DFF]`}>
                <AuthShell
                    rightContent={desktopRightContent}
                    rightClassName="sm:px-10 py-10 min-h-0 rounded-[36px] md:rounded-l-none md:rounded-r-[36px]"
                    hideRightSectionOnMobile
                    mobileContent={!showMobileForm ? mobileCallToAction : null}
                />
            </div>

            {showMobileForm && mobileForm}
        </>
    );
}
