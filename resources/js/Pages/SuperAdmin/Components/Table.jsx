import React from 'react';
import { useTranslation } from 'react-i18next';

const noop = () => {};

const defaultStatusClasses = (color) => {
    const colors = {
        yellow: 'border-yellow-400 text-[#FAAD14]',
        blue: 'border-blue-400 text-[#2196F3]',
        green: 'border-green-300 text-[#4CAF50]',
    };

    return colors[color] ?? colors.yellow;
};

export default function DashboardTable({
    columns = [],
    rows = [],
    getStatusClasses = defaultStatusClasses,
    rowKeyFactory = (row, index) => row.id ?? index,
    wrapperClassName = 'bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto',
    tableClassName = 'min-w-[720px] w-full text-sm text-left',
    theadClassName = 'bg-gray-50 text-gray-500 border-b border-gray-200',
    headerRowClassName = '',
    tbodyClassName = 'divide-y',
    rowClassName = 'hover:bg-gray-50 border-gray-200',
    emptyMessage,
    emptyRowClassName = '',
    emptyCellClassName = 'px-4 py-6 text-center text-sm text-gray-500',
}) {
    const { t } = useTranslation();
    const resolvedEmptyMessage = emptyMessage ?? t('superAdminTableEmptyMessage');

    return (
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
                    {rows.length === 0 ? (
                        <tr className={emptyRowClassName}>
                            <td
                                colSpan={columns.length || 1}
                                className={emptyCellClassName}
                            >
                                {resolvedEmptyMessage}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, rowIndex) => (
                            <tr
                                key={rowKeyFactory(row, rowIndex)}
                                className={rowClassName}
                            >
                                {columns.map((column) => {
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
                                                    className="text-gray-500 underline text-sm font-medium"
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
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
