import React from 'react';
import { DetailField } from './index.jsx';

const formatGoodsValue = (shipment) => {
    const amount = shipment?.payment?.goods_amount ?? shipment?.parcel_amount;
    return amount ? `${amount} SYP` : '-';
};

const PrintableRow = ({ label, value }) => (
    <p>
        <span className="font-semibold text-gray-800 mr-2">
            {label}:
        </span>
        {value || '-'}
    </p>
);

const buildSizeValue = (shipment) => {
    const sizeName = shipment?.size?.name || '';
    const hasCustomSize = shipment?.custom_length || shipment?.custom_width || shipment?.custom_height;

    if (!sizeName && !hasCustomSize) {
        return '-';
    }

    return (
        <>
            {sizeName}
            {hasCustomSize && (
                <span className="block mt-2">
                    {shipment?.custom_length} A- {shipment?.custom_width} A- {shipment?.custom_height}
                </span>
            )}
        </>
    );
};

export function ShipmentPrintableParcelDetails({
    t,
    shipment,
    consignmentLabel,
    deliveryTypeLabel,
    insuranceLabel,
    paymentStatusLabel,
}) {
    return (
        <div className="rounded-xl border border-[#e5ecfb] p-4 text-sm text-gray-600 space-y-2">
            <p className="text-base font-semibold text-gray-800">
                {t('commonParcelDetails')}
            </p>
            <PrintableRow label={t('commonConsignmentType')} value={consignmentLabel} />
            <PrintableRow label={t('commonSize')} value={shipment?.size?.name} />
            <PrintableRow label={t('commonWeight')} value={shipment?.weight} />
            <PrintableRow label={t('commonValue')} value={formatGoodsValue(shipment)} />
            <PrintableRow label={t('shipmentsQrDeliveryType')} value={deliveryTypeLabel} />
            <PrintableRow label={t('commonInsurance')} value={insuranceLabel} />
            <PrintableRow label={t('commonPaymentStatus')} value={paymentStatusLabel} />
        </div>
    );
}

export function ShipmentParcelDetailsGrid({
    t,
    shipment,
    consignmentLabel,
    insuranceLabel,
    paymentStatusLabel,
    includeAcceptReturns = false,
}) {
    return (
        <div className="lg:col-span-9">
            <h3 className="text-base font-semibold text-gray-800 mb-4">{t('commonParcelDetails')}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600">
                <DetailField
                    label={t('commonConsignmentType')}
                    value={consignmentLabel}
                    labelClassName="text-blue-500 uppercase text-xs font-semibold"
                />
                <DetailField
                    label={t('commonSize')}
                    value={buildSizeValue(shipment)}
                    labelClassName="text-blue-500 uppercase text-xs font-semibold"
                />
                <DetailField
                    label={t('commonWeight')}
                    value={shipment?.weight || '-'}
                    labelClassName="text-blue-500 uppercase text-xs font-semibold"
                />
                <DetailField
                    label={t('commonValue')}
                    value={formatGoodsValue(shipment)}
                    labelClassName="text-blue-500 uppercase text-xs font-semibold"
                />
                <DetailField
                    label={t('commonInsurance')}
                    value={insuranceLabel}
                    labelClassName="text-blue-500 uppercase text-xs font-semibold"
                />
                <DetailField
                    label={t('commonPaymentStatus')}
                    value={paymentStatusLabel}
                    labelClassName="text-blue-500 uppercase text-xs font-semibold"
                />
                {includeAcceptReturns && (
                    <DetailField
                        label={t('commonAcceptReturns')}
                        value={shipment?.accept_returns ? t('commonYes') : t('commonNo')}
                        labelClassName="text-blue-500 uppercase text-xs font-semibold"
                    />
                )}
            </div>
        </div>
    );
}
