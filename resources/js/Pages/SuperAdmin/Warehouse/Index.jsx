import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import IMask from 'imask';
import { Head, useForm, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import StatsCard from '../Components/StatsCard';
import Table from '../../../Components/Common/Table';
import PrimaryButton from '../Components/PrimaryButton';
import OutlineButton from '../Components/OutlineButton';
import Input from '../../../Components/Common/Inputs/Input';
import Drawer from '../Components/Drawer';
import ConfirmDialog from '../../../Components/SuperAdmin/ConfirmDialog';
import ZoneMapViewer, { ZONE_COLOR_PALETTE } from '../../../Components/SuperAdmin/ZoneMapViewer';

const StatusToggle = ({ label = '', checked = false, onChange }) => (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
        <span className="relative inline-flex items-center">
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={(event) => onChange?.(event.target.checked)}
            />
            <span className="block w-12 h-6 rounded-full bg-[#E5E7EB] transition-colors duration-200 peer-checked:bg-[#338DFF]" />
            <span className="absolute left-1 top-1 block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-6" />
        </span>
        <span className="text-sm font-medium text-[#111827]">{label}</span>
    </label>
);

export default function Index({ warehouses = [], warehouseUsers = [], zones = [], statistics = {}, cities = [] }) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showCreateDrawer, setShowCreateDrawer] = useState(false);
    const [showEditDrawer, setShowEditDrawer] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [warehouseToDelete, setWarehouseToDelete] = useState(null);

    const zoneSelectRef = useRef(null);
    const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);
    const zoneMenuRef = useRef(null);

    const editZoneSelectRef = useRef(null);
    const [isEditZoneMenuOpen, setIsEditZoneMenuOpen] = useState(false);
    const editZoneMenuRef = useRef(null);

    const citySelectRef = useRef(null);
    const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
    const cityMenuRef = useRef(null);

    const editCitySelectRef = useRef(null);
    const [isEditCityMenuOpen, setIsEditCityMenuOpen] = useState(false);
    const editCityMenuRef = useRef(null);

    // keeper dropdown state
    const keeperSelectRef = useRef(null);
    const [isKeeperMenuOpen, setIsKeeperMenuOpen] = useState(false);
    const keeperMenuRef = useRef(null);

    const editKeeperSelectRef = useRef(null);
    const [isEditKeeperMenuOpen, setIsEditKeeperMenuOpen] = useState(false);
    const editKeeperMenuRef = useRef(null);
    
    const [availableWarehouseUsers, setAvailableWarehouseUsers] = useState(warehouseUsers);

    const nameInputRef = useRef(null);
    const nameMaskRef = useRef(null);
    const editNameInputRef = useRef(null);
    const editNameMaskRef = useRef(null);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        name: '',
        city: '',
        location: '',
        latitude: null,
        longitude: null,
        zone_id: '',
        keeper_id: '',
        status: 'active',
        shelves: [],
    });

    const { data: editData, setData: setEditData, put, processing: updating, errors: editErrors, clearErrors: clearEditErrors } = useForm({
        name: '',
        city: '',
        location: '',
        latitude: null,
        longitude: null,
        zone_id: '',
        keeper_id: '',
        status: 'active',
        shelves: [],
    });

    const [shelfInput, setShelfInput] = useState('');
    const [editShelfInput, setEditShelfInput] = useState('');

    const coloredZones = useMemo(() => (
        Array.isArray(zones)
            ? zones.map((zone) => ({
                ...zone,
                color: zone.status === 'active' ? '#10B981' : '#EF4444',
            }))
            : []
    ), [zones]);

    const zonesWithDrawings = useMemo(
        () => coloredZones.filter(
            (zone) => Array.isArray(zone.drawn_paths) && zone.drawn_paths.length > 0,
        ),
        [coloredZones],
    );

    const selectedCreateZone = useMemo(
        () => coloredZones.find((zone) => String(zone.id) === String(data.zone_id)),
        [coloredZones, data.zone_id],
    );

    const selectedEditZone = useMemo(
        () => coloredZones.find((zone) => String(zone.id) === String(editData.zone_id)),
        [coloredZones, editData.zone_id],
    );

    const normalizeCityName = (value) => (value || '')
        .toLowerCase()
        .replace(/ governorate$/i, '')
        .replace(/ governate$/i, '')
        .trim();

    const filteredCreateZones = useMemo(() => {
        if (!data.city) {
            return [];
        }

        const normalizedInputCity = normalizeCityName(data.city);

        return coloredZones.filter((zone) => normalizeCityName(zone.city) === normalizedInputCity);
    }, [coloredZones, data.city]);

    const filteredEditZones = useMemo(() => {
        if (!editData.city) {
            return [];
        }

        const normalizedInputCity = normalizeCityName(editData.city);

        return coloredZones.filter((zone) => normalizeCityName(zone.city) === normalizedInputCity);
    }, [coloredZones, editData.city]);

    const STAT_OVERVIEW = [
        { id: 'total', label: t('superAdminWarehouseStatTotal'), value: statistics.total || 0 },
        { id: 'assigned', label: t('superAdminWarehouseStatAssigned'), value: statistics.assigned || 0 },
        { id: 'inactive', label: t('superAdminWarehouseStatInactive'), value: statistics.inactive || 0 },
        { id: 'unassigned', label: t('superAdminWarehouseStatUnassigned'), value: statistics.unassigned || 0 },
    ];

    const ITEMS_PER_PAGE = 10;

    const filteredWarehouses = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return warehouses;

        return warehouses.filter((warehouse) => {
            const valuesToSearch = [
                warehouse.warehouseId,
                warehouse.name,
                warehouse.city,
                warehouse.assignedZone,
                warehouse.statusLabel,
            ].filter(Boolean);

            return valuesToSearch.some((value) =>
                String(value).toLowerCase().includes(term),
            );
        });
    }, [searchTerm, warehouses]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        const maxPage = Math.max(Math.ceil(filteredWarehouses.length / ITEMS_PER_PAGE), 1);
        if (currentPage > maxPage) {
            setCurrentPage(maxPage);
        }
    }, [filteredWarehouses.length, currentPage]);

    const paginatedWarehouses = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredWarehouses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, filteredWarehouses]);

    const paginationMeta = useMemo(() => {
        const total = filteredWarehouses.length;
        const totalPages = Math.max(Math.ceil(total / ITEMS_PER_PAGE), 1);
        const from = total === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const to = total === 0 ? 0 : Math.min(currentPage * ITEMS_PER_PAGE, total);

        return {
            currentPage,
            totalPages,
            from,
            to,
            total,
        };
    }, [currentPage, filteredWarehouses.length]);

    const badgeStyles = (statusKey) => {
        switch (statusKey) {
        case 'active':
            return 'bg-[#EBF9F1] text-[#1E8543] border border-[#B9ECC9]';
        case 'inactive':
            return 'bg-[#FDEBEC] text-[#C73535] border border-[#F3B7B7]';
        default:
            return 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]';
        }
    };

    const openCreateDrawer = () => {
        reset();
        clearErrors();
        setShowCreateDrawer(true);
    };

    const closeCreateDrawer = () => {
        setShowCreateDrawer(false);
        reset();
        clearErrors();
        setShelfInput('');
    };

    const openEditDrawer = (warehouse) => {
        setAvailableWarehouseUsers(warehouseUsers);
        const currentKeeperId = warehouse.keeper_details?.id ?? warehouse.keeper_id;
        if (currentKeeperId && warehouse.keeper_details && !availableWarehouseUsers.find(k => k.id === currentKeeperId)) {
            setAvailableWarehouseUsers(prev => [warehouse.keeper_details, ...prev]);
        }

        setSelectedWarehouse(warehouse);
        setEditData({
            name: warehouse.name || '',
            city: warehouse.city || '',
            location: warehouse.location || '',
            latitude: warehouse.latitude ?? null,
            longitude: warehouse.longitude ?? null,
            zone_id: warehouse.zone_id || '',
            keeper_id: (warehouse.keeper_details?.id ?? warehouse.keeper_id) || '',
            status: warehouse.statusState || 'active',
            shelves: warehouse.shelves || [],
        });
        setEditShelfInput('');
        clearEditErrors();
        setShowEditDrawer(true);
    };

    const handleShelfKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const value = shelfInput.trim();
            if (value && !data.shelves.includes(value)) {
                setData('shelves', [...data.shelves, value]);
            }
            setShelfInput('');
        }
    };

    const removeShelf = (shelfToRemove) => {
        setData('shelves', data.shelves.filter((shelf) => shelf !== shelfToRemove));
    };

    const handleEditShelfKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const value = editShelfInput.trim();
            if (value && !editData.shelves.includes(value)) {
                setEditData('shelves', [...editData.shelves, value]);
            }
            setEditShelfInput('');
        }
    };

    const removeEditShelf = (shelfToRemove) => {
        setEditData('shelves', editData.shelves.filter((shelf) => shelf !== shelfToRemove));
    };

    const closeEditDrawer = () => {
        setShowEditDrawer(false);
        setSelectedWarehouse(null);
        clearEditErrors();
    };

    const handleCreateSubmit = (event) => {
        event.preventDefault();
        post(route('admin.warehouses.store'), {
            preserveScroll: true,
            onSuccess: () => {
                closeCreateDrawer();
                window.location.reload()
            },
        });
    };

    const handleEditSubmit = (event) => {
        event.preventDefault();
        if (!selectedWarehouse) return;

        put(route('admin.warehouses.update', selectedWarehouse.id), {
            preserveScroll: true,
            onSuccess: () => {
                closeEditDrawer()
                setAvailableWarehouseUsers(warehouseUsers);
                window.location.reload()
                // router.reload({ only: ['warehouses', 'warehouseUsers', 'zones'] });
            },
        });
    };

    const handleDelete = () => {
        if (!warehouseToDelete) return;

        router.delete(route('admin.warehouses.destroy', warehouseToDelete.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowDeleteDialog(false);
                setWarehouseToDelete(null);
                window.location.reload()
            },
        });
    };

    const handleLocationSelect = (location) => {
        setData({
            ...data,
            city: location.city || '',
            latitude: Number.isFinite(location?.latitude) ? location.latitude : data.latitude,
            longitude: Number.isFinite(location?.longitude) ? location.longitude : data.longitude,
        });
    };

    const handleEditLocationSelect = (location) => {
        setEditData({
            ...editData,
            city: location.city || '',
            latitude: Number.isFinite(location?.latitude) ? location.latitude : editData.latitude,
            longitude: Number.isFinite(location?.longitude) ? location.longitude : editData.longitude,
        });
    };

    const handleZoneSelect = (zoneId) => {
        setData({ ...data, zone_id: zoneId });
        setIsZoneMenuOpen(false);
    };

    const handleEditZoneSelect = (zoneId) => {
        setEditData({ ...editData, zone_id: zoneId });
        setIsEditZoneMenuOpen(false);
    };

    const handleCitySelect = (cityName) => {
        const city = cities.find((item) => item.name === cityName);
        setData({
            ...data,
            city: cityName,
            zone_id: '',
            latitude: city?.latitude ?? null,
            longitude: city?.longitude ?? null,
        });
        setIsCityMenuOpen(false);
    };

    const handleKeeperSelect = (keeperId) => {
        setData({ ...data, keeper_id: keeperId });
        setIsKeeperMenuOpen(false);
    };

    const handleEditCitySelect = (cityName) => {
        const city = cities.find((item) => item.name === cityName);
        setEditData({
            ...editData,
            city: cityName,
            zone_id: '',
            latitude: city?.latitude ?? null,
            longitude: city?.longitude ?? null,
        });
        setIsEditCityMenuOpen(false);
    };

    const handleEditKeeperSelect = (keeperId) => {
        setEditData({ ...editData, keeper_id: keeperId });
        setIsEditKeeperMenuOpen(false);
    };

    useEffect(() => {
        if (!isZoneMenuOpen) return;

        const handleClickOutside = (event) => {
            if (
                !zoneMenuRef.current?.contains(event.target) &&
                !zoneSelectRef.current?.contains(event.target)
            ) {
                setIsZoneMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isZoneMenuOpen]);

    useEffect(() => {
        if (!isEditZoneMenuOpen) return;

        const handleClickOutside = (event) => {
            if (
                !editZoneMenuRef.current?.contains(event.target) &&
                !editZoneSelectRef.current?.contains(event.target)
            ) {
                setIsEditZoneMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditZoneMenuOpen]);

    useEffect(() => {
        if (!isCityMenuOpen) return;

        const handleClickOutside = (event) => {
            if (
                !cityMenuRef.current?.contains(event.target) &&
                !citySelectRef.current?.contains(event.target)
            ) {
                setIsCityMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCityMenuOpen]);

    useEffect(() => {
        if (!isKeeperMenuOpen) return;

        const handleClickOutside = (event) => {
            if (
                !keeperMenuRef.current?.contains(event.target) &&
                !keeperSelectRef.current?.contains(event.target)
            ) {
                setIsKeeperMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isKeeperMenuOpen]);

    useEffect(() => {
        if (!isEditCityMenuOpen) return;

        const handleClickOutside = (event) => {
            if (
                !editCityMenuRef.current?.contains(event.target) &&
                !editCitySelectRef.current?.contains(event.target)
            ) {
                setIsEditCityMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditCityMenuOpen]);

    useEffect(() => {
        setAvailableWarehouseUsers(warehouseUsers);
    }, [warehouseUsers]);

    useEffect(() => {
        if (!isEditKeeperMenuOpen) return;

        const handleClickOutside = (event) => {
            if (
                !editKeeperMenuRef.current?.contains(event.target) &&
                !editKeeperSelectRef.current?.contains(event.target)
            ) {
                setIsEditKeeperMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditKeeperMenuOpen]);

    // IMask for create warehouse name input
    useEffect(() => {
        if (!showCreateDrawer || !nameInputRef.current) return;

        const mask = IMask(nameInputRef.current, {
            mask: /^[a-zA-Z0-9\s\-_.]+$/,
            prepare: (str) => str,
            commit: (value) => {
                setData('name', value);
            },
        });

        nameMaskRef.current = mask;

        return () => {
            mask.destroy();
        };
    }, [showCreateDrawer]);

    // Update IMask value when data.name changes
    useEffect(() => {
        if (nameMaskRef.current && data.name !== nameMaskRef.current.value) {
            nameMaskRef.current.value = data.name;
        }
    }, [data.name]);

    // IMask for edit warehouse name input
    useEffect(() => {
        if (!showEditDrawer || !editNameInputRef.current) return;

        const mask = IMask(editNameInputRef.current, {
            mask: /^[a-zA-Z0-9\s\-_.]+$/,
            prepare: (str) => str,
            commit: (value) => {
                setEditData('name', value);
            },
        });

        editNameMaskRef.current = mask;

        return () => {
            mask.destroy();
        };
    }, [showEditDrawer]);

    // Update IMask value when editData.name changes
    useEffect(() => {
        if (editNameMaskRef.current && editData.name !== editNameMaskRef.current.value) {
            editNameMaskRef.current.value = editData.name;
        }
    }, [editData.name]);

    const WarehouseActions = ({ warehouse }) => {
        const [menuOpen, setMenuOpen] = useState(false);
        const buttonRef = useRef(null);
        const menuRef = useRef(null);

        useEffect(() => {
            if (!menuOpen) {
                return undefined;
            }

            const handleClickOutside = (event) => {
                if (
                    !menuRef.current?.contains(event.target)
                    && !buttonRef.current?.contains(event.target)
                ) {
                    setMenuOpen(false);
                }
            };

            const handleEscape = (event) => {
                if (event.key === 'Escape') {
                    setMenuOpen(false);
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
            };
        }, [menuOpen]);

        const handleMenuAction = (action) => {
            setMenuOpen(false);
            if (action === 'edit') {
                openEditDrawer(warehouse);
            }
            if (action === 'delete') {
                setWarehouseToDelete(warehouse);
                setShowDeleteDialog(true);
            }
        };

        return (
            <div className="relative inline-flex items-center justify-end">
                <button
                    type="button"
                    ref={buttonRef}
                    onClick={() => setMenuOpen((prev) => !prev)}
                    aria-label={t('superAdminWarehouseOpenMenuAria', { name: warehouse.name })}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#EEF2FF] transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="w-5 h-5 text-black cursor-pointer"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12h.008M12 12h.008M18 12h.008"></path></svg>
                </button>
                {menuOpen && (
                    <div
                        ref={menuRef}
                        className="absolute right-0 z-10 top-12 w-[180px]"
                    >
                        <div className="rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] overflow-hidden">
                            <button
                                type="button"
                                onClick={() => handleMenuAction('edit')}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F5F7FB]"
                            >
                                <img src="/assets/images/edit_icon.png" alt="" className="w-4 h-4" />
                                {t('commonEdit')}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleMenuAction('delete')}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#C73535] hover:bg-[#FFF0F0] border-t border-[#EEF1F7]"
                            >
                                <img src="/assets/images/delete_icon.png" alt="" className="w-4 h-4" />
                                {t('commonDelete')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const tableColumns = useMemo(() => [
        {
            key: 'warehouseId',
            label: t('superAdminWarehouseColumnId'),
            className: 'font-semibold text-[#16192C]',
        },
        {
            key: 'name',
            label: t('commonWarehouseName'),
        },
        {
            key: 'city',
            label: t('commonCity'),
        },
        {
            key: 'assignedZone',
            label: t('superAdminWarehouseColumnAssignedZones'),
        },
        {
            key: 'createdOn',
            label: t('commonCreatedOn'),
        },
        {
            key: 'lastUpdate',
            label: t('commonLastUpdate'),
        },
        {
            key: 'statusLabel',
            label: t('commonStatus'),
            render: (_, row) => (
                <span className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium ${badgeStyles(row.statusState)}`}>
                    {row.statusLabel}
                </span>
            ),
        },
        {
            key: 'actions',
            label: t('commonAction'),
            align: 'right',
            headerClassName: 'text-right',
            render: (_, warehouse) => <WarehouseActions warehouse={warehouse} />,
        },
    ], [t]);

    const getSelectedZoneName = (zoneId) => {
        if (!zoneId) return t('commonSelectZone');
        const zone = coloredZones.find((z) => String(z.id) === String(zoneId));
        return zone ? zone.name : t('commonSelectZone');
    };

    return (
        <SuperAdminAuthenticated
            headerContent={(
                <div>
                    <h2 className="text-lg font-semibold text-[#111827]">{t('commonWarehouseManagement')}</h2>
                    <nav className="text-sm text-[#338DFF]">
                        {t('commonHome')}
                        <span className="mx-2 text-gray-400">&rsaquo;</span>
                        <span className="text-gray-500">{t('commonWarehouseManagement')}</span>
                    </nav>
                </div>
            )}
        >
            <Head title={t('commonWarehouseManagement')} />
            <div className="space-y-6">
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {STAT_OVERVIEW.map((card) => (
                        <StatsCard
                            key={card.id}
                            title={card.label}
                            value={card.value}
                            iconSrc="/assets/images/wallet-money.svg"
                            className="!bg-white !border border-[#E6E9F4] shadow-none"
                        />
                    ))}
                </section>

                <section className="bg-white rounded-[28px] shadow-[0_20px_60px_rgba(15,23,42,0.05)] p-5 sm:p-7 space-y-5">
                    <div className="flex justify-between items-center gap-2">
                        <h2 className="text-2xl font-semibold text-[#111827]">{t('superAdminWarehouseSectionAll')}</h2>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 max-w-full md:max-w-[250px]">
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('commonSearch')}
                                    className="w-full border border-gray-200 rounded-full pt-4 pr-5 pb-4 input-field focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33] peer !py-3 pl-12"
                                    disabled={showCreateDrawer || showEditDrawer}
                                />
                                <svg
                                    className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65z"
                                    />
                                </svg>
                            </div>
                            <PrimaryButton
                                onClick={openCreateDrawer}
                                text={t('superAdminWarehouseButtonCreate')}
                            />
                        </div>
                    </div>

                    <div className="rounded-[24px] overflow-visible">
                        <Table
                            columns={tableColumns}
                            data={filteredWarehouses}
                            keyField="id"
                            hoverable
                            striped={true}
                            pagination
                            paginationMode="client"
                            pageSize={ITEMS_PER_PAGE}
                            currentPage={paginationMeta.currentPage}
                            totalPages={paginationMeta.totalPages}
                            onPageChange={setCurrentPage}
                            showPaginationInfo={false}
                        />
                    </div>
                </section>
            </div>

            <Drawer
                open={showCreateDrawer}
                onClose={closeCreateDrawer}
                title={t('superAdminWarehouseButtonCreate')}
                description={t('superAdminWarehouseCreateDescription')}
                maxWidth="500px"
            >
                <form onSubmit={handleCreateSubmit} className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto space-y-5 pb-4 pr-1">
                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="warehouse-name">
                                {t('commonWarehouseName')}
                            </label>
                            <input
                                ref={nameInputRef}
                                id="warehouse-name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder={t('superAdminWarehousePlaceholderName')}
                                className="mt-2 w-full rounded-[999px] border border-[#E3E8F4] bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:border-[#338DFF]"
                            />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="warehouse-city">
                                {t('commonCity')}
                            </label>
                            <div className="relative mt-2">
                                <button
                                    type="button"
                                    ref={citySelectRef}
                                    onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}
                                    className="w-full rounded-[999px] border border-[#E3E8F4] bg-white py-3 px-4 text-sm text-[#111827] flex items-center justify-between focus:border-[#338DFF]"
                                >
                                    {data.city || t('commonSelectCity')}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className="w-4 h-4 text-[#9AA0B4]"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>
                                {isCityMenuOpen && (
                                    <div
                                        ref={cityMenuRef}
                                        className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.12)] max-h-60 overflow-auto"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleCitySelect('')}
                                            className="w-full text-left px-4 py-3 text-sm text-[#6B7280] hover:bg-[#F5F7FB]"
                                        >
                                            {t('commonNone')}
                                        </button>
                                        {cities.map((city) => (
                                            <button
                                                key={city.id}
                                                type="button"
                                                onClick={() => handleCitySelect(city.name)}
                                                className="w-full text-left px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F5F7FB] border-t border-[#EEF1F7]"
                                            >
                                                {city.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="warehouse-location">
                                {t('superAdminWarehouseLabelLocation')}
                            </label>
                            <input
                                id="warehouse-location"
                                type="text"
                                value={data.location}
                                onChange={(e) => setData('location', e.target.value)}
                                placeholder={t('superAdminWarehousePlaceholderLocation')}
                                className="mt-2 w-full rounded-[999px] border border-[#E3E8F4] bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:border-[#338DFF]"
                            />
                            {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="warehouse-zone">
                                {t('commonSelectZone')}
                            </label>
                            <div className="relative mt-2">
                                <button
                                    type="button"
                                    ref={zoneSelectRef}
                                    onClick={() => setIsZoneMenuOpen(!isZoneMenuOpen)}
                                    className="w-full rounded-[999px] border border-[#E3E8F4] bg-white py-3 px-4 text-sm text-[#111827] flex items-center justify-between focus:border-[#338DFF]"
                                >
                                    {getSelectedZoneName(data.zone_id)}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className="w-4 h-4 text-[#9AA0B4]"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>
                                {isZoneMenuOpen && (
                                    <div
                                        ref={zoneMenuRef}
                                        className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.12)] max-h-60 overflow-auto"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleZoneSelect('')}
                                            className="w-full text-left px-4 py-3 text-sm text-[#6B7280] hover:bg-[#F5F7FB]"
                                        >
                                            {t('commonNone')}
                                        </button>
                                        {filteredCreateZones.map((zone) => (
                                            <button
                                                key={zone.id}
                                                type="button"
                                                onClick={() => handleZoneSelect(zone.id)}
                                                className="w-full text-left px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F5F7FB] border-t border-[#EEF1F7]"
                                            >
                                                {zone.name} ({zone.city})
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {errors.zone_id && <p className="text-red-500 text-xs mt-1">{errors.zone_id}</p>}
                        </div>

                        {data.zone_id && (
                            <div className="rounded-[24px] overflow-hidden border border-[#E3E8F4]">
                                <ZoneMapViewer
                                    zones={coloredZones}
                                    selectedZoneId={data.zone_id}
                                    height={200}
                                />
                            </div>
                        )}

                        {/* Keeper Dropdown (optional) */}
                        <div className="relative">
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="warehouse-keeper">
                                {t('superAdminWarehouseLabelKeeper')}
                            </label>
                            <button
                                ref={keeperSelectRef}
                                type="button"
                                onClick={() => setIsKeeperMenuOpen(!isKeeperMenuOpen)}
                                className="mt-2 w-full rounded-[999px] border border-[#E3E8F4] bg-white py-3 px-4 text-sm text-[#111827] flex items-center justify-between focus:border-[#338DFF]"
                            >
                                {data.keeper_id
                                    ? warehouseUsers.find((u) => u.id === parseInt(data.keeper_id))?.name
                                    : t('superAdminWarehouseSelectKeeper')}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4 text-[#9AA0B4]"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                </svg>
                            </button>
                            {isKeeperMenuOpen && (
                                <div
                                    ref={keeperMenuRef}
                                    className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.12)] max-h-60 overflow-auto"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleKeeperSelect('')}
                                        className="w-full text-left px-4 py-3 text-sm text-[#6B7280] hover:bg-[#F5F7FB]"
                                    >
                                        {t('commonNone')}
                                    </button>
                                    {warehouseUsers.map((user) => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => handleKeeperSelect(user.id)}
                                            className="w-full text-left px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F5F7FB] border-t border-[#EEF1F7]"
                                        >
                                            {user.name}{user.phone_number ? ` (${user.phone_number})` : ''}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {errors.keeper_id && <p className="text-red-500 text-xs mt-1">{errors.keeper_id}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#338DFF]" htmlFor="shelf-input">
                                {t('commonShelfNo')}
                            </label>
                            <div className="mt-2 w-full rounded-[24px] border border-[#E3E8F4] bg-white px-4 py-3 min-h-[48px] flex flex-wrap gap-2 items-center focus-within:border-[#338DFF]">
                                {data.shelves.map((shelf) => (
                                    <span
                                        key={shelf}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#F3F4F6] rounded-full text-sm text-[#111827]"
                                    >
                                        {shelf}
                                        <button
                                            type="button"
                                            onClick={() => removeShelf(shelf)}
                                            className="text-[#6B7280] hover:text-[#111827] ml-1"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <input
                                    id="shelf-input"
                                    type="text"
                                    value={shelfInput}
                                    onChange={(e) => setShelfInput(e.target.value)}
                                    onKeyDown={handleShelfKeyDown}
                                    placeholder={data.shelves.length === 0 ? t('commonShelfPlaceholder') : ''}
                                    className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF]"
                                />
                            </div>
                            {errors.shelves && <p className="text-red-500 text-xs mt-1">{errors.shelves}</p>}
                        </div>

                        <div>
                            <StatusToggle
                                label={t('superAdminWarehouseStatusToggleLabel')}
                                checked={data.status === 'active'}
                                onChange={(isActive) => setData('status', isActive ? 'active' : 'inactive')}
                            />
                            {errors.status && <p className="text-red-500 text-xs mt-1">{errors.status}</p>}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row pt-4 border-t border-[#E3E8F4]">
                        <OutlineButton
                            onClick={closeCreateDrawer}
                            text={t('commonCancel')}
                            className="flex-1"
                        />
                        <PrimaryButton
                            type="submit"
                            text={processing ? t('superAdminWarehouseCreating') : t('superAdminWarehouseButtonCreateWarehouse')}
                            disabled={processing}
                            className="flex-1"
                        />
                    </div>
                </form>
            </Drawer>

            <Drawer
                open={showEditDrawer}
                onClose={closeEditDrawer}
                title={t('superAdminWarehouseEditTitle')}
                description={t('superAdminWarehouseEditDescription')}
                maxWidth="500px"
            >
                <form onSubmit={handleEditSubmit} className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto space-y-5 pb-4 pr-1">
                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="edit-warehouse-name">
                                {t('commonWarehouseName')}
                            </label>
                            <input
                                ref={editNameInputRef}
                                id="edit-warehouse-name"
                                type="text"
                                value={editData.name}
                                onChange={(e) => setEditData('name', e.target.value)}
                                placeholder={t('superAdminWarehousePlaceholderName')}
                                className="mt-2 w-full rounded-[999px] border border-[#E3E8F4] bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:border-[#338DFF]"
                            />
                            {editErrors.name && <p className="text-red-500 text-xs mt-1">{editErrors.name}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="edit-warehouse-city">
                                {t('commonCity')}
                            </label>
                            <div className="relative mt-2">
                                <button
                                    type="button"
                                    ref={editCitySelectRef}
                                    onClick={() => setIsEditCityMenuOpen(!isEditCityMenuOpen)}
                                    className="w-full rounded-[999px] border border-[#E3E8F4] bg-white py-3 px-4 text-sm text-[#111827] flex items-center justify-between focus:border-[#338DFF]"
                                >
                                    {editData.city || t('commonSelectCity')}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className="w-4 h-4 text-[#9AA0B4]"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>
                                {isEditCityMenuOpen && (
                                    <div
                                        ref={editCityMenuRef}
                                        className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.12)] max-h-60 overflow-auto"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleEditCitySelect('')}
                                            className="w-full text-left px-4 py-3 text-sm text-[#6B7280] hover:bg-[#F5F7FB]"
                                        >
                                            {t('commonNone')}
                                        </button>
                                        {cities.map((city) => (
                                            <button
                                                key={city.id}
                                                type="button"
                                                onClick={() => handleEditCitySelect(city.name)}
                                                className="w-full text-left px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F5F7FB] border-t border-[#EEF1F7]"
                                            >
                                                {city.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {editErrors.city && <p className="text-red-500 text-xs mt-1">{editErrors.city}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="edit-warehouse-location">
                                {t('superAdminWarehouseLabelLocation')}
                            </label>
                            <input
                                id="edit-warehouse-location"
                                type="text"
                                value={editData.location}
                                onChange={(e) => setEditData('location', e.target.value)}
                                placeholder={t('superAdminWarehousePlaceholderLocation')}
                                className="mt-2 w-full rounded-[999px] border border-[#E3E8F4] bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:border-[#338DFF]"
                            />
                            {editErrors.location && <p className="text-red-500 text-xs mt-1">{editErrors.location}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="edit-warehouse-zone">
                                {t('commonSelectZone')}
                            </label>
                            <div className="relative mt-2">
                                <button
                                    type="button"
                                    ref={editZoneSelectRef}
                                    onClick={() => setIsEditZoneMenuOpen(!isEditZoneMenuOpen)}
                                    className="w-full rounded-[999px] border border-[#E3E8F4] bg-white py-3 px-4 text-sm text-[#111827] flex items-center justify-between focus:border-[#338DFF]"
                                >
                                    {getSelectedZoneName(editData.zone_id)}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className="w-4 h-4 text-[#9AA0B4]"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>
                                {isEditZoneMenuOpen && (
                                    <div
                                        ref={editZoneMenuRef}
                                        className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.12)] max-h-60 overflow-auto"
                                    >
                                        {!editData.city ? (
                                        <div className="px-4 py-3 text-sm text-[#6B7280]">
                                            {t('commonSelectCityFirst')}
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleEditZoneSelect('')}
                                                className="w-full text-left px-4 py-3 text-sm text-[#6B7280] hover:bg-[#F5F7FB]"
                                            >
                                                {t('commonNone')}
                                            </button>
                                            {filteredEditZones.map((zone) => (
                                                <button
                                                    key={zone.id}
                                                    type="button"
                                                    onClick={() => handleEditZoneSelect(zone.id)}
                                                    className="w-full text-left px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F5F7FB] border-t border-[#EEF1F7]"
                                                >
                                                    {zone.name} ({zone.city})
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    </div>
                                )}
                            </div>
                            {editErrors.zone_id && <p className="text-red-500 text-xs mt-1">{editErrors.zone_id}</p>}
                        </div>

                        {editData.zone_id && (
                            <div className="rounded-[24px] overflow-hidden border border-[#E3E8F4]">
                                <ZoneMapViewer
                                    zones={coloredZones}
                                    selectedZoneId={editData.zone_id}
                                    height={200}
                                />
                            </div>
                        )}

                        {/* Keeper Dropdown (optional) */}
                        <div className="relative">
                            <label className="text-sm font-medium text-[#6B7280]" htmlFor="edit-warehouse-keeper">
                                {t('superAdminWarehouseLabelKeeper')}
                            </label>
                            <button
                                ref={editKeeperSelectRef}
                                type="button"
                                onClick={() => setIsEditKeeperMenuOpen(!isEditKeeperMenuOpen)}
                                className="mt-2 w-full rounded-[999px] border border-[#E3E8F4] bg-white py-3 px-4 text-sm text-[#111827] flex items-center justify-between focus:border-[#338DFF]"
                            >
                                {editData.keeper_id
                                    ? availableWarehouseUsers.find((u) => u.id === parseInt(editData.keeper_id))?.name
                                    : t('superAdminWarehouseSelectKeeper')}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4 text-[#9AA0B4]"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                </svg>
                            </button>
                            {isEditKeeperMenuOpen && (
                                <div
                                    ref={editKeeperMenuRef}
                                    className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.12)] max-h-60 overflow-auto"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleEditKeeperSelect('')}
                                        className="w-full text-left px-4 py-3 text-sm text-[#6B7280] hover:bg-[#F5F7FB]"
                                    >
                                        {t('commonNone')}
                                    </button>
                                    {availableWarehouseUsers.map((user) => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => handleEditKeeperSelect(user.id)}
                                            className="w-full text-left px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F5F7FB] border-t border-[#EEF1F7]"
                                        >
                                            {user.name}{user.phone_number ? ` (${user.phone_number})` : ''}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {editErrors.keeper_id && <p className="text-red-500 text-xs mt-1">{editErrors.keeper_id}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#338DFF]" htmlFor="edit-shelf-input">
                                {t('commonShelfNo')}
                            </label>
                            <div className="mt-2 w-full rounded-[24px] border border-[#E3E8F4] bg-white px-4 py-3 min-h-[48px] flex flex-wrap gap-2 items-center focus-within:border-[#338DFF]">
                                {editData.shelves.map((shelf) => (
                                    <span
                                        key={shelf}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#F3F4F6] rounded-full text-sm text-[#111827]"
                                    >
                                        {shelf}
                                        <button
                                            type="button"
                                            onClick={() => removeEditShelf(shelf)}
                                            className="text-[#6B7280] hover:text-[#111827] ml-1"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <input
                                    id="edit-shelf-input"
                                    type="text"
                                    value={editShelfInput}
                                    onChange={(e) => setEditShelfInput(e.target.value)}
                                    onKeyDown={handleEditShelfKeyDown}
                                    placeholder={editData.shelves.length === 0 ? t('commonShelfPlaceholder') : ''}
                                    className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF]"
                                />
                            </div>
                            {editErrors.shelves && <p className="text-red-500 text-xs mt-1">{editErrors.shelves}</p>}
                        </div>

                        <div>
                            <StatusToggle
                                label={t('superAdminWarehouseStatusToggleLabel')}
                                checked={editData.status === 'active'}
                                onChange={(isActive) => setEditData('status', isActive ? 'active' : 'inactive')}
                            />
                            {editErrors.status && <p className="text-red-500 text-xs mt-1">{editErrors.status}</p>}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row pt-4 border-t border-[#E3E8F4]">
                        <OutlineButton
                            onClick={closeEditDrawer}
                            text={t('commonCancel')}
                            className="flex-1"
                        />
                        <PrimaryButton
                            type="submit"
                            text={updating ? t('commonUpdating') : t('superAdminWarehouseButtonUpdateWarehouse')}
                            disabled={updating}
                            className="flex-1"
                        />
                    </div>
                </form>
            </Drawer>

            <ConfirmDialog
                open={showDeleteDialog}
                onClose={() => {
                    setShowDeleteDialog(false);
                    setWarehouseToDelete(null);
                }}
                onConfirm={handleDelete}
                title={t('superAdminWarehouseDeleteTitle')}
                message={
                    warehouseToDelete
                        ? t('commonDeleteConfirmMessage', { name: warehouseToDelete.name })
                        : t('superAdminWarehouseDeleteFallback')
                }
                confirmText={t('commonDelete')}
                cancelText={t('commonCancel')}
            />
        </SuperAdminAuthenticated>
    );
}
