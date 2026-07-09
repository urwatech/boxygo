<?php

namespace App\Http\Middleware\SuperAdmin;

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
    protected $rootView = 'superadmin';

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
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => media_url($user->avatar_path),
                    'governorate' => $user->governorate,
                    'language' => $user->language ?? 'en',
                ] : null,
                'roles' => $user ? $user->getRoleNames()->values()->all() : [],
                'permissions' => $user ? $user->getAllPermissions()->pluck('name')->values()->all() : [],
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
