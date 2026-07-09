import React from 'react';
import Guest from '../Layouts/Guest';
import { useForm } from '@inertiajs/react';

// Sanitize email to block emojis, icons, and non-ASCII characters
const sanitizeEmailInput = (value = '') => {
    const normalized = typeof value === 'string' ? value : String(value ?? '');
    return normalized.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
};

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <Guest>
            {/* Logo and Title */}
            <div className="flex flex-col items-center mb-6">
                <img src="./assets/images/Logo.svg" alt="Logo" className="mb-2" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-6">Admin Login</h2>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <div className="mb-4 text-left">
                    <label className="block text-sm text-blue-600 mb-1">Email Address</label>
                    <input
                        type="email"
                        placeholder="fatima@marsalpro.com"
                        value={data.email}
                        onChange={e => setData('email', sanitizeEmailInput(e.target.value))}
                        className="w-full border border-gray-200 rounded-full px-4 py-2 input-field focus:outline-none"
                    />
                    {errors.email && <div className="text-red-500 text-sm mt-1">{errors.email}</div>}
                </div>

                <div className="mb-4 text-left">
                    <label className="block text-sm text-blue-600 mb-1">Password</label>
                    <div className="relative">
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={data.password}
                            onChange={e => setData('password', e.target.value)}
                            className="w-full border border-gray-200 rounded-full px-4 py-2 input-field focus:outline-none"
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute right-3 top-2.5 w-5 h-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                        </svg>
                    </div>
                    {errors.password && <div className="text-red-500 text-sm mt-1">{errors.password}</div>}
                </div>

                <div className="flex items-center justify-between mb-6">
                    <label className="flex items-center text-sm">
                        <div className="relative mr-2">
                            <input
                                type="checkbox"
                                id="toggle"
                                className="sr-only peer"
                                checked={data.remember}
                                onChange={e => setData('remember', e.target.checked)}
                            />
                            <div className="w-10 h-5 bg-gray-300 peer-checked:bg-blue-500 rounded-full transition-colors duration-300"></div>
                            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-5"></div>
                        </div>
                        <span>Remember me</span>
                    </label>
                    <a href="#" className="text-blue-600 font-bold text-sm hover:underline">
                        Forgot password?
                    </a>
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-full py-3 transition-all disabled:opacity-50"
                >
                    Sign In
                </button>
            </form>
        </Guest>
    );
}
