import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { CUSTOMER_NOTIFICATION_RECEIVED_EVENT } from '../../foregroundNotifications';

const NOTIFICATIONS_PER_PAGE = 10;
const MOBILE_CLOSE_ANIMATION_MS = 500;
const SWIPE_CLOSE_DISTANCE = 96;
const SWIPE_CLOSE_VELOCITY = 0.45;

export default function NotificationDropdown() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isMobileDrawerVisible, setIsMobileDrawerVisible] = useState(false);
  const [isMobileDrawerDragging, setIsMobileDrawerDragging] = useState(false);
  const [mobileDragOffset, setMobileDragOffset] = useState(0);
  const [pagination, setPagination] = useState({
    current_page: 1,
    total: 0,
    per_page: NOTIFICATIONS_PER_PAGE,
    last_page: 1,
  });
  const dropdownRef = useRef(null);
  const mobileCloseTimerRef = useRef(null);
  const mobileSwipeRef = useRef({
    active: false,
    offset: 0,
    scrollContainer: null,
    startTime: 0,
    startX: 0,
    startY: 0,
    startedFromHandle: false,
    tracking: false,
  });
  const isArabic = (i18n.language || '').toLowerCase().startsWith('ar');

  const isMobileViewport = () => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  const clearMobileCloseTimer = () => {
    if (mobileCloseTimerRef.current) {
      clearTimeout(mobileCloseTimerRef.current);
      mobileCloseTimerRef.current = null;
    }
  };

  const resetMobileSwipe = () => {
    mobileSwipeRef.current = {
      active: false,
      offset: 0,
      scrollContainer: null,
      startTime: 0,
      startX: 0,
      startY: 0,
      startedFromHandle: false,
      tracking: false,
    };
    setIsMobileDrawerDragging(false);
    setMobileDragOffset(0);
  };

  const closeDropdown = ({ animateMobile = true } = {}) => {
    clearMobileCloseTimer();

    if (animateMobile && isMobileViewport()) {
      mobileSwipeRef.current.active = false;
      mobileSwipeRef.current.tracking = false;
      setIsMobileDrawerDragging(false);
      setIsMobileDrawerVisible(false);

      mobileCloseTimerRef.current = setTimeout(() => {
        setIsOpen(false);
        setMobileDragOffset(0);
        mobileCloseTimerRef.current = null;
      }, MOBILE_CLOSE_ANIMATION_MS);
      return;
    }

    setIsOpen(false);
    resetMobileSwipe();
  };

  // Fetch notifications
  const fetchNotifications = async (page = pagination.current_page) => {
    try {
      setLoading(true);
      const response = await axios.get(route('customer.notifications.index'), {
        params: {
          limit: NOTIFICATIONS_PER_PAGE,
          page,
        }
      });

      if (response.data.success) {
        setNotifications(response.data.data);
        setUnreadCount(response.data.unread_count);
        setPagination({
          current_page: response.data.pagination?.current_page || 1,
          total: response.data.pagination?.total || 0,
          per_page: response.data.pagination?.per_page || NOTIFICATIONS_PER_PAGE,
          last_page: response.data.pagination?.last_page || 1,
        });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(route('customer.notifications.unread_count'));
      if (response.data.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // 30 seconds

    window.addEventListener(CUSTOMER_NOTIFICATION_RECEIVED_EVENT, fetchUnreadCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener(CUSTOMER_NOTIFICATION_RECEIVED_EVENT, fetchUnreadCount);
    };
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      setIsMobileDrawerVisible(false);
      resetMobileSwipe();
      return;
    }

    clearMobileCloseTimer();
    setIsMobileDrawerVisible(false);
    resetMobileSwipe();
    const frameId = window.requestAnimationFrame(() => {
      setIsMobileDrawerVisible(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    return () => clearMobileCloseTimer();
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.closest('[data-notification-mobile-layer="true"]')) {
        return;
      }

      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Mark notification as read
  const markAsRead = async (notificationId, shipmentId, role) => {
    try {
      const response = await axios.put(route('customer.notifications.mark_as_read', notificationId));
      if (typeof response.data?.unread_count === 'number') {
        setUnreadCount(response.data.unread_count);
      }

      // Navigate to shipment if available
      if (shipmentId && role) {
        const targetUrl = role === 'receiver'
          ? route('customer.shipments.receiving_parcels_show', shipmentId)
          : route('customer.shipments.sending_parcels_show', shipmentId);

        setIsOpen(false);
        router.visit(targetUrl);
        return;
      }

      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.post(route('customer.notifications.mark_all_as_read'));
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const hasMultiplePages = pagination.last_page > 1;
  const canGoPrevious = pagination.current_page > 1 && !loading;
  const canGoNext = pagination.current_page < pagination.last_page && !loading;

  const goToNotificationPage = (page) => {
    if (loading || page < 1 || page > pagination.last_page || page === pagination.current_page) {
      return;
    }

    fetchNotifications(page);
  };

  const getResistedDragOffset = (offset) => {
    if (typeof window === 'undefined') {
      return offset;
    }

    const resistancePoint = window.innerHeight * 0.35;
    return offset > resistancePoint
      ? resistancePoint + ((offset - resistancePoint) * 0.35)
      : offset;
  };

  const handleMobileSwipeStart = (event) => {
    if (!isMobileViewport() || event.touches.length !== 1) {
      return;
    }

    const target = event.target;
    const scrollContainer = typeof target?.closest === 'function'
      ? target.closest('[data-notification-scroll="true"]')
      : null;

    mobileSwipeRef.current = {
      active: false,
      offset: 0,
      scrollContainer,
      startTime: Date.now(),
      startX: event.touches[0].clientX,
      startY: event.touches[0].clientY,
      startedFromHandle: Boolean(
        typeof target?.closest === 'function'
          ? target.closest('[data-notification-drag-handle="true"]')
          : false
      ),
      tracking: true,
    };
  };

  const handleMobileSwipeMove = (event) => {
    const swipe = mobileSwipeRef.current;
    if (!swipe.tracking || event.touches.length !== 1) {
      return;
    }

    const deltaY = event.touches[0].clientY - swipe.startY;
    const deltaX = event.touches[0].clientX - swipe.startX;

    if (!swipe.active) {
      if (deltaY <= 0 || Math.abs(deltaX) > deltaY) {
        return;
      }

      if (!swipe.startedFromHandle && swipe.scrollContainer?.scrollTop > 0) {
        return;
      }

      if (deltaY < 8) {
        return;
      }

      swipe.active = true;
      setIsMobileDrawerDragging(true);
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const offset = getResistedDragOffset(Math.max(deltaY, 0));
    swipe.offset = offset;
    setMobileDragOffset(offset);
  };

  const handleMobileSwipeEnd = (event) => {
    const swipe = mobileSwipeRef.current;
    if (!swipe.tracking) {
      return;
    }

    const changedTouch = event.changedTouches[0];
    const deltaY = changedTouch ? Math.max(changedTouch.clientY - swipe.startY, 0) : swipe.offset;
    const elapsed = Math.max(Date.now() - swipe.startTime, 1);
    const velocity = deltaY / elapsed;
    const shouldClose = swipe.active && (
      swipe.offset > SWIPE_CLOSE_DISTANCE || velocity > SWIPE_CLOSE_VELOCITY
    );

    swipe.active = false;
    swipe.tracking = false;

    if (shouldClose) {
      closeDropdown();
      return;
    }

    setIsMobileDrawerDragging(false);
    setMobileDragOffset(0);
  };

  const handleMobileSwipeCancel = () => {
    mobileSwipeRef.current.active = false;
    mobileSwipeRef.current.tracking = false;
    setIsMobileDrawerDragging(false);
    setMobileDragOffset(0);
  };

  console.log(notifications);

  const renderNotificationsPanel = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{t('commonNotifications')}</h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {t('notificationDropdownMarkAllRead')}
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div data-notification-scroll="true" className="flex-1 min-h-0 overflow-y-auto md:max-h-[22rem]">
        {loading ? (
          <div className="flex h-full min-h-64 items-center justify-center py-8 md:min-h-0">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-full min-h-64 items-center justify-center px-4 py-8 text-center text-gray-500 md:min-h-0">
            <p>{t('notificationDropdownEmpty')}</p>
          </div>
        ) : (
          notifications.map((group) => (
            <div key={group.date}>
              {/* Date Header */}
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 sticky top-0">
                {group.date_formatted}
              </div>

              {/* Notifications in this date group */}
              {group.notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id, notification.shipment_id,  notification?.role)}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer ${
                    !notification.read_at ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      !notification.read_at ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {notification.notification_type === 'shipment' ? (
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {t(notification.title)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {t(notification.content, { riderName: notification?.rider_name ?? null, pickupAddress: notification?.pickup_address } )}
                      </p>
                      {notification.tracking_number && (
                        <p className="text-xs text-blue-600 font-medium mt-1">
                          Order no: {notification.tracking_number}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {notification.created_at_human}
                      </p>
                    </div>

                    {/* Unread Indicator */}
                    {!notification.read_at && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {hasMultiplePages && (
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => goToNotificationPage(pagination.current_page - 1)}
            disabled={!canGoPrevious}
            aria-label={t('commonPreviousPage')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 010 1.06L9.06 10l3.73 3.71a.75.75 0 11-1.06 1.06l-4.25-4.24a.75.75 0 010-1.06l4.25-4.24a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="min-w-0 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {pagination.current_page} / {pagination.last_page}
            </p>
          </div>

          <button
            type="button"
            onClick={() => goToNotificationPage(pagination.current_page + 1)}
            disabled={!canGoNext}
            aria-label={t('commonNextPage')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 010-1.06L10.94 10 7.21 6.29a.75.75 0 111.06-1.06l4.25 4.24a.75.75 0 010 1.06l-4.25 4.24a.75.75 0 01-1.06 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </>
  );

  const mobileDragProgress = Math.min(mobileDragOffset / 320, 1);
  const mobileDrawer = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/35 transition-opacity duration-200 ease-out md:hidden"
        style={{ opacity: isMobileDrawerVisible ? 1 - (mobileDragProgress * 0.75) : 0 }}
        onClick={() => closeDropdown()}
      />
      <div
        data-notification-mobile-layer="true"
        className={`fixed inset-x-0 bottom-0 z-[9999] flex h-[85vh] max-h-[70vh] w-full transform-gpu flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl md:hidden ${
          isMobileDrawerDragging ? 'transition-none' : 'transition-[transform,opacity] duration-300 ease-out'
        }`}
        style={{
          opacity: isMobileDrawerVisible ? Math.max(0.6, 1 - (mobileDragProgress * 0.35)) : 0,
          transform: isMobileDrawerVisible ? `translateY(${mobileDragOffset}px)` : 'translateY(100%)',
        }}
        onTouchStart={handleMobileSwipeStart}
        onTouchMove={handleMobileSwipeMove}
        onTouchEnd={handleMobileSwipeEnd}
        onTouchCancel={handleMobileSwipeCancel}
      >
        <div data-notification-drag-handle="true" className="flex touch-none justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        {renderNotificationsPanel()}
      </div>
    </>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        type="button"
        onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
        className="relative p-2 hover:bg-gray-100 rounded-full transition"
      >
        <img src="/assets/images/notification.svg" alt={t('commonNotifications')} className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {typeof document !== 'undefined' && createPortal(mobileDrawer, document.body)}
          <div
            className={`hidden md:flex md:flex-col absolute mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 ${
              isArabic ? 'md:left-0' : 'md:right-0'
            }`}
          >
            {renderNotificationsPanel()}
          </div>
        </>
      )}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-notification-mobile-layer="true"] {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
