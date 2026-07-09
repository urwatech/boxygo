<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Vehicle */
class VehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'type' => $this->type,
            'make' => $this->make,
            'model' => $this->model,
            'color' => $this->color,
            'license_plate' => $this->license_plate,
            'status' => $this->status,
            'permit_expires_at' => $this->permit_expires_at?->toDateString(),
            'insurance_expires_at' => $this->insurance_expires_at?->toDateString(),
            'photo_url' => media_url($this->photo_path),
            'assigned_rider' => $this->whenLoaded(
                'user',
                fn () => $this->user ? [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'email' => $this->user->email,
                ] : null
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
