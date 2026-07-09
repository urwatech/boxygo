import React, { useMemo, useState } from 'react';

const DOTS = 'DOTS';

const range = (start, end) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, idx) => idx + start);
};

const getSortableValue = (column, row) => {
    if (typeof column.sortAccessor === 'function') {
        return column.sortAccessor(row);
    }

    const value = row?.[column.key];

    if (value == null) return '';
    if (Array.isArray(value)) return value.join(' ');

    if (typeof value === 'object') {
        const preferredKeys = ['name', 'title', 'label', 'id'];
        const preferredValue = preferredKeys
            .map((key) => value[key])
            .find((item) => typeof item === 'string' || typeof item === 'number');

        return preferredValue ?? '';
    }

    return value;
};

const normalizeSortableValue = (value) => {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim().toLocaleLowerCase();
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return String(value).trim().toLocaleLowerCase();
};

const isActionColumn = (column) => {
    const key = String(column?.key ?? '').toLocaleLowerCase();
    const label = String(column?.label ?? '').toLocaleLowerCase();

    return key.includes('action') || label.includes('action');
};

/**
 * Comprehensive Table Component with Built-in Pagination
 *
 * @param {Object} props - Component props
 * @param {Array} props.columns - Array of column definitions
 *   Each column: {
 *     key: string,
 *     label: string,
 *     render?: (value, row, index) => ReactNode,
 *     sortable?: boolean,
 *     sortAccessor?: (row) => string | number,
 *     className?: string,
 *     headerClassName?: string,
 *     align?: 'left' | 'center' | 'right'
 *   }
 * @param {Array} props.data - Array of data rows
 * @param {string} props.keyField - Unique key field for rows (default: 'id')
 * @param {ReactNode} props.emptyMessage - Message when no data (default: 'No data available')
 * @param {string} props.className - Additional table wrapper classes
 * @param {string} props.tableClassName - Additional table element classes
 * @param {string} props.theadClassName - Additional thead classes
 * @param {string} props.tbodyClassName - Additional tbody classes
 * @param {string} props.thClassName - Additional th classes
 * @param {string} props.tdClassName - Additional td classes
 * @param {string} props.rowClassName - Additional row classes or function (row, index) => string
 * @param {Function} props.onRowClick - Row click handler (row, index) => void
 * @param {boolean} props.striped - Enable striped rows (default: false)
 * @param {boolean} props.bordered - Enable borders (default: false)
 * @param {boolean} props.hoverable - Enable hover effect (default: false)
 * @param {string} props.minWidth - Minimum table width (default: '980px')
 *
 * Pagination Props:
 * @param {boolean} props.pagination - Enable pagination (default: false)
 * @param {'server' | 'client'} props.paginationMode - Pagination mode (default: 'server')
 * @param {number} props.pageSize - Rows per page for client-side pagination
 * @param {number} props.currentPage - Current page number
 * @param {number} props.totalPages - Total number of pages
 * @param {Function} props.onPageChange - Page change handler (page) => void
 * @param {number} props.siblingCount - Number of siblings around current page (default: 1)
 * @param {number} props.boundaryCount - Number of boundary pages (default: 1)
 * @param {boolean} props.showPaginationControls - Show prev/next buttons (default: true)
 * @param {boolean} props.paginationDisabled - Disable pagination (default: false)
 * @param {string} props.paginationClassName - Additional pagination wrapper classes
 * @param {Object} props.paginationMeta - Pagination meta info { from, to, total }
 * @param {boolean} props.showPaginationInfo - Show "Showing X to Y of Z" (default: true)
 */
