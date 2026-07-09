import React from 'react';
import Authenticated from './Layouts/Authenticated';
import { Head } from '@inertiajs/react';

export default function Dashboard({ auth }) {
    return (
        <Authenticated auth={auth}>
            <Head title="Dashboard" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">
                            <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
                            <p>Welcome to the admin dashboard!</p>
                        </div>
                    </div>
                </div>
            </div>
        </Authenticated>
    );
}
