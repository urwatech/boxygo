import React, { useRef, useState, useEffect } from "react";
import { Link, usePage, router } from "@inertiajs/react";
import ProfilePopup from "../../Pages/SuperAdmin/Components/ProfilePopup";
import { useTranslation } from "react-i18next";
import NotificationDropdown from "./NotificationDropdown";

export default function MobileHeader({ title = "" }) {
    return (
        <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 flex items-center pl-4 justify-left gap-3 h-15 rounded-b-xl shadow-lg">
            <div className="flex-1 flex items-center justify-between pr-2">
                <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
                <div className="relative">
                    <NotificationDropdown />
                </div>
            </div>
        </div>
    );
}
