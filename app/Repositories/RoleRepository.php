<?php

namespace App\Repositories;

use App\Contracts\RoleRepositoryInterface;
use App\Models\Role;
use Illuminate\Support\Collection;

/**
 * Repository for the Role model.
 */
class RoleRepository extends AbstractRepository implements RoleRepositoryInterface
{
    public function __construct(Role $model)
    {
        parent::__construct($model);
    }

    /**
     * Get all roles with their relationships.
     *
     * @return Collection
     */
    public function getAllWithRelations(): Collection
    {
        return $this->model->newQuery()
            ->with(['createdBy:id,name', 'permissions:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Find or create a role by attributes.
     *
     * @param array $attributes
     * @param array $values
     * @return \Illuminate\Database\Eloquent\Model
     */
    public function firstOrCreate(array $attributes, array $values = []): \Illuminate\Database\Eloquent\Model
    {
        return $this->model->firstOrCreate($attributes, $values);
    }
}
