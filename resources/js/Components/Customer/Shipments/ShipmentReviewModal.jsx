import React from 'react';
import { RatingStars, ReviewAttachments } from './index.jsx';

const DIRECT_RATING_KEYS = [
    { key: 'rider_behavior', labelKey: 'shipmentsReviewRiderBehavior' },
    { key: 'on_time_delivery', labelKey: 'commonOnTimeDelivery' },
    { key: 'affordability', labelKey: 'commonAffordability' },
];

const StarIcon = ({ filled, className = 'w-7 h-7 sm:w-8 sm:h-8' }) => (
    <svg
        className={`${className} ${filled ? 'text-[#FFB31A]' : 'text-gray-300'}`}
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
);

const DirectRatingRows = ({ reviewForm, onRatingChange, t }) => (
    <div className="mt-4 sm:mt-5 flex justify-center flex-wrap md:grid md:grid-cols-3 gap-4 text-center">
        {DIRECT_RATING_KEYS.map((row) => {
            const label = t(row.labelKey);
            return (
                <div key={row.key} className="flex flex-col items-center">
                    <div className="text-blue-500 font-semibold text-xs sm:text-sm mb-1">{label}</div>
                    <div className="inline-flex gap-0">
                        {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                                key={rating}
                                type="button"
                                onClick={() => onRatingChange(row.key, rating)}
                                aria-label={`${label} ${rating}`}
                                className="w-7 h-7 sm:w-8 sm:h-8"
                            >
                                <StarIcon filled={reviewForm[row.key] >= rating} />
                            </button>
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

const EmployeeRatingRows = ({
    employees,
    employeeRatings,
    getEmployeeKey,
    onEmployeeRatingChange,
}) => (
    <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {employees.map((employee, index) => {
            const key = getEmployeeKey(employee, index);
            const ratingValue = employeeRatings[key] ?? null;
            const roleLabel = employee?.roles === 'drop point keeper'
                ? 'Drop Point'
                : (employee?.roles || employee?.role || '');

            return (
                <div
                    key={key}
                    className="flex flex-col sm:flex-row items-center sm:items-start gap-3 justify-between border border-[#E5E7EB] rounded-[20px] px-4 py-3"
                >
                    <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{employee?.name || 'Employee'}</p>
                        <p className="text-xs text-gray-500 capitalize">{roleLabel}</p>
                    </div>
                    <div className="inline-flex gap-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                                key={rating}
                                type="button"
                                onClick={() => onEmployeeRatingChange(key, rating)}
                                aria-label={`${employee?.name || 'Employee'} ${rating}`}
                                className="h-8 w-8 rounded-full flex items-center justify-center"
                            >
                                <StarIcon
                                    filled={ratingValue >= rating}
                                    className="w-5 h-5"
                                />
                            </button>
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

export default function ShipmentReviewModal({
    open,
    shipment,
    t,
    altPrefix,
    isDirectDelivery = true,
    employees = [],
    reviewForm,
    employeeRatings = {},
    overallAverage,
    submitDisabled,
    submitting,
    maxWidthClassName = 'max-w-xl',
    showDirectEmployeeLabel = false,
    getEmployeeKey = (_employee, index) => `employee-${index}`,
    onClose,
    onSubmit,
    onDirectRatingChange,
    onEmployeeRatingChange,
    onCommentChange,
}) {
    if (!open || !shipment) {
        return null;
    }

    const average = Number.isFinite(Number(overallAverage))
        ? Number(overallAverage)
        : ((reviewForm.rider_behavior || 0) + (reviewForm.on_time_delivery || 0) + (reviewForm.affordability || 0)) / 3 || 0;
    const directEmployee = employees[0] ?? null;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="absolute inset-0 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
                <div className={`my-2 sm:mt-6 w-full ${maxWidthClassName} bg-white rounded-[20px] shadow-2xl border border-gray-200 overflow-hidden`}>
                    <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 relative">
                        <div className="flex items-center justify-center">
                            <img src="/assets/images/Logo.svg" alt="BoxyGo" className="h-15 md:h-auto" />
                        </div>
                        <button
                            type="button"
                            className="absolute top-4 sm:top-6 right-4 sm:right-6 text-gray-500 hover:text-gray-700"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="px-4 sm:px-8 pb-6">
                        <h3 className="text-xl sm:text-2xl text-center font-bold text-[#0f172a]">{t('shipmentsReviewTitle')}</h3>
                        <p className="text-center text-xs sm:text-sm text-gray-600 mt-1">{t('shipmentsReviewDescription')}</p>
                        {showDirectEmployeeLabel && isDirectDelivery && directEmployee && (
                            <div className="text-center text-sm text-gray-500 mt-2">
                                {directEmployee.name ?? 'Rider'} - {directEmployee.roles || directEmployee.role || 'Rider'}
                            </div>
                        )}

                        <ReviewAttachments shipment={shipment} altPrefix={altPrefix} t={t} />

                        {isDirectDelivery ? (
                            <>
                                <div className="mt-3 sm:mt-4 flex items-center justify-center gap-0.5 sm:gap-1">
                                    <RatingStars value={average} />
                                </div>
                                <DirectRatingRows
                                    reviewForm={reviewForm}
                                    onRatingChange={onDirectRatingChange}
                                    t={t}
                                />
                            </>
                        ) : (
                            <EmployeeRatingRows
                                employees={employees}
                                employeeRatings={employeeRatings}
                                getEmployeeKey={getEmployeeKey}
                                onEmployeeRatingChange={onEmployeeRatingChange}
                            />
                        )}

                        <div className="mt-4 sm:mt-6">
                            <label className="text-xs sm:text-sm font-semibold text-[#0f172a]">
                                {t('shipmentsReviewTextLabel')}{' '}
                                <span className="text-gray-400 font-normal">{t('shipmentsReviewTextOptional')}</span>
                            </label>
                            <textarea
                                value={reviewForm.comment}
                                onChange={(event) => onCommentChange(event.target.value)}
                                className="mt-2 w-full border border-gray-200 rounded-2xl p-3 sm:p-4 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#338DFF]"
                                rows="4"
                                placeholder={t('shipmentsReviewPlaceholder')}
                            />
                        </div>

                        <div className="mt-4 sm:mt-6 flex items-center justify-between gap-3 sm:gap-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full sm:w-auto px-6 sm:px-8 h-11 rounded-full border-2 border-[#338DFF] text-blue-500 font-semibold bg-white text-sm sm:text-base"
                            >
                                {t('commonCancel')}
                            </button>
                            <button
                                type="button"
                                disabled={submitDisabled}
                                onClick={onSubmit}
                                className={`w-full sm:w-auto px-6 sm:px-8 h-11 rounded-full text-white font-semibold text-sm sm:text-base ${submitDisabled ? 'bg-[#7fb5ff] cursor-not-allowed' : 'bg-[#338DFF]'}`}
                            >
                                {submitting ? t('commonSubmitting') : t('commonSubmit')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
