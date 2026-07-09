<?php

namespace App\Providers;

use App\Channels\ExtendedDatabaseChannel;
use App\Channels\FcmChannel;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Implicitly grant "superadmin" role all permissions
        Gate::before(function ($user, $ability) {
            return $user->hasRole('superadmin') ? true : null;
        });

        ResetPassword::createUrlUsing(function ($user, string $token) {
            return url(route('customer.password.reset', [
                'token' => $token,
                'email' => $user->email,
            ], false));
        });

        // Register custom database channel
        Notification::resolved(function (ChannelManager $service) {
            $service->extend('database', function ($app) {
                return new ExtendedDatabaseChannel(
                    $app->make('db'),
                    $app->make('events')
                );
            });

            // Register custom FCM channel
            $service->extend('fcm', function ($app) {
                return new FcmChannel;
            });
        });
    }
}
