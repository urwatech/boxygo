import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import Menu from '../../../Components/Common/Menu';
import PrimaryButton from '../Components/PrimaryButton';
import OutlineButton from '../Components/OutlineButton';
import Drawer from '../Components/Drawer';
import Table from '../../../Components/Common/Table';
import ConfirmDialog from '../../../Components/SuperAdmin/ConfirmDialog';
import { useTranslation } from 'react-i18next';

const INITIAL_FORM_STATE = {
    name: '',
    description: '',
    length_cm: '',
    width_cm: '',
    height_cm: '',
    min_weight_kg: '',
    max_weight_kg: '',
    api_mapping_key: '',
    status: 'active',
    icon: null,
};

const defaultIcon = '/assets/images/Parcel.svg';

const toInputValue = (value) => {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'number') {
        return Number.isInteger(value) ? `${value}` : value.toString();
    }

    return value;
};

export default function Index({ parcels = {}, statistics = {}, filters = {} }) {
    const { t } = useTranslation();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [activeParcelId, setActiveParcelId] = useState(null);
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [statusFilter, setStatusFilter] = useState(filters.status ?? '');
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [parcelToDelete, setParcelToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const drawerInitialFocusRef = useRef(null);
    const statusMenuRef = useRef(null);
    const menuTriggerRef = useRef(null);
    const formRef = useRef(null);
    const form = useForm(INITIAL_FORM_STATE);
    const { data, setData, errors, processing, reset, clearErrors } = form;
    const [iconPreview, setIconPreview] = useState(defaultIcon);
    const [currentIconPath, setCurrentIconPath] = useState(null);
    const iconObjectUrlRef = useRef(null);

    const limit = statistics.limit ?? 5;
    const totalParcels = statistics.total ?? 0;
    const remainingSlots = statistics.remaining_slots ?? Math.max(0, limit - totalParcels);
    const canCreateMore = totalParcels < limit;

    const parcelRecords = useMemo(() => parcels?.data ?? [], [parcels]);
    const statusMenuItems = useMemo(() => [
        { label: t('commonAll'), value: '' },
        { label: t('statusActive'), value: 'active' },
        { label: t('statusInactive'), value: 'inactive' },
    ], [t]);

    const resolveStatusLabel = (status) => {
        if (status === 'active') {
            return t('statusActive');
        }
        if (status === 'inactive') {
            return t('statusInactive');
        }
        return status;
    };
    const selectedStatusLabel = useMemo(() => {
        const match = statusMenuItems.find((item) => item.value === statusFilter);
        return match?.label ?? t('commonAll');
    }, [statusFilter, statusMenuItems, t]);

    useEffect(() => {
        const handler = setTimeout(() => {
            const normalizedSearch = filters.search ?? '';
            const normalizedStatus = filters.status ?? '';

            if (searchTerm === normalizedSearch && statusFilter === normalizedStatus) {
                return;
            }

            router.get(route('admin.parcels.index'), {
                search: searchTerm || undefined,
                status: statusFilter || undefined,
                per_page: filters.per_page ?? undefined,
            }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 350);

        return () => clearTimeout(handler);
    }, [searchTerm, statusFilter]);

    useEffect(() => {
        const normalized = filters.search ?? '';
        setSearchTerm((current) => (current === normalized ? current : normalized));
    }, [filters.search]);

    useEffect(() => {
        const normalized = filters.status ?? '';
        setStatusFilter((current) => (current === normalized ? current : normalized));
    }, [filters.status]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
                setShowStatusMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const nonFieldErrors = useMemo(() => {
        const fieldKeys = Object.keys(INITIAL_FORM_STATE);
        return Object.entries(errors)
            .filter(([key]) => !fieldKeys.includes(key))
            .map(([, message]) => message)
            .filter(Boolean);
    }, [errors]);

    const formatDimension = (value, t, unitKey = 'superAdminParcelsDimensionUnitCm') => {
        if (value === null || value === undefined || value === '') {
            return '--';
        }

        return `${value} ${t(unitKey)}`;
    };

    const formatWeightRange = (parcel, t) => {
        const min = parcel?.min_weight_kg;
        const max = parcel?.max_weight_kg;

        if (min !== null && min !== undefined && max !== null && max !== undefined) {
            return t('superAdminParcelsWeightBetween', { min, max });
        }

        if (min !== null && min !== undefined) {
            return t('superAdminParcelsWeightFrom', { min });
        }

        if (max !== null && max !== undefined) {
            return t('superAdminParcelsWeightUpTo', { max });
        }

        return t('superAdminParcelsWeightRangeNotSet');
    };

    const openDrawer = useCallback(() => {
        setIsDrawerOpen(true);
    }, []);

    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false);
    }, []);

    const handleDrawerAfterClose = useCallback(() => {
        setIsEditing(false);
        setActiveParcelId(null);
        reset();
        clearErrors();
        // cleanup preview url
        if (iconObjectUrlRef.current) {
            URL.revokeObjectURL(iconObjectUrlRef.current);
            iconObjectUrlRef.current = null;
        }
        setIconPreview(defaultIcon);
        setCurrentIconPath(null);
    }, [clearErrors, reset]);

    const openCreateDrawer = () => {
        reset();
        clearErrors();
        setData({
            ...INITIAL_FORM_STATE,
            status: 'active',
        });
        setIsEditing(false);
        setActiveParcelId(null);
        // reset preview to default icon
        if (iconObjectUrlRef.current) {
            URL.revokeObjectURL(iconObjectUrlRef.current);
            iconObjectUrlRef.current = null;
        }
        setIconPreview(defaultIcon);
        setCurrentIconPath(null);
        openDrawer();
    };

    const openEditDrawer = (parcel) => {
        clearErrors();
        setData({
            name: parcel.name ?? '',
            description: parcel.description ?? '',
            length_cm: toInputValue(parcel.length_cm),
            width_cm: toInputValue(parcel.width_cm),
            height_cm: toInputValue(parcel.height_cm),
            min_weight_kg: toInputValue(parcel.min_weight_kg),
            max_weight_kg: toInputValue(parcel.max_weight_kg),
            api_mapping_key: parcel.api_mapping_key ?? '',
            status: parcel.status ?? 'active',
            icon: null,
        });
        setIsEditing(true);
        setActiveParcelId(parcel.id);
        // show current icon preview when editing
        if (iconObjectUrlRef.current) {
            URL.revokeObjectURL(iconObjectUrlRef.current);
            iconObjectUrlRef.current = null;
        }
        setCurrentIconPath(parcel.icon_path || null);
        setIconPreview(parcel.icon_path || defaultIcon);
        openDrawer();
    };

    const handleFieldChange = (field, value) => {
        setData(field, value);

        if (errors[field]) {
            clearErrors(field);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        // Normalize payload before submit
        form.transform((payload) => {
            const p = { ...payload };
            // Coerce optional numeric fields to null if empty
            ['length_cm', 'width_cm', 'height_cm'].forEach((k) => {
                if (p[k] === '') p[k] = null;
            });
            // Avoid sending empty 'icon' when editing (to satisfy nullable|image rules)
            if (isEditing && (p.icon === null || p.icon === undefined)) {
                delete p.icon;
            }
            // On edit, force method spoofing to POST to avoid PHP PUT+multipart parsing issue
            if (isEditing) {
                p._method = 'put';
            }
            return p;
        });

        const options = {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                closeDrawer();
            },
        };

        if (isEditing && activeParcelId) {
            form.post(route('admin.parcels.update', activeParcelId), options);
        } else {
            form.post(route('admin.parcels.store'), options);
        }
    };

    const handleDelete = (parcel) => {
        if (!parcel?.id) {
            return;
        }

        setParcelToDelete(parcel);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = () => {
        if (!parcelToDelete) return;

        setIsDeleting(true);
        router.delete(route('admin.parcels.destroy', parcelToDelete.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowDeleteDialog(false);
                setParcelToDelete(null);
                setIsDeleting(false);
            },
            onError: () => {
                setIsDeleting(false);
            },
        });
    };

    const handleCancelDelete = () => {
        setShowDeleteDialog(false);
        setParcelToDelete(null);
    };

    const handleStatusUpdate = (parcel, value) => {
        if (!parcel?.id || parcel.status === value) {
            return;
        }

        setStatusUpdatingId(parcel.id);
        router.patch(route('admin.parcels.status', parcel.id), {
            status: value,
        }, {
            preserveScroll: true,
            onFinish: () => setStatusUpdatingId(null),
        });
    };

    const handleStatusMenuSelect = (item) => {
        setShowStatusMenu(false);
        setStatusFilter(item?.value ?? '');
    };

    const renderError = (field) => {
        if (!errors[field]) {
            return null;
        }

        return (
            <p className="mt-1 text-xs text-red-500">
                {errors[field]}
            </p>
        );
    };

    // Pagination + columns for Parcel Records table
    const paginationMeta = {
        currentPage: parcels?.current_page ?? 1,
        totalPages: parcels?.last_page ?? 1,
        from: parcels?.from ?? 0,
        to: parcels?.to ?? 0,
        total: parcels?.total ?? 0,
    };

    const handlePageChange = (page) => {
        router.get(route('admin.parcels.index'), {
            page,
            search: searchTerm || undefined,
            status: statusFilter || undefined,
            per_page: filters.per_page ?? undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const tableColumns = [
        {
            key: 'parcel',
            label: t('commonParcel'),
            render: (value, parcel) => {
                const parcelDisplayName = parcel.name ?? t('superAdminParcelsUnnamedParcel');

                return (
                    <div className="flex items-center gap-3">
                        <img
                            src={parcel.icon_path || defaultIcon}
                            alt={t('commonIconAlt', { name: parcelDisplayName })}
                            className="w-10 h-10 rounded-xl border border-[#e2e8f0] bg-white p-2"
                        />
                        <div>
                            <div className="font-semibold text-[#0f172a]">
                                {parcelDisplayName}
                            </div>
                            <div className="text-xs text-slate-500">
                                {parcel.description && parcel.description.slice(0, 60)}
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'dimensions',
            label: t('commonDimensions'),
            render: (value, parcel) => (
                <div className="flex flex-col gap-1 whitespace-nowrap">
                    <span>{t('superAdminParcelsDimensionLength')}: {formatDimension(parcel.length_cm, t)}</span>
                    <span>{t('superAdminParcelsDimensionWidth')}: {formatDimension(parcel.width_cm, t)}</span>
                    <span>{t('superAdminParcelsDimensionHeight')}: {formatDimension(parcel.height_cm, t)}</span>
                </div>
            ),
        },
        {
            key: 'weight_range',
            label: t('commonWeightRange'),
            render: (value, parcel) => formatWeightRange(parcel, t),
        },
        {
            key: 'status',
            label: t('commonStatus'),
            render: (value, parcel) => (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${parcel.status === 'active' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]'}`}>
                    {resolveStatusLabel(parcel.status)}
                </span>
            ),
        },
        {
            key: 'updated_at',
            label: t('superAdminParcelsColumnUpdated'),
            render: (value, parcel) => (
                <span className="text-xs text-slate-500">{parcel.updated_at ? new Date(parcel.updated_at).toLocaleDateString() : '--'}</span>
            ),
        },
        // {
        //     key: 'actions',
        //     label: 'Actions',
        //     align: 'right',
        //     render: (value, parcel) => {
        //         const nextStatus = parcel.status === 'active' ? 'inactive' : 'active';
        //         return (
        //             <div className="flex items-center justify-end gap-3">
        //                 <button
        //                     type="button"
        //                     onClick={() => handleStatusUpdate(parcel, nextStatus)}
        //                     disabled={statusUpdatingId === parcel.id}
        //                     className="rounded-full border border-[#338dff] px-4 py-1.5 text-xs font-medium text-blue-500 transition hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(51,141,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
        //                 >
        //                     {statusUpdatingId === parcel.id
        //                         ? t('commonUpdating')
        //                         : t('superAdminParcelsMarkStatus', { status: resolveStatusLabel(nextStatus) })}
        //                 </button>
        //                 <button
        //                     type="button"
        //                     onClick={() => openEditDrawer(parcel)}
        //                     className="rounded-full border border-[#e2e8f0] px-4 py-1.5 text-xs font-medium text-[#475569] transition hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(148,163,184,0.25)]"
        //                 >
        //                     {t('commonEdit')}
        //                 </button>
        //                 <button
        //                     type="button"
        //                     onClick={() => handleDelete(parcel)}
        //                     className="rounded-full border border-[#fee2e2] px-4 py-1.5 text-xs font-medium text-[#dc2626] transition hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(220,38,38,0.25)]"
        //                 >
        //                     {t('commonDelete')}
        //                 </button>
        //             </div>
        //         );
        //     },
        // },
    ];

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        {t('superAdminParcelsTitle')}
                    </h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">›</span>
                        <span className="font-medium text-gray-500">
                            {t('commonParcels')}
                        </span>
                    </nav>
                </div>
            }>

            <Head title={t('superAdminParcelsTitle')} />
            <section className="bg-white border border-[#e2e8f0] rounded-[24px] shadow-sm px-5 sm:px-7 lg:px-9 py-6 space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-[#0f172a]">
                            {t('superAdminParcelsSectionAll')}
                        </h2>
                        <p className="text-sm text-[#64748b]">
                            {t('superAdminParcelsLimit', { limit })}
                            &nbsp;
                            <span className="font-semibold text-blue-500 underline">
                                {remainingSlots > 0
                                    ? t('superAdminParcelsSlotsAvailable', { count: remainingSlots })
                                    : t('superAdminParcelsNoSlotsRemaining')}
                            </span>
                        </p>
                    </div>
                    {/* <button
                        type="button"
                        onClick={openCreateDrawer}
                        disabled={!canCreateMore}
                        className={`inline-flex items-center gap-2 text-sm font-medium transition ${canCreateMore ? 'text-blue-500 hover:underline' : 'text-slate-500 cursor-not-allowed'}`}
                    >
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${canCreateMore ? 'border-[#338dff] text-blue-500' : 'border-[#cbd5f5] text-slate-500'}`}>
                            +
                        </span>
                        {t('superAdminParcelsAddNewButton')}
                    </button> */}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {parcelRecords.length > 0 ? (
                        parcelRecords.map((parcel) => {
                            const parcelDisplayName = parcel.name ?? t('superAdminParcelsUnnamedParcel');

                            return (
                                <article
                                    key={parcel.id}
                                    className="rounded-[20px] border border-[#e2e8f0] bg-[#f8fafc] px-5 py-5 flex flex-col gap-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <img
                                                src={parcel.icon_path || defaultIcon}
                                                alt={t('commonIconAlt', { name: parcelDisplayName })}
                                                className="w-6 h-6"
                                            />
                                            <div>
                                                <h3 className="text-sm font-semibold text-blue-500">
                                                    {parcelDisplayName}
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    {formatWeightRange(parcel, t)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            {/* <button
                                                type="button"
                                                onClick={() => handleDelete(parcel)}
                                                className="hover:text-[#1f2937] transition"
                                                aria-label={t('superAdminParcelsAriaDelete', {
                                                    name: parcelDisplayName,
                                                })}
                                            >
                                                <img src="/assets/images/delete_icon.png" alt="delete icon" className="w-4 h-4" />
                                            </button> */}
                                            <button
                                                type="button"
                                                onClick={() => openEditDrawer(parcel)}
                                                className="hover:text-[#1f2937] transition"
                                                aria-label={t('superAdminParcelsAriaEdit', {
                                                    name: parcelDisplayName,
                                                })}
                                            >
                                                <img src="/assets/images/edit_icon.png" alt="edit icon" className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-neutral-900 leading-relaxed">
                                        {parcel.description}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 text-sm text-[#475569]">
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">{t('superAdminParcelsDimensionLength')}</p>
                                            <p className="font-medium text-neutral-900">{formatDimension(parcel.length_cm, t)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">{t('superAdminParcelsDimensionWidth')}</p>
                                            <p className="font-medium text-neutral-900">{formatDimension(parcel.width_cm, t)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">{t('superAdminParcelsDimensionHeight')}</p>
                                            <p className="font-medium text-neutral-900">{formatDimension(parcel.height_cm, t)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">{t('commonStatus')}</p>
                                            <p className="font-medium text-neutral-900 capitalize">{resolveStatusLabel(parcel.status)}</p>
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    ) : (
                        <div className="col-span-full rounded-[20px] border border-dashed border-[#d8dee9] bg-white py-12 text-center text-sm text-[#64748b]">
                            {t('superAdminParcelsNoParcels')}
                        </div>
                    )}
                </div>
            </section>
            <section className="mt-8 rounded-[24px] border border-[#e2e8f0] bg-white px-5 sm:px-7 lg:px-9 py-6 space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-[#0f172a]">{t('superAdminParcelsRecordsTitle')}</h2>
                        <p className="text-sm text-[#64748b]">
                            {t('superAdminParcelsRecordsDescription')}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder={t('superAdminParcelsSearchPlaceholder')}
                                className="w-full rounded-full border border-[#e2e8f0] bg-white pl-10 pr-4 py-2.5 text-sm text-[#1f2937] placeholder:text-slate-500 focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                            />
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M5.5 11a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" />
                                </svg>
                            </span>
                        </div>
                        <div ref={statusMenuRef} className="relative w-full sm:w-40">
                            <button
                                type="button"
                                ref={menuTriggerRef}
                                onClick={() => setShowStatusMenu((prev) => !prev)}
                                className="w-full inline-flex items-center justify-between rounded-full border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                aria-haspopup="menu"
                                aria-expanded={showStatusMenu}
                            >
                                <span>{selectedStatusLabel}</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4 text-slate-500"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                </svg>
                            </button>

                            {showStatusMenu && (
                                <div className="absolute right-0 mt-2 z-40">
                                    <Menu
                                        items={statusMenuItems}
                                        onItemClick={handleStatusMenuSelect}
                                        anchorRef={menuTriggerRef}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Table
                    columns={tableColumns}
                    data={parcelRecords}
                    keyField="id"
                    emptyMessage={t('superAdminParcelsTableEmpty')}
                    className="bg-white"
                    tableClassName="min-w-[720px] text-[#475569]"
                    theadClassName="bg-[#f8fafc] text-xs uppercase tracking-wide text-slate-500"
                    tbodyClassName="text-sm"
                    hoverable
                    pagination
                    currentPage={paginationMeta.currentPage}
                    totalPages={paginationMeta.totalPages}
                    onPageChange={handlePageChange}
                    paginationMeta={paginationMeta}
                    showPaginationInfo
                    paginationClassName="rounded-2xl border border-[#e2e8f0] bg-white text-sm text-[#475569] w-full"
                    minWidth="720px"
                />
            </section>

            <Drawer
                open={isDrawerOpen}
                onClose={closeDrawer}
                onAfterClose={handleDrawerAfterClose}
                title={isEditing ? t('superAdminParcelsDrawerTitleEdit') : t('superAdminParcelsDrawerTitleAdd')}
                description={isEditing ? t('superAdminParcelsDrawerDescriptionEdit') : t('superAdminParcelsDrawerDescriptionAdd')}
                initialFocusRef={drawerInitialFocusRef}
                panelClassName="flex h-full w-full max-w-md flex-col"
                containerClassName="flex items-stretch justify-end"
                bodyClassName={null}
                footer={<>
                    <OutlineButton
                        type="button"
                        onClick={closeDrawer}
                        text={t('commonCancel')}
                        className={"w-full"}
                    />
                    <PrimaryButton
                        text={processing ? t('commonSaving') : t('commonSave')}
                        type="button"
                        disabled={processing}
                        className={"w-full"}
                        onClick={() => {
                            if (formRef.current) {
                                formRef.current.requestSubmit();
                            }
                        }}
                    />
                </>}
            >
                <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1">
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                        {nonFieldErrors.length > 0 && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {nonFieldErrors.map((message, index) => (
                                    <div key={index}>{message}</div>
                                ))}
                            </div>
                        )}

                        <section className="space-y-4">
                            <h3 className="text-sm font-semibold text-[#1f2937]">
                                {t('commonParcelDetails')}
                            </h3>
                            <div className="space-y-3">
                                <input
                                    ref={drawerInitialFocusRef}
                                    type="text"
                                    value={data.name}
                                    onChange={(event) => handleFieldChange('name', event.target.value)}
                                    placeholder={t('superAdminParcelsPlaceholderName')}
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                    required
                                />
                                {renderError('name')}
                                <div className="flex items-center gap-3">
                                    <img
                                        src={iconPreview || defaultIcon}
                                        alt={t('superAdminParcelsIconPreviewAlt')}
                                        className="w-10 h-10 rounded-xl border border-[#e2e8f0] bg-white p-1"
                                    />
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={(event) => {
                                            const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
                                            setData('icon', file);
                                            if (errors.icon) clearErrors('icon');
                                            // update preview
                                            if (iconObjectUrlRef.current) {
                                                URL.revokeObjectURL(iconObjectUrlRef.current);
                                                iconObjectUrlRef.current = null;
                                            }
                                            if (file) {
                                                const url = URL.createObjectURL(file);
                                                iconObjectUrlRef.current = url;
                                                setIconPreview(url);
                                            } else {
                                                setIconPreview(isEditing ? (currentIconPath || defaultIcon) : defaultIcon);
                                            }
                                        }}
                                        aria-label={t('superAdminParcelsIconInputLabel')}
                                        className="w-full rounded-full border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-[#eef5ff] file:text-blue-500"
                                        required={!isEditing}
                                    />
                                    {renderError('icon')}
                                </div>
                                <textarea
                                    rows="3"
                                    value={data.description}
                                    onChange={(event) => handleFieldChange('description', event.target.value)}
                                    placeholder={t('superAdminParcelsPlaceholderDescription')}
                                    className="w-full rounded-[20px] border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] resize-none focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                />
                                {renderError('description')}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-sm font-semibold text-[#1f2937]">
                                {t('commonDimensions')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                    type="text"
                                    value={data.length_cm}
                                    onChange={(event) => handleFieldChange('length_cm', event.target.value)}
                                    placeholder={t('superAdminParcelsPlaceholderLength')}
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                />
                                {renderError('length_cm')}
                                <input
                                    type="text"
                                    value={data.width_cm}
                                    onChange={(event) => handleFieldChange('width_cm', event.target.value)}
                                    placeholder={t('superAdminParcelsPlaceholderWidth')}
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                />
                                {renderError('width_cm')}
                                <input
                                    type="text"
                                    value={data.height_cm}
                                    onChange={(event) => handleFieldChange('height_cm', event.target.value)}
                                    placeholder={t('superAdminParcelsPlaceholderHeight')}
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                />
                                {renderError('height_cm')}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-sm font-semibold text-[#1f2937]">
                                {t('commonWeightRange')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    value={data.min_weight_kg}
                                    onChange={(event) => handleFieldChange('min_weight_kg', event.target.value)}
                                    placeholder={t('superAdminParcelsPlaceholderMinWeight')}
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                    required
                                />
                                {renderError('min_weight_kg')}
                                <input
                                    type="text"
                                    value={data.max_weight_kg}
                                    onChange={(event) => handleFieldChange('max_weight_kg', event.target.value)}
                                    placeholder={t('superAdminParcelsPlaceholderMaxWeight')}
                                    className="w-full rounded-[20px] border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                />
                                {renderError('max_weight_kg')}
                            </div>
                        </section>

                        {/* <section className="space-y-3">
                            <h3 className="text-sm font-semibold text-[#1f2937]">
                                External API Integration
                            </h3>
                            <div>
                                <select
                                    value={data.api_mapping_key}
                                    onChange={(event) => handleFieldChange('api_mapping_key', event.target.value)}
                                    className="w-full rounded-[20px] border border-[#e2e8f0] bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33]"
                                >
                                    <option value="">None (Use Standard Pricing)</option>
                                    <option value="price">Price (Core API Tier)</option>
                                    <option value="direct_price">Direct Price (Non-Stop Route)</option>
                                    <option value="price1">Price 1 (Small Box / Tier 1)</option>
                                    <option value="price2">Price 2 (Medium Box / Tier 2)</option>
                                    <option value="price3">Price 3 (Large Box / Tier 3)</option>
                                    <option value="price4">Price 4 (Oversize / Tier 4)</option>
                                    <option value="price5">Price 5 (Freight / Tier 5)</option>
                                    <option value="price6">Price 6 (Special Handling / Tier 6)</option>
                                </select>
                                {renderError('api_mapping_key')}
                                <p className="mt-1 text-xs text-slate-500">
                                    Connect this box size directly to an external billing matrix key.
                                </p>
                            </div>
                        </section> */}

                        <input type="hidden" value={data.status} readOnly />
                    </div>
                </form>
            </Drawer>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={showDeleteDialog}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title={t('superAdminParcelsDeleteTitle')}
                message={
                    parcelToDelete
                        ? t('commonDeleteConfirmMessage', {
                            name: parcelToDelete.name ?? t('superAdminParcelsUnnamedParcel'),
                        })
                        : t('superAdminParcelsDeleteFallback')
                }
                confirmText={t('commonDelete')}
                cancelText={t('commonCancel')}
                isProcessing={isDeleting}
            />
        </SuperAdminAuthenticated>
    );
}
