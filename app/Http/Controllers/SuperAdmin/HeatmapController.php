<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use App\Models\DropPoint;
use App\Models\Warehouse;
use App\Models\City;
use Illuminate\Http\Request;
use Inertia\Inertia;

class HeatmapController extends Controller
{
    /**
     * Display the shipment heatmap page.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user || !$user->can('heatmap.view')) {
            abort(401);
        }

        $shipments = Shipment::query()
            ->select([
                'id',
                'status',
                'pickup_city',
                'delivery_city',
                'handover_latitude',
                'handover_longitude',
                'delivery_latitude',
                'delivery_longitude',
                'updated_at',
            ])
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhereRaw('LOWER(TRIM(status)) <> ?', ['delivered']);
            })
            ->where(function ($query) {
                $query->whereNotNull('handover_latitude')
                    ->whereNotNull('handover_longitude')
                    ->orWhere(function ($subQuery) {
                        $subQuery->whereNotNull('delivery_latitude')
                            ->whereNotNull('delivery_longitude');
                    });
            })
            ->latest('updated_at')
            ->get()
            ->map(fn ($shipment) => [
                'id' => $shipment->id,
                'status' => $shipment->status,
                'handover' => $shipment->handover_latitude !== null && $shipment->handover_longitude !== null
                    ? [
                        'lat' => (float) $shipment->handover_latitude,
                        'lng' => (float) $shipment->handover_longitude,
                        'city' => $shipment->pickup_city,
                    ]
                    : null,
                'delivery' => $shipment->delivery_latitude !== null && $shipment->delivery_longitude !== null
                    ? [
                        'lat' => (float) $shipment->delivery_latitude,
                        'lng' => (float) $shipment->delivery_longitude,
                        'city' => $shipment->delivery_city,
                    ]
                    : null,
            ])
            ->values();

        $activeShipmentStats = Shipment::query()
            ->selectRaw('rider_id, COUNT(*) as active_parcels, COALESCE(SUM(parcel_amount), 0) as active_value')
            ->whereNotNull('rider_id')
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhereRaw('LOWER(TRIM(status)) <> ?', ['delivered']);
            })
            ->groupBy('rider_id')
            ->get()
            ->keyBy('rider_id');

        // Fetch riders/drivers with active location
        $riders = \App\Models\User::query()
            ->whereHas('roles', function ($query) {
                $query->whereIn('name', ['rider', 'bike rider', 'car driver', 'driver', 'car-driver']);
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->select([
                'id',
                'name',
                'latitude',
                'longitude',
                'updated_at',
            ])
            ->with(['roles:id,name'])
            ->get()
            ->map(fn ($rider) => [
                'id' => $rider->id,
                'name' => $rider->name,
                'role' => $rider->roles->first()->name ?? 'Rider',
                'latitude' => (float) $rider->latitude,
                'longitude' => (float) $rider->longitude,
                'active_parcels' => (int) ($activeShipmentStats->get($rider->id)->active_parcels ?? 0),
                'active_value' => (float) ($activeShipmentStats->get($rider->id)->active_value ?? 0),
            ])
            ->values();

        $dropPoints = DropPoint::query()
            ->select(['id', 'name', 'city', 'latitude', 'longitude'])
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get()
            ->map(fn ($dropPoint) => [
                'id' => $dropPoint->id,
                'name' => $dropPoint->name,
                'city' => $dropPoint->city,
                'latitude' => (float) $dropPoint->latitude,
                'longitude' => (float) $dropPoint->longitude,
            ])
            ->values();

        $cityCoordinates = City::query()
            ->select(['name', 'latitude', 'longitude'])
            ->get()
            ->mapWithKeys(function (City $city) {
                $key = strtolower(trim((string) $city->name));
                return [$key => [
                    'latitude' => $city->latitude !== null ? (float) $city->latitude : null,
                    'longitude' => $city->longitude !== null ? (float) $city->longitude : null,
                ]];
            });
            
        $cities = City::select(['id', 'governate_id', 'type', 'short_code', 'name', 'latitude', 'longitude'])
            ->orderByDesc('name')
            ->get();
        
        $warehouses = Warehouse::query()
            ->select(['id', 'name', 'code', 'city', 'location', 'latitude', 'longitude'])
            ->get()
            ->map(function ($warehouse) use ($cityCoordinates) {
                $latitude = $warehouse->latitude !== null ? (float) $warehouse->latitude : null;
                $longitude = $warehouse->longitude !== null ? (float) $warehouse->longitude : null;

                // Fallback to city coordinates when warehouse has no lat/lng
                if ($latitude === null || $longitude === null) {
                    $cityKey = strtolower(trim((string) ($warehouse->city ?? '')));
                    $fallback = $cityCoordinates->get($cityKey, []);
                    $latitude = $fallback['latitude'] ?? null;
                    $longitude = $fallback['longitude'] ?? null;

                    // Persist the resolved coordinates so future loads are instant
                    if ($latitude !== null && $longitude !== null) {
                        $warehouse->updateQuietly([
                            'latitude' => $latitude,
                            'longitude' => $longitude,
                        ]);
                    }
                }

                if ($latitude === null || $longitude === null) {
                    return null;
                }

                return [
                    'id' => $warehouse->id,
                    'name' => $warehouse->name,
                    'code' => $warehouse->code,
                    'city' => $warehouse->city,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                ];
            })
            ->filter()
            ->values();

        return Inertia::render('SuperAdmin/Heatmap', [
            'shipments' => $shipments,
            'riders' => $riders,
            'dropPoints' => $dropPoints,
            'warehouses' => $warehouses,
            'cities' => $cities,
        ]);
    }

    public function live_tracking(Request $request)
    {
        $user = $request->user();

        if (!$user || !$user->can('heatmap.view')) {
            abort(401);
        }

        $activeShipmentStats = Shipment::query()
            ->selectRaw('rider_id, COUNT(*) as active_parcels, COALESCE(SUM(parcel_amount), 0) as active_value')
            ->whereNotNull('rider_id')
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhereRaw('LOWER(TRIM(status)) <> ?', ['delivered']);
            })
            ->groupBy('rider_id')
            ->get()
            ->keyBy('rider_id');

        // Fetch riders/drivers with active location
        $riders = \App\Models\User::query()
            ->whereHas('roles', function ($query) {
                $query->whereIn('name', ['rider', 'bike rider']);
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->select([
                'id',
                'name',
                'latitude',
                'longitude',
                'updated_at',
            ])
            ->with(['roles:id,name'])
            ->get()
            ->map(fn ($rider) => [
                'id' => $rider->id,
                'name' => $rider->name,
                'role' => $rider->roles->first()->name ?? 'Rider',
                'latitude' => (float) $rider->latitude,
                'longitude' => (float) $rider->longitude,
                'active_parcels' => (int) ($activeShipmentStats->get($rider->id)->active_parcels ?? 0),
                'active_value' => (float) ($activeShipmentStats->get($rider->id)->active_value ?? 0),
            ])
            ->values();

        // Fetch riders/drivers with active location
        $car_drivers = \App\Models\User::query()
            ->whereHas('roles', function ($query) {
                $query->whereIn('name', ['car driver', 'driver', 'car-driver']);
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->select([
                'id',
                'name',
                'latitude',
                'longitude',
                'updated_at',
            ])
            ->with(['roles:id,name'])
            ->get()
            ->map(fn ($driver) => [
                'id' => $driver->id,
                'name' => $driver->name,
                'role' => $driver->roles->first()->name ?? 'Car Driver',
                'latitude' => (float) $driver->latitude,
                'longitude' => (float) $driver->longitude,
                'active_parcels' => (int) ($activeShipmentStats->get($driver->id)->active_parcels ?? 0),
                'active_value' => (float) ($activeShipmentStats->get($driver->id)->active_value ?? 0),
            ])
            ->values();

        return Inertia::render('SuperAdmin/LiveTracking', [
            'riders' => $riders,
            'car_drivers' => $car_drivers,
        ]);
    }
}
