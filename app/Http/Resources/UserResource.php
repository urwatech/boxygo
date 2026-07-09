<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'address' => $this->address,
            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
            'status' => $this->status,
            'employee_id' => $this->employee_id,
            'user_type' => $this->roles->first()?->name, // Get role name as user_type
            'governorate' => $this->governorate,
            'dob' => $this->dob?->toDateString(),
            'gender' => $this->gender,
            'avatar_url' => media_url($this->avatar_path),
            'language' => $this->language,
            'blood_group' => $this->blood_type,
            'emergency_contact' => $this->emergency_phone_number,

            // Rider-specific fields
            'shipment_type' => $this->shipment_type,
            'employment_type' => $this->employment_type,
            'license_expiry' => $this->license_expiry?->toDateString(),
            'completed_jobs' => $this->completed_jobs,
            'cancel_rate' => $this->cancel_rate ? (float) $this->cancel_rate : null,
            'avg_eta_minutes' => $this->avg_eta_minutes,
            'cod_collection_limit' => $this->cod_collection_limit ? (float) $this->cod_collection_limit : null,
            'working_hours' => $this->working_hours,

            // Notification preferences
            'email_notifications' => $this->email_notifications,
            'push_notifications' => $this->push_notifications,
            'availability' => $this->availability,

            // Verification status
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'phone_verified_at' => $this->phone_verified_at?->toIso8601String(),

            // Permissions
            'permissions' => $this->getAllPermissions()->pluck('name')->toArray(),
            'roles' => $this->roles->pluck('name')->toArray(),

            // Timestamps
            'member_since' => $this->member_since?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),

            // Uploaded documents
            'documents' => [
                'driving_license' => [
                    'uploaded' => !empty($this->driving_license),
                    'url' => media_url($this->driving_license),
                    'filename' => $this->driving_license ? basename($this->driving_license) : null,
                ],
                'id_card_front' => [
                    'uploaded' => !empty($this->id_card_front),
                    'url' => media_url($this->id_card_front),
                    'filename' => $this->id_card_front ? basename($this->id_card_front) : null,
                ],
                'id_card_back' => [
                    'uploaded' => !empty($this->id_card_back),
                    'url' => media_url($this->id_card_back),
                    'filename' => $this->id_card_back ? basename($this->id_card_back) : null,
                ],
                'passport' => [
                    'uploaded' => !empty($this->passport),
                    'url' => media_url($this->passport),
                    'filename' => $this->passport ? basename($this->passport) : null,
                ],
                'idp' => [
                    'uploaded' => !empty($this->idp),
                    'url' => media_url($this->idp),
                    'filename' => $this->idp ? basename($this->idp) : null,
                ],
            ],

            // Mileage statistics (for riders, drivers, drop point keepers)
            'mileage' => $this->when(
                in_array($this->roles->first()?->name, ['rider', 'car_driver', 'drop_point_keeper']),
                function () {
                    $stats = $this->getMileageStats();
                    return [
                        'total_km' => $stats['total_km'],
                        'total_miles' => $stats['total_miles'],
                        'today_km' => $stats['today_km'],
                        'today_miles' => $stats['today_miles'],
                        'this_week_km' => $stats['this_week_km'],
                        'this_week_miles' => $stats['this_week_miles'],
                        'this_month_km' => $stats['this_month_km'],
                        'this_month_miles' => $stats['this_month_miles'],
                    ];
                }
            ),

            // Warehouse info (for warehouse keepers)
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => $this->when(
                $this->warehouse_id && $this->relationLoaded('warehouse') && $this->warehouse,
                fn () => [
                    'id' => $this->warehouse?->id,
                    'name' => $this->warehouse?->name,
                    'code' => $this->warehouse?->code,
                ]
            ),
            'drop_point_id' => $this->drop_point_id,
            'drop_point' => $this->when(
                $this->drop_point_id && $this->relationLoaded('dropPoint') && $this->dropPoint,
                fn () => [
                    'id' => $this->dropPoint?->id,
                    'name' => $this->dropPoint?->name,
                ]
            ),
        ];
    }
}
