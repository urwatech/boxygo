<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title inertia>{{ config('app.name', 'Laravel') }}</title>

    <!-- Archivo Font -->
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!-- PWA Icons -->
    <link rel="icon" type="image/png" sizes="196x196" href="/pwa-icons/favicon-196.png">
    <link rel="apple-touch-icon" href="/pwa-icons/apple-icon-180.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <link rel="manifest" href="/manifest.json">

    @routes
    @viteReactRefresh
    @vite(['resources/js/app.jsx', 'resources/css/app.css'])
    @inertiaHead
</head>
<body class="font-archivo bg-[#f8f9fb]">
@inertia
</body>
</html>
