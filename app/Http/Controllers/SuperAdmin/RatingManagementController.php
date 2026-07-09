<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\ShipmentReview;
use App\Support\SortHelper;
use Illuminate\Http\Request;
use Illuminate\Http\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class RatingManagementController extends Controller
{
    /**
     * Display a listing of all ratings.
     */
    public function index(Request $request): Response
    {
        $search = $request->input('search', '');
        $stars = $request->input('stars');
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');

        $query = ShipmentReview::with(['reviewer', 'employee', 'shipment'])
            ->when($search, function ($q) use ($search) {
                $q->whereHas('employee', function ($eq) use ($search) {
                    $eq->where('name', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%");
                })->orWhereHas('reviewer', function ($rq) use ($search) {
                    $rq->where('name', 'like', "%{$search}%");
                })->orWhereHas('shipment', function ($sq) use ($search) {
                    $sq->where('order_number', 'like', "%{$search}%");
                });
            })
            ->when($stars, function ($q) use ($stars) {
                $q->where('rating', $stars);
            });

        $this->applyRatingSorting($query, $sortBy, $sortDir);

        $ratings = $query->paginate(20)->withQueryString();

        return Inertia::render('SuperAdmin/RatingManagement/Index', [
            'ratings' => $ratings,
            'filters' => [
                'search' => $search,
                'stars' => $stars,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    /**
     * Export ratings to CSV.
     */
    public function export(Request $request): StreamedResponse
    {
        $search = $request->input('search', '');
        $stars = $request->input('stars');
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');

        $query = ShipmentReview::with(['reviewer', 'employee', 'shipment'])
            ->when($search, function ($q) use ($search) {
                $q->whereHas('employee', function ($eq) use ($search) {
                    $eq->where('name', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%");
                })->orWhereHas('reviewer', function ($rq) use ($search) {
                    $rq->where('name', 'like', "%{$search}%");
                })->orWhereHas('shipment', function ($sq) use ($search) {
                    $sq->where('order_number', 'like', "%{$search}%");
                });
            })
            ->when($stars, function ($q) use ($stars) {
                $q->where('rating', $stars);
            });

        $this->applyRatingSorting($query, $sortBy, $sortDir);

        $headers = [
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Content-type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename=delivery_ratings_'.now()->format('Y-m-d').'.csv',
            'Expires' => '0',
            'Pragma' => 'public',
        ];

        $callback = function () use ($query) {
            $file = fopen('php://output', 'w');

            // Add UTF-8 BOM for Excel
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

            // CSV Headers
            fputcsv($file, [
                'ID',
                'Order Number',
                'Sender',
                'Employee Name',
                'Employee Role',
                'Star Rating',
                'Employee Behavior',
                'On-Time Delivery',
                'Affordability',
                'Comment',
                'Date',
            ]);

            $query->chunk(500, function ($ratings) use ($file) {
                foreach ($ratings as $rating) {
                    fputcsv($file, [
                        $rating->id,
                        $rating->shipment?->order_number ?? 'N/A',
                        $rating->reviewer?->name ?? 'N/A',
                        $rating->employee?->name ?? 'N/A',
                        $rating->employee?->roles->first()?->name ?? 'N/A',
                        $rating->rating,
                        $rating->rider_behavior,
                        $rating->on_time_delivery,
                        $rating->affordability,
                        $rating->comment,
                        $rating->created_at->format('Y-m-d H:i:s'),
                    ]);
                }
            });

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function applyRatingSorting($query, string $sortBy, string $sortDir): void
    {
        $sortKey = SortHelper::key($sortBy);

        if ($sortKey === 'employee') {
            $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = shipment_reviews.employee_id LIMIT 1), '') {$sortDir}");
        } elseif (in_array($sortKey, ['reviewer', 'sender'], true)) {
            $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = shipment_reviews.user_id LIMIT 1), '') {$sortDir}");
        } elseif (in_array($sortKey, ['shipment', 'order_number'], true)) {
            $query->orderByRaw("COALESCE((SELECT order_number FROM shipments WHERE shipments.id = shipment_reviews.shipment_id LIMIT 1), '') {$sortDir}");
        } else {
            $query->orderBy(SortHelper::column($sortBy, [
                'id' => 'shipment_reviews.id',
                'rating' => 'shipment_reviews.rating',
                'stars' => 'shipment_reviews.rating',
                'created_at' => 'shipment_reviews.created_at',
                'updated_at' => 'shipment_reviews.updated_at',
            ], 'shipment_reviews.created_at'), $sortDir);
        }

        $query->orderByDesc('shipment_reviews.id');
    }
}
