import React from 'react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import { Head, Link, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import Form from './Partials/Form';

export default function Edit({ role, permissions }) {
    const { t } = useTranslation();
    const { data, setData, put, processing, errors } = useForm({
        name: role.name || '',
        description: role.description || '',
        platform: role.platform || 'Admin Portal',
        country: role.country || 'Damascus',
        sub_area: role.sub_area || 'Al-Mazzeh',
        permissions: role.permissions || [],
    });

    const isProtected = role.is_protected || false;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!isProtected) {
            put(route('admin.roles.update', role.id));
        }
    };

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('commonEditRole')}</h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <Link href={route('admin.roles.index')} className="font-medium text-blue-500">{t('commonUserRoles')}</Link>
                        <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <span className="font-medium text-gray-500">{t('commonEditRole')}</span>
                    </nav>
                </div>
            }>

            <Head title={t('commonEditRole')} />

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <Form
                    data={data}
                    setData={setData}
                    processing={processing}
                    errors={errors}
                    permissions={permissions}
                    submitRoute={route('admin.roles.update', role.id)}
                    cancelRoute={route('admin.roles.index')}
                    isEdit={true}
                    isProtected={isProtected}
                />
            </form>
        </SuperAdminAuthenticated>
    );
}
