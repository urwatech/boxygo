<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Contracts\ParcelServiceInterface;
use App\Http\Controllers\Controller;
use App\Models\Parcel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\File;

class ParcelController extends Controller
{
    private const MAX_PARCEL_SLOTS = 5;

    public function __construct(
        private readonly ParcelServiceInterface $parcelService
    ) {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        if (!$user || !$user->can('parcels.view')) {
            abort(401);
        }

        $search = $request->string('search')->toString();
        $status = $request->string('status')->toString();
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));
        $perPage = $request->integer('per_page', 10);

        $parcels = $this->parcelService
            ->paginateWithFilters($search, [
                'status' => $status ?: null,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ], $perPage)
            ->through(function (Parcel $parcel) {
                $icon = media_url($parcel->icon_path);
                return [
                    'id' => $parcel->id,
                    'name' => $parcel->name,
                    'description' => $parcel->description,
                    'length_cm' => $parcel->length_cm,
                    'width_cm' => $parcel->width_cm,
                    'height_cm' => $parcel->height_cm,
                    'min_weight_kg' => $parcel->min_weight_kg,
                    'max_weight_kg' => $parcel->max_weight_kg,
                    'api_mapping_key' => $parcel->api_mapping_key,
                    'status' => $parcel->status,
                    'icon_path' => $icon,
                    'created_at' => $parcel->created_at?->toIso8601String(),
                    'updated_at' => $parcel->updated_at?->toIso8601String(),
                ];
            });

        $statistics = $this->parcelService->getStatistics();
        $limit = self::MAX_PARCEL_SLOTS;
        $remainingSlots = max(0, $limit - ($statistics['total'] ?? 0));

        return Inertia::render('SuperAdmin/Parcels/Index', [
            'parcels' => $parcels,
            'statistics' => array_merge($statistics, [
                'limit' => $limit,
                'remaining_slots' => $remainingSlots,
            ]),
            'filters' => [
                'search' => $search,
                'status' => $status ?: null,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
                'per_page' => $perPage,
            ],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('parcels.create'))) {
            abort(401);
        }

        $validated = $this->validatePayload($request);

        $attributes = $this->formatAttributes($validated);
        // Handle icon upload and persist stored path
        if ($request->hasFile('icon')) {
            $file = $request->file('icon');
            $dir = public_path('assets/parcel-icons');
            if (!File::exists($dir)) {
                File::makeDirectory($dir, 0755, true);
            }
            $filename = uniqid('icon_', true) . '.' . $file->getClientOriginalExtension();
            $file->move($dir, $filename);
            $attributes['icon_path'] = '/assets/parcel-icons/' . $filename;
        }
        $attributes['status'] = Parcel::STATUS_ACTIVE;

        $this->parcelService->create($attributes);

        return redirect()
            ->route('admin.parcels.index')
            ->with('success', __('parcelSizeCreatedSuccessfully'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('parcels.edit'))) {
            abort(401);
        }

        $parcel = $this->parcelService->find($id);

        if (!$parcel) {
            abort(404, __('parcelNotFound'));
        }

        $validated = $this->validatePayload($request, true);

        $attributes = $this->formatAttributes($validated);

            // Replace icon if a new one is uploaded
            if ($request->hasFile('icon')) {
                if (!empty($parcel->icon_path)) {
                    delete_media_file($parcel->icon_path);
                }

            $file = $request->file('icon');
            $dir = public_path('assets/parcel-icons');
            if (!File::exists($dir)) {
                File::makeDirectory($dir, 0755, true);
            }
            $filename = uniqid('icon_', true) . '.' . $file->getClientOriginalExtension();
            $file->move($dir, $filename);
            $attributes['icon_path'] = '/assets/parcel-icons/' . $filename;
        }

        if (array_key_exists('status', $validated)) {
            $attributes['status'] = $validated['status'];
        }

        $this->parcelService->update($id, $attributes);

        return redirect()
            ->route('admin.parcels.index')
            ->with('success', __('parcelSizeUpdatedSuccessfully'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): RedirectResponse
    {
        $user = auth()->user();

        if (!$user || (!$user->can('parcels.delete'))) {
            abort(401);
        }

        $parcel = $this->parcelService->find($id);

        if (!$parcel) {
            abort(404, __('parcelNotFound'));
        }

        $this->parcelService->delete($id);

        return redirect()
            ->route('admin.parcels.index')
            ->with('success', __('parcelSizeDeletedSuccessfully'));
    }

    /**
     * Update the status for a parcel.
     */
    public function updateStatus(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();

        if (!$user || !$user->can('parcels.status')) {
            abort(401);
        }

        $parcel = $this->parcelService->find($id);

        if (!$parcel) {
            abort(404, __('parcelNotFound'));
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in([Parcel::STATUS_ACTIVE, Parcel::STATUS_INACTIVE])],
        ]);

        $this->parcelService->update($id, [
            'status' => $validated['status'],
        ]);

        return redirect()
            ->route('admin.parcels.index')
            ->with('success', __('parcelStatusUpdatedSuccessfully'));
    }

    /**
     * Validate request payload for store/update operations.
     */
    private function validatePayload(Request $request, bool $includeStatus = false): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'length_cm' => ['nullable', 'numeric', 'min:0'],
            'width_cm' => ['nullable', 'numeric', 'min:0'],
            'height_cm' => ['nullable', 'numeric', 'min:0'],
            'min_weight_kg' => ['required', 'numeric', 'min:0'],
            'max_weight_kg' => ['required', 'numeric', 'min:0', 'gte:min_weight_kg'],
            'api_mapping_key' => ['nullable', 'string', 'max:50'],
            // Icon file upload; required on create, optional on update
            'icon' => [$includeStatus ? 'nullable' : 'required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:2048'],
        ];

        if ($includeStatus) {
            $rules['status'] = ['required', Rule::in([Parcel::STATUS_ACTIVE, Parcel::STATUS_INACTIVE])];
        }

        return $request->validate($rules);
    }

    /**
     * Normalize parcel payload ready for persistence.
     */
    private function formatAttributes(array $attributes): array
    {
        $numericFields = [
            'length_cm',
            'width_cm',
            'height_cm',
            'min_weight_kg',
            'max_weight_kg',
        ];

        foreach ($numericFields as $field) {
            if (!array_key_exists($field, $attributes)) {
                continue;
            }

            $attributes[$field] = $this->toNullableFloat($attributes[$field]);
        }

        if (array_key_exists('description', $attributes) && $attributes['description'] === '') {
            $attributes['description'] = null;
        }

        if (array_key_exists('api_mapping_key', $attributes) && $attributes['api_mapping_key'] === '') {
            $attributes['api_mapping_key'] = null;
        }

        if (array_key_exists('icon_path', $attributes) && $attributes['icon_path'] === '') {
            $attributes['icon_path'] = null;
        }

        return $attributes;
    }

    private function toNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value;
    }
}
