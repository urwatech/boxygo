import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';
import QRCode from '../../Components/Shared/QRCode';
import Popup from '../SuperAdmin/Components/Popup';
import PaymentModal from '../../Components/Customer/PaymentModal';
import ImagePreviewGallery from '../../Components/Customer/ImagePreviewGallery';
import DataTable from '../../Components/Common/DataTable';
import {
    confirmMtnPayment,
    confirmSyriatelPayment,
    initiateMtnPayment,
    initiatePaymeraPayment,
    initiateSyriatelPayment,
    resendSyriatelOtp,
} from '../../utils/customerPaymentApi';
import NotificationDropdown from '../../Components/Customer/NotificationDropdown';
import MobileHeader from '../../Components/Customer/MobileHeader';
import {
    PAGE_SIZE,
    SHARE_OPTIONS,
    getCsrfHeaders,
    getEmployeeIdentifier,
    translateEnumeratedValue,
    toDateOnly,
    formatPrintDate,
    extractPrimaryLocation,
    getCityCodeByCoordinates,
    statusColor,
    statusLabel,
    resolveDeliverySpeed,
    isDirectDeliverySpeed,
    resolveShipmentAmount,
    parseCurrencyValue,
    buildVatLabel,
    getLatestStatusFromHistory,
    mapShipmentToRow,
    buildShipmentTimeline,
    statusKeyFromString,
} from '../../Components/Customer/Shipments/shipmentHelpers';
import {
    DetailField,
    ParticipantDetailCard,
    PaymentSummaryPanel,
    ReturnParcelDetailsSummary,
    ShareShipmentModal,
    ShipmentInvoiceView,
    ShipmentParcelDetailsGrid,
    ShipmentQrDrawer,
    ShipmentReviewModal,
    ShipmentSectionCard,
    ShipmentTimeline,
    StatusBadge,
} from '../../Components/Customer/Shipments';
const formatSYP = (value) => (Number.isFinite(value) ? `${value} SYP` : '--');

