<?php

namespace App\Services;

use App\Contracts\RoleServiceInterface;
use App\Repositories\RoleRepository;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Service layer for role-related logic.
 */
class RoleService extends AbstractService implements RoleServiceInterface
{
    public function __construct(RoleRepository $repository)
    {
        parent::__construct($repository);
    }

    /**
     * Get all roles with their relationships.
     */
    public function getAllWithRelations(): Collection
    {
        return $this->repository->getAllWithRelations();
    }

    /**
     * Get all available permissions for the given guard (default: web).
     */
    public function getAllPermissions(string $guard = 'web'): Collection
    {
        return Permission::where('guard_name', $guard)->get();
    }

    /**
     * Sync permissions by permission IDs or names to a role.
     */
    public function syncPermissions(int|string $roleId, array $permissionIds): ?Model
    {
        $role = $this->find($roleId);

        if (! $role) {
            return null;
        }

        // Handle empty array - remove all permissions
        if (empty($permissionIds)) {
            $role->syncPermissions([]);

            return $role;
        }

        // Get permissions by IDs with matching guard
        $permissions = Permission::whereIn('id', $permissionIds)
            ->where('guard_name', $role->guard_name ?? 'web')
            ->get();

        // Sync the permissions to the role
        $role->syncPermissions($permissions);

        return $role;
    }

    /**
     * Check if a role can be deleted (not protected).
     */
    public function canDelete(int|string $roleId): bool
    {
        $role = $this->find($roleId);

        return $role && ! $role->is_protected;
    }

    /**
     * Find or create a role by attributes.
     */
    public function firstOrCreate(array $attributes, array $values = []): Model
    {
        // Ensure guard_name always defaults to 'web'
        $attributes['guard_name'] = $attributes['guard_name'] ?? 'web';
        $values['guard_name'] = $values['guard_name'] ?? 'web';

        return $this->repository->firstOrCreate($attributes, $values);
    }

    /**
     * Create or retrieve a permission safely.
     */
    public function firstOrCreatePermission(array $attributes): Model
    {
        $attributes['guard_name'] = $attributes['guard_name'] ?? 'web';

        return Permission::firstOrCreate($attributes);
    }

    /**
     * Sync permissions safely using role’s guard name.
     */
    public function syncPermissionsToRole(Model $role, array $permissions): Model
    {
        $guard = $role->guard_name ?? 'web';

        // Normalize the permissions array (handles both arrays of names or arrays of arrays)
        $permissionNames = collect($permissions)
            ->map(fn ($p) => is_array($p) ? ($p['name'] ?? null) : $p)
            ->filter()
            ->values()
            ->all();

        $permissionModels = Permission::whereIn('name', $permissionNames)
            ->where('guard_name', $guard)
            ->get();

        $role->syncPermissions($permissionModels);

        return $role;
    }

    /**
     * Check if a role with the given name exists for the guard.
     */
    public function roleExists(string $name, string $guard = 'web'): bool
    {
        return Role::where('name', $name)
            ->where('guard_name', $guard)
            ->exists();
    }
}
