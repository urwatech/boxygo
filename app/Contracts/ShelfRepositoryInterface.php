<?php

namespace App\Contracts;

use App\Models\Shelf;
use Illuminate\Support\Collection;
use Interfaces\BaseRepositoryInterface;

interface ShelfRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Retrieve shelves that still have available capacity.
     */
    public function getAvailableShelves(?string $location = null, ?\App\Models\User $user = null): Collection;

    /**
     * Retrieve a shelf for update operations with a database lock.
     */
    public function lockForUpdate(int $shelfId): ?Shelf;

    /**
     * Increment the occupied slot count for a shelf.
     */
    public function incrementOccupiedSlots(int $shelfId): void;

    /**
     * Decrement the occupied slot count for a shelf if possible.
     */
    public function decrementOccupiedSlots(int $shelfId): void;
}
