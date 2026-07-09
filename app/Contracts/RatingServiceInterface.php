<?php

namespace App\Contracts;

use App\Models\User;
use Interfaces\BaseServiceInterface;

interface RatingServiceInterface extends BaseServiceInterface
{
    /**
     * Get ratings for the authenticated user (my ratings).
     *
     * @param User $user
     * @param array $filters [sort, stars]
     * @param int $perPage
     * @return array{user: array, ratings: mixed, summary: array, meta: array}
     */
    public function getMyRatings(User $user, array $filters, int $perPage = 15): array;
}
