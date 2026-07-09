<?php

namespace App\Repositories;

use App\Contracts\VehicleRepositoryInterface;
use App\Models\Vehicle;
use App\Support\SortHelper;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class VehicleRepository extends AbstractRepository implements VehicleRepositoryInterface
{
    public function __construct(Vehicle $model)
    {
        parent::__construct($model);
    }

    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        $query = $this->model->newQuery()->with('user');

        if ($search) {
            $query->where(function ($builder) use ($search) {
                $builder->where('code', 'like', "%{$search}%")
                    ->orWhere('license_plate', 'like', "%{$search}%")
                    ->orWhere('type', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($relation) use ($search) {
                        $relation->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if (! empty($filters['status']) && $filters['status'] !== 'All') {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        $sortBy = (string) ($filters['sort_by'] ?? '');
        $sortDir = SortHelper::direction((string) ($filters['sort_dir'] ?? ''), 'desc');

        if (in_array(SortHelper::key($sortBy), ['rider', 'assigned_rider', 'user'], true)) {
            $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = vehicles.user_id LIMIT 1), '') {$sortDir}");
        } else {
            $query->orderBy(SortHelper::column($sortBy, [
                'id' => 'vehicles.id',
                'code' => 'vehicles.code',
                'type' => 'vehicles.type',
                'license_plate' => 'vehicles.license_plate',
                'model' => 'vehicles.model',
                'model_year' => 'vehicles.model_year',
                'color' => 'vehicles.color',
                'permit_expires_at' => 'vehicles.permit_expires_at',
                'insurance_expires_at' => 'vehicles.insurance_expires_at',
                'status' => 'vehicles.status',
                'created_at' => 'vehicles.created_at',
                'updated_at' => 'vehicles.updated_at',
            ], 'vehicles.created_at'), $sortDir);
        }

        return $query
            ->orderByDesc('vehicles.id')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function countAll(): int
    {
        return $this->model->newQuery()->count();
    }

    public function countByStatus(string $status): int
    {
        return $this->model->newQuery()->where('status', $status)->count();
    }

    public function countAssigned(bool $assigned = true): int
    {
        return $this->model->newQuery()
            ->when(
                $assigned,
                fn ($query) => $query->whereNotNull('user_id'),
                fn ($query) => $query->whereNull('user_id')
            )
            ->count();
    }

    public function distinctTypes(): array
    {
        return $this->model->newQuery()->distinct()->pluck('type')->filter()->values()->all();
    }

    public function countByType(string $type): int
    {
        return $this->model->newQuery()->where('type', $type)->count();
    }
}
