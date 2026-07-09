<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\AddressServiceInterface;
use App\Models\User;
use App\Http\Controllers\Controller;
use App\Models\DropPoint;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        private readonly AddressServiceInterface $addressService
    ) {
    }

    /**
     * Display the customer dashboard.
     *
     * @return Response
     */
    public function index(): Response
    {
        $addresses = $this->addressService->getUserAddresses(auth()->id());

        // $dropPointKeepers = User::query()
        //     ->whereHas('roles', function ($query) {
        //         // Normalize role names like "drop point keeper", "drop-point keeper", etc.
        //         $query->whereRaw("LOWER(REPLACE(name, '-', ' ')) LIKE ?", ['%drop%point%keeper%']);
        //     })
        //     ->whereNotNull('latitude')
        //     ->whereNotNull('longitude')
        //     ->where('status', 'active')
        //     ->select([
        //         'id',
        //         'name',
        //         'latitude',
        //         'longitude',
        //         'address',
        //         'city',
        //         'governorate',
        //         'country',
        //         'phone_number',
        //         'avatar_path',
        //     ])
        //     ->get()
        //     ->map(function (User $keeper) {
        //         return [
        //             'id' => $keeper->id,
        //             'name' => $keeper->name,
        //             'latitude' => (float) $keeper->latitude,
        //             'longitude' => (float) $keeper->longitude,
        //             'address' => $keeper->address,
        //             'city' => $keeper->city,
        //             'state' => $keeper->governorate,
        //             'country' => $keeper->country,
        //             'phone_number' => $keeper->phone_number,
        //             'avatar_url' => $keeper->avatar_path ? media_url($keeper->avatar_path) : null,
        //         ];
        //     })
        //     ->values();
        $dropPointKeepers = DropPoint::get()->map(function($keeper) {
            return [
                    'id' => $keeper->id,
                    'name' => $keeper->name,
                    'dp_no' => $keeper->dp_no,
                    'latitude' => (float) $keeper->latitude,
                    'longitude' => (float) $keeper->longitude,
                    'address' => $keeper->address,
                    'icon' => $keeper->icon,
                    'city' => $keeper->city,
                    'state' => $keeper->governorate,
                    'country' => $keeper->country,
                    'phone_number' => $keeper->phone_number,
                    'keeper' => $keeper->user ? [
                        'id' => $keeper->user->id,
                        'name' => $keeper->user->name,
                        'phone_number' => $keeper->user->phone_number,
                        'status' => $keeper->user->status
                    ] : null,
                    'avatar_url' => $keeper->avatar_path ? media_url($keeper->avatar_path) : null,
            ];
        })->values();

        return Inertia::render('Customer/Dashboard', [
            'addresses' => $addresses,
            'dropPoints' => $dropPointKeepers,
        ]);
    }
}
