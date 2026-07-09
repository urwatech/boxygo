<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Interfaces\BaseRepositoryInterface;

interface RatingRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Get ratings for a specific user.
     */
    public function getRatingsForUser(int $userId, array $filters, int $perPage = 15): LengthAwarePaginator;

    /**
     * Get rating summary stats for a user.
     */
    public function getSummaryStats(?string $rateableType = null, ?int $rateableId = null): array;

    /**
     * Get star distribution for ratings.
     */
    public function getStarDistribution(?string $rateableType = null, ?int $rateableId = null): array;
}
