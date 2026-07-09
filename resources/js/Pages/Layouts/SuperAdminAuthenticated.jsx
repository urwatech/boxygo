import React, { useEffect, useRef, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import ProfilePopup from '../SuperAdmin/Components/ProfilePopup';
import Popup from '../SuperAdmin/Components/Popup';

export default function SuperAdminAuthenticated({ children, headerContent, profileData }) {
    const page = usePage();
    const { t } = useTranslation();
    const { auth, flash: inertiaFlash = {} } = page.props;
    const currentUrl = page.url.split('?')[0]??page.url;
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const profileAnchorRef = useRef(null);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const [flashPopupState, setFlashPopupState] = useState({
        key: null,
        title: '',
        message: '',
        buttonLabel: t('commonOkay'),
        visible: false,
        loopAnimation: false,
    });

    useEffect(() => {
        const nextKey = inertiaFlash?.success
            ? `success:${inertiaFlash.success}`
            : inertiaFlash?.error
                ? `error:${inertiaFlash.error}`
                : null;

        setFlashPopupState((previous) => {
            if (!nextKey) {
                if (!previous.visible && previous.key === null) {
                    return previous;
                }

                return {
                    ...previous,
                    key: null,
                    visible: false,
                };
            }

            if (previous.key === nextKey && previous.visible) {
                return previous;
            }

            const isSuccess = nextKey.startsWith('success:');
            return {
                key: nextKey,
                title: isSuccess ? t('commonSuccess') : t('commonPleaseReview'),
                message: isSuccess ? inertiaFlash.success : inertiaFlash.error,
                buttonLabel: isSuccess ? t('commonGreat') : t('commonGotIt'),
                visible: true,
                loopAnimation: isSuccess,
            };
        });
    }, [page.props.flash, inertiaFlash?.success, inertiaFlash?.error, t]);

    // Helper function to check if user has permission
    const userPermissions = Array.isArray(auth?.permissions) ? auth.permissions : [];

    const hasPermission = (permission) => {
        if (!permission) {
            return true;
        }

        const permissionsToCheck = Array.isArray(permission) ? permission : [permission];

        return permissionsToCheck.some((perm) => userPermissions.includes(perm));
    };

    const menuItems = [
        { icon: '/assets/images/home.svg', label: t('commonDashboard'), href: route('admin.dashboard'), permission: ['admin.access'] },
        { icon: '/assets/images/map-pin.svg', label: t('commonHeatmap'), href: route('admin.heatmap.index'), pattern: '/admin/heatmap', permission: ['heatmap.view'] },
        { icon: '/assets/images/user_managment.svg', label: t('commonEmployeeManagement'), href: route('admin.employees.index'), permission: ['employees.manage', 'employees.view'] },
        { icon: '/assets/images/user_managment.svg', label: t('commonCustomerInformation'), href: route('admin.customers.index'), pattern: '/admin/customers', permission: ['customers.manage', 'customers.view'] },
        { icon: '/assets/images/wallet-1.svg', label: t('commonWallet'), href: route('admin.wallet.index'), permission: ['earnings.manage', 'earnings.view'] },
        { icon: '/assets/images/address.svg', label: t('commonZoneManagement'), href: route('admin.zones.index'), permission: ['zones.manage', 'zones.view'] },
        { icon: '/assets/images/map-pin.svg', label: t('commonDropPoints'), href: route('admin.drop-points.index'), permission: ['drop_points.manage', 'drop_points.view'] },
        { icon: '/assets/images/warehouse.svg', label: t('commonWarehouseManagement'), href: route('admin.warehouses.index') },
        { icon: '/assets/images/role_managment.svg', label: t('commonRoleManagement'), href: route('admin.roles.index'), permission: ['roles.manage', 'roles.view'] },
        { icon: '/assets/images/Parcel-1.svg', label: t('commonParcel'), href: route('admin.parcels.index'), permission: ['parcels.manage', 'parcels.view'] },
        { icon: '/assets/images/cod-1.svg', label: t('commonCod'), href: route('admin.cod-management.index'), pattern: '/admin/cod-management', permission: ['cod.manage', 'cod.view'] },
        { icon: '/assets/images/truck.svg', label: t('commonVehicleManagement'), href: route('admin.vehicles.index'), pattern: '/admin/vehicles', permission: ['vehicles.manage', 'vehicles.view'] },
        { icon: '/assets/images/pricing-1.svg', label: t('commonPricing'), href: route('admin.pricing.index'), pattern: '/admin/pricing', permission: ['pricing.manage', 'pricing.view'] },
        { icon: '/assets/images/map-pin.svg', label: t('superAdminSidebarLiveTracking'), href: route('admin.live-tracking.index'), pattern: '/admin/live-tracking' },
    ].filter(item => hasPermission(item.permission));


    const headerNode = headerContent ?? (
    <div>
        <h2 className="text-lg font-semibold text-gray-900">
        {t('commonGreeting', { name: auth?.user?.name || t('commonAdmin') })}
        </h2>
        <p className="text-sm text-gray-500">
        {t('commonDashboardDescription')}
        </p>
    </div>
    );

    const normalizeUrl = (url = '') => url.replace(/\/+$/, '');

    const isItemActive = (item) => {
    const pattern = item.pattern ?? new URL(item.href, window.location.origin).pathname;
    const current = normalizeUrl(currentUrl);
    const target = normalizeUrl(pattern);
    return current === target || current.startsWith(`${target}/`);
    };

    const renderMenuItem = (item, index) => {
       const isActive = isItemActive(item);

       return (
                <Link
                key={index}
                href={item.href}
                title={item.label}
                className={`group relative flex items-center justify-start w-full transition-colors duration-300 px-2 py-1 rounded-md ${isActive ? 'bg-[#ffffff19] shadow-[0_8px_16px_rgba(51,141,255,0.25)]' : 'hover:bg-white/20'}`}
                aria-current={isActive ? "page" : undefined}
                >

                {isActive && (
                    <span
                    className="absolute left-[-12px] hidden h-[32px] w-[4px] bg-white"
                    aria-hidden="true"
                    />
                )}

                <div className="flex items-center  w-full">
                    <span
                        className="relative flex shrink-0 items-center justify-center transition-colors duration-300 w-[50px] h-[50px] p-[14px]"
                    >
                    {isActive && (
                    <>

                        <span
                        className="absolute left-0 top-0 h-full w-[4px] rounded-l-[12px] bg-[#f1f6ff] hidden md:block"
                        aria-hidden="true"
                        />
                        <span
                        className="absolute bottom-0 left-0 w-full h-[4px] rounded-b-[12px] bg-[#f1f6ff] md:hidden"
                        aria-hidden="true"
                        />
                    </>
                    )}
                    <img src={item.icon} alt={item.label} className={`w-6 h-7 transition-all ${
                        isActive ? 'brightness-200' : 'brightness-100 opacity-70'
                    }`} />
                    </span>
                    <span className={`text-white text-sm font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${sidebarExpanded ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'}`}>
                        {item.label}
                    </span>
                </div>
                </Link>
            );
            };

    const settingsActive = isItemActive({ href: route('admin.settings'), pattern: '/admin/settings' });
    const isHeatmapRoute = isItemActive({ href: route('admin.heatmap.index'), pattern: '/admin/heatmap' });

    const resolvedProfile = {
        name: profileData?.name ?? auth?.user?.name ?? t('commonAdmin'),
        email: profileData?.email ?? auth?.user?.email ?? '',
        avatarUrl: (profileData?.avatarUrl ?? auth?.user?.avatar_url ?? '/assets/images/defaultprofile.jpg').replace(/\/storage\//, '/'),
    };

    return (
        <div className="flex min-h-screen flex-col md:flex-row bg-[#f8f9fb]">
            <style>{`
                .sidebar-scrollbar-none {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }

                .sidebar-scrollbar-none::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                }
            `}</style>
            {/* Sidebar */}
            <aside 
                className={`sidebar-scrollbar-none fixed top-0 left-0 bg-[#338DFF] h-screen w-full md:flex flex-row md:flex-col justify-between md:justify-start py-4 md:py-6 gap-4 md:gap-4 z-50 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto transition-all duration-300 ${sidebarExpanded ? 'md:w-[240px]' : 'md:w-[72px]'}`}
                onMouseEnter={() => setSidebarExpanded(true)}
                onMouseLeave={() => setSidebarExpanded(false)}
            >
                <div className="shrink-0 flex items-center justify-center">
                    <img src="/assets/images/sidebar-logo.svg" alt={t('commonLogoAlt')} className="w-10 h-10" />
                </div>

                {/* Menu Icons */}
                <div className="sidebar-scrollbar-none flex flex-row flex-nowrap md:flex-col items-center md:flex-1 md:min-h-0 md:overflow-y-auto md:overflow-x-hidden ">
                    {menuItems.map(renderMenuItem)}
                </div>

                {hasPermission('settings.view') && (
                    <div className="shrink-0">
                        <Link
                            href={route('admin.settings')}
                            title={t('commonSettings')}
                            className={`group relative flex items-center justify-start w-full transition-colors duration-300 px-2 py-1 rounded-md ${settingsActive ? 'bg-[#ffffff19] shadow-[0_8px_16px_rgba(51,141,255,0.25)]' : 'hover:bg-white/20'}`}
                            aria-current={settingsActive ? 'page' : undefined}
                        >
                            <div className="flex items-center w-full">
                                <span
                                    className="relative flex shrink-0 items-center justify-center transition-colors duration-300 w-[50px] h-[50px] p-[14px]"
                                >
                                {settingsActive && (
                                    <>
                                    <span
                                        className="absolute left-0 top-0 h-full w-[4px] rounded-l-[12px] bg-[#f1f6ff] hidden md:block"
                                        aria-hidden="true"
                                    />
                                    <span
                                        className="absolute bottom-0 left-0 w-full h-[4px] rounded-b-[12px] bg-[#f1f6ff] md:hidden"
                                        aria-hidden="true"
                                    />
                                    </>
                                )}

                                <img src="/assets/images/Setting.svg" alt={t('commonSettings')} className={`w-6 h-7 transition-all ${
                                    settingsActive ? 'brightness-200' : 'brightness-100 opacity-70'
                                }`} />
                                </span>
                                <span className={`text-white text-sm font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${sidebarExpanded ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'}`}>
                                    {t('commonSettings')}
                                </span>
                            </div>

                        </Link>
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className={`flex-1 h-screen overflow-y-auto transition-all duration-300 ${sidebarExpanded ? 'md:ml-[240px]' : 'md:ml-[72px]'}`}>
                {/* Top Header */}
                <header className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-4 md:justify-between w-full border-b border-gray-200 px-6 py-3 bg-white opacity-100">
                    <div className="flex-1 min-w-0">{headerNode}</div>

                    <div className="flex w-full flex-wrap items-center justify-end gap-3 md:w-auto md:gap-4 lg:gap-6">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                            <span className="font-medium">{t('superAdminLayoutGovernorateLabel')}</span>
                            <p>{auth?.user?.governorate ?? '-'}</p>
                        </div>

                        {/* <div className="flex items-center gap-1 text-sm text-gray-700">
                            <span className="font-medium">Sub-Area:</span>
                            <select className="border-none bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer">
                                <option>Al-Mazzeh</option>
                            </select>
                        </div> */}

                        <div className="relative shrink-0">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                <img src="/assets/images/notification.svg" alt={t('commonNotifications')} className="w-5 h-5 object-contain" />
                            </button>

                            {/* Notification Panel */}
                            {showNotifications && (
                                <div className="fixed top-[80px] right-6 w-[421px] max-h-[702px] bg-white rounded-[10px] shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-gray-200 overflow-hidden z-50">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-5 py-6 border-b border-gray-200">
                                        <h2 className="text-lg font-semibold text-gray-900">{t('commonNotifications')}</h2>
                                        <button
                                            onClick={() => setShowNotifications(false)}
                                            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                            aria-label={t('commonClose')}
                                        >
                                            &times;
                                        </button>
                                    </div>

                                    {/* Notification List */}
                                    <div className="overflow-y-auto max-h-[600px]">
                                        <div className="bg-gray-50 px-5 py-4 text-sm font-semibold">{t('commonToday')}</div>
                                        <div className="px-5 py-4 border-b border-gray-100">
                                            <p className="text-sm text-gray-600">{t('superAdminNotificationsEmpty')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            ref={profileAnchorRef}
                            onClick={() => {
                                setShowProfilePopup((prev) => !prev);
                                setShowNotifications(false);
                            }}
                            className="flex items-center gap-1 shrink-0 rounded-full border border-transparent px-1 py-1 hover:border-[#E2E8F0] transition"
                            aria-haspopup="dialog"
                            aria-expanded={showProfilePopup}
                        >
                            <img
                                src={resolvedProfile.avatarUrl}
                                className="w-[44px] h-[44px] object-cover rounded-full object-top border-2 border-white shadow-sm"
                                alt={resolvedProfile.name}
                            />
                            <img src="/assets/images/arrow.png" alt={t('superAdminLayoutProfileArrowAlt')} className="w-3 h-3" />
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className={!isHeatmapRoute ? "px-4 sm:px-6 lg:px-6 py-3" : ""}>
                    {children}
                </div>
            </main>

            <ProfilePopup
                isOpen={showProfilePopup}
                onClose={() => setShowProfilePopup(false)}
                anchorRef={profileAnchorRef}
                name={resolvedProfile.name}
                email={resolvedProfile.email}
                avatarUrl={resolvedProfile.avatarUrl}
                onLogout={() => router.post(route('admin.logout'))}
            />
            {flashPopupState.visible && (
                <Popup
                    title={flashPopupState.title}
                    message={flashPopupState.message}
                    buttonLabel={flashPopupState.buttonLabel}
                    onConfirm={() =>
                        setFlashPopupState((prev) => ({
                            ...prev,
                            key: null,
                            visible: false,
                        }))
                    }
                    loopAnimation={flashPopupState.loopAnimation}
                />
            )}
        </div>
    );
}
