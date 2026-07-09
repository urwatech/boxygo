<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Contracts\ZoneServiceInterface;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Address;
use App\Models\City;
use App\Models\CityShipmentPrice;
use App\Models\DropPoint;
use App\Models\Zone;
use App\Enums\Role as RoleEnum;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Jobs\SyncExternalZonesJob;
use App\Models\Warehouse;
use App\Services\AssatexApiService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Controller responsible for zone management in the Super Admin panel.
 */
class ZoneController extends Controller
{
    public function __construct(
        private readonly ZoneServiceInterface $zoneService
    ) {}

    /**
     * Display a listing of zones with search and filters.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        if (!$user || (!$user->can('zones.view'))) {
            abort(401);
        }

        $search = $request->string('search')->toString();
        $perPage = $request->integer('per_page', 10);
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));
        if (in_array(strtolower($sortBy), ['asc', 'desc'], true) && !$request->has('sort_dir')) {
            $sortDir = $sortBy;
            $sortBy = 'city';
        }
        $status = $request->string('status')->toString() ?: null;
        $city = $request->string('city')->toString() ?: null;
        $isAssigned = $request->has('is_assigned_to_hub')
            ? $request->boolean('is_assigned_to_hub')
            : null;

        $defaultHubs = ['North Hub', 'Central Hub', 'South Hub'];

        // Get cities from database
        $cityOptions = City::query()
            ->orderBy('name')
            ->pluck('name')
            ->map(fn($value) => (string) $value)
            ->unique()
            ->values()
            ->all();

        $hubOptions = collect($defaultHubs)
            ->merge(
                Zone::query()
                    ->notDeleted()
                    ->select(['assigned_hub_name'])
                    ->get()
                    ->flatMap(fn(Zone $zone) => $this->decodeAssignedHubNames($zone->assigned_hub_name))
                    ->filter()
            )
            ->map(fn($value) => (string) $value)
            ->unique()
            ->values()
            ->all();

        $ridersByZone = $this->mapUsersToZones(
            User::query()
                ->select(['id', 'name', 'zone_id', 'zone_ids'])
                ->role(RoleEnum::RIDER->value)
                ->get(),
        );

        $driversByZone = $this->mapUsersToZones(
            User::query()
                ->select(['id', 'name', 'zone_id', 'zone_ids'])
                ->role(RoleEnum::CAR_DRIVER->value)
                ->get(),
        );

        $dropPointsByCity = DropPoint::query()
            ->select(['id', 'name', 'city'])
            ->get()
            ->groupBy(function (DropPoint $dropPoint) {
                return strtolower(trim((string) ($dropPoint->city ?? '')));
            });

        $zones = $this->zoneService->getWithFilters($search, [
            'status' => $status,
            'city' => $city,
            'sort_by' => $sortBy,
            'sort_dir' => $sortDir,
            'is_assigned_to_hub' => $isAssigned,
        ])->map(function (Zone $zone) use ($ridersByZone, $driversByZone, $dropPointsByCity) {
            $assignedHubNames = $this->decodeAssignedHubNames($zone->assigned_hub_name);
            $cityKey = strtolower(trim((string) ($zone->city ?? '')));
            $cityDropPoints = $dropPointsByCity->get($cityKey, collect())->filter(function (DropPoint $dropPoint) {
                return filled($dropPoint->name);
            });
            $hasDirectAvailability = !empty($ridersByZone[$zone->id] ?? []);
            $hasDoorDelivery = !empty($driversByZone[$zone->id] ?? []);
            $hasDropPoint = $cityDropPoints->isNotEmpty();

            return [
                'id' => $zone->id,
                'code' => $zone->code,
                'name' => $zone->name,
                'city' => $zone->city,
                'sub_district_name' => $zone->sub_district_name,
                'drawn_paths' => $zone->drawn_paths ?? [],
                'status' => $zone->status,
                'is_assigned_to_hub' => $zone->is_assigned_to_hub,
                'assigned_hub_name' => $assignedHubNames[0] ?? null,
                'assigned_hub_names' => $assignedHubNames,
                'direct_delivery' => $zone->direct_delivery,
                'door_delivery' => $zone->door_delivery,
                'created_at' => $zone->created_at?->format('M d, Y'),
                'updated_at' => $zone->updated_at?->format('M d, Y'),
            ];
        });

        // Get all zones for map display (not paginated)
        $allZones = Zone::query()
            ->notDeleted()
            ->select(['id', 'code', 'name', 'city', 'drawn_paths', 'status'])
            ->get()
            ->map(function (Zone $zone) {
                return [
                    'id' => $zone->id,
                    'code' => $zone->code,
                    'name' => $zone->name,
                    'city' => $zone->city,
                    'drawn_paths' => $zone->drawn_paths ?? [],
                    'status' => $zone->status,
                ];
            });

        return Inertia::render('SuperAdmin/Zones/Index', [
            'zones' => $zones,
            'allZones' => $allZones,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'city' => $city,
                'is_assigned_to_hub' => $request->has('is_assigned_to_hub')
                    ? (bool) $request->query('is_assigned_to_hub')
                    : null,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
            'statistics' => $this->zoneService->getStatistics(),
            'dropdowns' => [
                'cities' => $cityOptions,
                'hubs' => $hubOptions,
            ],
        ]);
    }

    /**
     * Provide aggregated zone allocations for exports.
     */
    public function details(Request $request)
    {
        $user = $request->user();

        if (!$user || (!$user->can('zones.view'))) {
            abort(401);
        }

        $zones = Zone::query()
            ->notDeleted()
            ->select([
                'id',
                'code',
                'name',
                'city',
                'status',
                'direct_delivery',
                'door_delivery',
                'sub_district_name',
                'assigned_hub_name',
            ])
            ->orderBy('name')
            ->get();

        $ridersByZone = $this->mapUsersToZones(
            User::query()
                ->select(['id', 'name', 'phone_number', 'zone_id', 'zone_ids', 'status'])
                ->role(RoleEnum::RIDER->value)
                ->where('platform', 'Mobile App')
                ->get(),
        );

        $driversByZone = $this->mapUsersToZones(
            User::query()
                ->select(['id', 'name', 'phone_number', 'zone_id', 'zone_ids', 'status'])
                ->role(RoleEnum::CAR_DRIVER->value)
                ->where('platform', 'Mobile App')
                ->get(),
        );

        $dropPointsByZone = DropPoint::query()
            ->select(['id', 'name', 'city', 'address', 'zone_id'])
            ->whereNotNull('zone_id')
            ->orderBy('name')
            ->get()
            ->groupBy('zone_id')
            ->map(function ($group) {
                return $group->map(function (DropPoint $dropPoint) {
                    return [
                        'id' => $dropPoint->id,
                        'name' => $dropPoint->name,
                        'city' => $dropPoint->city,
                        'address' => $dropPoint->address,
                        'zone_id' => $dropPoint->zone_id,
                    ];
                })->values()->all();
            })
            ->all();

        $warehousesByZone = Warehouse::query()
            ->select(['id', 'code', 'name', 'city', 'status', 'zone_id'])
            ->whereNotNull('zone_id')
            ->orderBy('name')
            ->get()
            ->groupBy('zone_id')
            ->map(function ($group) {
                return $group->map(function (Warehouse $warehouse) {
                    return [
                        'id' => $warehouse->id,
                        'code' => $warehouse->code,
                        'name' => $warehouse->name,
                        'city' => $warehouse->city,
                        'status' => $warehouse->status,
                        'zone_id' => $warehouse->zone_id,
                    ];
                })->values()->all();
            })
            ->all();

        $details = $zones->map(function (Zone $zone) use ($ridersByZone, $driversByZone, $dropPointsByZone, $warehousesByZone) {
            return [
                'zone_id' => $zone->id,
                'code' => $zone->code,
                'name' => $zone->name,
                'city' => $zone->city,
                'status' => $zone->status,
                'direct_delivery' => (bool) $zone->direct_delivery,
                'door_delivery' => (bool) $zone->door_delivery,
                'sub_district_name' => $zone->sub_district_name,
                'assigned_hub_name' => $zone->assigned_hub_name,
                'riders' => $ridersByZone[$zone->id] ?? [],
                'drivers' => $driversByZone[$zone->id] ?? [],
                'drop_points' => $dropPointsByZone[$zone->id] ?? [],
                'warehouses' => $warehousesByZone[$zone->id] ?? [],
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $details,
        ]);
    }

    /**
     * Display full-screen map view of all zones.
     */
    public function mapFullView(): Response
    {
        $user = auth()->user();

        if (!$user || (!$user->can('zones.view'))) {
            abort(401);
        }

        // Get all zones for map display
        $allZones = Zone::query()
            ->notDeleted()
            ->select(['id', 'code', 'name', 'city', 'drawn_paths', 'status'])
            ->get()
            ->map(function (Zone $zone) {
                return [
                    'id' => $zone->id,
                    'code' => $zone->code,
                    'name' => $zone->name,
                    'city' => $zone->city,
                    'drawn_paths' => $zone->drawn_paths ?? [],
                    'status' => $zone->status,
                ];
            });

        return Inertia::render('SuperAdmin/Zones/MapFullView', [
            'allZones' => $allZones,
        ]);
    }

    /**
     * Store a newly created zone.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('zones.create'))) {
            abort(401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'assigned_hub_name' => ['nullable', 'string'],
            'assigned_hub_names' => ['nullable', 'array'],
            'assigned_hub_names.*' => ['nullable', 'string', 'max:255'],
            'drawn_paths' => ['nullable', 'array'],
            'drawn_paths.*' => ['array', 'min:3'],
            'drawn_paths.*.*.lat' => ['required', 'numeric'],
            'drawn_paths.*.*.lng' => ['required', 'numeric'],
        ]);

        $assignedHubNamesInput = $request->input('assigned_hub_names', []);
        $assignedNames = collect(is_array($assignedHubNamesInput) ? $assignedHubNamesInput : [])
            ->filter(fn($value) => filled($value))
            ->map(fn($value) => (string) $value)
            ->unique()
            ->values();

        if ($assignedNames->isEmpty() && filled($validated['assigned_hub_name'] ?? null)) {
            $assignedNames = collect([(string) $validated['assigned_hub_name']]);
        }

        $drawnPaths = $validated['drawn_paths'] ?? null;
        if (empty($drawnPaths)) {
            $drawnPaths = null;
        }

        $payload = [
            'name' => $validated['name'],
            'city' => $validated['city'],
            'assigned_hub_name' => $this->encodeAssignedHubNames($assignedNames->all()),
            'is_assigned_to_hub' => $assignedNames->isNotEmpty(),
            'status' => Zone::STATUS_ACTIVE,
            'drawn_paths' => $drawnPaths,
        ];

        $this->zoneService->create($payload);

        return redirect()->route('admin.zones.index')
            ->with('success', __('zoneCreatedSuccessfully'));
    }

    /**
     * Preview external zones directly from Assatex API.
     */
    public function previewExtZones(AssatexApiService $apiService)
    {
        $user = auth()->user();

        if (!$user || (!$user->can('zones.create') && !$user->can('zones.edit'))) {
            abort(401);
        }

        try {
            $zones = $apiService->getZones();
            return response()->json(['zones' => $zones]);
        } catch (\Exception $e) {
            Log::error('Failed to preview zones: ' . $e->getMessage());
            return response()->json(['error' => __('failedToFetchZonesFromApi')], 500);
        }
    }

    /**
     * Preview single zone directly from Assatex API.
     */
    public function apiPreviewSingle(Zone $zone, AssatexApiService $apiService)
    {
        $user = auth()->user();

        if (!$user || (!$user->can('zones.view') && !$user->can('zones.edit'))) {
            abort(401);
        }

        if (!$zone->ext_id) {
            return response()->json(['error' => __('thisZoneIsNotLinkedToAnExternalApiSystem')], 404);
        }

        try {
            $allZones = $apiService->getZones();
            $matchedZone = collect($allZones)->firstWhere('id', $zone->ext_id);

            if (!$matchedZone) {
                return response()->json(['error' => __('zoneDataCouldNotBeFoundOnTheExternalApi')], 404);
            }

            return response()->json(['zone' => $matchedZone]);
        } catch (\Exception $e) {
            Log::error('Failed to preview single zone: ' . $e->getMessage());
            return response()->json(['error' => __('failedToFetchZoneFromApi')], 500);
        }
    }

    /**
     * Trigger synchronization of external zones from Assatex API.
     */
    public function sync(): RedirectResponse
    {
        try {
            Cache::put('sync_external_zones_progress', [
                'status' => 'starting',
                'current' => 0,
                'total' => 0,
                'percentage' => 0,
                'message' => __('initializingSync'),
                'updated_at' => now()->toDateTimeString(),
            ], 3600);

            SyncExternalZonesJob::dispatch();
            return redirect()->back()->with('success', __('zoneSynchronizationHasStartedInTheBackground'));
        } catch (\Exception $e) {
            Log::error('Failed to trigger zone synchronization: ' . $e->getMessage());
            return redirect()->back()->with('error', __('failedToStartZoneSynchronization'));
        }
    }

    /**
     * Trigger synchronization of city shipment prices from Assatex API.
     */
    public function syncPrices(Request $request, AssatexApiService $apiService): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('zones.create') && !$user->can('zones.edit'))) {
            abort(401);
        }

        try {
            $offset = 0;
            $maxSize = 200;
            $synced = 0;
            $total = 0;

            do {
                $response = $apiService->getCityShipmentPrices($offset, $maxSize);
                $batch = $response['list'] ?? [];
                $total = (int) ($response['total'] ?? $total);

                if (empty($batch)) {
                    break;
                }

                $upsertData = [];
                foreach ($batch as $priceData) {
                    $upsertData[] = [
                        'ext_id' => (string) ($priceData['id'] ?? ''),
                        'name' => $priceData['name'] ?? null,
                        'sender_sub_district_id' => $priceData['subDNoForm'] ?? $priceData['senderSubDistrictId'] ?? null,
                        'sender_sub_district_name' => $priceData['senderSubDistrictName'] ?? null,
                        'receiver_sub_district_id' => $priceData['subDNoTo'] ?? $priceData['receiverSubDistrictId'] ?? null,
                        'receiver_sub_district_name' => $priceData['receiverSubDistrictName'] ?? null,
                        'price' => $priceData['price'] ?? $priceData['price1'] ?? 0,
                        'direct_price' => $priceData['directPrice'] ?? null,
                        'price1' => $priceData['price1'] ?? null,
                        'price2' => $priceData['price2'] ?? null,
                        'price3' => $priceData['price3'] ?? null,
                        'price4' => $priceData['price4'] ?? null,
                        'price5' => $priceData['price5'] ?? null,
                        'price6' => $priceData['price6'] ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }

                $upsertData = array_values(array_filter($upsertData, fn($row) => !empty($row['ext_id'])));

                if (!empty($upsertData)) {
                    CityShipmentPrice::upsert(
                        $upsertData,
                        ['ext_id'],
                        [
                            'name',
                            'sender_sub_district_id',
                            'sender_sub_district_name',
                            'receiver_sub_district_id',
                            'receiver_sub_district_name',
                            'price',
                            'direct_price',
                            'price1',
                            'price2',
                            'price3',
                            'price4',
                            'price5',
                            'price6',
                            'updated_at',
                        ]
                    );
                }

                $batchCount = count($batch);
                $synced += $batchCount;
                $offset += $batchCount;
            } while ($offset < $total);

            return redirect()->back()->with('success', __('zonePricesSynchronizedSuccessfullyRecordsCount', ['count' => $synced]));
        } catch (\Exception $e) {
            Log::error('Failed to sync zone prices: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return redirect()->back()->with('error', __('failedToSyncZonePrices'));
        }
    }

    /**
     * Get the current progress of the zone synchronization.
     */
    public function getSyncProgress()
    {
        $progress = Cache::get('sync_external_zones_progress', [
            'status' => 'idle',
            'current' => 0,
            'total' => 0,
            'percentage' => 0,
            'message' => __('noSyncInProgress'),
            'updated_at' => null,
        ]);

        return response()->json($progress);
    }

    /**
     * Update the specified zone.
     */
    public function update(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('zones.edit'))) {
            abort(401);
        }

        $zone = $this->zoneService->find($id);

        if (!$zone) {
            abort(404, __('zoneNotFound'));
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'assigned_hub_name' => ['nullable', 'string'],
            'assigned_hub_names' => ['nullable', 'array'],
            'assigned_hub_names.*' => ['nullable', 'string', 'max:255'],
            'drawn_paths' => ['nullable', 'array'],
            'drawn_paths.*' => ['array', 'min:3'],
            'drawn_paths.*.*.lat' => ['required', 'numeric'],
            'drawn_paths.*.*.lng' => ['required', 'numeric'],
        ]);

        $assignedHubNamesInput = $request->input('assigned_hub_names', []);
        $assignedNames = collect(is_array($assignedHubNamesInput) ? $assignedHubNamesInput : [])
            ->filter(fn($value) => filled($value))
            ->map(fn($value) => (string) $value)
            ->unique()
            ->values();

        if ($assignedNames->isEmpty() && filled($validated['assigned_hub_name'] ?? null)) {
            $assignedNames = collect([(string) $validated['assigned_hub_name']]);
        }

        $drawnPaths = $validated['drawn_paths'] ?? null;
        if (empty($drawnPaths)) {
            $drawnPaths = null;
        }

        $payload = [
            'name' => $validated['name'],
            'city' => $validated['city'],
            'assigned_hub_name' => $this->encodeAssignedHubNames($assignedNames->all()),
            'is_assigned_to_hub' => $assignedNames->isNotEmpty(),
            'drawn_paths' => $drawnPaths,
        ];

        $this->zoneService->update($id, $payload);

        return redirect()->route('admin.zones.index')
            ->with('success', __('zoneUpdatedSuccessfully'));
    }

    /**
     * Update the zone status via toggle endpoint.
     */
    public function toggleStatus(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('zones.status'))) {
            abort(401);
        }

        $zone = $this->zoneService->find($id);

        if (!$zone) {
            abort(404, __('zoneNotFound'));
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in([Zone::STATUS_ACTIVE, Zone::STATUS_INACTIVE])],
        ]);

        $this->zoneService->update($id, [
            'status' => $validated['status'],
        ]);

        return redirect()->route('admin.zones.index')
            ->with('success', __('zoneStatusUpdatedSuccessfully'));
    }

    /**
     * Fetch riders, warehouses, and drop points for a specific zone.
     */
    public function getZoneResources()
    {
        $zones = Zone::query()
            ->notDeleted()
            ->get()
            ->map(function (Zone $zone) {
                return [
                    'id' => $zone->id,
                    'code' => $zone->code,
                    'name' => $zone->name,
                    'city' => $zone->city,
                    'drawn_paths' => $zone->drawn_paths ?? [],
                    'status' => $zone->status,
                    'direct_delivery' => $zone->direct_delivery,
                    'door_delivery' => $zone->door_delivery,
                ];
            });

        $data = [];
        foreach ($zones as $zone) {
            $zoneData = [];
            $zoneData['zone'] = $zone;

            $riderModel = User::class;

            $ridersQuery = $riderModel::query()
                ->where('zone_id', $zone['id']);

            if ($riderModel === User::class) {
                $ridersQuery
                    ->whereHas('roles', fn($query) => $query->where('name', RoleEnum::RIDER->value))
                    ->select(['id', 'name', 'phone_number', 'zone_id', 'status']);
            }

            $zoneData['riders'] = $ridersQuery
                ->orderBy('name')
                ->get();

            $driversQuery = $riderModel::query()
                ->where('zone_id', $zone['id']);

            if ($riderModel === User::class) {
                $driversQuery
                    ->whereHas('roles', fn($query) => $query->where('name', RoleEnum::CAR_DRIVER->value))
                    ->select(['id', 'name', 'phone_number', 'zone_id', 'status']);
            }

            $zoneData['car_drivers'] = $driversQuery
                ->orderBy('name')
                ->get();

            $zoneData['warehouses'] = Warehouse::query()
                ->where('zone_id', $zone['id'])
                ->select(['id', 'code', 'name', 'location', 'city', 'latitude', 'longitude', 'zone_id', 'status'])
                ->orderBy('name')
                ->get();

            $zoneData['droppoints'] = DropPoint::query()
                ->where('zone_id', $zone['id'])
                ->select(['id', 'name', 'address', 'city', 'latitude', 'longitude', 'zone_id'])
                ->orderBy('name')
                ->get();

            $data[] = $zoneData;
        }

        return response()->json([
            'success' => true,
            'message' => __('zonesFetchSuccessfully'),
            'data' => $data
        ]);
    }

    /**
     * Remove the specified zone.
     */
    public function destroy(string $id): RedirectResponse
    {
        $user = auth()->user();

        if (!$user || (!$user->can('zones.delete'))) {
            abort(401);
        }

        $zone = $this->zoneService->find($id);

        if (!$zone) {
            abort(404, __('zoneNotFound'));
        }

        $this->zoneService->delete($id);

        return redirect()->route('admin.zones.index')
            ->with('success', __('zoneDeletedSuccessfully'));
    }

    /**
     * Get all cities from database (API endpoint)
     */
    public function getCities(Request $request)
    {
        $cities = City::query()
            ->orderBy('name')
            ->get(['id', 'name', 'governate_id', 'latitude', 'longitude'])
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

        return response()->json($cities);
    }

    /**
     * Get locations for a specific city (API endpoint)
     */
    public function getLocationsByCity(Request $request, string $city)
    {
        $locations = Address::query()
            ->where('city', $city)
            ->whereNotNull('location_name')
            ->distinct()
            ->pluck('location_name')
            ->map(function ($location) {
                return [
                    'value' => $location,
                    'label' => $location,
                ];
            })
            ->values();

        return response()->json($locations);
    }

    /**
     * Decode assigned hub names stored in the assigned_hub_name column.
     */
    private function decodeAssignedHubNames(?string $storedValue): array
    {
        if (blank($storedValue)) {
            return [];
        }

        $decoded = json_decode($storedValue, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return array_values(
                array_filter(
                    array_map(static fn($value) => trim((string) $value), $decoded),
                ),
            );
        }

        $parts = preg_split('/\s*,\s*/', $storedValue) ?: [];

        return array_values(
            array_filter(
                array_map(static fn($value) => trim((string) $value), $parts),
            ),
        );
    }

    /**
     * Encode hub names for storage in the assigned_hub_name column.
     */
    private function encodeAssignedHubNames(array $hubNames): ?string
    {
        if (empty($hubNames)) {
            return null;
        }

        $values = array_values(
            array_filter(
                array_map(static fn($value) => (string) $value, $hubNames),
            ),
        );

        if (empty($values)) {
            return null;
        }

        $encoded = json_encode($values);

        return $encoded === false ? implode(',', $values) : $encoded;
    }

    /**
     * Map users to their assigned zones for quick lookup.
     *
     * @param \Illuminate\Support\Collection<int, User> $users
     * @return array<int, array<int, array{id:int,name:string,zone_id:int,phone_number:string|null,status:string|null}>>
     */
    private function mapUsersToZones($users): array
    {
        $byZone = [];

        foreach ($users as $user) {
            $zoneIds = $user->getAssignedZoneIds();

            if (empty($zoneIds)) {
                continue;
            }

            $payload = [
                'id' => $user->id,
                'name' => $user->name,
                'phone_number' => $user->phone_number,
                'status' => $user->status,
            ];

            foreach ($zoneIds as $zoneId) {
                $byZone[$zoneId][] = array_merge(['zone_id' => $zoneId], $payload);
            }
        }

        return $byZone;
    }
}
