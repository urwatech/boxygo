import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import SuperAdminAuthenticated from "../../Layouts/SuperAdminAuthenticated";
import PrimaryButton from "../Components/PrimaryButton";
import Menu from "../../../Components/Common/Menu";
import FileUpload from "./Components/FileUpload";
import StatsCard from "../Components/StatsCard";
import Card from "../../../Components/Common/Card";
import Table from "../../../Components/Common/Table";
import OutlineButton from "../Components/OutlineButton";
import Input from "../../../Components/Common/Inputs/Input";
import { useTranslation } from "react-i18next";

// Remove emojis and related modifiers from generic text inputs
const sanitizeTextInput = (value = "") => {
    const normalized = typeof value === "string" ? value : String(value ?? "");
    return normalized
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // surrogate pairs (emojis)
        .replace(/[\u2600-\u27BF]/g, "") // misc symbols & dingbats
        .replace(/[\uFE0F\u200D]/g, ""); // variation selectors & zero-width joiner
};

const ensureAbsoluteAsset = (value) => {
    if (!value) {
        return null;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return null;
    }

    if (/^https?:\/\//i.test(normalized)) {
        return normalized;
    }

    return normalized.startsWith("/")
        ? normalized
        : `/${normalized.replace(/^\/+/, "")}`;
};

const STATUS_STYLES = {
    active: "bg-green-50 text-green-600 border border-green-600",
    pending_renewal: "bg-amber-50 text-amber-500 border border-amber-500",
    inactive: "bg-red-50 text-red-500 border border-red-600",
};

const toHumanStatus = (status, fallback = "") =>
    ({
        active: "Active",
        pending_renewal: "Pending Renewal",
        inactive: "In-Active",
    })[status] ??
    fallback ??
    status;

