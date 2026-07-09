import React, { useEffect, useState } from "react";

export default function PWAInstallModal({ show, onClose }) {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [canInstall, setCanInstall] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setCanInstall(true);
            console.log("PWA install prompt is available");
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // Check if already installed
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
        const isIOSStandalone = window.navigator.standalone === true;

        if (isStandalone || isIOSStandalone) {
            setCanInstall(false);
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        if (show) {
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    }, [show]);

    const handleInstall = async () => {

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === "accepted") {
                console.log("User accepted the install prompt");
            } else {
                console.log("User dismissed the install prompt");
            }

            setDeferredPrompt(null);
            handleClose();
        } catch (error) {
            console.error("Error showing install prompt:", error);
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => onClose(), 300);
    };

    if (!show) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
                isVisible ? "bg-black/50 backdrop-blur-sm" : "bg-black/0"
            }`}
            onClick={handleClose}
        >
            <div
                className={`relative w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-2xl transform transition-all duration-300 ${
                    isVisible ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={handleClose}
                    className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
                >
                    ✕
                </button>

                <div className="mb-4 text-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Install BoxyGo App
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Install BoxyGo as a web app for faster access and a clean, app-like experience.
                    </p>
                </div>

                <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#338DFF]/10 text-[#338DFF]">
                            ✓
                        </span>
                        <p className="text-sm text-gray-700">
                            Quick access from your home screen anytime
                        </p>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#338DFF]/10 text-[#338DFF]">
                            ✓
                        </span>
                        <p className="text-sm text-gray-700">
                            Immersive full-screen workspace
                        </p>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#338DFF]/10 text-[#338DFF]">
                            ✓
                        </span>
                        <p className="text-sm text-gray-700">
                            Faster performance across all tools
                        </p>
                    </div>
                </div>

                <p className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    Feature availability may vary by browser and device.
                </p>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Close & Continue
                    </button>

                    <button
                        onClick={handleInstall}
                        className="flex-1 rounded-xl bg-[#338DFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78db] transition-colors"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
}