export default function Table({
    // Data props
    columns = [],
    data = [],
    keyField = 'id',
    emptyMessage = 'No data available',

    // Style props
    className = '',
    tableClassName = '',
    theadClassName = '',
    tbodyClassName = '',
    thClassName = '',
    tdClassName = '',
    rowClassName = '',

    // Behavior props
    onRowClick = null,
    striped = false,
    bordered = false,
    hoverable = false,
    minWidth = '980px',

    // Pagination props
    pagination = false,
    paginationMode = 'server',
    pageSize = 10,
    currentPage = 1,
    totalPages = 1,
    onPageChange = () => {},
    siblingCount = 1,
    boundaryCount = 1,
    showPaginationControls = true,
    paginationDisabled = false,
    paginationClassName = '',
    paginationMeta = null,
    showPaginationInfo = true,
}) {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const isClientPagination = pagination && paginationMode === 'client';
    const resolvedPageSize = Math.max(1, Number(pageSize) || 1);

    const sortedData = useMemo(() => {
        if (!sortConfig.key) return data;

        const activeColumn = columns.find((column) => column.key === sortConfig.key);
        if (!activeColumn) return data;

        return [...data].sort((leftRow, rightRow) => {
            const leftValue = normalizeSortableValue(getSortableValue(activeColumn, leftRow));
            const rightValue = normalizeSortableValue(getSortableValue(activeColumn, rightRow));

            if (typeof leftValue === 'number' && typeof rightValue === 'number') {
                return sortConfig.direction === 'asc'
                    ? leftValue - rightValue
                    : rightValue - leftValue;
            }

            const result = String(leftValue).localeCompare(String(rightValue), undefined, {
                numeric: true,
                sensitivity: 'base',
            });

            return sortConfig.direction === 'asc' ? result : result * -1;
        });
    }, [columns, data, sortConfig]);

    const effectiveTotalPages = useMemo(() => {
        if (!pagination) return 1;

        if (isClientPagination) {
            return Math.max(1, Math.ceil(sortedData.length / resolvedPageSize));
        }

        return totalPages;
    }, [isClientPagination, pagination, resolvedPageSize, sortedData.length, totalPages]);

    const effectiveCurrentPage = useMemo(
        () => Math.min(Math.max(currentPage, 1), effectiveTotalPages),
        [currentPage, effectiveTotalPages],
    );

    const visibleData = useMemo(() => {
        if (!isClientPagination) {
            return sortedData;
        }

        const startIndex = (effectiveCurrentPage - 1) * resolvedPageSize;

        return sortedData.slice(startIndex, startIndex + resolvedPageSize);
    }, [effectiveCurrentPage, isClientPagination, resolvedPageSize, sortedData]);

    // Pagination range calculation
    const paginationRange = useMemo(() => {
        if (!pagination || effectiveTotalPages <= 0) return [];

        const totalPageNumbers = siblingCount * 2 + boundaryCount * 2 + 3;
        if (effectiveTotalPages <= totalPageNumbers) return range(1, effectiveTotalPages);

        const leftSiblingIndex = Math.max(effectiveCurrentPage - siblingCount, boundaryCount + 2);
        const rightSiblingIndex = Math.min(effectiveCurrentPage + siblingCount, effectiveTotalPages - boundaryCount - 1);

        const showLeftDots = leftSiblingIndex > boundaryCount + 2;
        const showRightDots = rightSiblingIndex < effectiveTotalPages - (boundaryCount + 1);

        const firstSection = range(1, boundaryCount);
        const lastSection = range(effectiveTotalPages - boundaryCount + 1, effectiveTotalPages);
        const middleSection = range(leftSiblingIndex, rightSiblingIndex);

        if (!showLeftDots && showRightDots) {
            const leftRange = range(1, boundaryCount + siblingCount * 2 + 2);
            return [...leftRange, DOTS, ...lastSection];
        }

        if (showLeftDots && !showRightDots) {
            const rightRange = range(effectiveTotalPages - (boundaryCount + siblingCount * 2 + 1), effectiveTotalPages);
            return [...firstSection, DOTS, ...rightRange];
        }

        return [...firstSection, DOTS, ...middleSection, DOTS, ...lastSection];
    }, [boundaryCount, effectiveCurrentPage, effectiveTotalPages, siblingCount, pagination]);

    const handlePageChange = (page) => {
        if (paginationDisabled || page < 1 || page > effectiveTotalPages || page === effectiveCurrentPage) return;
        onPageChange(page);
    };

    const handleRowClick = (row, index) => {
        if (onRowClick) {
            onRowClick(row, index);
        }
    };

    const isColumnSortable = (column) => {
        if (typeof column.sortable === 'boolean') {
            return column.sortable;
        }

        return !isActionColumn(column);
    };

    const handleSort = (column) => {
        if (!isColumnSortable(column)) return;

        setSortConfig((currentConfig) => {
            if (currentConfig.key !== column.key) {
                return { key: column.key, direction: 'asc' };
            }

            return {
                key: column.key,
                direction: currentConfig.direction === 'asc' ? 'desc' : 'asc',
            };
        });

        if (isClientPagination && effectiveCurrentPage !== 1) {
            onPageChange(1);
        }
    };

    const getRowClassName = (row, index) => {
        let classes = '';

        if (striped && index % 2 !== 0) {
            classes += ' even:bg-gray-100';
        }

        if (hoverable) {
            classes += ' hover:bg-gray-50 transition-colors';
        }

        if (onRowClick) {
            classes += ' cursor-pointer';
        }

        if (typeof rowClassName === 'function') {
            classes += ' ' + rowClassName(row, index);
        } else {
            classes += ' ' + rowClassName;
        }

        return classes.trim();
    };

    const getAlignmentClass = (align) => {
        switch (align) {
            case 'center': return 'text-center';
            case 'right': return 'text-right';
            default: return 'text-left';
        }
    };

    const baseButtonClasses =
        'px-3 py-1 text-sm rounded border transition-colors duration-150 focus:outline-none focus:ring-offset-1 focus:ring-blue-300 disabled:cursor-not-allowed';

    return (
        <div className={`${className}`}>
            {/* Table */}
            <div className="overflow-x-auto">
                <table
                    className={`w-full text-left text-sm border-separate border-spacing-0 ${tableClassName}`}
                    style={{ minWidth }}
                >
                    <thead className={`text-[#0f172a] ${theadClassName}`}>
                        <tr className="bg-white border-b border-gray-500">
                            {columns.map((column) => {
                                const sortable = isColumnSortable(column);
                                const isSortedColumn = sortConfig.key === column.key;
                                const ariaSort = !sortable
                                    ? undefined
                                    : isSortedColumn
                                        ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending')
                                        : 'none';

                                return (
                                    <th
                                        key={column.key}
                                        aria-sort={ariaSort}
                                        className={`py-4 px-5 font-medium border-b border-gray-200 ${getAlignmentClass(column.align)} ${column.headerClassName || ''} ${thClassName}`}
                                    >
                                        {sortable ? (
                                            <button
                                                type="button"
                                                onClick={() => handleSort(column)}
                                                className={`inline-flex items-center gap-2 transition-colors hover:text-[#338dff] ${column.align === 'right' ? 'ml-auto' : ''}`}
                                            >
                                                <span>{column.label}</span>
                                                <span
                                                    className={`text-xs leading-none ${
                                                        isSortedColumn ? 'text-[#338dff]' : 'text-slate-400'
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    {isSortedColumn && (sortConfig.direction === 'asc' ? '^' : 'v')}
                                                </span>
                                            </button>
                                        ) : (
                                            column.label
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className={`divide-y divide-[#e2e8f0] text-[#1f2937] ${tbodyClassName}`}>
                        {visibleData.length > 0 ? (
                            visibleData.map((row, index) => (
                                <tr
                                    key={row[keyField] ?? index}
                                    className={getRowClassName(row, index)}
                                    onClick={() => handleRowClick(row, index)}
                                >
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={`py-4 px-5 ${getAlignmentClass(column.align)} ${column.className || ''} ${tdClassName}`}
                                        >
                                            {column.render
                                                ? column.render(row[column.key], row, index)
                                                : row[column.key]
                                            }
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="py-6 px-5 text-center text-sm text-slate-500"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && paginationRange.length > 0 && (
                <div
                    className={`flex flex-wrap items-center justify-between gap-2 p-4`}
                >
                    {/* Pagination Info */}
                    {/* {showPaginationInfo && paginationMeta && (
                        <div className="text-sm text-gray-600">
                            Showing {paginationMeta.from || 0} to {paginationMeta.to || 0} of {paginationMeta.total || 0} entries
                        </div>
                    )} */}

                    {/* Pagination Controls */}
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                        {/* LEFT ARROW */}
                        {showPaginationControls && (
                            <button
                                type="button"
                                onClick={() => handlePageChange(effectiveCurrentPage - 1)}
                                disabled={paginationDisabled || effectiveCurrentPage === 1}
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
                                aria-label="Go to previous page"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15.1602 7.41L10.5802 12L15.1602 16.59L13.7502 18L7.75016 12L13.7502 6L15.1602 7.41Z" fill="#F1F1F1"/>
                                </svg>
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

                            const isActive = page === effectiveCurrentPage;

                            return (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => handlePageChange(page)}
                                    disabled={paginationDisabled}
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
                        {showPaginationControls && (
                            <button
                                type="button"
                                onClick={() => handlePageChange(effectiveCurrentPage + 1)}
                                disabled={paginationDisabled || effectiveCurrentPage === effectiveTotalPages}
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
                                aria-label="Go to next page"
                            >
                                &gt;
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
