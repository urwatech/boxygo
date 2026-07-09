<?php

namespace App\Repositories;

use App\Contracts\ShelfRepositoryInterface;
use App\Enums\Role;
use App\Models\Shelf;
use App\Models\User;
use Illuminate\Support\Collection;

class ShelfRepository extends AbstractRepository implements ShelfRepositoryInterface
{
    public function __construct(Shelf $model)
    {
        parent::__construct($model);
    }

    public function getAvailableShelves(?string $location = null, ?User $user = null): Collection
    {
        $query = $this->model->newQuery()
            ->where('is_active', true)
            // ->whereColumn('occupied_slots', '<', 'capacity')
            ->orderBy('code');

        if ($location !== null) {
            $query->where('location', $location);
        }

        if ($user) {
            if ($user->hasRole(Role::DROP_POINT_KEEPER->value)) {
                if ($user->drop_point_id) {
                    $query->where('drop_point_id', $user->drop_point_id);
                } else {
                    $query->whereRaw('1 = 0');
                }
            } elseif ($user->hasRole(Role::WAREHOUSE_KEEPER->value)) {
                if ($user->warehouse_id) {
                    $query->where('warehouse_id', $user->warehouse_id);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }
        }

        return $query->get();
    }

    public function lockForUpdate(int $shelfId): ?Shelf
    {
        return $this->model->newQuery()
            ->whereKey($shelfId)
            ->lockForUpdate()
            ->first();
    }

    public function incrementOccupiedSlots(int $shelfId): void
    {
        $this->model->newQuery()
            ->whereKey($shelfId)
            ->increment('occupied_slots');
    }

    public function decrementOccupiedSlots(int $shelfId): void
    {
        $this->model->newQuery()
            ->whereKey($shelfId)
            ->where('occupied_slots', '>', 0)
            ->decrement('occupied_slots');
    }
}
