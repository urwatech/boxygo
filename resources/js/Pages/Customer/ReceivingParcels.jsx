import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';
import QRCode from '../../Components/Shared/QRCode';
import Popup from '../SuperAdmin/Components/Popup';
import Drawer from '../SuperAdmin/Components/Drawer';
import PaymentModal from '../../Components/Customer/PaymentModal';
import ImagePreviewGallery from '../../Components/Customer/ImagePreviewGallery';
import DataTable from '../../Components/Common/DataTable';
import {
    confirmMtnPayment,
    confirmSyriatelPayment,
    initiateMtnPayment,
    initiatePaymeraPayment,
    initiateSyriatelPayment,
    payShipmentNow,
    resendSyriatelOtp,
} from '../../utils/customerPaymentApi';
import NotificationDropdown from '../../Components/Customer/NotificationDropdown';
import MobileHeader from '../../Components/Customer/MobileHeader';
import {
    PAGE_SIZE,
    SHARE_OPTIONS,
    getCsrfHeaders,
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
const formatSYP = (value) => (Number.isFinite(Number(value)) ? `${Math.round(value)} SYP` : '--');

const ReceiverPaymentModal = PaymentModal;

export default function ReceivingParcels({ shipments = {}, filters = {}, selectedShipment = null, financialSettings = {}, cities = [], receiverMode = false }) {
    const { t } = useTranslation();
    const page = usePage();
    const userProfile = page?.props?.auth?.user ?? null;
    const isPublicView = Boolean(page?.props?.publicView);
    const incomingReceiverPaymentStatus = page?.props?.paymentStatus;
    const hasHandledReceiverPaymentStatusFromProps = useRef(false);

    // Detect server-side pagination (Laravel paginator)
    const isServerPaginated = useMemo(() => {
        return !!(shipments && typeof shipments === 'object' && Array.isArray(shipments.data));
    }, [shipments]);

    // Map current page's shipments to rows
    const records = useMemo(() => {
        const data = Array.isArray(shipments) ? shipments : (shipments?.data ?? []);
        return data.map((shipment) => mapShipmentToRow(shipment, t, { mode: 'receiving' }));
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
    const [returnReasonDetail, setReturnReasonDetail] = useState('');
    const [returnInstruction, setReturnInstruction] = useState('');
    const [returnAcknowledgement, setReturnAcknowledgement] = useState(false);
    const [returnImages, setReturnImages] = useState([]);
    const [returnPhotoErrors, setReturnPhotoErrors] = useState('');
    const [showReturnAuthModal, setShowReturnAuthModal] = useState(false);
    const photoInputRef = useRef(null);
    const [isReturned, setisReturned] = useState(selected?.is_return_created == '1' ? true : false);
    const [returnedShipment, setReturnedShipment] = useState(selected?.returned_shipment ?? null);
    const [receiverPaymentModalOpen, setReceiverPaymentModalOpen] = useState(false);
    const [modalPaymentDetails, setModalPaymentDetails] = useState(null);
    const [modalPaymentPurpose, setModalPaymentPurpose] = useState('receiver_delivery');
    const [modalPaymentOnSuccess, setModalPaymentOnSuccess] = useState(null);
    const [receiverPaymentMethod, setReceiverPaymentMethod] = useState('online');
    const [receiverOnlineProvider, setReceiverOnlineProvider] = useState('mtn');
    const [receiverOnlinePhone, setReceiverOnlinePhone] = useState('');
    const [receiverOnlineStep, setReceiverOnlineStep] = useState('phone');
    const [receiverOtpCode, setReceiverOtpCode] = useState('');
    const [receiverPaymentData, setReceiverPaymentData] = useState(null);
    const [receiverPaymentError, setReceiverPaymentError] = useState('');
    const [receiverPaymentSubmitting, setReceiverPaymentSubmitting] = useState(false);
    const [receiverPaymentStatus, setReceiverPaymentStatus] = useState(null);
    const receiverPaymentStatusTimeout = useRef(null);
    const receiverPaymentStatusContinuation = useRef(null);

    const uploadPhoto = async (file) => {
        // Prefer XSRF cookie to avoid stale <meta> tokens on first load
        const xsrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        const xsrf = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : null;

        const fd = new FormData();
        fd.append('photo', file);

        const resp = await fetch('/customer/uploads/photo', {
            method: 'POST',
            headers: {
                ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
                ...(!xsrf && document.querySelector('meta[name="csrf-token"]')
                    ? { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') }
                    : {}),
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: fd,
            credentials: 'same-origin',
        });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        return data.url;
    };

    const handlePhotoSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create immediate local preview to avoid delays or missed renders
        const localUrl = URL.createObjectURL(file);
        let insertIndex = -1;
        setReturnImages(prev => {
            const nextPhotos = [...prev, localUrl];
            insertIndex = nextPhotos.length - 1;
            return nextPhotos;
        });
        setReturnPhotoErrors('');
        try {
            const uploadedUrl = await uploadPhoto(file);
            setReturnImages(prev => {
                const nextPhotos = [...prev];
                if (insertIndex >= 0 && insertIndex < nextPhotos.length && nextPhotos[insertIndex] === localUrl) {
                    nextPhotos[insertIndex] = uploadedUrl;
                } else {
                    nextPhotos.push(uploadedUrl);
                }
                return nextPhotos;
            });
        } catch (err) {
            console.error(err);
            setReturnImages(prev =>
                prev.filter((p, i) => !(i === insertIndex && p === localUrl))
            );
            setReturnPhotoErrors('Photo upload failed. Please try again.');
        } finally {
            try { URL.revokeObjectURL(localUrl); } catch { }
        }
        e.target.value = '';
    };

    const handleRemovePhoto = (index) => {
        setReturnImages(prev => {
            const nextPhotos = prev?.filter((_, idx) => idx !== index) ?? [];
            const removed = prev?.[index];
            if (removed && removed.startsWith('blob:')) {
                try { URL.revokeObjectURL(removed); } catch { }
            }
            return nextPhotos;
        });
    };

    const resetReceiverPaymentFlowState = () => {
        setModalPaymentDetails(null);
        setModalPaymentPurpose('receiver_delivery');
        setModalPaymentOnSuccess(null);
        // setReceiverPaymentMethod('cash');
        setReceiverOnlineProvider('mtn');
        setReceiverOnlinePhone('');
        setReceiverOnlineStep('phone');
        setReceiverOtpCode('');
        setReceiverPaymentData(null);
        setReceiverPaymentError('');
        setReceiverPaymentSubmitting(false);
    };

    const closeReceiverPaymentModal = () => {
        setReceiverPaymentModalOpen(false);
        resetReceiverPaymentFlowState();
    };

    const clearReceiverPaymentStatusTimeout = () => {
        if (receiverPaymentStatusTimeout.current) {
            clearTimeout(receiverPaymentStatusTimeout.current);
            receiverPaymentStatusTimeout.current = null;
        }
    };

    const closeReceiverPaymentStatusModal = () => {
        clearReceiverPaymentStatusTimeout();
        setReceiverPaymentStatus(null);
        const continuation = receiverPaymentStatusContinuation.current;
        receiverPaymentStatusContinuation.current = null;
        if (typeof continuation === 'function') {
            continuation();
        }
    };

    const showReceiverPaymentStatus = ({
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
            ? (t('notificationPaymentSuccessTitle') || 'Payment Successful')
            : (isCancelled
                ? (t('commonPaymentCancelled') || 'Payment Cancelled')
                : (t('notificationPaymentFailedTitle') || 'Payment Failed')));

        if (!resolvedTitle && !description) {
            return;
        }

        clearReceiverPaymentStatusTimeout();
        receiverPaymentStatusContinuation.current = typeof onContinue === 'function' ? onContinue : null;
        setReceiverPaymentStatus({
            type: resolvedType,
            title: resolvedTitle,
            description,
        });

        if (delayMs > 0 && typeof onContinue === 'function') {
            receiverPaymentStatusTimeout.current = setTimeout(() => {
                closeReceiverPaymentStatusModal();
            }, delayMs);
        }
    };

    useEffect(() => {
        if (hasHandledReceiverPaymentStatusFromProps.current) {
            return;
        }

        if (!incomingReceiverPaymentStatus || typeof incomingReceiverPaymentStatus !== 'object') {
            return;
        }

        hasHandledReceiverPaymentStatusFromProps.current = true;
        showReceiverPaymentStatus({
            type: incomingReceiverPaymentStatus.type,
            title: incomingReceiverPaymentStatus.title,
            message: incomingReceiverPaymentStatus.description,
            fallbackMessage: incomingReceiverPaymentStatus.description,
        });
    }, [incomingReceiverPaymentStatus]);

    useEffect(() => {
        return () => {
            clearReceiverPaymentStatusTimeout();
            receiverPaymentStatusContinuation.current = null;
        };
    }, []);

    const resolveSelectedShipmentId = () => {
        const raw = selected?.id ?? selected?.ship_id ?? '';
        const id = Number(String(raw).replace(/[^0-9]/g, ''));
        return Number.isFinite(id) && id > 0 ? id : null;
    };

    const resolveReceiverPaymentAmount = () => {
        const modalTotal = Number(modalPaymentDetails?.total);
        if (Number.isFinite(modalTotal) && modalTotal > 0) {
            return modalTotal;
        }

        if (modalPaymentPurpose === 'return_delivery') {
            return Number(selected?.rdf_amount ?? 0);
        }

        const payment = selected?.payment ?? {};
        return Number(
            payment.total_due
            ?? payment.total_fee
            ?? selected?.reciever_amount
            ?? selected?.parcel_amount
            ?? 0
        );
    };

    const openReceiverPaymentModal = ({
        details,
        purpose = 'receiver_delivery',
        onSuccess = null,
        defaultMethod = 'online',
    }) => {
        setModalPaymentDetails(details);
        setModalPaymentPurpose(purpose);
        setModalPaymentOnSuccess(() => (typeof onSuccess === 'function' ? onSuccess : null));
        setReceiverPaymentMethod('online');
        setReceiverOnlineProvider('mtn');
        setReceiverOnlinePhone('');
        setReceiverOnlineStep('phone');
        setReceiverOtpCode('');
        setReceiverPaymentData(null);
        setReceiverPaymentError('');
        setReceiverPaymentSubmitting(false);
        setReceiverPaymentModalOpen(true);
    };

    const openReturnForm = () => {
        setReturnReason('Other');
        setReturnReasonDetail('');
        setReturnInstruction('');
        setReturnImages(prev => {
            prev.forEach(img => {
                if (img && img.startsWith('blob:')) {
                    try { URL.revokeObjectURL(img); } catch { }
                }
            });
            return [];
        });
        setReturnAcknowledgement(false);
        setReturnPhotoErrors('');
        setReturnModalOpen(true);
    };

    const applyLocalPaymentUpdate = (purpose) => {
        setSelected(prev => {
            if (!prev) {
                return prev;
            }

            if (purpose === 'return_delivery') {
                return {
                    ...prev,
                    rdf_payment_status: 'paid',
                    rdfPaymentStatus: 'paid',
                };
            }

            return {
                ...prev,
                payment_status: 'paid',
                payment: {
                    ...(prev.payment ?? {}),
                    status: 'paid',
                    requires_receiver_payment: false,
                },
            };
        });
    };

    const finalizeReceiverPayment = async () => {
        const purpose = modalPaymentPurpose;
        const onSuccess = modalPaymentOnSuccess;

        setReceiverPaymentModalOpen(false);
        applyLocalPaymentUpdate(purpose);
        resetReceiverPaymentFlowState();

        if (typeof onSuccess === 'function') {
            await onSuccess();
            return;
        }

        router.reload({ preserveState: true, preserveScroll: true });
    };

    const handleResendReceiverOtp = async () => {
        if (!receiverPaymentData?.invoice || !receiverPaymentData?.shipment_id) {
            return;
        }

        try {
            setReceiverPaymentSubmitting(true);
            const { ok, result } = await resendSyriatelOtp({
                shipment_id: receiverPaymentData.shipment_id,
                invoice: receiverPaymentData.invoice,
            });

            if (ok) {
                setReceiverPaymentError(t('onlinePaymentOtpResent'));
            } else {
                setReceiverPaymentError(result.message || t('onlinePaymentResendError'));
            }
        } catch (error) {
            console.error(error);
            setReceiverPaymentError(t('onlinePaymentResendError'));
        } finally {
            setReceiverPaymentSubmitting(false);
        }
    };

    // Check return window and open modal
    const handleReturnClick = () => {
        if (!selected) return;

        if (!userProfile) {
            setShowReturnAuthModal(true);
            return;
        }

        if (selected.return_window) {
            let deliveryDate = null;
            if (Array.isArray(selected.status_history)) {
                const entry = selected.status_history.slice().reverse().find(h =>
                    (h.status || '').toLowerCase().includes('delivered')
                );
                if (entry && entry.created_at) {
                    deliveryDate = new Date(entry.created_at);
                }
            }

            if (deliveryDate) {
                const deadline = new Date(deliveryDate);
                deadline.setDate(deadline.getDate() + selected.return_window);
                if (new Date() > deadline) {
                    alert(t('returnWindowHasExpired') || 'Return window has expired.');
                    return;
                }
            }
        }

        if (isPayemntRequiredForReturn()) {
            const rdfAmount = Number(selected?.rdf_amount ?? 0);
            openReceiverPaymentModal({
                details: {
                    title: 'Return Delivery Payment',
                    description: 'Complete the return delivery payment first to proceed.',
                    orderNumber: selected.order_number ?? selected.ship_id ?? selected.id ?? '',
                    lineItems: rdfAmount > 0 ? [{ label: 'Return Delivery Fee', amount: rdfAmount }] : [],
                    total: rdfAmount,
                    actionAmount: rdfAmount,
                },
                purpose: 'return_delivery',
                onSuccess: openReturnForm,
                defaultMethod: 'online',
            });
            return;
        }

        openReturnForm();
    };

    const handlePayNow = async () => {
        if (!selected || receiverPaymentSubmitting) {
            return;
        }

        const shipmentId = resolveSelectedShipmentId();
        if (!shipmentId) {
            setReceiverPaymentError('Unable to resolve shipment id for payment.');
            return;
        }

        setReceiverPaymentError('');

        if (receiverPaymentMethod === 'cash') {
            try {
                setReceiverPaymentSubmitting(true);
                const { ok, result } = await payShipmentNow({
                    shipment_id: shipmentId,
                    from: 'receiver',
                    payment_method: 'cash',
                    payment_for: modalPaymentPurpose,
                });

                if (!ok) {
                    setReceiverPaymentError(result.message || 'Unable to process cash payment.');
                    return;
                }

                await finalizeReceiverPayment();
            } catch (error) {
                console.error(error);
                setReceiverPaymentError('Unable to process cash payment.');
            } finally {
                setReceiverPaymentSubmitting(false);
            }
            return;
        }

        const paymentAmount = resolveReceiverPaymentAmount();
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            setReceiverPaymentError('Invalid payment amount.');
            return;
        }

        const baseOnlinePayload = {
            shipment_id: shipmentId,
            payment_method: 'online',
            payment_type: modalPaymentDetails?.title != 'Parcel Payment' ? 'return_shipment' : 'existing_shipment',
            payer_type: 'receiver',
            payment_amount: paymentAmount,
            payment_for: modalPaymentPurpose,
        };

        if (receiverOnlineProvider === 'mtn' && receiverOnlineStep === 'phone') {
            // if (!receiverOnlinePhone || !/^09\d{8}$/.test(receiverOnlinePhone)) {
            //     setReceiverPaymentError(t('onlinePaymentPhoneInvalid'));
            //     return;
            // }

            try {
                setReceiverPaymentSubmitting(true);
                const { ok, result } = await initiateMtnPayment({
                    ...baseOnlinePayload,
                    payment_phone: receiverOnlinePhone,
                });

                if (!ok) {
                    const errorMessage = result.message || t('commonPaymentInitiateError');
                    setReceiverPaymentError(errorMessage);
                    showReceiverPaymentStatus({
                        type: 'error',
                        message: errorMessage,
                        fallbackMessage: t('commonPaymentInitiateError'),
                    });
                    return;
                }

                setReceiverPaymentData(result.payment);
                setReceiverOnlineStep('otp');
            } catch (error) {
                console.error(error);
                const errorMessage = t('commonPaymentInitiateError');
                setReceiverPaymentError(errorMessage);
                showReceiverPaymentStatus({
                    type: 'error',
                    message: errorMessage,
                    fallbackMessage: t('commonPaymentInitiateError'),
                });
            } finally {
                setReceiverPaymentSubmitting(false);
            }
            return;
        }

        if (receiverOnlineProvider === 'mtn' && receiverOnlineStep === 'otp') {
            if (!receiverOtpCode || receiverOtpCode.length < 4) {
                setReceiverPaymentError(t('onlinePaymentOtpInvalid'));
                return;
            }

            try {
                setReceiverPaymentSubmitting(true);
                const { ok, result } = await confirmMtnPayment({
                    shipment_id: receiverPaymentData?.shipment_id ?? shipmentId,
                    phone: receiverPaymentData?.phone,
                    guid: receiverPaymentData?.guid,
                    operation_number: receiverPaymentData?.operation_number,
                    invoice: receiverPaymentData?.invoice,
                    code: receiverOtpCode,
                });

                if (!ok) {
                    const errorMessage = result.message || t('onlinePaymentConfirmError');
                    setReceiverPaymentError(errorMessage);
                    showReceiverPaymentStatus({
                        type: 'error',
                        message: errorMessage,
                        fallbackMessage: t('onlinePaymentConfirmError'),
                    });
                    return;
                }

                showReceiverPaymentStatus({
                    type: 'success',
                    message: result?.message,
                    fallbackMessage: t('onlinePaymentSuccessMessage') || 'Payment completed successfully. Continuing...',
                    onContinue: () => {
                        void finalizeReceiverPayment();
                    },
                    delayMs: 1700,
                });
            } catch (error) {
                console.error(error);
                const errorMessage = t('onlinePaymentConfirmError');
                setReceiverPaymentError(errorMessage);
                showReceiverPaymentStatus({
                    type: 'error',
                    message: errorMessage,
                    fallbackMessage: t('onlinePaymentConfirmError'),
                });
            } finally {
                setReceiverPaymentSubmitting(false);
            }
            return;
        }

        if (receiverOnlineProvider === 'syriatel' && receiverOnlineStep === 'phone') {
            // if (!receiverOnlinePhone || !/^09\d{8}$/.test(receiverOnlinePhone)) {
            //     setReceiverPaymentError(t('onlinePaymentPhoneInvalid'));
            //     return;
            // }

            try {
                setReceiverPaymentSubmitting(true);
                const { ok, result } = await initiateSyriatelPayment({
                    ...baseOnlinePayload,
                    payment_phone: receiverOnlinePhone,
                });

                if (!ok) {
                    const errorMessage = result.message || t('commonPaymentInitiateError');
                    setReceiverPaymentError(errorMessage);
                    showReceiverPaymentStatus({
                        type: 'error',
                        message: errorMessage,
                        fallbackMessage: t('commonPaymentInitiateError'),
                    });
                    return;
                }

                setReceiverPaymentData(result.payment);
                setReceiverOnlineStep('otp');
            } catch (error) {
                console.error(error);
                const errorMessage = t('commonPaymentInitiateError');
                setReceiverPaymentError(errorMessage);
                showReceiverPaymentStatus({
                    type: 'error',
                    message: errorMessage,
                    fallbackMessage: t('commonPaymentInitiateError'),
                });
            } finally {
                setReceiverPaymentSubmitting(false);
            }
            return;
        }

        if (receiverOnlineProvider === 'syriatel' && receiverOnlineStep === 'otp') {
            if (!receiverOtpCode || receiverOtpCode.length < 4) {
                setReceiverPaymentError(t('onlinePaymentOtpInvalid'));
                return;
            }

            try {
                setReceiverPaymentSubmitting(true);
                const { ok, result } = await confirmSyriatelPayment({
                    shipment_id: receiverPaymentData?.shipment_id ?? shipmentId,
                    invoice: receiverPaymentData?.invoice,
                    otp: receiverOtpCode,
                });

                if (!ok) {
                    const errorMessage = result.message || t('onlinePaymentConfirmError');
                    setReceiverPaymentError(errorMessage);
                    showReceiverPaymentStatus({
                        type: 'error',
                        message: errorMessage,
                        fallbackMessage: t('onlinePaymentConfirmError'),
                    });
                    return;
                }

                showReceiverPaymentStatus({
                    type: 'success',
                    message: result?.message,
                    fallbackMessage: t('onlinePaymentSuccessMessage') || 'Payment completed successfully. Continuing...',
                    onContinue: () => {
                        void finalizeReceiverPayment();
                    },
                    delayMs: 1700,
                });
            } catch (error) {
                console.error(error);
                const errorMessage = t('onlinePaymentConfirmError');
                setReceiverPaymentError(errorMessage);
                showReceiverPaymentStatus({
                    type: 'error',
                    message: errorMessage,
                    fallbackMessage: t('onlinePaymentConfirmError'),
                });
            } finally {
                setReceiverPaymentSubmitting(false);
            }
            return;
        }

        if (receiverOnlineProvider === 'card') {
            try {
                setReceiverPaymentSubmitting(true);
                const { ok, result } = await initiatePaymeraPayment(baseOnlinePayload);
                if (!ok || !result.payment_url) {
                    const errorMessage = result.message || t('onlinePaymentCardError');
                    setReceiverPaymentError(errorMessage);
                    showReceiverPaymentStatus({
                        type: 'error',
                        message: errorMessage,
                        fallbackMessage: t('onlinePaymentCardError'),
                    });
                    return;
                }

                const paymentUrl = result.payment_url;
                showReceiverPaymentStatus({
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
                setReceiverPaymentError(errorMessage);
                showReceiverPaymentStatus({
                    type: 'error',
                    message: errorMessage,
                    fallbackMessage: t('onlinePaymentCardError'),
                });
            } finally {
                setReceiverPaymentSubmitting(false);
            }
            return;
        }

        const errorMessage = 'Please choose a valid payment provider.';
        setReceiverPaymentError(errorMessage);
        showReceiverPaymentStatus({
            type: 'error',
            message: errorMessage,
            fallbackMessage: errorMessage,
        });
    };

    const submitReturnRequest = async (options = {}) => {
        const { skipReceiverPaymentCheck = false } = options;
        if (!returnAcknowledgement) {
            alert(t('shipmentsReturnAckRequired') || 'Please acknowledge the return policy.');
            return;
        }
        const otherReasonDetail = returnReasonDetail.trim();
        if (returnReason === 'Other' && !otherReasonDetail) {
            alert(t('shipmentsReturnOtherReasonRequired'));
            return;
        }

        if (!selected) return;
        const paymentStatus = (selected.rdf_payment_status ?? selected.rdfPaymentStatus ?? '').toString().toLowerCase();
        const receiverPaysReturnFee = (selected.return_delivery_fee_payer ?? selected.returnDeliveryFeePayer ?? '').toString().toLowerCase() === 'receiver';
        if (!skipReceiverPaymentCheck && receiverPaysReturnFee && paymentStatus === 'pending') {
            const rdfAmount = Number(selected.rdf_amount ?? 0);
            openReceiverPaymentModal({
                details: {
                    deliveryFee: rdfAmount,
                    total: rdfAmount,
                    title: 'Return Delivery Fee',
                    description: 'The receiver is set to pay for the return delivery fee. Please make the payment below.',
                    orderNumber: selected.order_number ?? selected.ship_id ?? selected.id ?? '',
                },
                purpose: 'return_delivery',
                defaultMethod: 'online',
                onSuccess: async () => {
                    await submitReturnRequest({ skipReceiverPaymentCheck: true });
                },
            });
            return;
        }
        try {
            setReturnSubmitting(true);
            const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            const shipmentId = (selected?.id) ? selected.id : String(selected?.ship_id || '').replace(/[^0-9]/g, '') || '';
            const payload = {
                shipment_id: shipmentId,
                payment_method: 'cash',
                remarks: returnReason,
                return_reason: returnReason === 'Other' ? otherReasonDetail : returnReason,
                special_instructions: returnInstruction,
                photos: returnImages
            }

            const resp = await fetch(`/customer/shipments/return`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrf,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            let data = null;
            try { data = await resp.json(); } catch (e) { /* ignore parse errors */ }

            if (resp.ok && data?.ok) {
                setReturnModalOpen(false); // Close modal
                setShowReturnPopup(true);  // Show success
                if (selected) {
                    setSelected({ ...selected, return_requested: true });
                }
                // Clean up blob URLs on success
                setReturnImages(prev => {
                    prev.forEach(img => {
                        if (img && img.startsWith('blob:')) {
                            try { URL.revokeObjectURL(img); } catch { }
                        }
                    });
                    return [];
                });
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
    // Toggle to hide header and sidebar when viewing invoice
    const [invoiceView, setInvoiceView] = useState(isPublicView);
    const hideLayout = invoiceView || isPublicView;

    useEffect(() => {
        if (isPublicView) {
            setInvoiceView(false);
        }
    }, [isPublicView]);

    const reviewSubmitDisabled =
        reviewSubmitting ||
        reviewForm.rider_behavior < 1 ||
        reviewForm.on_time_delivery < 1 ||
        reviewForm.affordability < 1;

    const handleSubmitReview = async () => {
        try {
            setReviewSubmitting(true);
            const shipmentId = selected?.id
                ? selected.id
                : String(selected?.ship_id || '').replace(/[^0-9]/g, '') || '';

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
                    rider_behavior: reviewForm.rider_behavior,
                    on_time_delivery: reviewForm.on_time_delivery,
                    affordability: reviewForm.affordability,
                    comment: reviewForm.comment,
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
                r.sender_name?.toLowerCase?.() ?? '',
                r.sender_address?.toLowerCase?.() ?? '',
                r.date?.toLowerCase?.() ?? '',
                r.parcelType?.toLowerCase?.() ?? '',
                r.shipmentType?.toLowerCase?.() ?? '',
                r.bookingType?.toLowerCase?.() ?? '',
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
                route('customer.shipments.receiving_parcels'),
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
                route('customer.shipments.receiving_parcels'),
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

    const showReturnButton = () => {
        if (!selected?.accept_returns) return false
        if (selected?.return_status) return false
        if (isReturned) return false
        const validStatuses = ['delivered', 'completed', 'paid', 'pending handover']
        const hasValidStatus = status => validStatuses.some(s => (status || '').toLowerCase().includes(s))
        const currentStatusValid = hasValidStatus(selected?.status)
        const historyStatusValid = Array.isArray(selected?.status_history) && selected.status_history.some(h => hasValidStatus(h?.status))
        const isExpired = selected?.return_expire_date && new Date() > new Date(selected.return_expire_date)
        if (isExpired) return false
        return currentStatusValid || historyStatusValid 
    }

    const showPayNowButton = () => {
        if (!selected) return false;
        const status = (selected?.payment_status ?? selected?.payment?.status ?? '').toString().toLowerCase();
        // const requires = Boolean(selected?.requires_receiver_payment ?? selected?.requiresReceiverPayment ?? selected?.payment?.requires_receiver_payment);
        const hasReachedDP2 = selected?.status_history?.some(h => (h.to_status || '').toString() === 'Arrived at Drop Point 2') ?? false;
        return status === 'pending' && (selected?.delivery_fee_payer === 'receiver') || (selected?.reciever_amount > 0 && hasReachedDP2);
    }

    const isPayemntRequiredForReturn = () => {
        const status = (selected?.rdf_payment_status ?? '').toString().toLowerCase();
        const requires = Boolean(selected?.return_delivery_fee_payer === 'receiver');
        return status === 'pending' && requires;
    }

    const openReceiverPaymentModalForParcel = () => {
        if (!selected) return;
        const receiverPaysDelivery = (selected?.delivery_fee_payer ?? '').toString().toLowerCase() === 'receiver';
        const platformFee = Number(selectedPaymentSummary.platformFee ?? 0);
        const vat = Number(selectedPaymentSummary.vat ?? 0);
        const basicFee = receiverPaysDelivery ? Number(selectedPaymentSummary.serviceFee ?? 0) : 0;
        const insuranceFee = Number(selectedPaymentSummary.insuranceFee ?? 0);
        const deliveryFee = receiverPaysDelivery ? Number(selectedPaymentSummary.shipmentFee ?? 0) : 0;
        const goodsAmount = Number(selectedPaymentSummary.goodsAmount ?? 0);
        const total = receiverPaysDelivery ? goodsAmount + deliveryFee + basicFee + platformFee + vat + insuranceFee : goodsAmount ;
        const deliveryLineItems = isSelectedDirectDelivery
            ? [{ label: t('commonDeliveryFee'), amount: deliveryFee }]
            : [
                { label: t('commonSenderDoorServiceFee'), amount: Number(selectedPaymentSummary.senderZoneDeliveryFee ?? 0) },
                { label: t('commonReceiverDoorServiceFee'), amount: Number(selectedPaymentSummary.receiverZoneDeliveryFee ?? 0) },
            ];

        openReceiverPaymentModal({
            details: {
                title: t('shipmentsParcelPayment'),
                description: t('shipmentsParcelPaymentDesc'),
                orderNumber: selected.order_number ?? selected.ship_id ?? selected.id ?? '',
                lineItems: [
                    ...(goodsAmount ? [{ label: t('commonGoodsAmount'), amount: goodsAmount }] : []),
                    ...(receiverPaysDelivery ? [
                        ...deliveryLineItems,
                        { label: t('commonBasicFee'), amount: basicFee },
                        { label: t('commonPlatformFee'), amount: platformFee }, 
                        { label: t('commonVat'), amount: vat },
                        { label: t('commonInsuranceFee'), amount: insuranceFee }
                    ] : []),
                ],
                total,
                actionAmount: selected?.reciever_amount ?? total,
            },
            purpose: 'receiver_delivery',
            defaultMethod: 'online',
        });
    }

    const columns = [
        { key: 'shipId', label: t('commonShipId'), headerClassName: 'py-3 px-4 text-gray-700 font-semibold' },
        {
            key: 'senderName',
            label: t('commonSenderName'),
            headerClassName: 'py-3 px-4 text-gray-700 font-semibold',
            render: (value) => (
                <span title={value} className="inline-block max-w-[300px] truncate align-middle text-gray-700">
                    {value || '-'}
                </span>
            ),
        },
        {
            key: 'senderAddress',
            label: t('shipmentsTableHeaderSenderAddress'),
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
                <MobileHeader title={open && selected ? t('commonShipmentDetails') : t('shipmentsPageTitleReceivingParcels')}/>

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
                            title={t('shipmentsAllReceivingParcels')}
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
                                    const fromAddress = r?.raw?.sender_address ?? r?.raw?.handover_address ?? r?.senderAddress ?? '-';
                                    const toAddress = r?.raw?.delivery_address ?? r?.raw?.receiver_address ?? '-';
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
                                                            {t('shipmentsPayReturnFee')}
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
                {!isPublicView && (
                    <div className={`${invoiceView ? 'flex md:hidden justify-center items-center' : 'hidden'}`}>
                        <img src="/assets/images/Logo.svg" alt="Logo" />
                    </div>
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
                                    showPaymentSummary={selected?.reciever_amount > 0}
                                    paymentSummaryProps={{
                                        mode: "receiver",
                                        includeDeliveryCosts: selected?.delivery_fee_payer === "receiver",
                                        totalAmount: selected?.reciever_amount,
                                    }}
                                    backButtonClassName="text-sm sm:text-base px-5 h-13 rounded-full border-2 border-[#338DFF] text-blue-500 font-semibold bg-white"
                                />
                                <div className={`py-6 sm:p-6 ${invoiceView ? "hidden" : "grid grid-cols-1 lg:grid-cols-12 gap-6"}`}>
                                    {/* Left column */}
                                    <div className="lg:col-span-5 space-y-6">

                                        {isPublicView && (
                                            <div className="flex items-center justify-start">
                                                <img src="/assets/images/Logo.svg" alt="BoxyGo" className="w-[321px] h-[89px] object-contain" />
                                            </div>
                                        )}

                                        {!isPublicView && (
                                            <div className="bg-white border border-[#E6EAF3] rounded-2xl p-4">
                                                <p className="text-sm font-semibold text-gray-800 mb-3">{t('deliverySpeedPrompt')}</p>
                                                <div className={`rounded-xl px-4 py-3 border ${isSelectedDirectDelivery ? 'border-[#338DFF] bg-[#f0f6ff]' : 'border-[#338DFF] bg-[#f0f6ff]'}`}>
                                                    <p className="inline-flex items-center gap-2 text-blue-500 font-semibold">
                                                        <span className="w-4 h-4 rounded-full border border-[#338DFF] inline-flex items-center justify-center"><span className="w-2 h-2 bg-[#338DFF] rounded-full"/></span>
                                                        {selectedDeliverySpeedLabel}
                                                    </p>
                                                    {!isSelectedDirectDelivery && (
                                                        <p className="text-xs text-blue-500 mt-1">
                                                            {selectedIndirectModeLabel || t('shipmentsDoorPickupPoint')} <svg className="w-3 h-3 inline ml-1" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

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
                                            {incompleteReason && <p className="ml-6 items-center text-sm gap-2 text-red-500 truncate">Reason: {incompleteReason}</p>}
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
                                            {selected?.reciever_amount > 0 && (
                                                <div className="px-2 py-6 sm:p-6">
                                                    <PaymentSummaryPanel
                                                        summary={selectedPaymentSummary}
                                                        t={t}
                                                        formatAmount={formatSYP}
                                                        directDelivery={isSelectedDirectDelivery}
                                                        mode="receiver"
                                                        includeDeliveryCosts={selected?.delivery_fee_payer === 'receiver'}
                                                        includeSubtotal
                                                        layout="table"
                                                        title={t('commonPaymentDetails')}
                                                        totalAmount={selected?.reciever_amount ?? 0}
                                                    />
                                            </div>)}
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
                                                        altPrefix="receiving-photo"
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
                                                        {/* {!isPublicView && selectedStatusKey === 'completed' && !selected?.review && (
                                                            <button type="button" onClick={() => { setReviewForm({ rider_behavior: 0, on_time_delivery: 0, affordability: 0, comment: '' }); setReviewOpen(true); }} className="px-5 h-13 rounded-full border-2 border-[#338DFF] text-blue-500 font-semibold bg-white">{t('shipmentsRateNow')}</button>
                                                        )} */}
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
                                                        {showReturnButton() && 
                                                            <button
                                                                type="button"
                                                                disabled={returnSubmitting}
                                                                onClick={handleReturnClick}
                                                                className={`px-5 h-13 rounded-full text-white font-semibold shadow border-2 border-[#FF3333] ${returnSubmitting ? 'bg-[#ff9999] cursor-not-allowed' : 'bg-[#FF3333] hover:bg-white hover:text-[#FF3333]'}`}
                                                            >
                                                                {returnSubmitting ? t('commonSubmitting') : t('shipmentsReturnParcel')}
                                                            </button>}
                                                        {showPayNowButton() && 
                                                            <button
                                                                type="button"
                                                                onClick={openReceiverPaymentModalForParcel}
                                                                className={`px-5 h-13 rounded-full text-white font-semibold shadow border-2 border-[#0b64f3] bg-[#0b64f3] hover:bg-white hover:text-[#0b64f3]`}
                                                            >
                                                                {t('shipmentsPayNow')}
                                                            </button>}
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
                    altPrefix="receiving-review"
                    reviewForm={reviewForm}
                    overallAverage={((reviewForm.rider_behavior || 0) + (reviewForm.on_time_delivery || 0) + (reviewForm.affordability || 0)) / 3 || 0}
                    submitDisabled={reviewSubmitDisabled}
                    submitting={reviewSubmitting}
                    onClose={() => setReviewOpen(false)}
                    onSubmit={handleSubmitReview}
                    onDirectRatingChange={(key, value) => setReviewForm((form) => ({ ...form, [key]: value }))}
                    onCommentChange={(comment) => setReviewForm((form) => ({ ...form, comment }))}
                />

                {/* Success Popup */}
                {showReviewPopup && (
                    <Popup
                        title={t('shipmentsReviewSuccessTitle')}
                        message={t('shipmentsReviewSuccessMessage')}
                        buttonLabel={t('commonClose')}
                        onConfirm={() => setShowReviewPopup(false)}
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
                        onConfirm={() => {setShowReturnPopup(false); window.location.href = "/customer/receiving-parcels"}}
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

                {receiverPaymentStatus && (
                    <Popup
                        title={receiverPaymentStatus.title}
                        message={receiverPaymentStatus.description}
                        buttonLabel={receiverPaymentStatus.type === 'success' ? (t('commonContinue') || 'Continue') : (t('commonClose') || 'Close')}
                        onConfirm={closeReceiverPaymentStatusModal}
                        onClose={closeReceiverPaymentStatusModal}
                        loopAnimation={false}
                        showIcon={receiverPaymentStatus.type === 'success'}
                        closeOnOverlayClick
                    />
                )}

                {showReturnAuthModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-10">
                        <div className="relative rounded-2xl bg-white p-6 text-center shadow-2xl">
                            <button
                                type="button"
                                onClick={() => setShowReturnAuthModal(false)}
                                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                                aria-label="Close"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l8 8M6 14L14 6" />
                                </svg>
                            </button>
                            <div className="space-y-5 p-2">
                                <h2 className="text-2xl font-bold text-gray-800 text-start">Track and Manage</h2>
                                <hr/>
                                <p className="text-base font-semibold text-gray-800 p-2 text-start">Get updates, returns and history at one place</p>
                                <ul className="space-y-2 text-left text-sm text-gray-700">
                                    <li className="flex items-start gap-2 text-base p-1">
                                        <span className="mt-0.5 text-blue-500" aria-hidden="true">
                                            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l3 3 7-7" />
                                            </svg>
                                        </span>
                                        Delivery notifications (SMS / Email)
                                    </li>
                                    <li className="flex items-start gap-2 text-base p-1">
                                        <span className="mt-0.5 text-blue-500" aria-hidden="true">
                                            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l3 3 7-7" />
                                            </svg>
                                        </span>
                                        Return requests & pickup scheduling
                                    </li>
                                    <li className="flex items-start gap-2 text-base p-1">
                                        <span className="mt-0.5 text-blue-500" aria-hidden="true">
                                            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l3 3 7-7" />
                                            </svg>
                                        </span>
                                        Address change & delivery notes
                                    </li>
                                    <li className="flex items-start gap-2 text-base p-1">
                                        <span className="mt-0.5 text-blue-500" aria-hidden="true">
                                            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l3 3 7-7" />
                                            </svg>
                                        </span>
                                        All shipments in one dashboard
                                    </li>
                                </ul>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReturnAuthModal(false);
                                        router.visit(`/register?bookingId=${selected.order_number}`);
                                    }}
                                    className="w-full rounded-full bg-[#1f6dff] px-4 py-3 text-md font-semibold text-white transition hover:bg-[#1660d5]"
                                >
                                    Create free account
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReturnAuthModal(false);
                                        router.visit('/login');
                                    }}
                                    className="text-sm text-[#1f6dff] underline-offset-4 hover:text-[#134d9d]"
                                >
                                    Already have an account? <span className="font-semibold">Sign In</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {receiverPaymentModalOpen && selected && (
                    <ReceiverPaymentModal
                        open={receiverPaymentModalOpen}
                        paymentDetails={modalPaymentDetails ?? {
                            lineItems: Number(selected.rdf_amount ?? 0) > 0
                                ? [{ label: 'Return Delivery Fee', amount: Number(selected.rdf_amount ?? 0) || 0 }]
                                : [],
                            total: Number(selected.rdf_amount ?? 0) || 0,
                            actionAmount: Number(selected.rdf_amount ?? 0) || 0,
                            title: 'Return Delivery Fee',
                            orderNumber: selected.order_number ?? selected.ship_id ?? selected.id ?? ''
                        }}
                        onClose={closeReceiverPaymentModal}
                        onPayNow={handlePayNow}
                        paymentMethod={receiverPaymentMethod}
                        onlineProvider={receiverOnlineProvider}
                        onOnlineProviderChange={(provider) => {
                            setReceiverOnlineProvider(provider);
                            setReceiverOnlineStep('phone');
                            setReceiverPaymentError('');
                        }}
                        onlineStep={receiverOnlineStep}
                        onlinePhone={receiverOnlinePhone}
                        onOnlinePhoneChange={setReceiverOnlinePhone}
                        otpCode={receiverOtpCode}
                        onOtpCodeChange={setReceiverOtpCode}
                        paymentError={receiverPaymentError}
                        onResendOtp={receiverOnlineProvider === 'syriatel' && receiverOnlineStep === 'otp' ? handleResendReceiverOtp : null}
                        submitting={receiverPaymentSubmitting}
                        t={t}
                        showOnlineGatewayForm
                    />
                )}

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
                {open && selected && (
                    <Drawer
                        open={returnModalOpen}
                        onClose={() => setReturnModalOpen(false)}
                        showCloseButton={false}
                        closeOnOverlayClick
                        closeOnEsc
                        panelClassName="flex h-full w-full max-w-[520px] flex-col border border-[#e2eaf2] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.25)] rounded-l-[28px] max-h-[90vh]"
                        containerClassName="fixed inset-0 z-50 flex items-stretch justify-end"
                        overlayClassName="bg-black/40 backdrop-blur-[1px]"
                        headerClassName="px-6 pt-6 pb-4 border-b border-[#e2e8f0]"
                        bodyClassName="flex-1 overflow-y-auto px-6 pb-6 pt-3"
                        footerClassName="px-6 pb-6 pt-4 border-t border-[#e2e8f0]"
                        header={
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-xl font-bold text-gray-800">{t('shipmentsReturnParcel')}</h3>
                                <button
                                    type="button"
                                    onClick={() => setReturnModalOpen(false)}
                                    className="rounded-full p-1 text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        }
                        footer={
                            <button
                                type="button"
                                onClick={() => submitReturnRequest()}
                                disabled={returnSubmitting || !returnAcknowledgement || !returnReason}
                                className={`w-full py-3.5 rounded-full font-bold text-white transition-colors shadow-sm
                                    ${returnSubmitting || !returnAcknowledgement || !returnReason
                                        ? 'bg-blue-300 cursor-not-allowed'
                                        : 'bg-[#338DFF] hover:bg-blue-600'
                                    }`}
                            >
                                {returnSubmitting ? t('commonSubmitting') : t('shipmentsConfirmReturnPickup')}
                            </button>
                        }
                    >
                        <div className="space-y-6">
                            <div className="flex items-stretch gap-4  border border-[#e2eaf2] rounded-xl p-4">
                                <div className="flex flex-col items-center">
                                    <span className="w-3 h-3 rounded-full border-2 border-[#4f7df9]" />
                                    <span className="flex-1 w-px bg-[#e5e7eb]" />
                                    <span className="w-3 h-3 rounded-full border-2 border-[#4f7df9] bg-[#2563eb]" />
                                </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <div className="text-blue-500 text-sm font-semibold">
                                        {t('shipmentsPickupLocationReceiver')}
                                    </div>
                                    <div className="text-sm text-[#111827]">{selected.delivery_address ?? '--'}</div>
                                </div>
                                <div className="pt-2 border-t border-[#e5e7eb]">
                                    <div className="text-blue-500 text-sm font-semibold">
                                        {t('shipmentsDropOffLocationSender')}
                                    </div>
                                    <div className="text-sm text-[#111827]">{selected.handover_address ?? '--'}</div>
                                </div>
                            </div>
                        </div>

                            <ReturnParcelDetailsSummary
                                title={t('commonParcelDetails') || 'Parcel Details'}
                                className="space-y-4"
                                headingClassName="font-bold text-gray-800"
                                fields={[
                                    { key: 'parcel-id', label: t('commonParcelId'), value: selected.order_number },
                                    { key: 'consignment', label: t('commonConsignmentType'), value: selected.consignment_type },
                                    { key: 'size', label: t('commonSize'), value: selected.size?.name },
                                    { key: 'weight', label: t('commonWeight'), value: selected.weight ? `${selected.weight} kg` : '-' },
                                    { key: 'address-code', label: t('shipmentsAddressCode'), value: selected.delivery_address, className: 'col-span-2' },
                                ]}
                            />

                            <hr className="border-gray-100" />

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('commonReturnReason')}
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={returnReason}
                                            onChange={(e) => {
                                                const nextValue = e.target.value;
                                                setReturnReason(nextValue);
                                                if (nextValue !== 'Other') {
                                                    setReturnReasonDetail('');
                                                }
                                            }}
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
                                </div>
                                {returnReason === 'Other' && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                                            {t('shipmentsReturnReasonDetails')}
                                            <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={returnReasonDetail}
                                            onChange={(e) => setReturnReasonDetail(e.target.value)}
                                            placeholder={t('shipmentsReturnReasonDetailsPlaceholder')}
                                            required
                                            aria-required="true"
                                            className="w-full border border-gray-200 rounded-full py-3 px-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                )}
                                {(['Damaged Item', 'Wrong Item', 'Other'].includes(returnReason)) && (
                                    <div>
                                        <label className="block text-sm font-bold mb-2">
                                            {t('shipmentsAttachParcelConditionImages')}
                                            {['Damaged Item', 'Wrong Item'].includes(returnReason) && <span className="text-red-500 ml-1">*</span>}
                                            <span className="text-gray-400 font-normal ml-1 text-xs">{t('shipmentsMaxImagesHint')}</span>
                                        </label>

                                        {returnPhotoErrors && (
                                            <div className="mb-2 p-2 bg-red-100 text-red-700 rounded text-sm">
                                                {returnPhotoErrors}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-5 gap-2 mb-2">
                                            {returnImages.map((img, index) => (
                                                <div key={index} className="relative aspect-square bg-gray-100 rounded border overflow-hidden">
                                                    <img
                                                        src={img}
                                                        alt="Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        onClick={() => handleRemovePhoto(index)}
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
                                                        ref={photoInputRef}
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        onChange={handlePhotoSelect}
                                                        className="hidden"
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
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

                            <div className="flex items-start gap-3">
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
                    </Drawer>
                )}
            </main>
        </div >
    );
}
