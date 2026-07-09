<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Interfaces\BaseServiceInterface;

/**
 * Contract for zone-related business logic.
 */
interface ZoneServiceInterface extends BaseServiceInterface
{
    /**
     * Paginate zones with optional search and filters.
     */
    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator;

    /**
     * Retrieve dashboard statistics for zones.
     */
    public function getStatistics(): array;

    /**
     * Toggle zone status between active and inactive.
     */
    public function toggleStatus(int|string $zoneId): bool;
}

