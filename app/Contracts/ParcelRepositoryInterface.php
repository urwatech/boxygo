<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Interfaces\BaseRepositoryInterface;

/**
 * Contract describing parcel repository behaviour.
 */
interface ParcelRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Paginate parcel records with optional search and status filters.
     */
    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator;

    /**
     * Count all parcels.
     */
    public function countAll(): int;

    /**
     * Count parcels by status.
     */
    public function countByStatus(string $status): int;
}
