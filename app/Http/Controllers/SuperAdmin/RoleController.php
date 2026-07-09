<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Contracts\RoleServiceInterface;
use App\Http\Controllers\Controller;
use App\Support\SortHelper;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function __construct(
        private readonly RoleServiceInterface $roleService
    ) {
    }

    /**
     * Display a listing of roles.
     */
    public function index(Request $request): Response
    {
        $user = auth()->user();

        if (!$user || (!$user->can('roles.view'))) {
            abort(401);
        }

        $search = trim((string) $request->query('search', ''));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');

        $roles = $this->roleService->getAllWithRelations();

        if ($search !== '') {
            $needle = strtolower($search);
            $roles = $roles->filter(function ($role) use ($needle) {
                $fields = [
                    $role->id,
                    $role->name,
                    $role->description,
                    $role->platform,
                    $role->country,
                    $role->sub_area,
                    $role->guard_name,
                    $role->createdBy?->name,
                    $role->permissions?->pluck('name')->implode(' '),
                ];

                return collect($fields)
                    ->filter(fn($value) => $value !== null && $value !== '')
                    ->contains(fn($value) => str_contains(strtolower((string) $value), $needle));
            })->values();
        }

        $roles = $this->sortRoles($roles, $sortBy, $sortDir);

        return Inertia::render('SuperAdmin/Roles/Index', [
            'roles' => $roles,
            'canEdit' => $user->can('roles.edit'),
            'filters' => [
                'search' => $search,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    private function sortRoles($roles, string $sortBy, string $sortDir)
    {
        $sortKey = SortHelper::key($sortBy);
        $sorters = [
            'id' => fn ($role) => (int) $role->id,
            'name' => fn ($role) => strtolower((string) $role->name),
            'description' => fn ($role) => strtolower((string) $role->description),
            'platform' => fn ($role) => strtolower((string) $role->platform),
            'country' => fn ($role) => strtolower((string) $role->country),
            'sub_area' => fn ($role) => strtolower((string) $role->sub_area),
            'guard_name' => fn ($role) => strtolower((string) $role->guard_name),
            'created_by' => fn ($role) => strtolower((string) $role->createdBy?->name),
            'permissions' => fn ($role) => (int) $role->permissions?->count(),
            'created_at' => fn ($role) => optional($role->created_at)->timestamp ?? 0,
            'updated_at' => fn ($role) => optional($role->updated_at)->timestamp ?? 0,
        ];

        $sorter = $sorters[$sortKey] ?? $sorters['created_at'];

        return ($sortDir === 'asc' ? $roles->sortBy($sorter) : $roles->sortByDesc($sorter))->values();
    }

    /**
     * Show the form for creating a new role.
     */
    public function create(): Response
    {
        $user = auth()->user();

        if (!$user || (!$user->can('roles.create'))) {
            abort(401);
        }

        $permissions = $this->roleService->getAllPermissions();

        return Inertia::render('SuperAdmin/Roles/Create', [
            'permissions' => $permissions,
        ]);
    }

    /**
     * Store a newly created role.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('roles.create'))) {
            abort(401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:roles,name'],
            'description' => ['nullable', 'string'],
            // Accept both display and storage variants
            'platform' => ['required', 'string', 'in:Admin Portal,Mobile Application,Mobile App'],
            'country' => ['required', 'string', 'max:255'],
            'sub_area' => ['nullable', 'string', 'max:255'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['exists:permissions,id'],
        ]);

        $validated['created_by'] = Auth::id();
        $validated['is_protected'] = false;
        $validated['guard_name'] = 'web'; // Ensure guard_name is set

        // Normalize: store as 'Mobile App' when UI sends 'Mobile Application'
        if (($validated['platform'] ?? null) === 'Mobile Application') {
            $validated['platform'] = 'Mobile App';
        }

        $role = $this->roleService->create($validated);

        // Sync permissions if provided
        if (!empty($validated['permissions'])) {
            $this->roleService->syncPermissions($role->id, $validated['permissions']);
        }

        return redirect()->route('admin.roles.index')
            ->with('success', __('roleCreatedSuccessfully'));
    }

    /**
     * Show the form for editing the specified role.
     */
    public function edit(string $id): Response
    {
        $user = auth()->user();

        if (!$user || (!$user->can('roles.edit'))) {
            abort(401);
        }

        $role = $this->roleService->find($id);

        if (!$role) {
            abort(404, __('roleNotFound'));
        }

        $permissions = $this->roleService->getAllPermissions();

        return Inertia::render('SuperAdmin/Roles/Edit', [
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
                'platform' => $role->platform,
                'country' => $role->country,
                'sub_area' => $role->sub_area,
                'is_protected' => $role->is_protected,
                'permissions' => $role->permissions->pluck('id'),
            ],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Update the specified role.
     */
    public function update(Request $request, string $id): RedirectResponse
    {
        $user = $request->user();

        if (!$user || (!$user->can('roles.edit'))) {
            abort(401);
        }

        $role = $this->roleService->find($id);

        if (!$role) {
            abort(404, __('roleNotFound'));
        }

        if ($role->is_protected) {
            return back()->withErrors(['error' => __('cannotEditAProtectedRole')]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')->ignore($id)],
            'description' => ['nullable', 'string'],
            // Accept both display and storage variants
            'platform' => ['required', 'string', 'in:Admin Portal,Mobile Application,Mobile App'],
            'country' => ['required', 'string', 'max:255'],
            'sub_area' => ['nullable', 'string', 'max:255'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['exists:permissions,id'],
        ]);

        // Extract permissions before update to avoid saving them in the roles table
        $permissions = $validated['permissions'] ?? [];
        unset($validated['permissions']);

        // Normalize: store as 'Mobile App' when UI sends 'Mobile Application'
        if (($validated['platform'] ?? null) === 'Mobile Application') {
            $validated['platform'] = 'Mobile App';
        }

        $this->roleService->update($id, $validated);

        // Always sync permissions (even if empty array) to handle deselection
        $this->roleService->syncPermissions($id, $permissions);

        return redirect()->route('admin.roles.index')
            ->with('success', __('roleUpdatedSuccessfully'));
    }

    /**
     * Remove the specified role.
     */
    public function destroy(string $id): RedirectResponse
    {
        $user = auth()->user();

        if (!$user || (!$user->can('roles.delete'))) {
            abort(401);
        }

        if (!$this->roleService->canDelete($id)) {
            return back()->withErrors(['error' => __('cannotDeleteAProtectedRole')]);
        }

        $this->roleService->delete($id);

        return redirect()->route('admin.roles.index')
            ->with('success', __('roleDeletedSuccessfully'));
    }
}
