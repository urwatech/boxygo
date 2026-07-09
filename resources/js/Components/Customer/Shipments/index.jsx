import React from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from '../../Shared/QRCode';
import ImagePreviewGallery from '../ImagePreviewGallery';
import { formatTimelineTimestamp } from './shipmentHelpers';

export function DetailField({
    label,
    value,
    className = '',
    labelClassName = 'text-xs text-gray-500',
    valueClassName = 'font-semibold text-gray-800 mt-2',
}) {
    return (
        <div className={className}>
            <p className={labelClassName}>{label}</p>
            <p className={valueClassName}>{value || '-'}</p>
        </div>
    );
}

export function ParticipantDetailCard({
    title,
    name,
    phone,
    email,
    landmark,
    building,
}) {
    const { t } = useTranslation();

    return (
        <div className="py-4 border-t border-[#e5ecfb]">
            <h3 className="text-base font-semibold text-gray-800 mb-4">
                {title}
            </h3>
            <div className="grid grid-cols-2 gap-6 text-sm text-gray-600">
                <div>
                    <p className="text-blue-500 uppercase text-xs font-semibold">
                        {t('commonName')}
                    </p>
                    <p className="font-semibold text-gray-800 mt-2">
                        {name || '-'}
                    </p>
                </div>
                <div>
                    <p className="text-blue-500 uppercase text-xs font-semibold">
                        {t('commonContact')}
                    </p>
                    <p className="font-semibold text-gray-800 mt-2">
                        {phone || '-'}
                    </p>
                </div>
                <div>
                    <p className="text-blue-500 uppercase text-xs font-semibold">
                        {t('commonEmail')}
                    </p>
                    <p className="font-semibold text-gray-800 mt-2">
                        {email || '-'}
                    </p>
                </div>
                <div>
                    <p className="text-blue-500 uppercase text-xs font-semibold">
                        {t('commonNearestLandmark')}
                    </p>
                    <p className="font-semibold text-gray-800 mt-2">
                        {landmark || '-'}
                    </p>
                </div>
                <div>
                    <p className="text-blue-500 uppercase text-xs font-semibold">
                        {t('commonBuildingName')}
                    </p>
                    <p className="font-semibold text-gray-800 mt-2">
                        {building || '-'}
                    </p>
                </div>
            </div>
        </div>
    );
}

export function RatingStars({
    value = 0,
    max = 5,
    thresholdOffset = 0.25,
    iconClassName = 'w-6 h-6 sm:w-7 sm:h-7',
}) {
    return Array.from({ length: max }, (_, index) => {
        const star = index + 1;
        const filled = Number(value) >= star - thresholdOffset;

        return (
            <svg
                key={star}
                className={`${iconClassName} ${filled ? 'text-[#FFB31A]' : 'text-gray-300'}`}
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
        );
    });
}

const ReturnDetailField = ({ label, value, className = '' }) => (
    <div className={className}>
        <p className="text-xs text-blue-500 font-semibold mb-1">{label}</p>
        <p className="text-sm text-gray-800">{value || '-'}</p>
    </div>
);

export function ReturnParcelDetailsSummary({
    title,
    fields,
    className = '',
    headingClassName = 'font-bold text-gray-800 mb-4',
    gridClassName = 'grid grid-cols-2 gap-x-8 gap-y-4',
}) {
    return (
        <div className={className}>
            <h4 className={headingClassName}>{title}</h4>
            <div className={gridClassName}>
                {fields.map((field) => (
                    <ReturnDetailField
                        key={field.key}
                        label={field.label}
                        value={field.value}
                        className={field.className}
                    />
                ))}
            </div>
        </div>
    );
}

