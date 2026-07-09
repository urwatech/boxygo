import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                // SuperAdmin assets
                'resources/js/superadmin.jsx',
                'resources/css/superadmin.css',
                // Customer assets
                'resources/js/customer.jsx',
                'resources/css/customer.css',
            ],
            refresh: true,
        }),
        tailwindcss(),
        react(),
    ],

    server: {
        host: 'localhost',
        port: 5173,
    },
});
