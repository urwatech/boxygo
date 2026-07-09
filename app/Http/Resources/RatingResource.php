<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ShipmentReview */
class RatingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'rider_behavior' => $this->rider_behavior,
            'on_time_delivery' => $this->on_time_delivery,
            'affordability' => $this->affordability,
            'comment' => $this->comment,
            'rateable_type' => $this->rateable_type,
            'rateable' => $this->when($this->employee, function () {
                return [
                    'id' => $this->employee->id,
                    'name' => $this->employee->name,
                    'avatar_url' => media_url($this->employee->avatar_path),
                    'role' => $this->employee->roles->first()?->name,
                ];
            }),
            'reviewer' => $this->when($this->relationLoaded('reviewer') && $this->reviewer, function () {
                return [
                    'id' => $this->reviewer->id,
                    'name' => $this->reviewer->name,
                    'avatar_url' => media_url($this->reviewer->avatar_path),
                ];
            }),
            'shipment_id' => $this->shipment_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
