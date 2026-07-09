<?php

use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Laravel\Sanctum\Http\Middleware\ValidateCsrfToken;

return [
    'stateful' => explode(',', (string) env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:5173,localhost:8000,localhost:3000,127.0.0.1,127.0.0.1:5173,127.0.0.1:8000,127.0.0.1:3000,::1',
        env('APP_URL') ? ','.parse_url(env('APP_URL'), PHP_URL_HOST) : ''
    ))),

    'guard' => ['web'],

    'expiration' => env('SANCTUM_EXPIRATION'),

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'ensure_frontend_requests_are_stateful' => EnsureFrontendRequestsAreStateful::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],
];
