import React, { useRef, useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import ProfilePopup from '../../Pages/SuperAdmin/Components/ProfilePopup';
import { useTranslation } from 'react-i18next';
import NotificationDropdown from './NotificationDropdown';
import { clearCustomerPushNotificationTokenForLogout } from '../../pushNotifications';

const DEFAULT_AVATAR = '/assets/images/user.jpg';

const resolveAvatarUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_AVATAR;

  if (raw.startsWith('/assets/customer-uploads/')) {
    return raw.replace('/assets/customer-uploads/', '/storage/customer-uploads/');
  }

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  const normalized = raw.replace(/^public\//i, '').replace(/^storage\//i, '');
  return `/storage/${normalized}`;
};

export default function Header({ title = '', breadcrumbs = [], mobileTitle = '' }) {
  const { auth } = usePage().props;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isInfoDropdownOpen, setIsInfoDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const avatarRef = useRef(null);
  const infoDropdownRef = useRef(null);
  const { t, i18n } = useTranslation();
  const isRTL = (i18n.language || '').toLowerCase().startsWith('ar');

  const activeRole = typeof window !== 'undefined' ? (localStorage.getItem('active_role') || 'customer') : 'customer';
  const hasMultipleRoles = auth?.user?.roles?.includes('customer');

  const handleLogout = async () => {
    await clearCustomerPushNotificationTokenForLogout();
    router.post(route('customer.logout'));
  };

  const handleRoleSwitch = (role) => {
    localStorage.setItem('active_role', role);
    // Redirect to the appropriate default page for the role
    window.location.href = role === 'receiver' ? '/customer/shipments?role=receiver' : '/customer/dashboard';
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (infoDropdownRef.current && !infoDropdownRef.current.contains(e.target)) {
        setIsInfoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className={`hidden md:flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-4 md:justify-between w-full border-b border-gray-200 px-6 py-3 bg-white ${isRTL ? 'md:flex-row-reverse' : ''}`}>
        {/* Left: Title + Breadcrumbs */}
        <div className="flex-1 min-w-0">
          {title ? (
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          ) : null}
          {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 && (
            <nav className="text-sm mt-1 flex items-center gap-2">
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  {b.href ? (
                    <Link href={b.href} className="text-blue-500 hover:underline">
                      {b.label}
                    </Link>
                  ) : (
                    <span className={idx === breadcrumbs.length - 1 ? 'text-[#595959] font-medium' : 'text-gray-500'}>
                      {b.label}
                    </span>
                  )}
                  {idx < breadcrumbs.length - 1 && <span className="text-gray-400">›</span>}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        {/* Right: Info Dropdown + Notification + Profile */}
        <div className={`flex w-full flex-wrap items-center gap-3 md:w-auto md:gap-4 lg:gap-6 ${isRTL ? 'justify-start' : 'justify-end'}`}>
          <img src="/assets/images/sidebar-logo.svg" alt="Logo" className="w-6 h-6 rounded-md" />
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
              {auth?.user?.governorate || '-'}
            </span>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <NotificationDropdown />
          </div>

          {/* Profile */}
          <button
            type="button"
            ref={avatarRef}
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-1 shrink-0 rounded-full border border-transparent px-1 py-1 hover:border-[#E2E8F0] transition"
            aria-haspopup="dialog"
            aria-expanded={isProfileOpen}
          >
            <img
              src={resolveAvatarUrl(auth?.user?.avatar_url)}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_AVATAR;
              }}
              className="w-[44px] h-[44px] object-cover rounded-full object-top border-2 border-white shadow-sm"
              alt={auth?.user?.name || t('commonCustomer')}
            />
            <img src="/assets/images/arrow.png" alt={t('headerToggleProfile')} className="w-3 h-3" />
          </button>
        </div>

        <ProfilePopup
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          anchorRef={avatarRef}
          name={auth?.user?.name || t('commonCustomer')}
          email={auth?.user?.email || ''}
          avatarUrl={resolveAvatarUrl(auth?.user?.avatar_url)}
          onLogout={handleLogout}
          logoutLabel={t('commonLogout')}
        />
      </header>

      {mobileTitle && (
        <div className="fixed md:hidden z-10 top-0 left-0 right-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 py-4 rounded-b-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700">{mobileTitle}</h2>
        </div>
      )}
    </>
  );
}
