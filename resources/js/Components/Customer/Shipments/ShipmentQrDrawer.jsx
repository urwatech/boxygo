import React from 'react';
import { SUPPORT_PHONE_NUMBER } from './shipmentHelpers';
import { ShipmentQrParcelCard } from './index.jsx';

const printDrawerStyles = `@keyframes drawerSlideIn{from{transform:translateX(32px);opacity:0}to{transform:translateX(0);opacity:1}}
@media print {
    @page {
        size: A4 portrait;
        margin: 3mm 4mm;
    }
    html, body {
        height: 100vh;
        width: 100%;
        overflow: hidden;
    }
    body {
        margin: 0;
        padding: 0;
    }
    body * {
        visibility: hidden !important;
    }
    .print-only, .print-only * {
        visibility: visible !important;
    }
    .print-only {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100%;
        max-width: 100%;
        margin: 0;
        padding: 16px 20px !important;
        overflow: hidden !important;
        max-height: 100vh !important;
        height: auto !important;
        page-break-after: avoid;
        page-break-before: avoid;
        page-break-inside: avoid;
        break-inside: avoid;
        font-size: 14px !important;
        line-height: 1.4 !important;
    }
    .print-only .text-base {
        font-size: 17px !important;
        font-weight: 700 !important;
    }
    .print-only .text-sm {
        font-size: 14px !important;
        font-weight: 500 !important;
    }
    .print-only .text-2xl {
        font-size: 26px !important;
        font-weight: 700 !important;
    }
    .print-only .space-y-4 > * + * {
        margin-top: 12px !important;
    }
    .print-only .space-y-3 > * + * {
        margin-top: 9px !important;
    }
    .print-only .p-4 {
        padding: 12px !important;
    }
    .print-only .px-4 {
        padding-left: 12px !important;
        padding-right: 12px !important;
    }
    .print-only .py-4 {
        padding-top: 12px !important;
        padding-bottom: 12px !important;
    }
    .print-only .pt-4 {
        padding-top: 12px !important;
    }
    .print-only .pb-8 {
        padding-bottom: 12px !important;
    }
    .print-only .pt-1 {
        padding-top: 6px !important;
    }
    .print-only .gap-4 {
        gap: 12px !important;
    }
    .print-only .gap-3 {
        gap: 9px !important;
    }
    .print-only .mb-4 {
        margin-bottom: 12px !important;
    }
    .print-only .mt-3 {
        margin-top: 9px !important;
    }
    .print-only .mt-2 {
        margin-top: 7px !important;
    }
    .print-only .w-20 {
        width: 76px !important;
    }
    .print-only .h-20 {
        height: 76px !important;
    }
    .print-only .w-50 {
        width: 56px !important;
    }
    .print-only .min-w-\\[100px\\] {
        min-width: 110px !important;
    }
    .print-only .px-6 {
        padding-left: 16px !important;
        padding-right: 16px !important;
    }
    .print-only .py-4 {
        padding-top: 12px !important;
        padding-bottom: 12px !important;
    }
    .print-only .rounded-2xl {
        border-radius: 14px !important;
    }
    .print-only .rounded-lg {
        border-radius: 12px !important;
    }
    .print-only img[alt="Logo"] {
        max-height: 55px !important;
    }
    .print-only .font-semibold {
        font-weight: 700 !important;
    }
    .print-only span[class*="font-semibold"] {
        font-weight: 700 !important;
    }
}`;

