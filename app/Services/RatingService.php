<?php

namespace App\Services;

use App\Contracts\RatingServiceInterface;
use App\Enums\Role;
use App\Http\Resources\RatingResource;
use App\Models\User;
use App\Repositories\RatingRepository;

class RatingService extends AbstractService implements RatingServiceInterface
{
    protected RatingRepository $ratingRepository;

    public function __construct(RatingRepository $repository)
    {
        parent::__construct($repository);
        $this->ratingRepository = $repository;
    }

    /**
     * Get ratings for the authenticated user (my ratings).
     */
    public function getMyRatings(User $user, array $filters, int $perPage = 15): array
    {
        $rateableType = $this->getRateableTypeForUser($user);

        $ratings = $this->ratingRepository->getRatingsForUser($user->id, $filters, $perPage);

        $summary = $this->ratingRepository->getSummaryStats(null, $user->id);
        $starDistribution = $this->ratingRepository->getStarDistribution(null, $user->id);

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'avatar_url' => media_url($user->avatar_path),
                'role' => $user->roles->first()?->name,
                'rateable_type' => $rateableType,
            ],
            'summary' => array_merge($summary, ['star_distribution' => $starDistribution]),
            'ratings' => RatingResource::collection($ratings->items()),
            'meta' => [
                'current_page' => $ratings->currentPage(),
                'last_page' => $ratings->lastPage(),
                'per_page' => $ratings->perPage(),
                'total' => $ratings->total(),
            ],
        ];
    }

    /**
     * Get rateable type string for a user based on their role.
     */
    private function getRateableTypeForUser(User $user): string
    {
        if ($user->hasRole(Role::CAR_DRIVER->value)) {
            return 'car_driver';
        }

        if ($user->hasRole(Role::DROP_POINT_KEEPER->value)) {
            return 'drop_point';
        }

        return 'rider';
    }
}
