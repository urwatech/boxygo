import React from 'react';
import OnlinePaymentGatewayForm from './OnlinePaymentGatewayForm';

const formatSYP = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${Math.round(numeric)} SYP` : '--';
};

export default function PaymentModal({
    open,
    paymentDetails,
    onClose,
    onPayNow,
    paymentMethod = 'online',
    onlineProvider = 'mtn',
    onOnlineProviderChange,
    onlineStep = 'phone',
    onlinePhone = '',
    onOnlinePhoneChange,
    otpCode = '',
    onOtpCodeChange,
    paymentError = '',
    onResendOtp,
    submitting = false,
    t = (value) => value,
    showOnlineGatewayForm = false,
}) {
    if (!open) {
        return null;
    }

    const details = paymentDetails ?? {};
    const title = details.title || 'Payment Pending';
    const shouldVerifyOtp = showOnlineGatewayForm
        && paymentMethod === 'online'
        && (onlineProvider === 'mtn' || onlineProvider === 'syriatel')
        && onlineStep === 'otp';
    const actionAmount = Number(details.actionAmount ?? details.total ?? 0);
    const actionLabel = submitting
        ? (t('commonSubmitting') || 'Processing...')
        : shouldVerifyOtp
            ? (t('onlinePaymentVerifyButton') || 'Verify OTP')
            : `${t('commonPay') || 'Pay'} (${formatSYP(actionAmount)})`;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-4 sm:py-8">
            <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>

            <div
                className="relative z-10 w-full max-w-3xl max-h-[98vh] overflow-y-auto rounded-[28px] sm:rounded-[36px] border border-[#dfe5f3] bg-white p-4 sm:p-8 shadow-[0_25px_60px_rgba(15,23,42,0.35)]"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg">
                            <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
                            </svg>
                        </div>

                        <h3 className="text-xl sm:text-3xl font-bold text-gray-900">
                            {title}
                        </h3>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-500 hover:text-gray-700 font-bold text-2xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Description */}
                {details.description && (
                    <p className="mt-2 text-sm sm:text-base text-gray-600">
                        {details.description}
                    </p>
                )}

                {/* Summary */}
                <div className="mt-2 rounded-3xl border border-[#e4e8f4] bg-white p-4 sm:p-5">
                    <div className="flex flex-col gap-3">
                        {(details.lineItems || []).map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                                <span className="text-gray-600">{item.label}</span>
                                <span className="font-medium text-gray-900">
                                    {formatSYP(item.amount)}
                                </span>
                            </div>
                        ))}

                        <div className="mt-2 h-px bg-[#eef2ff]"></div>

                        <div className="flex justify-between">
                            <span className="font-semibold text-gray-800">
                                {t('commonTotal')}
                            </span>
                            <span className="font-bold text-blue-800">
                                {formatSYP(details.total)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {paymentError && !showOnlineGatewayForm && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-2xl">
                        {paymentError}
                    </div>
                )}

                {/* Payment Form */}
                {showOnlineGatewayForm && (
                    <div className="mt-3 space-y-4">
                        {paymentMethod === 'online' && (
                            <div className="flex flex-col sm:block">
                                <OnlinePaymentGatewayForm
                                    t={t}
                                    provider={onlineProvider}
                                    step={onlineStep}
                                    phone={onlinePhone}
                                    otp={otpCode}
                                    error={paymentError}
                                    onProviderChange={onOnlineProviderChange}
                                    onPhoneChange={onOnlinePhoneChange}
                                    onOtpChange={onOtpCodeChange}
                                    onResendOtp={onResendOtp}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto rounded-full border border-[#e2e8f0] px-6 py-3 text-gray-700 font-semibold"
                    >
                        {t('commonCancel')}
                    </button>

                    <button
                        onClick={onPayNow}
                        disabled={submitting}
                        className="w-full sm:w-auto rounded-full bg-[#0b64f3] px-6 py-3 text-white font-bold"
                    >
                        {actionLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
