import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import PrimaryButton from '../../SuperAdmin/Components/PrimaryButton';
import Menu from '../../../Components/Common/Menu';
import StatsCard from '../../SuperAdmin/Components/StatsCard';
import Card from '../../../Components/Common/Card';
import Table from '../../../Components/Common/Table';
import Input from '../../../Components/Common/Inputs/Input';
import ConfirmDialog from '../../../Components/SuperAdmin/ConfirmDialog';
import MapDrawing from '../../../Components/SuperAdmin/MapDrawing';
import { GoogleMap, OverlayView, Polygon, useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';

// Remove emojis and zero-width joiners/variation selectors from text inputs
const sanitizeTextInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // surrogate pairs
        .replace(/[\u2600-\u27BF]/g, '') // misc symbols & dingbats
        .replace(/[\uFE0F\u200D]/g, ''); // variation selectors & ZWJ
};

const initialFormState = {
    name: '',
    city: '',
    drawn_paths: [],
};

const DEFAULT_MAP_CENTER = { lat: 33.5138, lng: 36.2765 };
const SYRIA_BOUNDS = {
    north: 37.31,
    south: 32.31,
    east: 42.45,
    west: 35.73,
};

const CITY_COORDINATES = {
    'damascus': DEFAULT_MAP_CENTER,
    'aleppo': { lat: 36.2021, lng: 37.1343 },
    'homs': { lat: 34.7324, lng: 36.7131 },
    'latakia': { lat: 35.5196, lng: 35.7913 },
    'barzeh': { lat: 33.5621, lng: 36.3147 },
    'rukun eldin': { lat: 33.5395, lng: 36.3057 },
    'rukn al din': { lat: 33.5395, lng: 36.3057 },
    'rukn el din': { lat: 33.5395, lng: 36.3057 },
    'al kaboun': { lat: 33.5436, lng: 36.3327 },
    'kaboun': { lat: 33.5436, lng: 36.3327 },
    'al salheya': { lat: 33.5179, lng: 36.2967 },
    'al salhiya': { lat: 33.5179, lng: 36.2967 },
    'old city': { lat: 33.5111, lng: 36.3064 },
    'old town': { lat: 33.5111, lng: 36.3064 },
    'muhajreen': { lat: 33.5261, lng: 36.2883 },
    'al muhajreen': { lat: 33.5261, lng: 36.2883 },
    'jaubar': { lat: 33.5284, lng: 36.3375 },
    'jobar': { lat: 33.5284, lng: 36.3375 },
    'saroujah': { lat: 33.5125, lng: 36.2959 },
    'sarouja': { lat: 33.5125, lng: 36.2959 },
};

const normalizeCityKey = (value = '') => value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');

const getCityCoordinates = (cityName, citiesData = []) => {
    if (!cityName) {
        return DEFAULT_MAP_CENTER;
    }

    // First try to find coordinates from the cities data
    const city = citiesData.find(c =>
        c.name && c.name.toLowerCase() === cityName.toLowerCase()
    );

    if (city && city.latitude && city.longitude) {
        return { lat: parseFloat(city.latitude), lng: parseFloat(city.longitude) };
    }

    // Fallback to hardcoded coordinates
    const normalized = normalizeCityKey(cityName);
    return CITY_COORDINATES[normalized] || DEFAULT_MAP_CENTER;
};

const drawingLibraries = ['drawing'];

const normalizePaths = (paths) => {
    if (!paths) return [];

    try {
        let parsedPaths = typeof paths === 'string' ? JSON.parse(paths) : paths;

        if (!Array.isArray(parsedPaths)) return [];
        if (parsedPaths.length === 0) return [];

        // Check if the first item is a direct lat/lng object, if so, wrap it
        if (!Array.isArray(parsedPaths[0]) && parsedPaths[0] !== null && typeof parsedPaths[0] === 'object') {
            parsedPaths = [parsedPaths];
        }

        return parsedPaths
            .map((path) => Array.isArray(path)
                ? path
                    .map((point) => {
                        if (!point) return null;
                        const lat = typeof point.lat === 'number' ? point.lat : parseFloat(point.lat);
                        const lng = typeof point.lng === 'number' ? point.lng : parseFloat(point.lng);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                        return { lat, lng };
                    })
                    .filter(Boolean)
                : [])
            .filter((path) => path.length >= 3);
    } catch (e) {
        console.error("Error normalizing paths", e);
        return [];
    }
};