export function ReviewAttachments({
    shipment,
    altPrefix,
    t,
}) {
    const photos = Array.isArray(shipment?.photos) ? shipment.photos : [];
    const documents = Array.isArray(shipment?.additional_docs) ? shipment.additional_docs : [];

    if (photos.length === 0 && documents.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
            {photos.length > 0 && (
                <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">{t('commonPhotos')}</h4>
                    <ImagePreviewGallery
                        images={photos}
                        altPrefix={`${altPrefix}-photo`}
                        galleryLabel={t('commonPhotos')}
                        containerClassName="flex gap-2 sm:gap-3 flex-wrap"
                        thumbnailClassName="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-[#e5ecfb]"
                    />
                </div>
            )}
            {documents.length > 0 && (
                <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">{t('commonAdditionalDocuments')}</h4>
                    <div className="flex gap-2 sm:gap-3 flex-wrap">
                        {documents.map((url, index) => (
                            <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-[#e5ecfb] flex items-center justify-center bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function ShareShipmentModal({
    open,
    options = [],
    feedback = '',
    feedbackTone = 'success',
    onClose,
    onShare,
    t,
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-[#2d3d5c]/90" onClick={onClose}></div>
            <div className="absolute inset-0 flex items-center justify-center px-4 py-8">
                <div className="relative w-full max-w-xl rounded-[28px] bg-white px-7 py-15 text-center shadow-[0_35px_60px_rgba(15,23,42,0.25)]">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close share dialog"
                        className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-black shadow-[0_8px_30px_rgba(15,23,42,0.18)] "
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h3 className="text-3xl font-semibold text-[#338DFF]">{t('shipmentsShareTitle')}</h3>
                    <p className="mt-3 text-xl leading-relaxed text-[#595959]">
                        {t('shipmentsShareDescription')}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
                        {options.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => onShare(option.id)}
                                className="flex items-center justify-center "
                            >
                                <img src={option.icon} alt={option.label} />
                                <span className="sr-only">{option.label}</span>
                            </button>
                        ))}
                    </div>
                    {feedback && (
                        <p className={`mt-4 text-xs font-semibold ${feedbackTone === 'error' ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                            {feedback}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ShipmentQrParcelCard({
    t,
    qrPayload,
    statusLabel,
    paymentMethodLabel,
    deliveryTypeLabel,
    sendingDateLabel,
    shipmentNumber,
    addressCodeLabel,
}) {
    return (
        <div className="rounded-2xl border border-[#e6eaf2] bg-white p-4">
            <p className="text-base font-semibold text-gray-800 mb-4">
                {t('commonParcelDetails')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col items-center justify-center sm:w-[156px] w-full">
                    <div className="rounded-md p-3 border border-[#e6eaf2]">
                        <QRCode size={90} data={qrPayload} />
                    </div>

                    <div className="mt-2 text-center text-xs font-semibold text-gray-800 rounded-md px-2 py-2 border border-[#e6eaf2]">
                        <span className="font-semibold text-[#338DFF] mr-1">
                            {t('commonStatus')}:
                        </span>
                        {statusLabel}
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 gap-3 text-sm text-gray-700">
                    <QrDetailRow label={t('commonPaymentMethod')} value={paymentMethodLabel} />
                    <QrDetailRow label={t('shipmentsQrDeliveryType')} value={deliveryTypeLabel} />
                    <QrDetailRow label={t('shipmentsQrSendingDate')} value={sendingDateLabel} />
                    <QrDetailRow label={t('notificationDropdownOrderNo')} value={shipmentNumber} />
                    <QrDetailRow label={t('shipmentsAddressCode')} value={addressCodeLabel} />
                </div>
            </div>
        </div>
    );
}

const QrDetailRow = ({ label, value }) => (
    <div>
        <span className="font-semibold text-[#338DFF] mr-2">
            {label}:
        </span>
        {value || '-'}
    </div>
);

export function ShipmentSectionCard({
    title,
    children,
    className = '',
    titleClassName = 'text-base font-semibold text-gray-800 mb-3',
}) {
    return (
        <div className={`bg-white border border-[#E6EAF3] rounded-2xl p-4 ${className}`}>
            {title && <h3 className={titleClassName}>{title}</h3>}
            {children}
        </div>
    );
}

export function ShipmentTimeline({
    items = [],
    progressIndex = 1,
    className = 'space-y-0 border-t border-gray-200 pt-5',
}) {
    return (
        <div className={className}>
            {items.map((item, index) => {
                const timestampLabel = formatTimelineTimestamp(item?.timestamp);
                const hasTimestamp = Boolean(timestampLabel);
                const checked = hasTimestamp;

                return (
                    <div key={`${item?.status ?? item?.label ?? 'stage'}-${index}`} className="flex items-start gap-4">
                        <div className="flex flex-col items-center flex-shrink-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${checked ? 'bg-[#338DFF]' : 'border-2 border-gray-300'}`}>
                                {checked ? (
                                    <svg className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : null}
                            </div>
                            {index < items.length - 1 && (
                                <div
                                    className={`w-0.5 h-12 mt-1 flex-shrink-0 ${index < progressIndex - 1 ? 'bg-[#338DFF]' : 'bg-[#dbe3f5]'}`}
                                />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${checked ? 'text-gray-800' : 'text-gray-400'}`}>{item?.label}</p>
                            {item?.user && (
                                <p className="text-xs text-gray-600 font-medium">
                                    {item.user.name}
                                </p>
                            )}
                            <p className={`text-xs ${hasTimestamp ? 'text-gray-500' : 'text-gray-400'}`}>
                                {timestampLabel ?? '--'}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const COLOR_CLASSES = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

export function StatusBadge({ label, color = 'yellow', className = '' }) {
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${COLOR_CLASSES[color] || COLOR_CLASSES.yellow} ${className}`}>
            {label}
        </span>
    );
}

export { default as PaymentSummaryPanel } from './PaymentSummaryPanel';
export { default as ShipmentInvoiceView } from './ShipmentInvoiceView';
export {
    ShipmentParcelDetailsGrid,
    ShipmentPrintableParcelDetails,
} from './ShipmentParcelDetails';
export { default as ShipmentQrDrawer } from './ShipmentQrDrawer';
export { default as ShipmentReviewModal } from './ShipmentReviewModal';
