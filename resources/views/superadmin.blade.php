<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title inertia>{{ config('app.name', 'Laravel') }} - Admin Panel</title>

    <!-- Archivo Font -->
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap" rel="stylesheet">

    @routes
    @viteReactRefresh
    @vite(['resources/js/superadmin.jsx', 'resources/css/superadmin.css'])
    @inertiaHead
</head>
<body class="font-archivo bg-[#f8f9fb] antialiased">
@inertia
</body>
</html>
