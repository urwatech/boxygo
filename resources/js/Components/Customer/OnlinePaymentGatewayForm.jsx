import React from 'react';

export default function OnlinePaymentGatewayForm({
    t,
    provider,
    step,
    phone,
    otp,
    error,
    onProviderChange,
    onPhoneChange,
    onOtpChange,
    onResendOtp,
}) {
    return (
        <>
            <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-800">{t('onlinePaymentChooseProvider')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => onProviderChange('mtn')}
                        className={`rounded-xl px-3 py-3 border-2 text-left ${provider === 'mtn' ? 'border-[#338DFF] bg-[#eef5ff]' : 'border-[#e5ecfb]'}`}
                    >
                        <div>
                            <span className="inline-flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded-full border ${provider === 'mtn' ? 'border-[#338DFF]' : 'border-gray-300'} flex items-center justify-center flex-shrink-0`}>
                                    {provider === 'mtn' && <span className="w-2 h-2 bg-[#338DFF] rounded-full" />}
                                </span>
                                <span className="font-medium text-gray-800 text-xs">{t('onlinePaymentProviderMtn')}</span>
                            </span>
                            <span className="rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                <img src="/assets/images/cash_mobile.png" alt="cash_mobile-icon" />
                            </span>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => onProviderChange('syriatel')}
                        className={`rounded-xl px-3 py-3 border-2 text-left ${provider === 'syriatel' ? 'border-[#338DFF] bg-[#eef5ff]' : 'border-[#e5ecfb]'}`}
                    >
                        <div>
                            <div className="inline-flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded-full border ${provider === 'syriatel' ? 'border-[#338DFF]' : 'border-gray-300'} flex items-center justify-center flex-shrink-0`}>
                                    {provider === 'syriatel' && <span className="w-2 h-2 bg-[#338DFF] rounded-full" />}
                                </span>
                                <span className="font-medium text-gray-800 text-xs">{t('onlinePaymentProviderSyriatel')}</span>
                            </div>
                            <span className="rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                <img src="/assets/images/syria_tel.png" alt="syria_tel-icon" />
                            </span>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => onProviderChange('card')}
                        className={`rounded-xl px-3 py-3 border-2 text-left ${provider === 'card' ? 'border-[#338DFF] bg-[#eef5ff]' : 'border-[#e5ecfb]'}`}
                    >
                        <div>
                            <span className="inline-flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded-full border ${provider === 'card' ? 'border-[#338DFF]' : 'border-[#e5ecfb]'} flex items-center justify-center flex-shrink-0`}>
                                    {provider === 'card' && <span className="w-2 h-2 bg-[#338DFF] rounded-full" />}
                                </span>
                                <span className="font-medium text-gray-800 text-xs">{t('onlinePaymentProviderCard')}</span>
                            </span>
                            <span className="rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                <img src="/assets/images/paymera.png" alt="paymera-icon" />
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            {provider === 'mtn' && step === 'phone' && (
                <div className="space-y-3 pt-2">
                    <p className="text-sm text-gray-600">{t('onlinePaymentPhoneDesc')}</p>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => onPhoneChange(e.target.value)}
                        className="w-full rounded-full px-4 py-3 text-sm border border-[#e5ecfb] focus:border-[#338DFF] focus:outline-none"
                        placeholder={t('onlinePaymentPhonePlaceholder')}
                        dir="ltr"
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
            )}

            {provider === 'mtn' && step === 'otp' && (
                <div className="space-y-3 pt-2">
                    <p className="text-sm text-gray-600">{t('onlinePaymentOtpDesc')}</p>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-full px-4 py-3 text-sm border border-[#e5ecfb] focus:border-[#338DFF] focus:outline-none text-center tracking-[0.3em] font-mono text-lg"
                        placeholder={t('onlinePaymentOtpPlaceholder')}
                        dir="ltr"
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
            )}

            {provider === 'syriatel' && step === 'phone' && (
                <div className="space-y-3 pt-2">
                    <p className="text-sm text-gray-600">{t('onlinePaymentSyriatelPhoneDesc')}</p>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => onPhoneChange(e.target.value)}
                        className="w-full rounded-full px-4 py-3 text-sm border border-[#e5ecfb] focus:border-[#338DFF] focus:outline-none"
                        placeholder={t('onlinePaymentPhonePlaceholder')}
                        dir="ltr"
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
            )}

            {provider === 'syriatel' && step === 'otp' && (
                <div className="space-y-3 pt-2">
                    <p className="text-sm text-gray-600">{t('onlinePaymentOtpDesc')}</p>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-full px-4 py-3 text-sm border border-[#e5ecfb] focus:border-[#338DFF] focus:outline-none text-center tracking-[0.3em] font-mono text-lg"
                        placeholder={t('onlinePaymentOtpPlaceholder')}
                        dir="ltr"
                    />
                    {onResendOtp && (
                        <button
                            type="button"
                            onClick={onResendOtp}
                            className="text-sm text-[#338DFF] underline"
                        >
                            {t('onlinePaymentResendOtp')}
                        </button>
                    )}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
            )}

            {provider === 'card' && (
                <div className="space-y-3 pt-2">
                    <p className="text-sm text-gray-600">{t('onlinePaymentCardDesc')}</p>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
            )}
        </>
    );
}
