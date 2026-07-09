import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import Table from '../../../Components/Common/Table';
import Card from '../../../Components/Common/Card';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

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

export default function Index({ zonePrices = [], filters = {} }) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [currentPage, setCurrentPage] = useState(1);
    const [isSyncingZonePrices, setIsSyncingZonePrices] = useState(false);
    const [isExportingCsv, setIsExportingCsv] = useState(false);

    const filteredZonePrices = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        if (!normalizedSearch) {
            return zonePrices;
        }

        return zonePrices.filter((item) =>
            String(item?.name ?? '').toLowerCase().includes(normalizedSearch)
        );
    }, [searchTerm, zonePrices]);

    const totalPages = Math.max(1, Math.ceil(filteredZonePrices.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedZonePrices = useMemo(() => {
        const start = (safeCurrentPage - 1) * PAGE_SIZE;
        return filteredZonePrices.slice(start, start + PAGE_SIZE);
    }, [filteredZonePrices, safeCurrentPage]);

    const paginationMeta = useMemo(() => ({
        currentPage: safeCurrentPage,
        totalPages,
        from: filteredZonePrices.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1,
        to: filteredZonePrices.length === 0 ? 0 : Math.min(filteredZonePrices.length, safeCurrentPage * PAGE_SIZE),
        total: filteredZonePrices.length,
    }), [filteredZonePrices.length, safeCurrentPage, totalPages]);

    const tableColumns = useMemo(() => ([
        {
            key: 'no',
            label: t('superAdminPricingColumnNo'),
            render: (_value, _row, index) => String((safeCurrentPage - 1) * PAGE_SIZE + index + 1).padStart(2, '0'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'name',
            label: t('commonCity'),
            render: (value) => value ?? '--',
            className: 'whitespace-nowrap',
        },
        {
            key: 'price',
            label: t('superAdminPricingColumnPrice1'),
            render: (value) => value ?? '--',
            className: 'whitespace-nowrap',
        },
        {
            key: 'price1',
            label: t('superAdminPricingColumnPrice2'),
            render: (value) => value ?? '--',
            className: 'whitespace-nowrap',
        },
        {
            key: 'price2',
            label: t('superAdminPricingColumnPrice3'),
            render: (value) => value ?? '--',
            className: 'whitespace-nowrap',
        },
        {
            key: 'price3',
            label: t('superAdminPricingColumnPrice4'),
            render: (value) => value ?? '--',
            className: 'whitespace-nowrap',
        },
        {
            key: 'price4',
            label: t('superAdminPricingColumnPrice5'),
            render: (value) => value ?? '--',
            className: 'whitespace-nowrap',
        },
        {
            key: 'price5',
            label: t('superAdminPricingColumnPrice6'),
            render: (value) => value ?? '--',
            className: 'whitespace-nowrap',
        },
    ]), [safeCurrentPage, t]);

    const handleExportCsv = async () => {
        try {
            setIsExportingCsv(true);

            if (!filteredZonePrices.length) {
                window.alert(t('superAdminPricingExportNoZonePrices'));
                return;
            }

            const headers = [
                t('superAdminPricingColumnNo'),
                t('commonCity'),
                t('superAdminPricingColumnPrice1'),
                t('superAdminPricingColumnPrice2'),
                t('superAdminPricingColumnPrice3'),
                t('superAdminPricingColumnPrice4'),
                t('superAdminPricingColumnPrice5'),
                t('superAdminPricingColumnPrice6'),
            ];
            const rows = filteredZonePrices.map((row, index) => ([
                index + 1,
                row?.name ?? '',
                row?.price ?? '',
                row?.price1 ?? '',
                row?.price2 ?? '',
                row?.price3 ?? '',
                row?.price4 ?? '',
                row?.price5 ?? '',
            ]));

            const csvContent = [headers, ...rows]
                .map((row) => row.map((value) => formatCSVValue(value)).join(','))
                .join('\r\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `zone-prices-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } finally {
            setIsExportingCsv(false);
        }
    };

    const handleSyncZonePrices = () => {
        setIsSyncingZonePrices(true);
        router.post(route('admin.zones.sync-prices'), {}, {
            preserveScroll: true,
            preserveState: true,
            onError: (syncErrors) => {
                console.error('Error syncing zone prices:', syncErrors);
            },
            // onSuccess: () => {
            //     window.location.reload();
            // },
            onFinish: () => {
                setIsSyncingZonePrices(false);
            },
        });
    };

    return (
        <SuperAdminAuthenticated
            headerContent={(
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-[#0f172a]">{t('commonPricingManagement')}</h1>
                        <nav className="text-sm text-[#64748b]">
                            {t('commonHome')} <span className="mx-1 text-slate-500">›</span>
                            <span className="font-medium text-blue-500">{t('commonPricingManagement')}</span>
                        </nav>
                    </div>
                </div>
            )}
        >
            <Head title={t('commonPricingManagement')} />

            <div className="space-y-8">
                <Card
                    title={t('superAdminPricingCardTitle')}
                    padding="none"
                    className="border border-[#e2e8f0] bg-white shadow-sm"
                    headerClassName="px-5 py-4"
                    toolbarClassName="flex-1"
                    toolbar={(
                        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-end">
                            <div className="relative w-full md:w-80">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65Z"
                                    />
                                </svg>
                                <input
                                    type="text"
                                    placeholder={t('superAdminPricingSearchByZoneName')}
                                    value={searchTerm}
                                    onChange={(event) => {
                                        setSearchTerm(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white py-2.5 pl-11 pr-4 text-sm text-[#1f2937] focus:outline-none focus:ring-4 focus:ring-[#338dff33]"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleSyncZonePrices}
                                disabled={isSyncingZonePrices}
                                className="h-10 rounded-full bg-[#338dff] px-5 text-sm font-semibold text-white transition hover:bg-[#1f7df5] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isSyncingZonePrices ? (
                                    <span className="inline-flex items-center gap-2">
                                        <svg
                                            className="h-4 w-4 animate-spin"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                                        </svg>
                                        {t('commonSyncingZonePrices')}
                                    </span>
                                ) : t('commonSyncZonePrices')}
                            </button>

                            <button
                                type="button"
                                onClick={handleExportCsv}
                                disabled={isExportingCsv}
                                className="h-10 rounded-full border border-[#0f172a] px-5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isExportingCsv ? t('commonExportingCsv') : t('commonExportCsv')}
                            </button>
                        </div>
                    )}
                    contentClassName="px-5 pb-5"
                >
                    <Table
                        className="overflow-hidden rounded-[20px]"
                        columns={tableColumns}
                        data={filteredZonePrices}
                        keyField="id"
                        striped
                        hoverable
                        pagination
                        paginationMode="client"
                        pageSize={PAGE_SIZE}
                        currentPage={paginationMeta.currentPage}
                        totalPages={paginationMeta.totalPages}
                        onPageChange={setCurrentPage}
                        paginationMeta={paginationMeta}
                        showPaginationInfo
                        minWidth="1100px"
                        tableClassName="min-w-[1100px]"
                        theadClassName="bg-[#f8fafc] text-[#0f172a]"
                        tbodyClassName="text-[#1f2937]"
                        thClassName="font-medium"
                        tdClassName="text-sm"
                        paginationClassName="border-t border-gray-100 bg-[#f8fafc] px-5"
                    />
                </Card>
            </div>
        </SuperAdminAuthenticated>
    );
}
