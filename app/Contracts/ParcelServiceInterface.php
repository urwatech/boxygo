<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Interfaces\BaseServiceInterface;

/**
 * Contract describing parcel service behaviour.
 */
interface ParcelServiceInterface extends BaseServiceInterface
{
    /**
     * Paginate parcel records with optional search and status filters.
     */
    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator;

    /**
     * Retrieve parcel statistics for dashboard cards.
     */
    public function getStatistics(): array;
}
