<?php

namespace App\Repositories;

use App\Contracts\RatingRepositoryInterface;
use App\Models\ShipmentReview;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class RatingRepository extends AbstractRepository implements RatingRepositoryInterface
{
    public function __construct(ShipmentReview $model)
    {
        parent::__construct($model);
    }

    /**
     * Get ratings for a specific user.
     */
    public function getRatingsForUser(int $userId, array $filters, int $perPage = 15): LengthAwarePaginator
    {
        $query = $this->model->newQuery()
            ->with(['reviewer'])
            ->where('employee_id', $userId);

        // Filter by star rating
        if (!empty($filters['stars'])) {
            $query->where('rating', (int) $filters['stars']);
        }

        // Sort order
        $sort = $filters['sort'] ?? 'newest';
        if ($sort === 'oldest') {
            $query->orderBy('created_at', 'asc');
        } else {
            $query->orderBy('created_at', 'desc');
        }

        return $query->paginate($perPage);
    }

    /**
     * Get rating summary stats.
     */
    public function getSummaryStats(?string $rateableType = null, ?int $rateableId = null): array
    {
        $query = $this->model->newQuery();

        if ($rateableId) {
            $query->where('employee_id', $rateableId);
        }

        $totalCount = $query->count();
        $averageRating = $query->avg('rating');

        return [
            'average_rating' => $averageRating ? round($averageRating, 1) : 0,
            'total_ratings' => $totalCount,
        ];
    }

    /**
     * Get star distribution for ratings.
     */
    public function getStarDistribution(?string $rateableType = null, ?int $rateableId = null): array
    {
        $query = $this->model->newQuery();

        if ($rateableId) {
            $query->where('employee_id', $rateableId);
        }

        $distribution = [];
        for ($i = 5; $i >= 1; $i--) {
            $distribution[$i] = (clone $query)->where('rating', $i)->count();
        }

        return $distribution;
    }
}
