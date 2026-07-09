import React from 'react';

const buildDeliveryRows = ({ summary, directDelivery, t }) => {
    if (directDelivery) {
        return [
            {
                key: 'direct-delivery',
                label: t('shipmentsDirectDeliveryFee'),
                amount: summary.shipmentFee,
            },
        ];
    }

    return [
        {
            key: 'sender-door-service',
            label: t('commonSenderDoorServiceFee'),
            amount: summary.senderZoneDeliveryFee,
        },
        {
            key: 'receiver-door-service',
            label: t('commonReceiverDoorServiceFee'),
            amount: summary.receiverZoneDeliveryFee,
        },
    ];
};

const buildRows = ({
    summary,
    directDelivery,
    includeDeliveryCosts,
    includeSubtotal,
    mode,
    totalAmount,
    t,
}) => {
    const rows = [];
    const goodsAmount = Number(summary.goodsAmount ?? 0);
    const goodsRow = goodsAmount > 0
        ? [{
            key: 'goods',
            label: t('commonGoodsCost'),
            amount: summary.goodsAmount,
        }]
        : [];

    const deliveryCostRows = includeDeliveryCosts
        ? [
            ...buildDeliveryRows({ summary, directDelivery, t }),
            {
                key: 'insurance',
                label: t('commonInsuranceFee'),
                amount: summary.insuranceFee ?? 0,
            },
            {
                key: 'basic',
                label: t('commonBasicFee'),
                amount: summary.serviceFee ?? 0,
            },
            ...(includeSubtotal
                ? [{
                    key: 'subtotal',
                    label: t('commonSubtotal'),
                    amount: summary.subtotal,
                    tone: 'subtotal',
                }]
                : []),
            {
                key: 'platform',
                label: t('commonPlatformFee'),
                amount: summary.platformFee,
            },
            {
                key: 'vat',
                label: summary.vatLabel ?? t('commonVat'),
                amount: summary.vat,
            },
        ]
        : [];

    if (mode === 'receiver') {
        rows.push(...goodsRow, ...deliveryCostRows);
    } else {
        rows.push(...deliveryCostRows.slice(0, directDelivery ? 1 : 2), ...goodsRow, ...deliveryCostRows.slice(directDelivery ? 1 : 2));
    }

    rows.push({
        key: 'total',
        label: t('shipmentsTotal'),
        amount: totalAmount ?? summary.total,
        tone: 'total',
    });

    return rows;
};

const StackRow = ({ row, formatAmount }) => (
    <div className={`flex items-center justify-between ${row.tone === 'total' ? 'border-t border-[#e5ecfb] pt-2' : ''}`}>
        <span className={row.tone === 'total' ? 'font-semibold text-gray-900' : ''}>
            {row.label}
        </span>
        <span className={row.tone === 'total' ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}>
            {formatAmount(row.amount)}
        </span>
    </div>
);

const TableRow = ({ row, formatAmount }) => {
    const labelClassName = row.tone === 'subtotal'
        ? 'font-semibold text-gray-900 text-base'
        : row.tone === 'total'
            ? 'font-semibold text-gray-900'
            : 'font-medium text-gray-700';
    const valueClassName = row.tone === 'subtotal'
        ? 'text-right text-base font-bold text-gray-900'
        : row.tone === 'total'
            ? 'text-right font-bold text-gray-900'
            : 'text-right font-medium text-[#595959]';

    return (
        <tr>
            <td className={labelClassName}>{row.label}</td>
            <td className={valueClassName}>{formatAmount(row.amount)}</td>
        </tr>
    );
};

export default function PaymentSummaryPanel({
    summary,
    t,
    formatAmount,
    directDelivery,
    mode = 'sender',
    includeDeliveryCosts = true,
    includeSubtotal = false,
    layout = 'stack',
    title,
    totalAmount,
    wrapperClassName,
    titleClassName,
    emptyClassName,
    unavailableMessage = 'Payment summary is unavailable for this shipment.',
}) {
    const isTable = layout === 'table';
    const rows = summary
        ? buildRows({
            summary,
            directDelivery,
            includeDeliveryCosts,
            includeSubtotal,
            mode,
            totalAmount,
            t,
        })
        : [];
    const defaultWrapperClassName = isTable
        ? 'border border-[#e5ecfb] rounded-xl overflow-hidden'
        : 'rounded-xl border border-[#e5ecfb] p-4 text-sm text-gray-600';
    const defaultTitleClassName = isTable
        ? 'px-4 py-3 text-sm font-semibold text-gray-800 border-b border-[#e5ecfb]'
        : 'text-base font-semibold text-gray-800 mb-3';
    const defaultEmptyClassName = isTable
        ? 'px-4 py-4 text-sm text-gray-500'
        : 'text-sm text-gray-500';

    return (
        <div className={wrapperClassName ?? defaultWrapperClassName}>
            {title && (
                isTable
                    ? <div className={titleClassName ?? defaultTitleClassName}>{title}</div>
                    : <p className={titleClassName ?? defaultTitleClassName}>{title}</p>
            )}
            {summary ? (
                isTable ? (
                    <table className="w-full text-sm text-gray-600 details-table">
                        <tbody>
                            {rows.map((row) => (
                                <TableRow key={row.key} row={row} formatAmount={formatAmount} />
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="space-y-2">
                        {rows.map((row) => (
                            <StackRow key={row.key} row={row} formatAmount={formatAmount} />
                        ))}
                    </div>
                )
            ) : (
                <div className={emptyClassName ?? defaultEmptyClassName}>
                    {unavailableMessage}
                </div>
            )}
        </div>
    );
}
