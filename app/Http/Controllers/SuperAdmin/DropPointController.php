<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\Role as RoleEnum;
use App\Http\Controllers\Controller;
use App\Models\DropPoint;
use App\Models\Shelf;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\Zone;
use App\Services\AssatexApiService;
use App\Support\SortHelper;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class DropPointController extends Controller
{
    /**
     * Display a listing of drop points.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        if (! $user || (! $user->can('drop_points.view'))) {
            abort(401);
        }

        $search = $request->string('search')->toString();
        $status = $request->string('status')->toString();
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');
        $perPage = $request->integer('per_page', 10);

        $query = DropPoint::with('shelves', 'zone', 'user');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('dp_no', 'like', "%{$search}%")
                    ->orWhere('serial_no', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhereHas('zone', function ($zoneQuery) use ($search) {
                        $zoneQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%")
                            ->orWhere('city', 'like', "%{$search}%")
                            ->orWhere('status', 'like', "%{$search}%");
                    })
                    ->orWhereHas('user', function ($keeperQuery) use ($search) {
                        $keeperQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%")
                            ->orWhere('status', 'like', "%{$search}%");
                    });
            });
        }

        if ($status !== '' && strtolower($status) !== 'all') {
            $query->where(function ($builder) use ($status) {
                $builder
                    ->whereHas('zone', function ($zoneQuery) use ($status) {
                        $zoneQuery->whereRaw('LOWER(TRIM(status)) = ?', [strtolower($status)]);
                    })
                    ->orWhereHas('user', function ($keeperQuery) use ($status) {
                        $keeperQuery->whereRaw('LOWER(TRIM(status)) = ?', [strtolower($status)]);
                    });
            });
        }

        $this->applyDropPointSorting($query, $sortBy, $sortDir);

        $dropPoints = $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(function (DropPoint $dropPoint) {
                return [
                    'id' => $dropPoint->id,
                    'name' => $dropPoint->name,
                    'dp_no' => $dropPoint->dp_no,
                    'icon' => $dropPoint->icon,
                    'address' => $dropPoint->address,
                    'city' => $dropPoint->city,
                    'latitude' => $dropPoint->latitude,
                    'longitude' => $dropPoint->longitude,
                    'keeper_id' => $dropPoint->keeper_id,
                    'zone' => $dropPoint->zone_id ? [
                        'zone_id' => $dropPoint->zone_id,
                        'code' => $dropPoint?->zone?->code,
                        'name' => $dropPoint?->zone?->name,
                        'sub_district_name' => $dropPoint?->zone?->sub_district_name,
                        'city' => $dropPoint?->zone?->city,
                        'drawn_paths' => $dropPoint?->zone?->drawn_paths ?? [],
                        'status' => $dropPoint?->zone?->status,
                    ] : null,
                    'keeper' => $dropPoint->user ? [
                        'id' => $dropPoint->user->id,
                        'name' => $dropPoint->user->name,
                        'phone_number' => $dropPoint->user->phone_number,
                        'status' => $dropPoint->user->status,
                    ] : null,
                    'shelves' => $dropPoint->shelves->pluck('code')->toArray(),
                    'created_at' => $dropPoint->created_at?->format('M d, Y'),
                    'updated_at' => $dropPoint->updated_at?->format('M d, Y'),
                ];
            });

        $allDropPoints = DropPoint::query()
            ->select(['id', 'name', 'icon', 'address', 'city', 'latitude', 'longitude'])
            ->orderBy('name')
            ->get()
            ->map(fn (DropPoint $dropPoint) => [
                'id' => $dropPoint->id,
                'name' => $dropPoint->name,
                'icon' => $dropPoint->icon,
                'address' => $dropPoint->address,
                'city' => $dropPoint->city,
                'latitude' => $dropPoint->latitude,
                'longitude' => $dropPoint->longitude,
                'zone_id' => $dropPoint->zone_id,
            ]);

        // Get All zones
        $allZones = Zone::query()
            ->notDeleted()
            ->select(['id', 'code', 'name', 'city', 'drawn_paths', 'status', 'sub_district_name'])
            ->get()
            ->map(function (Zone $zone) {
                return [
                    'id' => $zone->id,
                    'code' => $zone->code,
                    'name' => $zone->name,
                    'sub_district_name' => $zone->sub_district_name,
                    'city' => $zone->city,
                    'drawn_paths' => $zone->drawn_paths ?? [],
                    'status' => $zone->status,
                ];
            });

        $droppointsUsers = User::whereHas('roles', fn ($query) => $query->where('name', RoleEnum::DROP_POINT_KEEPER->value))->whereNull('drop_point_id')->select(['id', 'name', 'phone_number', 'status', 'employment_type', 'address'])->orderBy('name')->get();

        return Inertia::render('SuperAdmin/DropPoints/Index', [
            'dropPoints' => $dropPoints,
            'allDropPoints' => $allDropPoints,
            'allZones' => $allZones,
            'droppointUsers' => $droppointsUsers,
            'cities' => \App\Models\City::select('id', 'name', 'latitude', 'longitude')->orderBy('name')->get(),
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    private function applyDropPointSorting($query, string $sortBy, string $sortDir): void
    {
        $sortKey = SortHelper::key($sortBy);

        if (in_array($sortKey, ['zone', 'zone_name'], true)) {
            $query->orderByRaw("COALESCE((SELECT name FROM zones WHERE zones.id = drop_points.zone_id LIMIT 1), '') {$sortDir}");
        } elseif (in_array($sortKey, ['keeper', 'keeper_name'], true)) {
            $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = drop_points.keeper_id LIMIT 1), '') {$sortDir}");
        } elseif ($sortKey === 'status') {
            $query->orderByRaw("COALESCE((SELECT status FROM zones WHERE zones.id = drop_points.zone_id LIMIT 1), (SELECT status FROM users WHERE users.id = drop_points.keeper_id LIMIT 1), '') {$sortDir}");
        } else {
            $query->orderBy(SortHelper::column($sortBy, [
                'id' => 'drop_points.id',
                'name' => 'drop_points.name',
                'dp_no' => 'drop_points.dp_no',
                'serial_no' => 'drop_points.serial_no',
                'address' => 'drop_points.address',
                'city' => 'drop_points.city',
                'created_at' => 'drop_points.created_at',
                'updated_at' => 'drop_points.updated_at',
            ], 'drop_points.created_at'), $sortDir);
        }

        $query->orderByDesc('drop_points.id');
    }

    /**
     * Preview external drop points directly from Assatex API.
     */
    public function previewExtDropPoints(AssatexApiService $apiService)
    {
        $user = auth()->user();

        if (! $user || (! $user->can('drop_points.view') && ! $user->can('drop_points.create') && ! $user->can('drop_points.edit'))) {
            abort(401);
        }

        try {
            $dropPoints = $apiService->getDropPoints();

            return response()->json(['dropPoints' => $dropPoints]);
        } catch (\Exception $e) {
            Log::error('Failed to preview drop points: '.$e->getMessage());

            return response()->json(['error' => __('failedToFetchDropPointsFromApi')], 500);
        }
    }

    /**
     * Sync drop points received from external API preview payload.
     */
    public function sync(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('drop_points.create') && ! $user->can('drop_points.edit'))) {
            abort(401);
        }

        $validated = $request->validate([
            'drop_points' => ['required', 'array', 'min:1'],
            'drop_points.*.ext_id' => ['required', 'string', 'max:255'],
            'drop_points.*.name' => ['required', 'string', 'max:255'],
            'drop_points.*.icon' => ['nullable', 'string', 'max:1000'],
            'drop_points.*.serial_no' => ['nullable', 'string', 'max:255'],
            'drop_points.*.dp_no' => ['nullable', 'string', 'max:255'],
            'drop_points.*.open_hours' => ['nullable', 'string', 'max:255'],
            'drop_points.*.zone_ext_id' => ['nullable', 'string', 'max:255'],
            'drop_points.*.address' => ['nullable', 'string', 'max:255'],
            'drop_points.*.city' => ['nullable', 'string', 'max:255'],
            'drop_points.*.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'drop_points.*.longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $zoneIdsByExternalId = Zone::query()
            ->notDeleted()
            ->whereNotNull('ext_id')
            ->pluck('id', 'ext_id')
            ->all();

        DB::transaction(function () use ($validated, $zoneIdsByExternalId) {
            foreach ($validated['drop_points'] as $dropPointData) {
                $zoneExternalId = filled($dropPointData['zone_ext_id'] ?? null)
                    ? (string) $dropPointData['zone_ext_id']
                    : null;
                $zoneId = $zoneExternalId ? ($zoneIdsByExternalId[$zoneExternalId] ?? null) : null;

                DropPoint::updateOrCreate(
                    ['ext_id' => (string) $dropPointData['ext_id']],
                    [
                        'name' => $dropPointData['name'],
                        'icon' => $dropPointData['icon'] ?? null,
                        'serial_no' => $dropPointData['serial_no'] ?? null,
                        'dp_no' => $dropPointData['dp_no'] ?? null,
                        'open_hours' => $dropPointData['open_hours'] ?? null,
                        'zone_ext_id' => $zoneExternalId,
                        'zone_id' => $zoneId,
                        'address' => $dropPointData['address'] ?? '',
                        'city' => $dropPointData['city'] ?? null,
                        'latitude' => $dropPointData['latitude'] ?? 0,
                        'longitude' => $dropPointData['longitude'] ?? 0,
                    ]
                );
            }
        });

        return redirect()->route('admin.drop-points.index')
            ->with('success', __('dropPointSynchronizationCompletedSuccessfully'));
    }

    /**
     * Store a newly created drop point.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('drop_points.create'))) {
            abort(401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'shelves' => ['nullable', 'array'],
            'shelves.*' => ['string', 'max:50'],
            'keeper_id' => ['nullable', 'exists:users,id'],
            'zone_id' => ['required', 'exists:zones,id,is_deleted,0'],
        ]);

        $shelfCodes = $validated['shelves'] ?? [];
        unset($validated['shelves']);

        DB::transaction(function () use ($validated, $shelfCodes) {
            $dropPoint = DropPoint::create($validated);

            foreach ($shelfCodes as $code) {
                Shelf::create([
                    'code' => $code,
                    'drop_point_id' => $dropPoint->id,
                    'is_active' => true,
                ]);
            }
            if ($validated['keeper_id']) {
                User::where('id', $validated['keeper_id'])
                    ->update([
                        'drop_point_id' => $dropPoint->id,
                        'zone_id' => $dropPoint->zone_id,
                    ]);
            }
        });

        return redirect()->route('admin.drop-points.index')
            ->with('success', __('dropPointCreatedSuccessfully'));
    }

    /**
     * Update the specified drop point.
     */
    public function update(Request $request, DropPoint $dropPoint): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('drop_points.edit'))) {
            abort(401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'shelves' => ['nullable', 'array'],
            'shelves.*' => ['string', 'max:50'],
            'keeper_id' => ['nullable', 'exists:users,id'],
            'zone_id' => ['required', 'exists:zones,id,is_deleted,0'],
        ]);

        $shelfCodes = $validated['shelves'] ?? [];
        unset($validated['shelves']);

        DB::transaction(function () use ($dropPoint, $validated, $shelfCodes) {
            $dropPoint->update($validated);

            User::where('drop_point_id', $dropPoint->id)
                ->update(['drop_point_id' => null, 'zone_id' => null]);

            User::where('id', $validated['keeper_id'])
                ->update(['drop_point_id' => $dropPoint->id, 'zone_id' => $dropPoint->zone_id]);

            $existingCodes = $existingCodes = $dropPoint->shelves()->pluck('code')->toArray();
            $newCodes = array_diff($shelfCodes, $existingCodes);
            $removedCodes = array_diff($existingCodes, $shelfCodes);

            // Remove shelves that are no longer in the list
            if (! empty($removedCodes)) {
                $dropPoint->shelves()->whereIn('code', $removedCodes)->delete();
            }

            // Add new shelves
            foreach ($newCodes as $code) {
                Shelf::create([
                    'code' => $code,
                    'drop_point_id' => $dropPoint->id,
                    'is_active' => true,
                ]);
            }
        });

        return redirect()->route('admin.drop-points.index')
            ->with('success', __('dropPointUpdatedSuccessfully'));
    }

    /**
     * Remove the specified drop point.
     */
    public function destroy(DropPoint $dropPoint): RedirectResponse
    {
        $user = auth()->user();

        if (! $user || (! $user->can('drop_points.delete'))) {
            abort(401);
        }
        User::where('drop_point_id', $dropPoint->id)->update(['drop_point_id' => null, 'zone_id' => null]);
        $dropPoint->delete();

        return redirect()->route('admin.drop-points.index')
            ->with('success', __('dropPointDeletedSuccessfully'));
    }

    /**
     * Fetch riders, warehouses, and drop points for a specific zone.
     */
    public function getZoneResources($id)
    {
        $zoneId = (int) $id;

        $zone = Zone::query()
            ->notDeleted()
            ->select(['id', 'code', 'name', 'city', 'drawn_paths', 'status'])
            ->where('id', $zoneId)
            ->first();

        if (! $zone) {
            return response()->json([
                'success' => false,
                'message' => __('zoneNotFound'),
            ], 404);
        }

        $zones = [
            'id' => $zone->id,
            'code' => $zone->code,
            'name' => $zone->name,
            'city' => $zone->city,
            'drawn_paths' => $zone->drawn_paths ?? [],
            'status' => $zone->status,
        ];

        $riderModel = User::class;

        $ridersQuery = $riderModel::query()
            ->where('zone_id', $zoneId);

        if ($riderModel === User::class) {
            $ridersQuery
                ->whereHas('roles', fn ($query) => $query->where('name', RoleEnum::RIDER->value))
                ->select(['id', 'name', 'phone_number', 'zone_id', 'status']);
        }

        $riders = $ridersQuery
            ->orderBy('name')
            ->get();

        $warehouses = Warehouse::query()
            ->where('zone_id', $zoneId)
            ->select(['id', 'code', 'name', 'location', 'city', 'latitude', 'longitude', 'zone_id', 'status'])
            ->orderBy('name')
            ->get();

        $dropPoints = DropPoint::query()
            ->where('zone_id', $zoneId)
            ->select(['id', 'name', 'address', 'city', 'latitude', 'longitude', 'zone_id'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'zone_id' => $zoneId,
            'data' => [
                'zone' => $zones,
                'riders' => $riders,
                'warehouses' => $warehouses,
                'droppoints' => $dropPoints,
            ],
        ]);
    }
}
