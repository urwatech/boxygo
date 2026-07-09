import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import PrimaryButton from '../Components/PrimaryButton';
import Drawer from '../Components/Drawer';
import Table from '../../../Components/Common/Table';
import Card from '../../../Components/Common/Card';
import Input from '../../../Components/Common/Inputs/Input';
import ConfirmDialog from '../../../Components/SuperAdmin/ConfirmDialog';
import { GoogleMap, Marker, Polygon, useJsApiLoader } from '@react-google-maps/api';
import { cancelActiveSearch, reverseGeocode, searchLocations } from '../../../Services/LocationService';

const DEFAULT_MAP_CENTER = { lat: 33.5138, lng: 36.2765 };
const SYRIA_BOUNDS = {
    north: 37.31,
    south: 32.31,
    east: 42.45,
    west: 35.73,
};

const initialFormState = {
    name: '',
    address: '',
    city: '',
    zone_id: '',
    keeper_id: '',
    latitude: '',
    longitude: '',
    shelves: [],
};

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};

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
        return null;
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

const extractDropPointsPayload = (payload = {}) => {
    if (Array.isArray(payload.dropPoints)) {
        return payload.dropPoints;
    }

    if (Array.isArray(payload.drop_points)) {
        return payload.drop_points;
    }

    if (Array.isArray(payload.data)) {
        return payload.data;
    }

    return [];
};

const toCoordinate = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getLocationDrawingPoint = (dropPoint = {}) => {
    if (!Array.isArray(dropPoint.locationDrawing)) {
        return null;
    }

    return dropPoint.locationDrawing.find((item) => Array.isArray(item?.coords) && item.coords.length > 0)?.coords?.[0] ?? null;
};

const mapExternalDropPoint = (dropPoint = {}) => {
    const drawingPoint = getLocationDrawingPoint(dropPoint);
    const latitude = toCoordinate(
        dropPoint.locationLat
        ?? dropPoint.lat
        ?? dropPoint.latitude
        ?? drawingPoint?.lat
    );
    const longitude = toCoordinate(
        dropPoint.locationLng
        ?? dropPoint.lng
        ?? dropPoint.longitude
        ?? drawingPoint?.lng
    );

    return {
        ext_id: dropPoint.id !== undefined && dropPoint.id !== null
            ? String(dropPoint.id)
            : String(dropPoint.ext_id ?? ''),
        name: dropPoint.name ?? '',
        icon: dropPoint.icon ?? null,
        serial_no: dropPoint.serialNo ?? dropPoint.serial_no ?? null,
        dp_no: dropPoint.dPNo ?? dropPoint.dP_No ?? dropPoint.dp_no ?? null,
        open_hours: dropPoint.openHours ?? dropPoint.open_Hours ?? dropPoint.open_hours ?? null,
        zone_ext_id: dropPoint.zoneId !== undefined && dropPoint.zoneId !== null
            ? String(dropPoint.zoneId)
            : (dropPoint.zone_ext_id ? String(dropPoint.zone_ext_id) : null),
        address: dropPoint.address ?? dropPoint.locationStreet ?? dropPoint.zoneAddressStreet ?? '',
        city: dropPoint.city ?? dropPoint.locationCity ?? dropPoint.zoneAddressCity ?? dropPoint.goverName ?? '',
        latitude,
        longitude,
    };
};

const isIconUrl = (value = '') => {
    if (!value || typeof value !== 'string') {
        return false;
    }

    return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
};

