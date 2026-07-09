import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import StatsCard from '../Components/StatsCard';
import Table from '../../../Components/Common/Table';
import Card from '../../../Components/Common/Card';
import Menu from '../../../Components/Common/Menu';
import PrimaryButton from '../Components/PrimaryButton';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const normalizeValue = (value) => (value ?? '').toString().toLowerCase();

const formatDate = (value, options = {}) => {
    if (!value) {
        return '--';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '--';
    }

    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...options,
    });
};

const getStatusPillClass = (status) => {
    const normalized = normalizeValue(status);
    if (normalized === 'active') {
        return 'bg-green-50 text-green-600 border border-green-600';
    }
    if (normalized === 'pending') {
        return 'bg-amber-50 text-amber-500 border border-amber-500';
    }
    if (normalized === 'inactive') {
        return 'bg-red-50 text-red-600 border border-red-600';
    }
    return 'bg-gray-50 text-gray-500 border border-gray-300';
};

export default function Index({ customers = [] }) {
    const { t } = useTranslation();
    const tableData = useMemo(() => (Array.isArray(customers) ? customers : []), [customers]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('Newest First');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const sortTriggerRef = useRef(null);
    const sortMenuRef = useRef(null);
    const exportTriggerRef = useRef(null);
    const exportMenuRef = useRef(null);

    const statsCards = useMemo(() => {
        let active = 0;
        let pending = 0;
        let inactive = 0;

        tableData.forEach((customer) => {
            const status = normalizeValue(customer.status);
            if (status === 'active') active += 1;
            if (status === 'pending') pending += 1;
            if (status === 'inactive') inactive += 1;
        });

        return [
            {
                title: t('superAdminCustomersStatTotalCustomers'),
                value: tableData.length,
                iconSrc: '/assets/images/user_managment.svg',
                accentColor: '#338dff',
                isSpecialCard: true,
            },
            {
                title: t('statusActive'),
                value: active,
                iconSrc: '/assets/images/Parcel.svg',
                accentColor: '#338dff',
            },
            {
                title: t('statusPending'),
                value: pending,
                iconSrc: '/assets/images/keepers.svg',
                accentColor: '#338dff',
            },
            {
                title: t('statusInactive'),
                value: inactive,
                iconSrc: '/assets/images/role_managment.svg',
                accentColor: '#338dff',
            },
        ];
    }, [tableData, t]);

    const sortOptions = useMemo(
        () => [
            { label: t('commonNewestFirst'), value: 'Newest First' },
            { label: t('commonName'), value: 'Name' },
            { label: t('commonStatus'), value: 'Status' },
            { label: t('commonOrders'), value: 'Orders' },
            { label: t('commonCity'), value: 'City' },
        ],
        [t],
    );

    const exportMenuItems = useMemo(() => ([
        { label: t('commonExportCsv'), value: 'csv' },
        { label: t('commonExportExcel'), value: 'excel' },
    ]), [t]);

    useEffect(() => {
        if (!showSortMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                !sortTriggerRef.current?.contains(event.target) &&
                !sortMenuRef.current?.contains(event.target)
            ) {
                setShowSortMenu(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowSortMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showSortMenu]);

    useEffect(() => {
        if (!showExportMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                !exportTriggerRef.current?.contains(event.target) &&
                !exportMenuRef.current?.contains(event.target)
            ) {
                setShowExportMenu(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowExportMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showExportMenu]);

    const filteredCustomers = useMemo(() => {
        const normalizedSearch = normalizeValue(searchQuery).trim();
        let result = tableData;

        if (normalizedSearch) {
            result = result.filter((customer) => {
                const fields = [
                    customer.name,
                    customer.email,
                    customer.phone_number,
                    customer.status,
                    customer.city,
                    customer.country,
                    customer.business_type,
                    customer.trade_license_number,
                    customer.shipments_count,
                ];

                return fields.some((field) => normalizeValue(field).includes(normalizedSearch));
            });
        }

        const comparators = {
            'Newest First': (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
            Name: (a, b) => normalizeValue(a.name).localeCompare(normalizeValue(b.name)),
            Status: (a, b) => normalizeValue(a.status).localeCompare(normalizeValue(b.status)),
            Orders: (a, b) => (b.shipments_count ?? 0) - (a.shipments_count ?? 0),
            City: (a, b) => normalizeValue(a.city).localeCompare(normalizeValue(b.city)),
        };

        const comparator = comparators[sortBy] ?? comparators['Newest First'];
        return [...result].sort(comparator);
    }, [searchQuery, sortBy, tableData]);

    const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredCustomers.slice(start, start + PAGE_SIZE);
    }, [filteredCustomers, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginationMeta = useMemo(() => {
        if (filteredCustomers.length === 0) {
            return { from: 0, to: 0, total: 0 };
        }
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = Math.min(start + paginatedCustomers.length, filteredCustomers.length);
        return {
            from: start + 1,
            to: end,
            total: filteredCustomers.length,
        };
    }, [filteredCustomers.length, currentPage, paginatedCustomers.length]);

    const formatCSVValue = (value) => {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value);
        if (/[",\n\r]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
    };

    const handleExportCustomers = (format) => {
        if (!filteredCustomers.length) {
            window.alert(t('superAdminCustomersExportNoData'));
            return;
        }

        const headers = [
            t('superAdminCustomersColumnId'),
            t('commonCustomerName'),
            t('commonEmail'),
            t('commonPhoneNumber'),
            t('commonAddress'),
            t('commonStatus'),
            t('commonOrders'),
            t('commonMemberSince'),
        ];

        const rows = filteredCustomers.map((customer) => [
            customer.id ?? '',
            customer.name ?? '',
            customer.email ?? '',
            customer.phone_number ?? '',
            customer.city ?? '',
            customer.status ?? '',
            customer.shipments_count ?? 0,
            formatDate(customer.member_since),
        ]);

        const dateSuffix = new Date().toISOString().slice(0, 10);

        if (format === 'excel') {
            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, t('superAdminCustomersSheetName'));
            XLSX.writeFile(workbook, `customers-export-${dateSuffix}.xlsx`);
            return;
        }

        const csvContent = [headers, ...rows]
            .map((row) => row.map((value) => formatCSVValue(value)).join(','))
            .join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `customers-export-${dateSuffix}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const tableColumns = useMemo(() => [
        {
            key: 'id',
            label: t('superAdminCustomersColumnId'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'name',
            label: t('commonCustomerName'),
            className: 'whitespace-nowrap text-neutral-900',
        },
        {
            key: 'email',
            label: t('commonEmail'),
            className: 'whitespace-nowrap text-neutral-900',
        },
        {
            key: 'phone_number',
            label: t('commonPhoneNumber'),
            className: 'whitespace-nowrap text-neutral-900',
            render: (_value, row) => row.phone_number ?? t('commonNotAvailable'),
        },
        {
            key: 'city',
            label: t('commonAddress'),
            className: 'whitespace-nowrap text-neutral-900',
            render: (_value, row) => {
                const value = row.city ?? '';
                if (!value) {
                    return t('commonNotAvailable');
                }
                const trimmed = String(value).trim();
                const words = trimmed.split(/\s+/).filter(Boolean);
                if (words.length <= 3) {
                    return trimmed;
                }
                return `${words.slice(0, 3).join(' ')}...`;
            },
        },
        {
            key: 'status',
            label: t('commonStatus'),
            className: 'whitespace-nowrap',
            render: (_value, row) => {
                const normalizedStatus = normalizeValue(row.status);
                const statusLabel = normalizedStatus === 'active'
                    ? t('statusActive')
                    : normalizedStatus === 'pending'
                        ? t('statusPending')
                        : t('statusInactive');
                return (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusPillClass(row.status)}`}>
                        {statusLabel}
                    </span>
                );
            },
        },
        {
            key: 'shipments_count',
            label: t('commonOrders'),
            className: 'whitespace-nowrap text-neutral-900',
            render: (_value, row) => row.shipments_count ?? 0,
        },
        {
            key: 'member_since',
            label: t('commonMemberSince'),
            className: 'whitespace-nowrap text-neutral-900',
            render: (_value, row) => formatDate(row.member_since),
        },
    ], [t]);

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('commonCustomerInformation')}</h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <span className="font-medium text-gray-500">{t('commonCustomerInformation')}</span>
                    </nav>
                </div>
            }
        >
            <Head title={t('commonCustomerInformation')} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {statsCards.map((card) => (
                    <StatsCard
                        key={card.title}
                        title={card.title}
                        value={card.value}
                        iconSrc={card.iconSrc}
                        accentColor={card.accentColor}
                        isSpecialCard={card.isSpecialCard ?? false}
                    />
                ))}
            </div>

            <Card
                title={t('superAdminCustomersAllCustomers')}
                padding="none"
                className="border border-[#e2e8f0] bg-white shadow-sm"
                headerClassName="px-5 py-4"
                toolbarClassName="flex-1"
                toolbar={(
                    <div className="flex flex-col gap-3 w-full md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:max-w-3xl">
                            <div className="relative w-full md:w-60 lg:w-72">
                                <img
                                    src="/assets/images/search.png"
                                    alt={t('superAdminCustomersSearchIconAlt')}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]"
                                />
                                <input
                                    type="text"
                                    placeholder={t('commonSearch')}
                                    className="w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={searchQuery}
                                    onChange={(event) => {
                                        setSearchQuery(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>

                            <div className="relative md:ml-2">
                                <button
                                    type="button"
                                    ref={sortTriggerRef}
                                    onClick={() => setShowSortMenu((prev) => !prev)}
                                    className="inline-flex items-center gap-[6px] rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm transition hover:border-[#94A3B8]"
                                    aria-haspopup="menu"
                                    aria-expanded={showSortMenu}
                                >
                                    <span className="flex items-center gap-[6px]">
                                        <img
                                            src="/assets/images/filter.png"
                                            alt="filter icon"
                                            className="w-[18px] h-[18px] flex-shrink-0"
                                        />
                                        <span className="font-normal text-xs text-gray-500 whitespace-nowrap">
                                            {t('commonSortColon')}
                                        </span>
                                    </span>
                                    <span className="text-sm font-normal text-[#0F172A] truncate">
                                        {sortOptions.find((option) => option.value === sortBy)?.label ?? t('commonNewestFirst')}
                                    </span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-3.5 h-3.5 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {showSortMenu && (
                                    <div ref={sortMenuRef} className="absolute right-0 mt-2 z-40">
                                        <Menu
                                            items={sortOptions}
                                            onItemClick={(item) => {
                                                setSortBy(item.value);
                                                setCurrentPage(1);
                                                setShowSortMenu(false);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative" ref={exportTriggerRef}>
                            <PrimaryButton
                                text={t('superAdminCustomersExportButton')}
                                onClick={() => setShowExportMenu((prev) => !prev)}
                                className="whitespace-nowrap"
                                style={{ padding: '0.5rem 2.5rem' }}
                            />

                            {showExportMenu && (
                                <div ref={exportMenuRef} className="absolute right-0 mt-2 z-40">
                                    <Menu
                                        items={exportMenuItems}
                                        onItemClick={(item) => {
                                            setShowExportMenu(false);
                                            handleExportCustomers(item.value);
                                        }}
                                        anchorRef={exportTriggerRef}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
                contentClassName="px-5 pb-5"
            >
                <Table
                    className="overflow-hidden rounded-[20px]"
                    columns={tableColumns}
                    data={filteredCustomers}
                    keyField="id"
                    striped
                    hoverable
                    minWidth="980px"
                    tableClassName="min-w-[980px]"
                    theadClassName="bg-[#f8fafc] text-neutral-900"
                    tbodyClassName="text-neutral-900"
                    thClassName="font-medium"
                    tdClassName="text-sm"
                    pagination
                    paginationMode="client"
                    pageSize={PAGE_SIZE}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    paginationMeta={paginationMeta}
                    showPaginationInfo
                    paginationClassName="border-t border-gray-100 bg-[#f8fafc] px-5"
                    emptyMessage={t('superAdminCustomersEmptyMessage')}
                />
            </Card>
        </SuperAdminAuthenticated>
    );
}