const getPolygonCentroid = (paths = []) => {
    const points = paths.flat();
    if (!points.length) {
        return DEFAULT_MAP_CENTER;
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

const escapeCsvValue = (value) => {
    const normalized = value ?? '';
    const stringValue = typeof normalized === 'string' ? normalized : String(normalized);
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
};

const formatRelatedList = (items = [], formatter, fallback = '-') => {
    if (!Array.isArray(items) || items.length === 0) {
        return fallback;
    }

    const formatted = items
    .map((item) => (item.name ?? '').trim()).filter(Boolean).map((name) => name.replace(/\b\w/g, (char) => char.toUpperCase()));

    return formatted.join(', ');
};

const formatPersonForCsv = (person) => {
    if (!person) {
        return '';
    }

    const segments = [person.name];

    if (person.phone_number) {
        segments.push(`(${person.phone_number})`);
    }

    return segments.join(' ').trim();
};

const formatWarehouseForCsv = (warehouse) => {
    if (!warehouse) {
        return '';
    }

    const segments = [];

    if (warehouse.code) {
        segments.push(warehouse.code);
    }

    if (warehouse.name) {
        segments.push(warehouse.name);
    }

    if (warehouse.city) {
        segments.push(`(${warehouse.city})`);
    }

    return segments.join(' ').trim();
};

const formatDropPointForCsv = (dropPoint) => {
    if (!dropPoint) {
        return '';
    }

    const segments = [dropPoint.name, dropPoint.city, dropPoint.address]
        .filter(Boolean);

    return segments.join(' - ');
};

const buildZonesCsv = (zones = [], t) => {
    const csvHeaders = [
        t('superAdminZonesCsvZoneCode'),
        t('superAdminZonesCsvZoneName'),
        t('commonCity'),
        t('commonStatus'),
        t('commonDirectDelivery'),
        t('superAdminZonesColumnDoorDelivery'),
        t('superAdminZonesCsvRiders'),
        t('superAdminHeatmapModeRiders'),
        t('superAdminZonesCsvWarehouses'),
        t('superAdminZonesCsvDropPoints'),
    ];
    const rows = zones.map((zone) => {
        const row = [
            zone.zone.code ?? '',
            zone.zone.name ?? '',
            zone.zone.city ?? '',
            zone.zone.status ?? '',
            zone.zone.direct_delivery ? t('commonYes') : t('commonNo'),
            zone.zone.door_delivery ? t('commonYes') : t('commonNo'),
            formatRelatedList(zone.riders, formatPersonForCsv, t('commonNotAvailable')),
            formatRelatedList(zone.car_drivers, formatPersonForCsv, t('commonNotAvailable')),
            formatRelatedList(zone.warehouses, formatWarehouseForCsv, t('commonNotAvailable')),
            formatRelatedList(zone.droppoints, formatDropPointForCsv, t('commonNotAvailable')),
        ];

        return row.map(escapeCsvValue).join(',');
    });

    const header = csvHeaders.map(escapeCsvValue).join(',');
    return [header, ...rows].join('\n');
};

const extractZonesPayload = (payload = {}) => {
    if (Array.isArray(payload.data)) {
        return payload.data;
    }

    if (Array.isArray(payload.zones)) {
        return payload.zones;
    }

    if (Array.isArray(payload.data?.zones)) {
        return payload.data.zones;
    }

    return [];
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

const downloadCsvFile = (content, fileName) => {
    if (typeof document === 'undefined') return;

    const BOM = "\uFEFF"; // fixes Arabic/UTF-8 in Excel
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', fileName);

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
};

const getZonesDetailsUrl = () => {
    const hasWindow = typeof window !== 'undefined';
    const baseUrl = hasWindow && window.Ziggy && window.Ziggy.baseUrl
        ? window.Ziggy.baseUrl.replace(/\/$/, '')
        : '';

    return `${baseUrl}/admin/zones/details`;
};

export default function Index({ zones, allZones = [], statistics = {}, filters = {} }) {
    const { t } = useTranslation();
    const page = usePage?.() || {};
    const config = page?.props?.config || {};
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;

    // Load Google Maps API once for the entire page
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey,
        libraries: drawingLibraries,
    });

    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [activeZoneId, setActiveZoneId] = useState(null);
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [togglingZoneId, setTogglingZoneId] = useState(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [zoneToDelete, setZoneToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const drawerPanelRef = useRef(null);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [currentPage, setCurrentPage] = useState(1);
    const drawerOpenTimerRef = useRef(null);
    const cityMenuRef = useRef(null);
    const cityMenuTriggerRef = useRef(null);
    const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
    const [citySearchTerm, setCitySearchTerm] = useState('');
    const [mapCenter, setMapCenter] = useState(getCityCoordinates(initialFormState.city));
    const mapRef = useRef(null);
    const [hoveredZoneId, setHoveredZoneId] = useState(null);
    const [cities, setCities] = useState([]);

    const form = useForm(initialFormState);
    const { data, setData, errors, reset, clearErrors, setDefaults } = form;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSyncingZonePrices, setIsSyncingZonePrices] = useState(false);
    const [isExportingZones, setIsExportingZones] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [showSinglePreviewModal, setShowSinglePreviewModal] = useState(false);
    const [singlePreviewData, setSinglePreviewData] = useState(null);
    const [isSinglePreviewLoading, setIsSinglePreviewLoading] = useState(false);
    const [singlePreviewZoneName, setSinglePreviewZoneName] = useState('');
    const canClearGeofence = Array.isArray(data.drawn_paths) && data.drawn_paths.length > 0;
    const latestPathsRef = useRef(initialFormState.drawn_paths);
    const [mapKey, setMapKey] = useState(0);
    const [mapInitialPaths, setMapInitialPaths] = useState([]);

    const derivedCityOptions = useMemo(() => {
        return cities.map(city => city.name);
    }, [cities]);

    const cityMenuItems = useMemo(() => {
        const filteredCities = citySearchTerm
            ? derivedCityOptions.filter((city) =>
                city.toLowerCase().startsWith(citySearchTerm.toLowerCase())
            )
            : derivedCityOptions;
        const options = filteredCities.map((city) => ({ label: city, value: city }));
        return options;
    }, [derivedCityOptions, citySearchTerm]);

    useEffect(() => {
        const handler = setTimeout(() => {
            const previousSearch = filters.search ?? '';
            if (searchTerm === previousSearch) {
                return;
            }

            router.get(route('admin.zones.index'), { search: searchTerm || undefined }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 400);

        return () => clearTimeout(handler);
    }, [searchTerm, filters.search]);

    useEffect(() => {
        const normalized = filters.search ?? '';
        setSearchTerm((current) => (current === normalized ? current : normalized));
    }, [filters.search]);

    useEffect(() => {
        if (!drawerVisible) {
            document.body.style.overflow = '';
            return undefined;
        }

        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = '';
        };
    }, [drawerVisible]);

    useEffect(() => {
        if (!drawerVisible || !drawerOpen) {
            return;
        }

        const firstField = drawerPanelRef.current?.querySelector('input, select, textarea, button');
        firstField?.focus();
    }, [drawerVisible, drawerOpen]);

    useEffect(() => {
        if (!drawerVisible) {
            return;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeDrawer();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [drawerVisible]);

    const summaryCards = useMemo(() => ([
        { label: t('commonTotalZones'), value: statistics.total ?? 0, icon: '/assets/images/Parcel.svg', isSpecialCard: false },
        { label: t('commonActiveZones'), value: statistics.active ?? 0, icon: '/assets/images/Parcel.svg', isSpecialCard: false },
        { label: t('commonInactiveZones'), value: statistics.inactive ?? 0, icon: '/assets/images/Parcel.svg', isSpecialCard: false },
        { label: t('superAdminZonesStatAssignedToWarehouse'), value: statistics.assigned_to_warehouse ?? 0, icon: '/assets/images/Parcel.svg', isSpecialCard: false },
    ]), [statistics, t]);

    const applyDefaults = (values) => {
        const normalizedValues = {
            name: values.name ?? '',
            city: values.city ?? '',
            drawn_paths: Array.isArray(values.drawn_paths) ? values.drawn_paths : [],
        };

        setDefaults(normalizedValues);
        setData(normalizedValues);
        latestPathsRef.current = normalizedValues.drawn_paths;
    };

    const openDrawer = () => {
        setDrawerVisible(true);
        if (drawerOpenTimerRef.current) {
            clearTimeout(drawerOpenTimerRef.current);
        }
        drawerOpenTimerRef.current = setTimeout(() => {
            setDrawerOpen(true);
        }, 10);
    };

    const closeDrawer = () => {
        if (drawerOpenTimerRef.current) {
            clearTimeout(drawerOpenTimerRef.current);
            drawerOpenTimerRef.current = null;
        }
        setDrawerOpen(false);
        clearErrors();
        setIsCityMenuOpen(false);
        setTimeout(() => {
            setDrawerVisible(false);
            setIsEditing(false);
            setActiveZoneId(null);
            const resetDefaults = {
                name: '',
                city: '',
                drawn_paths: [],
            };
            applyDefaults(resetDefaults);
            reset();
        }, 260);
    };

    useEffect(() => {
        return () => {
            if (drawerOpenTimerRef.current) {
                clearTimeout(drawerOpenTimerRef.current);
                drawerOpenTimerRef.current = null;
            }
        };
    }, []);

    const openCreateDrawer = () => {
        const createDefaults = {
            name: '',
            city: '',
            drawn_paths: [],
        };
        applyDefaults(createDefaults);
        setIsEditing(false);
        setActiveZoneId(null);
        setIsCityMenuOpen(false);
        setMapInitialPaths([]);
        setMapKey((k) => k + 1);
        openDrawer();
    };

    const openEditDrawer = (zone) => {
        const zonePaths = Array.isArray(zone.drawn_paths) ? zone.drawn_paths : [];
        const editDefaults = {
            name: zone.name ?? '',
            city: zone.city ?? '',
            drawn_paths: zonePaths,
        };

        applyDefaults(editDefaults);
        setIsEditing(true);
        setActiveZoneId(zone.id);
        setIsCityMenuOpen(false);
        setMapInitialPaths(zonePaths);
        setMapKey((k) => k + 1);
        openDrawer();
    };

    const handleFieldChange = (field, value) => {
        setData(field, value);

        if (errors[field]) {
            clearErrors(field);
        }
    };

    const handlePathsChange = (paths) => {
        latestPathsRef.current = paths;
        setData('drawn_paths', paths);
        const drawnPathErrorKeys = Object.keys(errors).filter(
            (key) => key === 'drawn_paths' || key.startsWith('drawn_paths.'),
        );

        if (drawnPathErrorKeys.length > 0) {
            clearErrors(...drawnPathErrorKeys);
        }
    };

    const handleSyncZones = () => {
        setIsSyncing(true);
        router.post(route('admin.zones.sync'), {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                // Success is now tracked via the progress bar in the top bar
            },
            onError: (errors) => {
                console.error('Error starting sync:', errors);
            },
            onFinish: () => {
                setIsSyncing(false);
            },
        });
    };

    const handleSyncZonePrices = () => {
        setIsSyncingZonePrices(true);
        router.post(route('admin.zones.sync-prices'), {}, {
            preserveScroll: true,
            preserveState: true,
            onError: (syncErrors) => {
                console.error('Error syncing zone prices:', syncErrors);
            },
            onFinish: () => {
                setIsSyncingZonePrices(false);
            },
        });
    };

    const handleFetchPreview = async () => {
        setIsPreviewLoading(true);
        setShowPreviewModal(true);
        setPreviewData([]);
        try {
            const response = await fetch(route('admin.zones.preview'));
            const result = await response.json();
            setPreviewData(result.zones || []);
        } catch (error) {
            console.error('Failed to fetch preview data', error);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleExportZones = useCallback(async () => {
        setIsExportingZones(true);
        try {
            const response = await fetch(getZonesDetailsUrl(), {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch zones export (${response.status})`);
            }

            const result = await response.json();
            const zonePayload = extractZonesPayload(result);

            if (!zonePayload.length) {
                throw new Error(t('superAdminCustomersExportNoData'));
            }

            const csvContent = buildZonesCsv(zonePayload, t);
            const today = new Date().toISOString().slice(0, 10);
            downloadCsvFile(csvContent, `zones-${today}.csv`);
        } catch (error) {
            console.error('Failed to export zones CSV', error);
            if (typeof window !== 'undefined') {
                window.alert(t('superAdminZonesExportFailed'));
            }
        } finally {
            setIsExportingZones(false);
        }
    }, [setIsExportingZones, t]);

    const handleViewZoneAPI = async (zone) => {
        setIsSinglePreviewLoading(true);
        setShowSinglePreviewModal(true);
        setSinglePreviewData(null);
        setSinglePreviewZoneName(zone.name);
        try {
            const response = await fetch(route('admin.zones.api-preview-single', zone.id));
            const result = await response.json();
            if (response.ok && result.zone) {
                setSinglePreviewData(result.zone);
            } else {
                console.error(result.error);
                setSinglePreviewData({ error: result.error || t('superAdminZonesExternalApiErrorDefault') });
            }
        } catch (error) {
            console.error('Failed to fetch single zone API data', error);
            setSinglePreviewData({ error: t('superAdminZonesExternalApiServerError') });
        } finally {
            setIsSinglePreviewLoading(false);
        }
    };

    const handleClearPaths = () => {
        latestPathsRef.current = [];
        setData('drawn_paths', []);
        setMapInitialPaths([]);
        setMapKey((k) => k + 1);
        const drawnPathErrorKeys = Object.keys(errors).filter(
            (key) => key === 'drawn_paths' || key.startsWith('drawn_paths.'),
        );
        if (drawnPathErrorKeys.length > 0) {
            clearErrors(...drawnPathErrorKeys);
        }
    };

    // Fetch cities on mount
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const response = await fetch(route('admin.zones.api.cities'));
                const data = await response.json();
                setCities(data);
            } catch (error) {
                console.error('Error fetching cities:', error);
            }
        };

        fetchCities();
    }, []);

    useEffect(() => {
        setMapCenter(getCityCoordinates(data.city, cities));
    }, [data.city, cities]);

    useEffect(() => {
        if (!isCityMenuOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                cityMenuRef.current?.contains(event.target)
                || cityMenuTriggerRef.current?.contains(event.target)
            ) {
                return;
            }

            setIsCityMenuOpen(false);
            setCitySearchTerm('');
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsCityMenuOpen(false);
                setCitySearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isCityMenuOpen]);


    const handleSubmit = (event) => {
        event.preventDefault();

        const payload = {
            name: data.name,
            city: data.city,
            drawn_paths: latestPathsRef.current,
        };

        setIsSubmitting(true);

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                closeDrawer();
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        };

        if (isEditing && activeZoneId) {
            router.put(route('admin.zones.update', activeZoneId), payload, options);
        } else {
            router.post(route('admin.zones.store'), payload, options);
        }
    };

    const handleReset = () => {
        form.reset();
        clearErrors();
    };

    const handleStatusToggle = (zone) => {
        const nextStatus = zone.status === 'active' ? 'inactive' : 'active';
        setTogglingZoneId(zone.id);

        router.patch(route('admin.zones.status', zone.id), { status: nextStatus }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setTogglingZoneId(null),
        });
    };

    const handleDelete = (zone) => {
        setZoneToDelete(zone);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = () => {
        if (!zoneToDelete) return;

        setIsDeleting(true);
        router.delete(route('admin.zones.destroy', zoneToDelete.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowDeleteDialog(false);
                setZoneToDelete(null);
                setIsDeleting(false);
            },
            onError: () => {
                setIsDeleting(false);
            },
        });
    };

    const handleCancelDelete = () => {
        setShowDeleteDialog(false);
        setZoneToDelete(null);
    };

    const getErrorMessage = (field) => {
        if (errors[field]) {
            return errors[field];
        }

        const nestedKey = Object.keys(errors).find((key) => key.startsWith(`${field}.`));
        return nestedKey ? errors[nestedKey] : null;
    };

    const renderError = (field) => {
        const message = getErrorMessage(field);
        if (!message) {
            return null;
        }

        return (
            <p className="mt-1 text-xs text-red-500">
                {message}
            </p>
        );
    };

    const nonFieldErrors = Object.entries(errors)
        .filter(([key]) => {
            const fieldKeys = ['name', 'city', 'drawn_paths'];
            return !fieldKeys.some((fieldKey) => key === fieldKey || key.startsWith(`${fieldKey}.`));
        })
        .map(([, message]) => message)
        .filter(Boolean);

    const filteredZones = useMemo(() => (Array.isArray(zones) ? zones : []), [zones]);

    const totalPages = Math.max(1, Math.ceil(filteredZones.length / pageSize));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginationMeta = useMemo(() => {
        if (filteredZones.length === 0) {
            return { from: 0, to: 0, total: 0 };
        }

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, filteredZones.length);

        return {
            from: startIndex + 1,
            to: endIndex,
            total: filteredZones.length,
        };
    }, [filteredZones.length, currentPage, pageSize]);

    // Prepare zones for map display
    const zonePolygons = useMemo(() => {
        return (Array.isArray(allZones) ? allZones : [])
            .map((zone) => {
                const paths = normalizePaths(zone?.drawn_paths);
                if (!paths.length) {
                    return null;
                }

                // Active zones: green, Inactive zones: red
                const color = zone.status === 'active' ? '#10B981' : '#EF4444';

                return {
                    id: zone.id,
                    name: zone.name,
                    city: zone.city,
                    status: zone.status,
                    color,
                    paths,
                    centroid: getPolygonCentroid(paths),
                };
            })
            .filter(Boolean);
    }, [allZones]);

    const handleMapLoad = (mapInstance) => {
        mapRef.current = mapInstance;
    };

    const mapOptions = useMemo(() => ({
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

    const renderAvailabilityPill = useCallback((value) => {
        const isAvailable = Boolean(value);
        const classes = isAvailable
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-100 text-slate-600 border border-slate-200';

        return (
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${classes}`}>
                {isAvailable ? t('commonAvailable') : t('commonNotAvailable')}
            </span>
        );
    }, [t]);

    const tableColumns = useMemo(
        () => [
            {
                key: 'code',
                label: t('commonZoneId'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5 font-medium text-[#0f172a]',
            },
            {
                key: 'name',
                label: t('commonZoneName'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5',
            },
            {
                key: 'city',
                label: t('commonCity'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5',
            },
            {
                key: 'direct_delivery',
                label: t('commonDirectDelivery'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5',
                render: (_, zone) => renderAvailabilityPill(zone.direct_delivery),
            },
            {
                key: 'door_delivery',
                label: t('superAdminZonesColumnDoorDelivery'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5',
                render: (_, zone) => renderAvailabilityPill(zone.door_delivery),
            },
            {
                key: 'sub_district_name',
                label: t('superAdminZonesColumnSubDistrict'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5',
            },
            {
                key: 'updated_at',
                label: t('commonLastUpdate'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5',
            },
            {
                key: 'status',
                label: t('commonStatus'),
                headerClassName: 'py-4 px-5 font-medium',
                className: 'py-4 px-5',
                render: (_, zone) => (
                    <button
                        type="button"
                        onClick={() => handleStatusToggle(zone)}
                        className={`toggle-btn inline-flex h-6 w-11 items-center rounded-full px-[3px] transition-all duration-200 ${zone.status === 'active' ? 'bg-[#338dff] justify-end' : 'bg-[#d1e5ff] justify-start'} ${togglingZoneId === zone.id ? 'opacity-60' : ''}`}
                        aria-pressed={zone.status === 'active'}
                        aria-label={t('superAdminZonesToggleStatusAria', { name: zone.name })}
                        disabled={togglingZoneId === zone.id}
                    >
                        <span className="sr-only">{t('commonZoneStatus')}</span>
                        <span className="h-4 w-4 rounded-full bg-white shadow" />
                    </button>
                ),
            },
            {
                key: '__actions',
                label: t('commonAction'),
                headerClassName: 'py-4 px-5 font-medium text-right',
                className: 'py-4 px-5 text-right',
                align: 'right',
                render: (_, zone) => (
                    <div className="flex items-center justify-end gap-4 text-sm">
                        <button
                            type="button"
                            onClick={() => handleViewZoneAPI(zone)}
                            className="text-neutral-900 text-sm font-14px underline cursor-pointer"
                        >
                            {t('commonView')}
                        </button>
                        <button
                            type="button"
                            onClick={() => openEditDrawer(zone)}
                            className="text-neutral-900 text-sm font-14px underline cursor-pointer"
                        >
                            {t('commonEdit')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDelete(zone)}
                            className="text-neutral-900 text-sm font-14px underline cursor-pointer"
                        >
                            {t('commonDelete')}
                        </button>
                    </div>
                ),
            },
        ],
        [handleDelete, handleStatusToggle, openEditDrawer, renderAvailabilityPill, t, togglingZoneId],
    );

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('commonZoneManagement')}</h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <span className="font-medium text-[#64748b]">{t('commonZoneManagement')}</span>
                    </nav>
                </div>
            }
        >
            <Head title={t('commonZoneManagement')} />

            {/* Stats Cards and Map Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Left Side - 4 Stats Cards in 2x2 Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {summaryCards.map((card) => (
                        <StatsCard
                            key={card.label}
                            title={card.label}
                            value={card.value}
                            isSpecialCard={card.isSpecialCard ?? false}
                            iconSrc={card.icon}
                            accentColor="#338dff"
                        />
                    ))}
                </div>

                {/* Right Side - Map Card */}
                <div>
                    <Card
                        title={t('commonCreateZoneMap')}
                        contentClassName="p-0"
                        className="h-full"
                    >
                        <div className="relative h-full min-h-[300px]">
                            {isLoaded ? (
                                <div style={{ direction: 'ltr', height: '100%', minHeight: '300px' }}>
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%', minHeight: '300px' }}
                                        center={DEFAULT_MAP_CENTER}
                                        zoom={11}
                                        options={mapOptions}
                                        onLoad={handleMapLoad}
                                    >
                                        {zonePolygons.map((polygon) => (
                                            polygon.paths.map((path, index) => (
                                                <Polygon
                                                    key={`${polygon.id}-${index}`}
                                                    paths={path}
                                                    options={{
                                                        fillColor: polygon.color,
                                                        fillOpacity: 0.35,
                                                        strokeColor: polygon.color,
                                                        strokeOpacity: 0.9,
                                                        strokeWeight: 2,
                                                    }}
                                                    onMouseOver={() => setHoveredZoneId(polygon.id)}
                                                    onMouseOut={() => setHoveredZoneId((prev) => (prev === polygon.id ? null : prev))}
                                                />
                                            ))
                                        ))}
                                        {hoveredZoneId && zonePolygons
                                            .filter((polygon) => polygon.id === hoveredZoneId)
                                            .map((polygon) => (
                                                <OverlayView
                                                    key={`label-${polygon.id}`}
                                                    position={polygon.centroid}
                                                    mapPaneName={OverlayView.FLOAT_PANE}
                                                >
                                                    <div className="pointer-events-none inline-flex whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.15)] border border-slate-200">
                                                        {polygon.name}
                                                    </div>
                                                </OverlayView>
                                            ))}
                                    </GoogleMap>
                                </div>
                            ) : (
                                <div style={{ width: '100%', height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                                    <p>{t('commonLoadingMap')}</p>
                                </div>
                            )}
                            {/* Full View Button */}
                            <button
                                type="button"
                                onClick={() => router.visit(route('admin.zones.map-full-view'))}
                                className="pointer-events-auto absolute bottom-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#338DFF] text-white shadow-[0_12px_30px_rgba(51,141,255,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(51,141,255,0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 cursor-pointer"
                                aria-label={t('commonOpenMapFullViewAria')}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <path d="M8 3H3v5" />
                                    <path d="M3 3 9 9" />
                                    <path d="M16 21h5v-5" />
                                    <path d="m21 21-6-6" />
                                </svg>
                            </button>
                        </div>
                    </Card>
                </div>
            </section>

            <Card
                title={t('commonAllZones')}
                toolbar={(
                    <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
                        <div className="relative w-full md:w-64">
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder={t('commonSearch')}
                                className="w-full rounded-full border border-[#e2e8f0] bg-white px-12 py-2.5 text-sm text-[#1f2937] focus:outline-none focus:ring-4 focus:ring-[#338dff33]"
                            />
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
                        </div>
                        <PrimaryButton
                            text={isPreviewLoading ? t('commonFetching') : t('superAdminZonesFetchZonesFromApi')}
                            onClick={handleFetchPreview}
                            disabled={isPreviewLoading || isSyncing}
                            width="220px"
                            height="40px"
                            className="bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-200 shadow-emerald-500/30"
                        />
                        <button
                            type="button"
                            onClick={handleSyncZonePrices}
                            disabled={isSyncingZonePrices}
                            className="h-10 rounded-full bg-[#338dff] px-5 text-sm font-semibold text-white transition hover:bg-[#1f7df5] disabled:opacity-40 disabled:cursor-not-allowed"
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
                            onClick={handleExportZones}
                            disabled={isExportingZones}
                            className="h-10 rounded-full border border-[#0f172a] px-5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#f1f5f9] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isExportingZones ? t('commonExportingCsv') : t('superAdminZonesExportZonesCsv')}
                        </button>
                    </div>
                )}
                padding="none"
                contentClassName="p-0"
                className="overflow-hidden"
            >
                <Table
                    columns={tableColumns}
                    data={filteredZones}
                    keyField="id"
                    emptyMessage={t('commonNoZonesFound')}
                    className="bg-white"
                    tableClassName="min-w-[720px] text-[#475569]"
                    theadClassName="bg-[#f8fafc]"
                    tbodyClassName="text-[#1f2937]"
                    rowClassName={(_, index) => (index % 2 !== 0 ? 'bg-[#f5f7fb]' : '')}
                    pagination
                    paginationMode="client"
                    pageSize={pageSize}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    paginationMeta={paginationMeta}
                    showPaginationInfo
                    paginationDisabled={totalPages <= 1}
                    showPaginationControls={totalPages > 1}
                    paginationClassName="rounded-2xl border border-[#e2e8f0] bg-white text-sm text-[#475569] w-full"
                    minWidth="720px"
                />
            </Card>

            {drawerVisible && (
                <div className="fixed inset-0 z-40 transition-opacity duration-200" aria-hidden={!drawerOpen}>
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200"
                        style={{ opacity: drawerOpen ? 1 : 0 }}
                        onClick={closeDrawer}
                        aria-hidden="true"
                    />
                    <div
                        ref={drawerPanelRef}
                        className={`absolute inset-y-0 right-0 w-full max-w-[90vw] sm:max-w-[600px] lg:max-w-[700px] bg-white border border-[#d8dee9] shadow-[0_20px_45px_rgba(15,23,42,0.25)] rounded-l-[28px] flex flex-col transition-transform duration-300 ease-out h-screen overflow-hidden ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="zoneDrawerTitle"
                    >
                        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8f0]">
                            <div>
                                <h2 id="zoneDrawerTitle" className="text-lg font-semibold text-[#1f2937]">
                                    {isEditing ? t('commonEditZone') : t('commonCreateZone')}
                                </h2>
                                <p className="text-sm text-[#64748b]">
                                    {t('superAdminZonesDrawerDescription')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeDrawer}
                                className="rounded-full p-1 text-[#64748b] hover:text-[#1f2937] transition text-4xl"
                                aria-label={t('superAdminZonesClosePanelAria')}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 overflow-y-auto px-6 py-6 text-sm space-y-5">
                                {/* Validation errors */}
                                {nonFieldErrors.length > 0 && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                        {nonFieldErrors.map((message, index) => (
                                            <div key={index}>{message}</div>
                                        ))}
                                    </div>
                                )}

                                {/* Zone Name */}
                                <Input
                                    type="text"
                                    label={t('commonZoneName')}
                                    value={data.name}
                                    onChange={(event) => handleFieldChange('name', sanitizeTextInput(event.target.value))}
                                    onBeforeInput={(event) => {
                                        const data = event.data ?? '';
                                        // Disallow emojis and non-text symbols proactively
                                        if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(data) || /[\u2600-\u27BF\uFE0F\u200D]/.test(data)) {
                                            event.preventDefault();
                                        }
                                    }}
                                    onPaste={(event) => {
                                        const pasted = (event.clipboardData || window.clipboardData).getData('text');
                                        const sanitized = sanitizeTextInput(pasted);
                                        if (sanitized !== pasted) {
                                            event.preventDefault();
                                            const target = event.target;
                                            const start = target.selectionStart || 0;
                                            const end = target.selectionEnd || 0;
                                            const next = (target.value || '').slice(0, start) + sanitized + (target.value || '').slice(end);
                                            handleFieldChange('name', next);
                                        }
                                    }}
                                    placeholder=""
                                    error={errors.name}
                                />

                                {/* City / Region Dropdown */}
                                <div className="relative mb-5">
                                    <div className="relative z-50">
                                        <input
                                            ref={cityMenuTriggerRef}
                                            type="text"
                                            id="city-input"
                                            value={isCityMenuOpen ? citySearchTerm : (data.city ?? '')}
                                            onChange={(event) => {
                                                setCitySearchTerm(event.target.value);
                                                if (!isCityMenuOpen) {
                                                    setIsCityMenuOpen(true);
                                                }
                                            }}
                                            onFocus={() => {
                                                setCitySearchTerm('');
                                                setIsCityMenuOpen(true);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Escape') {
                                                    setIsCityMenuOpen(false);
                                                    setCitySearchTerm('');
                                                }
                                            }}
                                            placeholder=" "
                                            className={`w-full border border-gray-200 rounded-full pt-4 pr-10 pb-4 pl-5 input-field focus:outline-none peer ${errors.city ? 'border-red-500' : ''}`}
                                            aria-haspopup="listbox"
                                            aria-expanded={isCityMenuOpen}
                                            aria-controls="city-menu"
                                        />
                                        <label
                                            htmlFor="city-input"
                                            className={`font-semibold absolute left-6 transition-all duration-200 pointer-events-none
                                        top-4.5 text-sm text-[#338DFF]
                                        peer-focus:top-[-0.5rem]
                                        peer-focus:text-sm
                                        peer-focus:text-[#338DFF]
                                        peer-focus:bg-white
                                        peer-focus:px-1
                                        peer-[:not(:placeholder-shown)]:top-[-0.5rem]
                                        peer-[:not(:placeholder-shown)]:text-[#338DFF]
                                        peer-[:not(:placeholder-shown)]:bg-white
                                        peer-[:not(:placeholder-shown)]:px-1
                                        ${errors.city ? 'text-red-500 peer-focus:text-red-500' : ''}
                                    `}
                                        >
                                            {t('commonCityRegion')}
                                        </label>
                                        <div
                                            className="absolute right-3 top-4.5 w-5 h-5 text-gray-400 cursor-pointer"
                                            onClick={() => setIsCityMenuOpen((previous) => !previous)}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                className={`w-4 h-4 transition-transform ${isCityMenuOpen ? 'rotate-180' : ''}`}
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                            </svg>
                                        </div>
                                    </div>
                                    {errors.city && (
                                        <div className="text-red-500 text-sm mt-1">
                                            {errors.city}
                                        </div>
                                    )}

                                    {isCityMenuOpen && (
                                        <div
                                            id="city-menu"
                                            ref={cityMenuRef}
                                            className="absolute left-0 w-full z-40 top-full mt-1
                                            bg-white border border-[#e2e8f0]
                                            rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.08)]
                                            overflow-hidden
                                            max-h-[260px] overflow-y-auto
                                            animate-fadeIn"
                                        >
                                            <Menu
                                                className="w-full text-sm divide-y divide-gray-100"
                                                items={cityMenuItems.filter(item => item.value && item.label)}
                                                anchorRef={cityMenuTriggerRef}
                                                onItemClick={(item) => {
                                                    handleFieldChange('city', item.value);
                                                    setIsCityMenuOpen(false);
                                                    setCitySearchTerm('');
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {data.city ? (
                                        <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-3">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className="text-base font-semibold text-[#0f172a]">
                                                        {t('commonZoneManagement')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="rounded-2xl overflow-hidden border border-[#e2e8f0]" style={{ height: '400px' }}>
                                                {isLoaded && (
                                                    <MapDrawing
                                                        key={mapKey}
                                                        initialPaths={mapInitialPaths}
                                                        onPathsChange={handlePathsChange}
                                                        center={mapCenter}
                                                        zoom={data.city ? 13 : 11}
                                                        apiKey={googleMapsApiKey}
                                                    />
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleClearPaths}
                                                disabled={!canClearGeofence}
                                                className={`mt-4 inline-flex py-3 items-center justify-center rounded-xl px-3 text-xs font-medium transition ${canClearGeofence
                                                    ? 'bg-[#FFDBDB] text-[#FF3333] hover:bg-[#fcd6d6]'
                                                    : 'bg-[#FFDBDB] text-[#cd7474] opacity-80 cursor-not-allowed'
                                                    }`}
                                            >
                                                {t('superAdminZonesClearGeofence')}
                                            </button>
                                        </div>
                                    ) : (
                                        ''
                                    )}
                                    {renderError('drawn_paths')}
                                </div>
                            </div>
                            <div className="px-6 pb-6 pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4 border-t border-[#e2e8f0] bg-white">
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-[#338dff] px-8 py-3 text-base font-medium text-blue-500"
                                >
                                    {t('commonReset')}
                                </button>
                                <PrimaryButton
                                    type="submit"
                                    disabled={isSubmitting}
                                    text={isSubmitting ? t('commonSaving') : t('commonSaveZone')}
                                    className="w-full sm:w-auto px-8 py-3 text-base hover:-translate-y-[1px] hover:shadow-[0_14px_28px_rgba(51,141,255,0.3)]"
                                />
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={showDeleteDialog}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title={t('superAdminZonesDeleteTitle')}
                message={t('superAdminZonesDeleteMessage', { name: zoneToDelete?.name })}
                confirmText={t('commonDelete')}
                cancelText={t('commonCancel')}
                isProcessing={isDeleting}
            />

            {/* API Preview Modal */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">{t('superAdminZonesPreviewTitle')}</h2>
                            <button onClick={() => setShowPreviewModal(false)} className="text-gray-500 hover:text-gray-800 text-2xl" aria-label={t('commonPreviewCloseAria')}>&times;</button>
                        </div>
                        <div className="p-6 overflow-auto flex-1">
                            {isPreviewLoading ? (
                                <div className="text-center py-10 text-gray-500">{t('commonPreviewLoading')}</div>
                            ) : previewData.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">{t('commonPreviewEmpty')}</div>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                {Object.keys(previewData[0] || {}).map((key) => (
                                                    <th key={key} className="px-4 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {previewData.map((row, idx) => (
                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    {Object.keys(previewData[0] || {}).map((key) => {
                                                        const val = row[key];
                                                        const displayVal = typeof val === 'object' && val !== null
                                                            ? JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : '')
                                                            : String(val !== null && val !== undefined ? val : '');
                                                        return (
                                                            <td key={`${idx}-${key}`} className="px-4 py-2 whitespace-nowrap text-gray-800">
                                                                {displayVal}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setShowPreviewModal(false)} className="px-5 py-2 rounded-full border border-gray-300 font-medium hover:bg-gray-100">{t('commonCancel')}</button>
                            <button
                                onClick={() => { setShowPreviewModal(false); handleSyncZones(); }}
                                disabled={isPreviewLoading || previewData.length === 0}
                                className="px-5 py-2 rounded-full bg-[#10b981] text-white font-medium hover:bg-emerald-600 disabled:opacity-50"
                            >
                                {t('commonConfirmSync')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Single Zone API Preview Modal */}
            {showSinglePreviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">{t('superAdminZonesExternalApiTitle', { name: singlePreviewZoneName })}</h2>
                            <button onClick={() => setShowSinglePreviewModal(false)} className="text-gray-500 hover:text-gray-800 text-2xl" aria-label={t('superAdminZonesExternalApiCloseAria')}>&times;</button>
                        </div>
                        <div className="p-6 overflow-auto flex-1 bg-gray-50">
                            {isSinglePreviewLoading ? (
                                <div className="text-center py-10 text-gray-500">{t('superAdminZonesExternalApiFetching')}</div>
                            ) : singlePreviewData ? (
                                singlePreviewData.error ? (
                                    <div className="text-center py-10 text-red-500 font-medium">{singlePreviewData.error}</div>
                                ) : (
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                        <table className="min-w-full text-sm divide-y divide-gray-100 text-left">
                                            <tbody className="divide-y divide-gray-100">
                                                {Object.entries(singlePreviewData).map(([key, val]) => (
                                                    <tr key={key} className="hover:bg-gray-50 transition-colors">
                                                        <th className="px-4 py-3 font-medium text-gray-700 w-1/3 border-r border-gray-100 bg-gray-50/50">
                                                            {key}
                                                        </th>
                                                        <td className="px-4 py-3 text-gray-900 whitespace-pre-wrap break-words">
                                                            {typeof val === 'object' && val !== null
                                                                ? JSON.stringify(val, null, 2)
                                                                : String(val !== null && val !== undefined ? val : '-')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-10 text-gray-500">{t('superAdminZonesExternalApiNoData')}</div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-white rounded-b-2xl">
                            <button onClick={() => setShowSinglePreviewModal(false)} className="px-5 py-2 rounded-full bg-gray-800 text-white font-medium hover:bg-gray-700">{t('commonClose')}</button>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminAuthenticated>
    );
}
