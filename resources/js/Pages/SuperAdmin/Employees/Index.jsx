import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IMask from 'imask';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import StatsCard from '../Components/StatsCard';
import Table from '../../../Components/Common/Table';
import Card from '../../../Components/Common/Card';
import Menu from '../../../Components/Common/Menu';
import PrimaryButton from '../Components/PrimaryButton';
import OutlineButton from '../Components/OutlineButton';
import Input from '../../../Components/Common/Inputs/Input';
import MapView from '../../../Components/Customer/MapView';
import LocationSearchInput from '../../../Components/Customer/LocationSearchInput';
import Drawer from '../Components/Drawer';
import ConfirmDialog from '../../../Components/SuperAdmin/ConfirmDialog';
import * as XLSX from 'xlsx';
import { reverseGeocode } from '../../../Services/LocationService';
import { GoogleMap, Polygon, useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;
const PHONE_PREFIX = '+';
const PHONE_PREFIX_DIGITS = '';
const PHONE_MASK_PATTERN = '+ 000 000 000 000';
const DEFAULT_ZONE_MAP_CENTER = { lat: 33.5138, lng: 36.2765 };
const SYRIA_BOUNDS = {
    north: 37.31,
    south: 32.31,
    east: 42.45,
    west: 35.73,
};
const MAP_LIBRARIES = ['drawing'];

const extractSubscriberDigits = (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    const withoutPrefix = digits.startsWith(PHONE_PREFIX_DIGITS)
        ? digits.slice(PHONE_PREFIX_DIGITS.length)
        : digits;
    return withoutPrefix.slice(0, 12);
};

const formatPhoneForMask = (value) => {
    const subscriber = extractSubscriberDigits(value);
    if (!subscriber) return `${PHONE_PREFIX} `;
    return `${PHONE_PREFIX} ${subscriber}`;
};

const normalizePaths = (paths) => {
    if (!Array.isArray(paths)) {
        return [];
    }

    return paths
        .map((path) => Array.isArray(path)
            ? path
                .map((point) => {
                    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
                        return null;
                    }

                    return { lat: point.lat, lng: point.lng };
                })
                .filter(Boolean)
            : [])
        .filter((path) => path.length >= 3);
};

const getPolygonCentroid = (paths = []) => {
    const points = paths.flat();
    if (!points.length) {
        return DEFAULT_ZONE_MAP_CENTER;
    }
    const sum = points.reduce(
        (acc, point) => ({
            lat: acc.lat + point.lat,
            lng: acc.lng + point.lng,
        }),
        { lat: 0, lng: 0 },
    );
    return {
        lat: sum.lat / points.length,
        lng: sum.lng / points.length,
    };
};

// Sanitize email to block emojis, icons, and non-ASCII characters
const sanitizeEmailInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
};

const parseCoordinateValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRoleKey = (value) => {
    if (!value) return '';
    return value.toString().trim().toLowerCase().replace(/[-_\s]+/g, '');
};

const isRiderOrDriverRole = (roleName) => {
    const normalized = normalizeRoleKey(roleName);
    return ['rider', 'bikerider', 'cardriver', 'driver'].includes(normalized);
};

const isRiderRole = (roleName) => {
    const normalized = normalizeRoleKey(roleName);
    return ['rider', 'bikerider'].includes(normalized);
};

const getRoleIcon = (roleName) => {
    const normalized = normalizeRoleKey(roleName);
    if (['rider', 'bikerider'].includes(normalized)) return '/assets/images/bike.svg';
    if (['cardriver', 'driver'].includes(normalized)) return '/assets/images/car.svg';
    if (['droppointkeeper', 'dropkeeper'].includes(normalized)) return '/assets/images/droppoint.svg';
    if (['warehousekeeper'].includes(normalized)) return '/assets/images/warehous.svg';
    return null;
};

const resolveAvailabilityLabel = (value, t) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return t('superAdminEmployeesAvailabilityUnknown');
    if (normalized === 'online') return t('commonAvailable');
    if (normalized === 'busy') return t('superAdminEmployeesAvailabilityBusy');
    if (normalized === 'offline') return t('superAdminEmployeesAvailabilityOffline');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const resolveAvailabilityClasses = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'online') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (normalized === 'busy') return 'bg-amber-50 text-amber-700 border border-amber-200';
    if (normalized === 'offline') return 'bg-slate-100 text-slate-600 border border-slate-200';
    return 'bg-slate-50 text-slate-600 border border-slate-200';
};

