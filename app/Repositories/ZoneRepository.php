<?php

namespace App\Repositories;

use App\Contracts\ZoneRepositoryInterface;
use App\Models\Zone;
use App\Support\SortHelper;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Repository for zone persistence and query operations.
 */
class ZoneRepository extends AbstractRepository implements ZoneRepositoryInterface
{
    public function __construct(Zone $model)
    {
        parent::__construct($model);
    }

    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        $query = $this->model->newQuery()->notDeleted();

        if ($search) {
            $query->where(function ($builder) use ($search) {
                $builder->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['city'])) {
            $query->where('city', $filters['city']);
        }

        if (array_key_exists('is_assigned_to_hub', $filters) && $filters['is_assigned_to_hub'] !== null) {
            $query->where('is_assigned_to_hub', (bool) $filters['is_assigned_to_hub']);
        }

        $this->applyZoneSorting($query, $filters);

        return $query
            ->paginate($perPage)
            ->withQueryString();
    }

    public function getWithFilters(?string $search = null, array $filters = [])
    {
        $query = $this->model->newQuery()->notDeleted();

        if ($search) {
            $query->where(function ($builder) use ($search) {
                $builder->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['city'])) {
            $query->where('city', $filters['city']);
        }

        if (array_key_exists('is_assigned_to_hub', $filters) && $filters['is_assigned_to_hub'] !== null) {
            $query->where('is_assigned_to_hub', (bool) $filters['is_assigned_to_hub']);
        }

        $this->applyZoneSorting($query, $filters);

        return $query->get();
    }

    private function applyZoneSorting($query, array $filters): void
    {
        $query->orderBy(SortHelper::column((string) ($filters['sort_by'] ?? ''), [
            'id' => 'id',
            'code' => 'code',
            'name' => 'name',
            'city' => 'city',
            'sub_district' => 'sub_district_name',
            'sub_district_name' => 'sub_district_name',
            'status' => 'status',
            'assigned_hub' => 'assigned_hub_name',
            'assigned_hub_name' => 'assigned_hub_name',
            'is_assigned_to_hub' => 'is_assigned_to_hub',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ], 'created_at'), SortHelper::direction((string) ($filters['sort_dir'] ?? ''), 'desc'));

        $query->orderByDesc('id');
    }

    public function countAll(): int
    {
        return $this->model->newQuery()->notDeleted()->count();
    }

    public function countByStatus(string $status): int
    {
        return $this->model->newQuery()
            ->notDeleted()
            ->where('status', $status)
            ->count();
    }

    public function countAssignedToHub(bool $assigned = true): int
    {
        return $this->model->newQuery()
            ->notDeleted()
            ->where('is_assigned_to_hub', $assigned)
            ->count();
    }

    public function countAssignedToWarehouse(): int
    {
        return $this->model->newQuery()
            ->notDeleted()
            ->whereHas('warehouses')
            ->count();
    }

    public function find(int|string $id): ?\Illuminate\Database\Eloquent\Model
    {
        return $this->model->newQuery()
            ->notDeleted()
            ->whereKey($id)
            ->first();
    }

    public function all(): \Illuminate\Support\Collection
    {
        return $this->model->newQuery()
            ->notDeleted()
            ->get();
    }

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = $this->model->newQuery()->notDeleted();

        foreach ($filters as $field => $value) {
            if ($value === null || in_array($field, ['page', 'per_page'], true)) {
                continue;
            }
            $query->where($field, $value);
        }

        return $query->paginate($perPage);
    }

    public function delete(int|string $id): bool
    {
        $zone = $this->model->newQuery()->whereKey($id)->first();

        if (! $zone) {
            return false;
        }

        return (bool) $zone->update([
            'is_deleted' => true,
        ]);
    }
}
