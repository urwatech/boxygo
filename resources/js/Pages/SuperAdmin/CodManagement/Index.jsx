import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import ConfirmDialog from '../../../Components/SuperAdmin/ConfirmDialog';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import StatsCard from '../Components/StatsCard';
import Card from '../../../Components/Common/Card';
import Table from '../../../Components/Common/Table';
import Menu from '../../../Components/Common/Menu';
import PrimaryButton from '../Components/PrimaryButton';
import OutlineButton from '../Components/OutlineButton';
import Popup from '../Components/Popup';
import { useTranslation } from 'react-i18next';

const STATUS_STYLES = {
  collected: 'bg-green-50 text-green-600 border border-green-600',
  pending: 'bg-amber-50 text-amber-500 border border-amber-500',
  pending_collection: 'bg-amber-50 text-amber-500 border border-amber-500',
  overdue: 'bg-red-50 text-red-600 border border-red-600',
  paid: 'bg-green-50 text-green-600 border border-green-600',
  settled: 'bg-green-50 text-green-600 border border-green-600',
};

const STATUS_LABEL_KEYS = {
  collected: 'superAdminCodStatusCollected',
  pending: 'statusPending',
  pending_collection: 'superAdminCodStatusPendingCollection',
  overdue: 'superAdminCodStatusOverdue',
  paid: 'statusPaid',
  settled: 'superAdminCodStatusSettled',
};

const normalizeStatusKey = (status) => {
    if (!status) return '';
    return status
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
};

const toHumanStatus = (status, t) => {
    const key = normalizeStatusKey(status);
    const translationKey = STATUS_LABEL_KEYS[key] ?? 'superAdminCodStatusUnknown';
    return t(translationKey);
};

const parseNumericValue = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const numeric = Number(value.replace(/[^\d.-]/g, ''));
        return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
};

