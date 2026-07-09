<?php

namespace App\Http\Controllers\Customer;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Shipment;
use App\Models\ShipmentReview;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Services\MtnSmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function store(Request $request, Shipment $shipment): JsonResponse
    {
        $user = $request->user();

        if (! $user || (int) $shipment->user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => __('unauthorized')], 403);
        }

        $smsService = app(MtnSmsService::class);

        $data = $request->validate([
            'ratings' => 'required|array|min:1',
            'ratings.*.id' => 'required|integer',
            'ratings.*.roles' => 'required|string',
            'ratings.*.rating' => 'required',
            'ratings.*.rider_behavior' => 'nullable',
            'ratings.*.on_time_delivery' => 'nullable',
            'ratings.*.affordability' => 'nullable',
            'ratings.*.comment' => 'nullable|string|max:2000',
            'ratings.*.drop_point_id' => 'required_if:ratings.*.user_type,'.Role::DROP_POINT_KEEPER->value.'|nullable|integer',
        ]);

        $reviews = [];

        foreach ($data['ratings'] as $ratingData) {

            $review = ShipmentReview::updateOrCreate(
                [
                    'shipment_id' => $shipment->id,
                    'user_id' => $user->id,
                    'employee_id' => $ratingData['id'],
                ],
                [
                    'user_type' => $ratingData['roles'] ?? null,
                    'rider_behavior' => $ratingData['rider_behavior'],
                    'on_time_delivery' => $ratingData['on_time_delivery'],
                    'affordability' => $ratingData['affordability'],
                    'comment' => $ratingData['comment'] ?? null,
                    'rating' => $ratingData['rating'] ?? 0,
                    'drop_point_id' => $ratingData['drop_point_id'],
                ]
            );

            $employee = User::find($ratingData['id']);
            $locale = strtolower((string) ($employee->language ?? 'en')) === 'ar' ? 'ar' : 'en';

            // SMS to employee
            if ($shipment->receiver_phone) {
                $smsService->sendLocalized($shipment->receiver_phone, 'smsNewRatingEmployee', [
                    'rating' => $ratingData['rating'] ?? 0,
                    'sender_name' => $shipment->sender_name ?? '',
                ], $locale);
            }

            if ($employee) {
                $employee->notify(new GenericNotification(
                    shipmentId: $shipment->id,
                    trackingNumber: $shipment->order_number ?? '-',
                    title: 'dbTitleShipmentRatingEmployee',
                    description: 'dbBodyShipmentRatingEmployee',
                    type: 'shipment',
                    icon: 'payment',
                    extraDataDescription: [
                        'rating' => $ratingData['rating'] ?? 0,
                        'sender_name' => $shipment->sender_name ?? '',
                    ]
                ));
            }

            $reviews[] = $review;
        }

        return response()->json([
            'ok' => true,
            'reviews' => $reviews,
        ]);
    }

    /**
     * Get all employees involved in a shipment who can be rated.
     */
    public function getRateableActors(Shipment $shipment): JsonResponse
    {
        $actors = $shipment->assignments()
            ->with('user.roles')
            ->get()
            ->map(fn ($assignment) => $assignment->user)
            ->unique('id');

        return response()->json([
            'ok' => true,
            'actors' => UserResource::collection($actors),
        ]);
    }
}
