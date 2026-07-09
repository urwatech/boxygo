import React, { useEffect } from 'react';

const firstPresent = (...values) => values.find((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
});

const hasDisplayValue = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
};

const formatLabel = (value) => {
    if (!hasDisplayValue(value)) return '--';
    return String(value)
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatAmount = (value) => {
    if (!hasDisplayValue(value)) return '--';

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return `SYP ${numeric.toLocaleString('en-US')}`;
    }

    return String(value);
};

const formatDateTime = (value) => {
    if (!hasDisplayValue(value)) return '--';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const TransactionRow = ({ label, value, formatter = null, accent = false }) => (
    <div className={`flex items-start justify-between gap-4 rounded-2xl px-4 py-3 ${accent ? 'bg-[#eff6ff]' : 'bg-white'}`}>
        <span className="text-sm font-medium text-[#64748b]">{label}</span>
        <span className="text-right text-sm font-semibold text-[#0f172a]">
            {formatter ? formatter(value) : (hasDisplayValue(value) ? String(value) : '--')}
        </span>
    </div>
);

const TransactionCard = ({
    title,
    subtitle,
    badge,
    rows,
    tone = 'blue',
}) => {
    const visibleRows = rows.filter((row) => hasDisplayValue(row.value));

    if (visibleRows.length === 0) {
        return null;
    }

    const toneClass = tone === 'emerald'
        ? 'from-[#ecfdf5] to-[#f8fffb] border-[#bbf7d0]'
        : tone === 'amber'
            ? 'from-[#fff7ed] to-[#fffdfa] border-[#fed7aa]'
            : 'from-[#eff6ff] to-[#f8fbff] border-[#bfdbfe]';

    return (
        <section className={`rounded-[28px] border bg-gradient-to-br ${toneClass} p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h4 className="text-lg font-bold text-[#0f172a]">{title}</h4>
                    {subtitle && (
                        <p className="mt-1 text-sm text-[#64748b]">{subtitle}</p>
                    )}
                </div>
                {badge && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#2563eb] shadow-sm">
                        {badge}
                    </span>
                )}
            </div>
            <div className="mt-4 space-y-2">
                {visibleRows.map((row) => (
                    <TransactionRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        formatter={row.formatter}
                        accent={row.accent}
                    />
                ))}
            </div>
        </section>
    );
};

export default function TransactionModal({
    open,
    transaction,
    onClose,
    t = (value) => value,
}) {
    // Translate enum values to localized strings
    const translateEnumValue = (value) => {
        if (!hasDisplayValue(value)) return value;
        
        const stringValue = String(value).toLowerCase().trim();
        
        // Payment method translations
        const paymentMethodMap = {
            'card': 'walletPaymentMethodCard',
            'cash': 'paymentMethodCash',
            'cash_on_delivery': 'paymentMethodCod',
            'cod': 'paymentMethodCod',
            'online': 'walletPaymentMethodOnline',
            'wallet': 'walletPaymentMethodWallet',
        };
        
        // Payment status translations
        const paymentStatusMap = {
            'pending': 'statusPending',
            'completed': 'statusCompleted',
            'failed': 'statusFailed',
            'cancelled': 'statusCancelled',
            'processing': 'statusProcessing',
            'confirmed': 'statusConfirmed',
            'processed': 'statusProcessed',
        };
        
        // Payer translations
        const payerMap = {
            'sender': 'commonSender',
            'receiver': 'commonReceiver',
        };
        
        // Combine all maps
        const enumMap = {
            ...paymentMethodMap,
            ...paymentStatusMap,
            ...payerMap,
        };
        
        const translationKey = enumMap[stringValue];
        if (translationKey) {
            return t(translationKey);
        }
        
        return value;
    };

    // Create formatLabel that can translate enum values
    const formatLabelWithTranslation = (value) => {
        if (!hasDisplayValue(value)) return '--';
        const translated = translateEnumValue(value);
        return String(translated)
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open || !transaction) {
        return null;
    }

    const payment = transaction?.payment ?? {};
    const receiverGatewayResponse = firstPresent(
        transaction?.receiver_payment_gateway_response,
        transaction?.reciever_payment_gateway_response,
    );

    const deliveryFeePayer = `${firstPresent(transaction?.delivery_fee_payer, payment?.delivery_fee_payer) ?? ''}`.toLowerCase();
    const returnFeePayer = `${firstPresent(transaction?.return_delivery_fee_payer, payment?.return_delivery_fee_payer) ?? ''}`.toLowerCase();
    const senderPaysDelivery = deliveryFeePayer === 'sender';
    const receiverPaysDelivery = deliveryFeePayer === 'receiver';

    const deliveryFee = firstPresent(payment?.shipment_fee, transaction?.shipment_fee, transaction?.total_fee);
    const vatAmount = firstPresent(payment?.vat_amount, payment?.vat, transaction?.vat_amount, transaction?.vat);
    const serviceFee = firstPresent(payment?.service_fee, transaction?.service_fee);
    const insuranceFee = firstPresent(payment?.insurance_fee, transaction?.insurance_fee);
    const platformFee = firstPresent(payment?.platform_fee, payment?.platform_fee_amount, transaction?.platform_fee, transaction?.platform_fee_amount);
    const goodsAmount = firstPresent(payment?.goods_amount, transaction?.receiver_amount, transaction?.reciever_amount, transaction?.parcel_amount);

    const senderGatewayStatus = firstPresent(
        transaction?.payment_gateway_response?.confirm?.payment_status,
        transaction?.payment_gateway_response?.post_payment?.processed ? 'processed' : null,
    );
    const receiverGatewayStatus = firstPresent(
        receiverGatewayResponse?.confirm?.payment_status,
        receiverGatewayResponse?.post_payment?.processed ? 'processed' : null,
    );

    const senderRows = [
        { label: t('transactionModalMethod'), value: firstPresent(transaction?.payment_method, payment?.method), formatter: formatLabelWithTranslation },
        { label: t('commonStatus'), value: firstPresent(transaction?.sender_payment_status, transaction?.payment_status, payment?.status), formatter: formatLabelWithTranslation },
        { label: t('commonPaymentGateway'), value: transaction?.payment_gateway, formatter: formatLabelWithTranslation },
        { label: t('transactionModalGatewayStatus'), value: senderGatewayStatus, formatter: formatLabelWithTranslation },
        { label: t('commonPaidAt'), value: firstPresent(transaction?.paid_at, payment?.paid_at, transaction?.payment_gateway_response?.confirm?.confirmed_at), formatter: formatDateTime },
        { label: t('commonDeliveryFee'), value: senderPaysDelivery ? deliveryFee : null, formatter: formatAmount, accent: senderPaysDelivery },
        { label: t('commonBasicFee'), value: senderPaysDelivery ? serviceFee : null, formatter: formatAmount },
        { label: t('commonVat'), value: senderPaysDelivery ? vatAmount : null, formatter: formatAmount },
        { label: t('commonInsuranceFee'), value: senderPaysDelivery ? insuranceFee : null, formatter: formatAmount },
        { label: t('commonPlatformFee'), value: senderPaysDelivery ? platformFee : null, formatter: formatAmount },
        { label: t('transactionModalReleaseStatus'), value: transaction?.sender_receive_payment_status, formatter: formatLabelWithTranslation },
    ];

    const receiverRows = [
        { label: t('transactionModalMethod'), value: firstPresent(transaction?.receiver_payment_method, transaction?.reciever_payment_method), formatter: formatLabelWithTranslation },
        { label: t('commonStatus'), value: firstPresent(transaction?.receiver_payment_status, transaction?.reciever_payment_status), formatter: formatLabelWithTranslation },
        { label: t('commonPaymentGateway'), value: firstPresent(transaction?.receiver_payment_gateway, transaction?.reciever_payment_gateway), formatter: formatLabelWithTranslation },
        { label: t('transactionModalGatewayStatus'), value: receiverGatewayStatus, formatter: formatLabelWithTranslation },
        { label: t('commonPaidAt'), value: firstPresent(transaction?.receiver_paid_at, transaction?.reciever_paid_at), formatter: formatDateTime },
        { label: t('commonGoodsAmount'), value: goodsAmount, formatter: formatAmount, accent: true },
        { label: t('commonDeliveryFee'), value: receiverPaysDelivery ? deliveryFee : null, formatter: formatAmount, accent: receiverPaysDelivery },
        { label: t('commonBasicFee'), value: receiverPaysDelivery ? serviceFee : null, formatter: formatAmount },
        { label: t('commonVat'), value: receiverPaysDelivery ? vatAmount : null, formatter: formatAmount },
        { label: t('commonInsuranceFee'), value: receiverPaysDelivery ? insuranceFee : null, formatter: formatAmount },
        { label: t('commonPlatformFee'), value: receiverPaysDelivery ? platformFee : null, formatter: formatAmount },
    ];

    const returnRows = [
        { label: t('transactionModalPayer'), value: returnFeePayer, formatter: formatLabelWithTranslation },
        { label: t('commonStatus'), value: transaction?.rdf_payment_status, formatter: formatLabelWithTranslation },
        { label: t('commonReturnDeliveryFee'), value: transaction?.rdf_amount, formatter: formatAmount, accent: true },
        { label: t('commonPaidAt'), value: transaction?.rdf_paid_at, formatter: formatDateTime },
        { label: t('commonReturnStatus'), value: transaction?.return_status, formatter: formatLabelWithTranslation },
    ];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6 sm:px-6">
            <div className="absolute inset-0 bg-[#0f172a]/65 backdrop-blur-[2px]" onClick={onClose} />
            <div
                className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[36px] border border-[#dbe5f1] bg-[#f8fbff] shadow-[0_30px_70px_rgba(15,23,42,0.28)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-[#e5edf6] bg-white px-5 py-5 sm:px-7">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#338DFF] to-[#0f6adf] text-white shadow-[0_16px_34px_rgba(51,141,255,0.3)]">
                                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7.5h18M6.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v10.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25V6.75A2.25 2.25 0 016.75 4.5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 13.5h.008v.008H15V13.5z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-[#0f172a]">
                                    {t('transactionModalTitle')}
                                </h3>
                                <p className="mt-1 text-sm text-[#64748b]">
                                    {t('transactionModalSubtitle')}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-2 text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                            aria-label={t('transactionModalCloseAriaLabel')}
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#2563eb]">
                            {t('transactionModalDeliveryFeePayer')}: {hasDisplayValue(returnFeePayer) && formatLabelWithTranslation(deliveryFeePayer)}
                        </span>
                        <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-semibold text-[#c2410c]">
                            {t('transactionModalReturnFeePayer')}: {hasDisplayValue(returnFeePayer) && formatLabelWithTranslation(returnFeePayer)}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                    <div className="grid gap-5 lg:grid-cols-2">
                        {senderPaysDelivery && <TransactionCard
                            title={t('transactionModalSenderTransactionTitle')}
                            subtitle={senderPaysDelivery
                                ? t('transactionModalSenderPaysDeliverySubtitle')
                                : t('transactionModalSenderTransactionSubtitle')}
                            badge={senderPaysDelivery ? t('transactionModalPaysDeliveryCharges') : null}
                            rows={senderRows}
                            tone="blue"
                        />}
                        {receiverPaysDelivery || goodsAmount > 0 && <TransactionCard
                            title={t('transactionModalReceiverTransactionTitle')}
                            subtitle={receiverPaysDelivery
                                ? t('transactionModalReceiverPaysDeliverySubtitle')
                                : t('transactionModalReceiverPaysGoodsSubtitle')}
                            badge={receiverPaysDelivery ? t('transactionModalPaysDeliveryCharges') : t('transactionModalPaysGoodsAmount')}
                            rows={receiverRows}
                            tone="emerald"
                        />}
                        <div className="lg:col-span-2">
                            <TransactionCard
                                title={t('commonReturnDeliveryFee')}
                                subtitle={t('transactionModalReturnShipmentSubtitle')}
                                badge={hasDisplayValue(returnFeePayer) ? formatLabelWithTranslation(returnFeePayer) : null}
                                rows={returnRows}
                                tone="amber"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-[#e5edf6] bg-white px-5 py-4 sm:px-7">
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full border border-[#d7deea] bg-white px-6 py-2.5 text-sm font-semibold text-[#334155] transition hover:border-[#c3cfdf] hover:bg-[#f8fafc]"
                        >
                            {t('commonClose')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
