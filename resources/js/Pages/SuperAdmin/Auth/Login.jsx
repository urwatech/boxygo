import React from 'react';
import Guest from '../../Layouts/Guest';
import { useForm } from '@inertiajs/react';
import Checkbox from '../../../Components/Common/Inputs/Checkbox';
import Input from '../../../Components/Common/Inputs/Input';
import Button from '../../../Components/Common/Inputs/Button';
import { Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

// Sanitize email to block emojis, icons, and non-ASCII characters
const sanitizeEmailInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
};

export default function Login() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post('/admin/login');
    };

    return (
        <Guest>
            {/* Logo and Title */}
            <div className="flex flex-col items-center mb-6">
                <img src="/assets/images/Logo.svg" alt={t('commonLogoAlt')} className="mb-2" />
            </div>

            <h2 className="text-2xl font-semibold text-[#0C0C0C] mb-6">{t('superAdminAuthLoginTitle')}</h2>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <Input
                    type="email"
                    label={t('commonEmailAddress')}
                    value={data.email}
                    onChange={e => setData('email', sanitizeEmailInput(e.target.value))}
                    error={errors.email}
                />

                <Input
                    type="password"
                    label={t('commonPassword')}
                    value={data.password}
                    onChange={e => setData('password', e.target.value)}
                    error={errors.password}
                    showPassword
                />

                <div className="flex flex-col sm:flex-row items-center justify-between my-6 gap-3">
                    <Checkbox
                        checked={data.remember}
                        onChange={e => setData('remember', e.target.checked)}
                        label={t('authRememberMe')}
                        id="remember-toggle"
                    />
                    <Link
                        href="/forgot-password"
                        className="text-blue-500 font-medium text-lg hover:underline"
                    >
                        {t('authForgotPassword')}
                    </Link>
                </div>

                <Button
                    type="submit"
                    fullWidth
                    className="mt-5"
                    disabled={processing}
                    loading={processing}
                >
                    {t('authSignIn')}
                </Button>
            </form>
        </Guest>
    );
}
