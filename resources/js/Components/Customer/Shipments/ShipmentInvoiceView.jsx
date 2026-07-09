import React from 'react';
import PaymentSummaryPanel from './PaymentSummaryPanel';
import { ShipmentPrintableParcelDetails } from './ShipmentParcelDetails';

const InvoiceDetailRow = ({ label, value }) => (
    <p>
        <span className="font-semibold text-gray-800 mr-2">
            {label}:
        </span>
        {value || '-'}
    </p>
);

const InvoiceContactDetails = ({ title, name, phone, address, t }) => (
    <div className="space-y-2">
        <p className="text-base font-semibold text-gray-800">
            {title}
        </p>
        <InvoiceDetailRow label={t('commonName')} value={name} />
        <InvoiceDetailRow label={t('commonPhone')} value={phone} />
        <InvoiceDetailRow label={t('commonAddress')} value={address} />
    </div>
);

export default function ShipmentInvoiceView({
    open,
    t,
    shipment,
    shipmentNumber,
    sendingDateLabel,
    senderName,
    senderPhone,
    senderAddress,
    receiverName,
    receiverPhone,
    receiverAddress,
    consignmentLabel,
    deliveryTypeLabel,
    insuranceLabel,
    paymentStatusLabel,
    paymentSummary,
    formatAmount,
    directDelivery,
    isPublicView,
    onBack,
    onPrint,
    showMobileShipmentNumber = false,
    showPaymentSummary = true,
    paymentSummaryProps = {},
    backButtonClassName = 'px-5 h-13 rounded-full border-2 border-[#338DFF] text-blue-500 font-semibold bg-white',
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="py-6 sm:p-6">
            <div className="rounded-2xl border border-[#e5ecfb] bg-white p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <img
                        src="/assets/images/Logo.svg"
                        alt="Logo"
                        className="h-10 w-auto object-contain"
                    />
                    {showMobileShipmentNumber && (
                        <div className="md:hidden -mt-4 flex items-center gap-2 whitespace-nowrap justify-center">
                            <p className="text-xs font-semibold text-blue-500">
                                {t('shipmentsNumberLabel')}
                            </p>
                            <p className="text-xs font-semibold text-gray-900">
                                {shipmentNumber}
                            </p>
                        </div>
                    )}
                    <div className="text-sm text-gray-600 space-y-1 sm:text-right">
                        <InvoiceDetailRow label={t('shipmentsQrSendingDate')} value={sendingDateLabel} />
                        <InvoiceDetailRow label={t('notificationDropdownOrderNo')} value={shipmentNumber} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
                    <InvoiceContactDetails
                        title={t('commonSenderDetails')}
                        name={senderName}
                        phone={senderPhone}
                        address={senderAddress}
                        t={t}
                    />
                    <InvoiceContactDetails
                        title={t('commonReceiverDetails')}
                        name={receiverName}
                        phone={receiverPhone}
                        address={receiverAddress}
                        t={t}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ShipmentPrintableParcelDetails
                        t={t}
                        shipment={shipment}
                        consignmentLabel={consignmentLabel}
                        deliveryTypeLabel={deliveryTypeLabel}
                        insuranceLabel={insuranceLabel}
                        paymentStatusLabel={paymentStatusLabel}
                    />
                    {showPaymentSummary && (
                        <PaymentSummaryPanel
                            summary={paymentSummary}
                            t={t}
                            formatAmount={formatAmount}
                            directDelivery={directDelivery}
                            title={t('commonPaymentDetails')}
                            {...paymentSummaryProps}
                        />
                    )}
                </div>
            </div>
            {!isPublicView && (
                <div className="mt-6 flex items-center justify-center gap-3 no-print">
                    <button
                        type="button"
                        onClick={onBack}
                        className={backButtonClassName}
                    >
                        {t('commonBack')}
                    </button>
                    <button
                        type="button"
                        onClick={onPrint}
                        className="px-5 h-13 rounded-full bg-[#338DFF] text-white font-semibold shadow hover:bg-white hover:text-blue-500 border-2 border-[#338DFF]"
                    >
                        {t('shipmentsSaveAsPdf')}
                    </button>
                </div>
            )}
        </div>
    );
}
