@php($appName = config('app.name'))

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ __('Welcome to :app', ['app' => $appName]) }}</title>
</head>
<body>
    <h1>{{ __('Hi :name,', ['name' => $user->name]) }}</h1>
    <p>{{ __('Thank you for registering with :app.', ['app' => $appName]) }}</p>
    <p>{{ __('To start using your account, please verify the one-time password we sent to your phone number.') }}</p>
    <p>{{ __('If you did not initiate this registration, please contact our support team immediately.') }}</p>
    <p>{{ __('Regards,') }}<br>{{ $appName }}</p>
</body>
</html>