export default function Index({
    vehicles,
    filters = {},
    stats = {},
    statusOptions = [],
    typeOptions = [],
    riders = [],
    carDrivers = [],
}) {
    const { t } = useTranslation();

    const [searchTerm, setSearchTerm] = useState(filters.search ?? "");
    const [statusFilter, setStatusFilter] = useState(filters.status ?? "All");
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [isAddDrawerOpen, setAddDrawerOpen] = useState(false);
    const [isEditDrawerOpen, setEditDrawerOpen] = useState(false);
    const [isAssignDrawerOpen, setAssignDrawerOpen] = useState(false);
    const [activeVehicleId, setActiveVehicleId] = useState(null);
    const [riderSearch, setRiderSearch] = useState("");
    const [selectedRiderId, setSelectedRiderId] = useState(null);
    const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
    const [isFormStatusMenuOpen, setIsFormStatusMenuOpen] = useState(false);
    const [isStatusDrawerOpen, setStatusDrawerOpen] = useState(false);
    const [vehicleForStatusUpdate, setVehicleForStatusUpdate] = useState(null);
    const [vehicleBeingEdited, setVehicleBeingEdited] = useState(null);
    const [isEditTypeMenuOpen, setIsEditTypeMenuOpen] = useState(false);
    const [isEditStatusMenuOpen, setIsEditStatusMenuOpen] = useState(false);
    const [errorPopup, setErrorPopup] = useState({
        visible: false,
        message: "",
    });

    const statusButtonRef = useRef(null);
    const statusMenuRef = useRef(null);
    const typeMenuButtonRef = useRef(null);
    const typeMenuRef = useRef(null);
    const formStatusButtonRef = useRef(null);
    const formStatusMenuRef = useRef(null);
    const editTypeButtonRef = useRef(null);
    const editTypeMenuRef = useRef(null);
    const editStatusButtonRef = useRef(null);
    const editStatusMenuRef = useRef(null);

    const statusChoices = useMemo(
        () => statusOptions.filter((option) => option.value !== "All"),
        [statusOptions],
    );

    const normalizedTypeOptions = useMemo(
        () =>
            (Array.isArray(typeOptions) ? typeOptions : []).filter(
                (value, index, self) =>
                    !!value && self.indexOf(value) === index,
            ),
        [typeOptions],
    );

    const typeMenuItems = useMemo(
        () => [
            { label: "", value: "" },
            ...normalizedTypeOptions.map((type) => ({
                label: type,
                value: type,
            })),
        ],
        [normalizedTypeOptions],
    );

    const formStatusMenuItems = useMemo(
        () => [
            { label: "", value: "" },
            ...statusChoices.map((option) => ({
                label: option.label,
                value: option.value,
            })),
        ],
        [statusChoices],
    );

    const addVehicleForm = useForm({
        type: "",
        model: "",
        model_year: "",
        license_plate: "",
        permit_expires_at: "",
        insurance_expires_at: "",
        vehicle_registration: null,
        car_insurance: null,
        operating_permit: null,
        additional_documents: null,
        status: "",
    });

    const editVehicleForm = useForm({
        type: "",
        model: "",
        model_year: "",
        license_plate: "",
        permit_expires_at: "",
        insurance_expires_at: "",
        status: "",
        vehicle_registration: null,
        car_insurance: null,
        operating_permit: null,
        additional_documents: null,
    });

    const assignForm = useForm({
        user_id: null,
    });

    const statusForm = useForm({
        status: "",
    });

    const selectedStatusDrawerLabel = statusForm.data.status
        ? (statusChoices.find(
              (option) => option.value === statusForm.data.status,
          )?.label ?? toHumanStatus(statusForm.data.status))
        : "";

    const selectedVehicleTypeLabel = addVehicleForm.data.type
        ? (typeMenuItems.find((item) => item.value === addVehicleForm.data.type)
              ?.label ?? addVehicleForm.data.type)
        : "";
    const selectedFormStatusLabel = addVehicleForm.data.status
        ? (formStatusMenuItems.find(
              (item) => item.value === addVehicleForm.data.status,
          )?.label ?? addVehicleForm.data.status)
        : "";
    const selectedEditVehicleTypeLabel = editVehicleForm.data.type
        ? (typeMenuItems.find(
              (item) => item.value === editVehicleForm.data.type,
          )?.label ?? editVehicleForm.data.type)
        : "";
    const selectedEditVehicleStatusLabel = editVehicleForm.data.status
        ? (formStatusMenuItems.find(
              (item) => item.value === editVehicleForm.data.status,
          )?.label ?? editVehicleForm.data.status)
        : "";

    const paginatedVehicles = vehicles?.data ?? [];
    const paginationMeta = {
        currentPage: vehicles?.current_page ?? 1,
        totalPages: vehicles?.last_page ?? 1,
        from: vehicles?.from ?? 0,
        to: vehicles?.to ?? 0,
        total: vehicles?.total ?? 0,
    };

    const statsCards = useMemo(
        () => [
            {
                label: t("superAdminVehiclesStatsTotalVehicles"),
                value: stats.total ?? 0,
                isSpecialCard: true,
            },
            {
                label: t("superAdminVehiclesStatsTotalBikes"),
                value: stats.bikes ?? 0,
                icon: "/assets/images/wallet-money.svg",
            },
            {
                label: t("superAdminVehiclesStatsTotalVans"),
                value: stats.vans ?? 0,
                icon: "/assets/images/wallet-money.svg",
            },
            {
                label: t("superAdminVehiclesStatsTotalMiniVans"),
                value: stats.mini_vans ?? 0,
                icon: "/assets/images/wallet-money.svg",
            },
            {
                label: t("superAdminVehiclesStatsInactiveVehicles"),
                value: stats.inactive ?? 0,
                icon: "/assets/images/wallet-money.svg",
            },
        ],
        [stats, t],
    );

    const activeVehicle = useMemo(
        () =>
            paginatedVehicles.find(
                (vehicle) => vehicle.id === activeVehicleId,
            ) ?? null,
        [paginatedVehicles, activeVehicleId],
    );

    const availableUsers = useMemo(() => {
        const vehicleType = activeVehicle?.type?.toLowerCase();
        let users = [];

        if (vehicleType === "bike") {
            users = riders;
        } else if (vehicleType === "van" || vehicleType === "mini van") {
            users = carDrivers;
        } else {
            // If vehicle type is unknown, show both
            users = [...riders, ...carDrivers];
        }

        return [{ id: null, name: "Unassigned" }, ...users];
    }, [activeVehicle, riders, carDrivers]);

    const filteredUsers = useMemo(() => {
        const term = riderSearch.trim().toLowerCase();
        if (!term) {
            return availableUsers;
        }
        return availableUsers.filter((user) =>
            user.name.toLowerCase().includes(term),
        );
    }, [availableUsers, riderSearch]);

    useEffect(() => {
        const handler = setTimeout(() => {
            router.get(
                route("admin.vehicles.index"),
                {
                    search: searchTerm || undefined,
                    status:
                        statusFilter && statusFilter !== "All"
                            ? statusFilter
                            : undefined,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                },
            );
        }, 350);

        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        setSearchTerm(filters.search ?? "");
    }, [filters.search]);

    useEffect(() => {
        setStatusFilter(filters.status ?? "All");
    }, [filters.status]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                isEditTypeMenuOpen &&
                editTypeMenuRef.current &&
                !editTypeMenuRef.current.contains(event.target) &&
                !editTypeButtonRef.current?.contains(event.target)
            ) {
                setIsEditTypeMenuOpen(false);
            }

            if (
                isEditStatusMenuOpen &&
                editStatusMenuRef.current &&
                !editStatusMenuRef.current.contains(event.target) &&
                !editStatusButtonRef.current?.contains(event.target)
            ) {
                setIsEditStatusMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isEditTypeMenuOpen, isEditStatusMenuOpen]);

    useEffect(() => {
        if (!showStatusMenu) {
            return undefined;
        }

        const handleClick = (event) => {
            if (
                !statusButtonRef.current?.contains(event.target) &&
                !statusMenuRef.current?.contains(event.target)
            ) {
                setShowStatusMenu(false);
            }
        };

        const handleKey = (event) => {
            if (event.key === "Escape") {
                setShowStatusMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [showStatusMenu]);

    useEffect(() => {
        if (!isTypeMenuOpen && !isFormStatusMenuOpen) {
            return undefined;
        }

        const handleClick = (event) => {
            if (
                isTypeMenuOpen &&
                !typeMenuButtonRef.current?.contains(event.target) &&
                !typeMenuRef.current?.contains(event.target)
            ) {
                setIsTypeMenuOpen(false);
            }

            if (
                isFormStatusMenuOpen &&
                !formStatusButtonRef.current?.contains(event.target) &&
                !formStatusMenuRef.current?.contains(event.target)
            ) {
                setIsFormStatusMenuOpen(false);
            }
        };

        const handleKey = (event) => {
            if (event.key === "Escape") {
                if (isTypeMenuOpen) {
                    setIsTypeMenuOpen(false);
                }
                if (isFormStatusMenuOpen) {
                    setIsFormStatusMenuOpen(false);
                }
            }
        };

        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [isTypeMenuOpen, isFormStatusMenuOpen]);

    useEffect(() => {
        if (!isAssignDrawerOpen) {
            return;
        }

        setSelectedRiderId(activeVehicle?.assigned_rider?.id ?? null);
        assignForm.setData(
            "user_id",
            activeVehicle?.assigned_rider?.id ?? null,
        );
        assignForm.clearErrors();
        setRiderSearch("");
    }, [isAssignDrawerOpen, activeVehicle]);

    const applyStatusFilter = (value) => {
        setStatusFilter(value);
        router.get(
            route("admin.vehicles.index"),
            {
                search: searchTerm || undefined,
                status: value && value !== "All" ? value : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
        setShowStatusMenu(false);
    };

    const handlePageChange = (page) => {
        router.get(
            route("admin.vehicles.index"),
            {
                search: searchTerm || undefined,
                status:
                    statusFilter && statusFilter !== "All"
                        ? statusFilter
                        : undefined,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const openAddDrawer = () => {
        addVehicleForm.reset();
        addVehicleForm.setData({
            type: "",
            model: "",
            model_year: "",
            license_plate: "",
            permit_expires_at: "",
            insurance_expires_at: "",
            vehicle_registration: null,
            car_insurance: null,
            operating_permit: null,
            status: "",
            additional_documents: null,
        });
        setIsTypeMenuOpen(false);
        setIsFormStatusMenuOpen(false);
        setAddDrawerOpen(true);
    };

    const openEditDrawer = (vehicle) => {
        if (!vehicle) {
            return;
        }

        setVehicleBeingEdited(vehicle);
        editVehicleForm.setData({
            type: vehicle.type ?? "",
            model: vehicle.model ?? "",
            model_year: vehicle.model_year ?? "",
            license_plate: vehicle.license_plate ?? "",
            permit_expires_at: vehicle.permit_expires_at_raw ?? "",
            insurance_expires_at: vehicle.insurance_expires_at_raw ?? "",
            status: vehicle.status ?? "",
            vehicle_registration: null,
            car_insurance: null,
            operating_permit: null,
            additional_documents: null,
        });
        editVehicleForm.clearErrors();
        setIsEditTypeMenuOpen(false);
        setIsEditStatusMenuOpen(false);
        setEditDrawerOpen(true);
    };

    const closeEditDrawer = () => {
        setEditDrawerOpen(false);
        setVehicleBeingEdited(null);
        editVehicleForm.reset();
        editVehicleForm.clearErrors();
        setIsEditTypeMenuOpen(false);
        setIsEditStatusMenuOpen(false);
    };

    const submitAddVehicle = (event) => {
        event.preventDefault();

        // Create a clean data object without null file fields
        const cleanData = {};
        Object.keys(addVehicleForm.data).forEach((key) => {
            const value = addVehicleForm.data[key];
            // Only include non-null values, or keep empty strings for text fields
            if (value !== null) {
                cleanData[key] = value;
            }
        });

        // Use router.post with FormData for file uploads
        const formData = new FormData();
        Object.keys(cleanData).forEach((key) => {
            const value = cleanData[key];
            if (key === "additional_documents" && value) {
                const docs = Array.isArray(value) ? value : Array.from(value);
                docs.forEach((file) => {
                    if (file instanceof File) {
                        formData.append("additional_documents[]", file);
                    }
                });
            } else if (value instanceof File) {
                // Handle single file
                formData.append(key, value);
            } else if (value !== null && value !== undefined) {
                // Handle regular fields
                formData.append(key, value);
            }
        });

        // Submit using router.post
        router.post(route("admin.vehicles.store"), formData, {
            preserveScroll: true,
            onSuccess: () => {
                setAddDrawerOpen(false);
                addVehicleForm.reset();
            },
            onError: (errors) => {
                console.error("Form errors:", errors);
                addVehicleForm.setError(errors);
            },
        });
    };

    const submitEditVehicle = (event) => {
        event.preventDefault();
        if (!vehicleBeingEdited) {
            return;
        }

        const formData = new FormData();
        formData.append("_method", "PUT");

        Object.keys(editVehicleForm.data).forEach((key) => {
            const value = editVehicleForm.data[key];
            if (key === "additional_documents" && value) {
                const docs = Array.isArray(value) ? value : Array.from(value);
                docs.forEach((file) => {
                    if (file instanceof File) {
                        formData.append("additional_documents[]", file);
                    }
                });
            } else if (value instanceof File) {
                formData.append(key, value);
            } else if (value !== null && value !== undefined) {
                formData.append(key, value);
            }
        });

        router.post(
            route("admin.vehicles.update-details", vehicleBeingEdited.id),
            formData,
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeEditDrawer();
                },
                onError: (errors) => {
                    editVehicleForm.setError(errors);
                },
            },
        );
    };

    const openAssignDrawer = (vehicleId) => {
        setActiveVehicleId(vehicleId);
        setAssignDrawerOpen(true);
    };

    const openStatusDrawer = (vehicle) => {
        if (!vehicle) {
            return;
        }

        setVehicleForStatusUpdate(vehicle);
        statusForm.setData("status", vehicle.status ?? "");
        setStatusDrawerOpen(true);
    };

    const closeStatusDrawer = () => {
        setStatusDrawerOpen(false);
        setVehicleForStatusUpdate(null);
        statusForm.reset();
    };

    const submitAssignment = () => {
        // Set the user_id in the form
        assignForm.transform((data) => ({
            ...data,
            user_id: selectedRiderId ?? null,
        }));

        assignForm.patch(route("admin.vehicles.assign", activeVehicleId), {
            preserveScroll: true,
            onSuccess: () => {
                setAssignDrawerOpen(false);
                assignForm.reset();
                assignForm.clearErrors();
                setErrorPopup({ visible: false, message: "" });
            },
            onError: (errors) => {
                console.log("Assignment validation errors:", errors);
                // Show error popup
                if (errors.user_id) {
                    setErrorPopup({ visible: true, message: errors.user_id });
                }
            },
        });
    };

    const submitStatusUpdate = (event) => {
        event.preventDefault();

        if (!vehicleForStatusUpdate) {
            return;
        }

        statusForm.put(
            route("admin.vehicles.update", vehicleForStatusUpdate.id),
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeStatusDrawer();
                },
            },
        );
    };

    const statusMenuItems = useMemo(
        () =>
            statusOptions.map((option) => ({
                label: option.label,
                value: option.value,
            })),
        [statusOptions],
    );

    const VehicleActions = ({ vehicle }) => {
        const [isMenuOpen, setIsMenuOpen] = useState(false);
        const actionButtonRef = useRef(null);
        const actionMenuRef = useRef(null);

        useEffect(() => {
            if (!isMenuOpen) {
                return undefined;
            }

            const handleClickOutside = (event) => {
                if (
                    !actionMenuRef.current?.contains(event.target) &&
                    !actionButtonRef.current?.contains(event.target)
                ) {
                    setIsMenuOpen(false);
                }
            };

            const handleEscape = (event) => {
                if (event.key === "Escape") {
                    setIsMenuOpen(false);
                }
            };

            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);

            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
                document.removeEventListener("keydown", handleEscape);
            };
        }, [isMenuOpen]);

        const handleMenuAction = (action) => {
            setIsMenuOpen(false);

            if (action === "edit") {
                openEditDrawer(vehicle);
            }

            if (action === "status") {
                openStatusDrawer(vehicle);
            }

            if (action === "assign") {
                openAssignDrawer(vehicle.id);
            }
        };

        return (
            <div className="relative inline-flex items-center">
                <button
                    type="button"
                    ref={actionButtonRef}
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    className="inline-flex items-center justify-center"
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    aria-label={`Actions for ${vehicle.code}`}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="w-5 h-5 text-black cursor-pointer"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 12h.008M12 12h.008M18 12h.008"
                        />
                    </svg>
                </button>

                {isMenuOpen && (
                    <div
                        ref={actionMenuRef}
                        className="absolute right-0 mt-35 z-50 min-w-[180px]"
                    >
                        <div className="rounded-[16px] bg-white shadow-[0px_20px_60px_rgba(15,23,42,0.15)] overflow-hidden">
                            <button
                                type="button"
                                onClick={() => handleMenuAction("edit")}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#0F172A] border border-[#E2E8F0] hover:bg-gray-50 cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4 text-[#475569] cursor-pointer"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16.862 3.487l3.65 3.65m-2.107-5.757a2.25 2.25 0 113.182 3.182L7.746 18.404a4.5 4.5 0 01-1.597 1.04l-4.467 1.49 1.49-4.467a4.5 4.5 0 011.04-1.597L16.863 3.487z"
                                    />
                                </svg>
                                <span>{t("commonEdit")}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleMenuAction("status")}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#0F172A] border-x border-[#E2E8F0] hover:bg-gray-50 cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4 text-[#475569]"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span>
                                    {t("commonUpdateStatus")}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleMenuAction("assign")}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#0F172A] border border-[#E2E8F0] hover:bg-gray-50 cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4 text-[#475569]"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                                    />
                                </svg>
                                <span>
                                    {vehicle.assigned_rider
                                        ? t("superAdminVehiclesActionReassign")
                                        : t("commonAssign")}
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const vehicleColumns = useMemo(
        () => [
            {
                key: "code",
                label: t("superAdminVehiclesColumnId"),
            },
            {
                key: "assigned_rider",
                label: t("superAdminVehiclesColumnAssignedTo"),
                render: (value) =>
                    value?.name ?? t("statusUnassigned"),
            },
            {
                key: "type",
                label: t("commonType"),
            },
            {
                key: "license_plate",
                label: t("commonPlateNumber"),
            },
            {
                key: "permit_expires_at",
                label: t("commonPermitExpiry"),
                render: (value) => value ?? "—",
            },
            {
                key: "insurance_expires_at",
                label: t("commonInsuranceExpiry"),
                render: (value) => value ?? "—",
            },
            {
                key: "status",
                label: t("commonStatus"),
                render: (value, row) => {
                    const badgeStyle =
                        STATUS_STYLES[value] ??
                        "bg-slate-100 text-slate-600 border border-slate-200";
                    return (
                        <span
                            className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium ${badgeStyle}`}
                        >
                            {row.status_label ?? toHumanStatus(value)}
                        </span>
                    );
                },
            },
            {
                key: "action",
                label: t("commonActions"),
                align: "right",
                headerClassName: "text-right",
                render: (_, vehicle) => <VehicleActions vehicle={vehicle} />,
            },
        ],
        [t],
    );

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-[#0f172a] mb-1">
                        {t("commonVehicleManagement")}
                    </h2>
                    <nav className="text-sm text-[#64748b]">
                        <span>{t("commonHome")} › </span>
                        <span className="font-medium text-blue-500">
                            {t("commonVehicleManagement")}
                        </span>
                    </nav>
                </div>
            }
        >
            <Head title={t("commonVehicleManagement")} />
            <>
                {isEditDrawerOpen && (
                    <div className="fixed inset-0 z-50">
                        <div
                            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
                            onClick={closeEditDrawer}
                            aria-hidden="true"
                        />
                        <div className="absolute inset-y-0 right-0 w-full max-w-[480px] bg-white rounded-l-[28px] border border-[#e5e7eb] shadow-[0_20px_45px_rgba(15,23,42,0.25)] transition-transform duration-300 ease-out flex flex-col h-full">
                            <div className="px-6 pt-6 pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-[#0f172a]">
                                            {t(
                                                "superAdminVehiclesDrawerTitleEdit",
                                            )}
                                        </h2>
                                        <p className="text-sm text-[#64748b] mt-1">
                                            {t(
                                                "superAdminVehiclesDrawerDescriptionEdit",
                                            )}{" "}
                                            <span className="font-medium text-[#0f172a]">
                                                {vehicleBeingEdited?.code ??
                                                    "--"}
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeEditDrawer}
                                        className="text-2xl leading-none text-slate-500 hover:text-[#1f2937]"
                                        aria-label="Close edit vehicle panel"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="mt-4 h-px bg-[#e5e7eb]" />
                            </div>

                            <form
                                onSubmit={submitEditVehicle}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <div className="px-6 pb-6 space-y-6 overflow-y-auto">
                                    <div className="grid grid-cols-1 mt-3 sm:grid-cols-2 gap-4">
                                        <div className="relative">
                                            <Input
                                                ref={editTypeButtonRef}
                                                type="text"
                                                label={t(
                                                    "commonVehicleType",
                                                )}
                                                value={
                                                    selectedEditVehicleTypeLabel
                                                }
                                                readOnly
                                                onClick={() =>
                                                    setIsEditTypeMenuOpen(
                                                        (previous) => !previous,
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === "Enter" ||
                                                        event.key === " "
                                                    ) {
                                                        event.preventDefault();
                                                        setIsEditTypeMenuOpen(
                                                            (previous) =>
                                                                !previous,
                                                        );
                                                    }
                                                }}
                                                placeholder=""
                                                error={
                                                    editVehicleForm.errors.type
                                                }
                                                inputClassName="cursor-pointer text-sm text-[#1f2937]"
                                                icon={
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.6"
                                                        className={`transition-transform duration-200 ${isEditTypeMenuOpen ? "rotate-180 text-[#1f2937]" : "text-[#1f2937]"}`}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="m6 9 6 6 6-6"
                                                        />
                                                    </svg>
                                                }
                                                iconClassName="pointer-events-none"
                                                aria-haspopup="listbox"
                                                aria-expanded={
                                                    isEditTypeMenuOpen
                                                }
                                            />
                                            {isEditTypeMenuOpen && (
                                                <div
                                                    ref={editTypeMenuRef}
                                                    className="absolute left-0 -mt-3 z-40"
                                                >
                                                    <Menu
                                                        items={typeMenuItems.filter(
                                                            (item) =>
                                                                item.value &&
                                                                item.label,
                                                        )}
                                                        anchorRef={
                                                            editTypeButtonRef
                                                        }
                                                        onItemClick={(item) => {
                                                            editVehicleForm.setData(
                                                                "type",
                                                                item.value,
                                                            );
                                                            if (
                                                                item.value &&
                                                                editVehicleForm.clearErrors &&
                                                                editVehicleForm
                                                                    .errors.type
                                                            ) {
                                                                editVehicleForm.clearErrors(
                                                                    "type",
                                                                );
                                                            }
                                                            setIsEditTypeMenuOpen(
                                                                false,
                                                            );
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <Input
                                            label={t(
                                                "commonModel",
                                            )}
                                            value={editVehicleForm.data.model}
                                            onChange={(event) =>
                                                editVehicleForm.setData(
                                                    "model",
                                                    sanitizeTextInput(
                                                        event.target.value,
                                                    ),
                                                )
                                            }
                                            error={editVehicleForm.errors.model}
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            label={t(
                                                "commonModelYear",
                                            )}
                                            value={
                                                editVehicleForm.data.model_year
                                            }
                                            onChange={(event) =>
                                                editVehicleForm.setData(
                                                    "model_year",
                                                    sanitizeTextInput(
                                                        event.target.value,
                                                    ),
                                                )
                                            }
                                            error={
                                                editVehicleForm.errors
                                                    .model_year
                                            }
                                            inputClassName="text-sm text-[#1f2937]"
                                        />

                                        <div className="relative">
                                            <Input
                                                label={t(
                                                    "commonStatus",
                                                )}
                                                ref={editStatusButtonRef}
                                                type="text"
                                                value={
                                                    selectedEditVehicleStatusLabel
                                                }
                                                readOnly
                                                onClick={() =>
                                                    setIsEditStatusMenuOpen(
                                                        (previous) => !previous,
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === "Enter" ||
                                                        event.key === " "
                                                    ) {
                                                        event.preventDefault();
                                                        setIsEditStatusMenuOpen(
                                                            (previous) =>
                                                                !previous,
                                                        );
                                                    }
                                                }}
                                                placeholder=""
                                                error={
                                                    editVehicleForm.errors
                                                        .status
                                                }
                                                inputClassName="cursor-pointer text-sm text-[#1f2937]"
                                                icon={
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.6"
                                                        className={`transition-transform duration-200 ${isEditStatusMenuOpen ? "rotate-180 text-[#1f2937]" : "text-[#1f2937]"}`}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="m6 9 6 6 6-6"
                                                        />
                                                    </svg>
                                                }
                                                iconClassName="pointer-events-none"
                                                aria-haspopup="listbox"
                                                aria-expanded={
                                                    isEditStatusMenuOpen
                                                }
                                            />
                                            {isEditStatusMenuOpen && (
                                                <div
                                                    ref={editStatusMenuRef}
                                                    className="absolute left-0 -mt-3 z-40"
                                                >
                                                    <Menu
                                                        items={formStatusMenuItems.filter(
                                                            (item) =>
                                                                item.value &&
                                                                item.label,
                                                        )}
                                                        anchorRef={
                                                            editStatusButtonRef
                                                        }
                                                        onItemClick={(item) => {
                                                            editVehicleForm.setData(
                                                                "status",
                                                                item.value,
                                                            );
                                                            if (
                                                                item.value &&
                                                                editVehicleForm.clearErrors &&
                                                                editVehicleForm
                                                                    .errors
                                                                    .status
                                                            ) {
                                                                editVehicleForm.clearErrors(
                                                                    "status",
                                                                );
                                                            }
                                                            setIsEditStatusMenuOpen(
                                                                false,
                                                            );
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            label={t(
                                                "commonPlateNumber",
                                            )}
                                            value={
                                                editVehicleForm.data
                                                    .license_plate
                                            }
                                            onChange={(event) =>
                                                editVehicleForm.setData(
                                                    "license_plate",
                                                    sanitizeTextInput(
                                                        event.target.value,
                                                    ),
                                                )
                                            }
                                            onBeforeInput={(event) => {
                                                const d = event.data ?? "";
                                                if (
                                                    /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(
                                                        d,
                                                    ) ||
                                                    /[\u2600-\u27BF\uFE0F\u200D]/.test(
                                                        d,
                                                    )
                                                ) {
                                                    event.preventDefault();
                                                }
                                            }}
                                            error={
                                                editVehicleForm.errors
                                                    .license_plate
                                            }
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                        <Input
                                            type="date"
                                            label={t(
                                                "commonPermitExpiry",
                                            )}
                                            value={
                                                editVehicleForm.data
                                                    .permit_expires_at
                                            }
                                            onChange={(event) =>
                                                editVehicleForm.setData(
                                                    "permit_expires_at",
                                                    event.target.value,
                                                )
                                            }
                                            error={
                                                editVehicleForm.errors
                                                    .permit_expires_at
                                            }
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            type="date"
                                            label={t(
                                                "commonInsuranceExpiry",
                                            )}
                                            value={
                                                editVehicleForm.data
                                                    .insurance_expires_at
                                            }
                                            onChange={(event) =>
                                                editVehicleForm.setData(
                                                    "insurance_expires_at",
                                                    event.target.value,
                                                )
                                            }
                                            error={
                                                editVehicleForm.errors
                                                    .insurance_expires_at
                                            }
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-semibold text-blue-500">
                                                {t(
                                                    "commonDocuments",
                                                )}
                                            </label>
                                            <div className="rounded-2xl border border-[#e2e8f0] p-3 space-y-2 text-sm text-[#1f2937] bg-[#f8fafc]">
                                                <div>
                                                    <span className="font-medium">
                                                        {t(
                                                            "superAdminVehiclesDocumentVehicleRegistration",
                                                        )}
                                                    </span>{" "}
                                                    {vehicleBeingEdited?.vehicle_registration_path ? (
                                                        <a
                                                            href={ensureAbsoluteAsset(
                                                                vehicleBeingEdited.vehicle_registration_path,
                                                            )}
                                                            className="text-blue-500 underline"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {t(
                                                                "commonView",
                                                            )}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[#94a3b8]">
                                                            {t(
                                                                "superAdminVehiclesDocumentNotUploaded",
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-medium">
                                                        {t(
                                                            "superAdminVehiclesDocumentCarInsurance",
                                                        )}
                                                    </span>{" "}
                                                    {vehicleBeingEdited?.car_insurance_path ? (
                                                        <a
                                                            href={ensureAbsoluteAsset(
                                                                vehicleBeingEdited.car_insurance_path,
                                                            )}
                                                            className="text-blue-500 underline"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {t(
                                                                "commonView",
                                                            )}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[#94a3b8]">
                                                            {t(
                                                                "superAdminVehiclesDocumentNotUploaded",
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-medium">
                                                        {t(
                                                            "superAdminVehiclesDocumentOperatingPermit",
                                                        )}
                                                    </span>{" "}
                                                    {vehicleBeingEdited?.operating_permit_path ? (
                                                        <a
                                                            href={ensureAbsoluteAsset(
                                                                vehicleBeingEdited.operating_permit_path,
                                                            )}
                                                            className="text-blue-500 underline"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {t(
                                                                "commonView",
                                                            )}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[#94a3b8]">
                                                            {t(
                                                                "superAdminVehiclesDocumentNotUploaded",
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {Array.isArray(
                                            vehicleBeingEdited?.additional_documents,
                                        ) &&
                                            vehicleBeingEdited
                                                .additional_documents.length >
                                                0 && (
                                                <div className="rounded-2xl border border-dashed border-[#e2e8f0] p-3 bg-white">
                                                    <p className="text-xs font-semibold text-[#475569] mb-2">
                                                        Additional Documents
                                                    </p>
                                                    <ul className="space-y-1 text-xs text-[#1f2937]">
                                                        {vehicleBeingEdited.additional_documents.map(
                                                            (doc, index) => (
                                                                <li
                                                                    key={`${doc.path}-${index}`}
                                                                >
                                                                    <a
                                                                        href={ensureAbsoluteAsset(
                                                                            doc.path,
                                                                        )}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-500 underline break-words"
                                                                    >
                                                                        {doc.original_name ??
                                                                            `Document ${index + 1}`}
                                                                    </a>
                                                                </li>
                                                            ),
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FileUpload
                                        name="vehicle_registration"
                                        onChange={(file) =>
                                            editVehicleForm.setData(
                                                "vehicle_registration",
                                                file,
                                            )
                                        }
                                        error={
                                            editVehicleForm.errors
                                                .vehicle_registration
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadReplaceVehicleRegistration",
                                        )}
                                    />

                                    <FileUpload
                                        name="car_insurance"
                                        onChange={(file) =>
                                            editVehicleForm.setData(
                                                "car_insurance",
                                                file,
                                            )
                                        }
                                        error={
                                            editVehicleForm.errors.car_insurance
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadReplaceCarInsurance",
                                        )}
                                    />

                                    <FileUpload
                                        name="operating_permit"
                                        onChange={(file) =>
                                            editVehicleForm.setData(
                                                "operating_permit",
                                                file,
                                            )
                                        }
                                        error={
                                            editVehicleForm.errors
                                                .operating_permit
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadReplaceOperatingPermit",
                                        )}
                                    />

                                    <FileUpload
                                        name="additional_documents"
                                        onChange={(files) =>
                                            editVehicleForm.setData(
                                                "additional_documents",
                                                files,
                                            )
                                        }
                                        error={
                                            editVehicleForm.errors
                                                .additional_documents
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadAdditionalDocuments",
                                        )}
                                        multiple={true}
                                    />
                                </div>

                                <div className="px-6 pb-6 pt-2 mt-auto">
                                    <div className="flex items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={closeEditDrawer}
                                            className="flex-1 h-[54px] rounded-full border-2 border-[#6eb0ff] text-blue-500 font-medium hover:bg-[#eff6ff]"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            onClick={submitEditVehicle}
                                            disabled={
                                                editVehicleForm.processing
                                            }
                                            className="flex-1 h-[54px] rounded-full bg-[#338dff] text-white font-medium shadow-[0_12px_24px_rgba(51,141,255,0.25)] hover:bg-[#2f7ee6] disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {editVehicleForm.processing
                                                ? "Saving..."
                                                : "Save Changes"}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <Head title="Vehicle Management" />

                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 text-sm mb-8">
                    {statsCards.map((card) => (
                        <StatsCard
                            key={card.label}
                            title={card.label}
                            value={card.value}
                            iconSrc={card.icon}
                            isSpecialCard={card.isSpecialCard ?? false}
                            accentColor="#338dff"
                        />
                    ))}
                </section>

                <Card
                    title={t("commonVehicleManagement")}
                    toolbar={
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                            <div className="relative w-full md:w-64">
                                <input
                                    type="text"
                                    placeholder={t('commonSearch')}
                                    value={searchTerm}
                                    onChange={(event) =>
                                        setSearchTerm(event.target.value)
                                    }
                                    className="w-full rounded-full border border-[#e2e8f0] bg-white px-12 py-2.5 text-sm text-[#1f2937] focus:outline-none focus:ring-4 focus:ring-[#338dff33]"
                                />
                                <svg
                                    className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65Z"
                                    />
                                </svg>
                            </div>

                            <div className="relative">
                                <button
                                    type="button"
                                    ref={statusButtonRef}
                                    onClick={() =>
                                        setShowStatusMenu((prev) => !prev)
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm transition hover:border-[#94a3b8]"
                                    aria-haspopup="menu"
                                    aria-expanded={showStatusMenu}
                                >
                                    <span className="flex items-center gap-[6px]">
                                        <img
                                            src="/assets/images/filter.png"
                                            alt="filter icon"
                                            className="w-[18px] h-[18px] flex-shrink-0"
                                        />
                                        <span className="font-normal text-xs text-gray-500 whitespace-nowrap">
                                            {t("commonSortBy")}
                                        </span>
                                    </span>
                                    <span className="font-medium text-[#0f172a]">
                                        {statusOptions.find(
                                            (item) =>
                                                item.value === statusFilter,
                                        )?.label ??
                                            t("commonAllStatuses")}
                                    </span>
                                    <svg
                                        className="w-4 h-4 text-[#1f2937]"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="m6 9 6 6 6-6"
                                        />
                                    </svg>
                                </button>

                                {showStatusMenu && (
                                    <div
                                        ref={statusMenuRef}
                                        className="absolute right-0 mt-2 z-40"
                                    >
                                        <Menu
                                            items={statusMenuItems}
                                            onItemClick={(item) =>
                                                applyStatusFilter(item.value)
                                            }
                                        />
                                    </div>
                                )}
                            </div>

                            <PrimaryButton
                                text={t("commonAddVehicle")}
                                onClick={openAddDrawer}
                                className="w-full md:w-auto"
                            />
                        </div>
                    }
                    padding="none"
                >
                    <Table
                        columns={vehicleColumns}
                        data={paginatedVehicles}
                        keyField="id"
                        emptyMessage={t("superAdminVehiclesTableEmpty")}
                        striped
                        pagination
                        currentPage={paginationMeta.currentPage}
                        totalPages={paginationMeta.totalPages}
                        onPageChange={handlePageChange}
                        paginationMeta={paginationMeta}
                        showPaginationInfo
                    />
                </Card>

                {isAddDrawerOpen && (
                    <div className="fixed inset-0 z-40">
                        <div
                            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
                            onClick={() => setAddDrawerOpen(false)}
                            aria-hidden="true"
                        />
                        <div className="absolute inset-y-0 right-0 w-full max-w-[480px] bg-white rounded-l-[28px] border border-[#e5e7eb] shadow-[0_20px_45px_rgba(15,23,42,0.25)] transition-transform duration-300 ease-out flex flex-col h-full">
                            <div className="px-6 pt-6 pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-[#0f172a]">
                                            {t(
                                                "commonAddVehicle",
                                            )}
                                        </h2>
                                        <p className="text-sm text-[#64748b] mt-1">
                                            {t(
                                                "superAdminVehiclesDrawerDescriptionAdd",
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAddDrawerOpen(false)}
                                        className="text-2xl leading-none text-slate-500 hover:text-[#1f2937]"
                                        aria-label="Close add vehicle panel"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="mt-4 h-px bg-[#e5e7eb]" />
                            </div>

                            <form
                                onSubmit={submitAddVehicle}
                                className="flex-1 overflow-y-auto px-6 pb-4 space-y-5"
                            >
                                <div className="relative">
                                    <Input
                                        ref={typeMenuButtonRef}
                                        type="text"
                                        label={t(
                                            "commonVehicleType",
                                        )}
                                        value={selectedVehicleTypeLabel}
                                        readOnly
                                        onClick={() =>
                                            setIsTypeMenuOpen(
                                                (previous) => !previous,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" ||
                                                event.key === " "
                                            ) {
                                                event.preventDefault();
                                                setIsTypeMenuOpen(
                                                    (previous) => !previous,
                                                );
                                            }
                                        }}
                                        placeholder=""
                                        error={addVehicleForm.errors.type}
                                        containerClassName="mt-5"
                                        inputClassName="cursor-pointer text-sm text-[#1f2937]"
                                        icon={
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.6"
                                                className={`transition-transform duration-200 ${
                                                    isTypeMenuOpen
                                                        ? "rotate-180 text-[#1f2937]"
                                                        : "text-[#1f2937]"
                                                }`}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="m6 9 6 6 6-6"
                                                />
                                            </svg>
                                        }
                                        iconClassName="pointer-events-none"
                                        aria-haspopup="listbox"
                                        aria-expanded={isTypeMenuOpen}
                                        aria-controls="vehicle-type-menu"
                                    />
                                    {isTypeMenuOpen && (
                                        <div
                                            id="vehicle-type-menu"
                                            ref={typeMenuRef}
                                            className="absolute left-0 z-40 -mt-3"
                                        >
                                            <Menu
                                                items={typeMenuItems.filter(
                                                    (item) =>
                                                        item.value &&
                                                        item.label,
                                                )}
                                                anchorRef={typeMenuButtonRef}
                                                onItemClick={(item) => {
                                                    addVehicleForm.setData(
                                                        "type",
                                                        item.value,
                                                    );
                                                    if (
                                                        item.value &&
                                                        addVehicleForm.clearErrors &&
                                                        addVehicleForm.errors
                                                            .type
                                                    ) {
                                                        addVehicleForm.clearErrors(
                                                            "type",
                                                        );
                                                    }
                                                    setIsTypeMenuOpen(false);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Input
                                            type="text"
                                            label={t(
                                                "commonModel",
                                            )}
                                            value={addVehicleForm.data.model}
                                            onChange={(event) =>
                                                addVehicleForm.setData(
                                                    "model",
                                                    sanitizeTextInput(
                                                        event.target.value,
                                                    ),
                                                )
                                            }
                                            onBeforeInput={(event) => {
                                                const d = event.data ?? "";
                                                if (
                                                    /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(
                                                        d,
                                                    ) ||
                                                    /[\u2600-\u27BF\uFE0F\u200D]/.test(
                                                        d,
                                                    )
                                                ) {
                                                    event.preventDefault();
                                                }
                                            }}
                                            onPaste={(event) => {
                                                const pasted = (
                                                    event.clipboardData ||
                                                    window.clipboardData
                                                ).getData("text");
                                                const sanitized =
                                                    sanitizeTextInput(pasted);
                                                if (sanitized !== pasted) {
                                                    event.preventDefault();
                                                    const target = event.target;
                                                    const start =
                                                        target.selectionStart ||
                                                        0;
                                                    const end =
                                                        target.selectionEnd ||
                                                        0;
                                                    const next =
                                                        (
                                                            target.value || ""
                                                        ).slice(0, start) +
                                                        sanitized +
                                                        (
                                                            target.value || ""
                                                        ).slice(end);
                                                    addVehicleForm.setData(
                                                        "model",
                                                        next,
                                                    );
                                                }
                                            }}
                                            error={addVehicleForm.errors.model}
                                            containerClassName="!mb-0"
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                    </div>
                                    <div>
                                        <Input
                                            type="text"
                                            label={t(
                                                "commonModelYear",
                                            )}
                                            value={
                                                addVehicleForm.data.model_year
                                            }
                                            onChange={(event) =>
                                                addVehicleForm.setData(
                                                    "model_year",
                                                    sanitizeTextInput(
                                                        event.target.value,
                                                    ),
                                                )
                                            }
                                            onBeforeInput={(event) => {
                                                const d = event.data ?? "";
                                                if (
                                                    /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(
                                                        d,
                                                    ) ||
                                                    /[\u2600-\u27BF\uFE0F\u200D]/.test(
                                                        d,
                                                    )
                                                ) {
                                                    event.preventDefault();
                                                }
                                            }}
                                            onPaste={(event) => {
                                                const pasted = (
                                                    event.clipboardData ||
                                                    window.clipboardData
                                                ).getData("text");
                                                const sanitized =
                                                    sanitizeTextInput(pasted);
                                                if (sanitized !== pasted) {
                                                    event.preventDefault();
                                                    const target = event.target;
                                                    const start =
                                                        target.selectionStart ||
                                                        0;
                                                    const end =
                                                        target.selectionEnd ||
                                                        0;
                                                    const next =
                                                        (
                                                            target.value || ""
                                                        ).slice(0, start) +
                                                        sanitized +
                                                        (
                                                            target.value || ""
                                                        ).slice(end);
                                                    addVehicleForm.setData(
                                                        "model_year",
                                                        next,
                                                    );
                                                }
                                            }}
                                            error={
                                                addVehicleForm.errors.model_year
                                            }
                                            containerClassName="!mb-0"
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Input
                                        type="text"
                                        label={t(
                                            "commonPlateNumber",
                                        )}
                                        value={
                                            addVehicleForm.data.license_plate
                                        }
                                        onChange={(event) =>
                                            addVehicleForm.setData(
                                                "license_plate",
                                                sanitizeTextInput(
                                                    event.target.value,
                                                ),
                                            )
                                        }
                                        onBeforeInput={(event) => {
                                            const d = event.data ?? "";
                                            if (
                                                /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(
                                                    d,
                                                ) ||
                                                /[\u2600-\u27BF\uFE0F\u200D]/.test(
                                                    d,
                                                )
                                            ) {
                                                event.preventDefault();
                                            }
                                        }}
                                        onPaste={(event) => {
                                            const pasted = (
                                                event.clipboardData ||
                                                window.clipboardData
                                            ).getData("text");
                                            const sanitized =
                                                sanitizeTextInput(pasted);
                                            if (sanitized !== pasted) {
                                                event.preventDefault();
                                                const target = event.target;
                                                const start =
                                                    target.selectionStart || 0;
                                                const end =
                                                    target.selectionEnd || 0;
                                                const next =
                                                    (target.value || "").slice(
                                                        0,
                                                        start,
                                                    ) +
                                                    sanitized +
                                                    (target.value || "").slice(
                                                        end,
                                                    );
                                                addVehicleForm.setData(
                                                    "license_plate",
                                                    next,
                                                );
                                            }
                                        }}
                                        error={
                                            addVehicleForm.errors.license_plate
                                        }
                                        containerClassName="!mb-0"
                                        inputClassName="text-sm text-[#1f2937]"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                                    <div>
                                        <Input
                                            type="date"
                                            label={t(
                                                "commonPermitExpiry",
                                            )}
                                            value={
                                                addVehicleForm.data
                                                    .permit_expires_at
                                            }
                                            onChange={(event) =>
                                                addVehicleForm.setData(
                                                    "permit_expires_at",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="date"
                                            error={
                                                addVehicleForm.errors
                                                    .permit_expires_at
                                            }
                                            containerClassName="mb-5"
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                    </div>
                                    <div>
                                        <Input
                                            type="date"
                                            label={t(
                                                "commonInsuranceExpiry",
                                            )}
                                            value={
                                                addVehicleForm.data
                                                    .insurance_expires_at
                                            }
                                            onChange={(event) =>
                                                addVehicleForm.setData(
                                                    "insurance_expires_at",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="date"
                                            error={
                                                addVehicleForm.errors
                                                    .insurance_expires_at
                                            }
                                            containerClassName="mb-5"
                                            inputClassName="text-sm text-[#1f2937]"
                                        />
                                    </div>
                                </div>

                                <div className="relative">
                                    <Input
                                        items={formStatusMenuItems.filter(
                                            (item) => item.value && item.label,
                                        )}
                                        ref={formStatusButtonRef}
                                        type="text"
                                        label={t(
                                            "commonStatus",
                                        )}
                                        value={selectedFormStatusLabel}
                                        readOnly
                                        onClick={() =>
                                            setIsFormStatusMenuOpen(
                                                (previous) => !previous,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" ||
                                                event.key === " "
                                            ) {
                                                event.preventDefault();
                                                setIsFormStatusMenuOpen(
                                                    (previous) => !previous,
                                                );
                                            }
                                        }}
                                        placeholder=""
                                        error={addVehicleForm.errors.status}
                                        inputClassName="cursor-pointer text-sm text-[#1f2937]"
                                        icon={
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.6"
                                                className={`transition-transform duration-200 ${
                                                    isFormStatusMenuOpen
                                                        ? "rotate-180 text-[#1f2937]"
                                                        : "text-[#1f2937]"
                                                }`}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="m6 9 6 6 6-6"
                                                />
                                            </svg>
                                        }
                                        iconClassName="pointer-events-none"
                                        aria-haspopup="listbox"
                                        aria-expanded={isFormStatusMenuOpen}
                                        aria-controls="vehicle-status-menu"
                                    />
                                    {isFormStatusMenuOpen && (
                                        <div
                                            id="vehicle-status-menu"
                                            ref={formStatusMenuRef}
                                            className="absolute left-0 -mt-3 z-40"
                                        >
                                            <Menu
                                                items={formStatusMenuItems.filter(
                                                    (item) =>
                                                        item.value &&
                                                        item.label,
                                                )}
                                                anchorRef={formStatusButtonRef}
                                                onItemClick={(item) => {
                                                    addVehicleForm.setData(
                                                        "status",
                                                        item.value,
                                                    );
                                                    if (
                                                        item.value &&
                                                        addVehicleForm.clearErrors &&
                                                        addVehicleForm.errors
                                                            .status
                                                    ) {
                                                        addVehicleForm.clearErrors(
                                                            "status",
                                                        );
                                                    }
                                                    setIsFormStatusMenuOpen(
                                                        false,
                                                    );
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Document Upload Section */}
                                <div className="grid grid-cols-2 gap-4">
                                    <FileUpload
                                        name="vehicle_registration"
                                        onChange={(file) =>
                                            addVehicleForm.setData(
                                                "vehicle_registration",
                                                file,
                                            )
                                        }
                                        error={
                                            addVehicleForm.errors
                                                .vehicle_registration
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadVehicleRegistration",
                                        )}
                                    />

                                    <FileUpload
                                        name="car_insurance"
                                        onChange={(file) =>
                                            addVehicleForm.setData(
                                                "car_insurance",
                                                file,
                                            )
                                        }
                                        error={
                                            addVehicleForm.errors.car_insurance
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadCarInsurance",
                                        )}
                                    />

                                    <FileUpload
                                        name="operating_permit"
                                        onChange={(file) =>
                                            addVehicleForm.setData(
                                                "operating_permit",
                                                file,
                                            )
                                        }
                                        error={
                                            addVehicleForm.errors
                                                .operating_permit
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadOperatingPermit",
                                        )}
                                    />

                                    <FileUpload
                                        name="additional_documents"
                                        onChange={(files) =>
                                            addVehicleForm.setData(
                                                "additional_documents",
                                                files
                                                    ? Array.from(files)
                                                    : null,
                                            )
                                        }
                                        error={
                                            addVehicleForm.errors
                                                .additional_documents
                                        }
                                        uploadPlaceholderLabel={t(
                                            "superAdminVehiclesUploadAdditionalDocument",
                                        )}
                                        multiple={true}
                                    />
                                </div>
                            </form>

                            <div className="px-6 pb-6 pt-2 mt-auto">
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setAddDrawerOpen(false)}
                                        className="flex-1 h-[54px] rounded-full border-2 border-[#6eb0ff] text-blue-500 font-medium hover:bg-[#eff6ff]"
                                    >
                                        {t("commonCancel")}
                                    </button>
                                    <button
                                        type="submit"
                                        onClick={submitAddVehicle}
                                        disabled={addVehicleForm.processing}
                                        className="flex-1 h-[54px] rounded-full bg-[#338dff] text-white font-medium shadow-[0_12px_24px_rgba(51,141,255,0.25)] hover:bg-[#2f7ee6] disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {addVehicleForm.processing
                                            ? t("commonSaving")
                                            : t(
                                                  "commonAddVehicle",
                                              )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isStatusDrawerOpen && (
                    <div className="fixed inset-0 z-50">
                        <div
                            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
                            onClick={closeStatusDrawer}
                            aria-hidden="true"
                        />
                        <div className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-white border border-[#e5e7eb] rounded-l-[28px] shadow-[0_20px_45px_rgba(15,23,42,0.25)] transition-transform duration-300 ease-out flex flex-col">
                            <div className="px-6 pt-6 pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-[#0f172a]">
                                            {t(
                                                "commonUpdateStatus",
                                            )}
                                        </h2>
                                        <p className="text-sm text-[#64748b] mt-1">
                                            {t(
                                                "superAdminVehiclesStatusDrawerDescription",
                                            )}{" "}
                                            <span className="font-medium text-[#0f172a]">
                                                {vehicleForStatusUpdate?.code ??
                                                    t(
                                                        "superAdminVehiclesStatusDrawerFallback",
                                                    )}
                                            </span>
                                            {selectedStatusDrawerLabel ? (
                                                <span className="text-[#94a3b8]">
                                                    {" "}
                                                    ·{" "}
                                                    {selectedStatusDrawerLabel}
                                                </span>
                                            ) : null}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeStatusDrawer}
                                        className="text-2xl leading-none text-slate-500 hover:text-[#1f2937]"
                                        aria-label="Close edit vehicle panel"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="mt-4 h-px bg-[#e5e7eb]" />
                            </div>

                            <form
                                onSubmit={submitStatusUpdate}
                                className="flex-1 flex flex-col px-6 pb-6 gap-6"
                            >
                                <div>
                                    <p className="text-sm text-[#475569] mb-2">
                                        {t('superAdminVehiclesStatusDrawerFallback')}
                                    </p>
                                    <div className="rounded-2xl border border-[#e2e8f0] px-4 py-3 text-sm text-[#0f172a]">
                                        <div className="font-medium">
                                            {vehicleForStatusUpdate?.code ??
                                                "--"}
                                        </div>
                                        <div className="text-[#64748b] text-xs">
                                            {vehicleForStatusUpdate?.license_plate ??
                                                "No plate number"}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label
                                        className="text-sm font-medium text-[#0f172a]"
                                        htmlFor="vehicle-status-select"
                                    >
                                        {t("commonStatus")}
                                    </label>
                                    <div className="mt-2">
                                        <select
                                            id="vehicle-status-select"
                                            value={statusForm.data.status ?? ""}
                                            onChange={(event) =>
                                                statusForm.setData(
                                                    "status",
                                                    event.target.value,
                                                )
                                            }
                                            className="w-full rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#338dff66]"
                                        >
                                            <option value="">
                                                {t(
                                                    "superAdminVehiclesSelectStatus",
                                                )}
                                            </option>
                                            {statusChoices.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        {statusForm.errors.status && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {statusForm.errors.status}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-auto flex flex-col gap-4 sm:flex-row">
                                    <OutlineButton
                                        onClick={closeStatusDrawer}
                                        text={t("commonCancel")}
                                        width="100%"
                                        height="54px"
                                        className="text-base"
                                    />
                                    <PrimaryButton
                                        type="submit"
                                        disabled={statusForm.processing}
                                        text={
                                            statusForm.processing
                                                ? t("commonSaving")
                                                : t(
                                                      "commonUpdateStatus",
                                                  )
                                        }
                                        width="100%"
                                        height="54px"
                                        className="text-base"
                                    />
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isAssignDrawerOpen && (
                    <div className="fixed inset-0 z-50">
                        <div
                            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
                            onClick={() => setAssignDrawerOpen(false)}
                            aria-hidden="true"
                        />
                        <div className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-white border border-[#e5e7eb] rounded-l-[28px] shadow-[0_20px_45px_rgba(15,23,42,0.25)] transition-transform duration-300 ease-out flex flex-col">
                            <div className="px-6 pt-6 pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-[#0f172a]">
                                            {t("commonAssignVehicle")}
                                        </h2>
                                        <p className="text-sm text-[#64748b] mt-1">
                                            {t(
                                                "superAdminVehiclesAssignDescription",
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAssignDrawerOpen(false)
                                        }
                                        className="text-2xl leading-none text-slate-500 hover:text-[#1f2937]"
                                        aria-label="Close assign vehicle panel"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="mt-4 h-px bg-[#e5e7eb]" />
                            </div>

                            <div className="px-6">
                                <div className="w-full rounded-full border border-[#e2e8f0] bg-white px-4 py-3">
                                    <input
                                        type="text"
                                        placeholder={t(
                                            "superAdminVehiclesAssignSearchPlaceholder",
                                        )}
                                        value={riderSearch}
                                        onChange={(event) =>
                                            setRiderSearch(event.target.value)
                                        }
                                        className="w-full outline-none text-sm text-[#1f2937] placeholder:text-[#9ca3af]"
                                    />
                                </div>
                                {assignForm.errors.user_id && (
                                    <div className="mt-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-200">
                                        <div className="flex items-start gap-2">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 text-red-600 flex-shrink-0"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <p className="text-sm text-red-600 flex-1">
                                                {assignForm.errors.user_id}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex-1 overflow-y-auto px-6">
                                <ul className="divide-y divide-[#e5e7eb]">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => {
                                            const isSelected =
                                                selectedRiderId === user.id;
                                            return (
                                                <li
                                                    key={
                                                        user.id ?? "unassigned"
                                                    }
                                                    className="py-4"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedRiderId(
                                                                user.id,
                                                            );
                                                            assignForm.clearErrors(
                                                                "user_id",
                                                            );
                                                            setErrorPopup({
                                                                visible: false,
                                                                message: "",
                                                            });
                                                        }}
                                                        className="w-full flex items-center justify-between text-left"
                                                    >
                                                        <span className="text-base text-[#111827]">
                                                            {user.name}
                                                        </span>
                                                        <span
                                                            className={`h-5 w-5 rounded-full border-2 grid place-items-center transition ${
                                                                isSelected
                                                                    ? "border-[#338dff]"
                                                                    : "border-[#d1d5db]"
                                                            }`}
                                                        >
                                                            <span
                                                                className={`h-2.5 w-2.5 rounded-full bg-[#338dff] transition ${
                                                                    isSelected
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                }`}
                                                            />
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })
                                    ) : (
                                        <li className="py-6 text-sm text-slate-500">
                                            {t(
                                                "superAdminVehiclesAssignNoUsers",
                                            )}
                                        </li>
                                    )}
                                </ul>
                            </div>

                            <div className="px-6 pb-6 pt-3 mt-auto">
                                <div className="flex items-center gap-4">
                                    <OutlineButton
                                        onClick={() =>
                                            setAssignDrawerOpen(false)
                                        }
                                        text={t("commonCancel")}
                                        width="170px"
                                        height="60px"
                                        className="text-lg"
                                    />
                                    <PrimaryButton
                                        type="button"
                                        onClick={submitAssignment}
                                        disabled={assignForm.processing}
                                        text={
                                            assignForm.processing
                                                ? t(
                                                      "commonAssigning",
                                                  )
                                                : t(
                                                      "commonAssignVehicle",
                                                  )
                                        }
                                        width="243px"
                                        height="60px"
                                        className="text-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Popup */}
                {errorPopup.visible && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center">
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() =>
                                setErrorPopup({ visible: false, message: "" })
                            }
                            aria-hidden="true"
                        />
                        <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fadeIn">
                            {/* Red danger header */}
                            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-6 w-6 text-white"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white">
                                        {t("superAdminVehiclesErrorTitle")}
                                    </h3>
                                </div>
                            </div>

                            {/* Message content */}
                            <div className="px-6 py-6">
                                <p className="text-gray-700 text-base leading-relaxed">
                                    {errorPopup.message}
                                </p>
                            </div>

                            {/* Footer with close button */}
                            <div className="px-6 pb-6 flex justify-end">
                                <button
                                    onClick={() =>
                                        setErrorPopup({
                                            visible: false,
                                            message: "",
                                        })
                                    }
                                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-full hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                                >
                                    {t("commonClose")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </SuperAdminAuthenticated>
    );
}
