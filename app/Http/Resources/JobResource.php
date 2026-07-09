<?php

namespace App\Http\Resources;

use App\Enums\ShipmentStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Shipment */
class JobResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tracking_number' => 'SHIP-' . str_pad($this->id, 8, '0', STR_PAD_LEFT),
            'order_number' => $this->order_number,

            // Barcode information
            'barcode_number' => $this->barcode_number,
            'barcode_rider' => $this->whenLoaded(
                'barcodeRider',
                fn() => $this->barcodeRider ? [
                    'id' => $this->barcodeRider->id,
                    'name' => $this->barcodeRider->name,
                    'phone' => $this->barcodeRider->phone,
                ] : null
            ),

            // Shelf assignment (for drop point and warehouse keepers)
            'assigned_shelf' => $this->whenLoaded(
                'shelf',
                fn() => $this->shelf ? [
                    'id' => $this->shelf->id,
                    'code' => $this->shelf->code,
                    'location' => $this->shelf->location,
                ] : null
            ),
            'shelf_assigned_at' => $this->shelf_assigned_at?->toIso8601String(),

            // Delivery information
            'is_diff_city' => $this->is_diff_city,
            'delivery_speed' => $this->delivery_speed,
            'indirect_delivery_mode' => $this->indirect_delivery_mode ?? null,
            'consignment_type' => $this->getLocalizedConsignmentType($request),
            'size' => $this->size,
            'weight' => $this->weight,
            'schedule_time' => $this->schedule_time,

            'reciever_payment_status' => $this->payment_status,
            'receiver_payment_method' => $this->receiver_payment_method,

            // Dimensions (if custom size)
            'dimensions' => [
                'length' => $this->custom_length,
                'width' => $this->custom_width,
                'height' => $this->custom_height,
            ],

            // Pickup location
            'pickup' => [
                'address' => $this->handover_address,
                'latitude' => $this->handover_latitude !== null ? (float) $this->handover_latitude : null,
                'longitude' => $this->handover_longitude !== null ? (float) $this->handover_longitude : null,
                'sender_name' => $this->sender_name,
                'sender_phone' => $this->sender_phone,
                'sender_email' => $this->sender_email,
                'sender_landmark' => $this->sender_landmark,
                'sender_building' => $this->sender_building,
            ],

            // Delivery location (final destination)
            'delivery' => [
                'address' => $this->delivery_address,
                'latitude' => $this->delivery_latitude !== null ? (float) $this->delivery_latitude : null,
                'longitude' => $this->delivery_longitude !== null ? (float) $this->delivery_longitude : null,
                'receiver_name' => $this->receiver_name,
                'receiver_phone' => $this->receiver_phone,
                'receiver_email' => $this->receiver_email,
                'receiver_landmark' => $this->receiver_landmark,
                'receiver_building' => $this->receiver_building,
            ],

            // Dropoff location - where the rider/driver should deliver the parcel next
            // For direct delivery: same as delivery location
            // For indirect delivery: depends on current status (drop point 1, warehouse, drop point 2, or final delivery)
            'dropoff_location' => $this->getDropoffLocation(),

            // Handover user - the person who is supposed to handover the parcel to the current actor
            // Could be drop point keeper, car driver, or warehouse keeper depending on the stage
            'handover_user' => $this->getHandoverUser(),

            // Pickup from - for car drivers to know where to pick up the parcel
            // Values: 'dp1' (drop point 1), 'warehouse', 'dp2' (drop point 2), or null
            'pickup_from' => $this->getPickupFrom(),

            // Payment information
            'payment' => $this->formatPaymentDetails(),
            'service_fee' => $this->service_fee,
            'platform_fee' => $this->platform_fee,
            'vat_amount' => $this->vat_amount,
            'vat_rate' => $this->vat_rate ?? $this->vatRate ?? null,
            'sender_zone_delivery_fee' => $this->sender_zone_delivery_fee !== null ? (float) $this->sender_zone_delivery_fee : null,
            'reciever_zone_delivery_fee' => $this->reciever_zone_delivery_fee !== null ? (float) $this->reciever_zone_delivery_fee : null,
            'payment_transactions' => $this->formatPaymentTransactions(),

            // Status tracking
            'status' => $this->status != ShipmentStatus::INCOMPLETE->value ? $this->formatStatus() : ShipmentStatus::INCOMPLETE->value,
            'raw_status' => $this->status,
            'current_progress_index' => $this->getCurrentProgressIndex(),

            // Barcode details
            'barcode_number' => $this->barcode_number,

            // Additional details
            'insurance' => $this->insurance,
            'accept_returns' => $this->accept_returns,
            'special_instruction' => $this->special_instruction,
            'shipment_type' => $this->booking_type,
            'photos' => $this->photos ?? [],
            'additional_docs' => $this->additional_docs ?? [],

            // Related models
            'customer' => $this->whenLoaded(
                'user',
                fn() => $this->user ? [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'phone' => $this->user->phone,
                ] : null
            ),

            'rider' => $this->whenLoaded(
                'rider',
                fn() => $this->rider ? [
                    'id' => $this->rider->id,
                    'name' => $this->rider->name,
                    'phone' => $this->rider->phone,
                ] : null
            ),

            'review' => $this->whenLoaded(
                'review',
                fn() => $this->review ? [
                    'rating' => $this->review->rating,
                    'comment' => $this->review->comment,
                    'created_at' => $this->review->created_at?->toIso8601String(),
                ] : null
            ),

            // Timestamps
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Return consignment type in Arabic when the shipment customer language is Arabic.
     */
    protected function getLocalizedConsignmentType(Request $request): ?string
    {
        $consignmentType = $this->consignment_type;
        if ($consignmentType === null || $consignmentType === '') {
            return $consignmentType;
        }

        $customerLanguage = null;
        if ($this->relationLoaded('user') && $this->user) {
            $customerLanguage = strtolower((string) $this->user->language);
        } elseif ($request->user()) {
            $customerLanguage = strtolower((string) $request->user()->language);
        }

        if ($customerLanguage !== 'ar') {
            return $consignmentType;
        }

        $translationMap = [
            'documents' => 'createBookingConsignmentDocuments',
            'fragile' => 'createBookingConsignmentFragile',
            'electronics' => 'createBookingConsignmentElectronics',
            'sensitive_electronics' => 'createBookingConsignmentSensitiveElectronics',
            'fragile_materials' => 'createBookingConsignmentFragileMaterials',
            'clothing_textiles_and_shoes' => 'createBookingConsignmentClothingTextilesShoes',
            'household_electrical_appliances' => 'createBookingConsignmentHouseholdElectricalAppliances',
            'furniture' => 'createBookingConsignmentFurniture',
            'dry_sealed_packaged_food_items' => 'createBookingConsignmentDryFoodItems',
            'spare_parts' => 'createBookingConsignmentSpareParts',
            'other_materials_must_be_specified' => 'createBookingConsignmentOtherMaterials',
        ];

        $normalized = strtolower(trim((string) $consignmentType));
        $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized) ?? '';
        $normalized = trim($normalized, '_');

        $translationKey = $translationMap[$normalized] ?? null;
        if (!$translationKey) {
            return $consignmentType;
        }

        $translated = __($translationKey, [], 'ar');
        return $translated === $translationKey ? $consignmentType : $translated;
    }

    /**
     * Get the current progress index based on delivery speed.
     */
    protected function getCurrentProgressIndex(): ?int
    {
        if ($this->delivery_speed === 'direct' && $this->relationLoaded('directStatus')) {
            return $this->directStatus?->current_index;
        }

        if ($this->delivery_speed === 'indirect' && $this->relationLoaded('indirectStatus')) {
            return $this->indirectStatus?->current_index;
        }

        return null;
    }

    /**
     * Get the dropoff location based on delivery speed and current status.
     *
     * For direct delivery: Always the final delivery address.
     * For indirect delivery: Depends on current status in the flow:
     *   - Assigned/Pickup: Drop Point 1 (nearest drop point keeper)
     *   - Arrived at Drop Point 1/Dispatched to Warehouse: Warehouse
     *   - Arrived at Warehouse/Dispatched from Warehouse: Drop Point 2
     *   - Arrived at Drop Point 2/Ready for Pickup/Dispatched from Drop Point 2: Parcel is still at drop point 2
     *   - Pickup from Drop Point 2/In Transit to Customer/Delivered: Final delivery leg
     */
    protected function getDropoffLocation(): ?array
    {
        if ($this->status === ShipmentStatus::INCOMPLETE->value) {
            return $this->getIncompleteDropoffLocation();
        }

        // For direct delivery, dropoff is always the final delivery address
        if ($this->delivery_speed === 'direct') {
            return [
                'type' => 'delivery',
                'label' => 'Delivery Address',
                'address' => $this->delivery_address,
                'latitude' => $this->delivery_latitude !== null ? (float) $this->delivery_latitude : null,
                'longitude' => $this->delivery_longitude !== null ? (float) $this->delivery_longitude : null,
            ];
        }

        // For indirect delivery, determine based on current status
        if ($this->delivery_speed === 'indirect') {
            $currentStatus = $this->getCurrentIndirectStatus();

            // Get dropoff based on stage
            return $this->getIndirectDropoffLocation($currentStatus);
        }

        return null;
    }

    /**
     * Get dropoff location for incomplete (cancelled) shipments based on scanner role.
     */
    protected function getIncompleteDropoffLocation(): ?array
    {
        if ($this->isRequestUserRole(\App\Enums\Role::CAR_DRIVER->value)) {
            // Rider in reverse flow should move parcel back to DP2 side.
            if ($this->delivery_speed === 'indirect') {
                return $this->getDropPoint2DropoffLocation();
            }

            return $this->getSenderDropoffLocation();
        }

        if ($this->isRequestUserRole(\App\Enums\Role::DROP_POINT_KEEPER->value)) {
            return $this->getWarehouseDropoffLocation();
        }

        return $this->getPreviousLocation();
    }

    /**
     * Check whether the authenticated request user has a specific role.
     */
    public static function isRequestUserRole(string $role): bool
    {
        $user = request()->user();
        if (!$user) {
            return false;
        }

        $roleNames = array_map('strtolower', $user->getRoleNames()->toArray());
        // dd($roleNames, $role);
        return in_array(strtolower($role), $roleNames, true);
    }

    /**
     * Get the previous location when a shipment is cancelled.
     */
    protected function getPreviousLocation(): ?array
    {
        if ($this->delivery_speed === 'direct') {
            return $this->getSenderDropoffLocation();
        }

        if ($this->delivery_speed === 'indirect') {
            $previousStatus = $this->getPreviousStatusBeforeCancellation();
            return $this->getIndirectPreviousLocation($previousStatus);
        }

        return null;
    }

    /**
     * Get the workflow status right before cancellation.
     */
    protected function getPreviousStatusBeforeCancellation(): ?string
    {
        if (!empty($this->incomplete_status)) {
            return $this->incomplete_status;
        }

        if ($this->relationLoaded('latestStatusHistory') && $this->latestStatusHistory) {
            if ($this->latestStatusHistory->to_status === ShipmentStatus::CANCELLED->value) {
                return $this->latestStatusHistory->from_status;
            }

            return $this->latestStatusHistory->to_status;
        }

        if ($this->relationLoaded('statusHistory') && $this->statusHistory && $this->statusHistory->count() > 0) {
            $latestHistory = $this->statusHistory->last();

            if (($latestHistory?->to_status ?? null) === ShipmentStatus::CANCELLED->value) {
                return $latestHistory?->from_status;
            }

            return $latestHistory?->to_status;
        }

        return null;
    }

    /**
     * Resolve previous dropoff location for indirect cancelled shipments.
     */
    protected function getIndirectPreviousLocation(?string $previousStatus): array
    {
        $normalize = static function (?string $value): string {
            return strtolower(str_replace([' ', '-'], '_', trim((string) ($value ?? ''))));
        };

        $statusKey = $normalize($previousStatus);

        $rider2Stages = array_map($normalize, [
            ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
            ShipmentStatus::DELIVERED->value,
        ]);

        $dropPoint2Stages = array_map($normalize, [
            ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            ShipmentStatus::READY_FOR_PICKUP->value,
            ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
        ]);

        $warehouseStages = array_map($normalize, [
            ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
        ]);

        if (in_array($statusKey, $rider2Stages, true)) {
            return $this->getDropPoint2DropoffLocation();
        }

        if (in_array($statusKey, $dropPoint2Stages, true)) {
            return $this->getWarehouseDropoffLocation();
        }

        if (in_array($statusKey, $warehouseStages, true)) {
            return $this->getSenderDropoffLocation();
        }

        return $this->getSenderDropoffLocation();
    }

    /**
     * Build sender location payload for dropoff_location.
     */
    protected function getSenderDropoffLocation(): array
    {
        return [
            'type' => 'pickup',
            'label' => 'Sender Address',
            'address' => $this->handover_address ?? 'Pickup Location',
            'latitude' => $this->handover_latitude !== null ? (float) $this->handover_latitude : null,
            'longitude' => $this->handover_longitude !== null ? (float) $this->handover_longitude : null,
        ];
    }

    /**
     * Build drop point 2 location payload for dropoff_location.
     */
    protected function getDropPoint2DropoffLocation(): array
    {
        return [
            'type' => 'drop_point_2',
            'label' => 'Drop Point 2 (Delivery Zone)',
            'address' => $this->delivery_address ?? 'Delivery Location',
            'latitude' => $this->delivery_latitude !== null ? (float) $this->delivery_latitude : null,
            'longitude' => $this->delivery_longitude !== null ? (float) $this->delivery_longitude : null,
        ];
    }

    /**
     * Build warehouse location payload for dropoff_location.
     */
    protected function getWarehouseDropoffLocation(): array
    {
        $warehouse = $this->getWarehouseLocation();

        if (!$warehouse) {
            return $this->getSenderDropoffLocation();
        }

        return [
            'type' => 'warehouse',
            'label' => 'Warehouse',
            'address' => $warehouse['address'] ?? null,
            'latitude' => isset($warehouse['latitude']) && $warehouse['latitude'] !== null ? (float) $warehouse['latitude'] : null,
            'longitude' => isset($warehouse['longitude']) && $warehouse['longitude'] !== null ? (float) $warehouse['longitude'] : null,
        ];
    }

    /**
     * Get the current status for indirect delivery.
     */
    protected function getCurrentIndirectStatus(): ?string
    {
        if ($this->status == ShipmentStatus::INCOMPLETE->value) {
            return $this->status;
        }

        // Try to get from latest status history
        if ($this->relationLoaded('latestStatusHistory') && $this->latestStatusHistory) {
            return $this->latestStatusHistory->to_status;
        }

        if ($this->relationLoaded('statusHistory') && $this->statusHistory && $this->statusHistory->count() > 0) {
            return $this->statusHistory->last()?->to_status;
        }

        return $this->status ?? 'Pending';
    }

    /**
     * Get the dropoff location for indirect delivery based on current status.
     */
    protected function getIndirectDropoffLocation(?string $currentStatus): array
    {
        $normalize = static function (?string $value): string {
            return strtolower(str_replace([' ', '-'], '_', trim((string) ($value ?? ''))));
        };

        $statusKey = $normalize($currentStatus);

        $earlyStages = array_map($normalize, ['Pending', 'Assigned', 'Pickup', 'Picked up', 'In Transit']);
        $dropPoint1Stages = array_map($normalize, [
            'Arrived at Drop Point 1',
            'Delivered to Drop Point 1',
            'Dispatched to Warehouse',
            'Pickup from Drop Point 1',
            'In Transit to Warehouse',
        ]);
        $warehouseStages = array_map($normalize, [
            'Arrived at Warehouse',
            'Dispatched from Warehouse',
            'Pickup from Warehouse',
            'In Transit to Warehouse 2',
            'Arrived at Warehouse 2',
            'Dispatched from Warehouse 2',
            'Pickup from Warehouse 2',
            'In Transit to Drop Point 2',
        ]);
        $dropPoint2Stages = array_map($normalize, [
            'Arrived at Drop Point 2',
            'Ready for Pickup',
            'Dispatched from Drop Point 2',
        ]);
        $finalStages = array_map($normalize, [
            'Pickup from Drop Point 2',
            'In Transit to Customer',
            'Delivered',
            'Picked up by Receiver',
        ]);

        // Early stages: Rider needs to go to Drop Point 1
        // Use pickup location zone for rider assignment
        if (in_array($statusKey, $earlyStages, true)) {
            return [
                'type' => 'drop_point_1',
                'label' => 'Drop Point 1 (Pickup Zone)',
                'address' => $this->handover_address ?? 'Pickup Location',
                'latitude' => $this->handover_latitude !== null ? (float) $this->handover_latitude : null,
                'longitude' => $this->handover_longitude !== null ? (float) $this->handover_longitude : null,
            ];
        }

        // At Drop Point 1: Next destination is Warehouse
        if (in_array($statusKey, $dropPoint1Stages, true)) {
            $warehouse = $this->getWarehouseLocation();
            if ($warehouse) {
                return [
                    'type' => 'warehouse',
                    'label' => 'Warehouse',
                    'address' => $warehouse['address'],
                    'latitude' => isset($warehouse['latitude']) && $warehouse['latitude'] !== null ? (float) $warehouse['latitude'] : null,
                    'longitude' => isset($warehouse['longitude']) && $warehouse['longitude'] !== null ? (float) $warehouse['longitude'] : null,
                ];
            }
        }

        // At Warehouse: Next destination is Drop Point 2
        // Use delivery location zone for car driver assignment
        if (in_array($statusKey, $warehouseStages, true)) {
            return [
                'type' => 'drop_point_2',
                'label' => 'Drop Point 2 (Delivery Zone)',
                'address' => $this->delivery_address ?? 'Delivery Location',
                'latitude' => $this->delivery_latitude !== null ? (float) $this->delivery_latitude : null,
                'longitude' => $this->delivery_longitude !== null ? (float) $this->delivery_longitude : null,
            ];
        }

        // At Drop Point 2: Parcel is waiting to be handled/picked up at DP2
        // Use delivery location zone
        if (in_array($statusKey, $dropPoint2Stages, true)) {
            return [
                'type' => 'drop_point_2',
                'label' => 'Drop Point 2 (Delivery Zone)',
                'address' => $this->delivery_address ?? 'Delivery Location',
                'latitude' => $this->delivery_latitude !== null ? (float) $this->delivery_latitude : null,
                'longitude' => $this->delivery_longitude !== null ? (float) $this->delivery_longitude : null,
            ];
        }

        // Final leg (car driver 3 or receiver pickup): show delivery destination
        if (in_array($statusKey, $finalStages, true)) {
            return [
                'type' => 'delivery',
                'label' => 'Delivery Address',
                'address' => $this->delivery_address,
                'latitude' => $this->delivery_latitude !== null ? (float) $this->delivery_latitude : null,
                'longitude' => $this->delivery_longitude !== null ? (float) $this->delivery_longitude : null,
            ];
        }

        // Default: Return final delivery address
        return [
            'type' => 'delivery',
            'label' => 'Delivery Address',
            'address' => $this->delivery_address,
            'latitude' => $this->delivery_latitude !== null ? (float) $this->delivery_latitude : null,
            'longitude' => $this->delivery_longitude !== null ? (float) $this->delivery_longitude : null,
        ];
    }

    /**
     * Get the nearest drop point keeper based on location type.
     *
     * @param string $locationType 'pickup' for handover location, 'delivery' for delivery location
     */
    protected function getNearestDropPointKeeper(string $locationType): ?array
    {
        // Determine reference coordinates
        if ($locationType === 'pickup') {
            $lat = $this->handover_latitude;
            $lon = $this->handover_longitude;
        } else {
            $lat = $this->delivery_latitude;
            $lon = $this->delivery_longitude;
        }

        if ($lat === null || $lon === null) {
            return null;
        }

        // Find nearest drop point keeper
        $keeper = \App\Models\User::query()
            ->whereHas('roles', function ($q) {
                $q->where('name', \App\Enums\Role::DROP_POINT_KEEPER->value);
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->selectRaw(
                'users.*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) as distance_km',
                [$lat, $lon, $lat]
            )
            ->orderBy('distance_km', 'asc')
            ->first();

        if (!$keeper) {
            return null;
        }

        return [
            'id' => $keeper->id,
            'name' => $keeper->name,
            'address' => $keeper->address,
            'latitude' => $keeper->latitude !== null ? (float) $keeper->latitude : null,
            'longitude' => $keeper->longitude !== null ? (float) $keeper->longitude : null,
            'distance_km' => isset($keeper->distance_km) ? round((float)$keeper->distance_km, 3) : null,
        ];
    }

    /**
     * Get the warehouse location.
     */
    protected function getWarehouseLocation(): ?array
    {
        // Find warehouse keeper or use configured warehouse location
        $warehouse = \App\Models\User::query()
            ->whereHas('roles', function ($q) {
                $q->where('name', \App\Enums\Role::WAREHOUSE_KEEPER->value);
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->first();

        if ($warehouse) {
            return [
                'id' => $warehouse->id,
                'name' => $warehouse->name,
                'address' => $warehouse->address,
                'latitude' => $warehouse->latitude !== null ? (float) $warehouse->latitude : null,
                'longitude' => $warehouse->longitude !== null ? (float) $warehouse->longitude : null,
            ];
        }

        // Fallback: Return null if no warehouse configured
        return null;
    }

    /**
     * Get the handover user - the person who should handover the parcel to the current actor.
     *
     * For indirect delivery flow:
     *   - Rider picking up: Sender (customer)
     *   - Car driver at drop point 1: Drop Point Keeper 1
     *   - Warehouse receiving: Car Driver
     *   - Car driver at warehouse: Warehouse Keeper
     *   - Drop Point 2 receiving: Car Driver
     *   - Receiver picking up: Drop Point Keeper 2
     */
    protected function getHandoverUser(): ?array
    {
        // For direct delivery, no intermediate handover users
        if ($this->delivery_speed === 'direct') {
            return null;
        }

        // For indirect delivery, determine based on current status
        if ($this->delivery_speed === 'indirect') {
            $currentStatus = $this->getCurrentIndirectStatus();
            return $this->getIndirectHandoverUser($currentStatus);
        }

        return null;
    }

    /**
     * Get the handover user for indirect delivery based on current status.
     *
     * Handover logic:
     * 1. For door_to_door and drop_point_to_door modes:
     *    - When status is "Dispatched from Drop Point 2", the car driver who scans becomes the handover_user
     * 2. For door_to_drop_point and drop_point_to_drop_point modes:
     *    - When status is "Arrived at Drop Point 2", the DP keeper who scans becomes the handover_user
     *    - Status then changes to "Ready for Pickup"
     */
    protected function getIndirectHandoverUser(?string $currentStatus): ?array
    {
        $mode = $this->indirect_delivery_mode;

        // Determine if this is a door delivery mode or drop point delivery mode
        $isDoorDelivery = in_array($mode, ['door_to_door', 'drop_point_to_door'], true);
        $isDropPointDelivery = in_array($mode, ['door_to_drop_point', 'drop_point_to_drop_point'], true);

        // For door delivery modes (door_to_door, drop_point_to_door):
        // Return the delivery rider (second rider) as the handover user.
        if ($isDoorDelivery) {
            if (
                $currentStatus == ShipmentStatus::INCOMPLETE->value
                && in_array($this->incomplete_status, [
                    ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
                    ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
                ], true)
            ) {
                $warehouseAssignment = $this->assignments()
                    ->whereIn('stage', [
                        \App\Enums\DeliveryStage::WAREHOUSE->value,
                        \App\Enums\DeliveryStage::WAREHOUSE_2->value,
                    ])
                    ->where('role', \App\Enums\Role::WAREHOUSE_KEEPER->value)
                    ->whereNotNull('started_at')
                    ->with('user')
                    ->orderBy('started_at', 'asc')
                    ->first();

                if ($warehouseAssignment && $warehouseAssignment->user) {
                    $warehouse = $warehouseAssignment->user;
                    return [
                        'id' => $warehouse->id,
                        'name' => $warehouse->name,
                        'role' => 'warehouse_keeper',
                        'label' => 'Warehouse Keeper',
                        'phone' => $warehouse->phone ?? null,
                        'address' => $warehouse->address ?? null,
                        'latitude' => $warehouse->latitude !== null ? (float) $warehouse->latitude : null,
                        'longitude' => $warehouse->longitude !== null ? (float) $warehouse->longitude : null,
                    ];
                }
            }

            $dp2HandoverStatuses = [
                ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
                ShipmentStatus::READY_FOR_PICKUP->value,
                ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
                ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
                ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
                ShipmentStatus::DELIVERED->value,
            ];

            if (in_array($currentStatus, $dp2HandoverStatuses, true) && $this->delivery_rider_id) {
                // Get the delivery rider (second rider) via FINAL_DELIVERY stage assignment
                $deliveryRiderAssignment = $this->assignments()
                    ->where('stage', \App\Enums\DeliveryStage::FINAL_DELIVERY->value)
                    ->where('role', \App\Enums\Role::RIDER->value)
                    ->whereNotNull('started_at')
                    ->with('user')
                    ->latest('started_at')
                    ->first();

                $rider = $deliveryRiderAssignment?->user
                    ?? \App\Models\User::find($this->delivery_rider_id);

                if ($rider) {
                    return [
                        'id' => $rider->id,
                        'name' => $rider->name,
                        'role' => 'rider',
                        'label' => 'Delivery Rider',
                        'phone' => $rider->phone ?? null,
                        'address' => $rider->address ?? null,
                        'latitude' => $rider->latitude !== null ? (float) $rider->latitude : null,
                        'longitude' => $rider->longitude !== null ? (float) $rider->longitude : null,
                    ];
                }
            }
        }

        // For drop point delivery modes (door_to_drop_point, drop_point_to_drop_point):
        // When status is "Arrived at Drop Point 2", the DP keeper who scans becomes the handover_user
        if ($isDropPointDelivery) {
            if (
                $currentStatus == ShipmentStatus::INCOMPLETE->value
                && in_array($this->incomplete_status, [
                    ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
                    ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
                ], true)
            ) {
                $warehouseAssignment = $this->assignments()
                    ->whereIn('stage', [
                        \App\Enums\DeliveryStage::WAREHOUSE->value,
                        \App\Enums\DeliveryStage::WAREHOUSE_2->value,
                    ])
                    ->where('role', \App\Enums\Role::WAREHOUSE_KEEPER->value)
                    ->whereNotNull('started_at')
                    ->with('user')
                    ->orderBy('started_at', 'asc')
                    ->first();

                if ($warehouseAssignment && $warehouseAssignment->user) {
                    $warehouse = $warehouseAssignment->user;
                    return [
                        'id' => $warehouse->id,
                        'name' => $warehouse->name,
                        'role' => 'warehouse_keeper',
                        'label' => 'Warehouse Keeper',
                        'phone' => $warehouse->phone ?? null,
                        'address' => $warehouse->address ?? null,
                        'latitude' => $warehouse->latitude !== null ? (float) $warehouse->latitude : null,
                        'longitude' => $warehouse->longitude !== null ? (float) $warehouse->longitude : null,
                    ];
                }
            }

            $dp2HandoverStatuses = [
                ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
                ShipmentStatus::READY_FOR_PICKUP->value,
                ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
                ShipmentStatus::DELIVERED->value,
            ];

            if (in_array($currentStatus, $dp2HandoverStatuses, true)) {
                // Try to get the actual DP2 keeper who scanned the parcel
                $keeperAssignment = $this->assignments()
                    ->where('stage', \App\Enums\DeliveryStage::SECOND_DROP_POINT->value)
                    ->where('role', \App\Enums\Role::DROP_POINT_KEEPER->value)
                    ->whereNotNull('started_at')
                    ->with('user')
                    ->latest('started_at')
                    ->first();

                if ($keeperAssignment && $keeperAssignment->user) {
                    $keeper = $keeperAssignment->user;
                    return [
                        'id' => $keeper->id,
                        'name' => $keeper->name,
                        'role' => 'drop_point_keeper',
                        'label' => 'Drop Point Keeper',
                        'phone' => $keeper->phone ?? null,
                        'address' => $keeper->address ?? null,
                        'latitude' => $keeper->latitude !== null ? (float) $keeper->latitude : null,
                        'longitude' => $keeper->longitude !== null ? (float) $keeper->longitude : null,
                    ];
                }

                // Fallback: Get the nearest drop point keeper if no assignment found
                $keeper = $this->getNearestDropPointKeeper('delivery');
                if ($keeper) {
                    return [
                        'id' => $keeper['id'],
                        'name' => $keeper['name'],
                        'role' => 'drop_point_keeper',
                        'label' => 'Drop Point Keeper',
                        'phone' => null,
                        'address' => $keeper['address'] ?? null,
                        'latitude' => isset($keeper['latitude']) && $keeper['latitude'] !== null ? (float) $keeper['latitude'] : null,
                        'longitude' => isset($keeper['longitude']) && $keeper['longitude'] !== null ? (float) $keeper['longitude'] : null,
                    ];
                }
            }
        }

        // For all other stages, there's no handover user because:
        // - Drop Point Keepers dispatch (don't hand over)
        // - Warehouse Keepers dispatch (don't hand over)
        // - Car Drivers transport and deliver to locations (not to specific people)
        return null;
    }

    /**
     * Get the pickup location type for car drivers.
     *
     * This tells the car driver where to pick up the parcel:
     *   - 'dp1': Pick up from Drop Point 1 (first leg: DP1 -> Warehouse)
     *   - 'warehouse': Pick up from Warehouse (second leg: Warehouse -> DP2)
     *   - 'dp2': Pick up from Drop Point 2 (if applicable)
     *   - null: Not applicable (for riders or when status doesn't require car driver)
     */
    protected function getPickupFrom(): ?string
    {
        // Only relevant for indirect delivery
        if ($this->delivery_speed !== 'indirect') {
            return null;
        }

        $currentStatus = $this->getCurrentIndirectStatus();

        // Early stages before reaching DP1 - car driver will pick up from DP1
        $earlyStages = ['Pending', 'Assigned', 'Pickup', 'Picked up', 'In Transit', 'Arrived at Drop Point 1', 'Delivered to Drop Point 1'];
        if (in_array($currentStatus, $earlyStages, true)) {
            return 'dp1';
        }

        // First leg: DP1 -> Warehouse
        $firstLegStatuses = [
            'Dispatched to Warehouse',      // Keeper dispatched, driver needs to pick up from DP1
            'Pickup from Drop Point 1',     // Driver picking up from DP1
            'In Transit to Warehouse',      // Driver transporting to warehouse
        ];
        if (in_array($currentStatus, $firstLegStatuses, true)) {
            return 'dp1';
        }

        // At warehouse - parcel arrived and being processed
        if ($currentStatus === 'Arrived at Warehouse') {
            return 'warehouse';
        }

        // Second leg: Warehouse -> DP2
        $secondLegStatuses = [];
        if ($this->is_diff_city) {

            $firstLegStatusess = [
                'In Transit to Warehouse 2',    // Driver transporting to warehouse 2
                'Pickup from Warehouse',        // Driver picking up from warehouse
                'Dispatched from Warehouse',    // Warehouse keeper dispatched, driver needs to pick up from warehouse
                'Pickup from Warehouse',        // Driver picking up from warehouse
            ];

            $secondLegStatusess = [
                'Arrived at Warehouse 2',       // Driver arrived at warehouse 2
                'Dispatched from Warehouse 2',  // Warehouse keeper 2 dispatched
                'Pickup from Warehouse 2',      // Driver picking up from warehouse 2
            ];

            if (in_array($currentStatus, $firstLegStatusess, true)) {
                $secondLegStatuses = [
                    'Pickup from Warehouse',        // Driver picking up from warehouse
                    'Dispatched from Warehouse',    // Warehouse keeper dispatched, driver needs to pick up from warehouse
                    'Pickup from Warehouse',        // Driver picking up from warehouse
                ];
                return 'warehouse';
            } else if (in_array($currentStatus, $secondLegStatusess, true)) {
                return 'warehouse2';
            }
            if (in_array($currentStatus, $secondLegStatuses, true)) {
                return 'warehouse';
            }
        } else {
            $secondLegStatuses = [
                'Dispatched from Warehouse',    // Warehouse keeper dispatched, driver needs to pick up from warehouse
                'Pickup from Warehouse',        // Driver picking up from warehouse
                'In Transit to Drop Point 2',   // Driver transporting to DP2
            ];

            if (in_array($currentStatus, $secondLegStatuses, true)) {
                return 'warehouse';
            }
        }

        // At DP2 stages - parcel is at DP2 awaiting next handoff
        if (in_array($currentStatus, ['Arrived at Drop Point 2', 'Ready for Pickup', 'Dispatched from Drop Point 2'], true)) {
            return 'dp2';
        }

        // Final statuses - parcel has been picked up by receiver or driver is en route/delivered, no pickup location
        if (in_array($currentStatus, ['Picked up by Receiver', 'Pickup from Drop Point 2', 'In Transit to Customer', 'Delivered'], true)) {
            return null;
        }

        // Default for any unhandled indirect status
        return null;
    }

    /**
     * Derive the status based on payment transactions and delivery stage.
     *
     * Status priority (for CASH payments only):
     * 1. 'Completed' - Admin has confirmed collection from collector (admin_settlement.settled_at is set)
     * 2. 'Deposited' - Collector (rider/car driver/drop point keeper) has marked cash as deposited
     * 3. 'Pending Handover' - Collector has collected payment from customer but not deposited yet
     *
     * For ONLINE payments, these statuses are skipped and actual ShipmentStatus enum values are returned.
     *
     * Internal workflow statuses are mapped to user-friendly names:
     * - 'Pickup', 'In Transit', 'Arrived at Drop Point 1', etc. -> 'In Progress'
     * - 'Delivered', 'Picked up by Receiver' -> 'Completed'
     */
    protected function formatStatus(): ?string
    {
        // Only check for payment-related statuses if payment method is 'cash'
        if ($this->payment_method == 'cash' || $this->receiver_payment_method == 'cash') {
            $user = request()->user();
            $userRole = null;
            $showDeposit = true;

            if ($user) {
                $roleNames = $user->getRoleNames()->toArray();
                if (in_array(\App\Enums\Role::RIDER->value, $roleNames)) {
                    $userRole = 'rider';
                } elseif (in_array(\App\Enums\Role::CAR_DRIVER->value, $roleNames)) {
                    $userRole = 'car_driver';
                } elseif (in_array(\App\Enums\Role::DROP_POINT_KEEPER->value, $roleNames)) {
                    $userRole = 'drop_point_keeper';
                } elseif (in_array(\App\Enums\Role::WAREHOUSE_KEEPER->value, $roleNames)) {
                    $userRole = 'warehouse_keeper';
                }
            }

            if ($userRole == 'warehouse_keeper' || $userRole == 'car_driver') {
                $showDeposit = false;
            }

            // Priority 1: Check admin settlement status (admin has confirmed collection from any collector)
            if ($this->relationLoaded('adminSettlement') && $this->adminSettlement?->settled_at) {
                return 'Completed';
            }

            // Priority 2: Check if any collector has marked as deposited (waiting for admin confirmation)
            // Check rider collection
            if ($this->relationLoaded('riderCollection') && $this->riderCollection?->rider_deposited_at && $showDeposit) {
                if ($this->riderCollection->rider_id == $user?->id) {
                    return 'Deposited';
                }
            }

            // Check car driver collection
            if ($this->relationLoaded('carDriverCollection') && $this->carDriverCollection?->rider_deposited_at && $showDeposit) {
                if ($this->carDriverCollection->rider_id == $user?->id) {
                    return 'Deposited';
                }
            }

            // Check drop point keeper collection
            if ($this->relationLoaded('dropPointKeeperCollection') && $this->dropPointKeeperCollection?->rider_deposited_at && $showDeposit) {
                if ($this->dropPointKeeperCollection->rider_id == $user?->id) {
                    return 'Deposited';
                }
            }

            // Priority 3: Check if any collector has collected from customer but not deposited yet
            // Only show "Pending Handover" to the collector who actually collected
            // Others should see "Completed" if someone else collected

            $hasAnyoneCollected = false;

            // Check rider collection
            if ($this->relationLoaded('riderCollection') && $this->riderCollection?->collected_at && $showDeposit) {
                $hasAnyoneCollected = true;
                if ($userRole === 'rider' && $this->riderCollection->rider_id == $user?->id) {
                    return 'Pending Handover';
                }
            }

            // Check car driver collection
            if ($this->relationLoaded('carDriverCollection') && $this->carDriverCollection?->collected_at && $showDeposit) {
                $hasAnyoneCollected = true;
                if ($userRole === 'car_driver' && $this->carDriverCollection->rider_id == $user?->id) {
                    return 'Pending Handover';
                }
            }

            // Check drop point keeper collection
            if ($this->relationLoaded('dropPointKeeperCollection') && $this->dropPointKeeperCollection?->collected_at && $showDeposit) {
                $hasAnyoneCollected = true;
                if ($userRole === 'drop_point_keeper') {
                    return $this->status == ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value ? ShipmentStatus::PENDING->value : 'Pending Handover';
                }
            }

            // If someone else collected but not this user, return "Completed"
            if ($hasAnyoneCollected) {
                if ($this->status == ShipmentStatus::DELIVERED->value || $this->status == 'Pending Handover') {
                    return 'Completed';
                } else {
                    return 'In Progress';
                }
            }
        }

        // Use statusHistory as the only source of truth
        $status = null;

        if ($this->relationLoaded('latestStatusHistory') && $this->latestStatusHistory) {
            $status = $this->latestStatusHistory->to_status;
        } elseif ($this->relationLoaded('statusHistory') && $this->statusHistory && $this->statusHistory->count() > 0) {
            // Get latest from statusHistory collection (ordered by created_at)
            $status = $this->statusHistory->last()?->to_status;
        }

        // If no status history found, return Pending (matching ShipmentStatus enum)
        if (!$status) {
            return 'Pending';
        }

        // Map internal workflow statuses to rider-friendly names
        return $this->mapToRiderFriendlyStatus($status);
    }

    /**
     * Map internal shipment statuses to role-specific friendly status names.
     * This ensures users only see relevant status based on their role and the shipment's current stage.
     */
    protected function mapToRiderFriendlyStatus(string $status): string
    {
        // Normalize status for comparison
        $normalizedStatus = trim($status);

        // Get the authenticated user from the request
        $user = request()->user();

        // If no user in context, return generic mapping
        if (!$user) {
            return $this->getGenericStatusMapping($normalizedStatus);
        }

        // Helper for case-insensitive role checks
        $hasRole = function (string $role) use ($user): bool {
            $names = array_map('strtolower', $user->getRoleNames()->toArray());
            return in_array(strtolower($role), $names, true);
        };

        // Role-specific status mapping
        if ($hasRole(\App\Enums\Role::RIDER->value)) {
            return $this->getRiderStatusMapping($normalizedStatus);
        }

        if ($hasRole(\App\Enums\Role::DROP_POINT_KEEPER->value)) {
            return $this->getDropPointKeeperStatusMapping($normalizedStatus);
        }

        if ($hasRole(\App\Enums\Role::CAR_DRIVER->value)) {
            return $this->getCarDriverStatusMapping($normalizedStatus);
        }

        if ($hasRole(\App\Enums\Role::WAREHOUSE_KEEPER->value)) {
            return $this->getWarehouseKeeperStatusMapping($normalizedStatus);
        }

        // Default: Return generic mapping for admin or unknown roles
        return $this->getGenericStatusMapping($normalizedStatus);
    }

    /**
     * Get status mapping for Rider role.
     * Distinguishes between pickup riders and delivery riders (door_to_door / drop_point_to_door).
     */
    protected function getRiderStatusMapping(string $status): string
    {
        $user = request()->user();

        // If this rider is the delivery rider for this shipment, use delivery-specific mapping
        if ($user && (int) ($this->delivery_rider_id ?? 0) === $user->id) {
            return $this->getDeliveryRiderStatusMapping($status);
        }

        // Pickup rider: completed when parcel is handed off or downstream
        $completedStatuses = [
            'Delivered',
            'Picked up by Receiver',
            'Cancelled',
            'Failed',
            'Returned',
            'Delivered to Drop Point 1',
            'Ready for Pickup',
            'Dispatched from Drop Point 2',
            'Pickup from Drop Point 2',
            'In Transit to Customer',
        ];

        return in_array($status, $completedStatuses, true) ? 'Completed' : 'In Progress';
    }

    /**
     * Get status mapping for delivery rider role (door_to_door / drop_point_to_door).
     * These riders are assigned at Drop Point 2 and deliver to the customer's door.
     */
    protected function getDeliveryRiderStatusMapping(string $status): string
    {
        // Delivery rider's work is done
        $completedStatuses = [
            'Delivered',
            'Cancelled',
            'Failed',
            'Returned',
        ];

        if (in_array($status, $completedStatuses, true)) {
            return 'Completed';
        }

        // Delivery rider has picked up from DP2 and is in transit to customer
        $inProgressStatuses = [
            'Pickup from Drop Point 2',
            'In Transit to Customer',
        ];

        if (in_array($status, $inProgressStatuses, true)) {
            return 'In Progress';
        }

        // Pending: assigned but parcel not yet picked up from DP2
        // (Arrived at Drop Point 2, Ready for Pickup, Dispatched from Drop Point 2)
        return 'Pending';
    }

    /**
     * Get status mapping for Drop Point Keeper role.
     */
    protected function getDropPointKeeperStatusMapping(string $status): string
    {
        // Drop point keeper's completed statuses (their work is done)
        $completedStatuses = [
            'Dispatched to Warehouse',      // Keeper dispatched from DP1
            'Pickup from Drop Point 1',
            'In Transit to Warehouse',
            'Arrived at Warehouse',
            'Dispatched from Warehouse',
            'Pickup from Warehouse',
            'In Transit to Warehouse 2',
            'Arrived at Warehouse 2',
            'Dispatched from Warehouse 2',
            'Pickup from Warehouse 2',
            'In Transit to Drop Point 2',
            'Picked up by Receiver',        // Final handover done
            'Delivered',                    // Keeper handed over to receiver
            'Dispatched from Drop Point 2',
        ];

        if (in_array($status, $completedStatuses, true)) {
            return 'Completed';
        }

        // Drop point keeper's in-progress statuses (need to process)
        $inProgressStatuses = [
            'Assigned',
            'Pickup',
            'Picked up',
            'In Transit',
            'Out for Delivery',
            'Arrived at Drop Point',
            'Arrived at Drop Point 1',      // Keeper needs to process at DP1
            'Delivered to Drop Point 1',
            'Arrived at Drop Point 2',      // Keeper needs to process at DP2
            'Ready for Pickup',             // Keeper marked ready at DP2, waiting for receiver
        ];

        if (in_array($status, $inProgressStatuses, true)) {
            return 'In Progress';
        }

        return $status;
    }

    /**
     * Get status mapping for Car Driver role.
     */
    protected function getCarDriverStatusMapping(string $status): string
    {
        // Car driver's completed statuses (their work is done for their assigned leg)
        $completedStatuses = [
            'Arrived at Warehouse',         // Driver delivered to warehouse (Leg 1 complete)
            'Arrived at Warehouse 2',       // Driver delivered to warehouse 2
            'Arrived at Drop Point 2',      // Driver delivered to DP2 (Leg 2 complete)
            'Delivered',                    // Driver delivered to customer (Leg 3 complete)
            'Dispatched from Warehouse',    // After warehouse keeper dispatches (this driver's job done)
            'Dispatched from Warehouse 2',  // After warehouse keeper 2 dispatches
            'Ready for Pickup',             // After DP2 keeper marks ready
            'Picked up by Receiver',        // Final handover done
            'Dispatched from Drop Point 2', // After DP2 keeper dispatches
        ];

        if (in_array($status, $completedStatuses, true)) {
            return 'Completed';
        }

        // Car driver's in-progress statuses (actively working on their assigned job)
        $inProgressStatuses = [
            'Dispatched to Warehouse',      // Available to pick up from DP1
            'Pickup from Drop Point 1',     // Driver actively picking up from DP1
            'In Transit to Warehouse',      // Driver transporting to warehouse
            'Pickup from Warehouse',        // Driver actively picking up from warehouse
            'In Transit to Warehouse 2',    // Driver transporting to warehouse 2
            'Pickup from Warehouse 2',      // Driver actively picking up from warehouse 2
            'In Transit to Drop Point 2',   // Driver transporting to DP2
            'Pickup from Drop Point 2',     // Driver actively picking up from DP2
            'In Transit to Customer',       // Driver transporting to customer
        ];

        if (in_array($status, $inProgressStatuses, true)) {
            return 'In Progress';
        }

        // Statuses before car driver's involvement
        $notYetRelevantStatuses = [
            'Assigned',
            'Pickup',
            'Picked up',
            'In Transit',
            'Out for Delivery',
            'Arrived at Drop Point',
            'Arrived at Drop Point 1',
            'Delivered to Drop Point 1',
        ];

        if (in_array($status, $notYetRelevantStatuses, true)) {
            return 'In Progress';  // Show as in progress until driver's involvement
        }

        return $status;
    }

    /**
     * Get status mapping for Warehouse Keeper role.
     */
    protected function getWarehouseKeeperStatusMapping(string $status): string
    {
        // Warehouse keeper's completed statuses (their work is done)
        $completedStatuses = [
            'Dispatched from Warehouse',    // Keeper dispatched from warehouse
            'Dispatched from Warehouse 2',  // Keeper dispatched from warehouse 2
            'Pickup from Warehouse',
            'Pickup from Warehouse 2',
            'In Transit to Warehouse 2',
            'Arrived at Warehouse 2',
            'In Transit to Drop Point 2',
            'Arrived at Drop Point 2',
            'Ready for Pickup',
            'Picked up by Receiver',
            'Delivered',
        ];

        if (in_array($status, $completedStatuses, true)) {
            return 'Completed';
        }

        // Warehouse keeper's in-progress statuses (need to process)
        $inProgressStatuses = [
            'Arrived at Warehouse',         // Keeper needs to process at warehouse
            'Arrived at Warehouse 2',       // Keeper needs to process at warehouse 2
        ];

        if (in_array($status, $inProgressStatuses, true)) {
            return 'In Progress';
        }

        // Statuses before warehouse keeper's involvement
        $notYetRelevantStatuses = [
            'Assigned',
            'Pickup',
            'Picked up',
            'In Transit',
            'Out for Delivery',
            'Arrived at Drop Point',
            'Arrived at Drop Point 1',
            'Delivered to Drop Point 1',
            'Dispatched to Warehouse',
            'Pickup from Drop Point 1',
            'In Transit to Warehouse',
        ];

        if (in_array($status, $notYetRelevantStatuses, true)) {
            return 'In Progress';  // Show as pending/in progress
        }

        return $status;
    }

    /**
     * Generic status mapping (for admin or when no user context).
     */
    protected function getGenericStatusMapping(string $status): string
    {
        // Map workflow statuses to "In Progress"
        $inProgressStatuses = [
            'Assigned',
            'Pickup',
            'Picked up',
            'In Transit',
            'Out for Delivery',
            'Arrived at Drop Point',
            'Arrived at Drop Point 1',
            'Dispatched to Warehouse',
            'Pickup from Drop Point 1',
            'In Transit to Warehouse',
            'Arrived at Warehouse',
            'Dispatched from Warehouse',
            'Pickup from Warehouse',
            'In Transit to Warehouse 2',
            'Arrived at Warehouse 2',
            'Dispatched from Warehouse 2',
            'Pickup from Warehouse 2',
            'In Transit to Drop Point 2',
            'Arrived at Drop Point 2',
            'Ready for Pickup',
        ];

        if (in_array($status, $inProgressStatuses, true)) {
            return 'In Progress';
        }

        // Map final delivery statuses to "Completed"
        $completedStatuses = [
            'Delivered',
            'Picked up by Receiver',
        ];

        if (in_array($status, $completedStatuses, true)) {
            return 'Completed';
        }

        // Return the status as-is for other cases (Pending, Cancelled, Failed, Returned)
        return $status;
    }

    /**
     * Calculate VAT amount from financial settings (matches frontend logic).
     */
    protected function calculateVatFromFinancialSettings(float $baseAmount): float
    {
        $deliverySpeed = $this->delivery_speed ?? 'direct';
        $speedKey = strtolower(trim($deliverySpeed)) === 'indirect' ? 'indirect' : 'direct';

        // Get VAT configuration from System table
        $vatTypeKey = "financial_settings.{$speedKey}_vat_type";
        $vatValueKey = "financial_settings.{$speedKey}_vat_value";

        $vatType = \App\Models\System::where('key', $vatTypeKey)->value('value');
        $vatValue = \App\Models\System::where('key', $vatValueKey)->value('value');

        // If financial settings specify percentage type
        if ($vatType && strtolower(trim($vatType)) === 'percentage' && $vatValue !== null) {
            $numericValue = is_numeric($vatValue) ? (float) $vatValue : (float) str_replace('%', '', $vatValue);
            return round($baseAmount * ($numericValue / 100), 2);
        }

        // If fixed amount type
        if ($vatType && strtolower(trim($vatType)) !== 'percentage' && is_numeric($vatValue)) {
            return round((float) $vatValue, 2);
        }

        // Fallback to shipment's vat_rate or default
        $fallbackRate = $this->vat_rate ?? $this->vat_percentage ?? 0.05;
        if (is_numeric($fallbackRate)) {
            $rate = (float) $fallbackRate;
        } else {
            $rateString = (string) $fallbackRate;
            $rate = str_contains($rateString, '%')
                ? (float) str_replace('%', '', $rateString) / 100
                : (float) $rateString;
        }
        if (!is_finite($rate)) {
            $rate = 0.05;
        }

        return round($baseAmount * $rate, 2);
    }

    /**
     * Build a consistent payment structure with breakdown.
     */
    protected function formatPaymentDetails(): array
    {
        $shipmentFee = (float) ($this->total_fee ?? $this->parcel_amount ?? 0);

        $platformFeeRaw = $this->platform_fee
            ?? $this->platform_fee_amount
            ?? config('pricing.platform_fee', 5);
        $platformFee = (float) $platformFeeRaw;

        $goodsAmount = $this->parcel_amount !== null ? (float) $this->parcel_amount : 0.0;
        $serviceFee = $this->service_fee !== null ? (float) $this->service_fee : 0.0;
        $insuranceFee =  $this->insurance_fee !== null ? (float) $this->insurance_fee : 0.0;
        $subtotal = round($shipmentFee + $goodsAmount + $insuranceFee + $serviceFee, 2);
        $taxableSubtotal = round($shipmentFee + $platformFee + $insuranceFee + $serviceFee, 2);

        // Calculate VAT using financial settings (same logic as frontend)
        $vatAmount = $this->vat_amount !== null
            ? (float) $this->vat_amount
            : $this->calculateVatFromFinancialSettings($taxableSubtotal);

        // Calculate VAT rate percentage for display
        $vatRatePercentage = $taxableSubtotal > 0 ? round(($vatAmount / $taxableSubtotal) * 100) : 0;

        $totalDue = round($subtotal + $platformFee + $vatAmount, 2);
        $collectableTotal = $totalDue;

        $formatAmount = static function ($value) {
            if ($value === null) {
                return null;
            }

            return (int) round((float) $value);
        };
        $formatDecimal = static function ($value) {
            if ($value === null) {
                return null;
            }

            return round((float) $value, 2);
        };

        return [
            'method' => $this->payment_method,
            'status' => $this->payment_status,
            'shipment_fee' => $formatAmount($shipmentFee),
            'sender_zone_delivery_fee' => $formatAmount($this->sender_zone_delivery_fee),
            'reciever_zone_delivery_fee' => $formatAmount($this->reciever_zone_delivery_fee),
            'insurance_fee' => $formatAmount($insuranceFee),
            'service_fee' => $formatAmount($serviceFee),
            'platform_fee' => $formatAmount($platformFee),
            'vat_rate' => (int) $vatRatePercentage,
            'vat_amount' => $formatAmount($vatAmount),
            'total_due' => $formatAmount($totalDue),
            'goods_amount' => $formatAmount($goodsAmount),
            'subtotal' => $formatAmount($subtotal),
            'collectable_total' => $formatAmount($collectableTotal),
            'total_fee' => $formatAmount($collectableTotal),
            'parcel_amount' => $this->parcel_amount !== null ? $formatAmount($this->parcel_amount) : null,
            'sender_amount' => $formatDecimal($this->sender_amount),
            'sender_payment_status' => $this->sender_payment_status,
            'reciever_amount' => $formatDecimal($this->reciever_amount),
            'delivery_fee_payer' => $this->delivery_fee_payer,
            'return_delivery_fee_payer' => $this->return_delivery_fee_payer,
        ];
    }

    /**
     * Format payment transaction details including all collector types and admin settlement.
     *
     * Only applicable for cash payments. Online payments don't require collection
     * or admin settlement tracking.
     */
    protected function formatPaymentTransactions(): array
    {
        // Only include collections and admin settlement for cash payments
        if ($this->payment_method !== 'cash') {
            return [
                'rider_collection' => null,
                'car_driver_collection' => null,
                'drop_point_keeper_collection' => null,
                'admin_settlement' => null,
            ];
        }

        // Helper function to format collection data
        $formatCollection = function ($collection) {
            if ($collection) {
                return [
                    'collected' => true,
                    'collected_at' => $collection->collected_at?->toIso8601String(),
                    'rider_deposited_at' => $collection->rider_deposited_at?->toIso8601String(),
                    'amount' => (int) round((float) $collection->amount),
                    'payment_method' => $collection->payment_method,
                    'transaction_type' => $collection->transaction_type,
                    'status' => $collection->status,
                    'notes' => $collection->notes,
                ];
            }

            return [
                'collected' => false,
                'collected_at' => null,
                'rider_deposited_at' => null,
            ];
        };

        // Get rider collection transaction if relationship is loaded
        $riderCollection = $this->relationLoaded('riderCollection')
            ? $formatCollection($this->riderCollection)
            : ['collected' => false, 'collected_at' => null, 'rider_deposited_at' => null];

        // Get car driver collection transaction if relationship is loaded
        $carDriverCollection = $this->relationLoaded('carDriverCollection')
            ? $formatCollection($this->carDriverCollection)
            : ['collected' => false, 'collected_at' => null, 'rider_deposited_at' => null];

        // Get drop point keeper collection transaction if relationship is loaded
        $dropPointKeeperCollection = $this->relationLoaded('dropPointKeeperCollection')
            ? $formatCollection($this->dropPointKeeperCollection)
            : ['collected' => false, 'collected_at' => null, 'rider_deposited_at' => null];

        // Get admin settlement transaction if relationship is loaded
        $adminSettlement = null;
        if ($this->relationLoaded('adminSettlement') && $this->adminSettlement) {
            $collectedByData = null;
            if ($this->adminSettlement->relationLoaded('collectedBy') && $this->adminSettlement->collectedBy) {
                $collectedByData = [
                    'id' => $this->adminSettlement->collectedBy->id,
                    'name' => $this->adminSettlement->collectedBy->name,
                    'email' => $this->adminSettlement->collectedBy->email,
                ];
            }

            $adminSettlement = [
                'settled' => true,
                'settled_at' => $this->adminSettlement->settled_at?->toIso8601String(),
                'amount' => (int) round((float) $this->adminSettlement->amount),
                'payment_method' => $this->adminSettlement->payment_method,
                'transaction_type' => $this->adminSettlement->transaction_type,
                'status' => $this->adminSettlement->status,
                'collected_by' => $collectedByData,
                'notes' => $this->adminSettlement->notes,
            ];
        } else {
            $adminSettlement = [
                'settled' => false,
                'settled_at' => null,
            ];
        }

        return [
            'rider_collection' => $riderCollection,
            'car_driver_collection' => $carDriverCollection,
            'drop_point_keeper_collection' => $dropPointKeeperCollection,
            'admin_settlement' => $adminSettlement,
        ];
    }
}
