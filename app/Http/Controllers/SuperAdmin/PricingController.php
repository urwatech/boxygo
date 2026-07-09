<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PricingController extends Controller
{
    public function __construct(
        private readonly PricingService $pricingService
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        if (! $user || (! $user->can('pricing.view') && ! $user->can('pricing.manage'))) {
            abort(401);
        }

        $search = $request->input('search', '');
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));

        // $pricingMatrix = $this->pricingService->getPricingMatrix($search);
        // $cities = $this->pricingService->getCities();

        $zonePrices = $this->pricingService->getAllZonesPrices($search, $sortBy, $sortDir);

        return Inertia::render('SuperAdmin/PricingManagement/Index', [
            // 'pricingMatrix' => $pricingMatrix,
            'zonePrices' => $zonePrices,
            // 'cities' => $cities,
            'filters' => [
                'search' => $search,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    public function export(Request $request)
    {
        $user = $request->user();

        if (! $user || (! $user->can('pricing.view') && ! $user->can('pricing.manage'))) {
            abort(401);
        }

        $search = $request->input('search', '');

        $pricingMatrix = $this->pricingService->getAllPricingMatrix($search);
        $cities = $this->pricingService->getCities();

        return response()->json([
            'data' => $pricingMatrix,
            'cities' => $cities,
        ]);
    }
}
