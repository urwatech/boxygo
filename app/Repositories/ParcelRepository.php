<?php

namespace App\Repositories;

use App\Contracts\ParcelRepositoryInterface;
use App\Models\Parcel;
use App\Support\SortHelper;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Repository responsible for parcel persistence and queries.
 */
class ParcelRepository extends AbstractRepository implements ParcelRepositoryInterface
{
    public function __construct(Parcel $model)
    {
        parent::__construct($model);
    }

    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        $query = $this->model->newQuery();

        if ($search) {
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query
            ->orderBy(SortHelper::column((string) ($filters['sort_by'] ?? ''), [
                'id' => 'id',
                'name' => 'name',
                'description' => 'description',
                'length_cm' => 'length_cm',
                'width_cm' => 'width_cm',
                'height_cm' => 'height_cm',
                'min_weight_kg' => 'min_weight_kg',
                'max_weight_kg' => 'max_weight_kg',
                'status' => 'status',
                'created_at' => 'created_at',
                'updated_at' => 'updated_at',
            ], 'created_at'), SortHelper::direction((string) ($filters['sort_dir'] ?? ''), 'desc'))
            ->orderByDesc('id')
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
}
