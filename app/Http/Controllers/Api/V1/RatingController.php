<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Services\RatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RatingController extends Controller
{
    public function __construct(private readonly RatingService $ratingService) {}

    /**
     * Get ratings for the authenticated user (my ratings).
     *
     * Query params:
     * - sort: 'newest' (default), 'oldest'
     * - stars: 1-5 (filter by star rating)
     * - per_page: pagination limit (default 15)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $filters = [
            'sort' => $request->query('sort', 'newest'),
            'stars' => $request->query('stars'),
        ];

        $perPage = min((int) $request->query('per_page', 15), 100);

        $result = $this->ratingService->getMyRatings($user, $filters, $perPage);

        return ApiResponse::success($result);
    }
}
