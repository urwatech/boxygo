<?php

namespace App\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Interfaces\BaseRepositoryInterface;

/**
 * Class AbstractRepository
 *
 * Provides default repository methods.
 */
abstract class AbstractRepository implements BaseRepositoryInterface
{
    protected Model $model;

    public function __construct(Model $model)
    {
        // The concrete model is injected for use by child repositories
        $this->model = $model;
    }

    public function all(): Collection
    {
        return $this->model->all();
    }

    public function find(int|string $id): ?Model
    {
        return $this->model->find($id);
    }

    public function create(array $data): Model
    {
        return $this->model->create($data);
    }

    public function update(int|string $id, array $data): bool
    {
        return $this->model->where($this->model->getKeyName(), $id)->first()->update($data) > 0;
    }

    public function delete(int|string $id): bool
    {
        return $this->model->where($this->model->getKeyName(), $id)->delete() > 0;
    }

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = $this->model->newQuery();

        foreach ($filters as $field => $value) {
            if ($value === null || in_array($field, ['page', 'per_page'], true)) {
                continue;
            }
            $query->where($field, $value);
        }

        return $query->paginate($perPage);
    }

    /**
     * Get the model instance.
     */
    public function getModel(): Model
    {
        return $this->model;
    }
}
