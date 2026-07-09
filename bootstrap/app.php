<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('web')
                ->group(base_path('routes/admin.php'));
        },
    )
    ->withProviders([\App\Providers\RepositoryServiceProvider::class])
    ->withSchedule(function (\Illuminate\Console\Scheduling\Schedule $schedule) {
        $schedule->command('shipments:auto-cancel-unpaid')->hourly();
    })
    ->withMiddleware(function (Middleware $middleware): void {
        // Register all middleware aliases
        $middleware->alias([
            // Custom Authenticate middleware
            'auth' => \App\Http\Middleware\Authenticate::class,
            'active.user' => \App\Http\Middleware\EnsureUserIsActive::class,
            // Spatie Permission middleware
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            // Inertia middleware for SuperAdmin and Customer
            'inertia.superadmin' => \App\Http\Middleware\SuperAdmin\HandleInertiaRequests::class,
            'inertia.customer' => \App\Http\Middleware\Customer\HandleInertiaRequests::class,
            // Custom guest middleware for role-based redirects
            'guest' => \App\Http\Middleware\RedirectIfAuthenticated::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'customer/payments/paymera/callback',
        ]);

        $middleware->api(prepend: [
            \App\Http\Middleware\SetApiLocale::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Handle Spatie Permission UnauthorizedException (403 Forbidden)
        $exceptions->render(function (\Spatie\Permission\Exceptions\UnauthorizedException $e, \Illuminate\Http\Request $request) {
            // For API requests, return a clean 403 JSON response
            if ($request->is('api/*') || $request->expectsJson()) {
                return \App\Http\ApiResponse::forbidden(
                    'You do not have the required permissions to access this resource.'
                );
            }
        });

        /*$exceptions->respond(function (Response $response) {
            if ($response->getStatusCode() === 419) {
                return back()->with([
                    'message' => 'The page expired, please try again.',
                ]);
            }

            return $response;
        });*/
    })->create();
