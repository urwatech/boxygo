<?php

namespace App\Helpers;

use App\Enums\Role;
use App\Models\ShipmentReview;
use App\Models\ShipmentStatusHistory;
use App\Models\User;

class helpers
{
    public static function getShipmentUsers($shipment_id)
    {
        $userIds = ShipmentStatusHistory::where('shipment_id', $shipment_id)
            ->pluck('user_id')
            ->unique();

        $users = User::whereIn('id', $userIds)
            ->whereNull('warehouse_id')
            ->with(['dropPoint', 'roles'])
            ->get()
            ->map(function ($user) use ($shipment_id) {

                if ($user->hasRole(Role::WAREHOUSE_KEEPER->value)) {
                    return null;
                }

                if ($user->drop_point_id && $user->dropPoint) {
                    $user->name = $user->dropPoint->name ?? $user->dropPoint->location;
                }

                $review = ShipmentReview::where('employee_id', $user->id)->where('shipment_id', $shipment_id)->first();

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone_number,
                    'drop_point_id' => $user->drop_point_id,
                    'roles' => $user->roles->pluck('name')->first(),
                    'rating' => isset($review) ? $review->rating : null,
                    'rider_behavior' => isset($review) ? $review->rider_behavior : null,
                    'on_time_delivery' => isset($review) ? $review->on_time_delivery : null,
                    'affordability' => isset($review) ? $review->affordability : null,
                    'comment' => isset($review) ? $review->comment : null,
                ];
            });

        return $users->filter()->values();
    }

    public static function getTrackShipmentId($shipment_id)
    {
        $fallbackId = $shipment_id ?? '';
        return $fallbackId
            ? 'SHIP-' . str_pad((string)$fallbackId, 8, '0', STR_PAD_LEFT)
            : '';
    }
}
