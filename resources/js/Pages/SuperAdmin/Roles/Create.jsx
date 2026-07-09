import React from 'react';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import { Head, Link, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import Form from './Partials/Form';

export default function Create({ permissions }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        platform: 'Admin Portal',
        country: 'Damascus',
        sub_area: 'Al-Mazzeh',
        permissions: [],
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('admin.roles.store'));
    };

    return (
        <SuperAdminAuthenticated
            headerContent={
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('superAdminRolesCreateTitle')}</h2>
                    <nav className="text-sm text-blue-500">
                        {t('commonHome')} <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <Link href={route('admin.roles.index')} className="font-medium text-blue-500">{t('commonUserRoles')}</Link>
                        <span className="mx-1 text-slate-500">&rsaquo;</span>
                        <span className="font-medium text-gray-500">{t('commonAddNewRole')}</span>
                    </nav>
                </div>
            }>
            <Head title={t('commonAddNewRole')} />

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <Form
                    data={data}
                    setData={setData}
                    processing={processing}
                    errors={errors}
                    permissions={permissions}
                    submitRoute={route('admin.roles.store')}
                    cancelRoute={route('admin.roles.index')}
                    isEdit={false}
                />
            </form>
        </SuperAdminAuthenticated>
    );
}
