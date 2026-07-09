import React, { useCallback, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import StatsCard from '../Components/StatsCard';
import Table from '../../../Components/Common/Table';
import Card from '../../../Components/Common/Card';
import Drawer from '../Components/Drawer';
import { useTranslation } from 'react-i18next';

const formatLabel = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
        return '--';
    }

    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatAmount = (value) => {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
        return '0.00';
    }

    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const hasDisplayValue = (value) => {
    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value === 'string') {
        return value.trim() !== '';
    }

    return true;
};

const firstPresent = (...values) => values.find((value) => hasDisplayValue(value));

const formatDateTime = (value) => {
    if (!hasDisplayValue(value)) {
        return '--';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const parseMetadata = (metadata) => {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        return metadata;
    }

    if (typeof metadata === 'string') {
        try {
            const parsed = JSON.parse(metadata);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch {
            return {};
        }
    }

    return {};
};

const readByPath = (source, path) => (
    path.split('.').reduce((current, segment) => {
        if (current && typeof current === 'object') {
            return current[segment];
        }

        return undefined;
    }, source)
);

const readMetadata = (metadata, keyPaths = []) => (
    firstPresent(...keyPaths.map((keyPath) => readByPath(metadata, keyPath)))
);

const toDirectionLabel = (type, t) => {
    const normalized = String(type ?? '').trim().toLowerCase();

    if (normalized === 'debit') {
        return t('statusPaid');
    }

    if (normalized === 'credit') {
        return t('superAdminEarningsDirectionReceived');
    }

    return formatLabel(type);
};

const buildPaginationMeta = (wallets) => ({
    currentPage: wallets?.current_page ?? 1,
    totalPages: wallets?.last_page ?? 1,
    from: wallets?.from ?? 0,
    to: wallets?.to ?? 0,
    total: wallets?.total ?? 0,
});

export default function Index({ wallets, stats = {} }) {   
    const { t } = useTranslation();
    const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [walletTransactions, setWalletTransactions] = useState([]);
    const [walletTransactionsMeta, setWalletTransactionsMeta] = useState({
        currentPage: 1,
        totalPages: 1,
        from: 0,
        to: 0,
        total: 0,
    });
    const [walletTransactionsLoading, setWalletTransactionsLoading] = useState(false);
    const [walletTransactionsError, setWalletTransactionsError] = useState('');

    const walletRows = useMemo(() => {
        const data = Array.isArray(wallets) ? wallets : wallets?.data;

        if (!Array.isArray(data)) {
            return [];
        }

        return data.map((wallet) => ({
            ...wallet,
            name: wallet?.name?.trim() || '--',
            type: formatLabel(wallet?.type),
            role: formatLabel(wallet?.role),
            balance: Number(wallet?.balance ?? 0),
            held_balance: Number(wallet?.held_balance ?? 0),
            today_cod_collect: Number(wallet?.today_cod_collect ?? 0),
            total_cod_collect: Number(wallet?.total_cod_collect ?? 0),
        }));
    }, [wallets]);

    const paginationMeta = useMemo(() => buildPaginationMeta(wallets), [wallets]);

    const normalizedWalletTransactions = useMemo(
        () => walletTransactions.map((transaction) => {
            const metadata = parseMetadata(transaction?.metadata);
            const direction = toDirectionLabel(transaction?.type, t);
            let paymentMethod = firstPresent(
                transaction?.payment_method,
                readMetadata(metadata, [
                    'payment_method',
                    'gateway.name',
                    // 'create.local_invoice.payment_name',
                    'method',
                    'receiver_payment_method',
                    'reciever_payment_method',
                ]),
            );


            if(paymentMethod){
                paymentMethod = t('paymentMethodCard');
            }
            const paymentGateway = firstPresent(
                transaction?.payment_gateway,
                readMetadata(metadata, [
                    'payment_gateway',
                    // 'gateway',
                    'gateway.name',
                    // 'create.local_invoice.payment_name',
                    'receiver_payment_gateway',
                    'reciever_payment_gateway',
                    'gateway_name',
                ]),
            );
            const paidAt = firstPresent(
                transaction?.paid_at,
                readMetadata(metadata, [
                    'paid_at',
                    'sender_paid_at',
                    'payment_paid_at',
                    'payment.paid_at',
                ]),
                transaction?.type === 'debit' ? transaction?.created_at : null,
            );
            const receivedAt = firstPresent(
                transaction?.received_at,
                readMetadata(metadata, [
                    'received_at',
                    'receiver_paid_at',
                    'reciever_paid_at',
                    'payment.received_at',
                ]),
                transaction?.type === 'credit' ? transaction?.created_at : null,
            );

            return {
                ...transaction,
                metadata,
                direction,
                paymentMethod,
                paymentGateway,
                paidAt,
                receivedAt,
                shipmentOrderNumber: readMetadata(metadata, ['shipment_order_number', 'context.order_number', 'order_number']),
                reason: readMetadata(metadata, ['reason', 'description']),
            };
        }),
        [walletTransactions, t],
    );

    const statsCards = useMemo(() => [
        {
            title: t('commonTotalEarning'),
            value: stats?.total_earning ?? 0,
            isSpecialCard: true,
        },
        {
            title: t('commonTotalCodCollected'),
            value: stats?.total_cod_collected ?? 0,
        },
        {
            title: t('commonTotalOnlinePayments'),
            value: stats?.total_online_payments ?? 0,
        },
        {
            title: t('commonOverdueSettlements'),
            value: stats?.overdue_settlements ?? 0,
        },
        // {
        //     title: 'Unassigned',
        //     value: stats?.unassigned ?? 0,
        // },
    ], [stats, t]);

    const fetchWalletTransactions = useCallback(async (walletId, page = 1) => {
        setWalletTransactionsLoading(true);
        setWalletTransactionsError('');

        try {
            const query = new URLSearchParams({ page: String(page) });
            const response = await fetch(`/admin/wallets/transactions/${walletId}?${query.toString()}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                throw new Error(t('superAdminEarningsTransactionsLoadFailedWithStatus', { status: response.status }));
            }

            const payload = await response.json();
            const transactions = Array.isArray(payload?.data) ? payload.data : [];

            setWalletTransactions(transactions);
            setWalletTransactionsMeta(buildPaginationMeta(payload));
        } catch (error) {
            setWalletTransactions([]);
            setWalletTransactionsMeta({
                currentPage: 1,
                totalPages: 1,
                from: 0,
                to: 0,
                total: 0,
            });
            setWalletTransactionsError(error instanceof Error ? error.message : t('superAdminEarningsTransactionsFetchError'));
        } finally {
            setWalletTransactionsLoading(false);
        }
    }, [t]);

    const openDetailsDrawer = useCallback((wallet) => {
        if (!wallet?.id) {
            return;
        }

        setSelectedWallet(wallet);
        setIsDetailsDrawerOpen(true);
        setWalletTransactions([]);
        setWalletTransactionsError('');
        setWalletTransactionsMeta({
            currentPage: 1,
            totalPages: 1,
            from: 0,
            to: 0,
            total: 0,
        });
        fetchWalletTransactions(wallet.id, 1);
    }, [fetchWalletTransactions]);

    const closeDetailsDrawer = useCallback(() => {
        setIsDetailsDrawerOpen(false);
    }, []);

    const handleWalletTransactionsPageChange = useCallback((page) => {
        if (!selectedWallet?.id) {
            return;
        }

        fetchWalletTransactions(selectedWallet.id, page);
    }, [fetchWalletTransactions, selectedWallet]);

    const columns = useMemo(() => [
        {
            key: 'name',
            label: t('commonName'),
            className: 'whitespace-nowrap font-medium text-neutral-900',
        },
        {
            key: 'type',
            label: t('commonType'),
            className: 'whitespace-nowrap text-neutral-900',
        },
        {
            key: 'role',
            label: t('commonRole'),
            className: 'whitespace-nowrap text-neutral-900',
        },
        {
            key: 'balance',
            label: t('superAdminEarningsColumnDueAmount'),
            align: 'right',
            headerClassName: 'text-right',
            className: 'whitespace-nowrap text-neutral-900',
            render: (value) => formatAmount(value),
        },
        {
            key: 'held_balance',
            label: t('superAdminEarningsColumnHoldAmount'),
            align: 'right',
            headerClassName: 'text-right',
            className: 'whitespace-nowrap text-neutral-900',
            render: (value) => formatAmount(value),
        },
        {
            key: 'today_cod_collect',
            label: t('superAdminEarningsColumnTodaysCodCollected'),
            align: 'right',
            headerClassName: 'text-right',
            className: 'whitespace-nowrap text-neutral-900',
            render: (value) => formatAmount(value),
        },
        {
            key: 'total_cod_collect',
            label: t('commonTotalCodCollected'),
            align: 'right',
            headerClassName: 'text-right',
            className: 'whitespace-nowrap text-neutral-900',
            render: (value) => formatAmount(value),
        },
        {
            key: 'action',
            label: t('commonAction'),
            align: 'right',
            headerClassName: 'text-right',
            className: 'whitespace-nowrap text-right',
            render: (_value, row) => (
                <button
                    type="button"
                    onClick={() => openDetailsDrawer(row)}
                    className="text-neutral-900 text-sm font-14px underline cursor-pointer hover:text-blue-600"
                >
                    {t('commonViewDetails')}
                </button>
            ),
        },
    ], [openDetailsDrawer, t]);

    const handlePageChange = (page) => {
        const params = Object.fromEntries(new URLSearchParams(window.location.search).entries());

        router.get(
            route('admin.earnings-summary.index'),
            {
                ...params,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <SuperAdminAuthenticated
            headerContent={(
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('commonEarningsSummary')}</h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <span className="font-medium text-gray-500">{t('commonEarningsSummary')}</span>
                    </nav>
                </div>
            )}
        >
            <Head title={t('commonEarningsSummary')} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
                {statsCards.map((card) => (
                    <StatsCard
                        key={card.title}
                        title={card.title}
                        value={card.value}
                        iconSrc="/assets/images/wallet-money.svg"
                        accentColor="#338dff"
                        isSpecialCard={card.isSpecialCard ?? false}
                    />
                ))}
            </div>

            <Card
                title={t('superAdminEarningsCardTitle')}
                subtitle={`${paginationMeta.total} ${paginationMeta.total === 1 ? t('superAdminEarningsWalletSingular') : t('superAdminEarningsWalletPlural')}`}
                padding="none"
                className="border border-[#e2e8f0] bg-white shadow-sm"
                headerClassName="px-5 py-4"
                contentClassName="px-5 pb-5"
            >
                <Table
                    className="overflow-hidden rounded-[20px]"
                    columns={columns}
                    data={walletRows}
                    keyField="id"
                    hoverable
                    minWidth="1280px"
                    tableClassName="min-w-[1280px]"
                    theadClassName="bg-[#f8fafc] text-neutral-900"
                    tbodyClassName="text-neutral-900"
                    thClassName="font-medium"
                    tdClassName="text-sm"
                    rowClassName={(_row, index) => (index % 2 !== 0 ? 'bg-[#f8fafc]' : '')}
                    pagination
                    currentPage={paginationMeta.currentPage}
                    totalPages={paginationMeta.totalPages}
                    onPageChange={handlePageChange}
                    paginationMeta={paginationMeta}
                    showPaginationInfo
                    emptyMessage={t('superAdminEarningsNoWalletsFound')}
                />
            </Card>

            <Drawer
                open={isDetailsDrawerOpen}
                onClose={closeDetailsDrawer}
                showCloseButton={false}
                closeOnOverlayClick
                closeOnEsc
                panelClassName="flex h-full w-full max-w-[420px] sm:max-w-[460px] flex-col border border-[#d8dee9] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.25)] rounded-l-[28px]"
                containerClassName="flex items-stretch justify-end"
                headerClassName="px-6 pt-6 pb-4 border-b border-[#e2e8f0]"
                bodyClassName="flex-1 overflow-y-auto px-6 pb-6 pt-5 space-y-4"
                overlayClassName="bg-black/30 backdrop-blur-[1px]"
                header={
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-[#0f172a]">
                                {selectedWallet?.name ?? t('commonWallet')}
                            </h2>
                            <p className="text-sm text-[#64748b]">
                                {selectedWallet ? `${selectedWallet.type} · ${selectedWallet.role}` : t('superAdminEarningsWalletTransactions')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeDetailsDrawer}
                            className="rounded-full p-1 text-[#64748b] text-4xl leading-none hover:text-[#1f2937]"
                        >
                            ×
                        </button>
                    </div>
                }
                footerClassName="px-6 pb-6 pt-4 border-t border-[#e2e8f0]"
                footer={
                    walletTransactionsMeta.totalPages > 1 ? (
                        <div className="flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => handleWalletTransactionsPageChange(walletTransactionsMeta.currentPage - 1)}
                                disabled={walletTransactionsLoading || walletTransactionsMeta.currentPage <= 1}
                                className="rounded-full border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t('commonPrevious')}
                            </button>
                            <span className="text-sm text-[#64748b]">
                                {t('superAdminEarningsPageOf', {
                                    current: walletTransactionsMeta.currentPage,
                                    total: walletTransactionsMeta.totalPages,
                                })}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleWalletTransactionsPageChange(walletTransactionsMeta.currentPage + 1)}
                                disabled={walletTransactionsLoading || walletTransactionsMeta.currentPage >= walletTransactionsMeta.totalPages}
                                className="rounded-full border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t('commonPrevious')}
                            </button>
                        </div>
                    ) : null
                }
            >
                {walletTransactionsLoading ? (
                    <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-6 text-sm text-[#475569]">
                        {t('superAdminEarningsLoadingTransactions')}
                    </div>
                ) : walletTransactionsError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {walletTransactionsError}
                    </div>
                ) : normalizedWalletTransactions.length === 0 ? (
                    <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-6 text-sm text-[#475569]">
                        {t('superAdminEarningsNoTransactionsFound')}
                    </div>
                ) : (
                    normalizedWalletTransactions.map((transaction) => (
                        <div
                            key={transaction.id}
                            className="rounded-2xl border border-[#e2e8f0] bg-white p-4 space-y-3"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-[#0f172a]">
                                        {t('superAdminEarningsTransactionNumber', { id: transaction.id })}
                                    </p>
                                    <p className="text-xs text-[#64748b]">
                                        {formatDateTime(transaction.created_at)}
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200`}
                                >
                                    {transaction.direction}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs font-medium text-[#64748b]">{t('commonAmount')}</p>
                                    <p className="font-semibold text-[#0f172a]">{formatAmount(transaction.amount)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-[#64748b]">{t('commonStatus')}</p>
                                    <p className="font-semibold text-[#0f172a]">{formatLabel(transaction.status)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-[#64748b]">{t('commonPaidAt')}</p>
                                    <p className="font-semibold text-[#0f172a]">{formatDateTime(transaction.paidAt)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-[#64748b]">{t('superAdminEarningsDetailReceivedAt')}</p>
                                    <p className="font-semibold text-[#0f172a]">{formatDateTime(transaction.receivedAt)}</p>
                                </div>
                                {/* <div>
                                    <p className="text-xs font-medium text-[#64748b]">Payment Method</p>
                                    <p className="font-semibold text-[#0f172a]">
                                        {hasDisplayValue(transaction.paymentMethod) ? formatLabel(transaction.paymentMethod) : '--'}
                                    </p>
                                </div> */}
                                <div>
                                    <p className="text-xs font-medium text-[#64748b]">{t('commonPaymentGateway')}</p>
                                    <p className="font-semibold text-[#0f172a]">
                                        {hasDisplayValue(transaction.paymentGateway) ? formatLabel(transaction.paymentGateway) : '--'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-[#e2e8f0] pt-3 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-xs font-medium text-[#64748b]">{t('superAdminEarningsDetailShipmentOrder')}</span>
                                    <span className="text-right font-semibold text-[#0f172a]">
                                        {hasDisplayValue(transaction.shipmentOrderNumber) ? transaction.shipmentOrderNumber : '--'}
                                    </span>
                                </div>
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-xs font-medium text-[#64748b]">{t('commonDescription')}</span>
                                    <span className="text-right font-semibold text-[#0f172a]">
                                        {hasDisplayValue(transaction.description) ? transaction.description : '--'}
                                    </span>
                                </div>
                                {/* <div className="flex items-start justify-between gap-3">
                                    <span className="text-xs font-medium text-[#64748b]">Reason</span>
                                    <span className="text-right font-semibold text-[#0f172a]">
                                        {hasDisplayValue(transaction.reason) ? transaction.reason : '--'}
                                    </span>
                                </div> */}
                            </div>
                        </div>
                    ))
                )}
            </Drawer>
        </SuperAdminAuthenticated>
    );
}