export default function Index({ shipments, stats, riders = [], filters = {} }) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [drawerData, setDrawerData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const sortTriggerRef = useRef(null);
    const sortMenuRef = useRef(null);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorDialogMessage, setErrorDialogMessage] = useState('');
    const [successDialogOpen, setSuccessDialogOpen] = useState(false);
    const [successDialogMessage, setSuccessDialogMessage] = useState('');

    const drawerTotalCodAmount =
        drawerData?.payment?.collectable_total ??
        drawerData?.collectable_total ??
        drawerData?.total_fee ??
        0;
    const parsedDrawerTotalCodAmount = parseNumericValue(drawerTotalCodAmount) ?? 0;

    const paginatedShipments = shipments?.data ?? [];
    const paginationMeta = {
        currentPage: shipments?.current_page ?? 1,
        totalPages: shipments?.last_page ?? 1,
        from: shipments?.from ?? 0,
        to: shipments?.to ?? 0,
        total: shipments?.total ?? 0,
    };

    const riderFilter = filters.rider ?? 'all';

    const riderOptions = useMemo(() => {
        const base = Array.isArray(riders) ? riders : [];
        const fromPage = paginatedShipments
            .map((row) => row.rider)
            .filter((name) => name && name.trim().toLowerCase() !== 'unassigned');
        const unique = Array.from(new Set([...base, ...fromPage]))
            .filter((name) => name && name.trim().toLowerCase() !== 'unassigned')
            .sort((a, b) => a.localeCompare(b));
        return [{ label: t('commonAll'), value: 'all' }, ...unique.map((name) => ({ label: name, value: name }))];
    }, [riders, paginatedShipments, t]);

    const currentRiderLabel = riderOptions.find((option) => option.value === riderFilter)?.label ?? t('commonAll');
    const activeSearch = filters.search ?? '';

    const statsCards = useMemo(() => [
        {
            title: t('commonTotalCodAmount'),
            value: stats.total_cod_amount,
            label: t('commonToday'),
            isSpecialCard: true,
            iconSrc: '/assets/images/card-receive.svg',
        },
        {
            title: t('superAdminCodStatsTotalCollectedAmount'),
            value: stats.total_collected_amount,
            iconSrc: '/assets/images/receipt-discount.svg',
        },
        {
            title: t('superAdminCodStatsReceivableAmount'),
            value: stats.receivable_amount,
            iconSrc: '/assets/images/receipt-discount.svg',
        },
        {
            title: t('superAdminCodStatsOverdueAmount'),
            value: stats.overdue_amount,
            iconSrc: '/assets/images/receipt-discount.svg',
        },
    ], [stats, t]);

    const handleSearch = (term) => {
        const params = { ...filters, page: 1 };
        const trimmed = term.trim();

        setSearchTerm(trimmed);

        if (trimmed) {
            params.search = trimmed;
        } else {
            delete params.search;
        }

        router.get(
            route('admin.cod-management.index'),
            params,
            { preserveState: true, replace: true }
        );
    };

    const handlePageChange = (page) => {
        const params = { ...filters, page };

        if (activeSearch) {
            params.search = activeSearch;
        } else {
            delete params.search;
        }

        router.get(
            route('admin.cod-management.index'),
            params,
            { preserveState: true, replace: true }
        );
    };

    const applyRiderFilter = (value) => {
        setShowSortMenu(false);
        const params = { ...filters, page: 1 };

        if (value === 'all') {
            delete params.rider;
        } else {
            params.rider = value;
        }

        if (activeSearch) {
            params.search = activeSearch;
        } else {
            delete params.search;
        }

        router.get(
            route('admin.cod-management.index'),
            params,
            { preserveState: true, replace: true }
        );
    };

    useEffect(() => {
        if (!showSortMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                !sortMenuRef.current?.contains(event.target) &&
                !sortTriggerRef.current?.contains(event.target)
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

    const openDrawer = async (shipment) => {
        setSelectedShipment(shipment);
        setDrawerOpen(true);
        setLoading(true);

        try {
            // Use axios to fetch data from Inertia endpoint
            const response = await window.axios.get(
                route('admin.cod-management.show', shipment.id),
                {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                    }
                }
            );
            setDrawerData(response.data.props?.shipment);
        } catch (error) {
            console.error('Failed to load drawer data:', error);
            setDrawerData(null);
        } finally {
            setLoading(false);
        }
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setSelectedShipment(null);
        setDrawerData(null);
    };

    const handleMarkAsCollected = async () => {
        if (!selectedShipment) return;

        try {
            // Use explicit URL to avoid any client-side route resolution mismatch
            await window.axios.patch(
                `/admin/cod-management/${selectedShipment.id}/collect`,
                {},
                {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                    },
                }
            );
            // Show success popup; reload after user acknowledges
            closeDrawer();
            setSuccessDialogMessage('COD shipment marked as collected successfully.');
            setSuccessDialogOpen(true);
        } catch (error) {
            const message = error?.response?.data?.message
                || error?.response?.data?.error
                || 'Unable to mark as collected. Please try again.';
            setErrorDialogMessage(message);
            setErrorDialogOpen(true);
        }
    };

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isDrawerOpen) {
                closeDrawer();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isDrawerOpen]);

    const shipmentColumns = useMemo(() => [
        {
            key: 'date',
            label: t('commonDate'),
            className: 'whitespace-nowrap text-[#1f2937]',
        },
        {
            key: 'rider',
            label: t('commonEmployee'),
            className: 'whitespace-nowrap text-[#1f2937]',
            render: (_value, row) => (
                <div className="flex flex-col">
                    <span className="text-[#1f2937]">{row.rider}</span>
                    {row.rider_role && (
                        <span className="text-xs text-gray-500">{row.rider_role}</span>
                    )}
                </div>
            ),
        },
        {
            key: 'orders_delivered',
            label: t('superAdminCodColumnOrdersDelivered'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'orders_pending',
            label: t('superAdminCodColumnOrdersPending'),
            render: (value, row) => (row.status === 'settled' ? 0 : value),
            className: 'whitespace-nowrap',
        },
        {
            key: 'good_amount',
            label: t('commonGoodsAmount'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'shipment_amount',
            label: t('superAdminCodColumnShipmentAmount'),
            className: 'whitespace-nowrap',
        },
        {
            key: 'status',
            label: t('commonStatus'),
            render: (_value, row) => (
                <span
                    className={`inline-flex items-center justify-center rounded-full text-xs font-medium px-4 py-1 min-w-[96px] ${STATUS_STYLES[row.status] ?? ''}`}
                >
                    {toHumanStatus(row.status, t)}
                </span>
            ),
            className: 'whitespace-nowrap',
        },
        {
            key: 'action',
            label: t('commonAction'),
            align: 'right',
            render: (_value, row) => (
                <button
                    type="button"
                    onClick={() => openDrawer(row)}
                    className="text-neutral-900 text-sm font-14px underline cursor-pointer"
                >
                    {t('commonViewDetails')}
                </button>
            ),
            className: 'whitespace-nowrap',
        },
    ], [openDrawer, t]);

    const riderAvatarUrl =
        drawerData?.rider_profile?.avatar_url ??
        drawerData?.rider_avatar ??
        selectedShipment?.rider_avatar ??
        null;

    return (
        <>
        <SuperAdminAuthenticated
            headerContent={
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-semibold text-[#0f172a]">{t('commonCodManagement')}</h1>
                        <nav className="text-sm text-[#64748b]">
                            {t('commonHome')} <span className="mx-1 text-slate-500">›</span>
                            <span className="font-medium text-blue-500">{t('commonCodManagement')}</span>
                        </nav>
                    </div>
                </div>
            }
        >
            <Head title={t('commonCodManagement')} />

            <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {statsCards.map((stat, index) => (
                        <StatsCard
                            key={index}
                            title={stat.title}
                            value={stat.value}
                            subtitle={stat.label}
                            valuePrefix="SYP"
                            isSpecialCard={stat.isSpecialCard ?? false}
                            iconSrc={stat.iconSrc}
                            accentColor="#338dff"
                        />
                    ))}
                </div>

                {/* Table Section */}
                <Card
                    title={t('superAdminCodCardTitle')}
                    padding="none"
                    headerClassName="px-5 py-4"
                    toolbarClassName="flex-1"
                    toolbar={(
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end w-full">
                            <div className="relative w-full md:w-60 lg:w-72">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65Z"
                                    />
                                </svg>
                                <input
                                    type="text"
                                    placeholder={t('superAdminCodSearchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            handleSearch(searchTerm);
                                        }
                                    }}
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white pl-11 pr-4 py-2.5 text-sm text-[#1f2937] focus:outline-none focus:ring-4 focus:ring-[#338dff33]"
                                />
                            </div>

                            <div className="relative md:ml-2">
                                <button
                                    type="button"
                                    ref={sortTriggerRef}
                                    onClick={() => setShowSortMenu((prev) => !prev)}
                                    className="inline-flex items-center gap-2 rounded-full border border-[#d1dae6] bg-white px-5 py-2 text-sm font-medium text-[#1f2937] transition hover:bg-[#f1f5f9]"
                                    aria-haspopup="menu"
                                    aria-expanded={showSortMenu}
                                >
                                    <span className="text-[#64748b]">{t('commonSortBy')}</span>
                                    <span className="font-semibold text-blue-500">{currentRiderLabel}</span>
                                    <svg
                                        className="w-4 h-4 text-[#1f2937]"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {showSortMenu && (
                                    <div ref={sortMenuRef} className="absolute right-0 mt-2 z-40">
                                        <Menu
                                            items={riderOptions}
                                            onItemClick={(item) => applyRiderFilter(item.value)}
                                            anchorRef={sortTriggerRef}
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
                        columns={shipmentColumns}
                        data={paginatedShipments}
                        keyField="id"
                    emptyMessage={t('superAdminCodTableEmpty')}
                        minWidth="720px"
                        tableClassName="min-w-[720px]"
                        theadClassName="bg-[#f8fafc] text-[#0f172a]"
                        tbodyClassName="text-[#1f2937]"
                        thClassName="font-medium"
                        tdClassName="text-sm"
                        striped
                        hoverable
                        pagination
                        currentPage={paginationMeta.currentPage}
                        totalPages={paginationMeta.totalPages}
                        onPageChange={handlePageChange}
                        paginationMeta={paginationMeta}
                        paginationClassName="border-t border-gray-100 bg-[#f8fafc] px-5"
                        showPaginationInfo
                    />
                </Card>
            </div>

            {/* Drawer */}
            {isDrawerOpen && (
                <div className="fixed inset-0 z-40 transition-opacity duration-200" onClick={closeDrawer}>
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
                    <div
                        className="absolute inset-y-0 right-0 w-full max-w-[380px] sm:max-w-[400px] bg-white border border-[#d8dee9] shadow-[0_20px_45px_rgba(15,23,42,0.25)] rounded-l-[28px] flex flex-col max-h-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8f0]">
                            <div>
                                <h2 className="text-lg font-semibold text-[#1f2937]">{t('superAdminCodDrawerTitle')}</h2>
                                <p className="text-sm text-[#64748b]">{t('superAdminCodDrawerDescription')}</p>
                            </div>
                            <button
                                onClick={closeDrawer}
                                className="rounded-full p-1 text-[#64748b] hover:text-[#1f2937] transition text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#338dff]"></div>
                                        <p className="mt-2 text-sm text-[#64748b]">Loading...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Employee Info */}
                                    <div className="rounded-[20px] border border-[#e2e8f0] bg-white shadow-sm px-4 py-4 flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                            {riderAvatarUrl ? (
                                                <img
                                                    src={riderAvatarUrl}
                                                    alt={drawerData?.rider || selectedShipment?.rider || 'Employee'}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-lg font-semibold text-gray-600">
                                                    {selectedShipment?.rider?.charAt(0) ?? 'U'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold text-[#1f2937]">
                                                    {drawerData?.rider ?? selectedShipment?.rider ?? 'Unassigned'}
                                                </h3>
                                                <span className="inline-flex items-center rounded-full bg-[#dbeafe] text-[#2563eb] text-[11px] font-semibold px-2 py-0.5">
                                                    {drawerData?.rider_role ?? selectedShipment?.rider_role ?? 'Employee'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {t('commonMemberSinceLabel')}{' '}
                                                {drawerData?.member_since
                                                    ? new Date(drawerData.member_since).toLocaleDateString()
                                                    : selectedShipment?.member_since
                                                    ? new Date(selectedShipment.member_since).toLocaleDateString()
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 text-center">
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">
                                                {t('commonTotalCodAmount')}
                                            </p>
                                            <p className="text-2xl font-semibold text-blue-500 mt-1">
                                                {parsedDrawerTotalCodAmount}
                                            </p>
                                        </div>
                                        <div className="rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 text-center">
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">
                                                {t('superAdminCodDrawerStatOrdersCollected')}
                                            </p>
                                            <p className="text-2xl font-semibold text-blue-500 mt-1">
                                                {drawerData?.stats?.completed_orders ?? 0}
                                            </p>
                                        </div>
                                        <div className="rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 text-center">
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">
                                                {t('superAdminCodDrawerStatOverdue')}
                                            </p>
                                            <p className="text-2xl font-semibold text-blue-500 mt-1">
                                                {drawerData?.stats?.overdue ?? 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Orders Table */}
                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold text-[#1f2937]">
                                            {t('commonOrders')}
                                        </h3>
                             <div className="rounded-[16px] border border-[#e2e8f0]">
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[520px] text-sm text-left">
                                                <thead className="bg-[#f8fafc] text-[#64748b]">
                                                    <tr>
                                                        <th className="py-3 px-4 font-medium">{t('commonShipId')}</th>
                                                        <th className="py-3 px-4 font-medium">{t('commonSender')}</th>
                                                        <th className="py-3 px-4 font-medium">{t('commonReceiver')}</th>
                                                        <th className="py-3 px-4 font-medium">{t('commonShipmentType')}</th>
                                                         {/* <th className="py-3 px-4 font-medium">{t('commonPayments')}</th> */}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#e2e8f0] text-[#1f2937]">
                                                    {drawerData?.shipments?.length > 0 ? (
                                                        drawerData.shipments.map((order, idx) => (
                                                            <tr
                                                               key={order.ship_id ?? idx}

                                                                className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}
                                                            >
                                                                <td className="py-3 px-4">{order.order_number || order.orderNumber || order.ship_id}</td>
                                                                <td className="py-3 px-4">{order.sender}</td>
                                                                <td className="py-3 px-4">{order.receiver}</td>
                                                                <td className="py-3 px-4">{order.shipment_type}</td>
                                                                {/* <td className="py-3 px-4">{order.shipment_payment}</td> */}
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                        <td colSpan="5" className="py-6 px-4 text-center text-[#64748b]">
                                                                {t('superAdminCodDrawerOrdersEmpty')}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="px-6 pb-6 pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4">
                            <OutlineButton
                                onClick={closeDrawer}
                                text={t('commonCancel')}
                                width="170px"
                                height="60px"
                            />
                            {/* Only show Mark as collected button if status is not already settled and shipment is delivered */}
                            {!loading && selectedShipment?.status !== 'settled' && drawerData?.cod_status !== 'settled' && (
                                <PrimaryButton
                                    onClick={handleMarkAsCollected}
                                    text={t('superAdminCodDrawerMarkAsCollected')}
                                    width="250px"
                                    height="60px"
                                    disabled={drawerData?.status !== 'delivered' && drawerData?.status !== 'Delivered' && drawerData?.status !== 'Picked up by Receiver' && drawerData?.status !== 'Pending Handover'}
                                    title={drawerData?.status !== 'delivered' && drawerData?.status !== 'Delivered' && drawerData?.status !== 'Picked up by Receiver' && drawerData?.status !== 'Pending Handover' ? 'Shipment must be delivered before marking as collected' : ''}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminAuthenticated>

        {/* Error dialog for failed collection attempts */}
        <ConfirmDialog
            open={errorDialogOpen}
            onClose={() => setErrorDialogOpen(false)}
            onConfirm={() => setErrorDialogOpen(false)}
            title="Cannot Mark as Collected"
            message={errorDialogMessage}
            confirmText="OK"
            cancelText="Close"
            confirmButtonClass="bg-blue-600 hover:bg-blue-700 text-white"
        />

        {/* Success popup after collection */}
        {successDialogOpen && (
            <Popup
                title={"Collected"}
                message={successDialogMessage}
                buttonLabel={'Okay'}
                onConfirm={() => { setSuccessDialogOpen(false); router.reload({ only: ['shipments', 'stats'], preserveScroll: true }); }}
                loopAnimation={true}
            />
        )}
        </>
    );
}
