import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const DOTS = 'DOTS';

const range = (start, end) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, idx) => idx + start);
};

export default function Pagination({
    currentPage = 1,
    totalPages = 1,
    onPageChange = () => {},
    siblingCount = 1,
    boundaryCount = 1,
    className = '',
    showControls = true,
    disabled = false,
}) {
    const { t } = useTranslation();
    const paginationRange = useMemo(() => {
        if (totalPages <= 0) return [];

        const totalPageNumbers = siblingCount * 2 + boundaryCount * 2 + 3;
        if (totalPages <= totalPageNumbers) return range(1, totalPages);

        const leftSiblingIndex = Math.max(currentPage - siblingCount, boundaryCount + 2);
        const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages - boundaryCount - 1);

        const showLeftDots = leftSiblingIndex > boundaryCount + 2;
        const showRightDots = rightSiblingIndex < totalPages - (boundaryCount + 1);

        const firstSection = range(1, boundaryCount);
        const lastSection = range(totalPages - boundaryCount + 1, totalPages);
        const middleSection = range(leftSiblingIndex, rightSiblingIndex);

        if (!showLeftDots && showRightDots) {
            const leftRange = range(1, boundaryCount + siblingCount * 2 + 2);
            return [...leftRange, DOTS, ...lastSection];
        }

        if (showLeftDots && !showRightDots) {
            const rightRange = range(totalPages - (boundaryCount + siblingCount * 2 + 1), totalPages);
            return [...firstSection, DOTS, ...rightRange];
        }

        return [...firstSection, DOTS, ...middleSection, DOTS, ...lastSection];
    }, [boundaryCount, currentPage, siblingCount, totalPages]);

    if (totalPages <= 0 || paginationRange.length === 0) return null;

    const handlePageChange = (page) => {
        if (disabled || page < 1 || page > totalPages || page === currentPage) return;
        onPageChange(page);
    };

    const baseButtonClasses =
        'px-3 py-1 text-sm rounded border transition-colors duration-150 focus:outline-none focus:ring-offset-1 focus:ring-blue-300 disabled:cursor-not-allowed';

    return (
        <div
            className={`flex flex-wrap items-center justify-end gap-2 bg-gray-50 p-4 border-t border-gray-200 ${className}`}
        >
            {/* LEFT ARROW */}
            {showControls && (
            <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={disabled || currentPage === 1}
                className={`${baseButtonClasses}
                    border-gray-200
                    bg-transparent
                    text-[#ADADAD]
                    hover:bg-[#ADADAD]
                    hover:text-[white]
                    active:bg-[#ADADAD]
                    active:text-[white]
                    disabled:bg-[#ADADAD]
                    disabled:text-white
                    disabled:cursor-not-allowed`}
                aria-label={t('commonPreviousPage')}
            >
                &lt;
            </button>
            )}

            {/* PAGE BUTTONS */}
            {paginationRange.map((page, index) => {
                if (page === DOTS) {
                    return (
                        <span key={`dots-${index}`} className="px-3 py-1 text-sm text-gray-400 select-none">
                            ...
                        </span>
                    );
                }

                const isActive = page === currentPage;

                return (
                    <button
                        key={page}
                        type="button"
                        onClick={() => handlePageChange(page)}
                        disabled={disabled}
                        className={`${baseButtonClasses} ${
                            isActive
                                ? 'text-blue-500 border-blue-500 bg-transparent hover:bg-blue-50'
                                : 'text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        {page}
                    </button>
                );
            })}

            {/* RIGHT ARROW */}
            {showControls && (
                <button
                    type="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={disabled || currentPage === totalPages}
                   className={`${baseButtonClasses}
                    border-gray-200
                    bg-transparent
                    text-[#ADADAD]
                    hover:bg-[#ADADAD]
                    hover:text-[white]
                    active:bg-[#ADADAD]
                    active:text-[white]
                    disabled:bg-[#ADADAD]
                    disabled:text-white
                    disabled:cursor-not-allowed`}
                    aria-label={t('commonNextPage')}
                >
                    &gt;
                </button>
            )}
        </div>
    );
}