export default function ShipmentQrDrawer({
    open,
    t,
    onClose,
    shippingRouteLabel,
    senderName,
    senderAddress,
    senderPhone,
    senderAvatarUrl,
    receiverName,
    receiverAddress,
    receiverPhone,
    receiverCity,
    qrPayload,
    shipmentStatusLabel,
    paymentMethodLabel,
    deliveryTypeLabel,
    sendingDateLabel,
    shipmentNumber,
    addressCodeLabel,
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <style>{printDrawerStyles}</style>
            <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl sm:rounded-l-[28px] overflow-hidden animate-[drawerSlideIn_.25s_ease-out]">
                <div className="h-full flex flex-col">

                    {/* Header */}
                    <div className="px-4 sm:px-8 pt-5 sm:pt-7 pb-4 flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                        {t('shipmentsPrint')}
                    </h2>

                    <button
                        className="text-gray-500 hover:text-gray-700"
                        onClick={onClose}
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    </div>

                    <div className="border-b border-[#e6eaf2] mx-4 sm:mx-8 mb-4 sm:mb-5"></div>

                    {/* Content */}
                    <div
                    id="print-qr-content"
                    className="print-only flex-1 overflow-y-auto px-4 sm:px-8 pb-6 sm:pb-8 pt-1 space-y-4"
                    >

                    {/* Top Card */}
                    <div className="rounded-2xl border border-[#e6eaf2] bg-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-800 mr-1">{t('shipmentsQrHQ')}:</span>
                            {shippingRouteLabel}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                            <span className="font-semibold text-gray-800 mr-1">{t('shipmentsQrTel')}:</span>
                            {SUPPORT_PHONE_NUMBER}
                        </p>
                        </div>

                        <img
                        src="/assets/images/Logo.svg"
                        className="w-32 sm:w-50 h-auto object-contain"
                        />
                    </div>

                    {/* Sender */}
                    <div className="rounded-2xl border border-[#e6eaf2] bg-white">
                        <div className="px-4 pt-4">
                        <p className="text-base font-semibold text-gray-800">
                            {t('commonSenderDetails')}
                        </p>
                        </div>

                        <div className="mt-3 border-t border-[#f1f3f9] px-4 py-4 flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 space-y-3">
                            <p className="text-sm text-gray-700">
                            <span className="font-semibold text-[#338DFF] mr-2">{t('commonName')}:</span>
                            {senderName}
                            </p>
                            <p className="text-sm text-gray-700">
                            <span className="font-semibold text-[#338DFF] mr-2">{t('commonAddress')}:</span>
                            {senderAddress || '-'}
                            </p>
                            <p className="text-sm text-gray-700">
                            <span className="font-semibold text-[#338DFF] mr-2">{t('commonPhone')}:</span>
                            {senderPhone}
                            </p>
                        </div>

                        {senderAvatarUrl && (
                            <div className="flex-shrink-0">
                            <img
                                src={senderAvatarUrl}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover object-top border border-[#e6eaf2]"
                            />
                            </div>
                        )}
                        </div>
                    </div>

                    {/* Receiver */}
                    <div className="rounded-2xl border border-[#e6eaf2] bg-white">
                        <div className="px-4 pt-4">
                        <p className="text-base font-semibold text-gray-800">
                            {t('commonReceiverDetails')}
                        </p>
                        </div>

                        <div className="mt-3 border-t border-[#f1f3f9] px-4 py-4 flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 space-y-3">
                            <p className="text-sm text-gray-700">
                            <span className="font-semibold text-[#338DFF] mr-2">{t('commonName')}:</span>
                            {receiverName}
                            </p>
                            <p className="text-sm text-gray-700">
                            <span className="font-semibold text-[#338DFF] mr-2">{t('commonAddress')}:</span>
                            {receiverAddress || '-'}
                            </p>
                            <p className="text-sm text-gray-700">
                            <span className="font-semibold text-[#338DFF] mr-2">{t('commonPhone')}:</span>
                            {receiverPhone}
                            </p>
                        </div>

                        {receiverCity && (
                            <div className="flex-shrink-0 flex items-center justify-center bg-gray-50 rounded-lg px-4 sm:px-6 py-3 sm:py-4 min-w-[80px] sm:min-w-[100px]">
                            <p className="text-lg sm:text-2xl font-bold text-gray-800" dir="rtl">
                                {receiverCity}
                            </p>
                            </div>
                        )}
                        </div>
                    </div>

                    <ShipmentQrParcelCard
                        t={t}
                        qrPayload={qrPayload}
                        statusLabel={shipmentStatusLabel}
                        paymentMethodLabel={paymentMethodLabel}
                        deliveryTypeLabel={deliveryTypeLabel}
                        sendingDateLabel={sendingDateLabel}
                        shipmentNumber={shipmentNumber}
                        addressCodeLabel={addressCodeLabel}
                    />

                    </div>

                    {/* Footer */}
                    <div className="mt-auto bg-white">
                    <div className="border-t border-[#dfe5f3] mx-4 sm:mx-8"></div>

                    <div className="px-4 sm:px-8 py-4 sm:py-5">
                        <button
                        onClick={() => window.print()}
                        className="w-full h-[44px] sm:h-[46px] rounded-full bg-[#338DFF] text-white font-semibold shadow"
                        >
                        {t('shipmentsPrint')}
                        </button>
                    </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
