<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Contracts\EmployeeServiceInterface;
use App\Contracts\RoleServiceInterface;
use App\Enums\ShipmentStatus;
use App\Http\Controllers\Controller;
use App\Models\DropPoint;
use App\Models\Shipment;
use App\Models\Warehouse;
use App\Models\Zone;
use App\Services\MtnSmsService;
use App\Services\SendGridEmailService;
use App\Support\SortHelper;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeController extends Controller
{
    public function __construct(
        private readonly EmployeeServiceInterface $employeeService,
        private readonly RoleServiceInterface $roleService,
        private readonly SendGridEmailService $sendGridEmailService
    ) {}

    /**
     * Display a listing of employees.
     */
    public function index(Request $request): Response
    {
        $user = auth()->user();

        if (! $user || (! $user->can('employees.view') && ! $user->can('employees.create'))) {
            abort(401);
        }

        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');

        $employees = collect();

        if ($user->can('employees.view')) {
            $employees = $this->employeeService->getAllEmployees()->load([
                'vehicles:id,user_id,code,license_plate,model,model_year',
                'zone:id,name,code',
                'warehouse:id,name,code',
                'dropPoint:id,name',
            ]);

            $employees = $this->sortEmployees($this->filterEmployees($employees, $search, $status), $sortBy, $sortDir)
                ->map(function ($employee) {
                    // Convert document paths to fully-qualified URLs regardless of storage backend
                    if ($employee->id_card_front) {
                        $employee->id_card_front = media_url($employee->id_card_front);
                    }
                    if ($employee->id_card_back) {
                        $employee->id_card_back = media_url($employee->id_card_back);
                    }
                    if ($employee->driving_license) {
                        $employee->driving_license = media_url($employee->driving_license);
                    }
                    if ($employee->passport) {
                        $employee->passport = media_url($employee->passport);
                    }
                    if ($employee->idp) {
                        $employee->idp = media_url($employee->idp);
                    }

                    if ($employee->avatar_path) {
                        $employee->avatar_path = media_url($employee->avatar_path);
                    }

                    // Calculate completed jobs and total earnings from shipments where this user is the rider
                    // Use the same definition of "completed" as the rider mobile API so the totals align.
                    $completedStatuses = $this->getCompletionStatuses();

                    $completedShipmentsQuery = Shipment::query()
                        ->where('rider_id', $employee->id)
                        ->where(function ($query) use ($completedStatuses) {
                            $query->whereIn('status', $completedStatuses)
                                ->orWhereHas('latestStatusHistory', function ($history) use ($completedStatuses) {
                                    $history->whereIn('to_status', $completedStatuses);
                                });
                        });

                    $employee->completed_jobs = (clone $completedShipmentsQuery)->count();
                    $employee->total_earnings = (int) (clone $completedShipmentsQuery)->sum('total_fee');

                    // Add mileage stats for riders, drivers, and drop point keepers
                    $trackableRoles = ['rider', 'car_driver', 'drop_point_keeper'];
                    $employeeRoles = $employee->roles->pluck('name')->toArray();

                    if (! empty(array_intersect($trackableRoles, $employeeRoles))) {
                        $employee->mileage_stats = $employee->getMileageStats();
                    } else {
                        $employee->mileage_stats = null;
                    }

                    return $employee;
                });
        }
        $statistics = $user->can('employees.view')
            ? $this->employeeService->getEmployeeStatistics()
            : collect();
        $roles = $this->roleService->getAllWithRelations();

        // Get all zones for dropdown
        $zones = Zone::select('id', 'name', 'code', 'status', 'city', 'drawn_paths')
            ->notDeleted()
            ->where('status', Zone::STATUS_ACTIVE)
            ->orderBy('name')
            ->get();

        // Get all warehouses for dropdown (for warehouse keepers)
        $warehouses = Warehouse::select('id', 'name', 'code', 'status')
            ->where('status', Warehouse::STATUS_ACTIVE)
            ->orderBy('name')
            ->get();

        $dropPoints = DropPoint::select('id', 'name', 'city')
            ->orderBy('name')
            ->get();

        return Inertia::render('SuperAdmin/Employees/Index', [
            'employees' => $employees,
            'statistics' => $statistics,
            'roles' => $roles,
            'zones' => $zones,
            'warehouses' => $warehouses,
            'dropPoints' => $dropPoints,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    private function sortEmployees($employees, string $sortBy, string $sortDir)
    {
        $sortKey = SortHelper::key($sortBy);
        $sorters = [
            'id' => fn ($employee) => (int) $employee->id,
            'employee_id' => fn ($employee) => strtolower((string) $employee->employee_id),
            'name' => fn ($employee) => strtolower((string) $employee->name),
            'email' => fn ($employee) => strtolower((string) $employee->email),
            'phone' => fn ($employee) => strtolower((string) $employee->phone_number),
            'phone_number' => fn ($employee) => strtolower((string) $employee->phone_number),
            'status' => fn ($employee) => strtolower((string) $employee->status),
            'employment_type' => fn ($employee) => strtolower((string) $employee->employment_type),
            'platform' => fn ($employee) => strtolower((string) $employee->platform),
            'role' => fn ($employee) => strtolower((string) $employee->roles?->pluck('name')->implode(' ')),
            'zone' => fn ($employee) => strtolower((string) $employee->zone?->name),
            'warehouse' => fn ($employee) => strtolower((string) $employee->warehouse?->name),
            'drop_point' => fn ($employee) => strtolower((string) $employee->dropPoint?->name),
            'created_at' => fn ($employee) => optional($employee->created_at)->timestamp ?? 0,
            'updated_at' => fn ($employee) => optional($employee->updated_at)->timestamp ?? 0,
        ];

        $sorter = $sorters[$sortKey] ?? $sorters['created_at'];

        return ($sortDir === 'asc' ? $employees->sortBy($sorter) : $employees->sortByDesc($sorter))->values();
    }

    private function filterEmployees($employees, string $search, string $status)
    {
        if ($search !== '') {
            $needle = strtolower($search);
            $employees = $employees->filter(function ($employee) use ($needle) {
                $fields = [
                    $employee->id,
                    $employee->employee_id,
                    $employee->name,
                    $employee->email,
                    $employee->phone_number,
                    $employee->emergency_phone_number,
                    $employee->employment_type,
                    $employee->platform,
                    $employee->status,
                    $employee->address,
                    $employee->city,
                    $employee->country,
                    $employee->zone?->name,
                    $employee->zone?->code,
                    $employee->warehouse?->name,
                    $employee->warehouse?->code,
                    $employee->dropPoint?->name,
                    $employee->roles?->pluck('name')->implode(' '),
                ];

                return collect($fields)
                    ->filter(fn ($value) => $value !== null && $value !== '')
                    ->contains(fn ($value) => str_contains(strtolower((string) $value), $needle));
            });
        }

        if ($status !== '' && strtolower($status) !== 'all') {
            $normalizedStatus = strtolower($status);
            $employees = $employees->filter(
                fn ($employee) => strtolower(trim((string) $employee->status)) === $normalizedStatus
            );
        }

        return $employees->values();
    }

    /**
     * Store a newly created employee.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('employees.create'))) {
            abort(401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['required', 'string', 'max:20', 'unique:users,phone_number'],
            'emergency_phone_number' => ['nullable', 'string', 'max:20'],
            'blood_type' => ['nullable', 'string', 'max:10'],
            'employment_type' => ['required'],
            // Accept both UI label and storage variant
            'platform' => ['required', 'in:Admin Portal,Mobile Application,Mobile App'],
            'role' => ['required', 'string', 'exists:roles,name'],
            'zone_id' => ['nullable', 'integer', 'exists:zones,id,is_deleted,0'],
            'zone_ids' => ['nullable', 'array'],
            'zone_ids.*' => ['integer', 'exists:zones,id,is_deleted,0'],
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'drop_point_id' => ['nullable', 'integer', 'exists:drop_points,id'],
            'address' => ['nullable', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'employee_id' => ['nullable', 'string', 'unique:users,employee_id'],
            'id_card_front' => ['nullable', 'string'],
            'id_card_back' => ['nullable', 'string'],
            'driving_license' => ['nullable', 'string'],
            'license_expiry' => ['nullable', 'date'],
            'delivery_speed_mode' => ['nullable', 'string', 'in:direct,indirect,both'],
            'cod_collection_limit' => ['nullable', 'numeric', 'min:0'],
            'working_hours' => ['nullable', 'array'],
        ], [
            'phone_number.unique' => __('thisPhoneNumberIsAlreadyAssignedToAnotherEmployee'),
        ]);

        // Create employee and get the generated password
        $result = $this->employeeService->onboardEmployee($validated);
        $employee = $result['employee'];
        $password = $result['password'];

        $employee->loadMissing('roles');

        if (app()->environment('local')) {
            return redirect()->route('admin.employees.index')
                ->with('success', __('employeeCreatedSuccessfully'));
        }

        // Send invitation email with credentials using SendGrid
        try {
            $smsService = app(MtnSmsService::class);
            $locale = strtolower((string) ($user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

            $role = $employee->roles->first()?->name ?? 'Employee';

            $sent = $this->sendGridEmailService->sendEmployeeInvitation(
                $employee->email,
                $employee->name,
                $password,
                $employee->employee_id,
                ucfirst($role)
            );

            if ($validated['phone_number']) {
                $smsService->sendLocalized($validated['phone_number'], 'smsNewEmployeOnboard', [
                    'appName' => env('APP_NAME', 'Boxygo'),
                    'employeeName' => $employee->name,
                    'employeeId' => $employee->employee_id,
                    'employeeRole' => ucfirst($role),
                    'employeeEmail' => $employee->email,
                    'temporaryPassword' => $password,
                ], $locale);
            }

            if ($sent) {
                return redirect()->route('admin.employees.index')
                    ->with('success', __('invitationLinkSuccessfullySentToEmail', ['email' => $employee->email]));
            } else {
                return redirect()->route('admin.employees.index')
                    ->with('error', __('employeeCreatedSuccessfullyButFailedToSendInvitationEmailPleaseProvideCredentialsManually'));
            }
        } catch (\Exception $e) {
            // Log the error but still show success message for employee creation
            \Log::error('Failed to send employee invitation email: '.$e->getMessage());

            return redirect()->route('admin.employees.index')
                ->with('error', __('employeeCreatedSuccessfullyButFailedToSendInvitationEmailPleaseProvideCredentialsManually'));
        }
    }

    /**
     * Display the specified employee.
     */
    public function show(string $id): Response
    {
        $user = auth()->user();

        if (! $user || (! $user->can('employees.view'))) {
            abort(401);
        }

        $employee = $this->employeeService->find($id);

        if (! $employee) {
            abort(404, __('employeeNotFound'));
        }

        return Inertia::render('SuperAdmin/Employees/Show', [
            'employee' => [
                'id' => $employee->id,
                'employee_id' => $employee->employee_id,
                'name' => $employee->name,
                'email' => $employee->email,
                'phone_number' => $employee->phone_number,
                'employment_type' => $employee->employment_type,
                'platform' => $employee->platform,
                'status' => $employee->status,
                'id_card_front' => $employee->id_card_front,
                'id_card_back' => $employee->id_card_back,
                'driving_license' => $employee->driving_license,
                'license_expiry' => $employee->license_expiry,
                'completed_jobs' => $employee->completed_jobs,
                'cancel_rate' => $employee->cancel_rate,
                'avg_eta_minutes' => $employee->avg_eta_minutes,
                'cod_collection_limit' => $employee->cod_collection_limit,
                'working_hours' => $employee->working_hours,
                'member_since' => $employee->member_since,
                'roles' => $employee->roles,
            ],
        ]);
    }

    /**
     * Update the specified employee.
     */
    public function update(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('employees.edit'))) {
            abort(401);
        }

        $employee = $this->employeeService->find($id);

        if (! $employee) {
            abort(404, __('employeeNotFound'));
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($id)],
            'phone_number' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone_number')->ignore($id)],
            'emergency_phone_number' => ['nullable', 'string', 'max:20'],
            'blood_type' => ['nullable', 'string', 'max:10'],
            'password' => ['nullable', 'string', 'min:8'],
            'employment_type' => ['required'],
            // Accept both UI label and storage variant
            'platform' => ['required', 'in:Admin Portal,Mobile Application,Mobile App'],
            'status' => ['nullable', 'in:pending,active,inactive'],
            'role' => ['required', 'string', 'exists:roles,name'],
            'zone_id' => ['nullable', 'integer', 'exists:zones,id,is_deleted,0'],
            'zone_ids' => ['nullable', 'array'],
            'zone_ids.*' => ['integer', 'exists:zones,id,is_deleted,0'],
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'drop_point_id' => ['nullable', 'integer', 'exists:drop_points,id'],
            'address' => ['nullable', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'employee_id' => ['nullable', 'string', Rule::unique('users', 'employee_id')->ignore($id)],
            'id_card_front' => ['nullable', 'string'],
            'id_card_back' => ['nullable', 'string'],
            'driving_license' => ['nullable', 'string'],
            'license_expiry' => ['nullable', 'date'],
            'delivery_speed_mode' => ['nullable', 'string', 'in:direct,indirect,both'],
            'cod_collection_limit' => ['nullable', 'numeric', 'min:0'],
            'working_hours' => ['nullable', 'array'],
            'completed_jobs' => ['nullable', 'integer', 'min:0'],
            'cancel_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'avg_eta_minutes' => ['nullable', 'integer', 'min:0'],
        ], [
            'phone_number.regex' => __('pleaseEnterValidPhoneNumberInInternationalFormat'),
            'phone_number.unique' => __('thisPhoneNumberIsAlreadyAssignedToAnotherEmployee'),
        ]);

        $this->employeeService->updateEmployee($id, $validated);

        return redirect()->route('admin.employees.index')
            ->with('success', __('employeeUpdatedSuccessfully'));
    }

    /**
     * Toggle employee status (activate/deactivate).
     */
    public function toggleStatus(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('employees.edit'))) {
            abort(401);
        }

        $employee = $this->employeeService->find($id);

        if (! $employee) {
            abort(404, __('employeeNotFound'));
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['active', 'inactive', 'pending'])],
        ]);

        $this->employeeService->updateEmployee($id, [
            'status' => $validated['status'],
        ]);

        $statusText = $validated['status'] === 'inactive' ? __('deactivated') : __('activated');

        return redirect()->route('admin.employees.index')
            ->with('success', __('employeeStatusUpdatedSuccessfully', ['status' => $statusText]));
    }

    /**
     * Remove the specified employee.
     */
    public function destroy(string $id): RedirectResponse
    {
        $user = auth()->user();

        if (! $user || (! $user->can('employees.delete'))) {
            abort(401);
        }

        $employee = $this->employeeService->find($id);

        if (! $employee) {
            abort(404, __('employeeNotFound'));
        }

        $this->employeeService->delete($id);

        return redirect()->route('admin.employees.index')
            ->with('success', __('employeeDeletedSuccessfully'));
    }

    /**
     * Statuses indicating a shipment has completed from the rider perspective.
     *
     * Mirrors the rider mobile API so earnings/totals stay consistent across portals.
     */
    private function getCompletionStatuses(): array
    {
        return [
            ShipmentStatus::DELIVERED->value,
            ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            ShipmentStatus::PENDING_HANDOVER->value,
            ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            ShipmentStatus::READY_FOR_PICKUP->value,
            ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];
    }
}
