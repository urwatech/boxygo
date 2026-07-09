import React, { useState, useRef, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import Menu from '../../../../Components/Common/Menu';
import { useTranslation } from 'react-i18next';

const PROTECTED_MOBILE_PERMISSIONS = [
    { labelKey: 'superAdminRolesFormProtectedViewAssignedJobs', permission: 'jobs.view', defaultChecked: true },
    { labelKey: 'superAdminRolesFormProtectedUpdateJobStatus', permission: 'jobs.update', defaultChecked: true },
    { labelKey: 'superAdminRolesFormProtectedProfile', permission: 'profile.view', defaultChecked: true },
    { labelKey: 'superAdminRolesFormProtectedNavigationRoute', permission: 'navigation.route', defaultChecked: true },
    { labelKey: 'superAdminRolesFormProtectedCodCollection', permission: 'cod.payment.collect', defaultChecked: true },
    { labelKey: 'superAdminRolesFormProtectedNotifications', permission: 'notifications.view', defaultChecked: true },
    { labelKey: 'superAdminRolesFormProtectedAdditionalQrCode', permission: 'jobs.scan', defaultChecked: false },
];

export default function Form({ data, setData, processing, errors, permissions, submitRoute, cancelRoute, isEdit = false, isProtected = false }) {
    const { t } = useTranslation();
    const [showCountryMenu, setShowCountryMenu] = useState(false);
    const [showSubAreaMenu, setShowSubAreaMenu] = useState(false);
    const countryMenuRef = useRef(null);
    const subAreaMenuRef = useRef(null);
    const showLocationSelectors = false; // hide governorate/sub-area dropdowns for roles
    const normalizeText = (value) => (value ?? '').trim().toLowerCase();
    const normalizePlatform = (value) => normalizeText(value);
    const normalizeRoleName = (value) => normalizeText(value);
    const platformAlias = (value) => {
        const normalized = normalizePlatform(value);
        if (['mobile app', 'mobile application'].includes(normalized)) {
            return 'mobile';
        }
        if (normalized === 'admin portal') {
            return 'admin';
        }
        if (normalized === 'customer portal') {
            return 'customer';
        }
        return normalized;
    };

    const currentPlatformKey = platformAlias(data.platform);
    const isMobilePlatform = currentPlatformKey === 'mobile';
    const shouldShowProtectedMobilePermissions = isProtected && isMobilePlatform;

    const countryOptions = [
        { label: t('cityDamascus'), value: 'Damascus' },
        { label: t('cityAleppo'), value: 'Aleppo' },
        { label: t('cityHoms'), value: 'Homs' },
        { label: t('superAdminRolesFormCountryLatakia'), value: 'Latakia' },
    ];

    const subAreaOptions = [
        { label: t('commonSubAreaExample'), value: 'Al-Mazzeh' },
        { label: t('superAdminRolesFormSubAreaAlMidan'), value: 'Al-Midan' },
        { label: t('superAdminRolesFormSubAreaBaramkeh'), value: 'Baramkeh' },
    ];

    const handleCountrySelect = (item) => {
        setData('country', item.value);
        setShowCountryMenu(false);
    };

    const handleSubAreaSelect = (item) => {
        setData('sub_area', item.value);
        setShowSubAreaMenu(false);
    };

    useEffect(() => {
        if (!showCountryMenu && !showSubAreaMenu) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            const countryNode = countryMenuRef.current;
            const subAreaNode = subAreaMenuRef.current;

            if (showCountryMenu && countryNode && !countryNode.contains(event.target)) {
                setShowCountryMenu(false);
            }
            if (showSubAreaMenu && subAreaNode && !subAreaNode.contains(event.target)) {
                setShowSubAreaMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside, { passive: true });

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showCountryMenu, showSubAreaMenu]);
    // Define permission hierarchy: Modules -> Features -> Permission Levels
    const PERMISSION_HIERARCHY = {
        // Admin Portal Modules
        'admin.access': {
            displayName: t('superAdminRolesFormModuleDashboardAccess'),
            platform: 'Admin Portal',
            modulePermission: 'admin.access',
            features: [
                {
                    name: t('superAdminRolesFormFeatureAccessAdminDashboard'),
                    permissions: {
                        view: 'admin.access',
                        add: null,
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'employees.manage': {
            displayName: t('superAdminRolesFormModuleEmployeeManagement'),
            platform: 'Admin Portal',
            modulePermission: 'employees.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureManageEmployees'),
                    permissions: {
                        view: 'employees.view',
                        add: 'employees.create',
                        edit: 'employees.edit',
                        full: 'employees.delete'
                    }
                }
            ]
        },
        'customers.manage': {
            displayName: t('superAdminRolesFormModuleCustomerInformation'),
            platform: 'Admin Portal',
            modulePermission: 'customers.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewCustomers'),
                    permissions: {
                        view: 'customers.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'roles.manage': {
            displayName: t('superAdminRolesFormModuleRolesPermissions'),
            platform: 'Admin Portal',
            modulePermission: 'roles.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureManageRoles'),
                    permissions: {
                        view: 'roles.view',
                        add: 'roles.create',
                        edit: 'roles.edit',
                        full: 'roles.delete'
                    }
                }
            ]
        },
        'zones.manage': {
            displayName: t('superAdminRolesFormModuleZoneManagement'),
            platform: 'Admin Portal',
            modulePermission: 'zones.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureManageZones'),
                    permissions: {
                        view: 'zones.view',
                        add: 'zones.create',
                        edit: 'zones.edit',
                        full: 'zones.delete'
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureZoneStatusControl'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'zones.status',
                        full: null
                    }
                }
            ]
        },
        'drop_points.manage': {
            displayName: t('superAdminRolesFormModuleDropPoints'),
            platform: 'Admin Portal',
            modulePermission: 'drop_points.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureManageDropPoints'),
                    permissions: {
                        view: 'drop_points.view',
                        add: 'drop_points.create',
                        edit: 'drop_points.edit',
                        full: 'drop_points.delete'
                    }
                }
            ]
        },
        'parcels.manage': {
            displayName: t('superAdminRolesFormModuleParcelManagement'),
            platform: 'Admin Portal',
            modulePermission: 'parcels.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureManageParcels'),
                    permissions: {
                        view: 'parcels.view',
                        add: 'parcels.create',
                        edit: 'parcels.edit',
                        full: 'parcels.delete'
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureParcelStatusControl'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'parcels.status',
                        full: null
                    }
                }
            ]
        },
        'shipments.manage': {
            displayName: t('superAdminRolesFormModuleShipmentManagement'),
            platform: 'Admin Portal',
            modulePermission: 'shipments.manage',
            features: [
                // {
                //     name: 'View Shipments',
                //     permissions: {
                //         view: 'shipments.view',
                //         add: null,
                //         edit: null,
                //         full: null
                //     }
                // },
                {
                    name: t('superAdminRolesFormFeatureAssignRiders'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'shipments.assign',
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureTrackShipments'),
                    permissions: {
                        view: 'shipments.tracking',
                        add: null,
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'vehicles.manage': {
            displayName: t('superAdminRolesFormModuleVehicleManagement'),
            platform: 'Admin Portal',
            modulePermission: 'vehicles.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureManageVehicles'),
                    permissions: {
                        view: 'vehicles.view',
                        add: 'vehicles.create',
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureAssignVehicles'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'vehicles.assign',
                        full: null
                    }
                }
            ]
        },
        'earnings.manage': {
            displayName: t('superAdminRolesFormModuleEarningsSummary'),
            platform: 'Admin Portal',
            modulePermission: 'earnings.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewEarnings'),
                    permissions: {
                        view: 'earnings.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'cod.manage': {
            displayName: t('superAdminRolesFormModuleCodManagement'),
            platform: 'Admin Portal',
            modulePermission: 'cod.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewCodTransactions'),
                    permissions: {
                        view: 'cod.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureCollectCod'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'cod.collect',
                        full: null
                    }
                }
            ]
        },
        'pricing.manage': {
            displayName: t('superAdminRolesFormModulePricingManagement'),
            platform: 'Admin Portal',
            modulePermission: 'pricing.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewPricing'),
                    permissions: {
                        view: 'pricing.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'heatmap.view': {
            displayName: t('superAdminRolesFormModuleHeatmap'),
            platform: 'Admin Portal',
            modulePermission: 'heatmap.view',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewHeatmap'),
                    permissions: {
                        view: 'heatmap.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'settings.manage': {
            displayName: t('superAdminRolesFormModuleSettings'),
            platform: 'Admin Portal',
            modulePermission: 'settings.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewSettings'),
                    permissions: {
                        view: 'settings.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureUpdateProfile'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'settings.profile',
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureUpdatePassword'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'settings.password',
                        full: null
                    }
                }
            ]
        },
        // Mobile App Modules
        'jobs.manage': {
            displayName: t('superAdminRolesFormModuleJobManagement'),
            platform: 'Mobile App',
            modulePermission: 'jobs.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewJobs'),
                    permissions: {
                        view: 'jobs.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureUpdateJobStatus'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'jobs.update',
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureScanParcels'),
                    permissions: {
                        view: null,
                        add: 'jobs.scan',
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'shelves.manage': {
            displayName: t('superAdminRolesFormModuleShelfManagement'),
            platform: 'Mobile App',
            modulePermission: 'shelves.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewShelves'),
                    permissions: {
                        view: 'shelves.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureAssignToShelf'),
                    permissions: {
                        view: null,
                        add: 'shelves.assign',
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'mobile.vehicles.manage': {
            displayName: t('superAdminRolesFormModuleMobileVehicleManagement'),
            platform: 'Mobile App',
            modulePermission: 'mobile.vehicles.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewVehicles'),
                    permissions: {
                        view: 'mobile.vehicles.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureAddVehicles'),
                    permissions: {
                        view: null,
                        add: 'mobile.vehicles.create',
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'profile.manage': {
            displayName: t('superAdminRolesFormModuleProfileManagement'),
            platform: 'Mobile App',
            modulePermission: 'profile.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewProfile'),
                    permissions: {
                        view: 'profile.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureMobileUpdateProfile'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'profile.update',
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureManageDocuments'),
                    permissions: {
                        view: 'profile.documents.view',
                        add: 'profile.documents.upload',
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureMobileViewEarnings'),
                    permissions: {
                        view: 'profile.earnings.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureDepositCash'),
                    permissions: {
                        view: null,
                        add: 'profile.deposit',
                        edit: null,
                        full: null
                    }
                }
            ]
        },
        'notifications.manage': {
            displayName: t('superAdminRolesFormModuleNotifications'),
            platform: 'Mobile App',
            modulePermission: 'notifications.manage',
            features: [
                {
                    name: t('superAdminRolesFormFeatureViewNotifications'),
                    permissions: {
                        view: 'notifications.view',
                        add: null,
                        edit: null,
                        full: null
                    }
                },
                {
                    name: t('superAdminRolesFormFeatureMarkAsRead'),
                    permissions: {
                        view: null,
                        add: null,
                        edit: 'notifications.read',
                        full: null
                    }
                }
            ]
        },
        'cod.collect': {
            displayName: t('superAdminRolesFormModuleCashCollection'),
            platform: 'Mobile App',
            modulePermission: 'cod.collect',
            features: [
                {
                    name: t('superAdminRolesFormFeatureCollectPayment'),
                    permissions: {
                        view: null,
                        add: 'cod.payment.collect',
                        edit: null,
                        full: null
                    }
                }
            ]
        }
    };

    // Define module permissions for each platform (used for module checkboxes)
    const adminPortalModules = [
        'admin.access', 'employees.manage', 'customers.manage', 'roles.manage', 'zones.manage', 'drop_points.manage', 'parcels.manage',
        'shipments.manage', 'vehicles.manage', 'earnings.manage', 'cod.manage', 'pricing.manage',
        'heatmap.view', 'settings.manage'
    ];

    const mobileAppModules = [
        'jobs.manage', 'shelves.manage', 'mobile.vehicles.manage', 'profile.manage',
        'notifications.manage', 'cod.collect'
    ];

    // Helper function: Get permission object by name
    const getPermissionByName = (permissionName) => {
        return permissions.find(p => p.name === permissionName);
    };

    const resolveProtectedMobilePermissionState = (permissionName, defaultChecked = false) => {
        if (permissionName === 'jobs.scan') {
            const roleKey = normalizeRoleName(data.name);
            return roleKey !== 'rider';
        }
        return Boolean(defaultChecked);
    };

    // Helper function: Check if a permission is checked
    const isPermissionChecked = (permissionName) => {
        const permission = getPermissionByName(permissionName);
        return permission && data.permissions.includes(permission.id);
    };

    // Helper function: Get modules for the selected platform
    const getModulesForPlatform = () => {
        return Object.entries(PERMISSION_HIERARCHY)
            .filter(([_, module]) => platformAlias(module.platform) === currentPlatformKey)
            .map(([key, module]) => ({
                key,
                ...module,
                permissionObj: getPermissionByName(module.modulePermission)
            }))
            .filter(module => module.permissionObj); // Only show if permission exists
    };

    // Helper function: Get every permission ID that belongs to a module
    const getModulePermissionIds = (moduleKey) => {
        const module = PERMISSION_HIERARCHY[moduleKey];
        if (!module) return [];

        const permissionIds = new Set();

        const modulePermission = getPermissionByName(module.modulePermission);
        if (modulePermission) {
            permissionIds.add(modulePermission.id);
        }

        module.features.forEach((feature) => {
            Object.values(feature.permissions).forEach((permissionName) => {
                if (!permissionName) return;
                const permission = getPermissionByName(permissionName);
                if (permission) {
                    permissionIds.add(permission.id);
                }
            });
        });

        return Array.from(permissionIds);
    };

    // Helper function: Get selected modules (modules that are checked)
    const getSelectedModules = () => {
        return getModulesForPlatform().filter(module =>
            isPermissionChecked(module.modulePermission)
        );
    };

    // Helper function: Toggle permission
    const handlePermissionToggle = (permissionId, moduleKey = null) => {
        const isChecked = data.permissions.includes(permissionId);

        if (moduleKey && isChecked) {
            const modulePermissionIds = getModulePermissionIds(moduleKey);
            setData('permissions', data.permissions.filter(id => !modulePermissionIds.includes(id)));
            return;
        }

        setData('permissions',
            isChecked
                ? data.permissions.filter(id => id !== permissionId)
                : [...data.permissions, permissionId]
        );
    };

    // Helper function: Toggle feature permission level
    const handleFeaturePermissionToggle = (permissionName, feature, level) => {
        const permission = getPermissionByName(permissionName);
        if (!permission) return;

        // If toggling "Full Control" ON, also select View, Add, and Edit
        if (level === 'full' && !data.permissions.includes(permission.id)) {
            const permissionsToAdd = [permission.id];

            // Add view permission if exists
            if (feature.permissions.view) {
                const viewPerm = getPermissionByName(feature.permissions.view);
                if (viewPerm && !data.permissions.includes(viewPerm.id)) {
                    permissionsToAdd.push(viewPerm.id);
                }
            }

            // Add add permission if exists
            if (feature.permissions.add) {
                const addPerm = getPermissionByName(feature.permissions.add);
                if (addPerm && !data.permissions.includes(addPerm.id)) {
                    permissionsToAdd.push(addPerm.id);
                }
            }

            // Add edit permission if exists
            if (feature.permissions.edit) {
                const editPerm = getPermissionByName(feature.permissions.edit);
                if (editPerm && !data.permissions.includes(editPerm.id)) {
                    permissionsToAdd.push(editPerm.id);
                }
            }

            setData('permissions', [...data.permissions, ...permissionsToAdd]);
        }
        // If toggling "Full Control" OFF, also deselect View, Add, and Edit
        else if (level === 'full' && data.permissions.includes(permission.id)) {
            const permissionsToRemove = [permission.id];

            // Remove view permission if exists
            if (feature.permissions.view) {
                const viewPerm = getPermissionByName(feature.permissions.view);
                if (viewPerm) permissionsToRemove.push(viewPerm.id);
            }

            // Remove add permission if exists
            if (feature.permissions.add) {
                const addPerm = getPermissionByName(feature.permissions.add);
                if (addPerm) permissionsToRemove.push(addPerm.id);
            }

            // Remove edit permission if exists
            if (feature.permissions.edit) {
                const editPerm = getPermissionByName(feature.permissions.edit);
                if (editPerm) permissionsToRemove.push(editPerm.id);
            }

            setData('permissions', data.permissions.filter(id => !permissionsToRemove.includes(id)));
        }
        // For other levels, just toggle normally
        else {
            handlePermissionToggle(permission.id);
        }
    };

    const displayModules = getModulesForPlatform();
    const selectedModules = getSelectedModules();
    const canShowAssignPermissions = !shouldShowProtectedMobilePermissions
        && selectedModules.length > 0
        && (!isProtected || normalizeRoleName(data.name) === 'superadmin');

    return (
        <section className="rounded-[20px] border border-gray-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-black">{t('superAdminRolesFormRoleDetails')}</h3>
                {isProtected && (
                    <span className="text-xs text-gray-600 px-4 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full">
                        {t('superAdminRolesFormProtectedRoleViewOnly')}
                    </span>
                )}
            </div>

            {/* Platform Radio Buttons */}
            <div className="flex items-center gap-8 mb-6 text-sm text-black">
                <label className={`inline-flex items-center gap-2 ${isProtected ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input
                        type="radio"
                        name="platform"
                        value="Admin Portal"
                        checked={data.platform === 'Admin Portal'}
                        onChange={(e) => !isProtected && setData('platform', e.target.value)}
                        disabled={isProtected}
                        className="w-4 h-4 text-blue-500 focus:ring-[#338dff] disabled:opacity-50"
                    />
                    <span>{t('commonAdminPortal')}</span>
                </label>
                {isEdit && (
                    <label className="inline-flex items-center gap-2 cursor-not-allowed text-gray-400">
                        <input
                            type="radio"
                            name="platform"
                            value="Mobile App"
                            checked={data.platform === 'Mobile App'}
                            onChange={(e) => setData('platform', e.target.value)}
                            disabled
                            title={t('superAdminRolesFormMobileAppCreationDisabled')}
                            className="w-4 h-4 text-blue-500 focus:ring-[#338dff] disabled:opacity-50"
                        />
                        <span>{t('superAdminRolesFormMobileApp')}</span>
                    </label>
                )}
            </div>
            {errors.platform && <div className="text-red-500 text-sm mb-4">{errors.platform}</div>}

            {/* Input Fields Row */}
            <div className={`grid grid-cols-1 ${showLocationSelectors ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4 mb-4`}>
                {/* Role Title */}
                <div>
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => !isProtected && setData('name', e.target.value)}
                        placeholder={t('superAdminRolesFormRoleTitlePlaceholder')}
                        disabled={isProtected}
                        className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33] disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {errors.name && <div className="text-red-500 text-xs mt-1">{errors.name}</div>}
                </div>

                {showLocationSelectors && (
                    <>
                        {/* Country */}
                        <div className="relative" ref={countryMenuRef}>
                            <button
                                type="button"
                                onClick={() => !isProtected && setShowCountryMenu((prev) => !prev)}
                                disabled={isProtected}
                                className="w-full rounded-full border border-gray-200 bg-white px-5 pr-12 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33] appearance-none text-left disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {data.country || t('authRegisterSelectCountry')}
                            </button>
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                </svg>
                            </span>
                            {showCountryMenu && (
                                <div className="absolute left-0 right-0 z-50 mt-2">
                                    <Menu
                                        items={countryOptions}
                                        onItemClick={handleCountrySelect}
                                        anchorRef={countryMenuRef}
                                    />
                                </div>
                            )}
                            {errors.country && <div className="text-red-500 text-xs mt-1">{errors.country}</div>}
                        </div>

                        {/* Sub-Area */}
                        <div className="relative" ref={subAreaMenuRef}>
                            <button
                                type="button"
                                onClick={() => !isProtected && setShowSubAreaMenu((prev) => !prev)}
                                disabled={isProtected}
                                className="w-full rounded-full border border-gray-200 bg-white px-5 pr-12 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33] appearance-none text-left disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {data.sub_area || t('superAdminRolesFormSelectSubArea')}
                            </button>
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                </svg>
                            </span>
                            {showSubAreaMenu && (
                                <div className="absolute left-0 right-0 z-50 mt-2">
                                    <Menu
                                        items={subAreaOptions}
                                        onItemClick={handleSubAreaSelect}
                                        anchorRef={subAreaMenuRef}
                                    />
                                </div>
                            )}
                            {errors.sub_area && <div className="text-red-500 text-xs mt-1">{errors.sub_area}</div>}
                        </div>
                    </>
                )}
            </div>

            {/* Description Textarea */}
            <textarea
                rows="3"
                value={data.description}
                onChange={(e) => !isProtected && setData('description', e.target.value)}
                placeholder={t('superAdminRolesFormDescriptionPlaceholder')}
                disabled={isProtected}
                className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm text-[#1f2937] focus:outline-none focus:border-[#338dff] focus:ring-4 focus:ring-[#338dff33] disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {errors.description && <div className="text-red-500 text-sm mt-1">{errors.description}</div>}

            <hr className="my-6 border-gray-200" />

            {/* Modules Section */}
            <h3 className="text-lg font-semibold text-black mb-4">{t('superAdminRolesFormModules')}</h3>
            <div className="rounded-xl border border-gray-200 p-6">
                {shouldShowProtectedMobilePermissions ? (
                    <>
                        <p className="text-xs text-[#475569] mb-4">
                            {t('superAdminRolesFormProtectedMobileHint')}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm text-black">
                            {PROTECTED_MOBILE_PERMISSIONS.map((item) => (
                                <label
                                    key={item.labelKey}
                                    className="inline-flex items-center gap-2 cursor-not-allowed opacity-80"
                                >
                                    <input
                                        type="checkbox"
                                        checked={resolveProtectedMobilePermissionState(item.permission, item.defaultChecked)}
                                        readOnly
                                        disabled
                                        className="w-4 h-4 text-blue-500 focus:ring-[#338dff] rounded cursor-not-allowed"
                                    />
                                    <span>{t(item.labelKey)}</span>
                                </label>
                            ))}
                        </div>
                    </>
                ) : displayModules.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6 text-sm text-black">
                        {displayModules.map((module) => (
                            <label
                                key={module.key}
                                className={`inline-flex items-center gap-2 ${isProtected ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={data.permissions.includes(module.permissionObj.id)}
                                    onChange={() => !isProtected && handlePermissionToggle(module.permissionObj.id, module.key)}
                                    disabled={isProtected}
                                    className="w-4 h-4 text-blue-500 focus:ring-[#338dff] rounded disabled:opacity-50"
                                />
                                <span>{module.displayName}</span>
                            </label>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-[#64748b]">{t('superAdminRolesFormNoModulesAvailable', { platform: data.platform })}</p>
                )}
            </div>
            {errors.permissions && <div className="text-red-500 text-sm mt-2">{errors.permissions}</div>}

            {/* Assign Permissions Section - Only for editable roles (or superadmin) */}
            {canShowAssignPermissions && (
                <>
                    <hr className="my-6 border-gray-200" />

                    <h3 className="text-lg font-semibold text-black mb-4">{t('superAdminRolesFormAssignPermissions')}</h3>

                    <div className="space-y-6">
                        {selectedModules.map((module) => (
                            <div key={module.key} className="rounded-xl border border-gray-200 p-6">
                                <strong className="text-base font-semibold text-black block mb-4">
                                    {module.displayName}
                                </strong>

                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="border-b border-[#e2e8f0]">
                                                <th className="text-left py-3 px-4 text-sm font-medium text-black">{t('commonFeatures')}</th>
                                                <th className="text-center py-3 px-4 text-sm font-medium text-black">{t('superAdminRolesFormViewOnly')}</th>
                                                <th className="text-center py-3 px-4 text-sm font-medium text-black">{t('commonAdd')}</th>
                                                <th className="text-center py-3 px-4 text-sm font-medium text-black">{t('commonEdit')}</th>
                                                <th className="text-center py-3 px-4 text-sm font-medium text-black">{t('superAdminRolesFormFullControl')}</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {module.features.map((feature, featureIndex) => (
                                                <tr key={featureIndex} className="border-b border-[#f1f5f9] last:border-0">
                                                    <td className="py-3 px-4 text-sm text-black">{feature.name}</td>
                                                    <td className="text-center">
                                                        {feature.permissions.view ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={isPermissionChecked(feature.permissions.view)}
                                                                onChange={() => !isProtected && handleFeaturePermissionToggle(feature.permissions.view, feature, 'view')}
                                                                disabled={isProtected}
                                                                className={`w-4 h-4 text-blue-500 focus:ring-[#338dff] rounded ${isProtected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                disabled
                                                                className="w-4 h-4 text-gray-500 rounded cursor-disabled"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        {feature.permissions.add ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={isPermissionChecked(feature.permissions.add)}
                                                                onChange={() => !isProtected && handleFeaturePermissionToggle(feature.permissions.add, feature, 'add')}
                                                                disabled={isProtected}
                                                                className={`w-4 h-4 text-blue-500 focus:ring-[#338dff] rounded ${isProtected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                disabled
                                                                className="w-4 h-4 text-gray-500 rounded cursor-disabled"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        {feature.permissions.edit ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={isPermissionChecked(feature.permissions.edit)}
                                                                onChange={() => !isProtected && handleFeaturePermissionToggle(feature.permissions.edit, feature, 'edit')}
                                                                disabled={isProtected}
                                                                className={`w-4 h-4 text-blue-500 focus:ring-[#338dff] rounded ${isProtected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                disabled
                                                                className="w-4 h-4 text-gray-500 rounded cursor-disabled"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        {feature.permissions.full ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={isPermissionChecked(feature.permissions.full)}
                                                                onChange={() => !isProtected && handleFeaturePermissionToggle(feature.permissions.full, feature, 'full')}
                                                                disabled={isProtected}
                                                                className={`w-4 h-4 text-blue-500 focus:ring-[#338dff] rounded ${isProtected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                disabled
                                                                className="w-4 h-4 text-gray-500 rounded cursor-disabled"
                                                            />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Footer Actions */}
            <div className="mt-8 flex justify-end gap-3">
                <Link
                    href={cancelRoute}
                    className="inline-flex items-center justify-center rounded-full border border-[#338dff] px-8 py-3 text-base font-medium text-blue-500 transition hover:-translate-y-[1px] hover:shadow-[0_6px_16px_rgba(51,141,255,0.2)]"
                >
                    {isProtected ? t('commonBack') : t('commonCancel')}
                </Link>
                {!isProtected && (
                    <button
                        type="submit"
                        disabled={processing}
                        className="inline-flex items-center justify-center rounded-full border border-transparent px-8 py-3 text-base font-medium text-white bg-[#338dff] shadow-[0_12px_24px_rgba(51,141,255,0.25)] transition hover:-translate-y-[1px] hover:shadow-[0_14px_28px_rgba(51,141,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {processing ? (isEdit ? t('commonUpdating') : t('commonSaving')) : (isEdit ? t('superAdminRolesFormUpdateRole') : t('superAdminRolesFormSaveRole'))}
                    </button>
                )}
            </div>
        </section>
    );
}
