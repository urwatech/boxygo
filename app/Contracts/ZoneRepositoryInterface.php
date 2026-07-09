<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Interfaces\BaseRepositoryInterface;

/**
 * Contract for zone repository operations.
 */
interface ZoneRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Paginate zones with optional search and filters.
     */
    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator;

    /**
     * Count all zones.
     */
    public function countAll(): int;

    /**
     * Count zones by status.
     */
    public function countByStatus(string $status): int;

    /**
     * Count zones by hub assignment state.
     */
    public function countAssignedToHub(bool $assigned = true): int;

    /**
     * Count zones assigned to warehouses.
     */
    public function countAssignedToWarehouse(): int;
}
