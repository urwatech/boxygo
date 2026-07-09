<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title inertia>{{ config('app.name', 'Laravel') }}</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#4F46E5">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Boxygo">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="description" content="Boxygo Customer Portal - Manage your shipments and bookings">

    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.json?v=1.0">

    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="196x196" href="/pwa-icons/favicon-196.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/pwa-icons/manifest-icon-192.maskable.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/pwa-icons/manifest-icon-512.maskable.png">

    <!-- Apple Touch Icon -->
    <link rel="apple-touch-icon" href="/pwa-icons/apple-icon-180.png">

    <!-- Microsoft Tiles -->
    <meta name="msapplication-TileImage" content="/pwa-icons/manifest-icon-192.maskable.png">
    <meta name="msapplication-TileColor" content="#4F46E5">

    @routes
    @viteReactRefresh
    @vite(['resources/js/customer.jsx', 'resources/css/customer.css'])
    @inertiaHead
</head>
<body class="antialiased">
@inertia
</body>
</html>
