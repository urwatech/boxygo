import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import { Head, Link, router } from '@inertiajs/react';
import Table from '../../../Components/Common/Table';
import Card from '../../../Components/Common/Card';
import Menu from '../../../Components/Common/Menu';
import PrimaryButton from '../Components/PrimaryButton';
import ConfirmDialog from '../../../Components/SuperAdmin/ConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function Index({ roles, canEdit }) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const roleMenuRef = useRef(null);
    const roleButtonRef = useRef(null);

    const filteredRoles = roles.filter(role => {
        const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesFilter = roleFilter === 'All' || role.name === roleFilter;
        return matchesSearch && matchesFilter;
    });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showRoleMenu
                && !roleMenuRef.current?.contains(event.target)
                && !roleButtonRef.current?.contains(event.target)
            ) {
                setShowRoleMenu(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowRoleMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showRoleMenu]);

    const roleMenuItems = useMemo(() => {
        const uniqueRoleNames = Array.from(new Set(roles.map((role) => role.name)));
        return [{ label: t('commonAll'), value: 'All' }, ...uniqueRoleNames.map((name) => ({ label: name, value: name }))];
    }, [roles, t]);

    const handleDelete = useCallback((role) => {
        setRoleToDelete(role);
        setShowDeleteDialog(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (!roleToDelete) return;

        setIsDeleting(true);
        router.delete(route('admin.roles.destroy', roleToDelete.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowDeleteDialog(false);
                setRoleToDelete(null);
                setIsDeleting(false);
            },
            onError: () => {
                setIsDeleting(false);
            },
        });
    }, [roleToDelete]);

    const handleCancelDelete = useCallback(() => {
        setShowDeleteDialog(false);
        setRoleToDelete(null);
    }, []);

    const handleRoleSelect = useCallback((item) => {
        setRoleFilter(item.value);
        setShowRoleMenu(false);
    }, []);

    const handleAddRole = useCallback(() => {
        router.visit(route('admin.roles.create'));
    }, []);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '--';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    }, []);

    const RoleActions = ({ role, onDelete }) => {
        const [isMenuOpen, setIsMenuOpen] = useState(false);
        const actionButtonRef = useRef(null);
        const actionMenuRef = useRef(null);

        useEffect(() => {
            if (!isMenuOpen) {
                return undefined;
            }

            const handleClickOutside = (event) => {
                if (
                    !actionMenuRef.current?.contains(event.target)
                    && !actionButtonRef.current?.contains(event.target)
                ) {
                    setIsMenuOpen(false);
                }
            };

            const handleEscape = (event) => {
                if (event.key === 'Escape') {
                    setIsMenuOpen(false);
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
            };
        }, [isMenuOpen]);

        const handleMenuAction = (action) => {
            setIsMenuOpen(false);

            if (action === 'edit' || action === 'view') {
                router.visit(route('admin.roles.edit', role.id));
            }

            if (action === 'delete') {
                onDelete(role);
            }
        };

        if (role.is_protected) {
            return (
                <div className="relative inline-flex items-center">
                    <button
                        type="button"
                        ref={actionButtonRef}
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                        className="inline-flex items-center justify-center"
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        aria-label={t('superAdminRolesActionMenuAria', { roleName: role.name })}
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
                                    onClick={() => handleMenuAction('view')}
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
                                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                        <span>{t('superAdminRolesActionView')}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="relative inline-flex items-center">
                <button
                    type="button"
                    ref={actionButtonRef}
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    className="inline-flex items-center justify-center"
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    aria-label={`Actions for ${role.name}`}
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
                                onClick={() => handleMenuAction('edit')}
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
                                <span>{t('commonEditRole')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleMenuAction('delete')}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#0F172A] hover:bg-gray-50 cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="w-4 h-4 text-red-500"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                    />
                                </svg>
                                <span>{t('commonDeleteRole')}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const columns = useMemo(() => [
        {
            key: 'name',
            label: t('superAdminRolesColumnTitle'),
            render: (value) => <span className="font-medium">{value}</span>,
        },
        {
            key: 'description',
            label: t('commonDescription'),
            render: (value) => value || '--',
        },
        {
            key: 'platform',
            label: t('commonPlatform'),
            render: (value) => value || '--',
        },
        {
            key: 'country',
            label: t('superAdminRolesColumnCountry'),
            render: (value) => value || '--',
        },
        {
            key: 'created_at',
            label: t('commonCreatedOn'),
            render: (value) => formatDate(value),
        },
        {
            key: 'created_by',
            label: t('superAdminRolesColumnCreatedBy'),
            render: (value) => value?.name || '--',
        },
        {
            key: 'actions',
            label: t('commonActions'),
            align: 'right',
            headerClassName: 'text-right',
            render: (_, role) => <RoleActions role={role} onDelete={handleDelete} />,
        },
    ], [formatDate, handleDelete, t]);

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('commonUserRoles')}</h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <span className="font-medium text-gray-500">{t('commonUserRoles')}</span>
                    </nav>
                </div>
            }>

            <Head title={t('commonUserRoles')} />

            {/* Roles Card */}
            <Card
                title={t('commonAllRoles')}
                toolbar={(
                    <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <input
                                type="text"
                                placeholder={t('superAdminRolesSearchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-full border border-[#e2e8f0] bg-white px-12 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[#338dff33]"
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
                                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15a7.5 7.5 0 0 0 9.15 1.65z"
                                />
                            </svg>
                        </div>

                        <div className="relative md:ml-1" ref={roleMenuRef}>
                            <button
                                type="button"
                                ref={roleButtonRef}
                                onClick={() => setShowRoleMenu((prev) => !prev)}
                                className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm transition hover:border-[#94a3b8]"
                                aria-haspopup="menu"
                                aria-expanded={showRoleMenu}
                            >
                                <span className="flex items-center gap-[6px]">
                                    <img
                                        src="/assets/images/filter.png"
                                        alt="filter icon"
                                        className="w-[18px] h-[18px] flex-shrink-0"
                                    />
                                    <span className="font-normal text-xs text-gray-500 whitespace-nowrap">
                                        {t('commonSortColon')}
                                    </span>
                                </span>
                                <span className="font-medium text-[#0f172a]">
                                    {roleMenuItems.find((item) => item.value === roleFilter)?.label ?? t('commonAll')}
                                </span>
                                <svg
                                    className="w-4 h-4 text-[#1f2937]"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                </svg>
                            </button>

                            {showRoleMenu && (
                                <div className="absolute right-0 mt-2 z-40">
                                    <Menu
                                        items={roleMenuItems}
                                        onItemClick={handleRoleSelect}
                                        anchorRef={roleButtonRef}
                                    />
                                </div>
                            )}
                        </div>

                        <PrimaryButton
                            text={t('commonAddNewRole')}
                            onClick={handleAddRole}
                            width="160px"
                            height="40px"
                        />
                    </div>
                )}
                padding="none"
            >
                <Table
                    columns={columns}
                    data={filteredRoles}
                    keyField="id"
                    emptyMessage={t('superAdminRolesTableEmpty')}
                    tableClassName="min-w-[980px]"
                    theadClassName="[&>tr] [&>tr]:border-0"
                    rowClassName={(row, index) => (index % 2 !== 0 ? 'bg-[#f5f7fb]' : '')}
                />
            </Card>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={showDeleteDialog}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title={t('commonDeleteRole')}
                message={
                    roleToDelete?.name
                        ? t('superAdminRolesDeleteMessage', { name: roleToDelete.name })
                        : t('superAdminRolesDeleteFallback')
                }
                confirmText={t('commonDelete')}
                cancelText={t('commonCancel')}
                isProcessing={isDeleting}
            />
        </SuperAdminAuthenticated>
    );
}