export default function Index({ dropPoints, droppointUsers = [], allZones = [], allDropPoints = [], filters = {}, cities =  []}) {
    const page = usePage();
    const { t } = useTranslation();
    const config = page?.props?.config || {};
    const googleMapsApiKey = config?.GOOGLE_MAPS_API_KEY;
    const locationProvider = config?.LOCATION_AUTOCOMPLETE_PROVIDER || 'openstreetmap';
    const googlePlacesApiKey = config?.GOOGLE_PLACES_API_KEY;
    const useDirectGoogleApi = !!config?.USE_DIRECT_GOOGLE_API;
    const googleGeocodingApiKey = config?.GOOGLE_MAPS_API_KEY || config?.GOOGLE_PLACES_API_KEY || '';
    const reverseGeocodeProvider = googleGeocodingApiKey ? 'google' : 'openstreetmap';
    
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey,
        libraries: ['drawing'],
    });

    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [dropPointToDelete, setDropPointToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const [locationQuery, setLocationQuery] = useState('');
    const [locationResults, setLocationResults] = useState([]);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
    const [isLocationTyping, setIsLocationTyping] = useState(false);
    const locationMenuRef = useRef(null);
    const locationInputRef = useRef(null);

    const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);
    const zoneMenuRef = useRef(null);
    const zoneInputRef = useRef(null);

    const [isKeeperMenuOpen, setIsKeeperMenuOpen] = useState(false);
    const [availableKeepers, setAvailableKeepers] = useState(droppointUsers);
    const keeperMenuRef = useRef(null);
    const keeperInputRef = useRef(null);

    const citySelectRef = useRef(null);
    const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
    const cityMenuRef = useRef(null);
    const [subDistricts, setSubDistricts] = useState([]);

    const { data, setData, post, put, reset, processing, errors, clearErrors, setDefaults } = useForm(initialFormState);

    const [shelfInput, setShelfInput] = useState('');

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

    const selectedPosition = useMemo(() => {
        const lat = toNumber(data.latitude);
        const lng = toNumber(data.longitude);
        if (lat === null || lng === null) {
            return null;
        }
        return { lat, lng };
    }, [data.latitude, data.longitude]);

    const selectedKeeper = useMemo(() => {
        if (!data.keeper_id) {
            return null;
        }

        return availableKeepers.find((keeper) => String(keeper.id) === String(data.keeper_id)) ?? null;
    }, [availableKeepers, data.keeper_id]);

    const mapCenter = selectedPosition ?? DEFAULT_MAP_CENTER;

    useEffect(() => {
        const handler = setTimeout(() => {
            const previousSearch = filters.search ?? '';
            if (searchTerm === previousSearch) {
                return;
            }

            router.get(route('admin.drop-points.index'), { search: searchTerm || undefined }, {
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
        if (!drawerOpen) {
            setLocationQuery('');
            setLocationResults([]);
            setLocationError('');
            setIsLocationMenuOpen(false);
            setIsLocationTyping(false);
            cancelActiveSearch();
        }
    }, [drawerOpen]);

    useEffect(() => {
        if (!drawerOpen || !isLocationTyping) {
            return undefined;
        }

        const trimmed = locationQuery.trim();

        if (trimmed.length < 3) {
            setLocationResults([]);
            setLocationError('');
            setIsLocationMenuOpen(false);
            cancelActiveSearch();
            return undefined;
        }

        const handle = setTimeout(async () => {
            setLocationLoading(true);
            setLocationError('');
            try {
                const results = await searchLocations(trimmed, {
                    provider: locationProvider,
                    googlePlacesApiKey,
                    useDirectGoogleApi,
                    countryCode: 'sy',
                    limit: 6,
                });
                setLocationResults(results);
                setIsLocationMenuOpen(true);
            } catch (error) {
                setLocationError(t('superAdminDropPointsLocationSearchError'));
                setLocationResults([]);
            } finally {
                setLocationLoading(false);
            }
        }, 350);

        return () => {
            clearTimeout(handle);
            cancelActiveSearch();
        };
    }, [locationQuery, locationProvider, googlePlacesApiKey, useDirectGoogleApi, drawerOpen, isLocationTyping, t]);

    useEffect(() => {
        if (!isLocationMenuOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                locationMenuRef.current?.contains(event.target)
                || locationInputRef.current?.contains(event.target)
            ) {
                return;
            }

            setIsLocationMenuOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isLocationMenuOpen]);

    useEffect(() => {
        if (!isZoneMenuOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                zoneMenuRef.current?.contains(event.target)
                || zoneInputRef.current?.contains(event.target)
            ) {
                return;
            }

            setIsZoneMenuOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isZoneMenuOpen]);

    useEffect(() => {
        if (!isKeeperMenuOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (
                keeperMenuRef.current?.contains(event.target)
                || keeperInputRef.current?.contains(event.target)
            ) {
                return;
            }

            setIsKeeperMenuOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isKeeperMenuOpen]);

    useEffect(() => {
        setAvailableKeepers(droppointUsers);
    }, [droppointUsers]);

    useEffect(() => {
        if (!isCityMenuOpen) {
            return undefined;
        }

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

    const openCreateDrawer = () => {
        setEditingId(null);
        const defaults = { ...initialFormState };
        setDefaults(defaults);
        setData(defaults);
        setAvailableKeepers(droppointUsers);
        setLocationQuery('');
        setLocationResults([]);
        setLocationError('');
        setIsLocationTyping(false);
        setShelfInput('');
        clearErrors();
        setDrawerOpen(true);
    };

    const openEditDrawer = (dropPoint) => {
        setAvailableKeepers(droppointUsers);
        const currentKeeperId = dropPoint.keeper?.id ?? dropPoint.keeper_id;
        if (currentKeeperId && dropPoint.keeper && !availableKeepers.find(k => k.id === currentKeeperId)) {
            setAvailableKeepers(prev => [dropPoint.keeper, ...prev]);
        }

        setEditingId(dropPoint.id);
        const defaults = {
            name: dropPoint.name ?? '',
            address: dropPoint.address ?? '',
            city: dropPoint.city ?? '',
            zone_id: dropPoint.zone?.zone_id ?? dropPoint.zone_id ?? '',
            keeper_id: dropPoint.keeper?.id ?? dropPoint.keeper_id ?? '',
            latitude: dropPoint.latitude ?? '',
            longitude: dropPoint.longitude ?? '',
            shelves: dropPoint.shelves ?? [],
        };
        setDefaults(defaults);
        setData(defaults);
        setLocationQuery(dropPoint.address ?? '');
        setLocationResults([]);
        setLocationError('');
        setIsLocationTyping(false);
        setShelfInput('');
        clearErrors();
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        reset();
        clearErrors();
        setShelfInput('');
    };

    const handleLocationSelect = (location) => {
        if (!location) {
            return;
        }

        const nextCity = location?.components?.city
            || location?.components?.governorate
            || location?.components?.state
            || '';

        setData({
            ...data,
            address: location.address || '',
            city: nextCity,
            zone_id: '',
            latitude: location.lat ?? '',
            longitude: location.lon ?? '',
        });
        setLocationQuery(location.address || '');
        setLocationResults([]);
        setLocationError('');
        setIsLocationMenuOpen(false);
        setIsLocationTyping(false);
    };

    const handleCitySelect = (cityName) => {
        const city = cities.find((item) => item.name === cityName);
        setData({
            ...data,
            city: cityName,
            zone_id: '',
        });
        setIsCityMenuOpen(false);
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                closeDrawer(),
                setAvailableKeepers(droppointUsers);
                window.location.reload()
                // router.reload({ only: ['dropPoints', 'droppointUsers', 'allZones'] });
            },
        };

        if (editingId) {
            put(route('admin.drop-points.update', editingId), options);
        } else {
            post(route('admin.drop-points.store'), options);
        }
    };

    const handleSyncDropPoints = () => {
        setIsSyncing(true);
        router.post(route('admin.drop-points.sync'), { drop_points: previewData }, {
            preserveScroll: true,
            preserveState: true,
            onError: (syncErrors) => {
                console.error('Error syncing drop points:', syncErrors);
            },
            onFinish: () => {
                setIsSyncing(false);
                setShowPreviewModal(false);
            },
        });
    };

    const handleFetchPreview = async () => {
        setIsPreviewLoading(true);
        setShowPreviewModal(true);
        setPreviewData([]);
        try {
            const response = await fetch(route('admin.drop-points.preview'));
            const result = await response.json();
            const payload = extractDropPointsPayload(result);
            const mappedDropPoints = payload
                .map((dropPoint) => mapExternalDropPoint(dropPoint))
                .filter((dropPoint) => dropPoint.ext_id);

            setPreviewData(mappedDropPoints);
        } catch (error) {
            console.error('Failed to fetch drop points preview data', error);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleMarkerDragEnd = async (event) => {
        const lat = event?.latLng?.lat?.();
        const lng = event?.latLng?.lng?.();
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return;
        }

        setData('latitude', lat);
        setData('longitude', lng);

        try {
            const result = await reverseGeocode(lat, lng, {
                provider: reverseGeocodeProvider,
                googleGeocodingApiKey,
            });
            const nextCity = result?.components?.city
                || result?.components?.governorate
                || result?.components?.state
                || '';
            setData('address', result?.address || '');
            setData('city', nextCity);
            setData('zone_id', '');
            setLocationQuery(result?.address || '');
            setLocationError('');
            setIsLocationTyping(false);
        } catch (error) {
            setLocationError(t('superAdminDropPointsLocationPinError'));
        }
    };

    const handleDelete = (dropPoint) => {
        setDropPointToDelete(dropPoint);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = () => {
        if (!dropPointToDelete) return;

        setIsDeleting(true);
        router.delete(route('admin.drop-points.destroy', dropPointToDelete.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
            },
            onSuccess: () => {
                setShowDeleteDialog(false);
                setDropPointToDelete(null);
            },
        });
    };

    const filteredZones = useMemo(() => {
        if (!data.city) {
            return [];
        }

        const normalize = (s) => (s || '')
            .toLowerCase()
            .replace(/ governorate$/i, '')
            .replace(/ governate$/i, '')
            .trim();

        const normalizedInputCity = normalize(data.city);

        return allZones.filter((zone) => normalize(zone.city) === normalizedInputCity);
    }, [data.city, allZones]);

    useEffect(() => {
        const nextSubDistricts = Array.from(
            new Set(
                filteredZones
                    .map((zone) => zone?.sub_district_name)
                    .filter((value) => typeof value === 'string' && value.trim() !== '')
                    .map((value) => value.trim())
            )
        );

        setSubDistricts(nextSubDistricts);
    }, [filteredZones]);

    // console.log("filteredZones", allZones);
    

    // const mapCenter = useMemo(() => {
    //     if (selectedPosition) return selectedPosition;

    //     if (selectedZone?.normalizedPaths?.length > 0) {
    //         const centroid = getPolygonCentroid(selectedZone.normalizedPaths);
    //         if (centroid) return centroid;
    //     }

    //     return DEFAULT_MAP_CENTER;
    // }, [selectedPosition, selectedZone]);

    const selectedZone = useMemo(() => {
        if (!data.zone_id) return null;
        const zone = allZones.find((z) => z.id === parseInt(data.zone_id));
        if (!zone) return null;

        return {
            ...zone,
            normalizedPaths: normalizePaths(zone.drawn_paths)
        };
    }, [data.zone_id, allZones]);

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

    const dropPointsData = useMemo(
        () => (dropPoints?.data ?? []).map((dropPoint) => ({
            ...dropPoint,
            dp_number: dropPoint?.dp_no || t('commonNotAvailable'),
            zone_name: dropPoint?.zone?.name || t('commonNotAvailable'),
            assigned_dp_keeper: dropPoint?.keeper?.name || t('commonNotAvailable'),
        })),
        [dropPoints, t],
    );

    const paginationMeta = useMemo(
        () => ({
            currentPage: dropPoints?.current_page ?? 1,
            totalPages: dropPoints?.last_page ?? 1,
            from: dropPoints?.from ?? 0,
            to: dropPoints?.to ?? 0,
            total: dropPoints?.total ?? 0,
        }),
        [dropPoints],
    );

    const tableColumns = useMemo(() => [
        {
            key: 'name',
            label: t('commonDropPointName'),
            headerClassName: 'py-4 px-5 font-medium',
            className: 'py-4 px-5 font-medium text-[#0f172a]',
            render: (value, row) => {
                const icon = row?.icon;

                return (
                    <div className="inline-flex items-center gap-2">
                        {icon ? (
                            isIconUrl(icon) ? (
                                <img
                                    src={icon}
                                    alt={t('commonIconAlt', { name: row?.name || t('superAdminDropPointsItemFallback') })}
                                    className="h-6 w-6 rounded object-cover shrink-0"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#f1f5f9] text-sm leading-none shrink-0">
                                    {icon}
                                </span>
                            )
                        ) : null}
                        <span>{value}</span>
                    </div>
                );
            },
        },
        {
            key: 'dp_number',
            label: t('commonDpNumber'),
            headerClassName: 'py-4 px-5 font-medium',
            className: 'py-4 px-5',
        },
        {
            key: 'assigned_dp_keeper',
            label: t('superAdminDropPointsColumnAssignedKeeper'),
            headerClassName: 'py-4 px-5 font-medium',
            className: 'py-4 px-5',
        },
        {
            key: 'zone_name',
            label: t('commonZoneName'),
            headerClassName: 'py-4 px-5 font-medium',
            className: 'py-4 px-5',
        },
        {
            key: 'address',
            label: t('commonAddress'),
            headerClassName: 'py-4 px-5 font-medium',
            className: 'py-4 px-5',
        },
        {
            key: 'created_at',
            label: t('superAdminDropPointsColumnCreatedOn'),
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
            key: '__actions',
            label: t('commonAction'),
            headerClassName: 'py-4 px-5 font-medium text-right',
            className: 'py-4 px-5 text-right',
            align: 'right',
            render: (_, dropPoint) => (
                <div className="flex items-center justify-end gap-4 text-sm">
                    <button
                        type="button"
                        onClick={() => openEditDrawer(dropPoint)}
                        className="text-neutral-900 text-sm font-14px underline cursor-pointer"
                    >
                        {t('commonEdit')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDelete(dropPoint)}
                        className="text-red-600 text-sm font-14px underline cursor-pointer"
                    >
                        {t('commonDelete')}
                    </button>
                </div>
            ),
        },
    ], [t]);

    const handlePageChange = (page) => {
        router.get(
            route('admin.drop-points.index'),
            { page, search: searchTerm || undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    return (
        <SuperAdminAuthenticated
            headerContent={(
                <div>
                    <h2 className="text-lg font-semibold text-[#111827]">{t('commonDropPoints')}</h2>
                    <nav className="text-sm text-[#338DFF]">
                        {t('commonHome')}
                        <span className="mx-2 text-gray-400">&rsaquo;</span>
                        <span className="text-gray-500">{t('commonDropPoints')}</span>
                    </nav>
                </div>
            )}
        >
            <Head title={t('commonDropPoints')} />

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                { /* Drop Points Map - temporarily disabled */ }
{/*
                <Card
                    title="Drop Points Map"
                    contentClassName="p-0"
                    className="h-full"
                >
                    <div className="relative h-full min-h-[320px]">
                        {isLoaded ? (
                            <div style={{ direction: 'ltr', height: '100%', minHeight: '320px' }}>
                                <GoogleMap
                                    mapContainerStyle={{ width: '100%', height: '100%', minHeight: '320px' }}
                                    center={DEFAULT_MAP_CENTER}
                                    zoom={11}
                                    options={mapOptions}
                                >
                                    {Array.isArray(allDropPoints) && allDropPoints.map((dropPoint) => (
                                        dropPoint.latitude && dropPoint.longitude ? (
                                            <Marker
                                                key={dropPoint.id}
                                                position={{
                                                    lat: Number(dropPoint.latitude),
                                                    lng: Number(dropPoint.longitude),
                                                }}
                                                title={dropPoint.name}
                                            />
                                        ) : null
                                    ))}
                                </GoogleMap>
                            </div>
                        ) : (
                            <div className="flex h-full min-h-[320px] items-center justify-center bg-[#f5f5f5]">
                                <p>Loading map...</p>
                            </div>
                        )}
                    </div>
                </Card> */}



            </section>

            <Card
                title={t('superAdminDropPointsCardTitle')}
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
                            text={isPreviewLoading ? t('commonFetching') : t('superAdminDropPointsFetchFromApi')}
                            onClick={handleFetchPreview}
                            disabled={isPreviewLoading || isSyncing}
                            width="260px"
                            height="40px"
                            className="bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-200 shadow-emerald-500/30"
                        />
                        {/* <PrimaryButton
                            text="Create Drop Point"
                            onClick={openCreateDrawer}
                            width="180px"
                            height="40px"
                        /> */}
                    </div>
                )}
                padding="none"
                contentClassName="p-0"
                className="overflow-hidden"
            >
                <Table
                    columns={tableColumns}
                    data={dropPointsData}
                    keyField="id"
                    emptyMessage={t('superAdminDropPointsEmptyMessage')}
                    className="bg-white"
                    tableClassName="min-w-[720px] text-[#475569]"
                    theadClassName="bg-[#f8fafc]"
                    tbodyClassName="text-[#1f2937]"
                    rowClassName={(_, index) => (index % 2 !== 0 ? 'bg-[#f5f7fb]' : '')}
                    pagination
                    currentPage={paginationMeta.currentPage}
                    totalPages={paginationMeta.totalPages}
                    onPageChange={handlePageChange}
                    paginationMeta={paginationMeta}
                    showPaginationInfo
                    paginationClassName="rounded-2xl border border-[#e2e8f0] bg-white text-sm text-[#475569] w-full"
                    minWidth="720px"
                />
            </Card>

            <Drawer
                open={drawerOpen}
                onClose={closeDrawer}
                title={editingId ? t('superAdminDropPointsDrawerEditTitle') : t('superAdminDropPointsDrawerCreateTitle')}
                description={t('superAdminDropPointsDrawerDescription')}
                maxWidth="720px"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        type="text"
                        label={t('commonDropPointName')}
                        value={data.name}
                        onChange={(event) => setData('name', event.target.value)}
                        error={errors.name}
                    />

                    <div className="relative">
                        <Input
                            ref={locationInputRef}
                            type="text"
                            label={t('superAdminDropPointsFieldSearchLocation')}
                            value={locationQuery}
                            onChange={(event) => {
                                setLocationQuery(event.target.value);
                                setIsLocationTyping(true);
                            }}
                            onFocus={() => {
                                if (locationResults.length > 0) {
                                    setIsLocationMenuOpen(true);
                                }
                            }}
                            placeholder={t('superAdminDropPointsSearchLocationPlaceholder')}
                            labelClassName="top-[-0.5rem] bg-white px-1"
                            error={locationError}
                        />
                        {isLocationMenuOpen && (
                            <div
                                ref={locationMenuRef}
                                className="absolute z-40 mt-2 w-full rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] max-h-[260px] overflow-y-auto"
                            >
                                {locationLoading ? (
                                    <div className="px-4 py-3 text-sm text-[#64748b]">{t('superAdminDropPointsSearching')}</div>
                                ) : locationResults.length > 0 ? (
                                    locationResults.map((result, index) => (
                                        <button
                                            type="button"
                                            key={`${result.address}-${index}`}
                                            onClick={() => handleLocationSelect(result)}
                                            className="w-full text-left px-4 py-3 text-sm text-[#0f172a] hover:bg-[#f5f7fb] border-t border-[#eef1f7] first:border-t-0"
                                        >
                                            {result.address}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm text-[#64748b]">
                                        {t('superAdminDropdownNoResultsFound')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {(errors.latitude || errors.longitude) && (
                        <p className="text-red-500 text-xs mt-1">
                            {errors.latitude ?? errors.longitude}
                        </p>
                    )}

                    <div>
                        <label className="text-sm font-medium text-[#338DFF]" htmlFor="city-select">
                            {t('commonCity')}
                        </label>
                        <div className="relative mt-2">
                            <button
                                type="button"
                                ref={citySelectRef}
                                onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}
                                className="w-full text-left rounded-[24px] border border-[#E3E8F4] bg-white px-4 py-3 text-[#111827] focus:border-[#338DFF] focus:outline-none focus:ring-4 focus:ring-[#338dff33] flex items-center justify-between"
                                id="city-select"
                            >
                                <span>{data.city || t('commonSelectCity')}</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className={`w-4 h-4 text-[#64748b] transition-transform ${isCityMenuOpen ? 'rotate-180' : ''}`}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                            </button>
                            {isCityMenuOpen && (
                                <div
                                    ref={cityMenuRef}
                                    className="absolute z-40 mt-2 w-full rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] max-h-[260px] overflow-y-auto"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleCitySelect('')}
                                        className="w-full text-left px-4 py-3 text-sm text-[#64748b] hover:bg-[#f5f7fb]"
                                    >
                                        {t('commonNone')}
                                    </button>
                                    {cities.map((city) => (
                                        <button
                                            key={city.id}
                                            type="button"
                                            onClick={() => handleCitySelect(city.name)}
                                            className="w-full text-left px-4 py-3 text-sm text-[#0f172a] hover:bg-[#f5f7fb] border-t border-[#eef1f7] first:border-t-0 transition-colors"
                                        >
                                            <div className="font-medium">{city.name}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {errors.city && (
                            <p className="text-red-500 text-xs mt-1">{errors.city}</p>
                        )}
                    </div>

                    {data.city && subDistricts.length > 0 && (
                        <div className="rounded-[24px] border border-[#E3E8F4] bg-[#F8FBFF] px-5 py-4">
                            <h3 className="text-sm font-semibold text-[#0f172a]">{t('superAdminDropPointsSubDistricts')}</h3>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {subDistricts.map((name) => (
                                    <div key={name} className="rounded-full border border-[#D6E4FF] bg-white px-3 py-2 text-sm text-[#111827]">
                                        <span className="font-medium">{name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Zone Dropdown */}
                    <div className="relative">
                        <label className="text-sm font-medium text-[#338DFF]" htmlFor="zone-select">
                            {t('commonSelectZone')}
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <button
                            ref={zoneInputRef}
                            type="button"
                            onClick={() => setIsZoneMenuOpen(!isZoneMenuOpen)}
                            className="mt-2 w-full text-left rounded-[24px] border border-[#E3E8F4] bg-white px-4 py-3 text-[#111827] focus:border-[#338DFF] focus:outline-none focus:ring-4 focus:ring-[#338dff33] flex items-center justify-between"
                            id="zone-select"
                        >
                            <span>
                                {data.zone_id
                                    ? filteredZones.find((z) => z.id === parseInt(data.zone_id))?.name
                                    : t('superAdminDropPointsSelectZone')}
                            </span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={`w-4 h-4 text-[#64748b] transition-transform ${isZoneMenuOpen ? 'rotate-180' : ''}`}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                        {isZoneMenuOpen && (
                            <div
                                ref={zoneMenuRef}
                                className="absolute z-40 mt-2 w-full rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] max-h-[260px] overflow-y-auto"
                            >
                                {!data.city ? (
                                    <div className="px-4 py-3 text-sm text-[#64748b]">
                                        {t('commonSelectCityFirst')}
                                    </div>
                                ) : filteredZones.length > 0 ? (
                                    filteredZones.map((zone) => (
                                        <button
                                            type="button"
                                            key={zone.id}
                                            onClick={() => {
                                                setData('zone_id', zone.id);
                                                setIsZoneMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-[#0f172a] hover:bg-[#f5f7fb] border-t border-[#eef1f7] first:border-t-0 transition-colors"
                                        >
                                            <div className="font-medium">{zone.name}</div>
                                            <div className="text-xs text-[#64748b] mt-0.5">{zone.code}</div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm text-[#64748b]">
                                        {t('superAdminDropPointsNoZonesInSelectedCity')}
                                    </div>
                                )}
                            </div>
                        )}
                        {errors.zone_id && (
                            <p className="text-red-500 text-xs mt-1">{errors.zone_id}</p>
                        )}
                    </div>

                    {/* Keeper Dropdown (optional) */}
                    <div className="relative">
                        <label className="text-sm font-medium text-[#338DFF]" htmlFor="keeper-select">
                            {t('superAdminDropPointsFieldSelectKeeper')}
                        </label>
                        <button
                            ref={keeperInputRef}
                            type="button"
                            onClick={() => setIsKeeperMenuOpen(!isKeeperMenuOpen)}
                            className="mt-2 w-full text-left rounded-[24px] border border-[#E3E8F4] bg-white px-4 py-3 text-[#111827] focus:border-[#338DFF] focus:outline-none focus:ring-4 focus:ring-[#338dff33] flex items-center justify-between"
                            id="keeper-select"
                        >
                            <span>
                                {data.keeper_id
                                    ? availableKeepers.find((u) => u.id === parseInt(data.keeper_id))?.name
                                    : t('superAdminDropPointsSelectKeeper')}
                            </span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={`w-4 h-4 text-[#64748b] transition-transform ${isKeeperMenuOpen ? 'rotate-180' : ''}`}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                        {isKeeperMenuOpen && (
                            <div
                                ref={keeperMenuRef}
                                className="absolute z-40 mt-2 w-full rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] max-h-[260px] overflow-y-auto"
                            >
                                {availableKeepers.length > 0 ? (
                                    availableKeepers.map((user) => (
                                        <button
                                            type="button"
                                            key={user.id}
                                            onClick={() => {
                                                setData('keeper_id', user.id);
                                                setIsKeeperMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-[#0f172a] hover:bg-[#f5f7fb] border-t border-[#eef1f7] first:border-t-0 transition-colors"
                                        >
                                            <div className="font-medium">{user.name}</div>
                                            {user.phone_number && (
                                                <div className="text-xs text-[#64748b] mt-0.5">{user.phone_number}</div>
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm text-[#64748b]">
                                        {t('superAdminDropPointsNoUsersAvailable')}
                                    </div>
                                )}
                            </div>
                        )}
                        {errors.keeper_id && (
                            <p className="text-red-500 text-xs mt-1">{errors.keeper_id}</p>
                        )}
                    </div>

                    {selectedKeeper && (
                        <div className="rounded-[24px] border border-[#E3E8F4] bg-[#F8FBFF] px-5 py-4">
                            <h3 className="text-sm font-semibold text-[#0f172a]">{t('superAdminDropPointsKeeperDetails')}</h3>
                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">{t('commonName')}</p>
                                    <p className="mt-1 text-sm text-[#111827]">{selectedKeeper.name || t('commonNotAvailable')}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">{t('commonPhone')}</p>
                                    <p className="mt-1 text-sm text-[#111827]">{selectedKeeper.phone_number || t('commonNotAvailable')}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">{t('commonAddress')}</p>
                                    <p className="mt-1 text-sm text-[#111827]">
                                        {selectedKeeper.address ?? t('commonNotAvailable')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">{t('commonEmployment')}</p>
                                    <p className="mt-1 text-sm text-[#111827]">
                                        { selectedKeeper.employment_type ?? t('commonNotAvailable')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

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

                    <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-3">
                        <div className="rounded-2xl overflow-hidden border border-[#e2e8f0]" style={{ height: '320px' }}>
                            {isLoaded ? (
                                <div style={{ direction: 'ltr', height: '100%' }}>
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                        center={mapCenter}
                                        zoom={selectedPosition ? 14 : 11}
                                        options={mapOptions}
                                    >
                                        {selectedPosition && (
                                            <Marker
                                                position={selectedPosition}
                                                draggable
                                                onDragEnd={handleMarkerDragEnd}
                                            />
                                        )}
                                        {selectedZone?.normalizedPaths?.map((path, idx) => (
                                            <Polygon
                                                key={`${selectedZone.id}-${idx}`}
                                                paths={path}
                                                options={{
                                                    fillColor: '#338DFF',
                                                    fillOpacity: 0.2,
                                                    strokeColor: '#338DFF',
                                                    strokeOpacity: 0.8,
                                                    strokeWeight: 2,
                                                }}
                                            />
                                        ))}
                                    </GoogleMap>
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center bg-[#f5f5f5] text-sm text-[#64748b]">
                                    {t('commonLoadingMap')}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-2">
                        <button
                            type="button"
                            onClick={closeDrawer}
                            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-[#338dff] px-8 py-3 text-base font-medium text-blue-500"
                        >
                            {t('commonCancel')}
                        </button>
                        <PrimaryButton
                            type="submit"
                            disabled={processing}
                            text={processing ? t('commonSaving') : (editingId ? t('superAdminDropPointsButtonUpdate') : t('superAdminDropPointsButtonSave'))}
                            className="w-full sm:w-auto px-8 py-3 text-base hover:-translate-y-[1px] hover:shadow-[0_14px_28px_rgba(51,141,255,0.3)]"
                        />
                    </div>
                </form>
            </Drawer>

            <ConfirmDialog
                open={showDeleteDialog}
                onClose={() => {
                    setShowDeleteDialog(false);
                    setDropPointToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                title={t('superAdminDropPointsDeleteTitle')}
                message={t('superAdminDropPointsDeleteMessage', { name: dropPointToDelete?.name ?? t('superAdminDropPointsItemFallback') })}
                confirmText={t('commonDelete')}
                cancelText={t('commonCancel')}
                isProcessing={isDeleting}
            />

            {showPreviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">{t('superAdminDropPointsPreviewTitle')}</h2>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="text-gray-500 hover:text-gray-800 text-2xl"
                                aria-label={t('commonPreviewCloseAria')}
                            >
                                &times;
                            </button>
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
                                                    <th key={key} className="px-4 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">
                                                        {key}
                                                    </th>
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
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="px-5 py-2 rounded-full border border-gray-300 font-medium hover:bg-gray-100"
                            >
                                {t('commonCancel')}
                            </button>
                            <button
                                onClick={handleSyncDropPoints}
                                disabled={isPreviewLoading || previewData.length === 0 || isSyncing}
                                className="px-5 py-2 rounded-full bg-[#10b981] text-white font-medium hover:bg-emerald-600 disabled:opacity-50"
                            >
                                {isSyncing ? t('superAdminDropPointsSyncing') : t('commonConfirmSync')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminAuthenticated>
    );
}
