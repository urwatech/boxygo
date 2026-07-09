import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Menu from './Menu';

const DOTS = 'DOTS';

const noop = () => {};

const defaultStatusClasses = (color) => {
    const colors = {
        yellow: 'border-yellow-400 text-[#FAAD14]',
        blue: 'border-blue-400 text-[#2196F3]',
        green: 'border-green-300 text-[#4CAF50]',
    };

    return colors[color] ?? colors.yellow;
};

const range = (start, end) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, idx) => idx + start);
};

const buildPaginationRange = ({
    currentPage,
    totalPages,
    siblingCount,
    boundaryCount,
}) => {
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
};

const DataTableSearch = ({
    value,
    placeholder,
    onChange,
    onSubmit,
    onClear,
    disabled,
    className = '',
}) => {
    const hasValue = String(value ?? '').length > 0;

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            onSubmit(event);
        }
    };

    const handleClear = (event) => {
        onChange('', event);
        onClear?.('', event);
    };

    return (
        <div className={`relative ${className}`}>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value, event)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="w-full min-w-[220px] border border-gray-200 rounded-full pl-4 pr-14 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 md:w-72"
            />
            {hasValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={disabled}
                    className="absolute right-8 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                    aria-label="Clear search"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
                </svg>
            </span>
        </div>
    );
};

const normalizeFilterOptions = (options = []) => (
    options.map((option) => (
        typeof option === 'string'
            ? { value: option, label: option }
            : option
    ))
);

