<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\Shelf;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\Zone;
use App\Support\SortHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class WarehouseController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');

        $warehousesQuery = Warehouse::with(['zone', 'shelves', 'user'])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($searchQuery) use ($search) {
                    $like = "%{$search}%";

                    $searchQuery
                        ->where('id', 'like', $like)
                        ->orWhere('code', 'like', $like)
                        ->orWhere('name', 'like', $like)
                        ->orWhere('location', 'like', $like)
                        ->orWhere('city', 'like', $like)
                        ->orWhere('status', 'like', $like)
                        ->orWhereHas('zone', function ($zoneQuery) use ($like) {
                            $zoneQuery->where('name', 'like', $like)
                                ->orWhere('code', 'like', $like)
                                ->orWhere('city', 'like', $like)
                                ->orWhere('status', 'like', $like);
                        })
                        ->orWhereHas('user', function ($keeperQuery) use ($like) {
                            $keeperQuery->where('name', 'like', $like)
                                ->orWhere('phone_number', 'like', $like)
                                ->orWhere('status', 'like', $like);
                        })
                        ->orWhereHas('shelves', function ($shelfQuery) use ($like) {
                            $shelfQuery->where('code', 'like', $like);
                        });
                });
            })
            ->when($status !== '' && strtolower($status) !== 'all', function ($query) use ($status) {
                $query->whereRaw('LOWER(TRIM(status)) = ?', [strtolower($status)]);
            });

        $this->applyWarehouseSorting($warehousesQuery, $sortBy, $sortDir);

        $warehouses = $warehousesQuery
            ->get()
            ->map(function ($warehouse) {
                return [
                    'id' => $warehouse->id,
                    'warehouseId' => $warehouse->code,
                    'name' => $warehouse->name,
                    'location' => $warehouse->location,
                    'city' => $warehouse->city,
                    'latitude' => $warehouse->latitude,
                    'longitude' => $warehouse->longitude,
                    'assignedZone' => $warehouse->zone?->name ?? 'N/A',
                    'zone_id' => $warehouse->zone_id,
                    'keeper_id' => $warehouse->keeper_id,
                    'drawn_paths' => $warehouse->drawn_paths ?? [],
                    'shelves' => $warehouse->shelves->pluck('code')->toArray(),
                    'zone' => $warehouse->zone_id ? [
                        'zone_id' => $warehouse->zone_id,
                        'code' => $warehouse?->zone?->code,
                        'name' => $warehouse?->zone?->name,
                        'city' => $warehouse?->zone?->city,
                        'drawn_paths' => $warehouse?->zone?->drawn_paths ?? [],
                        'status' => $warehouse?->zone?->status,
                    ] : null,
                    'keeper_details' => $warehouse->user ? [
                        'id' => $warehouse->user->id,
                        'name' => $warehouse->user->name,
                        'phone_number' => $warehouse->user->phone_number,
                        'status' => $warehouse->user->status,
                    ] : null,
                    'createdOn' => $warehouse->created_at->format('M d, Y'),
                    'lastUpdate' => $warehouse->updated_at->format('M d, Y'),
                    'statusLabel' => ucfirst($warehouse->status),
                    'statusState' => $warehouse->status,
                ];
            });

        $zones = Zone::query()
            ->notDeleted()
            ->orderBy('name')
            ->get()
            ->map(function ($zone) {
                return [
                    'id' => $zone->id,
                    'code' => $zone->code,
                    'name' => $zone->name,
                    'city' => $zone->city,
                    'status' => $zone->status,
                    'drawn_paths' => $zone->drawn_paths ?? [],
                ];
            });

        $statistics = [
            'total' => Warehouse::count(),
            'assigned' => Warehouse::whereNotNull('zone_id')->count(),
            'inactive' => Warehouse::where('status', Warehouse::STATUS_INACTIVE)->count(),
            'unassigned' => Warehouse::whereNull('zone_id')->count(),
        ];

        $cities = City::query()
            ->orderBy('name')
            ->get(['id', 'name', 'latitude', 'longitude'])
            ->map(function ($city) {
                return [
                    'id' => $city->id,
                    'name' => $city->name,
                    'value' => $city->name,
                    'label' => $city->name,
                    'latitude' => $city->latitude,
                    'longitude' => $city->longitude,
                ];
            });

        $warehouseUsers = User::whereHas('roles', fn ($query) => $query->where('name', Role::WAREHOUSE_KEEPER->value))->whereNull('warehouse_id')->select(['id', 'name', 'phone_number', 'status'])->orderBy('name')->get();

        return Inertia::render('SuperAdmin/Warehouse/Index', [
            'warehouses' => $warehouses,
            'zones' => $zones,
            'statistics' => $statistics,
            'cities' => $cities,
            'warehouseUsers' => $warehouseUsers,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    private function applyWarehouseSorting($query, string $sortBy, string $sortDir): void
    {
        $sortKey = SortHelper::key($sortBy);

        if (in_array($sortKey, ['zone', 'assigned_zone'], true)) {
            $query->orderByRaw("COALESCE((SELECT name FROM zones WHERE zones.id = warehouses.zone_id LIMIT 1), '') {$sortDir}");
        } elseif (in_array($sortKey, ['keeper', 'keeper_name'], true)) {
            $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = warehouses.keeper_id LIMIT 1), '') {$sortDir}");
        } else {
            $query->orderBy(SortHelper::column($sortBy, [
                'id' => 'warehouses.id',
                'code' => 'warehouses.code',
                'warehouse_id' => 'warehouses.code',
                'name' => 'warehouses.name',
                'location' => 'warehouses.location',
                'city' => 'warehouses.city',
                'status' => 'warehouses.status',
                'created_at' => 'warehouses.created_at',
                'created_on' => 'warehouses.created_at',
                'updated_at' => 'warehouses.updated_at',
                'last_update' => 'warehouses.updated_at',
            ], 'warehouses.created_at'), $sortDir);
        }

        $query->orderByDesc('warehouses.id');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'zone_id' => 'nullable|exists:zones,id,is_deleted,0',
            'status' => 'sometimes|in:active,inactive',
            'shelves' => 'nullable|array',
            'shelves.*' => 'string|max:50',
            'keeper_id' => 'nullable|exists:users,id',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $validated = $validator->validated();
        $shelfCodes = $validated['shelves'] ?? [];
        unset($validated['shelves']);

        // Geocode the location if latitude/longitude are missing
        if (empty($validated['latitude']) || empty($validated['longitude'])) {
            $coords = $this->geocodeAddress($validated['location'] ?? null, $validated['city'] ?? null);
            if ($coords) {
                $validated['latitude'] = $coords['lat'];
                $validated['longitude'] = $coords['lng'];
            }
        }

        DB::transaction(function () use ($validated, $shelfCodes) {
            $warehouse = Warehouse::create($validated);
            if ($validated['keeper_id']) {
                User::where('id', $validated['keeper_id'])
                    ->update([
                        'warehouse_id' => $warehouse->id,
                        'zone_id' => $warehouse->zone_id,
                    ]);
            }

            foreach ($shelfCodes as $code) {
                Shelf::create([
                    'code' => $code,
                    'warehouse_id' => $warehouse->id,
                    'is_active' => true,
                ]);
            }
        });

        return redirect()->route('admin.warehouses.index')->with('success', __('yourNewWarehouseIsReadyToUse'));
    }

    public function update(Request $request, Warehouse $warehouse)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'zone_id' => 'nullable|exists:zones,id,is_deleted,0',
            'status' => 'sometimes|in:active,inactive',
            'shelves' => 'nullable|array',
            'shelves.*' => 'string|max:50',
            'keeper_id' => 'nullable|exists:users,id',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $validated = $validator->validated();
        $shelfCodes = $validated['shelves'] ?? [];
        unset($validated['shelves']);

        // Geocode the location if latitude/longitude are missing
        if (empty($validated['latitude']) || empty($validated['longitude'])) {
            $coords = $this->geocodeAddress($validated['location'] ?? null, $validated['city'] ?? null);
            if ($coords) {
                $validated['latitude'] = $coords['lat'];
                $validated['longitude'] = $coords['lng'];
            }
        }

        DB::transaction(function () use ($warehouse, $validated, $shelfCodes) {
            $warehouse->update($validated);

            $existingCodes = $warehouse->shelves->pluck('code')->toArray();
            $newCodes = array_diff($shelfCodes, $existingCodes);
            $removedCodes = array_diff($existingCodes, $shelfCodes);

            // Remove shelves that are no longer in the list
            if (! empty($removedCodes)) {
                $warehouse->shelves()->whereIn('code', $removedCodes)->delete();
            }

            // Add new shelves
            foreach ($newCodes as $code) {
                Shelf::create([
                    'code' => $code,
                    'warehouse_id' => $warehouse->id,
                    'is_active' => true,
                ]);
            }

            User::where('warehouse_id', $warehouse->id)
                ->update(['warehouse_id' => null, 'zone_id' => null]);

            if ($validated['keeper_id']) {
                User::where('id', $validated['keeper_id'])
                    ->update(['warehouse_id' => $warehouse->id, 'zone_id' => $warehouse->zone_id]);
            }
        });

        return redirect()->route('admin.warehouses.index')->with('success', __('warehouseUpdatedSuccessfully'));
    }

    public function destroy(Warehouse $warehouse)
    {
        User::where('warehouse_id', $warehouse->id)->update(['warehouse_id' => null, 'zone_id' => null]);
        $warehouse->delete();

        return redirect()->route('admin.warehouses.index')->with('success', __('warehouseDeletedSuccessfully'));
    }

    /**
     * Geocode an address using the Google Maps Geocoding API.
     */
    private function geocodeAddress(?string $location, ?string $city): ?array
    {
        $apiKey = config('services.google.maps_api_key');
        if (! $apiKey) {
            return null;
        }

        $query = trim(implode(', ', array_filter([$location, $city, 'Syria'])));
        if (! $query || $query === 'Syria') {
            return null;
        }

        try {
            $response = Http::timeout(10)->get('https://maps.googleapis.com/maps/api/geocode/json', [
                'address' => $query,
                'key' => $apiKey,
            ]);

            $data = $response->json();

            if (($data['status'] ?? '') === 'OK' && ! empty($data['results'])) {
                $loc = $data['results'][0]['geometry']['location'];

                return [
                    'lat' => (float) $loc['lat'],
                    'lng' => (float) $loc['lng'],
                ];
            }
        } catch (\Exception $e) {
            report($e);
        }

        return null;
    }
}
