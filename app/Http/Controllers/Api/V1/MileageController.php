<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\RiderMileageLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MileageController extends Controller
{
    /**
     * Get mileage statistics for the authenticated rider/driver
     */
    public function getMyMileage(Request $request): JsonResponse
    {
        $user = $request->user();

        $stats = $user->getMileageStats();

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get detailed mileage logs with pagination and filters
     */
    public function getMileageLogs(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = RiderMileageLog::where('user_id', $user->id)
            ->with('shipment:id,order_number,status')
            ->orderBy('started_at', 'desc');

        // Filter by date range
        if ($request->has('start_date')) {
            $query->where('started_at', '>=', $request->start_date);
        }

        if ($request->has('end_date')) {
            $query->where('ended_at', '<=', $request->end_date);
        }

        // Filter by shipment
        if ($request->has('shipment_id')) {
            $query->where('shipment_id', $request->shipment_id);
        }

        $logs = $query->paginate($request->per_page ?? 20);

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    /**
     * Get mileage summary grouped by date
     */
    public function getDailySummary(Request $request): JsonResponse
    {
        $user = $request->user();

        $startDate = $request->start_date ?? now()->subDays(30)->startOfDay();
        $endDate = $request->end_date ?? now()->endOfDay();

        $summary = RiderMileageLog::where('user_id', $user->id)
            ->whereBetween('started_at', [$startDate, $endDate])
            ->select(
                DB::raw('DATE(started_at) as date'),
                DB::raw('SUM(distance_km) as total_km'),
                DB::raw('SUM(distance_miles) as total_miles'),
                DB::raw('COUNT(*) as trip_count'),
                DB::raw('COUNT(DISTINCT shipment_id) as shipment_count')
            )
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $summary,
        ]);
    }

    /**
     * Get mileage for a specific shipment
     */
    public function getShipmentMileage(Request $request, int $shipmentId): JsonResponse
    {
        $user = $request->user();

        $logs = RiderMileageLog::where('user_id', $user->id)
            ->where('shipment_id', $shipmentId)
            ->orderBy('started_at', 'asc')
            ->get();

        $totalKm = $logs->sum('distance_km');
        $totalMiles = $logs->sum('distance_miles');

        return response()->json([
            'success' => true,
            'data' => [
                'shipment_id' => $shipmentId,
                'total_km' => round($totalKm, 2),
                'total_miles' => round($totalMiles, 2),
                'trip_segments' => $logs,
            ],
        ]);
    }
}