const DataTableMenuFilter = ({
    label,
    value,
    options = [],
    onChange,
    disabled,
    icon,
    className = '',
}) => {
    const [open, setOpen] = useState(false);
    const filterRef = useRef(null);
    const normalizedOptions = useMemo(() => normalizeFilterOptions(options), [options]);
    const selectedOption = normalizedOptions.find((option) => option.value === value);

    useEffect(() => {
        if (!open) return undefined;

        const handlePointerDown = (event) => {
            if (!filterRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div className={`relative ${className}`} ref={filterRef}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                disabled={disabled}
                className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-2 text-sm transition hover:border-[#94A3B8] disabled:cursor-not-allowed disabled:opacity-70"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                {icon ?? <img src="/assets/images/filter.png" alt="" className="w-[18px] h-[18px]" />}
                {label && <span className="text-gray-500">{label}</span>}
                <span className="max-w-[160px] truncate text-gray-800">
                    {selectedOption?.label ?? value ?? ''}
                </span>
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 z-50">
                    <Menu
                        items={normalizedOptions}
                        anchorRef={filterRef}
                        onItemClick={(item) => {
                            onChange(item.value, item);
                            setOpen(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

function DataTablePagination({
    currentPage = 1,
    totalPages = 1,
    onPageChange = noop,
    siblingCount = 1,
    boundaryCount = 1,
    className = '',
    showControls = true,
    disabled = false,
}) {
    const { t } = useTranslation();
    const paginationRange = useMemo(
        () => buildPaginationRange({
            currentPage,
            totalPages,
            siblingCount,
            boundaryCount,
        }),
        [boundaryCount, currentPage, siblingCount, totalPages],
    );

    if (totalPages <= 0 || paginationRange.length === 0) return null;

    const handlePageChange = (page) => {
        if (disabled || page < 1 || page > totalPages || page === currentPage) return;
        onPageChange(page);
    };

    const baseButtonClasses =
        'px-3 py-1 text-sm rounded border transition-colors duration-150 focus:outline-none focus:ring-offset-1 focus:ring-blue-300 disabled:cursor-not-allowed';

    return (
        <div className={`flex flex-wrap items-center justify-end gap-2 bg-gray-50 p-4 border-t border-gray-200 ${className}`}>
            {showControls && (
                <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={disabled || currentPage === 1}
                    className={`${baseButtonClasses} border-gray-200 bg-transparent text-[#ADADAD] hover:bg-[#ADADAD] hover:text-white active:bg-[#ADADAD] active:text-white disabled:bg-[#ADADAD] disabled:text-white disabled:cursor-not-allowed`}
                    aria-label={t('commonPreviousPage')}
                >
                    &lt;
                </button>
            )}

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

            {showControls && (
                <button
                    type="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={disabled || currentPage === totalPages}
                    className={`${baseButtonClasses} border-gray-200 bg-transparent text-[#ADADAD] hover:bg-[#ADADAD] hover:text-white active:bg-[#ADADAD] active:text-white disabled:bg-[#ADADAD] disabled:text-white disabled:cursor-not-allowed`}
                    aria-label={t('commonNextPage')}
                >
                    &gt;
                </button>
            )}
        </div>
    );
}

export default function DataTable({
    title,
    subtitle,
    columns = [],
    rows = [],
    rowKeyFactory = (row, index) => row.id ?? index,
    getStatusClasses = defaultStatusClasses,
    renderEmpty,
    emptyMessage,
    showHeader = true,
    showSearch = false,
    searchValue = '',
    searchPlaceholder,
    onSearchChange = noop,
    onSearchSubmit = noop,
    onSearchClear,
    searchClassName = '',
    showFilters = false,
    filters = [],
    headerLeft,
    headerCenter,
    headerActions,
    headerControls,
    headerClassName = 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4',
    headerTitleClassName = 'text-lg font-semibold text-gray-800',
    controlsClassName = 'flex flex-col gap-3 sm:flex-row sm:items-center',
    showPagination = false,
    currentPage = 1,
    totalPages = 1,
    onPageChange = noop,
    paginationProps = {},
    disabled = false,
    loading = false,
    loadingContent,
    containerClassName = 'bg-white card p-6 border border-gray-200 rounded-2xl shadow-sm transition-all duration-200 ease-out',
    wrapperClassName = 'bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto',
    tableClassName = 'min-w-[720px] w-full text-sm text-left',
    theadClassName = 'bg-gray-50 text-gray-500 border-b border-gray-200',
    headerRowClassName = '',
    tbodyClassName = 'divide-y',
    rowClassName = 'hover:bg-gray-50 border-gray-200',
    emptyRowClassName = '',
    emptyCellClassName = 'px-4 py-6 text-center text-sm text-gray-500',
    footer,
}) {
    const { t } = useTranslation();
    const resolvedEmptyMessage = emptyMessage ?? t('superAdminTableEmptyMessage');
    const resolvedSearchPlaceholder = searchPlaceholder ?? t('commonSearch');
    const hasControls = showSearch || showFilters || headerControls || headerActions;

    const renderCell = (column, row, rowIndex) => {
        const value = column.render
            ? column.render(row[column.key], row, rowIndex)
            : row[column.key];

        if (column.type === 'status') {
            const colorKey = column.statusColorKey ?? 'statusColor';
            return (
                <td
                    key={column.key}
                    className={column.className ?? 'px-4 py-3'}
                >
                    <span
                        className={`inline-flex min-h-[28px] items-center justify-center border text-xs px-3 py-1.5 rounded-full font-medium text-center whitespace-nowrap ${getStatusClasses(
                            row[colorKey],
                        )}`}
                    >
                        {value}
                    </span>
                </td>
            );
        }

        if (column.type === 'action') {
            const hrefKey = column.hrefKey ?? 'href';
            const actionHref = row[hrefKey] ?? '#';

            return (
                <td
                    key={column.key}
                    className={column.className ?? 'px-4 py-3'}
                >
                    <a
                        href={actionHref}
                        onClick={
                            column.onActionClick
                                ? (event) => column.onActionClick(event, row)
                                : undefined
                        }
                        className={column.actionClassName ?? 'text-gray-500 underline text-sm font-medium'}
                    >
                        {value}
                    </a>
                </td>
            );
        }

        return (
            <td
                key={column.key}
                className={column.className ?? 'px-4 py-3'}
            >
                {value}
            </td>
        );
    };

    return (
        <div className={containerClassName}>
            {showHeader && (
                <div className={headerClassName}>
                    <div>
                        {headerLeft ?? (
                            <>
                                {title && <h3 className={headerTitleClassName}>{title}</h3>}
                                {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
                            </>
                        )}
                    </div>

                    {headerCenter}

                    {hasControls && (
                        <div className={controlsClassName}>
                            {showSearch && (
                                <DataTableSearch
                                    value={searchValue}
                                    placeholder={resolvedSearchPlaceholder}
                                    onChange={onSearchChange}
                                    onSubmit={onSearchSubmit}
                                    onClear={onSearchClear}
                                    disabled={disabled || loading}
                                    className={searchClassName}
                                />
                            )}

                            {showFilters && filters.map((filter) => (
                                filter.render ? (
                                    <React.Fragment key={filter.key}>
                                        {filter.render(filter)}
                                    </React.Fragment>
                                ) : (
                                    <DataTableMenuFilter
                                        key={filter.key}
                                        label={filter.label}
                                        value={filter.value}
                                        options={filter.options}
                                        onChange={filter.onChange ?? noop}
                                        disabled={disabled || loading || filter.disabled}
                                        icon={filter.icon}
                                        className={filter.className}
                                    />
                                )
                            ))}

                            {headerControls}
                            {headerActions}
                        </div>
                    )}
                </div>
            )}

            <div className={wrapperClassName}>
                <table className={tableClassName}>
                    {columns.length > 0 && (
                        <thead className={theadClassName}>
                            <tr className={headerRowClassName}>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={column.headerClassName ?? 'py-3 px-4 font-medium'}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                    )}
                    <tbody className={tbodyClassName}>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={columns.length || 1}
                                    className={emptyCellClassName}
                                >
                                    {loadingContent ?? t('commonLoading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr className={emptyRowClassName}>
                                <td
                                    colSpan={columns.length || 1}
                                    className={emptyCellClassName}
                                >
                                    {renderEmpty ? renderEmpty() : resolvedEmptyMessage}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, rowIndex) => (
                                <tr
                                    key={rowKeyFactory(row, rowIndex)}
                                    className={typeof rowClassName === 'function' ? rowClassName(row, rowIndex) : rowClassName}
                                >
                                    {columns.map((column) => renderCell(column, row, rowIndex))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showPagination && (
                <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    disabled={disabled || loading}
                    {...paginationProps}
                />
            )}

            {footer}
        </div>
    );
}

export { DataTablePagination };