export default function SendingParcels({ shipments = {}, filters = {}, selectedShipment = null, financialSettings = {}, cities = [], receiverMode = false }) {
    console.log("shipments",  shipments);
    
    const { t } = useTranslation();
    const page = usePage();
    const auth = page?.props?.auth ?? null;
    const userProfile = page?.props?.auth?.user ?? null;
    const isPublicView = Boolean(page?.props?.publicView);
    const incomingSenderPaymentStatus = page?.props?.paymentStatus;
    const hasHandledSenderPaymentStatusFromProps = useRef(false)

    // Detect server-side pagination (Laravel paginator)
    const isServerPaginated = useMemo(() => {
        return !!(shipments && typeof shipments === 'object' && Array.isArray(shipments.data));
    }, [shipments]);

    // Map current page's shipments to rows
    const records = useMemo(() => {
        const data = Array.isArray(shipments) ? shipments : (shipments?.data ?? []);
        return data.map((shipment) => mapShipmentToRow(shipment, t, { mode: 'sending' }));
    }, [shipments, t]);

    const [search, setSearch] = useState(filters.search ?? '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    // Local page state is only used for client-side pagination fallback
    const [currentPage, setCurrentPage] = useState(1);
    const [selected, setSelected] = useState(selectedShipment ?? null);
    const [open, setOpen] = useState(Boolean(selectedShipment));
    const [showQr, setShowQr] = useState(false);
    const [reviewErrorMessage, setReviewErrorMessage] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    // Return Pickup State
    const [showReturnPopup, setShowReturnPopup] = useState(false);
    const [showReturnErrorPopup, setShowReturnErrorPopup] = useState(false);
    const [returnErrorMessage, setReturnErrorMessage] = useState('');
    const [returnSubmitting, setReturnSubmitting] = useState(false);

    // Return Modal Inputs
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [returnReason, setReturnReason] = useState('Other');
    const [returnInstruction, setReturnInstruction] = useState('');
    const [returnAcknowledgement, setReturnAcknowledgement] = useState(false);
    const [returnImages, setReturnImages] = useState([]);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + returnImages.length > 5) {
            alert("You can only upload a maximum of 5 images.");
            return;
        }

        const validFiles = files.filter(file => {
            const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
            const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
            return isValidType && isValidSize;
        });

        if (validFiles.length !== files.length) {
            alert("Some files were rejected. Only JPG/PNG/WEBP under 5MB are allowed.");
        }

        setReturnImages(prev => [...prev, ...validFiles]);
    };

    const removeImage = (index) => {
        setReturnImages(prev => prev.filter((_, i) => i !== index));
    };

    // Check return window and open modal
    const handleReturnClick = () => {
        if (!selected) return;

        // Check return window if applicable
        if (selected.return_window) {
            // Find delivery date (approximate from history if not stored directly)
            let deliveryDate = null;
            if (Array.isArray(selected.status_history)) {
                // Try to find 'Delivered' status
                const entry = selected.status_history.slice().reverse().find(h =>
                    (h.status || '').toLowerCase().includes('delivered')
                );
                if (entry && entry.created_at) {
                    deliveryDate = new Date(entry.created_at);
                }
            }

            // If we found a delivery date, check window
            if (deliveryDate) {
                const deadline = new Date(deliveryDate);
                deadline.setDate(deadline.getDate() + selected.return_window);

                // End of day buffer? User requirement just says "passed". Let's say strict timestamp comparison.
                if (new Date() > deadline) {
                    // Window expired. Ideally button shouldn't be shown, but as a safety check:
                    alert(t('returnWindowHasExpired') || 'Return window has expired.');
                    return;
                }
            }
        }

        // Reset form and open modal
        setReturnReason('Other');
        setReturnInstruction('');
        setReturnImages([]);
        setReturnAcknowledgement(false);
        setReturnModalOpen(true);
    };

    const submitReturnRequest = async () => {
        if (!returnAcknowledgement) {
            alert(t('shipmentsReturnAckRequired') || 'Please acknowledge the return policy.');
            return;
        }

        if (!selected) return;
        try {
            setReturnSubmitting(true);
            // Ensure we post using the numeric shipment id or ID from selected
            const shipmentId = (selected?.id)
                ? selected.id
                : String(selected?.ship_id || '').replace(/[^0-9]/g, '') || '';

            const formData = new FormData();
            formData.append('return_reason', returnReason);
            formData.append('instruction', returnInstruction);

            returnImages.forEach((image) => {
                formData.append('images[]', image);
            });

            const resp = await fetch(`/shipments/${shipmentId}/return`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...getCsrfHeaders(),
                },
                credentials: 'same-origin',
                body: formData
            });

            let data = null;
            try { data = await resp.json(); } catch (e) { /* ignore parse errors */ }

            if (resp.ok && data?.ok) {
                setReturnModalOpen(false); // Close modal
                setShowReturnPopup(true);  // Show success
                if (selected) {
                    setSelected({ ...selected, return_requested: true });
                }
            } else {
                setReturnErrorMessage(data?.message || 'Failed to request return pickup.');
                setShowReturnErrorPopup(true);
            }
        } catch (error) {
            console.error(error);
            setReturnErrorMessage('An unexpected error occurred. Please try again.');
            setShowReturnErrorPopup(true);
        } finally {
            setReturnSubmitting(false);
        }
    };
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareFeedback, setShareFeedback] = useState('');
    const [shareFeedbackTone, setShareFeedbackTone] = useState('success');
    const [returnedShipment, setReturnedShipment] = useState(selected?.returned_shipment ?? null);
    const shareFeedbackTimeout = useRef(null);

    useEffect(() => {
        return () => {
            if (shareFeedbackTimeout.current) {
                clearTimeout(shareFeedbackTimeout.current);
            }
        };
    }, []);

    const shareTrackingNumber = useMemo(() => {
        if (!selected) {
            return '';
        }
        const tracking = (
            selected?.tracking_number
            ?? selected?.trackingNumber
            ?? selected?.tracking_no
            ?? selected?.trackingNo
            ?? ''
        );
        if (tracking) {
            return tracking;
        }
        const fallbackId = selected?.id ?? selected?.ship_id ?? '';
        return fallbackId ? `SHIP-${String(fallbackId).padStart(8, '0')}` : '';
    }, [selected]);

    const shareLink = useMemo(() => {
        if (!selected) {
            return '';
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (shareTrackingNumber) {
            const trackPath = `/track/${shareTrackingNumber}`;
            return origin ? `${origin}${trackPath}` : trackPath;
        }
        const shipmentId = selected?.ship_id ?? selected?.id ?? '';
        if (!shipmentId) {
            return origin || '';
        }
        const detailPath = `/customer/shipments/${shipmentId}`;
        return origin ? `${origin}${detailPath}` : detailPath;
    }, [selected, shareTrackingNumber]);

    const shareMessage = useMemo(() => {
        if (!shareLink) {
            return '';
        }
        if (shareTrackingNumber) {
            return `Track shipment ${shareTrackingNumber} here: ${shareLink}`;
        }
        return `Track this shipment here: ${shareLink}`;
    }, [shareLink, shareTrackingNumber]);

    const resetShareFeedback = () => {
        setShareFeedback('');
        setShareFeedbackTone('success');
        if (shareFeedbackTimeout.current) {
            clearTimeout(shareFeedbackTimeout.current);
            shareFeedbackTimeout.current = null;
        }
    };

    const triggerShareFeedback = (message, tone = 'success') => {
        resetShareFeedback();
        if (message) {
            setShareFeedback(message);
            setShareFeedbackTone(tone);
            shareFeedbackTimeout.current = setTimeout(() => {
                setShareFeedback('');
                setShareFeedbackTone('success');
                shareFeedbackTimeout.current = null;
            }, 2200);
        }
    };

    const closeShareModal = () => {
        setShowShareModal(false);
        resetShareFeedback();
    };

    const copyShareLink = async () => {
        if (!shareLink) {
            triggerShareFeedback(t('shipmentsShareUnavailable'), 'error');
            return;
        }
        try {
            if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareLink);
            } else if (typeof document !== 'undefined') {
                const textarea = document.createElement('textarea');
                textarea.value = shareLink;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            triggerShareFeedback(t('shipmentsShareCopied'));
        } catch {
            triggerShareFeedback(t('shipmentsShareCopyError'), 'error');
        }
    };

    const handleSocialShare = (platform) => {
        if (!shareLink) {
            triggerShareFeedback(t('shipmentsShareUnavailable'), 'error');
            return;
        }
        const encodedLink = encodeURIComponent(shareLink);
        const encodedMessage = encodeURIComponent(shareMessage || shareLink);
        const openShareWindow = (url) => {
            if (typeof window !== 'undefined') {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        };
        switch (platform) {
            case 'whatsapp':
                openShareWindow(`https://wa.me/?text=${encodedMessage}`);
                break;
            case 'facebook':
                openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`);
                break;
            case 'instagram':
                if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                    navigator.share({
                        title: 'Track my shipment',
                        text: shareMessage || shareLink,
                        url: shareLink,
                    }).catch(() => { });
                } else {
                    copyShareLink();
                }
                break;
            case 'copy':
            default:
                copyShareLink();
                break;
        }
    };

    const selectedDeliverySpeed = resolveDeliverySpeed(selected);
    const isSelectedDirectDelivery = isDirectDeliverySpeed(selectedDeliverySpeed);
    const selectedDeliverySpeedLabel = selectedDeliverySpeed
        ? translateEnumeratedValue(selectedDeliverySpeed, t, selectedDeliverySpeed)
        : (isSelectedDirectDelivery ? t('deliverySpeedDirect') : t('deliverySpeedIndirect'));
    const selectedPaymentStatus = selected?.payment_status ?? selected?.payment?.status ?? '';
    const selectedPaymentMethod = selected?.payment_method ?? selected?.payment?.method ?? '';
    const paymentMethodLabel = useMemo(() => {
        if (!selected) {
            return '-';
        }
        const status = (selectedPaymentStatus || '').toString().toLowerCase().trim();
        const method = (selectedPaymentMethod || '').toString().toLowerCase().trim();

        // If payment is paid, show 'Done'
        if (status === 'paid' || status === 'completed') {
            return 'Done';
        }

        // If payment is pending, show the payment method
        if (status === 'pending' || status === 'unpaid') {
            if (method === 'cash') {
                return 'COD';
            } else if (method === 'online') {
                return 'Online';
            } else if (method) {
                return method.charAt(0).toUpperCase() + method.slice(1);
            }
            return 'Pending';
        }

        // Default: show payment method if available
        if (method === 'cash') {
            return 'Cash';
        } else if (method === 'online') {
            return 'Online';
        } else if (method) {
            return method.charAt(0).toUpperCase() + method.slice(1);
        }

        return '-';
    }, [selected, selectedPaymentStatus, selectedPaymentMethod]);
    const selectedIndirectMode = selected?.indirect_delivery_mode ?? selected?.indirectDeliveryMode ?? '';
    const selectedIndirectModeLabel = selectedIndirectMode
        ? translateEnumeratedValue(selectedIndirectMode, t, selectedIndirectMode.replace(/_/g, ' '))
        : '';
    const selectedConsignmentLabel = selected?.consignment_type
        ? translateEnumeratedValue(selected?.consignment_type, t, selected?.consignment_type)
        : '-';
    const selectedInsuranceLabel = selected?.insurance
        ? translateEnumeratedValue(selected?.insurance, t, selected?.insurance)
        : '-';
    const selectedAmount = useMemo(() => resolveShipmentAmount(selected), [selected]);
    const selectedStatusKey = statusKeyFromString(selected?.status);
    const shipmentStatusLabel = useMemo(() => {
        if (!selected) {
            return '-';
        }
        const status = (selected?.status || '').toString().toLowerCase().trim();

        // Show 'Normal Sending' for pending status
        if (status !== 'delivered') {
            return t('shipmentsStatusNormalSending');
        }

        // Otherwise, use the translated status
        return translateEnumeratedValue(selected?.status, t, selected?.status) || '-';
    }, [selected, t]);
    const selectedAmountLabel = selectedAmount != null ? `${selectedAmount} SYP` : '-';
    const selectedShipmentNumber = useMemo(() => {
        if (!selected) {
            return '-';
        }
        // Prioritize order_number, fall back to ship_id or id
        const orderNumber = selected?.order_number ?? selected?.orderNumber ?? '';
        if (orderNumber) {
            return orderNumber;
        }
        const raw = selected?.ship_id ?? selected?.id ?? selected?.reference ?? '';
        if (!raw) {
            return '-';
        }
        return `#${String(raw).replace(/^#/, '')}`;
    }, [selected]);
    const selectedPaymentSummary = useMemo(() => {
        if (!selected) return null;

        const payment = selected?.payment ?? {};
        const shipmentFee = parseCurrencyValue(payment.shipment_fee) || 0;
        const senderZoneDeliveryFee =
            parseCurrencyValue(payment.sender_zone_delivery_fee ?? selected?.sender_zone_delivery_fee) || 0;
        const receiverZoneDeliveryFee =
            parseCurrencyValue(payment.reciever_zone_delivery_fee ?? selected?.reciever_zone_delivery_fee) || 0;
        const goodsAmount = parseCurrencyValue(payment.goods_amount) || 0;
        const serviceFee = parseCurrencyValue(payment.service_fee ?? selected?.service_fee) || 0;
        const insuranceFee = parseCurrencyValue(payment.insurance_fee) || 0;
        const platformFee = parseCurrencyValue(payment.platform_fee) || 0;
        const vat = parseCurrencyValue(payment.vat_amount) || 0;
        const subtotal = parseCurrencyValue(payment.subtotal) ?? (shipmentFee + goodsAmount + insuranceFee + serviceFee);
        const total = parseCurrencyValue(payment.total_fee) ?? (subtotal + platformFee + vat);
        const vatLabel = buildVatLabel(selected?.delivery_speed ?? selected?.shipment_type, financialSettings);

        return {
            shipmentFee,
            senderZoneDeliveryFee,
            receiverZoneDeliveryFee,
            goodsAmount,
            serviceFee,
            insuranceFee,
            subtotal,
            platformFee,
            vat,
            total,
            vatLabel,
        };
    }, [selected, financialSettings]);
    const senderName = selected?.sender_name ?? '-';
    const senderPhone = selected?.sender_phone ?? '-';
    const senderAddress = selected?.sender_address ?? selected?.handover_address ?? '-';
    const receiverName = selected?.receiver_name ?? '-';
    const receiverPhone = selected?.receiver_phone ?? '-';
    const receiverAddress = selected?.receiver_address ?? selected?.delivery_address ?? '-';
    const receiverCity = extractPrimaryLocation(
        selected?.delivery_address
        ?? selected?.receiver_city
        ?? selected?.receiverCity
        ?? ''
    );
    const shippingRouteLabel = useMemo(() => {
        if (!selected) {
            return '-';
        }
        const origin = extractPrimaryLocation(
            selected?.handover_address
            ?? selected?.sender_city
            ?? selected?.senderCity
            ?? ''
        );
        const destination = extractPrimaryLocation(
            selected?.delivery_address
            ?? selected?.receiver_city
            ?? selected?.receiverCity
            ?? ''
        );
        if (origin && destination) {
            return `${origin} - ${destination}`;
        }
        return origin || destination || '-';
    }, [selected]);
    const sendingDateLabel = useMemo(() => {
        if (!selected) {
            return '-';
        }
        const candidate = selected?.schedule_time
            ?? selected?.date
            ?? selected?.created_at
            ?? selected?.createdAt
            ?? '';
        const formatted = formatPrintDate(candidate);
        if (formatted) {
            return formatted;
        }
        return candidate ? toDateOnly(candidate) : '-';
    }, [selected]);
    const goodsAmountLabel = useMemo(() => {
        if (!selected) {
            return '-';
        }
        const amount = selected?.payment?.goods_amount ?? selected?.parcel_amount ?? '';
        if (amount === null || amount === undefined || amount === '') {
            return '-';
        }
        const numeric = Number(amount);
        if (Number.isFinite(numeric)) {
            return `${numeric} SYP`;
        }
        return String(amount);
    }, [selected]);
    const addressCodeLabel = useMemo(() => {
        if (!selected) {
            return '-';
        }

        // Get origin coordinates
        const originLat = selected?.handover_latitude ?? selected?.sender_latitude ?? null;
        const originLon = selected?.handover_longitude ?? selected?.sender_longitude ?? null;

        // Get destination coordinates
        const destLat = selected?.delivery_latitude ?? selected?.receiver_latitude ?? null;
        const destLon = selected?.delivery_longitude ?? selected?.receiver_longitude ?? null;

        const originCode = getCityCodeByCoordinates(originLat, originLon, cities);
        const destinationCode = getCityCodeByCoordinates(destLat, destLon, cities);

        if (originCode && destinationCode) {
            return `${originCode} - ${destinationCode}`;
        }
        return originCode || destinationCode || '-';
    }, [selected, cities]);
    const qrPayload = useMemo(() => {
        if (!selected) {
            return '{}';
        }
        const hasDimensions = selected?.custom_length || selected?.custom_width || selected?.custom_height;
        return JSON.stringify({
            id: selected?.id || selected?.ship_id || null,
            order_number: selected?.order_number || selected?.orderNumber || null,
            tracking_number: selected?.tracking_number || `SHIP-${String(selected?.id || '').padStart(8, '0')}`,
            weight: selected?.weight || null,
            size: selected?.size?.name || selected?.size || null,
            dimensions: hasDimensions ? {
                length: selected?.custom_length || null,
                width: selected?.custom_width || null,
                height: selected?.custom_height || null
            } : null,
            value: selected?.parcel_amount || null,
            insurance: selected?.insurance || null,
            payment: {
                method: selected?.payment_method || selected?.payment?.method || null,
                status: selected?.payment_status || selected?.payment?.status || null,
                total_fee: selectedAmount ?? selected?.payment?.total_fee ?? 0
            }
        });
    }, [selected, selectedAmount]);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [showReviewPopup, setShowReviewPopup] = useState(false);
    const [showReviewErrorPopup, setShowReviewErrorPopup] = useState(false);

    const [reviewForm, setReviewForm] = useState({ rider_behavior: 0, on_time_delivery: 0, affordability: 0, comment: '' });
    const [employeeRatings, setEmployeeRatings] = useState({});
    // Toggle to hide header and sidebar when viewing invoice
    const [invoiceView, setInvoiceView] = useState(isPublicView);
    const hideLayout = invoiceView || isPublicView;

    // Cancellation state
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelSubmitting, setCancelSubmitting] = useState(false);
    const [showCancelSuccessPopup, setShowCancelSuccessPopup] = useState(false);
    const [showCancelErrorPopup, setShowCancelErrorPopup] = useState(false);
    const [cancelErrorMessage, setCancelErrorMessage] = useState('');
    const [senderPaymentModalOpen, setSenderPaymentModalOpen] = useState(false);
    const [senderPaymentDetails, setSenderPaymentDetails] = useState(null);
    const [senderPaymentSubmitting, setSenderPaymentSubmitting] = useState(false);
    const [senderPaymentError, setSenderPaymentError] = useState('');
    const [senderOnlineProvider, setSenderOnlineProvider] = useState('mtn');
    const [senderOnlinePhone, setSenderOnlinePhone] = useState('');
    const [senderOnlineStep, setSenderOnlineStep] = useState('phone');
    const [senderOtpCode, setSenderOtpCode] = useState('');
    const [senderPaymentData, setSenderPaymentData] = useState(null);
    const [senderPaymentStatus, setSenderPaymentStatus] = useState(null);
    const senderPaymentStatusTimeout = useRef(null);
    const senderPaymentStatusContinuation = useRef(null);

    const isCancellable = useMemo(() => {
        if (!selected || !auth?.user) return false;

        // Check if user is the sender (user_id matches current user)
        // Note: The comparison should be handled carefully for numeric/string IDs
        if (Number(selected.user_id) !== Number(auth.user.id)) return false;

        // RULE 1: Already cancelled
        if (selectedStatusKey === 'cancelled') return false;

        // RULE 2: Paid by receiver online
        const feePayer = (selected.delivery_fee_payer || '').toLowerCase();
        const payMethod = (selected.receiver_payment_method || '').toLowerCase();
        const payStatus = (selected.payment_status || selected.payment?.status || '').toLowerCase();
        // if (feePayer === 'receiver' && payMethod === 'online' && (payStatus === 'paid' || payStatus === 'completed')) {
        if (payMethod === 'online' && payStatus === 'paid') {
            return false;
        }

        const deliverySpeed = resolveDeliverySpeed(selected);
        const isDirect = isDirectDeliverySpeed(deliverySpeed);
        const rawStatus = (selected.status || '').toLowerCase();

        // RULE 3: Direct Delivery - Cancellable if Pending or Assigned
        if (isDirect) {
            return rawStatus === 'pending' || rawStatus === 'new' || rawStatus === 'unassigned';
        }

        // RULE 4: Indirect Delivery - Cancellable only if Pending
        return rawStatus === 'pending' || rawStatus === 'new';
    }, [selected, auth?.user, selectedStatusKey]);

    const showSenderPayNowButton = () => {
        const isSenderPaying = selected?.delivery_fee_payer == "sender" || selected?.return_delivery_fee_payer == "sender";
        const senderPaymentStatus = (selected?.sender_payment_status ?? '').toString().toLowerCase();
        const paymentMethod = (selected?.payment_method ?? selected?.payment?.method ?? '').toString().toLowerCase();
        const isCancelled = (selected?.status ?? '').toString().toLowerCase() === 'cancelled';
        return isSenderPaying && senderPaymentStatus === 'pending' && paymentMethod === 'online' && !isCancelled;
    };

    const closeSenderPaymentModal = () => {
        setSenderPaymentModalOpen(false);
        setSenderPaymentDetails(null);
        setSenderPaymentError('');
        setSenderPaymentSubmitting(false);
        setSenderOnlineProvider('mtn');
        setSenderOnlinePhone('');
        setSenderOnlineStep('phone');
        setSenderOtpCode('');
        setSenderPaymentData(null);
    };

    const clearSenderPaymentStatusTimeout = () => {
        if (senderPaymentStatusTimeout.current) {
            clearTimeout(senderPaymentStatusTimeout.current);
            senderPaymentStatusTimeout.current = null;
        }
    };

    const closeSenderPaymentStatusModal = () => {
        clearSenderPaymentStatusTimeout();
        setSenderPaymentStatus(null);
        const continuation = senderPaymentStatusContinuation.current;
        senderPaymentStatusContinuation.current = null;
        if (typeof continuation === 'function') {
            continuation();
        }
    };

    const showSenderPaymentStatus = ({
        type = 'success',
        title = '',
        message = '',
        fallbackMessage = '',
        onContinue = null,
        delayMs = 0,
    }) => {
        const resolvedType = type === 'success' ? 'success' : 'error';
        const providedTitle = typeof title === 'string' ? title.trim() : '';
        const description = message || fallbackMessage || '';
        const isCancelled = /cancel/i.test(String(description));
        const resolvedTitle = providedTitle || (resolvedType === 'success'
            ? ( 'Payment Successful' || t('notificationPaymentSuccessTitle'))
            : (isCancelled
                ? ('Payment Cancelled' || t('commonPaymentCancelled'))
                : ("Payment Failed" ||  t('notificationPaymentFailedTitle'))));

        if (!resolvedTitle && !description) {
            return;
        }

        clearSenderPaymentStatusTimeout();
        senderPaymentStatusContinuation.current = typeof onContinue === 'function' ? onContinue : null;
        setSenderPaymentStatus({
            type: resolvedType,
            title: resolvedTitle,
            description,
        });

        if (delayMs > 0 && typeof onContinue === 'function') {
            senderPaymentStatusTimeout.current = setTimeout(() => {
                closeSenderPaymentStatusModal();
            }, delayMs);
        }
    };

    useEffect(() => {
        if (hasHandledSenderPaymentStatusFromProps.current) {
            return;
        }

        if (!incomingSenderPaymentStatus || typeof incomingSenderPaymentStatus !== 'object') {
            return;
        }

        hasHandledSenderPaymentStatusFromProps.current = true;
        showSenderPaymentStatus({
            type: incomingSenderPaymentStatus.type,
            title: incomingSenderPaymentStatus.title,
            message: incomingSenderPaymentStatus.description,
            fallbackMessage: incomingSenderPaymentStatus.description,
        });
    }, [incomingSenderPaymentStatus]);

    useEffect(() => {
        return () => {
            clearSenderPaymentStatusTimeout();
            senderPaymentStatusContinuation.current = null;
        };
    }, []);

    const resolveSelectedShipmentId = () => {
        const raw = selected?.id ?? selected?.ship_id ?? '';
        const id = Number(String(raw).replace(/[^0-9]/g, ''));
        return Number.isFinite(id) && id > 0 ? id : null;
    };

    const openSenderPaymentModalForParcel = () => {
        if (!selected || !selectedPaymentSummary) {
            return;
        }

        const senderPaysDelivery = (selected?.delivery_fee_payer ?? '').toString().toLowerCase() === 'sender';
        const senderPaysReturnDelivery = (selected?.return_delivery_fee_payer ?? '').toString().toLowerCase() === 'sender';
        const returnDeliveryFee = senderPaysReturnDelivery ? parseCurrencyValue(selected?.rdf_amount) : 0;
        const platformFee = Number(selectedPaymentSummary.platformFee ?? 0);
        const vat = Number(selectedPaymentSummary.vat ?? 0);
        const basicFee = senderPaysDelivery ? Number(selectedPaymentSummary.serviceFee ?? 0) : 0;
        const insuranceFee = Number(selectedPaymentSummary.insuranceFee ?? 0);
        const deliveryFee = senderPaysDelivery ? Number(selectedPaymentSummary.shipmentFee ?? 0) : 0;
        const total = senderPaysDelivery ? deliveryFee + basicFee + platformFee + vat + returnDeliveryFee + insuranceFee : returnDeliveryFee;
        const deliveryLineItems = isSelectedDirectDelivery
            ? [{ label: t('commonDeliveryFee'), amount: deliveryFee }]
            : [
                { label: t('commonSenderDoorServiceFee'), amount: Number(selectedPaymentSummary.senderZoneDeliveryFee ?? 0) },
                { label: t('commonReceiverDoorServiceFee'), amount: Number(selectedPaymentSummary.receiverZoneDeliveryFee ?? 0) },
            ];

        setSenderPaymentDetails({
            title: t('shipmentsParcelPayment'),
            description: t('shipmentsParcelPaymentDesc'),
            lineItems: [
                ...(senderPaysDelivery ? [...deliveryLineItems,
                    { label: t('commonBasicFee'), amount: basicFee },
                    { label: t('commonPlatformFee'), amount: platformFee }, 
                    { label: t('commonVat'), amount: vat },
                    { label: t('commonInsuranceFee'), amount: insuranceFee }
                ] : []),
                ...(senderPaysReturnDelivery ? [{ label: t('commonReturnDeliveryFee'), amount: returnDeliveryFee }] : []),
            ],
            total,
            actionAmount: total,
        });
        setSenderPaymentError('');
        setSenderPaymentSubmitting(false);
        setSenderOnlineProvider('mtn');
        setSenderOnlinePhone('');
        setSenderOnlineStep('phone');
        setSenderOtpCode('');
        setSenderPaymentData(null);
        setSenderPaymentModalOpen(true);
    };

    const resolveSenderPaymentAmount = () => {
        const modalTotal = Number(senderPaymentDetails?.total);
        if (Number.isFinite(modalTotal) && modalTotal > 0) {
            return modalTotal;
        }

        const senderAmount = parseCurrencyValue(selected?.sender_amount ?? selected?.payment?.sender_amount ?? 0);
        const senderPaysReturnDelivery = (selected?.return_delivery_fee_payer ?? '').toString().toLowerCase() === 'sender';
        const rdfAmount = senderPaysReturnDelivery ? parseCurrencyValue(selected?.rdf_amount) : 0;
        const computedTotal = Number(senderAmount) + Number(rdfAmount);

        if (Number.isFinite(computedTotal) && computedTotal > 0) {
            return computedTotal;
        }

        return Number(selected?.payment?.total_due ?? selected?.payment?.total_fee ?? selected?.parcel_amount ?? 0);
    };

    const finalizeSenderPayment = () => {
        setSelected((prev) => {
            if (!prev) {
                return prev;
            }

            const senderPaysReturnDelivery = (prev?.return_delivery_fee_payer ?? '').toString().toLowerCase() === 'sender';

            return {
                ...prev,
                sender_payment_status: 'paid',
                rdf_payment_status: senderPaysReturnDelivery ? 'paid' : prev?.rdf_payment_status,
            };
        });

        closeSenderPaymentModal();
        router.reload({ preserveState: true, preserveScroll: true });
    };

    const handleResendSenderOtp = async () => {
        if (!senderPaymentData?.invoice || !senderPaymentData?.shipment_id) {
            return;
        }

        try {
            setSenderPaymentSubmitting(true);
            const { ok, result } = await resendSyriatelOtp({
                shipment_id: senderPaymentData.shipment_id,
                invoice: senderPaymentData.invoice,
            });

            if (ok) {
                setSenderPaymentError(t('onlinePaymentOtpResent'));
            } else {
                setSenderPaymentError(result.message || t('onlinePaymentResendError'));
            }
        } catch (error) {
            console.error(error);
            setSenderPaymentError(t('onlinePaymentResendError'));
        } finally {
            setSenderPaymentSubmitting(false);
        }
    };

    const handleSenderPayNow = async () => {
        if (!selected || senderPaymentSubmitting) {
            return;
        }

        const shipmentId = resolveSelectedShipmentId();
        if (!shipmentId) {
            setSenderPaymentError('Unable to resolve shipment id for payment.');
            return;
        }

        const paymentAmount = resolveSenderPaymentAmount();
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            setSenderPaymentError('Invalid payment amount.');
            return;
        }

        setSenderPaymentError('');

        const baseOnlinePayload = {
            shipment_id: shipmentId,
            payment_method: 'online',
            payment_type: 'existing_shipment',
            payer_type: 'sender',
            payment_amount: paymentAmount,
            payment_for: 'receiver_delivery',
        };

        if (senderOnlineProvider === 'mtn' && senderOnlineStep === 'phone') {
            // if (!senderOnlinePhone || !/^09\d{8}$/.test(senderOnlinePhone)) {
            //     setSenderPaymentError(t('onlinePaymentPhoneInvalid'));
            //     return;
            // }

            try {
                setSenderPaymentSubmitting(true);
                const { ok, result } = await initiateMtnPayment({
                    ...baseOnlinePayload,
                    payment_phone: senderOnlinePhone,
                });

                if (!ok) {
                    const errorMessage = result.message || t('commonPaymentInitiateError');
                    setSenderPaymentError(errorMessage);
                    return;
                }

                setSenderPaymentData(result.payment);
                setSenderOnlineStep('otp');
            } catch (error) {
                console.error(error);
                const errorMessage = t('commonPaymentInitiateError');
                setSenderPaymentError(errorMessage);
            } finally {
                setSenderPaymentSubmitting(false);
            }
            return;
        }

        if (senderOnlineProvider === 'mtn' && senderOnlineStep === 'otp') {
            if (!senderOtpCode || senderOtpCode.length < 4) {
                setSenderPaymentError(t('onlinePaymentOtpInvalid'));
                return;
            }

            try {
                setSenderPaymentSubmitting(true);
                const { ok, result } = await confirmMtnPayment({
                    shipment_id: senderPaymentData?.shipment_id ?? shipmentId,
                    phone: senderPaymentData?.phone,
                    guid: senderPaymentData?.guid,
                    operation_number: senderPaymentData?.operation_number,
                    invoice: senderPaymentData?.invoice,
                    code: senderOtpCode,
                });

                if (!ok) {
                    const errorMessage = result.message || t('onlinePaymentConfirmError');
                    setSenderPaymentError(errorMessage);
                    return;
                }

                showSenderPaymentStatus({
                    type: 'success',
                    message: result?.message,
                    fallbackMessage: t('onlinePaymentSuccessMessage') || 'Payment completed successfully. Continuing...',
                    onContinue: () => {
                        finalizeSenderPayment();
                    },
                    delayMs: 1700,
                });
            } catch (error) {
                console.error(error);
                const errorMessage = t('onlinePaymentConfirmError');
                setSenderPaymentError(errorMessage);
            } finally {
                setSenderPaymentSubmitting(false);
            }
            return;
        }

        if (senderOnlineProvider === 'syriatel' && senderOnlineStep === 'phone') {
            // if (!senderOnlinePhone || !/^09\d{8}$/.test(senderOnlinePhone)) {
            //     setSenderPaymentError(t('onlinePaymentPhoneInvalid'));
            //     return;
            // }

            try {
                setSenderPaymentSubmitting(true);
                const { ok, result } = await initiateSyriatelPayment({
                    ...baseOnlinePayload,
                    payment_phone: senderOnlinePhone,
                });

                if (!ok) {
                    const errorMessage = result.message || t('commonPaymentInitiateError');
                    setSenderPaymentError(errorMessage);
                    return;
                }

                setSenderPaymentData(result.payment);
                setSenderOnlineStep('otp');
            } catch (error) {
                console.error(error);
                const errorMessage = t('commonPaymentInitiateError');
                setSenderPaymentError(errorMessage);
            } finally {
                setSenderPaymentSubmitting(false);
            }
            return;
        }

        if (senderOnlineProvider === 'syriatel' && senderOnlineStep === 'otp') {
            if (!senderOtpCode || senderOtpCode.length < 4) {
                setSenderPaymentError(t('onlinePaymentOtpInvalid'));
                return;
            }

            try {
                setSenderPaymentSubmitting(true);
                const { ok, result } = await confirmSyriatelPayment({
                    shipment_id: senderPaymentData?.shipment_id ?? shipmentId,
                    invoice: senderPaymentData?.invoice,
                    otp: senderOtpCode,
                });

                if (!ok) {
                    const errorMessage = result.message || t('onlinePaymentConfirmError');
                    setSenderPaymentError(errorMessage);
                    return;
                }

                showSenderPaymentStatus({
                    type: 'success',
                    message: result?.message,
                    fallbackMessage: t('onlinePaymentSuccessMessage') || 'Payment completed successfully. Continuing...',
                    onContinue: () => {
                        finalizeSenderPayment();
                    },
                    delayMs: 1700,
                });
            } catch (error) {
                console.error(error);
                const errorMessage = t('onlinePaymentConfirmError');
                setSenderPaymentError(errorMessage);
            } finally {
                setSenderPaymentSubmitting(false);
            }
            return;
        }

        if (senderOnlineProvider === 'card') {
            try {
                setSenderPaymentSubmitting(true);
                const { ok, result } = await initiatePaymeraPayment(baseOnlinePayload);
                if (!ok || !result.payment_url) {
                    const errorMessage = result.message || t('onlinePaymentCardError');
                    setSenderPaymentError(errorMessage);
                    showSenderPaymentStatus({
                        type: 'error',
                        message: errorMessage,
                        fallbackMessage: t('onlinePaymentCardError'),
                    });
                    return;
                }

                const paymentUrl = result.payment_url;
                showSenderPaymentStatus({
                    type: 'success',
                    message: result?.message,
                    fallbackMessage: t('onlinePaymentCardRedirectMessage') || 'Payment session created. Redirecting to secure card payment...',
                    onContinue: () => {
                        window.location.href = paymentUrl;
                    },
                    delayMs: 1700,
                });
            } catch (error) {
                console.error(error);
                const errorMessage = t('onlinePaymentCardError');
                setSenderPaymentError(errorMessage);
                showSenderPaymentStatus({
                    type: 'error',
                    message: errorMessage,
                    fallbackMessage: t('onlinePaymentCardError'),
                });
            } finally {
                setSenderPaymentSubmitting(false);
            }
            return;
        }

        const errorMessage = 'Please choose a valid payment provider.';
        setSenderPaymentError(errorMessage);
        showSenderPaymentStatus({
            type: 'error',
            message: errorMessage,
            fallbackMessage: errorMessage,
        });
    };

    const reviewEmployees = useMemo(
        () => (Array.isArray(selected?.employees) ? selected.employees : []),
        [selected]
    );

    const reviewRatingSummary = useMemo(() => {
        const directAvg = ((reviewForm.rider_behavior || 0) + (reviewForm.on_time_delivery || 0) + (reviewForm.affordability || 0)) / 3 || 0;
        const indirectRatings = Object.values(employeeRatings ?? {}).filter(
            (value) => typeof value === 'number' && value > 0
        );
        const indirectAvg = indirectRatings.length
            ? indirectRatings.reduce((acc, value) => acc + value, 0) / indirectRatings.length
            : 0;
        return {
            directAvg,
            indirectAvg,
            overallAverage: isSelectedDirectDelivery ? directAvg : indirectAvg,
        };
    }, [
        reviewForm.rider_behavior,
        reviewForm.on_time_delivery,
        reviewForm.affordability,
        employeeRatings,
        isSelectedDirectDelivery,
    ]);

    const buildEmployeeRatings = (list = []) => {
        const ratings = {};
        list.forEach((employee, index) => {
            const key = getEmployeeIdentifier(employee, index);
            const storedRating = employee?.rating;
            ratings[key] =
                storedRating === null || storedRating === undefined
                    ? null
                    : Number(storedRating);
        });
        return ratings;
    };
    const directRatingsComplete =
        reviewForm.rider_behavior >= 1 &&
        reviewForm.on_time_delivery >= 1 &&
        reviewForm.affordability >= 1;
    const reviewSubmitDisabled = reviewSubmitting || (isSelectedDirectDelivery && !directRatingsComplete);

    const handleSubmitReview = async () => {
        try {
            setReviewSubmitting(true);
            const shipmentId = selected?.id
                ? selected.id
                : String(selected?.ship_id || '').replace(/[^0-9]/g, '') || '';

            let employeeId = Number(
                selected?.employee_id
                ?? selected?.rider_id
                ?? selected?.rider?.id
                ?? selected?.review?.employee_id
                ?? 0
            ) || null;

            if (!employeeId && shipmentId) {
                const actorsResp = await fetch(`/customer/shipments/${shipmentId}/rateable-actors`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                });

                if (actorsResp.ok) {
                    let actorsData = null;
                    try { actorsData = await actorsResp.json(); } catch (e) { /* ignore parse errors */ }

                    const actors = Array.isArray(actorsData?.actors?.data)
                        ? actorsData.actors.data
                        : (Array.isArray(actorsData?.actors) ? actorsData.actors : []);

                    const firstActor = actors.find((actor) => Number(actor?.id ?? actor?.user_id ?? 0) > 0) || null;
                    employeeId = Number(firstActor?.id ?? firstActor?.user_id ?? 0) || null;
                }
            }

            if (!employeeId) {
                setReviewErrorMessage('No assigned employee found for this shipment review.');
                setShowReviewErrorPopup(true);
                return;
            }

            const normalizedComment = reviewForm.comment?.trim() || null;
            const { overallAverage } = reviewRatingSummary;
            const employeesPayload = reviewEmployees.flatMap((employee, index) => {
                const key = getEmployeeIdentifier(employee, index);
                if (isSelectedDirectDelivery) {
                    return [{
                        ...employee,
                        rider_behavior: reviewForm.rider_behavior,
                        on_time_delivery: reviewForm.on_time_delivery,
                        affordability: reviewForm.affordability,
                        rating: Number.isFinite(overallAverage) ? Number(overallAverage) : null,
                        comment: normalizedComment,
                    }];
                }

                const ratingValue = employeeRatings[key];
                const parsedRating = Number(ratingValue);
                if (!Number.isFinite(parsedRating) || parsedRating <= 0) {
                    return [];
                }
                return [{
                    ...employee,
                    rating: parsedRating,
                    comment: normalizedComment,
                }];
            });

            const resp = await fetch(`/customer/shipments/${shipmentId}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...getCsrfHeaders(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    ratings: employeesPayload,
                }),
            });
            let data = null;
            try { data = await resp.json(); } catch (e) { /* ignore parse errors */ }

            if (resp.ok && data?.ok) {
                setSelected({ ...selected, review: data.review });
                setReviewOpen(false);
                setShowReviewPopup(true);
            } else {
                const msg = (data?.message)
                    || (resp.status === 403 ? 'You are not authorized to submit a review for this shipment.'
                        : resp.status === 419 ? 'Your session has expired. Please refresh and try again.'
                            : 'Failed to submit review');
                setReviewErrorMessage(msg);
                setShowReviewErrorPopup(true);
            }
        } catch (e) {
            console.error(e);
            setReviewErrorMessage('Failed to submit review. Please try again.');
            setShowReviewErrorPopup(true);
        } finally {
            setReviewSubmitting(false);
        }
    };

    const submitCancellation = async () => {
        if (!selected) return;
        try {
            setCancelSubmitting(true);
            const shipmentId = selected.id || String(selected.ship_id || '').replace(/[^0-9]/g, '') || '';
            const reason = cancelReason.trim() || "Cancelled by customer";

            const resp = await fetch(`/customer/shipments/${shipmentId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...getCsrfHeaders(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ reason }),
            });

            let data = null;
            try { data = await resp.json(); } catch (e) { /* ignore parse errors */ }

            if (resp.ok && data?.ok) {
                // Update local status to cancelled
                setSelected({ ...selected, status: 'cancelled' });
                setCancelOpen(false);
                setShowCancelSuccessPopup(true);
            } else {
                setCancelErrorMessage(data?.message || 'Failed to cancel shipment');
                setShowCancelErrorPopup(true);
            }
        } catch (e) {
            console.error(e);
            setCancelErrorMessage('Failed to cancel shipment. Please try again.');
            setShowCancelErrorPopup(true);
        } finally {
            setCancelSubmitting(false);
        }
    };

    useEffect(() => {
        if (isPublicView) {
            setInvoiceView(false);
        }
    }, [isPublicView]);

    const filtered = useMemo(() => {
        if (isServerPaginated) {
            return records;
        }

        const term = search.trim().toLowerCase();
        if (!term && (!statusFilter || statusFilter === 'all')) return records;

        const match = (r) => {
            if (statusFilter && statusFilter !== 'all' && statusKeyFromString(r.status) !== statusFilter) return false;
            if (!term) return true;
            const id = (r.shipId || '').toString().replace('#', '').toLowerCase();
            const fields = [
                id,
                r.shipId?.toLowerCase?.() ?? '',
                r.note?.toLowerCase?.() ?? '',
                r.date?.toLowerCase?.() ?? '',
                r.parcelType?.toLowerCase?.() ?? '',
                r.shipmentType?.toLowerCase?.() ?? '',
                r.parcelSize?.toLowerCase?.() ?? '',
                r.status?.toLowerCase?.() ?? '',
            ];
            return fields.some((f) => f.includes(term));
        };

        return records.filter(match);
    }, [isServerPaginated, records, search, statusFilter]);

    // Derive pagination meta from server when available
    const serverCurrentPage = shipments?.current_page ?? shipments?.meta?.current_page ?? 1;
    const serverLastPage = shipments?.last_page ?? shipments?.meta?.last_page ?? (
        shipments?.total && shipments?.per_page ? Math.ceil(shipments.total / shipments.per_page) : undefined
    );
    const isIncompleted = selected?.status === "Incomplete" || selected?.status === "Cancelled" || false;
    const incompleteReason = selected?.incomplete_reason;

    const totalPages = useMemo(() => {
        if (isServerPaginated) {
            return Math.max(1, serverLastPage ?? 1);
        }
        return Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    }, [isServerPaginated, serverLastPage, filtered.length]);

    const pageData = useMemo(() => {
        if (isServerPaginated) {
            // Server already paginated; don't slice again
            return filtered;
        }
        const start = (currentPage - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, currentPage, isServerPaginated]);

    const effectiveCurrentPage = isServerPaginated ? serverCurrentPage : currentPage;
    const canGoToPreviousPage = effectiveCurrentPage > 1;
    const canGoToNextPage = effectiveCurrentPage < totalPages;

    const handlePageChange = (nextPage) => {
        const targetPage = Math.min(totalPages, Math.max(1, nextPage));
        if (targetPage === effectiveCurrentPage) {
            return;
        }

        if (isServerPaginated) {
            router.get(
                route('customer.shipments.sending_parcels'),
                {
                    search: (search || undefined),
                    status: (statusFilter && statusFilter !== 'all') ? statusFilter : undefined,
                    role: receiverMode ? 'receiver' : undefined,
                    page: targetPage,
                    per_page: filters?.per_page ?? undefined,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
            return;
        }

        setCurrentPage(targetPage);
    };

    const applyTableFilters = (overrides = {}) => {
        const nextSearch = overrides.search !== undefined ? overrides.search : search;
        const nextStatus = overrides.status !== undefined ? overrides.status : statusFilter;

        if (isServerPaginated) {
            router.get(
                route('customer.shipments.sending_parcels'),
                {
                    search: nextSearch || undefined,
                    status: (nextStatus && nextStatus !== 'all') ? nextStatus : undefined,
                    role: receiverMode ? 'receiver' : undefined,
                    page: 1,
                    per_page: filters?.per_page ?? undefined,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
            return;
        }

        setCurrentPage(1);
    };

    const shipmentStatusFilterOptions = [
        { value: 'all', label: t('commonAll') },
        { value: 'in_progress', label: t('statusInProgress') },
        { value: 'pending', label: t('statusPending') },
        { value: 'completed', label: t('statusCompleted') },
        { value: 'cancelled', label: t('statusCancelled') },
    ];

    const columns = [
        { key: 'shipId', label: t('commonShipId'), headerClassName: 'py-3 px-4 text-gray-700 font-semibold' },
        {
            key: 'receiverName',
            label: t('commonReceiverName'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (value) => (
                <span title={value} className="inline-block max-w-[300px] truncate align-middle text-gray-700">
                    {value || '-'}
                </span>
            ),
        },
        {
            key: 'receiverAddress',
            label: t('shipmentsTableHeaderReceiverAddress'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (value) => (
                <span title={value} className="inline-block max-w-[300px] truncate align-middle text-gray-700">
                    {value || '-'}
                </span>
            ),
        },
        { key: 'date', label: t('commonDate'), headerClassName: 'py-3 px-4 text-gray-700 font-semibold' },
        // { key: 'parcelType', label: t('shipmentsTableHeaderParcelType'), headerClassName: 'py-3 px-4 text-gray-700 font-semibold' },
        { key: 'shipmentType', label: t('commonShipmentType'), headerClassName: 'py-3 px-4 text-gray-700 font-semibold' },
        { key: 'status', label: t('commonStatus'), type: 'status', statusColorKey: 'statusColor', headerClassName: 'py-3 px-4 text-gray-700 font-semibold' },
        {
            key: 'returnStatus',
            label: t('commonReturnStatus'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (_value, row) => (
                <span >
                    {((row.status == "Delivered" || row.status == "Completed") && !row.returnStatus) ? "No Return" : row.returnStatus || "--" }
                </span>
            ),
        },
        {
            key: 'action',
            label: t('commonActions'),
            type: 'action',
            headerClassName: 'py-3 px-6 text-right text-gray-700 font-semibold',
            className: 'px-4 py-3 text-right',
            hrefKey: 'href',
            render: (value, row) => (
                <span className="text-blue-500 hover:text-blue-700 font-medium">
                    {t('commonViewDetails')}
                </span>
            ),
            onActionClick: (e, row) => {
                e.preventDefault();
                router.visit(row.href);
            }
        },
      ];

    const getStatusClasses = (color) => {
        const map = {
            yellow: 'border-yellow-400 text-[#FAAD14] bg-yellow-50',
            blue: 'border-blue-400 text-[#2196F3] bg-blue-50',
            green: 'border-green-300 text-[#4CAF50] bg-green-50',
            red: 'border-red-400 text-[#F44336] bg-red-50',
            gray: 'border-gray-400 text-[#9E9E9E] bg-gray-50',
        };
        return map[color] || map.yellow;
    };

    return (

        <div className="min-h-screen bg-[#f8f9fb] text-[#1f2937] flex flex-col md:flex-row overflow-x-hidden">
            <style>{`
                table.details-table tr td { padding:12px 16px; }
                table.details-table tr:not(:last-child) td { border-bottom:1px solid #edf1fb; }
                @media print { .no-print { display: none !important; } }
            `}</style>
            <Head title={open && selected ? t('commonTrackOrder') : t('commonShipmentHistory')} />

            <div style={{ display: hideLayout ? 'none' : undefined }}>
                <CustomerSidebar showBottomTabs={!open || !selected ? true : false} />
            </div>

            <main className={`${hideLayout ? 'ml-0' : 'md:ml-[72px]'} flex-1 px-4 md:px-10 pt-6 pb-3 md:overflow-y-auto`}>

                {/* Mobile fixed header */}
                <MobileHeader title={open && selected ? t('commonShipmentDetails') : t('shipmentsPageTitleSendingParcels')}/>

                {/* Spacer for mobile header */}
                <div className={`${!hideLayout ? 'h-8 md:hidden' : 'hidden'}`}></div>

                <div className="-mt-6 md:-mt-6 -mx-4 md:-mx-10" style={{ display: hideLayout ? 'none' : undefined }}>
                    <CustomerHeader
                        title={open && selected ? t('shipmentsRegularBooking') : (receiverMode ? (t('sidebarBookings') || 'Received Shipments') : t('commonShipmentHistory'))}
                        breadcrumbs={
                            open && selected
                                ? [{ label: t('commonHome'), href: '/customer/dashboard' }, { label: t('commonTrackOrder') }]
                                : [{ label: t('commonHome'), href: '/customer/dashboard' }, { label: t('commonShipmentHistory') }]
                        }
                    />
                </div>

                <div className={`pt-6 pb-3 ml-0 ${hideLayout ? 'hidden' : ''}`}>

                </div>
                {!open && (
                    <>
                        <DataTable
                            title={t('shipmentsAllSendingParcels')}
                            columns={columns}
                            rows={pageData}
                            getStatusClasses={getStatusClasses}
                            showSearch
                            searchValue={search}
                            searchPlaceholder={t('shipmentsSearchPlaceholder')}
                            onSearchChange={(value) => {
                                setSearch(value);
                                if (!isServerPaginated) setCurrentPage(1);
                            }}
                            onSearchSubmit={() => applyTableFilters()}
                            onSearchClear={() => applyTableFilters({ search: '' })}
                            showFilters
                            filters={[
                                {
                                    key: 'status',
                                    label: t('commonSortColon'),
                                    value: statusFilter,
                                    options: shipmentStatusFilterOptions,
                                    onChange: (value) => {
                                        setStatusFilter(value);
                                        applyTableFilters({ status: value });
                                    },
                                },
                            ]}
                            showPagination
                            currentPage={effectiveCurrentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            containerClassName="hidden md:block bg-white card p-6 border border-gray-200 rounded-2xl shadow-sm transition-all duration-200 ease-out"
                            wrapperClassName="bg-white border-t border-gray-200 rounded-2xl overflow-hidden"
                            theadClassName="bg-gray-50 text-gray-500 border-t border-b border-gray-200"
                            tbodyClassName="divide-y"
                            rowClassName="border-gray-200 odd:bg-white even:bg-gray-50"
                            emptyMessage={t('shipmentsEmptyMessage')}
                            paginationProps={{ className: 'rounded-b-2xl' }}
                            footer={
                                <div className="mt-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
                                    <p className="text-xs text-blue-700 leading-relaxed">
                                        <span className="font-bold mr-1">{t('commonNote')}:</span>
                                        {t('disputeDisclaimer')}
                                    </p>
                                </div>
                            }
                        />
                        {pageData.length > 0 ? (
                            <>
                                {pageData.map((r, idx) => {
                                    const amount = r?.raw?.payment?.collectable_total ?? r?.raw?.total_fee ?? r?.raw?.parcel_amount ?? r?.raw?.amount;
                                    const fromAddress = r?.raw?.handover_address || '-';
                                    const toAddress = r?.raw?.delivery_address || '-';
                                    const typeLabel = r?.shipmentType || t('deliverySpeedDirect');
                                    const parcelType = r?.parcelType || t('shipmentsParcelTypeRegular');
                                    const statusText = r?.status || statusLabel(r?.raw?.status, t);
                                    const key = r?.id || r?.shipId || idx;
                                    return (
                                        <div
                                            key={key}
                                            className="bg-white border sm:hidden border-[#E6EAF3] rounded-2xl p-4 w-[90vw] shadow-sm mb-3"
                                            onClick={() => { router.visit(r.href); }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.visit(r.href); } }}
                                        >
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-xs text-gray-400">{t('commonShipId')}</p>
                                                    <p className="text-sm font-semibold text-gray-800">{r.shipId}</p>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-800">{amount != null && amount !== '' ? `${amount} SYP` : '-'}</p>
                                            </div>

                                            {/* Timeline Section */}
                                            <div className="flex gap-4 mb-4">
                                                {/* Timeline line and dots */}
                                                <div className="flex flex-col items-center mt-1">
                                                    {/* Top (filled dot) */}
                                                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                                    {/* Line */}
                                                    <span className="flex-1 w-[2px] bg-blue-500 my-1"></span>
                                                    {/* Bottom (outlined dot) */}
                                                    <span className="w-3 h-3 rounded-full border-2 border-blue-500 bg-white"></span>
                                                </div>

                                                {/* Locations */}
                                                <div className="flex flex-col justify-between">
                                                    <div>
                                                        <p className="text-sm text-gray-800">
                                                            {fromAddress}
                                                        </p>
                                                    </div>
                                                    <hr className="border-gray-200 my-3" />
                                                    <div>
                                                        <p className="text-sm text-gray-800">
                                                            {toAddress}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer Buttons */}
                                            <div className="flex flex-wrap justify-between items-center gap-y-3 pt-3 border-t border-gray-100">
                                                <div className="flex gap-2">
                                                    <button className="px-2 py-1 border border-gray-200 text-[10px] text-gray-500 rounded-lg">
                                                        {typeLabel}
                                                    </button>
                                                    <button className="px-2 py-1 border border-gray-200 text-[10px] text-gray-500 rounded-lg">
                                                        {parcelType}
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {r.rdfPaymentLink && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.visit(r.rdfPaymentLink);
                                                            }}
                                                            className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full shadow-sm"
                                                        >
                                                            Pay Return Fee
                                                        </button>
                                                    )}
                                                    <button className="px-2 py-1 border border-blue-400 text-[10px] text-blue-500 rounded-full bg-blue-50/50">
                                                        {statusText}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {totalPages > 1 && (
                                    <div className="sm:hidden mb-4 px-1">
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E6EAF3] bg-white px-3 py-2 shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => handlePageChange(effectiveCurrentPage - 1)}
                                                disabled={!canGoToPreviousPage}
                                                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${canGoToPreviousPage
                                                    ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                                    : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                {t('commonPrevious')}
                                            </button>
                                            <p className="text-xs font-medium text-gray-500">
                                                {effectiveCurrentPage} / {totalPages}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handlePageChange(effectiveCurrentPage + 1)}
                                                disabled={!canGoToNextPage}
                                                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${canGoToNextPage
                                                    ? 'border border-blue-500 text-blue-600 hover:bg-blue-50'
                                                    : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                {t('commonNext')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="sm:hidden flex min-h-[50vh] items-center justify-center px-6">
                                <p className="text-center text-sm font-medium text-gray-500">
                                    {t('shipmentsEmptyMessage') || 'No shipments'}
                                </p>
                            </div>
                        )}
                        <div className="pb-20"></div>
                    </>

                )}

                {open && selected && !isPublicView && (
                    <div className="rounded-2xl flex justify-between">
                        <div className="flex items-center gap-2 whitespace-nowrap ml-4">
                            <p className="text-sm font-semibold text-blue-500">
                                {t('shipmentsNumberLabel')}
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                                {selectedShipmentNumber}
                            </p>
                        </div>
                        {returnedShipment && <div className="flex items-center gap-2 whitespace-nowrap ml-4">
                            <p className="text-xl font-semibold text-red-500">
                                {"Returned"}
                            </p>
                        </div>}

                    </div>
                )}

                {open && selected && (
                    <div className="fade-slide-in">
                        <style>{`@keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .fade-slide-in{animation:fadeSlide .25s ease-out both}`}</style>
                        <div className="min-h-full w-full bg-transparent">
                            <div className="w-full mx-auto sm:bg-white sm:rounded-2xl sm:border border-gray-200">
                                <ShipmentInvoiceView
                                    open={invoiceView}
                                    t={t}
                                    shipment={selected}
                                    shipmentNumber={selectedShipmentNumber}
                                    sendingDateLabel={sendingDateLabel}
                                    senderName={senderName}
                                    senderPhone={senderPhone}
                                    senderAddress={senderAddress}
                                    receiverName={receiverName}
                                    receiverPhone={receiverPhone}
                                    receiverAddress={receiverAddress}
                                    consignmentLabel={selectedConsignmentLabel}
                                    deliveryTypeLabel={!isSelectedDirectDelivery && selectedIndirectModeLabel
                                        ? selectedIndirectModeLabel
                                        : selectedDeliverySpeedLabel || "-"}
                                    insuranceLabel={selectedInsuranceLabel}
                                    paymentStatusLabel={selectedPaymentStatus
                                        ? translateEnumeratedValue(selectedPaymentStatus, t, selectedPaymentStatus)
                                        : t("shipmentsPaidByReceiver")}
                                    paymentSummary={selectedPaymentSummary}
                                    formatAmount={formatSYP}
                                    directDelivery={isSelectedDirectDelivery}
                                    isPublicView={isPublicView}
                                    onBack={() => setInvoiceView(false)}
                                    onPrint={() => window.print()}
                                    showMobileShipmentNumber
                                />
                                <div className={`py-6 sm:p-6 ${invoiceView ? "hidden" : "grid grid-cols-1 lg:grid-cols-12 gap-6"}`}>
                                    {/* Left column */}
                                    <div className="lg:col-span-5 space-y-6">
                                        <div className="bg-white border border-[#E6EAF3] rounded-2xl p-4">
                                            <p className="text-sm font-semibold text-gray-800 mb-3">{t('deliverySpeedPrompt')}</p>
                                            <div className={`rounded-xl px-4 py-3 border ${isSelectedDirectDelivery ? 'border-[#338DFF] bg-[#f0f6ff]' : 'border-[#338DFF] bg-[#f0f6ff]'}`}>
                                                <p className="inline-flex items-center gap-2 text-blue-500 font-semibold">
                                                    <span className="w-4 h-4 rounded-full border border-[#338DFF] inline-flex items-center justify-center"><span className="w-2 h-2 bg-[#338DFF] rounded-full" /></span>
                                                    {selectedDeliverySpeedLabel}
                                                </p>
                                                {!isSelectedDirectDelivery && (
                                                    <p className="text-xs text-blue-500 mt-1">
                                                        {selectedIndirectModeLabel || t('shipmentsDoorPickupPoint')} <svg className="w-3 h-3 inline ml-1" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white border border-[#E6EAF3] rounded-2xl p-4 space-y-4">
                                            <div>
                                                <p className="text-sm font-semibold text-blue-500">{t('commonHandOverLocation')}</p>
                                                <div className="mt-2 flex items-center justify-between md:border border-[#E6EAF3] md:rounded-full md:px-4 py-2 bg-white border-b">
                                                    <p className="text-sm text-gray-800 pr-3 whitespace-normal break-words leading-snug">{selected?.handover_address || '-'}</p>
                                                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                                        <img src="/assets/images/map-icon.png" alt="map-icon" />
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-blue-500">{t('commonDropOffLocation')}</p>
                                                <div className="mt-2 flex items-center justify-between md:border border-[#E6EAF3] md:rounded-full md:px-4 py-2 bg-white">
                                                    <p className="text-sm text-gray-800 pr-3 whitespace-normal break-words leading-snug">{selected?.delivery_address || '-'}</p>
                                                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                                                        <img src="/assets/images/map-icon.png" alt="map-icon" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {isIncompleted && <div className={`rounded-xl px-4 py-3 border text-red-300 bg-[#ffe8e8]`}>
                                            <h2 className="inline-flex items-center gap-2 text-red-500 font-semibold">
                                                <span className="w-4 h-4 rounded-full border text-red-300 inline-flex items-center justify-center"><span className="w-2 h-2 bg-[#ff3333] rounded-full" /></span>
                                                {selected?.status}
                                            </h2>
                                            {incompleteReason && <p className="ml-6 items-center text-sm gap-2 text-red-500">Reason: {incompleteReason}</p>}
                                        </div>}

                                         {/* Order Tracking */}
                                        <ShipmentSectionCard title={t('commonOrderTracking')}>
                                            <ShipmentTimeline {...buildShipmentTimeline({ shipment: selected, isDirect: isSelectedDirectDelivery, includeSecondWarehouse: selected?.is_diff_city, t })} />
                                        </ShipmentSectionCard>

                                         {/* Return Tracking */}
                                        {returnedShipment && <ShipmentSectionCard title={'Return Tracking' || t('shipmentsReturnTracking')}>
                                            <ShipmentTimeline {...buildShipmentTimeline({ shipment: returnedShipment, isDirect: isSelectedDirectDelivery, includeSecondWarehouse: selected?.is_diff_city, compactIndirect: true, t })} />
                                        </ShipmentSectionCard>}
                                    </div>

                                    {/* Right column */}
                                    <div className="lg:col-span-7 space-y-6 lg:border-l lg:border-gray-200 lg:pl-6">
                                        <div className="sm:bg-white relative pb-24">
                                            <div className={`${invoiceView ? 'hidden md:flex md:justify-center md:items-center' : 'hidden'}`}>
                                                <img src="/assets/images/Logo.svg" alt="Logo" />
                                            </div>
                                            <div className="px-2 sm:px-6 py-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                                                <h2 className="text-xl font-bold text-gray-800">{t('commonShipmentDetails')}</h2>
                                                <div className="flex items-center gap-3">

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!selected) return;
                                                            resetShareFeedback();
                                                            setShowShareModal(true);
                                                        }}
                                                        aria-label="Share tracking link"
                                                        className="cursor-pointer gap-2 text-blue-500 text-sm font-semibold min-w-fit"
                                                    >
                                                        <span className="inline-flex items-center justify-center">
                                                            <img src="/assets/images/share.svg" alt="icon" />
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowQr(true)}
                                                        className="inline-flex items-center cursor-pointer gap-2 text-blue-500 text-sm font-semibold hover:underline min-w-fit"
                                                    >
                                                        <span className="inline-flex items-center justify-center">
                                                            <img src="/assets/images/eye_icon.png" alt="icon" />
                                                        </span>
                                                        {t('shipmentsPrintQr')}
                                                    </button>
                                                    {(() => {
                                                        let latestStatus = getLatestStatusFromHistory(selected);

                                                        // Check if this shipment requires a rider and if one is not assigned
                                                        const speed = resolveDeliverySpeed(selected, 'direct');
                                                        const isDirect = isDirectDeliverySpeed(speed);
                                                        const indirectMode = selected?.indirect_delivery_mode ?? selected?.indirectDeliveryMode ?? '';
                                                        const requiresRider = isDirect || ['door_to_door', 'door_to_drop_point'].includes(indirectMode);
                                                        const hasRider = selected?.rider_id || selected?.rider?.id;

                                                        // Override status to "Not Assigned" if rider is required but not assigned and status is pending
                                                        if (requiresRider && !hasRider && (latestStatus.toLowerCase() === 'pending' || latestStatus.toLowerCase() === 'created')) {
                                                            latestStatus = 'Not Assigned';
                                                        }

                                                        const color = statusColor(latestStatus);
                                                        return (
                                                            <StatusBadge
                                                                color={color}
                                                                label={statusLabel(latestStatus, t) || t('statusCompleted')}
                                                            />
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <hr className="border-t border-[#e5ecfb]" />
                                            <div className="px-2 py-6 sm:p-6">
                                                <PaymentSummaryPanel
                                                    summary={selectedPaymentSummary}
                                                    t={t}
                                                    formatAmount={formatSYP}
                                                    directDelivery={isSelectedDirectDelivery}
                                                    includeSubtotal
                                                    layout="table"
                                                    title={t('commonPaymentDetails')}
                                                />
                                            </div>
                                            <div className="border-t border-[#e5ecfb] px-2 py-6 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                <div className="lg:col-span-3 flex justify-center items-center">
                                                    <QRCode
                                                        size={120}
                                                        data={qrPayload}
                                                    />
                                                </div>
                                                <ShipmentParcelDetailsGrid
                                                    t={t}
                                                    shipment={selected}
                                                    consignmentLabel={selectedConsignmentLabel}
                                                    insuranceLabel={selectedInsuranceLabel}
                                                    paymentStatusLabel={selectedPaymentStatus
                                                        ? translateEnumeratedValue(selectedPaymentStatus, t, selectedPaymentStatus)
                                                        : t('shipmentsPaidByReceiver')}
                                                    includeAcceptReturns
                                                />
                                            </div>

                                            <div className="border-t border-[#e5ecfb] px-2 py-6 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                <div className="lg:col-span-7">
                                                    <p className="text-sm font-semibold text-gray-700 mb-3">{t('commonPhotos')}</p>
                                                    <ImagePreviewGallery
                                                        images={selected?.photos}
                                                        altPrefix="sending-photo"
                                                        galleryLabel={t('commonPhotos')}
                                                        emptyPlaceholderCount={4}
                                                    />
                                                    {Array.isArray(selected?.additional_docs) && selected.additional_docs.length > 0 && (
                                                        <div className="mt-6">
                                                            <p className="text-sm font-semibold text-gray-700 mb-3">{t('commonAdditionalDocuments')}</p>
                                                            <div className="flex gap-3 flex-wrap">
                                                                {selected.additional_docs.map((url, idx) => (
                                                                    <a
                                                                        key={idx}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-16 h-16 rounded-xl overflow-hidden border border-[#e5ecfb] flex items-center justify-center bg-blue-50 hover:bg-blue-100 transition-colors"
                                                                    >
                                                                        <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                        </svg>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="lg:col-span-5">
                                                    <p className="text-sm font-semibold text-gray-700 mb-3">{t('shipmentsAddressCode')}</p>
                                                    <div className="grid grid-cols-2 gap-6 text-sm text-gray-600">
                                                        <div>
                                                            <p className="text-blue-500 uppercase text-xs font-semibold">{t('shipmentsFrom')}</p>
                                                            <p className="font-semibold text-gray-800 mt-2">{selected?.handover_address ? (selected.handover_address.split(',')[0] || selected.handover_address) : '-'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-blue-500 uppercase text-xs font-semibold">{t('shipmentsTo')}</p>
                                                            <p className="font-semibold text-gray-800 mt-2">{selected?.delivery_address ? (selected.delivery_address.split(',')[0] || selected.delivery_address) : '-'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="lg:col-span-12">
                                                    {/* Special Instruction */}
                                                    {selected?.special_instruction && (
                                                        <>
                                                            <hr className="mt-4 border-t border-[#e5ecfb]" />
                                                            <div className="py-6">
                                                                <p className="text-sm font-semibold text-gray-800 mb-2">{t('commonSpecialInstruction')}</p>
                                                                <p className="text-sm text-gray-600">{selected.special_instruction}</p>
                                                                {/* <hr className="mt-4 border-t border-[#e5ecfb]" /> */}
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Sender Details */}
                                                    <ParticipantDetailCard
                                                        title={t('commonSenderDetails')}
                                                        name={selected?.sender_name}
                                                        phone={selected?.sender_phone}
                                                        email={selected?.sender_email}
                                                        landmark={selected?.sender_landmark}
                                                        building={selected?.sender_building}
                                                    />

                                                    {/* Receiver Details */}
                                                    <ParticipantDetailCard
                                                        title={t('commonReceiverDetails')}
                                                        name={selected?.receiver_name}
                                                        phone={selected?.receiver_phone}
                                                        email={selected?.receiver_email}
                                                        landmark={selected?.receiver_landmark}
                                                        building={selected?.receiver_building}
                                                    />

                                                    {/* Bottom Actions */}
                                                    <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 pt-6 no-print" >
                                                        {!isPublicView && selectedStatusKey === 'completed' && !selected?.review && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setReviewForm({
                                                                        rider_behavior: 0,
                                                                        on_time_delivery: 0,
                                                                        affordability: 0,
                                                                        comment: '',
                                                                    });
                                                                    setEmployeeRatings(buildEmployeeRatings(reviewEmployees));
                                                                    setReviewOpen(true);
                                                                }}
                                                                className="px-5 h-13 rounded-full border-2 border-[#338DFF] text-blue-500 font-semibold bg-white"
                                                            >
                                                                {t('shipmentsRateNow')}
                                                            </button>
                                                          )}
                                                        {!isPublicView && isCancellable && !invoiceView && (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setCancelReason(''); setCancelOpen(true); }}
                                                                className="text-sm sm:text-base px-5 h-13 rounded-full border-2 border-red-500 text-red-500 font-semibold bg-white hover:bg-red-50 transition-colors"
                                                            >
                                                                {t('shipmentsCancelShipment')}
                                                            </button>
                                                        )}
                                                        {invoiceView && !isPublicView && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setInvoiceView(false)}
                                                                className="text-sm sm:text-base px-5 h-13 rounded-full border-2 border-[#338DFF] text-blue-500 font-semibold bg-white"
                                                            >
                                                                {t('commonBack')}
                                                            </button>
                                                        )}
                                                        {!invoiceView && !isPublicView && (
                                                            <>
                                                                {showSenderPayNowButton() && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={openSenderPaymentModalForParcel}
                                                                        className="text-sm sm:text-base px-5 h-13 rounded-full border-2 border-[#0b64f3] bg-[#0b64f3] text-white font-semibold shadow hover:bg-white hover:text-[#0b64f3]"
                                                                    >
                                                                        {t('shipmentsPayNow')}
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {!invoiceView && !isPublicView && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setInvoiceView(true)}
                                                                className="px-5 h-13 rounded-full bg-[#338DFF] text-white font-semibold shadow hover:bg-white hover:text-blue-500 border-2 border-[#338DFF]"
                                                            >
                                                                {t('shipmentsViewInvoice')}
                                                            </button>
                                                        )}
                                                        {invoiceView && (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.print()}
                                                                className="px-5 h-13 rounded-full bg-[#338DFF] text-white font-semibold shadow hover:bg-white hover:text-blue-500 border-2 border-[#338DFF]"
                                                            >
                                                                {t('shipmentsSaveAsPdf')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ShareShipmentModal
                    open={open && selected && showShareModal}
                    options={SHARE_OPTIONS}
                    feedback={shareFeedback}
                    feedbackTone={shareFeedbackTone}
                    onClose={closeShareModal}
                    onShare={handleSocialShare}
                    t={t}
                />

                <ShipmentReviewModal
                    open={open && selected && reviewOpen}
                    shipment={selected}
                    t={t}
                    altPrefix="sending-review"
                    isDirectDelivery={isSelectedDirectDelivery}
                    employees={reviewEmployees}
                    reviewForm={reviewForm}
                    employeeRatings={employeeRatings}
                    overallAverage={reviewRatingSummary.overallAverage}
                    submitDisabled={reviewSubmitDisabled}
                    submitting={reviewSubmitting}
                    maxWidthClassName="max-w-3xl"
                    showDirectEmployeeLabel
                    getEmployeeKey={getEmployeeIdentifier}
                    onClose={() => setReviewOpen(false)}
                    onSubmit={handleSubmitReview}
                    onDirectRatingChange={(key, value) => setReviewForm((form) => ({ ...form, [key]: value }))}
                    onEmployeeRatingChange={(key, value) => {
                        setEmployeeRatings((previous) => ({
                            ...previous,
                            [key]: value,
                        }));
                    }}
                    onCommentChange={(comment) => setReviewForm((form) => ({ ...form, comment }))}
                />

                {/* Success Popup */}
                {showReviewPopup && (
                    <Popup
                        title={t('shipmentsReviewSuccessTitle')}
                        message={t('shipmentsReviewSuccessMessage')}
                        buttonLabel={t('commonClose')}
                        onConfirm={() => {setShowReviewPopup(false); window.location.reload();}}
                        loopAnimation={false}
                    />
                )}

                {showReviewErrorPopup && (
                    <Popup
                        title={t('shipmentsReviewErrorTitle')}
                        message={reviewErrorMessage}
                        buttonLabel={t('commonClose')}
                        onConfirm={() => setShowReviewErrorPopup(false)}
                        loopAnimation={false}
                        showIcon={false}
                    />
                )}

                {/* Return Request Success Popup */}
                {showReturnPopup && (
                    <Popup
                        title={t('shipmentsReturnSuccessTitle')}
                        message={t('shipmentsReturnSuccessMessage')}
                        buttonLabel={t('commonClose')}
                        onConfirm={() => setShowReturnPopup(false)}
                        loopAnimation={false}
                    />
                )}

                {/* Return Request Error Popup */}
                {showReturnErrorPopup && (
                    <Popup
                        title={t('shipmentsReturnErrorTitle')}
                        message={returnErrorMessage}
                        buttonLabel={t('commonClose')}
                        onConfirm={() => setShowReturnErrorPopup(false)}
                        loopAnimation={false}
                        showIcon={false}
                    />
                )}

                {senderPaymentStatus && (
                    <Popup
                        title={senderPaymentStatus.title}
                        message={senderPaymentStatus.description}
                        buttonLabel={senderPaymentStatus.type === 'success' ? (t('commonContinue') || 'Continue') : (t('commonClose') || 'Close')}
                        onConfirm={closeSenderPaymentStatusModal}
                        onClose={closeSenderPaymentStatusModal}
                        loopAnimation={false}
                        showIcon={senderPaymentStatus.type === 'success'}
                        closeOnOverlayClick
                    />
                )}

                {/* Cancellation Modal */}
                {open && selected && cancelOpen && (
                    <div className="fixed inset-0 z-[60]">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setCancelOpen(false)}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                    <h3 className="text-xl font-bold text-gray-800">{t('shipmentsCancelShipment')}</h3>
                                    <button onClick={() => setCancelOpen(false)} className="text-gray-400 hover:text-gray-600">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="p-6">
                                    <p className="text-sm text-gray-600 mb-4">
                                        {t('superAdminRatingsCancelConfirmMessage') || 'Are you sure you want to cancel this shipment?'}
                                    </p>
                                    <textarea
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        placeholder={t('shipmentsCancelReasonPlaceholder')}
                                        className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-red-500 min-h-[100px] resize-none"
                                    />
                                </div>

                                <div className="p-6 pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCancelOpen(false)}
                                        className="flex-1 py-3 rounded-full font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        {t('commonCancel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitCancellation}
                                        disabled={cancelSubmitting}
                                        className={`flex-1 py-3 rounded-full font-bold text-white transition-colors shadow-sm ${cancelSubmitting ? 'bg-red-300 cursor-not-allowed' : 'bg-[#FF3333] hover:bg-red-600'}`}
                                    >
                                        {cancelSubmitting ? t('shipmentsCancelSubmitting') : t('commonConfirm')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div >
                )
                }

                {/* Cancellation Success Popup */}
                {
                    showCancelSuccessPopup && (
                        <Popup
                            title={t('shipmentsCancelSuccessTitle')}
                            message={t('shipmentCancelledSuccessfully')}
                            buttonLabel={t('commonClose')}
                            onConfirm={() => setShowCancelSuccessPopup(false)}
                            loopAnimation={false}
                        />
                    )
                }

                {/* Cancellation Error Popup */}
                {
                    showCancelErrorPopup && (
                        <Popup
                            title={t('shipmentsCancelErrorTitle')}
                            message={cancelErrorMessage}
                            buttonLabel={t('commonClose')}
                            onConfirm={() => setShowCancelErrorPopup(false)}
                            loopAnimation={false}
                            showIcon={false}
                        />
                    )
                }

                <ShipmentQrDrawer
                    open={open && selected && showQr}
                    t={t}
                    onClose={() => setShowQr(false)}
                    shippingRouteLabel={shippingRouteLabel}
                    senderName={senderName}
                    senderAddress={senderAddress}
                    senderPhone={senderPhone}
                    senderAvatarUrl={userProfile?.avatar_url}
                    receiverName={receiverName}
                    receiverAddress={receiverAddress}
                    receiverPhone={receiverPhone}
                    receiverCity={receiverCity}
                    qrPayload={qrPayload}
                    shipmentStatusLabel={shipmentStatusLabel}
                    paymentMethodLabel={paymentMethodLabel}
                    deliveryTypeLabel={!isSelectedDirectDelivery && selectedIndirectModeLabel
                        ? selectedIndirectModeLabel
                        : selectedDeliverySpeedLabel || '-'}
                    sendingDateLabel={sendingDateLabel}
                    shipmentNumber={selectedShipmentNumber}
                    addressCodeLabel={addressCodeLabel}
                />

                {senderPaymentModalOpen && selected && (
                    <PaymentModal
                        open={senderPaymentModalOpen}
                        paymentDetails={senderPaymentDetails}
                        onClose={closeSenderPaymentModal}
                        onPayNow={handleSenderPayNow}
                        submitting={senderPaymentSubmitting}
                        paymentMethod="online"
                        onlineProvider={senderOnlineProvider}
                        onOnlineProviderChange={(provider) => {
                            setSenderOnlineProvider(provider);
                            setSenderOnlineStep('phone');
                            setSenderPaymentError('');
                        }}
                        onlineStep={senderOnlineStep}
                        onlinePhone={senderOnlinePhone}
                        onOnlinePhoneChange={setSenderOnlinePhone}
                        otpCode={senderOtpCode}
                        onOtpCodeChange={setSenderOtpCode}
                        paymentError={senderPaymentError}
                        onResendOtp={senderOnlineProvider === 'syriatel' && senderOnlineStep === 'otp' ? handleResendSenderOtp : null}
                        t={t}
                        showOnlineGatewayForm
                    />
                )}

                {/* Return Parcel Modal */}
                {
                    open && selected && returnModalOpen && (
                        <div className="fixed inset-0 z-50">
                            <div className="absolute inset-0 bg-black/40" onClick={() => setReturnModalOpen(false)}></div>
                            <div className="absolute inset-0 flex items-center justify-center p-4">
                                <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                        <h3 className="text-xl font-bold text-gray-800">{t('shipmentsReturnParcel')}</h3>
                                        <button onClick={() => setReturnModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="p-6 overflow-y-auto">
                                        {/* Location Info Card */}
                                        <div className="bg-white border rounded-2xl p-4 mb-6 relative">
                                            {/* Connecting Line */}
                                            <div className="absolute left-[29px] top-[28px] bottom-[28px] w-0.5 bg-blue-100"></div>

                                            {/* Pickup (Receiver) */}
                                            <div className="flex gap-4 mb-4 relative">
                                                <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-white mt-1.5 shrink-0 z-10"></div>
                                                <div>
                                                    <p className="text-xs text-blue-500 font-semibold mb-0.5">{t('shipmentsPickupLocationReceiver')}</p>
                                                    <p className="text-sm text-gray-800">{selected.delivery_address || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Drop-off (Sender) */}
                                            <div className="flex gap-4 relative">
                                                <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5 shrink-0 z-10"></div>
                                                <div>
                                                    <p className="text-xs text-blue-500 font-semibold mb-0.5">{t('shipmentsDropOffLocationSender')}</p>
                                                    <p className="text-sm text-gray-800">{selected.handover_address || '-'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <ReturnParcelDetailsSummary
                                            title={t('commonParcelDetails') || 'Parcel Details'}
                                            className="mb-6"
                                            fields={[
                                                { key: 'parcel-id', label: t('commonParcelId'), value: selected.parcelType },
                                                { key: 'consignment', label: t('commonConsignmentType'), value: selected.consignment_type },
                                                { key: 'size', label: t('commonSize'), value: selected.parcelSize },
                                                { key: 'weight', label: t('commonWeight'), value: selected.weight ? `${selected.weight} kg` : '-' },
                                                { key: 'address-code', label: t('shipmentsAddressCode'), value: selected.address_code, className: 'col-span-2' },
                                            ]}
                                        />

                                        <hr className="border-gray-100 mb-6" />

                                        {/* Return Reason */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                                {t('commonReturnReason')}
                                            </label>
                                            <div className="relative mb-4">
                                                <select
                                                    value={returnReason}
                                                    onChange={(e) => setReturnReason(e.target.value)}
                                                    className="w-full appearance-none bg-white border border-gray-200 text-gray-800 py-3 px-4 pr-8 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="Other">{t('commonOther')}</option>
                                                    <option value="Damaged Item">{t('shipmentsReturnReasonDamagedItem')}</option>
                                                    <option value="Wrong Item">{t('shipmentsReturnReasonWrongItem')}</option>
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                                </div>
                                            </div>

                                            {/* Image Upload Section */}
                                            {(['Damaged Item', 'Wrong Item', 'Other'].includes(returnReason)) && (
                                                <div className="mb-4">
                                                    <label className="block text-sm font-bold mb-2">
                                                        {t('shipmentsAttachParcelConditionImages')}
                                                        {['Damaged Item', 'Wrong Item'].includes(returnReason) && <span className="text-red-500 ml-1">*</span>}
                                                        <span className="text-gray-400 font-normal ml-1 text-xs">{t('shipmentsMaxImagesHint')}</span>
                                                    </label>

                                                    <div className="grid grid-cols-5 gap-2 mb-2">
                                                        {returnImages.map((img, index) => (
                                                            <div key={index} className="relative aspect-square bg-gray-100 rounded border overflow-hidden">
                                                                <img
                                                                    src={URL.createObjectURL(img)}
                                                                    alt="Preview"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <button
                                                                    onClick={() => removeImage(index)}
                                                                    className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-1 hover:bg-red-600"
                                                                    title={t('commonRemove')}
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ))}

                                                        {returnImages.length < 5 && (
                                                            <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50 transition-colors">
                                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                                </svg>
                                                                <input
                                                                    type="file"
                                                                    multiple
                                                                    accept="image/jpeg,image/png,image/webp"
                                                                    onChange={handleImageChange}
                                                                    className="hidden"
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Special Instruction */}
                                        <div className="mb-6">
                                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                                {t('commonSpecialInstruction')}
                                            </label>
                                            <textarea
                                                value={returnInstruction}
                                                onChange={(e) => setReturnInstruction(e.target.value)}
                                                placeholder={t('shipmentsReturnSpecialInstructionPlaceholder')}
                                                className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
                                            />
                                        </div>

                                        {/* Acknowledgement */}
                                        <div className="flex items-start gap-3 mb-2">
                                            <div className="flex items-center h-5">
                                                <input
                                                    id="return-ack"
                                                    type="checkbox"
                                                    checked={returnAcknowledgement}
                                                    onChange={(e) => setReturnAcknowledgement(e.target.checked)}
                                                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                                />
                                            </div>
                                            <label htmlFor="return-ack" className="text-sm text-gray-600">
                                                {t('commonReturnAcknowledgement')}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Footer Buttons */}
                                    <div className="p-6 pt-2">
                                        <button
                                            type="button"
                                            onClick={submitReturnRequest}
                                            disabled={returnSubmitting || !returnAcknowledgement}
                                            className={`w-full py-3.5 rounded-full font-bold text-white transition-colors shadow-sm
                                            ${returnSubmitting || !returnAcknowledgement
                                                    ? 'bg-blue-300 cursor-not-allowed'
                                                    : 'bg-[#338DFF] hover:bg-blue-600'
                                                }`}
                                        >
                                            {returnSubmitting ? t('commonSubmitting') : t('shipmentsConfirmReturnPickup')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
}
