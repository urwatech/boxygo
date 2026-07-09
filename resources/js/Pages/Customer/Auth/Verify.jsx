import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthShell from '../../../Components/Customer/AuthShell';
import Popup from '../../SuperAdmin/Components/Popup';

export default function Verify({ email }) {
    const { t } = useTranslation();
    const DIGIT_COUNT = 4;
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        email: email || '',
        code: '',
    });
    const [digits, setDigits] = useState(() => Array(DIGIT_COUNT).fill(''));
    const inputRefs = useRef(Array(DIGIT_COUNT).fill(null));
    const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : false));
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        setData('code', digits.join(''));
    }, [digits, setData]);

    const focusInput = useCallback((index) => {
        if (index < 0 || index >= DIGIT_COUNT) {
            return;
        }
        // Use setTimeout for mobile compatibility instead of requestAnimationFrame chain
        setTimeout(() => {
            const input = inputRefs.current[index];
            if (input) {
                input.focus();
                input.select?.();
            }
        }, 0);
    }, []);

    const applySequentialDigits = useCallback((startIndex, rawDigits) => {
        const sanitized = (rawDigits ?? '').replace(/\D/g, '');
        const next = [...digits];
        let lastIndex = startIndex;

        if (!sanitized) {
            next[startIndex] = '';
            setDigits(next);
            clearErrors('code');
            return startIndex;
        }

        sanitized.split('').forEach((char, offset) => {
            const position = startIndex + offset;
            if (position < DIGIT_COUNT) {
                next[position] = char;
                lastIndex = position;
            }
        });

        setDigits(next);
        clearErrors('code');
        return lastIndex;
    }, [digits, clearErrors]);

    const handleChange = useCallback((idx, value) => {
        const lastIndex = applySequentialDigits(idx, value);
        const nextFocus = lastIndex + 1;

        if (value && nextFocus < DIGIT_COUNT) {
            focusInput(nextFocus);
        } else if (!value && idx > 0) {
            focusInput(idx - 1);
        }
    }, [applySequentialDigits, focusInput]);

    const handlePaste = useCallback((idx, event) => {
        event.preventDefault();
        const pasted = event.clipboardData?.getData('text') || '';
        if (!pasted) {
            return;
        }

        const lastIndex = applySequentialDigits(idx, pasted);
        const nextFocus = Math.min(lastIndex + 1, DIGIT_COUNT - 1);
        focusInput(nextFocus);
    }, [applySequentialDigits, focusInput]);

    const handleKeyDown = useCallback((idx, event) => {
        if (event.key === 'Backspace') {
            event.preventDefault();

            if (digits[idx]) {
                const next = [...digits];
                next[idx] = '';
                setDigits(next);
                clearErrors('code');
                if (idx > 0) {
                    focusInput(idx - 1);
                }
                return;
            }

            if (idx > 0) {
                focusInput(idx - 1);
                const next = [...digits];
                next[idx - 1] = '';
                setDigits(next);
                clearErrors('code');
            }
        } else if (event.key === 'ArrowLeft' && idx > 0) {
            event.preventDefault();
            focusInput(idx - 1);
        } else if (event.key === 'ArrowRight' && idx < DIGIT_COUNT - 1) {
            event.preventDefault();
            focusInput(idx + 1);
        }
    }, [digits, focusInput, clearErrors]);

    const onSubmit = (e) => {
        e.preventDefault();
        post('/verify');
    };

    const resend = (e) => {
        e.preventDefault();
        post('/verify/resend', { 
            data: { email: data.email }, 
            preserveScroll: true, 
            onSuccess: () => {
                setShowSuccessModal(true);
                setTimeout(() => setShowSuccessModal(false), 3000);
            },
            onError: () => {} 
        });
    };

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Small delay to ensure DOM is ready on mobile
        const timer = setTimeout(() => {
            focusInput(0);
        }, 100);
        return () => clearTimeout(timer);
    }, [focusInput]);

    const verificationFormContent = (
        <>
            <div className="hidden md:flex justify-center mb-6">
                <img src="/assets/images/Logo.svg" alt={t('commonLogoAlt')} />
            </div>
            <div className="text-left md:text-center">
                <h1 className="text-3xl font-semibold text-gray-900">{t('authVerification')}</h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-500 md:max-w-[80%] mx-auto">
                    {t('authVerifySubtitleBefore')} <span className="font-semibold text-gray-700">{data.email}</span>. {t('authVerifySubtitleAfter')}
                </p>
                {errors.email && <p className="text-red-600 text-sm mt-2">{errors.email}</p>}
            </div>
            <form onSubmit={onSubmit} className="mt-10 flex flex-col items-center gap-8">
                <div className="flex items-center justify-center gap-4">
                    {digits.map((d, i) => (
                        <input
                            key={i}
                            ref={(el) => {
                                if (el) {
                                    inputRefs.current[i] = el;
                                }
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                            maxLength={1}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-gray-200 text-center text-lg font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4c7bff]/70"
                            value={d}
                            onChange={(e) => handleChange(i, e.target.value)}
                            onKeyDown={(event) => handleKeyDown(i, event)}
                            onPaste={(event) => handlePaste(i, event)}
                        />
                    ))}
                </div>
                {errors.code && <div className="text-red-600 text-sm">{errors.code}</div>}
                <input type="hidden" value={data.email} />
                <div className="self-start md:self-center text-sm text-gray-500">
                    {t('authVerifyDidNotReceive')}{' '}
                    <Link href="/verify/resend" onClick={resend} className="font-semibold text-[#3a70ff] hover:text-[#2154ff]">
                        {t('authVerifyResend')}
                    </Link>
                </div>
                <button
                    type="submit"
                    disabled={processing}
                    className="hidden md:block w-full px-16 rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wider pill-shadow hover:shadow-lg transition-shadow disabled:opacity-60"
                >
                    {t('authVerifyButton')}
                </button>
                <button
                    type="submit"
                    disabled={processing}
                    className="md:hidden absolute bottom-5 w-[90%] mx-auto px-16 rounded-full bg-[#338DFF] py-3 text-sm font-semibold text-white tracking-wider pill-shadow hover:shadow-lg transition-shadow disabled:opacity-60"
                >
                    {t('commonContinue')}
                </button>
            </form>
        </>
    );

    if (isDesktop) {
        return (
            <>
                <AuthShell rightClassName="px-6 sm:px-10 py-10 flex flex-col" rightContent={verificationFormContent} />
                {showSuccessModal && (
                    <Popup
                        title={t('authVerifyResendSuccess')}
                        message={t('authVerifyResendSuccessMessage')}
                        buttonLabel={t('commonOkay')}
                        onConfirm={() => setShowSuccessModal(false)}
                        loopAnimation={true}
                    />
                )}
            </>
        );
    }

    return (
        <div className="min-h-screen flex items-start md:items-center justify-center px-4 sm:px-6 py-8 md:py-0 md:bg-[radial-gradient(circle_at_18%_22%,_#4d88ff_0%,_#2051e4_60%)]">
            <div className="signup-shell w-full max-w-6xl bg-white rounded-[36px] overflow-hidden md:shadow-2xl flex flex-col md:flex-row gap-10 md:gap-0">
                <aside className="hidden relative w-full md:w-1/2 bg-gradient-to-br from-[#4f8aff] via-[#3c6dfb] to-[#264be7] p-6 sm:p-8 text-white md:flex flex-col justify-between">
                    <div className="relative flex-1 flex flex-col justify-center md:items-end">
                        <div className="relative mx-auto md:mr-6 w-full max-w-[320px] sm:max-w-[340px] md:max-w-[380px] rounded-[30px] bg-white/12 backdrop-blur-md p-6 sm:p-8 testimonial-card min-h-[420px] md:min-h-[500px] flex flex-col justify-between transition-all">
                            <h1 className="mt-10 text-2xl sm:text-3xl font-semibold leading-snug max-w-[260px]">{t('authVerifyTestimonial')}</h1>
                            <span className="absolute top-5 left-8 text-5xl font-semibold leading-none text-white/50">&ldquo;</span>
                            <div className="absolute top-10 right-3 sm:right-5 w-16 h-16 rounded-full border border-white/40 bg-white flex items-center justify-center text-lg font-semibold italic text-[#ff8a3d]">
                                <img src="/assets/images/sign_up_truck.png" alt="sign_up_truck" />
                            </div>
                            <div className="absolute left-6 top-[210px] md:left-8 md:top-[240px] w-[160px] h-[150px] sm:w-[180px] sm:h-[170px] md:w-[200px] md:h-[190px] border-l border-dashed border-white/20" />
                            <div className="absolute left-9 top-[224px] md:left-12 md:top-[248px] flex items-center gap-1.5">
                                {[...Array(5)].map((_, i) => (
                                    <svg key={i} className="w-6 h-6 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.18 3.63a1 1 0 00.95.69h3.813c.969 0 1.371 1.24.588 1.81l-3.084 2.24a1 1 0 00-.364 1.118l1.18 3.63c.3.921-.755 1.688-1.54 1.118l-3.084-2.24a1 1 0 00-1.175 0l-3.084 2.24c-.784.57-1.838-.197-1.539-1.118l1.18-3.63a1 1 0 00-.364-1.118L2.318 9.057c-.783-.57-.38-1.81.588-1.81h3.813a1 1 0 00.95-.69l1.18-3.63z" />
                                    </svg>
                                ))}
                            </div>
                            <div className="absolute -left-2 sm:-left-4 bottom-24 w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center text-sm font-semibold text-[#2f70ff]">
                                <img src="/assets/images/sign_up_box.png" alt="sign_up_box" />
                            </div>
                            <span className="absolute top-32 right-32 text-5xl font-semibold leading-none text-white/40">&rdquo;</span>
                            <img className="absolute bottom-0 right-0 sm:-right-6 md:-right-16" src="/assets/images/sign_up_image.png" alt="sign_up_image" />
                        </div>
                    </div>
                    <div className="mt-6 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white/40" />
                        <span className="w-6 h-2 rounded-full bg-white" />
                        <span className="w-2 h-2 rounded-full bg-white/40" />
                    </div>
                </aside>
                <section className="w-full md:w-1/2 bg-white px-3 sm:px-10 py-10 flex flex-col">
                    {verificationFormContent}
                </section>
            </div>
            {showSuccessModal && (
                <Popup
                    title={t('authVerifyResendSuccess')}
                    message={t('authVerifyResendSuccessMessage')}
                    buttonLabel={t('commonOkay')}
                    onConfirm={() => setShowSuccessModal(false)}
                    loopAnimation={true}
                />
            )}
        </div>
    );
}
