<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Interfaces\BaseServiceInterface;

/**
 * Interface for role service.
 */
interface RoleServiceInterface extends BaseServiceInterface
{
    /**
     * Get all roles with their relationships.
     *
     * @return Collection
     */
    public function getAllWithRelations(): Collection;

    /**
     * Get all available permissions.
     *
     * @return Collection
     */
    public function getAllPermissions(): Collection;

    /**
     * Sync permissions to a role.
     *
     * @param int|string $roleId
     * @param array $permissionIds
     * @return Model|null
     */
    public function syncPermissions(int|string $roleId, array $permissionIds): ?Model;

    /**
     * Check if a role can be deleted (not protected).
     *
     * @param int|string $roleId
     * @return bool
     */
    public function canDelete(int|string $roleId): bool;

    public function roleExists(string $name, string $guard = 'web'): bool;
}