export default function Index({ employees, statistics, roles, zones, warehouses = [], dropPoints = [] }) {
    const { t } = useTranslation();
    const page = usePage();
    const config = page?.props?.config || {};
    const googleGeocodingApiKey = config?.GOOGLE_MAPS_API_KEY || config?.GOOGLE_PLACES_API_KEY || '';
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY || config?.GOOGLE_PLACES_API_KEY || '';
    const reverseGeocodeProvider = googleGeocodingApiKey ? 'google' : 'openstreetmap';
    const { isLoaded: isZonesMapLoaded } = useJsApiLoader({
        googleMapsApiKey,
        libraries: MAP_LIBRARIES,
    });

    const [showOnboardDrawer, setShowOnboardDrawer] = useState(false);
    const [showProfileDrawer, setShowProfileDrawer] = useState(false);
    const [showEditDrawer, setShowEditDrawer] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isCreateLocating, setIsCreateLocating] = useState(false);
    const [isEditLocating, setIsEditLocating] = useState(false);
    const [createGeoError, setCreateGeoError] = useState('');
    const [editGeoError, setEditGeoError] = useState('');
    const [zoneSearchQuery, setZoneSearchQuery] = useState('');
    const [editZoneSearchQuery, setEditZoneSearchQuery] = useState('');
    // Onboard form dropdown controls
    const employmentTriggerRef = useRef(null);
    const employmentMenuRef = useRef(null);
    const [isEmploymentMenuOpen, setIsEmploymentMenuOpen] = useState(false);
    const roleTriggerRef = useRef(null);
    const roleMenuRef = useRef(null);
    const formRef = useRef(null);
    const phoneInputRef = useRef(null);
    const phoneMaskRef = useRef(null);

    // Edit form dropdown controls
    const editEmploymentTriggerRef = useRef(null);
    const editEmploymentMenuRef = useRef(null);
    const [isEditEmploymentMenuOpen, setIsEditEmploymentMenuOpen] = useState(false);
    const editRoleTriggerRef = useRef(null);
    const editRoleMenuRef = useRef(null);
    const [isEditRoleMenuOpen, setIsEditRoleMenuOpen] = useState(false);
    const editFormRef = useRef(null);
    const editPhoneInputRef = useRef(null);
    const editPhoneMaskRef = useRef(null);

    const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

    // Zone dropdown controls for onboard form
    const zoneTriggerRef = useRef(null);
    const zoneMenuRef = useRef(null);
    const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);

    // Zone dropdown controls for edit form
    const editZoneTriggerRef = useRef(null);
    const editZoneMenuRef = useRef(null);
    const [isEditZoneMenuOpen, setIsEditZoneMenuOpen] = useState(false);

    // Warehouse dropdown controls for onboard form
    const warehouseTriggerRef = useRef(null);
    const warehouseMenuRef = useRef(null);
    const [isWarehouseMenuOpen, setIsWarehouseMenuOpen] = useState(false);

    // Warehouse dropdown controls for edit form
    const editWarehouseTriggerRef = useRef(null);
    const editWarehouseMenuRef = useRef(null);
    const [isEditWarehouseMenuOpen, setIsEditWarehouseMenuOpen] = useState(false);

    // Drop point dropdown controls for onboard form
    const dropPointTriggerRef = useRef(null);
    const dropPointMenuRef = useRef(null);
    const [isDropPointMenuOpen, setIsDropPointMenuOpen] = useState(false);

    // Drop point dropdown controls for edit form
    const editDropPointTriggerRef = useRef(null);
    const editDropPointMenuRef = useRef(null);
    const [isEditDropPointMenuOpen, setIsEditDropPointMenuOpen] = useState(false);

    useEffect(() => {
        if (!isRoleMenuOpen) return;
        const id = window.setTimeout(() => {
            roleMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isRoleMenuOpen]);

    useEffect(() => {
        if (!isZoneMenuOpen) return;
        const id = window.setTimeout(() => {
            zoneMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isZoneMenuOpen]);

    useEffect(() => {
        if (!isEditRoleMenuOpen) return;
        const id = window.setTimeout(() => {
            editRoleMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isEditRoleMenuOpen]);

    useEffect(() => {
        if (!isEditZoneMenuOpen) return;
        const id = window.setTimeout(() => {
            editZoneMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isEditZoneMenuOpen]);

    useEffect(() => {
        if (!isWarehouseMenuOpen) return;
        const id = window.setTimeout(() => {
            warehouseMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isWarehouseMenuOpen]);

    useEffect(() => {
        if (!isEditWarehouseMenuOpen) return;
        const id = window.setTimeout(() => {
            editWarehouseMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isEditWarehouseMenuOpen]);

    useEffect(() => {
        if (!isDropPointMenuOpen) return;
        const id = window.setTimeout(() => {
            dropPointMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isDropPointMenuOpen]);

    useEffect(() => {
        if (!isEditDropPointMenuOpen) return;
        const id = window.setTimeout(() => {
            editDropPointMenuRef.current?.scrollIntoView({ block: 'nearest' });
        }, 0);
        return () => window.clearTimeout(id);
    }, [isEditDropPointMenuOpen]);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        name: '',
        email: '',
        phone_number: '',
        emergency_phone_number: '',
        blood_type: '',
        employment_type: '',
        platform: 'Admin Portal',
        role: '',
        zone_ids: [],
        warehouse_id: '',
        drop_point_id: '',
        delivery_speed_mode: 'both',
        cod_collection_limit: '',
        address: '',
        latitude: '',
        longitude: '',
    });

    const { data: editData, setData: setEditData, put, processing: updating, errors: editErrors, clearErrors: clearEditErrors } = useForm({
        name: '',
        email: '',
        phone_number: '',
        emergency_phone_number: '',
        blood_type: '',
        employment_type: '',
        platform: 'Admin Portal',
        role: '',
        zone_ids: [],
        warehouse_id: '',
        drop_point_id: '',
        delivery_speed_mode: 'both',
        cod_collection_limit: '',
        address: '',
        latitude: '',
        longitude: '',
    });

    const onboardInitialFocusRef = useRef(null);
    const profileCloseButtonRef = useRef(null);

    useEffect(() => {
        if (!showOnboardDrawer) {
            if (phoneMaskRef.current) {
                phoneMaskRef.current.destroy();
                phoneMaskRef.current = null;
            }
            return;
        }

        const input = phoneInputRef.current;
        if (!input) {
            return;
        }

        if (!phoneMaskRef.current) {
            const mask = IMask(input, {
                mask: PHONE_MASK_PATTERN,
                lazy: true,
                overwrite: true,
            });

            mask.on('accept', () => {
                const subscriberDigits = extractSubscriberDigits(mask.value);
                const nextValue = subscriberDigits ? `${PHONE_PREFIX} ${subscriberDigits}` : '';
                setData('phone_number', nextValue);
                clearErrors('phone_number');
            });

            phoneMaskRef.current = mask;
        }

        const target = formatPhoneForMask(data.phone_number);
        if (phoneMaskRef.current.value !== target) {
            phoneMaskRef.current.value = target;
        }
    }, [showOnboardDrawer, data.phone_number, setData, clearErrors]);

    useEffect(
        () => () => {
            if (phoneMaskRef.current) {
                phoneMaskRef.current.destroy();
                phoneMaskRef.current = null;
            }
        },
        []
    );

    // Edit form phone mask
    useEffect(() => {
        if (!showEditDrawer) {
            if (editPhoneMaskRef.current) {
                editPhoneMaskRef.current.destroy();
                editPhoneMaskRef.current = null;
            }
            return;
        }

        const input = editPhoneInputRef.current;
        if (!input) {
            return;
        }

        if (!editPhoneMaskRef.current) {
            const mask = IMask(input, {
                mask: PHONE_MASK_PATTERN,
                lazy: true,
                overwrite: true,
            });

            mask.on('accept', () => {
                const subscriberDigits = extractSubscriberDigits(mask.value);
                const nextValue = subscriberDigits ? `${PHONE_PREFIX} ${subscriberDigits}` : '';
                setEditData('phone_number', nextValue);
                clearEditErrors('phone_number');
            });

            editPhoneMaskRef.current = mask;
        }

        const target = formatPhoneForMask(editData.phone_number);
        if (editPhoneMaskRef.current.value !== target) {
            editPhoneMaskRef.current.value = target;
        }
    }, [showEditDrawer, editData.phone_number, setEditData, clearEditErrors]);

    useEffect(
        () => () => {
            if (editPhoneMaskRef.current) {
                editPhoneMaskRef.current.destroy();
                editPhoneMaskRef.current = null;
            }
        },
        []
    );

    const openOnboardDrawer = useCallback(() => {
        clearErrors();
        setShowOnboardDrawer(true);
    }, [clearErrors]);

    const closeOnboardDrawer = useCallback(() => {
        clearErrors();
        setIsEmploymentMenuOpen(false);
        setIsRoleMenuOpen(false);
        setIsZoneMenuOpen(false);
        setIsWarehouseMenuOpen(false);
        setIsDropPointMenuOpen(false);
        setZoneSearchQuery('');
        setCreateGeoError('');
        setIsCreateLocating(false);
        setShowOnboardDrawer(false);
    }, [clearErrors]);

    // Helper function to check if a role is a mobile role (rider, car driver, drop point keeper)
    const isMobileRole = useCallback((roleName) => {
        if (!roleName) return false;
        const normalized = roleName.toString().trim().toLowerCase().replace(/[-_\s]+/g, '');
        const mobileRoles = [
            'rider',
            'bikerider',
            'cardriver',
            'driver',
            'droppointkeeper',
            'dropkeeper'
        ];
        return mobileRoles.includes(normalized);
    }, []);

    // Helper function to check if a role is a warehouse keeper
    const isWarehouseKeeperRole = useCallback((roleName) => {
        if (!roleName) return false;
        const normalized = roleName.toString().trim().toLowerCase().replace(/[-_\s]+/g, '');
        return normalized === 'warehousekeeper';
    }, []);

    const isDropPointKeeperRole = useCallback((roleName) => {
        if (!roleName) return false;
        const normalized = roleName.toString().trim().toLowerCase().replace(/[-_\s]+/g, '');
        return normalized === 'droppointkeeper' || normalized === 'dropkeeper';
    }, []);

    const canUseGeolocation = typeof navigator !== 'undefined' && !!navigator.geolocation;

    const resolveRolesForPlatform = useCallback(
        (platformValue) => {
            if (!Array.isArray(roles)) {
                return [];
            }

            return roles.filter((role) => {
                if (!role || typeof role !== 'object') {
                    return false;
                }

                if (!role.platform) {
                    return true;
                }

                if (!platformValue) {
                    return true;
                }

                // Check if platform contains "Mobile" or matches exactly
                if (platformValue.includes('Mobile')) {
                    return role.platform.includes('Mobile');
                }

                return role.platform === platformValue;
            });
        },
        [roles]
    );

    const filteredRoles = useMemo(
        () => resolveRolesForPlatform(data.platform),
        [resolveRolesForPlatform, data.platform]
    );

    const filteredEditRoles = useMemo(
        () => resolveRolesForPlatform(editData.platform),
        [resolveRolesForPlatform, editData.platform]
    );

    const createLatitude = useMemo(() => parseCoordinateValue(data.latitude), [data.latitude]);
    const createLongitude = useMemo(() => parseCoordinateValue(data.longitude), [data.longitude]);
    const shouldShowCreateMap =
        data.platform === 'Mobile Application'
        && createLatitude !== null
        && createLongitude !== null;

    const editLatitude = useMemo(() => parseCoordinateValue(editData.latitude), [editData.latitude]);
    const editLongitude = useMemo(() => parseCoordinateValue(editData.longitude), [editData.longitude]);
    const shouldShowEditMap =
        editData.platform === 'Mobile Application'
        && editLatitude !== null
        && editLongitude !== null;

    const handleCreateLocationFromMap = useCallback(
        (location) => {
            if (!location) {
                return;
            }
            const latValue = location.lat ?? location.latitude ?? '';
            const lonValue = location.lon ?? location.longitude ?? '';
            setData('address', location.address ?? '');
            setData('latitude', latValue);
            setData('longitude', lonValue);
            clearErrors('address');
            clearErrors('latitude');
            clearErrors('longitude');
        },
        [setData, clearErrors]
    );

    const handleEditLocationFromMap = useCallback(
        (location) => {
            if (!location) {
                return;
            }
            const latValue = location.lat ?? location.latitude ?? '';
            const lonValue = location.lon ?? location.longitude ?? '';
            setEditData('address', location.address ?? '');
            setEditData('latitude', latValue);
            setEditData('longitude', lonValue);
            clearEditErrors('address');
            clearEditErrors('latitude');
            clearEditErrors('longitude');
        },
        [setEditData, clearEditErrors]
    );

    const getCurrentPosition = useCallback(() => new Promise((resolve, reject) => {
        if (!navigator?.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => reject(error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }), []);

    const handleUseCurrentLocationForCreate = useCallback(async () => {
        setCreateGeoError('');
        setIsCreateLocating(true);

        try {
            const position = await getCurrentPosition();
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            let address = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

            try {
                const result = await reverseGeocode(lat, lon, {
                    provider: reverseGeocodeProvider,
                    googleGeocodingApiKey,
                });
                address = result?.address || address;
            } catch (error) {
                setCreateGeoError('Unable to resolve address from GPS.');
            }

            setData('address', address);
            setData('latitude', lat);
            setData('longitude', lon);
            clearErrors('address');
            clearErrors('latitude');
            clearErrors('longitude');
        } catch (error) {
            setCreateGeoError('Location permission denied or unavailable.');
        } finally {
            setIsCreateLocating(false);
        }
    }, [clearErrors, getCurrentPosition, googleGeocodingApiKey, reverseGeocodeProvider, setData]);

    const handleUseCurrentLocationForEdit = useCallback(async () => {
        setEditGeoError('');
        setIsEditLocating(true);

        try {
            const position = await getCurrentPosition();
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            let address = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

            try {
                const result = await reverseGeocode(lat, lon, {
                    provider: reverseGeocodeProvider,
                    googleGeocodingApiKey,
                });
                address = result?.address || address;
            } catch (error) {
                setEditGeoError('Unable to resolve address from GPS.');
            }

            setEditData('address', address);
            setEditData('latitude', lat);
            setEditData('longitude', lon);
            clearEditErrors('address');
            clearEditErrors('latitude');
            clearEditErrors('longitude');
        } catch (error) {
            setEditGeoError('Location permission denied or unavailable.');
        } finally {
            setIsEditLocating(false);
        }
    }, [clearEditErrors, getCurrentPosition, googleGeocodingApiKey, reverseGeocodeProvider, setEditData]);

    useEffect(() => {
        if (!data.role) {
            return;
        }

        if (!filteredRoles.some((role) => role?.name === data.role)) {
            setData((prev) => ({
                ...prev,
                role: '',
            }));
        }
    }, [filteredRoles, data.role, setData]);

    useEffect(() => {
        if (!editData.role) {
            return;
        }

        if (!filteredEditRoles.some((role) => role?.name === editData.role)) {
            setEditData((prev) => ({
                ...prev,
                role: '',
            }));
        }
    }, [filteredEditRoles, editData.role, setEditData]);

    const handleFieldChange = (field, value) => {
        if (field === 'platform') {
            setData((previous) => {
                const platformRoles = resolveRolesForPlatform(value);
                const isRoleCompatible = platformRoles.some((role) => role?.name === previous.role);

                return {
                    ...previous,
                    platform: value,
                    role: isRoleCompatible ? previous.role : '',
                };
            });

            if (errors.role) {
                clearErrors('role');
            }

            setIsRoleMenuOpen(false);
        } else if (field === 'email') {
            setData(field, sanitizeEmailInput(value));
        } else {
            setData(field, value);
        }

        if (errors[field]) {
            clearErrors(field);
        }
    };

    const handleOnboardSubmit = (e) => {
        e.preventDefault();
        clearErrors();
        post(route('admin.employees.store'), {
            // Normalize platform for backend: store 'Mobile App' when radio is 'Mobile Application'
            transform: (payload) => {
                const normalizedLatitude = parseCoordinateValue(payload.latitude);
                const normalizedLongitude = parseCoordinateValue(payload.longitude);
                const normalizedZoneIds = normalizeZoneIds(payload.zone_ids)
                    .map((zoneId) => parseInt(zoneId, 10))
                    .filter((zoneId) => Number.isFinite(zoneId));

                return {
                    ...payload,
                    platform: payload.platform === 'Mobile Application' ? 'Mobile App' : payload.platform,
                    emergency_phone_number: payload.emergency_phone_number ? payload.emergency_phone_number.replace(/\s/g, '') : '',
                    latitude: normalizedLatitude,
                    longitude: normalizedLongitude,
                    zone_ids: normalizedZoneIds,
                    zone_id: normalizedZoneIds[0] ?? null,
                };
            },
            onSuccess: () => {
                closeOnboardDrawer();
                reset();
            },
        });
    };

    const handleViewProfile = (employee) => {
        setSelectedEmployee(employee);
        setShowProfileDrawer(true);
    };

    const openEditDrawer = () => {
        if (!selectedEmployee) return;

        // Determine platform based on role's platform or employee's platform
        let platformValue = selectedEmployee.platform || 'Admin Portal';

        // If employee has a role, use the role's platform
        if (selectedEmployee.roles?.[0]?.platform) {
            const rolePlatform = selectedEmployee.roles[0].platform;
            // Map "Mobile App" to "Mobile Application" for frontend
            platformValue = rolePlatform === 'Mobile App' ? 'Mobile Application' : rolePlatform;
        }

        const selectedZoneIds = Array.isArray(selectedEmployee.zone_ids)
            ? selectedEmployee.zone_ids
            : (selectedEmployee.zone_id ? [selectedEmployee.zone_id] : []);

        setEditData({
            name: selectedEmployee.name || '',
            email: selectedEmployee.email || '',
            phone_number: selectedEmployee.phone_number || '',
            emergency_phone_number: selectedEmployee.emergency_phone_number || '',
            blood_type: selectedEmployee.blood_type || '',
            employment_type: selectedEmployee.employment_type || '',
            platform: platformValue,
            role: selectedEmployee.roles?.[0]?.name || '',
            zone_ids: selectedZoneIds,
            warehouse_id: selectedEmployee.warehouse_id || '',
            drop_point_id: selectedEmployee.drop_point_id || '',
            delivery_speed_mode: selectedEmployee.delivery_speed_mode || '',
            cod_collection_limit: selectedEmployee.cod_collection_limit || '',
            address: selectedEmployee.address || '',
            latitude: selectedEmployee.latitude || '',
            longitude: selectedEmployee.longitude || '',
        });
        setEditZoneSearchQuery('');
        setEditGeoError('');
        clearEditErrors();
        setShowEditDrawer(true);
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        clearEditErrors();

        put(route('admin.employees.update', selectedEmployee.id), {
            preserveScroll: true,
            transform: (data) => {
                const normalizedLatitude = parseCoordinateValue(data.latitude);
                const normalizedLongitude = parseCoordinateValue(data.longitude);
                const normalizedZoneIds = normalizeZoneIds(data.zone_ids)
                    .map((zoneId) => parseInt(zoneId, 10))
                    .filter((zoneId) => Number.isFinite(zoneId));

                return {
                    ...data,
                    // Normalize platform to 'Mobile App' for backend when radio is 'Mobile Application'
                    platform: data.platform === 'Mobile Application' ? 'Mobile App' : data.platform,
                    // Remove spaces from phone number before submission
                    phone_number: data.phone_number ? data.phone_number.replace(/\s/g, '') : '',
                    emergency_phone_number: data.emergency_phone_number ? data.emergency_phone_number.replace(/\s/g, '') : '',
                    latitude: normalizedLatitude,
                    longitude: normalizedLongitude,
                    zone_ids: normalizedZoneIds,
                    zone_id: normalizedZoneIds[0] ?? null,
                };
            },
            onSuccess: () => {
                closeEditDrawer();
                setShowProfileDrawer(false);
            },
        });
    };

    const closeEditDrawer = useCallback(() => {
        setShowEditDrawer(false);
        setIsEditEmploymentMenuOpen(false);
        setIsEditRoleMenuOpen(false);
        setIsEditZoneMenuOpen(false);
        setIsEditWarehouseMenuOpen(false);
        setIsEditDropPointMenuOpen(false);
        setEditZoneSearchQuery('');
        setEditGeoError('');
        setIsEditLocating(false);
    }, []);

    const handleEditFieldChange = (field, value) => {
        if (field === 'platform') {
            setEditData((previous) => {
                const platformRoles = resolveRolesForPlatform(value);
                const isRoleCompatible = platformRoles.some((role) => role?.name === previous.role);

                return {
                    ...previous,
                    platform: value,
                    role: isRoleCompatible ? previous.role : '',
                };
            });

            if (editErrors.role) {
                clearEditErrors('role');
            }

            setIsEditRoleMenuOpen(false);
        } else if (field === 'email') {
            setEditData(field, sanitizeEmailInput(value));
        } else {
            setEditData(field, value);
        }

        if (editErrors[field]) {
            clearEditErrors(field);
        }
    };

    const handleDeactivate = () => {
        if (!selectedEmployee) return;
        setShowDeactivateDialog(true);
    };

    const confirmDeactivate = () => {
        if (!selectedEmployee) return;

        const newStatus = selectedEmployee.status === 'active' ? 'inactive' : 'active';

        setIsDeactivating(true);
        router.patch(route('admin.employees.status', selectedEmployee.id), {
            status: newStatus,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setShowDeactivateDialog(false);
                setIsDeactivating(false);
                closeProfileDrawer();
            },
            onError: () => {
                setIsDeactivating(false);
            },
        });
    };

    const getDeactivateDialogProps = () => {
        if (!selectedEmployee) return {};

        const isActive = selectedEmployee.status === 'active';

        return {
            title: isActive ? t('superAdminEmployeesDeactivateEmployee') : t('superAdminEmployeesActivateEmployee'),
            message: isActive
                ? t('superAdminEmployeesDeactivateMessage', { name: selectedEmployee.name })
                : t('superAdminEmployeesActivateMessage', { name: selectedEmployee.name }),
            confirmText: isActive ? t('superAdminEmployeesDeactivate') : t('superAdminEmployeesActivate'),
            confirmButtonClass: isActive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white',
        };
    };

    const closeProfileDrawer = useCallback(() => {
        setShowProfileDrawer(false);
    }, []);

    const handleProfileDrawerAfterClose = useCallback(() => {
        setSelectedEmployee(null);
    }, []);

    // Close employment/role menus on outside click and ESC
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isEmploymentMenuOpen) {
                if (
                    employmentMenuRef.current?.contains(event.target)
                    || employmentTriggerRef.current?.contains(event.target)
                ) {
                    // inside employment menu
                } else {
                    setIsEmploymentMenuOpen(false);
                }
            }
            if (isRoleMenuOpen) {
                if (
                    roleMenuRef.current?.contains(event.target)
                    || roleTriggerRef.current?.contains(event.target)
                ) {
                    // inside role menu
                } else {
                    setIsRoleMenuOpen(false);
                }
            }
            if (isEditEmploymentMenuOpen) {
                if (
                    editEmploymentMenuRef.current?.contains(event.target)
                    || editEmploymentTriggerRef.current?.contains(event.target)
                ) {
                    // inside edit employment menu
                } else {
                    setIsEditEmploymentMenuOpen(false);
                }
            }
            if (isEditRoleMenuOpen) {
                if (
                    editRoleMenuRef.current?.contains(event.target)
                    || editRoleTriggerRef.current?.contains(event.target)
                ) {
                    // inside edit role menu
                } else {
                    setIsEditRoleMenuOpen(false);
                }
            }
            if (isZoneMenuOpen) {
                if (
                    zoneMenuRef.current?.contains(event.target)
                    || zoneTriggerRef.current?.contains(event.target)
                ) {
                    // inside zone menu
                } else {
                    setIsZoneMenuOpen(false);
                }
            }
            if (isEditZoneMenuOpen) {
                if (
                    editZoneMenuRef.current?.contains(event.target)
                    || editZoneTriggerRef.current?.contains(event.target)
                ) {
                    // inside edit zone menu
                } else {
                    setIsEditZoneMenuOpen(false);
                }
            }
            if (isWarehouseMenuOpen) {
                if (
                    warehouseMenuRef.current?.contains(event.target)
                    || warehouseTriggerRef.current?.contains(event.target)
                ) {
                    // inside warehouse menu
                } else {
                    setIsWarehouseMenuOpen(false);
                }
            }
            if (isEditWarehouseMenuOpen) {
                if (
                    editWarehouseMenuRef.current?.contains(event.target)
                    || editWarehouseTriggerRef.current?.contains(event.target)
                ) {
                    // inside edit warehouse menu
                } else {
                    setIsEditWarehouseMenuOpen(false);
                }
            }
            if (isDropPointMenuOpen) {
                if (
                    dropPointMenuRef.current?.contains(event.target)
                    || dropPointTriggerRef.current?.contains(event.target)
                ) {
                    // inside drop point menu
                } else {
                    setIsDropPointMenuOpen(false);
                }
            }
            if (isEditDropPointMenuOpen) {
                if (
                    editDropPointMenuRef.current?.contains(event.target)
                    || editDropPointTriggerRef.current?.contains(event.target)
                ) {
                    // inside edit drop point menu
                } else {
                    setIsEditDropPointMenuOpen(false);
                }
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsEmploymentMenuOpen(false);
                setIsRoleMenuOpen(false);
                setIsEditEmploymentMenuOpen(false);
                setIsEditRoleMenuOpen(false);
                setIsZoneMenuOpen(false);
                setIsEditZoneMenuOpen(false);
                setIsWarehouseMenuOpen(false);
                setIsEditWarehouseMenuOpen(false);
                setIsDropPointMenuOpen(false);
                setIsEditDropPointMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        isEmploymentMenuOpen,
        isRoleMenuOpen,
        isEditEmploymentMenuOpen,
        isEditRoleMenuOpen,
        isZoneMenuOpen,
        isEditZoneMenuOpen,
        isWarehouseMenuOpen,
        isEditWarehouseMenuOpen,
        isDropPointMenuOpen,
        isEditDropPointMenuOpen,
    ]);

    const tableData = useMemo(() => (Array.isArray(employees) ? employees : []), [employees]);
    const zoneLookup = useMemo(() => new Map((zones || []).map((zone) => [String(zone.id), zone.name])), [zones]);
    const warehouseLookup = useMemo(() => new Map((warehouses || []).map((warehouse) => [String(warehouse.id), warehouse.name])), [warehouses]);
    const dropPointLookup = useMemo(
        () => new Map((dropPoints || []).map((dropPoint) => [String(dropPoint.id), dropPoint.name])),
        [dropPoints],
    );

    const getWarehouseName = useCallback((warehouseId, placeholder = 'Select Warehouse') => {
        if (!warehouseId) return placeholder;
        return warehouseLookup.get(String(warehouseId)) || placeholder;
    }, [warehouseLookup]);

    const getDropPointName = useCallback((dropPointId, placeholder = 'Select Drop Point') => {
        if (!dropPointId) return placeholder;
        return dropPointLookup.get(String(dropPointId)) || placeholder;
    }, [dropPointLookup]);

    const normalizeZoneIds = useCallback((value) => {
        if (Array.isArray(value)) {
            return value.map((zoneId) => String(zoneId)).filter(Boolean);
        }
        if (value === null || value === undefined || value === '') {
            return [];
        }
        return [String(value)];
    }, []);

    const allZoneKeys = useMemo(() => (zones || []).map((zone) => String(zone.id)), [zones]);
    const createSelectedZoneKeys = useMemo(() => normalizeZoneIds(data.zone_ids), [normalizeZoneIds, data.zone_ids]);
    const editSelectedZoneKeys = useMemo(() => normalizeZoneIds(editData.zone_ids), [normalizeZoneIds, editData.zone_ids]);
    const isAllCreateZonesSelected = allZoneKeys.length > 0 && createSelectedZoneKeys.length === allZoneKeys.length;
    const isAllEditZonesSelected = allZoneKeys.length > 0 && editSelectedZoneKeys.length === allZoneKeys.length;

    const filteredZones = useMemo(() => {
        const query = zoneSearchQuery.trim().toLowerCase();
        if (!query) return zones || [];
        return (zones || []).filter((zone) =>
            `${zone.name ?? ''} ${zone.code ?? ''}`.toLowerCase().includes(query)
        );
    }, [zones, zoneSearchQuery]);

    const filteredEditZones = useMemo(() => {
        const query = editZoneSearchQuery.trim().toLowerCase();
        if (!query) return zones || [];
        return (zones || []).filter((zone) =>
            `${zone.name ?? ''} ${zone.code ?? ''}`.toLowerCase().includes(query)
        );
    }, [zones, editZoneSearchQuery]);

    const formatZoneSelection = useCallback((selectedIds, placeholder = t('superAdminEmployeesSelectZonesOptional')) => {
        if (!selectedIds || selectedIds.length === 0) {
            return placeholder;
        }

        const names = selectedIds
            .map((zoneId) => zoneLookup.get(String(zoneId)) || t('superAdminEmployeesZoneNumber', { id: zoneId }))
            .filter(Boolean);

        if (names.length <= 2) {
            return names.join(', ');
        }

        return `${names.slice(0, 2).join(', ')} +${names.length - 2} ${t('superAdminEmployeesMore')}`;
    }, [t, zoneLookup]);

    const formatZoneNames = useCallback((selectedIds) => {
        if (!selectedIds || selectedIds.length === 0) {
            return '';
        }

        return selectedIds
            .map((zoneId) => zoneLookup.get(String(zoneId)) || t('superAdminEmployeesZoneNumber', { id: zoneId }))
            .filter(Boolean)
            .join(', ');
    }, [t, zoneLookup]);

    const toggleCreateZoneSelection = useCallback((zoneId) => {
        const zoneKey = String(zoneId);
        const current = normalizeZoneIds(data.zone_ids);
        const next = current.includes(zoneKey)
            ? current.filter((id) => id !== zoneKey)
            : [...current, zoneKey];

        setData('zone_ids', next);
        if (errors.zone_ids) {
            clearErrors('zone_ids');
        }
    }, [normalizeZoneIds, data.zone_ids, setData, errors.zone_ids, clearErrors]);

    const clearCreateZoneSelection = useCallback(() => {
        setData('zone_ids', []);
        if (errors.zone_ids) {
            clearErrors('zone_ids');
        }
    }, [setData, errors.zone_ids, clearErrors]);

    const toggleSelectAllCreateZones = useCallback(() => {
        if (isAllCreateZonesSelected) {
            clearCreateZoneSelection();
            return;
        }

        setData('zone_ids', allZoneKeys);
        if (errors.zone_ids) {
            clearErrors('zone_ids');
        }
    }, [allZoneKeys, clearCreateZoneSelection, errors.zone_ids, clearErrors, isAllCreateZonesSelected, setData]);

    const toggleEditZoneSelection = useCallback((zoneId) => {
        const zoneKey = String(zoneId);
        const current = normalizeZoneIds(editData.zone_ids);
        const next = current.includes(zoneKey)
            ? current.filter((id) => id !== zoneKey)
            : [...current, zoneKey];

        setEditData('zone_ids', next);
        if (editErrors.zone_ids) {
            clearEditErrors('zone_ids');
        }
    }, [normalizeZoneIds, editData.zone_ids, setEditData, editErrors.zone_ids, clearEditErrors]);

    const clearEditZoneSelection = useCallback(() => {
        setEditData('zone_ids', []);
        if (editErrors.zone_ids) {
            clearEditErrors('zone_ids');
        }
    }, [setEditData, editErrors.zone_ids, clearEditErrors]);

    const toggleSelectAllEditZones = useCallback(() => {
        if (isAllEditZonesSelected) {
            clearEditZoneSelection();
            return;
        }

        setEditData('zone_ids', allZoneKeys);
        if (editErrors.zone_ids) {
            clearEditErrors('zone_ids');
        }
    }, [allZoneKeys, clearEditZoneSelection, editErrors.zone_ids, clearEditErrors, isAllEditZonesSelected, setEditData]);

    const zonesById = useMemo(() => {
        const list = Array.isArray(zones) ? zones : [];
        return new Map(list.map((zone) => [String(zone.id), zone]));
    }, [zones]);

    const getAssignedZonePolygons = useCallback((selectedZoneIds) => {
        return normalizeZoneIds(selectedZoneIds)
            .map((zoneId) => zonesById.get(String(zoneId)))
            .filter(Boolean)
            .map((zone) => {
                const paths = normalizePaths(zone?.drawn_paths);
                if (!paths.length) {
                    return null;
                }
                return {
                    id: zone.id,
                    name: zone.name,
                    paths,
                    centroid: getPolygonCentroid(paths),
                };
            })
            .filter(Boolean);
    }, [normalizeZoneIds, zonesById]);

    const createAssignedZonePolygons = useMemo(
        () => getAssignedZonePolygons(data.zone_ids),
        [data.zone_ids, getAssignedZonePolygons],
    );
    const editAssignedZonePolygons = useMemo(
        () => getAssignedZonePolygons(editData.zone_ids),
        [editData.zone_ids, getAssignedZonePolygons],
    );

    const getZoneMapCenter = (polygons) => {
        if (polygons.length > 0) {
            return polygons[0].centroid;
        }
        return DEFAULT_ZONE_MAP_CENTER;
    };

    const zoneMapOptions = useMemo(() => ({
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        zoomControl: true,
        minZoom: 7,
        restriction: {
            latLngBounds: SYRIA_BOUNDS,
            strictBounds: true,
        },
    }), []);

    // Compute stats from employees list to handle role naming variants
    const statsCards = useMemo(() => {
        const normalize = (s) => (s || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ');

        const hasAnyRole = (emp, names) => {
            const targets = names.map(normalize);
            const empRoles = Array.isArray(emp?.roles) ? emp.roles : [];
            return empRoles.some((r) => targets.includes(normalize(r?.name)));
        };

        let riders = 0;
        let carDrivers = 0;
        let dropKeepers = 0;
        let warehouseKeepers = 0;

        (tableData || []).forEach((emp) => {
            if (hasAnyRole(emp, ['rider', 'bike rider'])) riders += 1;
            if (hasAnyRole(emp, ['car driver', 'driver', 'car-driver'])) carDrivers += 1;
            if (hasAnyRole(emp, ['drop point keeper', 'drop-point keeper', 'drop keeper'])) dropKeepers += 1;
            if (hasAnyRole(emp, ['warehouse keeper', 'warehouse-keeper'])) warehouseKeepers += 1;
        });

        return [
            {
                title: t('superAdminEmployeesStatBikeRiders'),
                value: riders,
                iconSrc: '/assets/images/bike.svg',
                accentColor: '#338dff',
                isSpecialCard: true,
            },
            {
                title: t('superAdminEmployeesStatCarDrivers'),
                value: carDrivers,
                iconSrc: '/assets/images/car.svg',
                accentColor: '#338dff',
            },
            {
                title: t('commonDropPointKeepers'),
                value: dropKeepers,
                iconSrc: '/assets/images/droppoint.svg',
                accentColor: '#338dff',
            },
            {
                title: t('superAdminEmployeesStatWarehouseKeepers'),
                value: warehouseKeepers,
                iconSrc: '/assets/images/warehous.svg',
                accentColor: '#338dff',
            },
        ];
    }, [t, tableData]);

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [sortBy, setSortBy] = useState('Newest First');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const sortTriggerRef = useRef(null);
    const sortMenuRef = useRef(null);
    const exportTriggerRef = useRef(null);
    const exportMenuRef = useRef(null);

    const roleOptions = useMemo(() => {
        const availableRoles = Array.isArray(roles) ? roles : [];
        return [
            { label: t('commonAllRoles'), value: 'all' },
            ...availableRoles.map((role) => ({
                label: role.name,
                value: role.name,
            })),
        ];
    }, [roles, t]);

    const sortOptions = useMemo(
        () => [
            { label: t('commonNewestFirst'), value: 'Newest First' },
            { label: t('commonName'), value: 'Name' },
            { label: t('commonRole'), value: 'Role' },
            { label: t('commonEmploymentType'), value: 'Employment Type' },
            { label: t('commonStatus'), value: 'Status' },
        ],
        [t],
    );

    const deliverySpeedOptions = useMemo(() => ([
        { label: t('superAdminEmployeesDeliveryModeBoth'), value: 'both' },
        { label: t('superAdminEmployeesDeliveryModeDirect'), value: 'direct' },
        { label: t('superAdminEmployeesDeliveryModeIndirect'), value: 'indirect' },
    ]), [t]);
    const exportMenuItems = useMemo(() => ([
        { label: t('commonExportCsv'), value: 'csv' },
        { label: t('commonExportExcel'), value: 'excel' },
    ]), [t]);

    const filteredEmployees = useMemo(() => {
        const normalize = (value) => (value ?? '').toString().toLowerCase();
        const normalizedSearch = searchQuery.trim().toLowerCase();

        let result = tableData;

        if (normalizedSearch) {
            result = result.filter((employee) => {
                const searchableFields = [
                    employee.employee_id,
                    employee.name,
                    employee.email,
                    employee.phone_number,
                    employee.employment_type,
                    employee.platform,
                    employee.status,
                    employee.roles?.[0]?.name,
                ];

                return searchableFields
                    .filter(Boolean)
                    .some((field) => normalize(field).includes(normalizedSearch));
            });
        }

        if (roleFilter !== 'all') {
            result = result.filter((employee) =>
                employee.roles?.some((role) => normalize(role.name) === normalize(roleFilter)),
            );
        }

        const comparators = {
            'Newest First': (a, b) => new Date(b.created_at) - new Date(a.created_at),
            Name: (a, b) => normalize(a.name).localeCompare(normalize(b.name)),
            Role: (a, b) =>
                normalize(a.roles?.[0]?.name).localeCompare(normalize(b.roles?.[0]?.name)),
            'Employment Type': (a, b) =>
                normalize(a.employment_type).localeCompare(normalize(b.employment_type)),
            Status: (a, b) => normalize(a.status).localeCompare(normalize(b.status)),
        };

        const comparator = comparators[sortBy] ?? comparators['Newest First'];

        return [...result].sort((a, b) => comparator(a, b));
    }, [tableData, searchQuery, roleFilter, sortBy]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE)),
        [filteredEmployees.length],
    );

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

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

    const paginatedEmployees = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredEmployees.slice(start, start + PAGE_SIZE);
    }, [filteredEmployees, currentPage]);

    const paginationMeta = useMemo(() => {
        if (filteredEmployees.length === 0) {
            return { from: 0, to: 0, total: 0 };
        }
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = Math.min(start + paginatedEmployees.length, filteredEmployees.length);
        return {
            from: start + 1,
            to: end,
            total: filteredEmployees.length,
        };
    }, [filteredEmployees.length, currentPage, paginatedEmployees.length]);

    const tableColumns = useMemo(() => [
        {
            key: 'employee_id',
            label: t('superAdminCustomersColumnId'),
            className: 'whitespace-nowrap',
            render: (_value, row) => row.employee_id ?? t('commonNotAvailable'),
        },
        {
            key: 'name',
            label: t('superAdminEmployeesColumnEmployeeName'),
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
            key: 'employment_type',
            label: t('commonEmploymentType'),
            className: 'whitespace-nowrap text-neutral-900',
            render: (_value, row) => row.employment_type ?? t('commonNotAvailable'),
        },
        {
            key: 'roles',
            label: t('superAdminEmployeesColumnRoleType'),
            className: 'whitespace-nowrap text-neutral-900',
            render: (_value, row) => (row.roles && row.roles.length > 0 ? row.roles[0].name : t('commonNotAvailable')),
        },
        {
            key: 'platform',
            label: t('commonPlatform'),
            className: 'whitespace-nowrap text-neutral-900',
            render: (_value, row) => row.platform ?? t('commonNotAvailable'),
        },
        {
            key: 'status',
            label: t('commonStatus'),
            className: 'whitespace-nowrap',
            render: (_value, row) => (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}>
                    {row.status || t('superAdminEmployeesStatusInactive')}
                </span>
            ),
        },
        {
            key: 'availability',
            label: t('superAdminEmployeesColumnAvailability'),
            className: 'whitespace-nowrap',
            render: (_value, row) => {
                const roleName = row?.roles && row.roles.length > 0 ? row.roles[0].name : '';
                if (!isRiderOrDriverRole(roleName)) {
                    return <span className="text-xs text-slate-400">{t('commonNotAvailable')}</span>;
                }
                const label = resolveAvailabilityLabel(row?.availability, t);
                const classes = resolveAvailabilityClasses(row?.availability);
                return (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${classes}`}>
                        {label}
                    </span>
                );
            },
        },
        {
            key: 'action',
            label: t('commonAction'),
            align: 'right',
            className: 'whitespace-nowrap',
            render: (_value, row) => (
                    <button
                        type="button"
                        onClick={() => handleViewProfile(row)}
                        className="text-neutral-900 text-sm font-14px underline cursor-pointer"
                    >
                        {t('commonViewDetails')}
                    </button>
            ),
        },
    ], [handleViewProfile, t]);

    const formatDate = (value, options = {}) => {
        if (!value) {
            return null;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            ...options,
        });
    };

    const getMembershipDuration = (value) => {
        if (!value) {
            return null;
        }

        const since = new Date(value);

        if (Number.isNaN(since.getTime())) {
            return null;
        }

        const now = new Date();
        let years = now.getFullYear() - since.getFullYear();
        let months = now.getMonth() - since.getMonth();

        if (months < 0) {
            years -= 1;
            months += 12;
        }

        if (years > 0) {
            return `${years} ${years > 1 ? t('superAdminEmployeesYears') : t('superAdminEmployeesYear')}`;
        }

        if (months > 0) {
            return `${months} ${months > 1 ? t('superAdminEmployeesMonths') : t('superAdminEmployeesMonth')}`;
        }

        return t('superAdminEmployeesLessThanMonth');
    };

    const getFileName = (filePath) => {
        if (!filePath || typeof filePath !== 'string') {
            return null;
        }

        return filePath.split('/').pop();
    };

    const getStatusColor = (status) => {
        switch ((status || 'inactive').toLowerCase()) {
            case 'active':
                return 'bg-green-100 text-green-600 border border-green-600';
            case 'inactive':
            default:
                return 'bg-red-100 text-red-600 border border-red-600';
        }
    };

    // Check if employee is a rider/driver (roles that require driving documents)
    const isRiderOrDriver = (employee) => {
        if (!employee?.roles || !Array.isArray(employee.roles)) {
            return false;
        }

        const normalize = (s) => (s || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ');

        const riderDriverRoles = ['rider', 'bike rider', 'car driver', 'driver', 'car-driver'];

        return employee.roles.some((role) =>
            riderDriverRoles.includes(normalize(role?.name))
        );
    };


    const fieldErrorKeys = [
        'name',
        'email',
        'phone_number',
        'employment_type',
        'platform',
        'role',
        'zone_ids',
        'zone_id',
        'address',
        'latitude',
        'longitude',
    ];
    const nonFieldErrors = Object.entries(errors)
        .filter(([key]) => !fieldErrorKeys.includes(key))
        .map(([, message]) => message)
        .filter(Boolean);

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

    const handleExportEmployees = (format) => {
        const dataset = filteredEmployees;

        if (!dataset.length) {
            window.alert(t('superAdminCustomersExportNoData'));
            return;
        }

        const headers = [
            t('commonId'),
            t('superAdminEmployeesColumnEmployeeId'),
            t('commonName'),
            t('commonEmail'),
            t('commonPhone'),
            t('commonRole'),
            t('commonEmploymentType'),
            t('commonPlatform'),
            t('commonStatus'),
            t('addressesCardArea'),
            t('commonMemberSince'),
        ];

        const rows = dataset.map((employee) => [
            employee.id ?? '',
            employee.employee_id ?? '',
            employee.name ?? '',
            employee.email ?? '',
            employee.phone_number ?? '',
            employee.roles?.[0]?.name ?? '',
            employee.employment_type ?? '',
            employee.platform ?? '',
            employee.status ?? '',
            formatZoneNames(normalizeZoneIds(employee.zone_ids ?? employee.zone_id)),
            formatDate(employee.member_since) ?? '',
        ]);

        const dateSuffix = new Date().toISOString().slice(0, 10);

        if (format === 'excel') {
            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, t('commonAccounts'));
            XLSX.writeFile(workbook, `employee-accounts-${dateSuffix}.xlsx`);
            return;
        }

        const csvContent = [headers, ...rows]
            .map((row) => row.map((value) => formatCSVValue(value)).join(','))
            .join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `employee-accounts-${dateSuffix}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('commonEmployeeManagement')}</h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <span className="font-medium text-gray-500">{t('commonEmployeeManagement')}</span>
                    </nav>
                </div>
            }
        >
            <style>{`
                .location-input > input {
                    margin-top:0px;
                }
            `}</style>
            <Head title={t('commonEmployeeManagement')} />

            {/* Statistics Cards */}
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
                title={t('superAdminEmployeesAllEmployees')}
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
                                    onClick={() => setShowSortMenu((previous) => !previous)}
                                    className="inline-flex items-center gap-[6px] rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm transition hover:border-[#94A3B8]"
                                    aria-haspopup="menu"
                                    aria-expanded={showSortMenu}
                                >
                                    <span className="flex items-center gap-[6px]">
                                        <img
                                            src="/assets/images/filter.png"
                                            alt={t('superAdminEmployeesFilterIconAlt')}
                                            className="w-[18px] h-[18px] flex-shrink-0"
                                        />
                                        <span className="font-normal text-xs text-gray-500 whitespace-nowrap">
                                            {t('superAdminEmployeesSortLabel')}
                                        </span>
                                    </span>
                                    <span className="text-sm font-normal text-[#0F172A] truncate">
                                        {sortOptions.find((option) => option.value === sortBy)?.label ?? t('commonName')}
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

                        <PrimaryButton
                            text={t('commonAddNew')}
                            onClick={openOnboardDrawer}
                            className="whitespace-nowrap"
                            style={{ padding: '0.5rem 2.5rem' }}
                        />
                        <div className="relative" ref={exportTriggerRef}>
                            <PrimaryButton
                                text={t('superAdminEmployeesExportAccounts')}
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
                                            handleExportEmployees(item.value);
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
                    data={filteredEmployees}
                    keyField="id"
                    striped
                    hoverable
                    minWidth="920px"
                    tableClassName="min-w-[920px]"
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
                    emptyMessage={t('superAdminEmployeesEmptyMessage')}
                />
            </Card>

            {/* Onboard Employee Drawer */}
            <Drawer
                open={showOnboardDrawer}
                onClose={closeOnboardDrawer}
                title={t('commonOnboardEmployee')}
                description={t('commonOnboardDescription')}
                initialFocusRef={onboardInitialFocusRef}
                panelClassName="flex h-full w-full max-w-md flex-col"
                containerClassName="flex items-stretch justify-end"
                bodyClassName={null}
                footer={<>
                    <OutlineButton
                        type="button"
                        onClick={closeOnboardDrawer}
                        text={t('commonCancel')}
                        className={"w-full"}
                    />

                    <PrimaryButton
                        text={processing ? t('superAdminEmployeesSendingInvite') : t('superAdminEmployeesSendInvite')}
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
                <form ref={formRef} onSubmit={handleOnboardSubmit} className="flex h-full flex-col">
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                        {nonFieldErrors.length > 0 && (
                            <div className="space-y-1 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">
                                {nonFieldErrors.map((error, index) => (
                                    <p key={index}>{error}</p>
                                ))}
                            </div>
                        )}

                        <Input
                            ref={onboardInitialFocusRef}
                            label={t('superAdminEmployeesFullName')}
                            type="text"
                            value={data.name}
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                            required
                            error={errors.name}
                            placeholder=""
                        />

                        <Input
                            label={t('commonEmail')}
                            type="email"
                            value={data.email}
                            onChange={(e) => handleFieldChange('email', e.target.value)}
                            required
                            error={errors.email}
                        />

                        <Input
                            ref={phoneInputRef}
                            label={t('commonPhone')}
                            type="tel"
                            value={data.phone_number}
                            onChange={(e) => handleFieldChange('phone_number', e.target.value)}
                            inputMode="tel"
                            required
                            error={errors.phone_number}
                        />
                        {console.log(data)}
                        {data.platform === 'Mobile Application' && data?.role !==  "drop point keeper" && data?.role !== "warehouse keeper" && (
                            <>
                                <Input
                                    label={t('superAdminEmployeesEmergencyPhoneNumber')}
                                    type="tel"
                                    value={data.emergency_phone_number}
                                    onChange={(e) => handleFieldChange('emergency_phone_number', e.target.value)}
                                    inputMode="tel"
                                    error={errors.emergency_phone_number}
                                />
                                <Input
                                    label={t('superAdminEmployeesBloodType')}
                                    type="text"
                                    value={data.blood_type}
                                    onChange={(e) => handleFieldChange('blood_type', e.target.value)}
                                    error={errors.blood_type}
                                />
                            </>
                        )}

                        {/* Location selection */}
                        <div className="space-y-3">
                            {/* <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee Location</label> */}
                            <LocationSearchInput
                                value={data.address}
                                onChange={(text) => {
                                    setData('address', text);
                                    setData('latitude', '');
                                    setData('longitude', '');
                                }}
                                onSelect={(item) => {
                                    setData('address', item.address || '');
                                    setData('latitude', item.lat ?? '');
                                    setData('longitude', item.lon ?? '');
                                    if (errors.address) clearErrors('address');
                                    if (errors.latitude) clearErrors('latitude');
                                    if (errors.longitude) clearErrors('longitude');
                                }}
                                placeholder={t('commonAddressPlaceholder')}
                                className="w-full border border-gray-200 rounded-full pt-4 pr-2 pb-4 pl-2 input-field focus:outline-none peer location-input"
                                rightAdornment={(
                                    <button
                                        type="button"
                                        onClick={handleUseCurrentLocationForCreate}
                                        disabled={!canUseGeolocation || isCreateLocating}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        title={t('superAdminEmployeesUseCurrentLocation')}
                                        aria-label={t('superAdminEmployeesUseCurrentLocation')}
                                    >
                                        {isCreateLocating ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                                                <circle cx="12" cy="12" r="3.25" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                                rightAdornmentClassName="absolute right-4 top-1/2 -translate-y-1/2"
                            />
                            {createGeoError && <p className="text-sm text-[#ef4444]">{createGeoError}</p>}
                            {(errors.address || errors.latitude || errors.longitude) && (
                                <div className="text-sm text-[#ef4444] space-y-1">
                                    {errors.address && <p>{errors.address}</p>}
                                    {errors.latitude && <p>{errors.latitude}</p>}
                                    {errors.longitude && <p>{errors.longitude}</p>}
                                </div>
                            )}
                            {/* Hidden inputs for lat/lon ensure they submit */}
                            <input type="hidden" name="latitude" value={data.latitude} />
                            <input type="hidden" name="longitude" value={data.longitude} />
                            {shouldShowCreateMap && (
                                <div className="overflow-hidden rounded-2xl border border-gray-200">
                                    <MapView
                                        center={[createLatitude, createLongitude]}
                                        marker={[createLatitude, createLongitude]}
                                        zoom={15}
                                        heightClass="h-56 md:h-64"
                                        hideViewLargerLink
                                        draggableMarker
                                        showFullscreenToggle
                                        onMarkerChange={handleCreateLocationFromMap}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    ref={employmentTriggerRef}
                                    onClick={() => setIsEmploymentMenuOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                >
                                    <span>{data.employment_type || t('superAdminEmployeesSelectEmploymentType')}</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-4 w-4 transition-transform ${isEmploymentMenuOpen ? 'rotate-180' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {isEmploymentMenuOpen && (
                                    <div
                                        ref={employmentMenuRef}
                                        className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                    >
                                        <Menu
                                            anchorRef={employmentTriggerRef}
                                            items={[
                                                { label: t('superAdminEmployeesEmploymentFullTime'), value: 'Full-Time' },
                                                { label: t('superAdminEmployeesEmploymentPartTime'), value: 'Part-Time' },
                                                { label: t('superAdminEmployeesEmploymentContract'), value: 'Contract' },
                                            ]}
                                            onItemClick={(item) => {
                                                handleFieldChange('employment_type', item.value);
                                                setIsEmploymentMenuOpen(false);
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>
                            {errors.employment_type && (
                                <p className="mt-2 text-sm text-[#ef4444]">{errors.employment_type}</p>
                            )}
                        </div>

                        <hr className={"text-gray-200"} />

                        <div>
                            <div className="flex gap-4 justify-between">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        value="Admin Portal"
                                        checked={data.platform === 'Admin Portal'}
                                        onChange={(e) => handleFieldChange('platform', e.target.value)}
                                        className="w-4 h-4 text-blue-500"
                                    />
                                    <span className="text-sm text-gray-500">{t('commonAdminPortal')}</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        value="Mobile Application"
                                        checked={data.platform === 'Mobile Application'}
                                        onChange={(e) => handleFieldChange('platform', e.target.value)}
                                        className="w-4 h-4 text-blue-500"
                                    />
                                    <span className="text-sm text-gray-500">{t('superAdminEmployeesPlatformMobileApplication')}</span>
                                </label>
                            </div>
                            {errors.platform && (
                                <p className="mt-2 text-sm text-[#ef4444]">{errors.platform}</p>
                            )}
                        </div>

                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    ref={roleTriggerRef}
                                    onClick={() => setIsRoleMenuOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                >
                                    <span>{data.role || t('superAdminEmployeesSelectRole')}</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-4 w-4 transition-transform ${isRoleMenuOpen ? 'rotate-180' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {isRoleMenuOpen && (
                                    <div
                                        ref={roleMenuRef}
                                        className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                    >
                                        <Menu
                                            anchorRef={roleTriggerRef}
                                            items={filteredRoles.map((role) => ({
                                                label: role?.name ?? t('superAdminEmployeesUntitledRole'),
                                                value: role?.name ?? '',
                                            }))}
                                            onItemClick={(item) => {
                                                handleFieldChange('role', item.value);
                                                setIsRoleMenuOpen(false);
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>
                            {errors.role && <p className="mt-2 text-sm text-[#ef4444]">{errors.role}</p>}
                        </div>

                        {/* Delivery Speed Mode - Only for Mobile Application */}
                        {/* {data.platform === 'Mobile Application' && (
                            <div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
                                    {deliverySpeedOptions.map((option) => {
                                        const isSelected = data.delivery_speed_mode === option.value;
                                        return (
                                            <label key={option.value} className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                <span
                                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition ${
                                                        isSelected ? 'border-[#338dff] bg-[#338dff] text-white' : 'border-[#cbd5f5] bg-white text-transparent'
                                                    }`}
                                                >
                                                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
                                                    </svg>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setData('delivery_speed_mode', option.value);
                                                        if (errors.delivery_speed_mode) clearErrors('delivery_speed_mode');
                                                    }}
                                                />
                                                <span>{option.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {errors.delivery_speed_mode && <p className="mt-2 text-sm text-[#ef4444]">{errors.delivery_speed_mode}</p>}
                            </div>
                        )} */}

                        {/* COD Collection Limit - Only for Mobile Roles */}
                        {isMobileRole(data.role) && (
                            <Input
                                label={t('commonDailyCodLimit')}
                                type="number"
                                step="0.01"
                                min="0"
                                value={data.cod_collection_limit}
                                onChange={(e) => handleFieldChange('cod_collection_limit', e.target.value)}
                                error={errors.cod_collection_limit}
                            />
                        )}

                        {/* Zone Dropdown - Available for all platforms */}
                        
                    <div>
                        <div className="relative">
                            <button
                                type="button"
                                ref={zoneTriggerRef}
                                onClick={() => setIsZoneMenuOpen((prev) => !prev)}
                                className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                            >
                                <span>{formatZoneSelection(normalizeZoneIds(data.zone_ids), t('superAdminEmployeesSelectZonesOptional'))}</span>
                                <span className="flex items-center gap-2 text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65Z" />
                                    </svg>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-4 w-4 transition-transform ${isZoneMenuOpen ? 'rotate-180' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </span>
                            </button>

                            {isZoneMenuOpen && (
                                <div
                                    ref={zoneMenuRef}
                                    className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                >
                                    <div className="px-4 py-2 text-xs text-gray-500">{t('superAdminEmployeesSelectOneOrMoreZones')}</div>
                                    <div className="px-4 pb-2">
                                        <div className="relative">
                                            <input
                                                type="search"
                                                value={zoneSearchQuery}
                                                onChange={(event) => setZoneSearchQuery(event.target.value)}
                                                placeholder={t('superAdminEmployeesSearchZones')}
                                                className="w-full rounded-full border border-[#e2e8f0] bg-white px-10 py-2 text-xs text-[#1f2937] focus:outline-none focus:ring-2 focus:ring-[#338dff33]"
                                            />
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65Z"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between px-4 pb-2 text-xs text-gray-500">
                                        <button
                                            type="button"
                                            onClick={toggleSelectAllCreateZones}
                                            className="text-[#338dff] hover:underline"
                                        >
                                            {isAllCreateZonesSelected ? t('commonUnselectAll') : t('commonSelectAll')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearCreateZoneSelection}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            {t('commonClearSelection')}
                                        </button>
                                    </div>
                                    {filteredZones.length === 0 && (
                                        <div className="px-4 py-3 text-sm text-gray-500">{t('superAdminEmployeesNoZonesFound')}</div>
                                    )}
                                    <ul className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
                                        {filteredZones.map((zone) => {
                                            const zoneKey = String(zone.id);
                                            const isSelected = normalizeZoneIds(data.zone_ids).includes(zoneKey);
                                            return (
                                                <li key={zone.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCreateZoneSelection(zone.id)}
                                                        className="flex w-full items-center px-4 py-3 text-left transition-colors hover:bg-gray-50"
                                                    >
                                                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${isSelected ? 'border-[#338dff] bg-[#338dff] text-white' : 'border-gray-300'}`}>
                                                            {isSelected && (
                                                                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <span className="ml-2">{`${zone.name} (${zone.code})`}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                        {(errors.zone_ids || errors.zone_id) && (
                            <p className="mt-2 text-sm text-[#ef4444]">{errors.zone_ids || errors.zone_id}</p>
                        )}
                    </div>

                    {data.platform === 'Mobile Application' && isRiderOrDriverRole(data.role) && (
                        <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-3">
                            <div className="rounded-2xl overflow-hidden border border-[#e2e8f0] bg-slate-50" style={{ height: '240px' }}>
                                {isZonesMapLoaded ? (
                                    createAssignedZonePolygons.length > 0 ? (
                                        <GoogleMap
                                            mapContainerStyle={{ width: '100%', height: '100%' }}
                                            center={getZoneMapCenter(createAssignedZonePolygons)}
                                            zoom={11}
                                            options={zoneMapOptions}
                                        >
                                            {createAssignedZonePolygons.map((polygon) => (
                                                polygon.paths.map((path, index) => (
                                                    <Polygon
                                                        key={`${polygon.id}-${index}`}
                                                        paths={path}
                                                        options={{
                                                            fillColor: '#10B981',
                                                            fillOpacity: 0.35,
                                                            strokeColor: '#10B981',
                                                            strokeOpacity: 0.9,
                                                            strokeWeight: 2,
                                                        }}
                                                    />
                                                ))
                                            ))}
                                        </GoogleMap>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                            {t('superAdminEmployeesPreviewZonesMap')}
                                        </div>
                                    )
                                ) : (
                                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                        {t('commonLoadingMap')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Warehouse Dropdown - Only for Warehouse Keeper role */}
                    {/* {data.platform === 'Mobile Application' && isWarehouseKeeperRole(data.role) && (
                            <div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        ref={warehouseTriggerRef}
                                        onClick={() => setIsWarehouseMenuOpen((prev) => !prev)}
                                        className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                    >
                                        <span>{getWarehouseName(data.warehouse_id, 'Select Warehouse')}</span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            className={`h-4 w-4 transition-transform ${isWarehouseMenuOpen ? 'rotate-180' : ''}`}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                        </svg>
                                    </button>

                                    {isWarehouseMenuOpen && (
                                        <div
                                            ref={warehouseMenuRef}
                                            className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                        >
                                            <ul className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
                                                <li>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setData('warehouse_id', '');
                                                            setIsWarehouseMenuOpen(false);
                                                        }}
                                                        className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 text-gray-500"
                                                    >
                                                        None
                                                    </button>
                                                </li>
                                                {(warehouses || []).map((warehouse) => (
                                                    <li key={warehouse.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setData('warehouse_id', warehouse.id);
                                                                if (errors.warehouse_id) clearErrors('warehouse_id');
                                                                setIsWarehouseMenuOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${String(data.warehouse_id) === String(warehouse.id) ? 'bg-[#338dff]/10 text-[#338dff]' : ''}`}
                                                        >
                                                            {warehouse.name}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                {errors.warehouse_id && (
                                    <p className="mt-2 text-sm text-[#ef4444]">{errors.warehouse_id}</p>
                                )}
                            </div>
                    )} */}

                    {/* Drop Point Dropdown - Only for Drop Point Keeper role */}
                    {/* {data.platform === 'Mobile Application' && isDropPointKeeperRole(data.role) && (
                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    ref={dropPointTriggerRef}
                                    onClick={() => setIsDropPointMenuOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                >
                                    <span>{getDropPointName(data.drop_point_id, 'Select Drop Point')}</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-4 w-4 transition-transform ${isDropPointMenuOpen ? 'rotate-180' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {isDropPointMenuOpen && (
                                    <div
                                        ref={dropPointMenuRef}
                                        className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                    >
                                        <ul className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setData('drop_point_id', '');
                                                        if (errors.drop_point_id) clearErrors('drop_point_id');
                                                        setIsDropPointMenuOpen(false);
                                                    }}
                                                    className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 text-gray-500"
                                                >
                                                    None
                                                </button>
                                            </li>
                                            {(dropPoints || []).map((dropPoint) => (
                                                <li key={dropPoint.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setData('drop_point_id', dropPoint.id);
                                                            if (errors.drop_point_id) clearErrors('drop_point_id');
                                                            setIsDropPointMenuOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${String(data.drop_point_id) === String(dropPoint.id) ? 'bg-[#338dff]/10 text-[#338dff]' : ''}`}
                                                    >
                                                        {dropPoint.name}
                                                        {dropPoint.city ? ` (${dropPoint.city})` : ''}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {errors.drop_point_id && (
                                <p className="mt-2 text-sm text-[#ef4444]">{errors.drop_point_id}</p>
                            )}
                        </div>
                    )} */}
                    </div>
                </form>
            </Drawer>

            {/* Profile Drawer */}
            <Drawer
                open={showProfileDrawer && Boolean(selectedEmployee)}
                onClose={closeProfileDrawer}
                onAfterClose={handleProfileDrawerAfterClose}
                title={t('superAdminEmployeesProfileTitle')}
                showCloseButton={false}
                headerClassName="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-6 py-5"
                header={({ titleId }) => (
                    <div className="flex w-full items-center justify-between">
                        <h3 id={titleId} className="text-lg font-semibold text-gray-500">
                            {t('superAdminEmployeesProfileTitle')}
                        </h3>
                        {selectedEmployee && (
                            <div className="absolute right-20 top-5">
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(selectedEmployee.status)}`}>
                                    {selectedEmployee.status || t('superAdminEmployeesStatusInactive')}
                                </span>
                            </div>
                        )}
                        <button
                            ref={profileCloseButtonRef}
                            type="button"
                            onClick={closeProfileDrawer}
                            className="text-[#64748b] transition hover:text-gray-500"
                            aria-label={t('commonCloseProfileDrawer')}
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                initialFocusRef={profileCloseButtonRef}
                panelClassName="flex h-full w-full max-w-md flex-col bg-[#f1f5f9] shadow-xl"
                containerClassName="flex items-stretch justify-end"
                overlayClassName="bg-black/50"
                bodyClassName={null}
            >
                {selectedEmployee && (
                    <div className="flex h-full flex-col">
                        <div className="flex-1 space-y-6 overflow-y-auto bg-white p-6">
                            <div className="relative rounded-[24px] border border-[#e2e8f0] bg-[#F1F1F1] p-4">

                                <div className="flex items-center gap-4">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e2e8f0] text-lg font-semibold text-[#1e293b] overflow-hidden">
                                        {selectedEmployee.avatar_path ? (
                                            <img
                                                src={selectedEmployee.avatar_path}
                                                alt={selectedEmployee.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            selectedEmployee.name ? selectedEmployee.name.charAt(0) : 'E'
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="text-lg font-semibold text-gray-900">{selectedEmployee.name}</h4>
                                        {selectedEmployee.roles && selectedEmployee.roles.length > 0 && (
                                            <span className="inline-flex items-center rounded-full bg-[#e0edff] px-3 py-1 text-xs font-medium text-[#1d4ed8]">
                                                {getRoleIcon(selectedEmployee.roles[0].name) ? (
                                                    <img
                                                        src={getRoleIcon(selectedEmployee.roles[0].name)}
                                                        alt={selectedEmployee.roles[0].name}
                                                        className="h-4 w-4 object-contain"
                                                    />
                                                ) : (
                                                    selectedEmployee.roles[0].name
                                                )}
                                            </span>
                                        )}
                                        </div>
                                        <p className="mt-1 text-sm text-[#64748b]">
                                            {`${t('commonMemberSinceLabel')} ${getMembershipDuration(selectedEmployee.member_since) || t('commonNotAvailable')}`}
                                        </p>
                                    </div>
                                </div>

                                {isRiderOrDriver(selectedEmployee) && (
                                    <div className="mt-6 rounded-[18px] px-6 py-3 flex items-stretch text-center border-t border-[#e2e8f0]">
                                <div className="flex-1 flex flex-col justify-center">
                                    <p className="text-sm font-semibold text-gray-900">
                                    {selectedEmployee.completed_jobs || 0}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">{t('commonCompletedJobs')}</p>
                                </div>

                                <div className="mx-6 w-px bg-[#e2e8f0]" />

                                <div className="flex-1 flex flex-col justify-center">
                                    <p className="text-sm font-semibold text-gray-900">
                                    {selectedEmployee.total_earnings ? `${selectedEmployee.total_earnings} SYP` : t('commonNotAvailable')}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">{t('commonTotalEarnings')}</p>
                                </div>

                                <div className="mx-6 w-px bg-[#e2e8f0]" />

                                <div className="flex-1 flex flex-col justify-center">
                                    <p className="text-sm font-semibold text-gray-900">
                                    {selectedEmployee.total_miles
                                        ? `${Number(selectedEmployee.total_miles).toFixed(2)} ${t('superAdminEmployeesMilesUnit')}`
                                        : `0 ${t('superAdminEmployeesMilesUnit')}`}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">{t('superAdminEmployeesTotalMiles')}</p>
                                </div>
                                </div>

                                )}
                                </div>

                            <div className="mt-6 rounded-[24px] border border-[#e2e8f0] p-4">

                                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 ">
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('commonName')}</p>
                                        <div className="truncate rounded-full bg-white px-3 text-sm text-[#1e293b]">
                                            {selectedEmployee.name || t('commonNotAvailable')}
                                        </div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('commonContact')}</p>
                                        <div className="rounded-full bg-white px-3 text-sm text-[#1e293b]">
                                            {selectedEmployee.phone_number || t('commonNotAvailable')}
                                        </div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('commonEmail')}</p>
                                        <div className="rounded-full bg-white px-3 text-sm text-[#1e293b] break-all">
                                            {selectedEmployee.email || t('commonNotAvailable')}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('commonEmployment')}</p>
                                        <div className="rounded-full bg-white px-3 text-sm text-[#1e293b]">
                                            {selectedEmployee.employment_type || t('commonNotAvailable')}
                                        </div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('commonPlatform')}</p>
                                        <div className="rounded-full bg-white px-3 text-sm text-[#1e293b]">
                                            {selectedEmployee.platform || t('commonNotAvailable')}
                                        </div>
                                    </div>
                                </div>

                                {isRiderOrDriver(selectedEmployee) && (
                                    <>
                                        <div className="mt-6">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('commonIdCard')}</p>
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                {[selectedEmployee.id_card_front, selectedEmployee.id_card_back].map((image, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex h-24 items-center justify-center overflow-hidden rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc]"
                                                    >
                                                        {image ? (
                                                            <img
                                                                src={image}
                                                                alt={index === 0 ? t('superAdminEmployeesIdCardFront') : t('superAdminEmployeesIdCardBack')}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-slate-500">{index === 0 ? t('superAdminEmployeesNoFrontImage') : t('superAdminEmployeesNoBackImage')}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {(selectedEmployee.driving_license || formatDate(selectedEmployee.license_expiry)) && (
                                            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {selectedEmployee.driving_license && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('commonDrivingLicense')}</p>
                                                        <a
                                                            href={selectedEmployee.driving_license}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-full border border-[#dbeafe] bg-white px-3 py-2 text-xs font-medium text-[#1d4ed8] transition hover:bg-[#eff6ff]"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={1.5}
                                                                    d="M9 17h6m-6-4h6m-6-4h6M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                                                                />
                                                            </svg>
                                                            {getFileName(selectedEmployee.driving_license) || t('superAdminEmployeesViewLicense')}
                                                        </a>
                                                    </div>
                                                )}
                                                {formatDate(selectedEmployee.license_expiry) && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('superAdminEmployeesLicenseExpiry')}</p>
                                                        <p className="rounded-full bg-white px-3 py-2 text-xs font-medium text-[#1e293b]">
                                                            {formatDate(selectedEmployee.license_expiry)}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Passport Section */}
                                        {selectedEmployee.passport && (
                                            <div className="mt-6">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('superAdminEmployeesPassport')}</p>
                                                <div className="mt-3">
                                                    <a
                                                        href={selectedEmployee.passport}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 rounded-full border border-[#dbeafe] bg-white px-3 py-2 text-xs font-medium text-[#1d4ed8] transition hover:bg-[#eff6ff]"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={1.5}
                                                                d="M9 17h6m-6-4h6m-6-4h6M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                                                            />
                                                        </svg>
                                                        {getFileName(selectedEmployee.passport) || t('superAdminEmployeesViewPassport')}
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {/* IDP (International Driving Permit) Section */}
                                        {selectedEmployee.idp && (
                                            <div className="mt-6">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('superAdminEmployeesInternationalDrivingPermit')}</p>
                                                <div className="mt-3">
                                                    <a
                                                        href={selectedEmployee.idp}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 rounded-full border border-[#dbeafe] bg-white px-3 py-2 text-xs font-medium text-[#1d4ed8] transition hover:bg-[#eff6ff]"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={1.5}
                                                                d="M9 17h6m-6-4h6m-6-4h6M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                                                            />
                                                        </svg>
                                                        {getFileName(selectedEmployee.idp) || t('superAdminEmployeesViewIdp')}
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                </div>


                            <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-4">
                                <h4 className="mb-4 text-sm font-semibold text-gray-500">{t('superAdminEmployeesProfileDetails')}</h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3 text-sm text-[#1e293b]">
                                        {selectedEmployee.employee_id && (
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">{t('superAdminEmployeesColumnEmployeeId')}</p>
                                                <p className="mt-1 font-medium">{selectedEmployee.employee_id}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-slate-500">{t('commonStatus')}</p>
                                            <p className="mt-1 font-medium capitalize">{selectedEmployee.status || t('superAdminEmployeesStatusInactive')}</p>
                                        </div>

                                        {formatDate(selectedEmployee.date_of_birth) && (
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">{t('settingsProfileDateOfBirth')}</p>
                                                <p className="mt-1 font-medium">{formatDate(selectedEmployee.date_of_birth)}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {selectedEmployee.address && (
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">{t('commonAddress')}</p>
                                                <p className="mt-1 text-sm text-[#1e293b]">{selectedEmployee.address}</p>
                                            </div>
                                        )}
                                        {selectedEmployee.city && (
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">{t('commonCity')}</p>
                                                <p className="mt-1 text-sm text-[#1e293b]">{selectedEmployee.city}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isRiderOrDriver(selectedEmployee) && (
                                <>
                                    {selectedEmployee.vehicles && selectedEmployee.vehicles.length > 0 && (
                                        <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-4">
                                            <h4 className="mb-4 text-sm font-semibold text-gray-500">{t('superAdminEmployeesVehicleDetails')}</h4>
                                            <div className="space-y-4">
                                                {selectedEmployee.vehicles.map((vehicle, index) => (
                                                    <div key={index} className="rounded-2xl p-4">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-[#64748b]">{t('superAdminEmployeesBikeId')}</span>
                                                            <span className="font-medium text-[#1e293b]">{vehicle.code || t('commonNotAvailable')}</span>
                                                        </div>
                                                        <div className="mt-2 flex justify-between text-sm">
                                                            <span className="text-[#64748b]">{t('superAdminEmployeesLicensePlate')}</span>
                                                            <span className="font-medium text-[#1e293b]">{vehicle.license_plate || t('commonNotAvailable')}</span>
                                                        </div>
                                                        <div className="mt-2 flex justify-between text-sm">
                                                            <span className="text-[#64748b]">{t('commonModel')}</span>
                                                            <span className="font-medium text-[#1e293b]">{vehicle.model || t('commonNotAvailable')}</span>
                                                        </div>
                                                        <div className="mt-2 flex justify-between text-sm">
                                                            <span className="text-[#64748b]">{t('commonModelYear')}</span>
                                                            <span className="font-medium text-[#1e293b]">{vehicle.model_year || t('commonNotAvailable')}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-4 border-t border-[#e2e8f0] bg-white px-6 py-5">
                            <OutlineButton
                                type="button"
                                onClick={handleDeactivate}
                                text={selectedEmployee?.status === 'active' ? t('superAdminEmployeesDeactivate') : t('superAdminEmployeesActivate')}
                            />
                            <PrimaryButton
                                type="button"
                                onClick={openEditDrawer}
                                width="282px"
                                text={t('superAdminEmployeesUpdateProfile')}
                            />
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Edit Employee Drawer */}
            <Drawer
                open={showEditDrawer}
                onClose={closeEditDrawer}
                title={t('superAdminEmployeesDrawerEditTitle')}
                description={t('superAdminEmployeesDrawerEditDescription')}
                panelClassName="flex h-full w-full max-w-md flex-col"
                containerClassName="flex items-stretch justify-end"
                bodyClassName={null}
                footer={<>
                    <OutlineButton
                        type="button"
                        onClick={closeEditDrawer}
                        text={t('commonCancel')}
                        className={"w-full"}
                    />

                    <PrimaryButton
                        text={updating ? t('commonUpdating') : t('superAdminEmployeesUpdateEmployee')}
                        type="button"
                        disabled={updating}
                        className={"w-full"}
                        onClick={() => {
                            if (editFormRef.current) {
                                editFormRef.current.requestSubmit();
                            }
                        }}
                    />
                </>}
            >
                <form ref={editFormRef} onSubmit={handleEditSubmit} className="flex h-full flex-col">
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                        <Input
                            label={t('superAdminEmployeesFullName')}
                            type="text"
                            value={editData.name}
                            onChange={(e) => handleEditFieldChange('name', e.target.value)}
                            required
                            error={editErrors.name}
                            placeholder=""
                        />

                        <Input
                            label={t('commonEmail')}
                            type="email"
                            value={editData.email}
                            onChange={(e) => handleEditFieldChange('email', e.target.value)}
                            required
                            error={editErrors.email}
                        />

                        <Input
                            ref={editPhoneInputRef}
                            label={t('commonPhone')}
                            type="tel"
                            value={editData.phone_number}
                            onChange={(e) => handleEditFieldChange('phone_number', e.target.value)}
                            inputMode="tel"
                            placeholder="+963 000 000 000"
                            required
                            error={editErrors.phone_number}
                        />

                        {editData.platform === 'Mobile Application' && data?.role !== "drop point keeper" && data?.role !== "warehouse keeper" && (
                            <>
                                <Input
                                    label={t('superAdminEmployeesEmergencyPhoneNumber')}
                                    type="tel"
                                    value={editData.emergency_phone_number}
                                    onChange={(e) => handleEditFieldChange('emergency_phone_number', e.target.value)}
                                    inputMode="tel"
                                    error={editErrors.emergency_phone_number}
                                />
                                <Input
                                    label={t('superAdminEmployeesBloodType')}
                                    type="text"
                                    value={editData.blood_type}
                                    onChange={(e) => handleEditFieldChange('blood_type', e.target.value)}
                                    error={editErrors.blood_type}
                                />
                            </>
                        )}

                        {/* Location selection */}
                        <div className="space-y-3">
                            <LocationSearchInput
                                value={editData.address}
                                onChange={(text) => {
                                    setEditData('address', text);
                                    setEditData('latitude', '');
                                    setEditData('longitude', '');
                                }}
                                onSelect={(item) => {
                                    setEditData('address', item.address || '');
                                    setEditData('latitude', item.lat ?? '');
                                    setEditData('longitude', item.lon ?? '');
                                    if (editErrors.address) clearEditErrors('address');
                                    if (editErrors.latitude) clearEditErrors('latitude');
                                    if (editErrors.longitude) clearEditErrors('longitude');
                                }}
                                placeholder={t('commonAddressPlaceholder')}
                                className="w-full border border-gray-200 rounded-full pt-4 pr-2 pb-4 pl-2 input-field focus:outline-none peer location-input"
                                rightAdornment={(
                                    <button
                                        type="button"
                                        onClick={handleUseCurrentLocationForEdit}
                                        disabled={!canUseGeolocation || isEditLocating}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        title={t('superAdminEmployeesUseCurrentLocation')}
                                        aria-label={t('superAdminEmployeesUseCurrentLocation')}
                                    >
                                        {isEditLocating ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                                                <circle cx="12" cy="12" r="3.25" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                                rightAdornmentClassName="absolute right-4 top-1/2 -translate-y-1/2"
                            />
                            {editGeoError && <p className="text-sm text-[#ef4444]">{editGeoError}</p>}
                            {(editErrors.address || editErrors.latitude || editErrors.longitude) && (
                                <div className="text-sm text-[#ef4444] space-y-1">
                                    {editErrors.address && <p>{editErrors.address}</p>}
                                    {editErrors.latitude && <p>{editErrors.latitude}</p>}
                                    {editErrors.longitude && <p>{editErrors.longitude}</p>}
                                </div>
                            )}
                            <input type="hidden" name="latitude" value={editData.latitude} />
                            <input type="hidden" name="longitude" value={editData.longitude} />
                            {shouldShowEditMap && (
                                <div className="overflow-hidden rounded-2xl border border-gray-200">
                                    <MapView
                                        center={[editLatitude, editLongitude]}
                                        marker={[editLatitude, editLongitude]}
                                        zoom={15}
                                        heightClass="h-56 md:h-64"
                                        hideViewLargerLink
                                        draggableMarker
                                        showFullscreenToggle
                                        onMarkerChange={handleEditLocationFromMap}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    ref={editEmploymentTriggerRef}
                                    onClick={() => setIsEditEmploymentMenuOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                >
                                    <span>{editData.employment_type || t('superAdminEmployeesSelectEmploymentType')}</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-4 w-4 transition-transform ${isEditEmploymentMenuOpen ? 'rotate-180' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {isEditEmploymentMenuOpen && (
                                    <div
                                        ref={editEmploymentMenuRef}
                                        className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                    >
                                        <Menu
                                            anchorRef={editEmploymentTriggerRef}
                                            items={[
                                                { label: t('superAdminEmployeesEmploymentFullTime'), value: 'Full-Time' },
                                                { label: t('superAdminEmployeesEmploymentPartTime'), value: 'Part-Time' },
                                                { label: t('superAdminEmployeesEmploymentContract'), value: 'Contract' },
                                            ]}
                                            onItemClick={(item) => {
                                                handleEditFieldChange('employment_type', item.value);
                                                setIsEditEmploymentMenuOpen(false);
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>
                            {editErrors.employment_type && (
                                <p className="mt-2 text-sm text-[#ef4444]">{editErrors.employment_type}</p>
                            )}
                        </div>

                        <hr className={"text-gray-200"} />

                        <div>
                            <div className="flex gap-4 justify-between">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        value="Admin Portal"
                                        checked={editData.platform === 'Admin Portal'}
                                        onChange={(e) => handleEditFieldChange('platform', e.target.value)}
                                        className="w-4 h-4 text-blue-500"
                                    />
                                    <span className="text-sm text-gray-500">{t('commonAdminPortal')}</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        value="Mobile Application"
                                        checked={editData.platform === 'Mobile Application'}
                                        onChange={(e) => handleEditFieldChange('platform', e.target.value)}
                                        className="w-4 h-4 text-blue-500"
                                    />
                                    <span className="text-sm text-gray-500">{t('superAdminEmployeesPlatformMobileApplication')}</span>
                                </label>
                            </div>
                            {editErrors.platform && (
                                <p className="mt-2 text-sm text-[#ef4444]">{editErrors.platform}</p>
                            )}
                        </div>

                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    ref={editRoleTriggerRef}
                                    onClick={() => setIsEditRoleMenuOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                >
                                    <span>{editData.role || t('superAdminEmployeesSelectRole')}</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-4 w-4 transition-transform ${isEditRoleMenuOpen ? 'rotate-180' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {isEditRoleMenuOpen && (
                                    <div
                                        ref={editRoleMenuRef}
                                        className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                    >
                                        <Menu
                                            anchorRef={editRoleTriggerRef}
                                            items={filteredEditRoles.map((role) => ({
                                                label: role?.name ?? t('superAdminEmployeesUntitledRole'),
                                                value: role?.name ?? '',
                                            }))}
                                            onItemClick={(item) => {
                                                handleEditFieldChange('role', item.value);
                                                setIsEditRoleMenuOpen(false);
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>
                            {editErrors.role && <p className="mt-2 text-sm text-[#ef4444]">{editErrors.role}</p>}
                        </div>

                        {/* Delivery Speed Mode - Only for Mobile Application */}
                        {/* {editData.platform === 'Mobile Application' && (
                            <div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
                                    {deliverySpeedOptions.map((option) => {
                                        const isSelected = editData.delivery_speed_mode === option.value;
                                        return (
                                            <label key={option.value} className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                <span
                                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition ${
                                                        isSelected ? 'border-[#338dff] bg-[#338dff] text-white' : 'border-[#cbd5f5] bg-white text-transparent'
                                                    }`}
                                                >
                                                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
                                                    </svg>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setEditData('delivery_speed_mode', option.value);
                                                        if (editErrors.delivery_speed_mode) clearEditErrors('delivery_speed_mode');
                                                    }}
                                                />
                                                <span>{option.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {editErrors.delivery_speed_mode && <p className="mt-2 text-sm text-[#ef4444]">{editErrors.delivery_speed_mode}</p>}
                            </div>
                        )} */}

                        {/* COD Collection Limit - Only for Mobile Roles */}
                        {isMobileRole(editData.role) && (
                            <Input
                                label={t('commonDailyCodLimit')}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editData.cod_collection_limit}
                                onChange={(e) => handleEditFieldChange('cod_collection_limit', e.target.value)}
                                error={editErrors.cod_collection_limit}
                            />
                        )}

                        {/* Zone Dropdown - Available for all platforms */}
                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    ref={editZoneTriggerRef}
                                    onClick={() => setIsEditZoneMenuOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                >
                                    <span>{formatZoneSelection(normalizeZoneIds(editData.zone_ids), t('superAdminEmployeesSelectZonesOptional'))}</span>
                                    <span className="flex items-center gap-2 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65Z" />
                                        </svg>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            className={`h-4 w-4 transition-transform ${isEditZoneMenuOpen ? 'rotate-180' : ''}`}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                        </svg>
                                    </span>
                                </button>

                                {isEditZoneMenuOpen && (
                                    <div
                                        ref={editZoneMenuRef}
                                        className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                    >
                                        <div className="px-4 py-2 text-xs text-gray-500">{t('superAdminEmployeesSelectOneOrMoreZones')}</div>
                                        <div className="px-4 pb-2">
                                            <div className="relative">
                                                <input
                                                    type="search"
                                                    value={editZoneSearchQuery}
                                                    onChange={(event) => setEditZoneSearchQuery(event.target.value)}
                                                    placeholder={t('superAdminEmployeesSearchZones')}
                                                    className="w-full rounded-full border border-[#e2e8f0] bg-white px-10 py-2 text-xs text-[#1f2937] focus:outline-none focus:ring-2 focus:ring-[#338dff33]"
                                                />
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65Z"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-4 pb-2 text-xs text-gray-500">
                                            <button
                                                type="button"
                                                onClick={toggleSelectAllEditZones}
                                                className="text-[#338dff] hover:underline"
                                            >
                                                {isAllEditZonesSelected ? t('commonUnselectAll') : t('commonSelectAll')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={clearEditZoneSelection}
                                                className="text-gray-500 hover:text-gray-700"
                                            >
                                                {t('commonClearSelection')}
                                            </button>
                                        </div>
                                        {filteredEditZones.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-500">{t('superAdminEmployeesNoZonesFound')}</div>
                                        )}
                                        <ul className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
                                            {filteredEditZones.map((zone) => {
                                                const zoneKey = String(zone.id);
                                                const isSelected = normalizeZoneIds(editData.zone_ids).includes(zoneKey);
                                                return (
                                                    <li key={zone.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleEditZoneSelection(zone.id)}
                                                            className="flex w-full items-center px-4 py-3 text-left transition-colors hover:bg-gray-50"
                                                        >
                                                            <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${isSelected ? 'border-[#338dff] bg-[#338dff] text-white' : 'border-gray-300'}`}>
                                                                {isSelected && (
                                                                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
                                                                    </svg>
                                                                )}
                                                            </span>
                                                            <span className="ml-2">{`${zone.name} (${zone.code})`}</span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        {(editErrors.zone_ids || editErrors.zone_id) && (
                            <p className="mt-2 text-sm text-[#ef4444]">{editErrors.zone_ids || editErrors.zone_id}</p>
                        )}
                    </div>

                    {editData.platform === 'Mobile Application' && isRiderOrDriverRole(editData.role) && (
                        <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-3">
                            <div className="rounded-2xl overflow-hidden border border-[#e2e8f0] bg-slate-50" style={{ height: '240px' }}>
                                {isZonesMapLoaded ? (
                                    editAssignedZonePolygons.length > 0 ? (
                                        <GoogleMap
                                            mapContainerStyle={{ width: '100%', height: '100%' }}
                                            center={getZoneMapCenter(editAssignedZonePolygons)}
                                            zoom={11}
                                            options={zoneMapOptions}
                                        >
                                            {editAssignedZonePolygons.map((polygon) => (
                                                polygon.paths.map((path, index) => (
                                                    <Polygon
                                                        key={`${polygon.id}-${index}`}
                                                        paths={path}
                                                        options={{
                                                            fillColor: '#10B981',
                                                            fillOpacity: 0.35,
                                                            strokeColor: '#10B981',
                                                            strokeOpacity: 0.9,
                                                            strokeWeight: 2,
                                                        }}
                                                    />
                                                ))
                                            ))}
                                        </GoogleMap>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                            {t('superAdminEmployeesPreviewZonesMap')}
                                        </div>
                                    )
                                ) : (
                                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                        {t('commonLoadingMap')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Warehouse Dropdown - Only for Warehouse Keeper role */}
                    {/* {editData.platform === 'Mobile Application' && isWarehouseKeeperRole(editData.role) && (
                            <div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        ref={editWarehouseTriggerRef}
                                        onClick={() => setIsEditWarehouseMenuOpen((prev) => !prev)}
                                        className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                    >
                                        <span>{getWarehouseName(editData.warehouse_id, 'Select Warehouse')}</span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            className={`h-4 w-4 transition-transform ${isEditWarehouseMenuOpen ? 'rotate-180' : ''}`}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                        </svg>
                                    </button>

                                    {isEditWarehouseMenuOpen && (
                                        <div
                                            ref={editWarehouseMenuRef}
                                            className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                        >
                                            <ul className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
                                                <li>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditData('warehouse_id', '');
                                                            setIsEditWarehouseMenuOpen(false);
                                                        }}
                                                        className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 text-gray-500"
                                                    >
                                                        None
                                                    </button>
                                                </li>
                                                {(warehouses || []).map((warehouse) => (
                                                    <li key={warehouse.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditData('warehouse_id', warehouse.id);
                                                                if (editErrors.warehouse_id) clearEditErrors('warehouse_id');
                                                                setIsEditWarehouseMenuOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${String(editData.warehouse_id) === String(warehouse.id) ? 'bg-[#338dff]/10 text-[#338dff]' : ''}`}
                                                        >
                                                            {warehouse.name}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                {editErrors.warehouse_id && (
                                    <p className="mt-2 text-sm text-[#ef4444]">{editErrors.warehouse_id}</p>
                                )}
                            </div>
                    )} */}

                    {/* Drop Point Dropdown - Only for Drop Point Keeper role */}
                    {/* {editData.platform === 'Mobile Application' && isDropPointKeeperRole(editData.role) && (
                        <div>
                            <div className="relative">
                                <button
                                    type="button"
                                    ref={editDropPointTriggerRef}
                                    onClick={() => setIsEditDropPointMenuOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-full border border-[#e2e8f0] px-4 py-3 text-sm text-gray-500"
                                >
                                    <span>{getDropPointName(editData.drop_point_id, 'Select Drop Point')}</span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-4 w-4 transition-transform ${isEditDropPointMenuOpen ? 'rotate-180' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>

                                {isEditDropPointMenuOpen && (
                                    <div
                                        ref={editDropPointMenuRef}
                                        className="absolute left-0 mt-2 z-40 max-h-[260px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                                    >
                                        <ul className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditData('drop_point_id', '');
                                                        if (editErrors.drop_point_id) clearEditErrors('drop_point_id');
                                                        setIsEditDropPointMenuOpen(false);
                                                    }}
                                                    className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 text-gray-500"
                                                >
                                                    None
                                                </button>
                                            </li>
                                            {(dropPoints || []).map((dropPoint) => (
                                                <li key={dropPoint.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditData('drop_point_id', dropPoint.id);
                                                            if (editErrors.drop_point_id) clearEditErrors('drop_point_id');
                                                            setIsEditDropPointMenuOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${String(editData.drop_point_id) === String(dropPoint.id) ? 'bg-[#338dff]/10 text-[#338dff]' : ''}`}
                                                    >
                                                        {dropPoint.name}
                                                        {dropPoint.city ? ` (${dropPoint.city})` : ''}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {editErrors.drop_point_id && (
                                <p className="mt-2 text-sm text-[#ef4444]">{editErrors.drop_point_id}</p>
                            )}
                        </div>
                    )} */}
                    </div>
                </form>
            </Drawer>

            {/* Deactivate/Activate Confirmation Dialog */}
            <ConfirmDialog
                open={showDeactivateDialog}
                onClose={() => setShowDeactivateDialog(false)}
                onConfirm={confirmDeactivate}
                isProcessing={isDeactivating}
                {...getDeactivateDialogProps()}
            />
        </SuperAdminAuthenticated>
    );
}
