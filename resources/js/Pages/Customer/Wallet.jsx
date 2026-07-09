import React, { useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';
import TransactionModal from '../../Components/Customer/TransactionModal';
import { useTranslation } from 'react-i18next';
import Drawer from '../SuperAdmin/Components/Drawer';
import Popup from '../SuperAdmin/Components/Popup';
import ConfirmModal from '../SuperAdmin/Components/ConfirmModal';
import NotificationDropdown from '../../Components/Customer/NotificationDropdown';
import MobileHeader from '../../Components/Customer/MobileHeader';
import DataTable from '../../Components/Common/DataTable';

export default function Wallet({
    totalBalance = 0,
    onHold = 0,
    pending = 0,
    compensation = 0,
    shipments = { data: [], links: [], current_page: 1, last_page: 1 },
    filters = { search: '', status: 'all' },
}) {
    const { t, i18n } = useTranslation();
    const [searchValue, setSearchValue] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [isReturnDrawerOpen, setIsReturnDrawerOpen] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const [returnPanelMode, setReturnPanelMode] = useState('review');
    const [proofPhotos, setProofPhotos] = useState([]);
    const [compensationAmount, setCompensationAmount] = useState('');
    const [compensationDescription, setCompensationDescription] = useState('');
    const [damageError, setDamageError] = useState('');
    const [amountError, setAmountError] = useState('');
    const [photoError, setPhotoError] = useState('');
    const [processingApproval, setProcessingApproval] = useState(false);
    const [processingCompensation, setProcessingCompensation] = useState(false);
    const [serverErrorMessage, setServerErrorMessage] = useState('');
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [showApproveSuccessPopup, setShowApproveSuccessPopup] = useState(false);
    const [approveReturnSuccessMessage, setApproveReturnSuccessMessage] = useState('');
    const [showCompensationSuccessPopup, setShowCompensationSuccessPopup] = useState(false);
    const [compensationSuccessMessage, setCompensationSuccessMessage] = useState('');
    const [panelVariant, setPanelVariant] = useState('sender');
    const [pendingReceiverAction, setPendingReceiverAction] = useState(null);
    const [showReceiverConfirm, setShowReceiverConfirm] = useState(false);
    const [processingReceiverAction, setProcessingReceiverAction] = useState(false);
    const [showReceiverActionSuccessPopup, setShowReceiverActionSuccessPopup] = useState(false);
    const [receiverActionSuccessMessage, setReceiverActionSuccessMessage] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const numberLocale = (i18n.language || '').toLowerCase().startsWith('ar') ? 'ar-SY' : 'en-US';

    const normalizeLabelValue = (value) => String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');

    const formatReadableLabel = (value) => {
        if (value === null || value === undefined || value === '--') {
            return '--';
        }

        return String(value)
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const resolveShipmentId = (shipment) => (
        shipment?.id
        ?? shipment?.shipment_id
        ?? shipment?.shipmentId
        ?? shipment?.order_id
        ?? null
    );

    const uploadProofPhoto = async (file) => {
        const xsrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        const xsrf = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : null;

        const fd = new FormData();
        fd.append('photo', file);

        const headers = {
            ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
            ...(!xsrf && document.querySelector('meta[name="csrf-token"]')
                ? { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') }
                : {}),
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        };

        const resp = await fetch('/customer/uploads/photo', {
            method: 'POST',
            headers,
            body: fd,
            credentials: 'same-origin',
        });
        let data = null;
        try {
            data = await resp.json();
        } catch (err) {
            console.error('Failed to parse upload response', err);
        }

        if (!resp.ok) {
            throw new Error(data?.message || t('walletUploadFailed'));
        }
        if (!data?.url) {
            throw new Error(t('walletUploadFailed'));
        }

        return data.url;
    };

    const handleProofPhotoSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const localUrl = URL.createObjectURL(file);
        let insertIndex = -1;
        setProofPhotos((prev) => {
            const next = [...prev, localUrl];
            insertIndex = next.length - 1;
            return next;
        });
        setPhotoError('');

        try {
            const uploadedUrl = await uploadProofPhoto(file);
            setProofPhotos((prev) => {
                const next = [...prev];
                if (insertIndex >= 0 && insertIndex < next.length && next[insertIndex] === localUrl) {
                    next[insertIndex] = uploadedUrl;
                } else {
                    next.push(uploadedUrl);
                }
                return next;
            });
        } catch (error) {
            console.error(error);
            setProofPhotos((prev) => prev.filter((photo, idx) => !(idx === insertIndex && photo === localUrl)));
            setPhotoError(t('commonPhotoUploadFailed'));
        } finally {
            try {
                URL.revokeObjectURL(localUrl);
            } catch {
                /* ignore */
            }
            event.target.value = '';
        }
    };

    const handleRemoveProofPhoto = (index) => {
        setProofPhotos((prev) => {
            const removed = prev[index];
            const next = prev.filter((_, idx) => idx !== index);
            if (typeof removed === 'string' && removed.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(removed);
                } catch {
                    /* ignore */
                }
            }
            return next;
        });
        setPhotoError('');
    };

    const openReturnPanel = (shipment) => {
        const normalizedRole = `${shipment?.role ?? ''}`.toLowerCase();
        const variant = normalizedRole === 'receiver' ? 'receiver' : 'sender';

        setPanelVariant(variant);
        setIsReturnDrawerOpen(true);
        setSelected(shipment);
        setServerErrorMessage('');
        setAcknowledged(false);
        setReturnPanelMode('review');
        setPendingReceiverAction(null);
        setShowReceiverConfirm(false);
        // setProcessingReceiverAction(false);
        setReceiverActionSuccessMessage('');
        setShowReceiverActionSuccessPopup(false);
        setCompensationDescription(shipment?.special_instruction || shipment?.return_reason || shipment?.reason || '');
        setCompensationAmount('');
        setDamageError('');
        setAmountError('');
        setShowApproveConfirm(false);
        setProcessingApproval(false);
        setProcessingCompensation(false);
        setProofPhotos((prev) => {
            prev.forEach((photo) => {
                if (typeof photo === 'string' && photo.startsWith('blob:')) {
                    URL.revokeObjectURL(photo);
                }
            });
            return [];
        });
        setPhotoError('');
    };

    const closeReturnPanel = () => {
        setIsReturnDrawerOpen(false);
        setShowApproveConfirm(false);
        setServerErrorMessage('');
        setProcessingApproval(false);
        setProcessingCompensation(false);
        setPanelVariant('sender');
        setPendingReceiverAction(null);
        setShowReceiverConfirm(false);
        setProcessingReceiverAction(false);
        setReceiverActionSuccessMessage('');
        setShowReceiverActionSuccessPopup(false);
        setDamageError('');
        setAmountError('');
        setPhotoError('');
    };

    const openTransactionModal = (shipment) => {
        setSelectedTransaction(shipment);
        setIsTransactionModalOpen(true);
    };

    const closeTransactionModal = () => {
        setIsTransactionModalOpen(false);
        setSelectedTransaction(null);
    };

    // const handleReturnDrawerAfterClose = () => {
    //     proofPhotos.forEach((photo) => {
    //         if (typeof photo === 'string' && photo.startsWith('blob:')) {
    //             URL.revokeObjectURL(photo);
    //         }
    //     });
    //     setSelected(null);
    //     setReturnPanelMode('review');
    //     setProofPhotos([]);
    //     setCompensationAmount('');
    //     setCompensationDescription('');
    //     setAcknowledged(false);
    //     setDamageError('');
    //     setAmountError('');
    //     setServerErrorMessage('');
    //     setPanelVariant('sender');
    //     setPendingReceiverAction(null);
    //     setShowReceiverConfirm(false);
    //     setProcessingReceiverAction(false);
    //     setReceiverActionSuccessMessage('');
    //     setShowReceiverActionSuccessPopup(false);
    //     setShowApproveConfirm(false);
    //     setProcessingApproval(false);
    //     setProcessingCompensation(false);
    //     setPhotoError('');
    // };

    const handleApproveReturnClick = () => {
        setShowApproveConfirm(true);
    };

    const triggerReceiverAction = (action) => {
        if (processingReceiverAction) return;
        setPendingReceiverAction(action);
        setShowReceiverConfirm(true);
    };

    const handleReceiverActionConfirm = async () => {
        if (!selected || !pendingReceiverAction || processingReceiverAction) {
            return;
        }

        const shipmentId = resolveShipmentId(selected);
        if (!shipmentId) {
            setServerErrorMessage(t('walletUnableDetermineShipment'));
            setShowReceiverConfirm(false);
            setPendingReceiverAction(null);
            return;
        }

        const action = pendingReceiverAction;
        setShowReceiverConfirm(false);
        setProcessingReceiverAction(true);
        setServerErrorMessage('');

        const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        const resp = await fetch('/customer/shipments/compensation-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': csrf,
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                shipment_id: shipmentId,
                status: action,
                remarks: '',
            }),
        });
        let data = null;
        try { data = await resp.json(); } catch (e) { /* ignore parse errors */ }
        if (resp.ok && data?.ok) {
            closeReturnPanel();
            setReceiverActionSuccessMessage(action === 'approved' ? t('walletCompensationApprovedSuccess') : t('walletCompensationRejectedSuccess'));
            setShowReceiverActionSuccessPopup(true);
            applyFilters();
        } else {
            setServerErrorMessage(data?.message || t('walletCompensationStatusUpdateFailed'));
        }
        setProcessingReceiverAction(false);
        setPendingReceiverAction(null);
    };

    const confirmApproveReturn = async () => {
        if (!selected || processingApproval) {
            return;
        }

        const shipmentId = resolveShipmentId(selected);
        if (!shipmentId) {
            setServerErrorMessage(t('walletUnableDetermineShipment'));
            return;
        }

        setShowApproveConfirm(false);
        setProcessingApproval(true);
        setServerErrorMessage('');

        const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        const resp = await fetch('/customer/shipments/return-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': csrf,
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                shipment_id: shipmentId,
                return_status: 'approved',
            }),
        });
        let data = null;
        try { data = await resp.json(); } catch (e) { /* ignore parse errors */ }
        if (resp.ok && data?.ok) {
            // Store success message from server response if available
            if (data?.message) {
                setApproveReturnSuccessMessage(data.message);
            }
            setShowApproveSuccessPopup(true);
            closeReturnPanel();
            applyFilters();
        } else {
            setServerErrorMessage(data?.message || t('walletUnableApproveReturn'));
        }
        setProcessingApproval(false);
    };

    const submitCompensationRequest = async () => {
        const description = compensationDescription.trim();
        const requestedAmount = Number(compensationAmount);
        let hasError = false;

        if (!description) {
            setDamageError(t('walletDescribeDamageError'));
            hasError = true;
        } else {
            setDamageError('');
        }

        if (!compensationAmount || Number.isNaN(requestedAmount) || requestedAmount <= 0) {
            setAmountError(t('walletValidAmountError'));
            hasError = true;
        } else if (requestedAmount > selected?.payment?.goods_amount) {
            setAmountError(t('walletAmountExceedsGoodsAmount'));
            hasError = true;
        } else {
            setAmountError('');
        }

        if (hasError) {
            return;
        }

        if (!selected) {
            setServerErrorMessage(t('walletUnableFindShipment'));
            return;
        }

        const shipmentId = resolveShipmentId(selected);
        if (!shipmentId) {
            setServerErrorMessage(t('walletUnableSubmitRequest'));
            return;
        }

        const goodsAmountLimit = Number(selected?.payment?.goods_amount ?? 0);
        if (!Number.isNaN(goodsAmountLimit) && goodsAmountLimit > 0 && requestedAmount > goodsAmountLimit) {
            setAmountError(t('walletAmountExceedsGoodsAmountLimit', { amount: formatAmount(goodsAmountLimit) }));
            return;
        }

        const hasUploadingPhotos = proofPhotos.some((photo) => typeof photo === 'string' && photo.startsWith('blob:'));
        const uploadedPhotos = proofPhotos.filter((photo) => typeof photo === 'string' && photo && !photo.startsWith('blob:'));
        let proofError = '';
        if (hasUploadingPhotos) {
            proofError = t('walletWaitForPhotoUpload');
        } else if (uploadedPhotos.length === 0) {
            proofError = t('createBookingErrorPhotoRequired');
        }
        if (proofError) {
            setPhotoError(proofError);
            return;
        }
        setPhotoError('');

        const payload = {
            shipment_id: shipmentId,
            amount: requestedAmount,
            remarks: description,
            photos: uploadedPhotos,
        };

        setProcessingCompensation(true);
        setServerErrorMessage('');

        const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        const resp = await fetch('/customer/shipments/compensation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': csrf,
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        let data = null;
        try { data = await resp.json(); } catch (e) { /* ignore parse errors */ }
        if (resp.ok && data?.ok) {
            setCompensationSuccessMessage(t('walletCompensationRequestedMessage'));
            setShowCompensationSuccessPopup(true);
            closeReturnPanel();
            applyFilters();
        } else {
            const errors = data?.errors || {};
            if (errors?.amount) {
                setAmountError(Array.isArray(errors.amount) ? errors.amount[0] : errors.amount);
            }
            if (errors?.remarks) {
                setDamageError(Array.isArray(errors.remarks) ? errors.remarks[0] : errors.remarks);
            }
            if (errors?.photos) {
                setPhotoError(Array.isArray(errors.photos) ? errors.photos[0] : errors.photos);
            }
            if (!errors?.amount && !errors?.remarks) {
                setServerErrorMessage(data?.message || t('walletUnableSubmitCompensation'));
            }
        }
        setProcessingCompensation(false);
    };

    const formatCompact = (amount) => {
        // if (amount >= 1000) {
        //     const val = amount / 1000;
        //     // Display as e.g. "60.5k" or "27k"
        //     return val % 1 === 0 ? `${val}k` : `${val.toFixed(1).replace(/\.0$/, '')}k`;
        // }
        return String(amount);
    };

    const formatAmount = (amount) => {
        return `SYP ${Number(amount).toLocaleString('en-US')}`;
    };

    // Apply filters via Inertia visit
    const applyFilters = useCallback((overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : searchValue,
            status: overrides.status !== undefined ? overrides.status : statusFilter,
        };
        // Remove empty params
        Object.keys(params).forEach((k) => {
            if (!params[k] || params[k] === 'all') delete params[k];
        });
        router.get('/customer/wallet', params, { preserveState: true, preserveScroll: true });
    }, [searchValue, statusFilter]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    };

    const handleStatusChange = (status) => {
        setStatusFilter(status);
        setSortDropdownOpen(false);
        applyFilters({ status });
    };

    const getStatusConfig = () => ({
        pending: { label: t('statusPending'), bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-300' },
        released: { label: t('walletStatusReleased'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300' },
        paid: { label: t('statusPaid'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300' },
        refunded: { label: t('walletStatusRefund'), bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-300' },
        rejected: { label: t('walletStatusRejected'), bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-300' },
        approved: { label: t('walletStatusApproved'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300' },
        on_hold: { label: t('walletOnHold'), bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-300' },
        held: { label: t('walletStatusHeld'), bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-300' },
        compensation: { label: t('walletCompensation'), bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-300' },
        returned: { label: t('statusReturned'), bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-300' },
        completed: { label: t('statusCompleted'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300' },
        delivered: { label: t('statusDelivered'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300' },
        pending_handover: { label: t('timelinePendingHandover'), bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-300' },
        failed: { label: t('walletStatusFailed'), bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-300' },
        cancelled: { label: t('statusCancelled'), bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-300' },
        processing: { label: t('walletStatusProcessing'), bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-300' },
        confirmed: { label: t('walletStatusConfirmed'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300' },
        processed: { label: t('walletStatusProcessed'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300' },
    });

    const getStatusLabel = (status) => {
        if (status === null || status === undefined || status === '--') {
            return '--';
        }

        const normalized = normalizeLabelValue(status);
        if (!normalized) {
            return '--';
        }

        return getStatusConfig()[normalized]?.label || formatReadableLabel(status);
    };

    const getStatusFilterLabel = (status) => (
        normalizeLabelValue(status) === 'all' ? t('commonAll') : getStatusLabel(status)
    );

    const getStatusBadge = (status) => {
        if (status === null || status === undefined || normalizeLabelValue(status) === '') {
            return '--';
        }
        if (status === "--") {
            return status;
        }
        const normalized = normalizeLabelValue(status);
        const cfg = getStatusConfig()[normalized] || {
            label: formatReadableLabel(status),
            bg: 'bg-gray-50',
            text: 'text-gray-600',
            border: 'border-gray-300',
        };
        return (
            <span
                className={`inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                style={{ minWidth: '72px' }}
            >
                {cfg.label}
            </span>
        );
    };

    const getShipmentTypeLabel = (type) => {
        if (!type) return '-';
        // Map values like "direct_dd", "indirect_dp" to readable labels
    const map = {
        direct_dd: t('shipmentTypeDirectDd'),
        direct_dp: t('walletShipmentTypeDirectDp'),
        indirect_dd: t('walletShipmentTypeIndirectDd'),
        indirect_dp: t('shipmentTypeIndirectDp'),
        direct: t('shipmentTypeDirectDd'),
        indirect: t('shipmentTypeIndirectDp'),
    };
    return map[normalizeLabelValue(type)] || formatReadableLabel(type);
};

    const getBookingTypeLabel = (type) => {
        if (!type) return '-';

        const normalized = normalizeLabelValue(type);
        if (['sending', 'shipment'].includes(normalized)) return t('commonSending');
        if (['receiving', 'return'].includes(normalized)) return t('commonReceiving');
        if (normalized === 'sender') return t('commonSender');
        if (normalized === 'receiver') return t('commonReceiver');
        return formatReadableLabel(type);
    };

    const goToWalletPage = useCallback((page) => {
        const currentPage = shipments.current_page ?? 1;
        const lastPage = shipments.last_page ?? 1;
        if (page < 1 || page > lastPage || page === currentPage) return;

        const params = { page };
        if (searchValue) params.search = searchValue;
        if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
        router.get('/customer/wallet', params, { preserveState: true, preserveScroll: true });
    }, [shipments.current_page, shipments.last_page, searchValue, statusFilter]);

    const renderMobilePagination = () => {
        if (!shipments.last_page || shipments.last_page <= 1) return null;

        const currentPage = shipments.current_page ?? 1;
        const lastPage = shipments.last_page ?? 1;

        return (
            <div className="md:hidden px-4 pb-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E6EAF3] bg-white px-3 py-2 shadow-sm">
                    <button
                        type="button"
                        onClick={() => goToWalletPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${currentPage > 1
                            ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {t('commonPrevious')}
                    </button>
                    <p className="text-xs font-medium text-gray-500">{currentPage} / {lastPage}</p>
                    <button
                        type="button"
                        onClick={() => goToWalletPage(currentPage + 1)}
                        disabled={currentPage === lastPage}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${currentPage < lastPage
                            ? 'border border-blue-500 text-blue-600 hover:bg-blue-50'
                            : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {t('commonNext')}
                    </button>
                </div>
            </div>
        );
    };

    // Wallet icon SVG for the summary cards (top-right corner)
    const WalletIcon = ({ color = '#338DFF' }) => (
        <svg width="28" height="28" className='md:block hidden' viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 7H3C2.45 7 2 7.45 2 8V19C2 19.55 2.45 20 3 20H21C21.55 20 22 19.55 22 19V8C22 7.45 21.55 7 21.7Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M17 14C17 14.5523 16.5523 15 16 15C15.4477 15 15 14.5523 15 14C15 13.4477 15.4477 13 16 13C16.5523 13 17 13.4477 17 14Z" fill={color} />
            <path d="M20 7V5C20 4.45 19.55 4 19 4H5C4.45 4 4 4.45 4 5V7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const renderOrderNumberButton = (row, className = 'cursor-pointer text-[#338DFF] hover:underline') => (
        <button
            type="button"
            onClick={() => openTransactionModal(row)}
            className={className}
        >
            {row.order_number || '-'}
        </button>
    );

    const renderReturnAction = (
        row,
        className = 'text-[#338DFF] hover:text-[#2070dd] text-sm font-medium hover:underline transition cursor-pointer',
    ) => {
        const hasReturnCreated = row?.is_return_created === '1';
        if (!hasReturnCreated) return '-';

        const normalizedRole = `${row?.role ?? ''}`.toLowerCase();
        if (normalizedRole === 'receiver') {
            const compensationStatus = `${row?.componsation_status ?? ''}`.toLowerCase();
            if (compensationStatus === 'draft') {
                return '-';
            }
        }
        // if (normalizedRole === 'sender') {
        //     const returnDeliveryStatus = `${row.returned_shipment?.status ?? ''}`.toLowerCase();
        //     if (returnDeliveryStatus !== 'Delivered' && returnDeliveryStatus !== 'Completed') {
        //         return '-';
        //     }
        // }

        return (
            <button
                type="button"
                onClick={() => openReturnPanel(row)}
                className={className}
            >
                {t('commonViewDetails')}
            </button>
        );
    };

    const columns = [
        {
            key: 'shipment_order_number',
            label: t('commonShipId'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => renderOrderNumberButton(row),
            // onActionClick: (e, row) => {
            //     e.preventDefault();
            // }
        },
        {
            key: 'sender_name',
            label: t('commonSender'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => row.sender_name || '-',
        },
        {
            key: 'receiver_name',
            label: t('commonReceiver'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => row.receiver_name || '-',
        },
        {
            key: 'role',
            label: t('commonRole'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => getBookingTypeLabel(row.role || "-"),
        },
        {
            key: 'shipment_type',
            label: t('commonShipmentType'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => getShipmentTypeLabel(row.delivery_speed),
        },
        {
            key: 'goods_amount',
            label: t('commonGoodsAmount'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => formatAmount(row.parcel_amount ??  0) ,
        },
        {
            key: 'goods_amount_status',
            label: t('walletTableGoodsAmountStatus'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => getStatusBadge(row.sender_receive_payment_status == null ? row.payment_status : row.sender_receive_payment_status),
        },
        {
            key: 'rdf_amount',
            label: t('walletTableRdfAmount'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => formatAmount(row.rdf_amount) ?? "--",
        },
        {
            key: 'rdf_amount_status',
            label: t('walletTableRdfAmountStatus'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => getStatusBadge(row.rdf_payment_status ?? "--"),
        },
        {
            key: 'return_status',
            label: t('commonReturnStatus'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_, row) => getStatusLabel(row.return_status),
            // render: (_, row) => getStatusBadge(row.return_status || "--"),
        },
        {
            key: 'action',
            label: t('commonActions'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            className: 'px-4 py-3 text-right',
            render: (_, row) => {
                const hasReturnCreated = row?.is_return_created === '1';
                if (!hasReturnCreated) return '-';

                const normalizedRole = `${row?.role ?? ''}`.toLowerCase();
                if (normalizedRole === 'receiver') {
                    const compensationStatus = `${row?.componsation_status ?? ''}`.toLowerCase();
                    if (compensationStatus === 'draft') {
                        return '-';
                    }
                }
                // if (normalizedRole === 'sender') {
                //     const returnDeliveryStatus = `${row.returned_shipment?.status ?? ''}`.toLowerCase();
                //     if (returnDeliveryStatus !== 'Delivered' && returnDeliveryStatus !== 'Completed') {
                //         return '-';
                //     }
                // }

                return (
                    <button
                        type="button"
                        onClick={() => openReturnPanel(row)}
                        className="text-[#338DFF] hover:text-[#2070dd] text-sm font-medium hover:underline transition cursor-pointer"
                    >
                        {t('commonViewDetails')}
                    </button>
                );
            },
        },
    ];

    const normalizedSelectedReturnStatus = selected?.return_status
        ? `${selected.return_status}`.toLowerCase()
        : null;
    const selectedCompensationStatus = `${selected?.componsation_status ?? ''}`.toLowerCase();    
    const canShowRequestCompensation = panelVariant === 'sender'
        && Boolean(selected)
        && returnPanelMode === 'review'
        && selected?.returned_shipment?.status === 'Completed' || selected?.returned_shipment?.status === 'Delivered'
        && (selectedCompensationStatus === 'draft');
    const showApproveReturnButton = panelVariant === 'sender'
        && Boolean(selected)
        && returnPanelMode === 'review'
        && normalizedSelectedReturnStatus !== 'completed'
        && selectedCompensationStatus !== 'approved'
        && selected?.returned_shipment?.status == 'Delivered' || selected?.returned_shipment?.status == 'Completed' || selected?.returned_shipment?.status == 'Pending Handover'
        && selected?.sender_receive_payment_status !== 'released';

    const receiverOriginalValue = Number(selected?.parcel_amount ?? selected?.total_fee ?? 0);
    const receiverRequestedCompensation = Number(selected?.componsation_amount ?? selected?.componsationAmount ?? 0);
    const receiverYouWouldReceive = Math.max(receiverOriginalValue - receiverRequestedCompensation, 0);
    const walletRows = shipments.data ?? [];
    const walletStatusFilterOptions = ['all', 'pending', 'held', 'released'].map((status) => ({
        value: status,
        label: getStatusFilterLabel(status),
    }));

    return (
        <div className="min-h-screen bg-[#f8f9fb] text-[#1f2937] flex flex-col md:flex-row overflow-x-hidden">
            <CustomerSidebar />
            <main className="flex-1 md:ml-[72px] md:overflow-y-auto pb-20 md:pb-0">
                <CustomerHeader
                    title={t('walletTitle')}
                    breadcrumbs={[
                        { label: t('commonHome'), href: '/customer/dashboard' },
                        { label: t('commonWallet') },
                    ]}
                />
                {/* Mobile fixed header */}
                <MobileHeader title={t('walletTitle')}/>
                
                <div className="px-4 py-6 md:px-6 lg:px-10 mt-12 md:mt-0">
                    {/* ========== Summary Cards ========== */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {/* Total Balance — highlighted blue gradient */}
                        <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-[#e8f1ff] to-[#f0f6ff] border border-[#c5dcff]">
                            <p className="text-[13px] font-medium text-[#5a7da8] mb-1">{t('walletSummaryTotalBalance')}</p>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[13px] font-semibold text-[#338DFF]">{t('commonCurrencySyp')}</span>
                                <span className="text-[32px] font-bold text-[#1a3a5c] leading-none tracking-tight">
                                    {formatCompact(totalBalance)}
                                </span>
                            </div>
                            </div>

                        {/* On Hold */}
                        <div className="relative rounded-2xl p-5 bg-white border border-gray-100 shadow-sm">
                            <div className="flex  justify-between">
                                <p className="text-[13px] font-medium text-gray-500 mb-1">{t('walletOnHold')}</p>
                                <WalletIcon color="#338DFF" />
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[13px] font-semibold text-[#338DFF]">{t('commonCurrencySyp')}</span>
                                <span className="text-[32px] font-bold text-[#1a3a5c] leading-none tracking-tight">
                                    {formatCompact(onHold)}
                                </span>
                            </div>
                        </div>

                        {/* Pending */}
                        <div className="relative rounded-2xl p-5 bg-white border border-gray-100 shadow-sm">
                            <div className="flex justify-between">
                                <p className="text-[13px] font-medium text-gray-500 mb-1">{t('statusPending')}</p>
                                <WalletIcon color="#338DFF" />
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[13px] font-semibold text-[#338DFF]">{t('commonCurrencySyp')}</span>
                                <span className="text-[32px] font-bold text-[#1a3a5c] leading-none tracking-tight">
                                    {formatCompact(pending)}
                                </span>
                            </div>
                        </div>

                        {/* Compensation */}
                        <div className="relative rounded-2xl p-5 bg-white border border-gray-100 shadow-sm">
                            <div className="flex justify-between">
                                <p className="text-[13px] font-medium text-gray-500 mb-1">{t('walletCompensation')}</p>
                                <WalletIcon color="#338DFF" />
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[13px] font-semibold text-[#338DFF]">{t('commonCurrencySyp')}</span>
                                <span className="text-[32px] font-bold text-[#1a3a5c] leading-none tracking-tight">
                                    {formatCompact(compensation)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ========== Shared Search/Filter Controls ========== */}
                    <div className="md:hidden block md:mb-6 bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <h2 className="text-lg font-semibold text-gray-800 md:hidden block">{t('shipmentsAllShipments')}</h2>
                        <div className="flex items-center gap-3 flex-1">
                        {/* Search */}
                        <div className="relative flex-1 md:w-48">
                            <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                            </svg>
                            <input
                            type="text"
                            placeholder={t('commonSearch')}
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#338DFF] focus:ring-1 focus:ring-[#338DFF]/20 transition placeholder-gray-400"
                            />
                        </div>

                        {/* Sort / Filter dropdown */}
                        <div className="relative">
                            <button
                            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                            >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            <span className="text-gray-600 font-medium">{t('commonSortColon')}</span>
                            <span className="text-gray-800 font-medium">
                                {getStatusFilterLabel(statusFilter)}
                            </span>
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            </button>
                            {sortDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden py-1">
                                {['all', 'pending', 'held', 'released'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleStatusChange(s)}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition cursor-pointer ${statusFilter === s ? 'text-[#338DFF] font-medium bg-blue-50' : 'text-gray-700'
                                    }`}
                                >
                                    {getStatusFilterLabel(s)}
                                </button>
                                ))}
                            </div>
                            )}
                        </div>
                        </div>
                    </div>
                    </div>

                    {/* ========== All shipment Section ========== */}
                    <DataTable
                        title={t('shipmentsAllShipments')}
                        columns={columns}
                        rows={walletRows}
                        showSearch
                        searchValue={searchValue}
                        searchPlaceholder={t('commonSearch')}
                        onSearchChange={setSearchValue}
                        onSearchSubmit={() => applyFilters()}
                        onSearchClear={() => applyFilters({ search: '' })}
                        showFilters
                        filters={[
                            {
                                key: 'status',
                                label: t('commonSortColon'),
                                value: statusFilter,
                                options: walletStatusFilterOptions,
                                onChange: handleStatusChange,
                            },
                        ]}
                        showPagination
                        currentPage={shipments.current_page ?? 1}
                        totalPages={shipments.last_page ?? 1}
                        onPageChange={goToWalletPage}
                        containerClassName="hidden md:block bg-white card p-6 border border-gray-200 rounded-2xl shadow-sm transition-all duration-200 ease-out"
                        headerClassName="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 gap-3"
                        controlsClassName="flex items-center gap-3"
                        wrapperClassName="w-full overflow-x-auto border-t border-gray-100"
                        tableClassName="min-w-full w-full text-sm"
                        theadClassName="bg-[#fafbfd] text-gray-500 border-b border-gray-100"
                        headerRowClassName="text-left"
                        tbodyClassName="bg-white"
                        rowClassName="border-b border-gray-100 hover:bg-[#fafbfe] transition"
                        emptyMessage={t('shipmentsEmptyMessage')}
                    />
                    {renderMobilePagination()}
                    </div>

                {/* Mobile Cards */}
                        <div className="md:hidden border-t border-gray-100 px-4 pt-6">
                            {walletRows.length > 0 ? (
                                walletRows.map((row, idx) => (
                                    <div
                                        key={row?.id ?? row?.shipment_id ?? row?.order_number ?? idx}
                                        className="bg-white border border-[#E6EAF3] rounded-2xl p-4 shadow-sm mb-3"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-xs text-gray-400">{t('commonShipId')}</p>
                                                <div className="text-sm font-semibold text-gray-800">
                                                    {renderOrderNumberButton(row)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">{t('commonGoodsAmount')}</p>
                                                <p className="text-sm font-semibold text-gray-800">{formatAmount(row.parcel_amount ?? 0)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                            <div>
                                                <p className="text-xs text-gray-400">{t('commonSender')}</p>
                                                <p className="text-gray-800">{row.sender_name || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">{t('commonReceiver')}</p>
                                                <p className="text-gray-800">{row.receiver_name || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">{t('commonRole')}</p>
                                                <p className="text-gray-800">{getBookingTypeLabel(row.role || '-')}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">{t('commonShipmentType')}</p>
                                                <p className="text-gray-800">{getShipmentTypeLabel(row.delivery_speed)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">{t('walletTableRdfAmount')}</p>
                                                <p className="text-gray-800">{formatAmount(row.rdf_amount) ?? '--'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">{t('commonReturnStatus')}</p>
                                                <p className="text-gray-800">{getStatusLabel(row.return_status)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <p className="text-xs text-gray-400 mb-1">{t('walletTableGoodsAmountStatus')}</p>
                                                {getStatusBadge(row.sender_receive_payment_status == null ? row.payment_status : row.sender_receive_payment_status)}
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 mb-1">{t('walletTableRdfAmountStatus')}</p>
                                                {getStatusBadge(row.rdf_payment_status ?? '--')}
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-gray-100">
                                            <p className="text-xs text-gray-400 mb-1">{t('commonActions')}</p>
                                            <div className="text-sm font-medium text-[#338DFF]">
                                                {renderReturnAction(
                                                    row,
                                                    'text-[#338DFF] hover:text-[#2070dd] text-sm font-medium hover:underline transition cursor-pointer',
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex min-h-[35vh] items-center justify-center">
                                    <p className="text-sm text-gray-500">{t('shipmentsEmptyMessage')}</p>
                                </div>
                            )}
                        </div>

                {/* ========== View Details Drawer ========== */}
                <TransactionModal
                    open={isTransactionModalOpen}
                    transaction={selectedTransaction}
                    onClose={closeTransactionModal}
                    t={t}
                />

                <Drawer
                    open={isReturnDrawerOpen}
                    onClose={closeReturnPanel}
                    // onAfterClose={handleReturnDrawerAfterClose}
                    showCloseButton={false}
                    closeOnOverlayClick
                    closeOnEsc
                    panelClassName="flex h-full w-full max-w-[520px] flex-col border border-[#e2e8f0] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.25)] rounded-l-[28px] max-h-[90vh]"
                    containerClassName="fixed inset-0 z-50 flex items-stretch justify-end"
                    overlayClassName="bg-black/40 backdrop-blur-[1px]"
                    headerClassName="px-6 pt-6 pb-4 border-b border-[#e2e8f0]"
                    bodyClassName="flex-1 overflow-y-auto px-6 pb-6 pt-3"
                    footerClassName="px-6 pb-6 pt-4 border-t border-[#e2e8f0]"
                    header={
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-xl font-bold text-gray-800">
                                {panelVariant === 'receiver'
                                    ? t('walletCompensationRequestTitle')
                                    : (returnPanelMode === 'review'
                                        ? t('walletReviewReturnedParcelTitle')
                                        : t('walletCompensationRequestTitle'))}
                            </h3>
                            <button
                                type="button"
                                onClick={closeReturnPanel}
                                className="rounded-full p-1 text-gray-400 hover:text-gray-600 transition"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    }
                    footer={
                        returnPanelMode === 'review' ? (
                            panelVariant === 'receiver' ? selected.componsation_status === 'pending' && (
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => triggerReceiverAction('rejected')}
                                        disabled={processingReceiverAction}
                                        className={`flex-1 py-3 rounded-full text-sm font-semibold border-2 transition ${processingReceiverAction ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-[#338DFF] text-[#338DFF] hover:bg-[#f0f7ff]'}`}
                                    >
                                            {processingReceiverAction && pendingReceiverAction === 'rejected'
                                            ? t('walletRejecting')
                                            : t('walletRejectLabel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => triggerReceiverAction('approved')}
                                        disabled={processingReceiverAction}
                                        className={`flex-1 py-3 rounded-full text-sm font-semibold text-white transition ${processingReceiverAction ? 'bg-[#a3c9ff] cursor-not-allowed' : 'bg-[#338DFF] hover:bg-[#2070dd]'}`}
                                    >
                                            {processingReceiverAction && pendingReceiverAction === 'approved'
                                            ? t('walletApproving')
                                            : t('walletApproveLabel')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    {canShowRequestCompensation && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReturnPanelMode('compensation');
                                                setServerErrorMessage('');
                                                setDamageError('');
                                                setAmountError('');
                                            }}
                                            disabled={!acknowledged || processingCompensation || processingApproval}
                                            className={`flex-1 py-3 rounded-full text-sm font-semibold border-2 transition ${acknowledged && !processingCompensation && !processingApproval
                                                ? 'border-[#338DFF] text-[#338DFF] hover:bg-[#f0f7ff] cursor-pointer'
                                                : 'border-gray-200 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            {t('walletCompensationRequestTitle')}
                                        </button>
                                    )}
                                    {showApproveReturnButton && (
                                        <button
                                            type="button"
                                            onClick={handleApproveReturnClick}
                                            disabled={!acknowledged || processingApproval}
                                            className={`flex-1 py-3 rounded-full text-sm font-semibold text-white transition ${(!acknowledged || processingApproval)
                                                ? 'bg-gray-300 cursor-not-allowed'
                                                : 'bg-[#338DFF] hover:bg-[#2070dd] cursor-pointer'
                                                }`}
                                        >
                                            {processingApproval ? t('walletApproving') : t('walletApproveReturn')}
                                        </button>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setReturnPanelMode('review')}
                                    className="flex-1 py-3 rounded-full text-sm font-semibold border-2 border-[#2563eb] text-[#2563eb] bg-white hover:bg-[#f0f6ff] transition"
                                >
                                    {t('commonBack')}
                                </button>
                                <button
                                    type="button"
                                    onClick={submitCompensationRequest}
                                    disabled={processingCompensation}
                                    className={`flex-1 py-3 rounded-full text-sm font-semibold text-white transition ${processingCompensation ? 'bg-[#a3c9ff] cursor-not-allowed' : 'bg-[#338DFF] hover:bg-[#2070dd]'}`}
                                >
                                    {processingCompensation ? t('commonSubmitting') : t('walletSubmitRequest')}
                                </button>
                            </div>
                        )
                    }
                    >
                        {selected ? (
                            <div className="space-y-6">
                                {serverErrorMessage && (
                                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
                                        {serverErrorMessage}
                                    </div>
                                )}
                                {returnPanelMode === 'review' ? (
                                    panelVariant === 'receiver' ? (
                                        <>
                                            {selectedCompensationStatus === 'rejected' && (
                                                <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
                                                    <p className="text-sm font-semibold text-red-600">{t('walletCompensationRejectedNotice')}</p>
                                                </div>
                                            )}
                                            {selectedCompensationStatus === 'approved' && (
                                                <div className="rounded-2xl border-2 border-green-300 bg-green-50 px-4 py-3">
                                                    <p className="text-sm font-semibold text-green-600">{t('walletCompensationApprovedNotice')}</p>
                                                </div>
                                            )}
                                            <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-2 h-2 rounded-full bg-[#338DFF]" />
                                                    <p className="text-xs font-semibold text-gray-500 uppercase">{t('commonPickupLocation')}</p>
                                                </div>
                                                <p className="text-sm text-gray-700">{selected.handover_address || '-'}</p>
                                                <div className="h-px bg-gray-100" />
                                                <div className="flex items-center gap-3">
                                                    <span className="w-2 h-2 rounded-full bg-[#338DFF]" />
                                                    <p className="text-xs font-semibold text-gray-500 uppercase">{t('commonDropOffLocation')}</p>
                                                </div>
                                                <p className="text-sm text-gray-700">{selected.delivery_address || '-'}</p>
                                            </div>
                                            <div className="bg-white p-2 space-y-4">
                                                <h3 className="text-sm font-semibold text-gray-900">{t('commonParcelDetails')}</h3>
                                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                                    <div>
                                                        <p className="text-xs font-semibold text-[#338DFF]">{t('commonParcelId')}</p>
                                                        <p className="text-sm text-gray-800">{selected?.order_number || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-[#338DFF]">{t('commonConsignmentType')}</p>
                                                        <p className="text-sm text-gray-800 capitalize">{selected?.consignment_type || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-[#338DFF]">{t('commonSize')}</p>
                                                        <p className="text-sm text-gray-800">{selected?.size.name || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-[#338DFF]">{t('commonWeight')}</p>
                                                        <p className="text-sm text-gray-800">{selected?.weight || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-[#338DFF]">{t('shipmentsAddressCode')}</p>
                                                        <p className="text-sm text-gray-800">{selected?.address_code || '-'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {selected?.componsation_remarks_sender && <div>
                                                <h3 className="text-sm font-bold text-gray-900 mb-2">{t('walletCompensationRemarksFromSender')}</h3>
                                                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                                    <p className="text-sm text-gray-600 leading-relaxed">
                                                        {selected?.componsation_remarks_sender}
                                                    </p>
                                                </div>
                                            </div>}
                                            {selected?.componsation_images && selected?.componsation_images?.length > 0 && (
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-900 mb-3">{t('walletCompensationImagesFromSender')}</h3>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {JSON.parse(selected?.componsation_images ||  []).map((photo, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200"
                                                                >
                                                                    <img
                                                                        src={photo}
                                                                        alt={t('walletEvidenceImageAlt', { number: idx + 1 })}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            e.target.style.display = 'none';
                                                                        }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                </div>
                                            )}
                                                
                                            <div className="bg-white border-2 border-gray-300 rounded-2xl p-4 space-y-3">
                                                <h3 className="text-sm font-semibold text-gray-900">{t('walletCompensationSummary')}</h3>
                                                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                                                    <span>{t('walletOriginalParcelValue')}</span>
                                                    <span className="text-right font-semibold text-gray-900">{formatAmount(receiverOriginalValue)}</span>
                                                    <span>{t('walletRequestedCompensation')}</span>
                                                    <span className="text-right font-semibold text-gray-900">{formatAmount(receiverRequestedCompensation)}</span>
                                                    <span>{t('walletYouWouldReceive')}</span>
                                                    <span className="text-right font-semibold text-gray-900">{formatAmount(receiverYouWouldReceive)}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {selectedCompensationStatus === 'pending' && (
                                                <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 px-4 py-3">
                                                    <p className="text-sm font-semibold text-blue-600">{t('walletCompensationPendingStatus')}</p>
                                                </div>
                                            )}
                                            {selectedCompensationStatus === 'rejected' && (
                                                <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
                                                    <p className="text-sm font-semibold text-red-600">{t('walletCompensationRejectedNotice')}</p>
                                                </div>
                                            )}
                                            {selectedCompensationStatus === 'approved' && (
                                                <div className="rounded-2xl border-2 border-green-300 bg-green-50 px-4 py-3">
                                                    <p className="text-sm font-semibold text-green-600">{t('walletCompensationApprovedNotice')}</p>
                                                </div>
                                            )}
                                            <div className="bg-white border rounded-2xl p-4 space-y-4 grid-cols-2 grid">
                                                <div>
                                                    <p className="text-xs font-semibold text-[#338DFF] mb-1">{t('commonParcelId')}</p>
                                                    <p className="text-sm text-gray-800">{selected.order_number || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-[#338DFF] mb-1">{t('commonConsignmentType')}</p>
                                                    <p className="text-sm text-gray-800 capitalize">{selected.consignment_type || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-[#338DFF] mb-1">{t('commonAmount')}</p>
                                                    <p className="text-sm text-gray-800">{formatAmount(selected.payment.goods_amount || selected.payment.total_fee)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-[#338DFF] mb-1">{t('commonReturnReason')}</p>
                                                    <p className="text-sm text-gray-800">{selected?.returned_shipment?.return_reason || '-'}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 mb-2">{t('authAdditionalDetails')}</h3>
                                                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                                    <p className="text-sm text-gray-600 leading-relaxed">
                                                        {selected?.returned_shipment?.special_instruction || selected?.returned_shipment?.return_reason || t('walletNoAdditionalDetails')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 mb-3">{t('walletParcelConditionEvidence')}</h3>
                                                {selected?.returned_shipment?.photos && selected?.returned_shipment?.photos.length > 0 ? (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {selected?.returned_shipment?.photos.map((photo, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200"
                                                            >
                                                                <img
                                                                    src={photo}
                                                                    alt={t('walletEvidenceImageAlt', { number: idx + 1 })}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                    }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 rounded-xl px-4 py-6 border border-gray-100 text-center">
                                                        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        <p className="text-xs text-gray-400">{t('walletNoEvidencePhotos')}</p>
                                                    </div>
                                                )}
                                            </div>
                                            {selectedCompensationStatus === 'approved' ? (
                                                <div className="bg-white border-2 border-gray-300 rounded-2xl p-4 space-y-3">
                                                    <h3 className="text-sm font-semibold text-gray-900">{t('walletCompensationSummary')}</h3>
                                                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                                                        <span>{t('createBookingParcelAmountPlaceholder')}</span>
                                                        <span className="text-right font-semibold text-gray-900">{formatAmount(selected.parcel_amount || selected.amount)}</span>
                                                        <span>{t('walletApprovedCompensation')}</span>
                                                        <span className="text-right font-semibold text-gray-900">{formatAmount(selected.componsation_amount || 0)}</span>
                                                        <span>{selected.role == "receiver" ? t('walletYouWillReceive') : t('walletYouPaid')}</span>
                                                        <span className="text-right font-semibold text-gray-900">{formatAmount(Math.max((selected.parcel_amount || selected.amount) - (selected.componsation_amount || 0), 0))}</span>
                                                    </div>
                                                </div>
                                            ) : showApproveReturnButton &&  (
                                                <label className="flex items-start gap-3 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={acknowledged}
                                                        onChange={(e) => setAcknowledged(e.target.checked)}
                                                        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#338DFF] focus:ring-[#338DFF] cursor-pointer"
                                                    />
                                                    <span className="text-sm text-gray-700">
                                                        {t('commonReturnAcknowledgement')}
                                                    </span>
                                                </label>
                                            )}
                                        </>
                                    )
                                ) : (
                                    <>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-800 mb-2">{t('walletDamageDescription')}</label>
                                                <textarea
                                                    value={compensationDescription}
                                                    onChange={(e) => {
                                                        setCompensationDescription(e.target.value);
                                                        if (damageError) {
                                                            setDamageError('');
                                                        }
                                                    }}
                                                    className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#338DFF] resize-none min-h-[120px]"
                                                />
                                                {damageError && (
                                                    <p className="text-xs text-red-500 mt-1">{damageError}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-800 mb-2">{t('walletRequestedAmount')}</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={compensationAmount}
                                                        onChange={(e) => {
                                                            setCompensationAmount(e.target.value);
                                                            if (amountError) {
                                                                setAmountError('');
                                                            }
                                                        }}
                                                        className="w-full pr-16 pl-4 py-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-[#338DFF]"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-semibold">{t('commonCurrencySyp')}</span>
                                                </div>
                                                {amountError && (
                                                    <p className="text-xs text-red-500 mt-1">{amountError}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-800 mb-2">{t('walletProofOfDamage')}</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <label
                                                        className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 cursor-pointer hover:border-gray-400 transition"
                                                    >
                                                        <span className="text-lg font-semibold text-gray-400">+</span>
                                                        <span className="mt-1">{t('commonAddNew')}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            onChange={handleProofPhotoSelect}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    {proofPhotos.map((photo, index) => (
                                                        <div
                                                            key={`${photo}-${index}`}
                                                            className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200"
                                                        >
                                                            <img
                                                                src={photo}
                                                                alt={t('walletProofImageAlt')}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveProofPhoto(index)}
                                                                aria-label={t('walletRemovePhotoAriaLabel')}
                                                                className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-gray-600 shadow hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#338DFF]"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                {photoError && (
                                                    <p className="text-xs text-red-500 mt-1">{photoError}</p>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : null}
                </Drawer>

                {showApproveConfirm && (
                    <ConfirmModal
                        title={t('walletConfirmApprovalTitle')}
                        message={t('walletConfirmApprovalMessage')}
                        cancelLabel={t('commonCancel')}
                        confirmLabel={t('commonConfirm')}
                        onCancel={() => setShowApproveConfirm(false)}
                        onConfirm={confirmApproveReturn}
                    />
                )}

                {showReceiverConfirm && (
                    <ConfirmModal
                        title={pendingReceiverAction === 'approved' ? t('walletApproveCompensationTitle') : t('walletRejectCompensationTitle')}
                        message={pendingReceiverAction === 'approved'
                            ? t('walletApproveCompensationMessage')
                            : t('walletRejectCompensationMessage')}
                        cancelLabel={t('commonCancel')}
                        confirmLabel={pendingReceiverAction === 'approved' ? t('walletApproveLabel') : t('walletRejectLabel')}
                        onCancel={() => {
                            setShowReceiverConfirm(false);
                            setPendingReceiverAction(null);
                        }}
                        onConfirm={handleReceiverActionConfirm}
                    />
                )}

                {showApproveSuccessPopup && (
                    <Popup
                        title={t('walletReturnApprovedTitle')}
                        message={approveReturnSuccessMessage || t('walletReturnApprovedMessage')}
                        onConfirm={() => {
                            setShowApproveSuccessPopup(false);
                            setApproveReturnSuccessMessage('');
                        }}
                    />
                )}

                {showCompensationSuccessPopup && (
                    <Popup
                        title={t('notificationCompensationRequestedTitle')}
                        message={compensationSuccessMessage || t('walletCompensationRequestedMessage')}
                        onConfirm={() => {
                            setShowCompensationSuccessPopup(false);
                            setCompensationSuccessMessage('');
                        }}
                    />
                )}
                
                {showReceiverActionSuccessPopup && (
                    <Popup
                        title={t('walletCompensationStatusUpdatedTitle')}
                        message={receiverActionSuccessMessage || t('walletCompensationStatusUpdatedMessage')}
                        onConfirm={() => setShowReceiverActionSuccessPopup(false)}
                    />
                )}
            </main>
        </div>
    );
}
