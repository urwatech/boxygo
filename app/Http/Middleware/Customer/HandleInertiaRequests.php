<?php

namespace App\Http\Middleware\Customer;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'customer';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'phone_number' => $request->user()->phone_number,
                    'address' => $request->user()->address,
                    'language' => $request->user()->language ?? 'en',
                    'avatar_url' => media_url($request->user()->avatar_path),
                    'governorate' => $request->user()->governorate,
                    'push_notifications' => (bool) $request->user()->push_notifications,
                    'roles' => $request->user()->getRoleNames(),
                ] : null,
            ],
            'config' => [
                'MAP_PROVIDER' => env('MAP_PROVIDER', 'google'),
                'LOCATION_AUTOCOMPLETE_PROVIDER' => env('LOCATION_AUTOCOMPLETE_PROVIDER', 'google'),
                'GOOGLE_MAPS_API_KEY' => env('GOOGLE_MAPS_API_KEY'),
                'GOOGLE_PLACES_API_KEY' => env('GOOGLE_PLACES_API_KEY'),
                'USE_DIRECT_GOOGLE_API' => env('USE_DIRECT_GOOGLE_API', true),
            ],
            'flash' => [
                'message' => fn () => $request->session()->get('message'),
                'error' => fn () => $request->session()->get('error'),
                'success' => fn () => $request->session()->get('success'),
            ],
        ];
    }
}
