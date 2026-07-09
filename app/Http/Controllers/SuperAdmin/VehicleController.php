<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Contracts\VehicleServiceInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\VehicleAssignRequest;
use App\Http\Requests\Vehicle\VehicleManagementStoreRequest;
use App\Http\Requests\Vehicle\VehicleManagementUpdateRequest;
use App\Http\Requests\Vehicle\VehicleStatusUpdateRequest;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;


class VehicleController extends Controller
{
    public function __construct(private readonly VehicleServiceInterface $vehicleService)
    {
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        if (!$user || (!$user->can('vehicles.view'))) {
            abort(401);
        }

        $search = $request->string('search')->toString();
        $status = $request->string('status')->toString() ?: 'All';
        $type = $request->string('type')->toString() ?: null;
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));
        $perPage = $request->integer('per_page', 10);

        $vehicles = $this->vehicleService
            ->paginateWithFilters($search, [
                'status' => $status,
                'type' => $type,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ], $perPage)
            ->through(function (Vehicle $vehicle) {
                return [
                    'id' => $vehicle->id,
                    'code' => $vehicle->code,
                    'type' => $vehicle->type,
                    'license_plate' => $vehicle->license_plate,
                    'permit_expires_at' => $vehicle->permit_expires_at?->format('M d, Y'),
                    'permit_expires_at_raw' => $vehicle->permit_expires_at?->format('Y-m-d'),
                    'insurance_expires_at' => $vehicle->insurance_expires_at?->format('M d, Y'),
                    'insurance_expires_at_raw' => $vehicle->insurance_expires_at?->format('Y-m-d'),
                    'status' => $vehicle->status,
                    'status_label' => match ($vehicle->status) {
                        Vehicle::STATUS_ACTIVE => 'Active',
                        Vehicle::STATUS_PENDING_RENEWAL => 'Pending Renewal',
                        Vehicle::STATUS_INACTIVE => 'Inactive',
                        default => ucfirst(str_replace('_', ' ', $vehicle->status)),
                    },
                    'assigned_rider' => $vehicle->user ? [
                        'id' => $vehicle->user->id,
                        'name' => $vehicle->user->name,
                    ] : null,
                    'model' => $vehicle->model,
                    'model_year' => $vehicle->model_year,
                    'color' => $vehicle->color,
                    'vehicle_registration_path' => $vehicle->vehicle_registration_path,
                    'car_insurance_path' => $vehicle->car_insurance_path,
                    'operating_permit_path' => $vehicle->operating_permit_path,
                    'additional_documents' => $vehicle->additional_documents ?? [],
                ];
            });

        $riders = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'rider'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => 'rider',
            ]);

        $carDrivers = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'car driver'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => 'car driver',
            ]);

        $statistics = $this->vehicleService->getStatistics();
        $typeOptions = $this->vehicleService->distinctTypes();

        return Inertia::render('SuperAdmin/Vehicles/Index', [
            'vehicles' => $vehicles,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'type' => $type,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
                'per_page' => $perPage,
            ],
            'stats' => [
                'total' => $statistics['total'] ?? 0,
                'bikes' => $statistics['bikes'] ?? 0,
                'vans' => $statistics['vans'] ?? 0,
                'mini_vans' => $statistics['mini_vans'] ?? 0,
                'inactive' => $statistics['inactive'] ?? 0,
            ],
            'statusOptions' => [
                ['label' => 'All', 'value' => 'All'],
                ['label' => 'Active', 'value' => Vehicle::STATUS_ACTIVE],
                ['label' => 'Pending Renewal', 'value' => Vehicle::STATUS_PENDING_RENEWAL],
                ['label' => 'Inactive', 'value' => Vehicle::STATUS_INACTIVE],
            ],
            'typeOptions' => $typeOptions,
            'riders' => $riders,
            'carDrivers' => $carDrivers,
        ]);
    }

    public function store(VehicleManagementStoreRequest $request): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('vehicles.create'))) {
            abort(401);
        }

        $data = $request->validated();

        $payload = [
            'type' => $data['type'],
            'model' => $data['model'] ?? null,
            'model_year' => $data['model_year'] ?? null,
            'color' => $data['color'] ?? null,
            'license_plate' => $data['license_plate'],
            'permit_expires_at' => $data['permit_expires_at'] ?? null,
            'insurance_expires_at' => $data['insurance_expires_at'] ?? null,
            'status' => $data['status'],
        ];

        // Get upload paths using helper
        $uploadPaths = upload_path('vehicles', 'documents');

        // Handle single document uploads
        if ($request->hasFile('vehicle_registration')) {
            $file = $request->file('vehicle_registration');
            if ($file->isValid()) {
                $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                $file->move($uploadPaths['absolute'], $filename);
                $payload['vehicle_registration_path'] = $uploadPaths['relative'] . '/' . $filename;
            }
        }

        if ($request->hasFile('car_insurance')) {
            $file = $request->file('car_insurance');
            if ($file->isValid()) {
                $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                $file->move($uploadPaths['absolute'], $filename);
                $payload['car_insurance_path'] = $uploadPaths['relative'] . '/' . $filename;
            }
        }

        if ($request->hasFile('operating_permit')) {
            $file = $request->file('operating_permit');
            if ($file->isValid()) {
                $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                $file->move($uploadPaths['absolute'], $filename);
                $payload['operating_permit_path'] = $uploadPaths['relative'] . '/' . $filename;
            }
        }

        if ($request->hasFile('additional_documents')) {
        $files = $request->file('additional_documents');
        $additionalDocs = [];

        if (is_array($files)) {
            foreach ($files as $file) {
                if ($file && $file->isValid()) {
                    $originalName = $file->getClientOriginalName();
                    $size = $file->getSize();
                    $mime = $file->getMimeType();

                    $filename = time() . '_' . uniqid() . '_' . $originalName;

                    $file->move($uploadPaths['absolute'], $filename);

                    $additionalDocs[] = [
                        'path' => $uploadPaths['relative'] . '/' . $filename,
                        'original_name' => $originalName,
                        'size' => $size,
                        'mime_type' => $mime,
                    ];
                }
            }
        }

        if (!empty($additionalDocs)) {
            $payload['additional_documents'] = $additionalDocs;
        }
    }


        $this->vehicleService->create($payload);

        return redirect()
            ->route('admin.vehicles.index')
            ->with('success', __('vehicleAddedSuccessfully'));
    }

    public function update(VehicleStatusUpdateRequest $request, Vehicle $vehicle): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('vehicles.manage') && !$user->can('vehicles.create'))) {
            abort(401);
        }

        $validated = $request->validated();

        $this->vehicleService->update($vehicle->id, [
            'status' => $validated['status'],
        ]);

        return redirect()
            ->route('admin.vehicles.index')
            ->with('success', __('vehicleStatusUpdatedSuccessfully'));
    }

    public function updateDetails(VehicleManagementUpdateRequest $request, Vehicle $vehicle): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('vehicles.manage') && !$user->can('vehicles.create'))) {
            abort(401);
        }

        $data = $request->validated();

        $payload = [
            'type' => $data['type'],
            'model' => $data['model'] ?? null,
            'model_year' => $data['model_year'] ?? null,
            'color' => $data['color'] ?? null,
            'license_plate' => $data['license_plate'],
            'permit_expires_at' => $data['permit_expires_at'] ?? null,
            'insurance_expires_at' => $data['insurance_expires_at'] ?? null,
            'status' => $data['status'],
        ];

        $uploadPaths = upload_path('vehicles', 'documents');

        if ($request->hasFile('vehicle_registration')) {
            $file = $request->file('vehicle_registration');
            if ($file->isValid()) {
                $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                $file->move($uploadPaths['absolute'], $filename);
                $payload['vehicle_registration_path'] = $uploadPaths['relative'] . '/' . $filename;
            }
        }

        if ($request->hasFile('car_insurance')) {
            $file = $request->file('car_insurance');
            if ($file->isValid()) {
                $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                $file->move($uploadPaths['absolute'], $filename);
                $payload['car_insurance_path'] = $uploadPaths['relative'] . '/' . $filename;
            }
        }

        if ($request->hasFile('operating_permit')) {
            $file = $request->file('operating_permit');
            if ($file->isValid()) {
                $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                $file->move($uploadPaths['absolute'], $filename);
                $payload['operating_permit_path'] = $uploadPaths['relative'] . '/' . $filename;
            }
        }

        if ($request->hasFile('additional_documents')) {
            $files = $request->file('additional_documents');
            $additionalDocs = [];

            if (is_array($files)) {
                foreach ($files as $file) {
                    if ($file && $file->isValid()) {
                        $originalName = $file->getClientOriginalName();
                        $size = $file->getSize();
                        $mime = $file->getMimeType();

                        $filename = time() . '_' . uniqid() . '_' . $originalName;

                        $file->move($uploadPaths['absolute'], $filename);

                        $additionalDocs[] = [
                            'path' => $uploadPaths['relative'] . '/' . $filename,
                            'original_name' => $originalName,
                            'size' => $size,
                            'mime_type' => $mime,
                        ];
                    }
                }
            }

            if (!empty($additionalDocs)) {
                $existingDocs = is_array($vehicle->additional_documents) ? $vehicle->additional_documents : [];
                $payload['additional_documents'] = array_merge($existingDocs, $additionalDocs);
            }
        }

        $this->vehicleService->update($vehicle->id, $payload);

        return redirect()
            ->route('admin.vehicles.index')
            ->with('success', __('vehicleUpdatedSuccessfully'));
    }

    public function assign(VehicleAssignRequest $request, Vehicle $vehicle): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('vehicles.assign'))) {
            abort(401);
        }

        $validated = $request->validated();

        if (array_key_exists('user_id', $validated) && $validated['user_id']) {
            $this->vehicleService->assignToUser($vehicle->id, (int) $validated['user_id']);
        } else {
            $this->vehicleService->detachFromUser($vehicle->id);
        }

        return redirect()
            ->route('admin.vehicles.index')
            ->with('success', __('vehicleAssignmentUpdatedSuccessfully'));
    }
}
