import React, { useEffect, useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
 
const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
]);
 
const isTextEntryElement = (element) => {
    if (!element) {
        return false;
    }
 
    if (element.isContentEditable) {
        return true;
    }
 
    const tagName = element.tagName?.toLowerCase();
 
    if (tagName === "textarea" || tagName === "select") {
        return true;
    }
 
    if (tagName !== "input") {
        return false;
    }
 
    return !NON_TEXT_INPUT_TYPES.has((element.type || "text").toLowerCase());
};
 
export default function Sidebar({ showBottomTabs = true }) {
    const { t } = useTranslation();
    const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState(false);

    // Get active role, defaulting to customer
    const activeRole = typeof window !== 'undefined' ? (localStorage.getItem('active_role') || 'customer') : 'customer';
 
    const navItems = [
        { name: t('commonHome'), key: "home", icon: "/assets/images/home.svg", href: "/customer/dashboard" },
        { name: t('commonSending'), key: "sending-parcels", icon: "/assets/images/shipmenthistory.svg", href: "/customer/sending-parcels" },
        { name: t('commonReceiving'), key: "receiving-parcels", icon: "/assets/images/shipmenthistory.svg", href: "/customer/receiving-parcels" },
        { name: t('commonWallet'), key: "wallet", icon: "/assets/images/wallet-1.svg", href: "/customer/wallet" },
        { name: t('commonAddress'), key: "address", icon: "/assets/images/address.svg", href: "/customer/addresses" },
        { name: t('commonSettings'), key: "settings", icon: "/assets/images/setting.svg", href: "/customer/settings" },
    ];
    const page = usePage();
    const currentPath =
        (page && page.url) ||
        (typeof window !== "undefined" ? window.location.pathname : "");
    const currentPathPathname = (currentPath || "").split("?")[0];
    const shouldShowBottomTabs = showBottomTabs && !isMobileKeyboardOpen;

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }
 
        const mobileQuery = window.matchMedia("(max-width: 767px)");
        const viewport = window.visualViewport;
        let maxMobileViewportHeight = viewport?.height || window.innerHeight || 0;

        const isKeyboardReducingViewport = () => {
            if (!viewport || !mobileQuery.matches) {
                return false;
            }

            maxMobileViewportHeight = Math.max(maxMobileViewportHeight, viewport.height);

            const viewportHeightReduction = maxMobileViewportHeight - viewport.height;
            const layoutViewportReduction = Math.max(
                0,
                (window.innerHeight || document.documentElement.clientHeight || 0) - viewport.height
            );

            return viewportHeightReduction > 120 || layoutViewportReduction > 120 || viewport.offsetTop > 80;
        };

        const updateKeyboardState = () => {
            const isMobileTextEntryFocused = mobileQuery.matches && isTextEntryElement(document.activeElement);

            if (viewport) {
                setIsMobileKeyboardOpen(isMobileTextEntryFocused && isKeyboardReducingViewport());
                return;
            }

            setIsMobileKeyboardOpen(isMobileTextEntryFocused);
        };

        const scheduleKeyboardStateUpdate = () => {
            window.requestAnimationFrame(updateKeyboardState);
        };

        document.addEventListener("focusin", scheduleKeyboardStateUpdate);
        document.addEventListener("focusout", scheduleKeyboardStateUpdate);
        window.addEventListener("resize", scheduleKeyboardStateUpdate, { passive: true });
        window.addEventListener("orientationchange", scheduleKeyboardStateUpdate, { passive: true });
        viewport?.addEventListener("resize", scheduleKeyboardStateUpdate, { passive: true });
        viewport?.addEventListener("scroll", scheduleKeyboardStateUpdate, { passive: true });
        mobileQuery.addEventListener?.("change", scheduleKeyboardStateUpdate);

        updateKeyboardState();

        return () => {
            document.removeEventListener("focusin", scheduleKeyboardStateUpdate);
            document.removeEventListener("focusout", scheduleKeyboardStateUpdate);
            window.removeEventListener("resize", scheduleKeyboardStateUpdate);
            window.removeEventListener("orientationchange", scheduleKeyboardStateUpdate);
            viewport?.removeEventListener("resize", scheduleKeyboardStateUpdate);
            viewport?.removeEventListener("scroll", scheduleKeyboardStateUpdate);
            mobileQuery.removeEventListener?.("change", scheduleKeyboardStateUpdate);
        };
    }, []);
 
    const navItem = (href, iconSrc, alt, label) => {
        const active =
            currentPathPathname === href || currentPathPathname.startsWith(href + "/");
        return (
            <Link href={href} className="relative group w-auto md:w-full block" title={label}>
                {active && (
                    <span className="hidden md:block absolute left-0 h-12 w-[3px] bg-white/70 rounded-r-full" />
                )}
                <span
                    className={[
                        "flex flex-col items-center justify-center gap-1",
                        "w-11 h-11 md:w-full md:h-12",
                        "rounded-xl md:rounded-none",
                        "transition-colors",
                        "bg-transparent hover:bg-white/15 md:hover:bg-white/15",
                        active ? "bg-white/20 md:bg-white/20" : "",
                    ].join(" ")}
                >
                    <img src={iconSrc} alt={alt} className={`w-6 h-6 transition-all ${
                    active ? "brightness-200" : "brightness-100 opacity-70"
                    }`} />
                    <span className={`hidden md:block text-[10px] leading-none font-semibold ${
                        active ? "text-white" : "text-white/70"
                    }`}>
                        {label}
                    </span>
                </span>
            </Link>
        );
    };
 
    return (
        <>
            <aside className="hidden fixed top-0 left-0 bg-[#338DFF] h-screen w-full md:w-[72px] md:flex flex-row md:flex-col items-center justify-between py-4 md:py-6 gap-4 md:gap-8 z-50 md:overflow-y-auto md:max-h-screen">
                <div>
                    <img
                        src="/assets/images/sidebar-logo.svg"
                        alt={t('sidebarLogoAlt')}
                    />
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-stretch gap-4 md:gap-4 w-full">
                    {/* Hide Dashboard if role is receiver */}
                    {navItem(
                        "/customer/dashboard",
                        "/assets/images/home.svg",
                        t('sidebarHomeAlt'),
                        t('commonHome')
                    )}
                    {navItem(
                        "/customer/sending-parcels",
                        "/assets/images/shipmenthistory.svg",
                        t('sidebarShipmentHistoryAlt'),
                        t('commonSending')
                    )}
                    {navItem(
                        "/customer/receiving-parcels",
                        "/assets/images/shipmenthistory.svg",
                        t('sidebarShipmentHistoryAlt'),
                        t('commonReceiving')
                    )}
                    {navItem(
                        "/customer/addresses",
                        "/assets/images/address.svg",
                        t('sidebarAddressAlt'),
                        t('commonAddress')
                    )}
                    {navItem(
                        "/customer/wallet",
                        "/assets/images/wallet-1.svg",
                        t('sidebarWalletAlt'),
                        t('commonWallet')
                    )}
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-stretch gap-4 md:gap-4 w-full">
                    {navItem(
                        "/customer/faq",
                        "/assets/images/faqs-1.svg",
                        t('sidebarFaqsAlt'),
                        t('sidebarFaqs')
                    )}
                    {navItem(
                        "/customer/settings",
                        "/assets/images/setting.svg",
                        t('sidebarSettingAlt'),
                        t('commonSettings')
                    )}
                </div>
            </aside>
            {shouldShowBottomTabs && (
                <div className="fixed md:hidden z-10 bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center py-2">
                    {navItems.filter(item => activeRole !== 'receiver' || item.key !== 'home').map((item) => {
                        const active = currentPathPathname === item.href || currentPathPathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                className="flex-1 flex justify-center"
                            >
                                <div className="flex flex-col items-center px-1 py-2 ">
                                    <img
                                        src={item.icon}
                                        alt={item.name}
                                        className={`w-5 h-5 mb-1 transition ${active
                                            ? '[filter:invert(53%)_sepia(96%)_saturate(1454%)_hue-rotate(191deg)_brightness(101%)_contrast(101%)]'
                                            : 'brightness-75 saturate-0'
                                            }`}
                                    />
                                    <span className={`text-xs font-medium ${active ? 'text-blue-500' : 'text-gray-500'}`}>
                                        {item.name}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </>
    );
}