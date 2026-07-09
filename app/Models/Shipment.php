<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Shipment extends Model
{
    use HasFactory;

    /**
     * Boot the model and add event listeners
     */
    protected static function boot()
    {
        parent::boot();

        // Auto-generate order number when creating a new shipment
        static::creating(function ($shipment) {
            if (empty($shipment->order_number)) {
                $orderNumberService = app(\App\Services\OrderNumberService::class);
                $shipment->order_number = $orderNumberService->generateOrderNumber($shipment->booking_type);
            }
        });
    }

    protected $fillable = [
        'user_id',
        'rider_id',
        'delivery_rider_id',
        'zone_id',
        'shelf_id',
        'order_number',
        'barcode_number',
        'barcode_rider_id',
        'delivery_speed',
        'indirect_delivery_mode',
        'is_diff_city',
        'sender_zone_delivery_fee',
        'reciever_zone_delivery_fee',
        'consignment_type',
        'size',
        'size_id',
        'custom_length',
        'custom_width',
        'custom_height',
        'weight',
        'parcel_amount',
        'service_fee',
        'insurance',
        'insurance_fee',
        'schedule_time',
        'handover_address',
        'receiver_payment_method',
        'handover_latitude',
        'handover_longitude',
        'delivery_address',
        'delivery_latitude',
        'delivery_longitude',
        'sender_name',
        'sender_phone',
        'sender_email',
        'sender_landmark',
        'sender_building',
        'receiver_name',
        'receiver_phone',
        'receiver_email',
        'receiver_landmark',
        'receiver_building',
        'accept_returns',
        'return_window',
        'delivery_fee_payer',
        'return_delivery_fee_payer',
        'is_return_created',
        'return_expire_date',
        'special_instruction',
        'booking_type',
        'sender_amount',
        'componsation_status',
        'componsation_images',
        'componsation_amount',
        'componsation_remarks_sender',
        'componsation_remarks_receiver',
        'componsation_payment',
        'sender_payment_status',
        'reciever_amount',
        'platform_fee',
        'vat_amount',
        'admin_notes',
        'photos',
        'additional_docs',
        'payment_method',
        'payment_status',
        'payment_gateway',
        'payment_invoice_number',
        'payment_guid',
        'payment_operation_number',
        'payment_gateway_response',
        'reciever_payment_gateway',
        'reciever_payment_invoice_number',
        'reciever_payment_guid',
        'reciever_payment_gateway_response',
        'reciever_payment_status',
        'reciever_paid_at',
        'total_fee',
        'status',
        'shelf_assigned_at',
        'return_status',
        'rdf_amount',
        'rdf_payment_status',
        'rdf_paid_at',
        'verification_code',
        'verification_code_verified_at',
        'return_reason',
        'return_images',
        'incomplete_status',
        'incomplete_reason',
        'incomplete_create_by',
        'sender_receive_payment_status',
    ];

    protected $casts = [
        'photos' => 'array',
        'additional_docs' => 'array',
        'accept_returns' => 'boolean',
        'is_diff_city' => 'boolean',
        'return_window' => 'integer',
        'handover_latitude' => 'float',
        'handover_longitude' => 'float',
        'delivery_latitude' => 'float',
        'delivery_longitude' => 'float',
        'parcel_amount' => 'decimal:2',
        'service_fee' => 'decimal:2',
        'insurance_fee' => 'decimal:2',
        'sender_zone_delivery_fee' => 'decimal:2',
        'reciever_zone_delivery_fee' => 'decimal:2',
        'rdf_amount' => 'decimal:2',
        'total_fee' => 'decimal:2',
        'platform_fee' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'collected_at' => 'datetime',
        'shelf_assigned_at' => 'datetime',
        'verification_code_verified_at' => 'datetime',
        'admin_notes' => 'string',
        'return_images' => 'array',
        'payment_gateway_response' => 'array',
        'reciever_payment_gateway_response' => 'array',
        'reciever_paid_at' => 'datetime',
    ];

    /**
     * Get photos with full URLs
     */
    public function getPhotosAttribute($value)
    {
        $photos = json_decode($value, true) ?: [];
        return array_map(function ($photo) {
            // If already a full URL, return as is
            if (filter_var($photo, FILTER_VALIDATE_URL)) {
                return $photo;
            }
            // Convert relative path to full URL
            return asset($photo);
        }, $photos);
    }

    /**
     * Get additional documents with full URLs
     */
    public function getAdditionalDocsAttribute($value)
    {
        $docs = json_decode($value, true) ?: [];
        return array_map(function ($doc) {
            // If already a full URL, return as is
            if (filter_var($doc, FILTER_VALIDATE_URL)) {
                return $doc;
            }
            // Convert relative path to full URL
            return asset($doc);
        }, $docs);
    }

    public function getReturnImagesAttribute($value)
    {
        $images = json_decode($value, true) ?: [];
        return array_map(function ($image) {
            // If already a full URL, return as is
            if (filter_var($image, FILTER_VALIDATE_URL)) {
                return $image;
            }
            // Convert relative path to full URL
            return asset($image);
        }, $images);
    }

    public function requiresReceiverPaymentConfirmation(): bool
    {
        $acceptReturns = (bool) $this->accept_returns;
        $rdfPayer = strtolower((string)($this->return_delivery_fee_payer ?? ''));
        $rdfStatus = strtolower((string)($this->rdf_payment_status ?? 'pending'));

        $rdfRequired = $acceptReturns &&
                       $rdfPayer === 'receiver' &&
                       $rdfStatus !== 'paid';

        $deliveryPayer = strtolower((string)($this->delivery_fee_payer ?? ''));
        $paymentMethod = strtolower((string)($this->payment_method ?? ''));
        $paymentStatus = strtolower((string)($this->payment_status ?? 'pending'));

        $deliveryFeeRequired = $deliveryPayer === 'receiver' &&
                               $paymentMethod === 'online' &&
                               $paymentStatus !== 'paid';

        return $rdfRequired || $deliveryFeeRequired;
    }

    /**
     * Get the user who created this shipment.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the rider assigned to this shipment.
     */
    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    /**
     * Get the delivery rider assigned to this shipment (for door-to-door indirect orders).
     * This rider is responsible for delivering the parcel to the receiver.
     */
    public function deliveryRider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delivery_rider_id');
    }

    /**
     * Get the rider who submitted the barcode for this shipment.
     */
    public function barcodeRider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'barcode_rider_id');
    }

    /**
     * Get the shelf where the shipment is stored.
     */
    public function shelf(): BelongsTo
    {
        return $this->belongsTo(Shelf::class, 'shelf_id');
    }

    /**
     * Get the zone assigned to this shipment.
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function size(): BelongsTo
    {
        return $this->belongsTo(Parcel::class, 'size_id');
    }
    public function directStatus()
    {
        return $this->hasOne(ShipmentStatusDirect::class);
    }

    public function indirectStatus()
    {
        return $this->hasOne(ShipmentStatusIndirect::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(ShipmentReview::class);
    }

    /**
     * Get all assignments for this shipment
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(ShipmentAssignment::class);
    }

    /**
     * Get all status history entries for this shipment
     */
    public function statusHistory(): HasMany
    {
        return $this->hasMany(ShipmentStatusHistory::class);
    }

    /**
     * Get the current active assignment
     */
    public function currentAssignment(): HasOne
    {
        return $this->hasOne(ShipmentAssignment::class)
                    ->whereNotNull('started_at')
                    ->whereNull('completed_at')
                    ->latestOfMany('assigned_at');
    }

    /**
     * Get the latest status history entry
     */
    public function latestStatusHistory(): HasOne
    {
        return $this->hasOne(ShipmentStatusHistory::class)
                    ->latestOfMany('created_at');
    }

    /**
     * Get all assignments ordered by assignment time
     */
    public function assignmentsTimeline(): HasMany
    {
        return $this->hasMany(ShipmentAssignment::class)
                    ->orderBy('assigned_at', 'asc');
    }

    /**
     * Get status history in chronological order
     */
    public function statusTimeline(): HasMany
    {
        return $this->hasMany(ShipmentStatusHistory::class)
                    ->orderBy('created_at', 'asc');
    }

    /**
     * Get all payment transactions for this shipment
     */
    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    /**
     * Get rider collection transaction (when rider collects from customer)
     */
    public function riderCollection(): HasOne
    {
        return $this->hasOne(PaymentTransaction::class)
                    ->where('transaction_type', 'rider_collection')
                    ->latestOfMany();
    }

    /**
     * Get car driver collection transaction (when car driver collects from customer)
     */
    public function carDriverCollection(): HasOne
    {
        return $this->hasOne(PaymentTransaction::class)
                    ->where('transaction_type', 'car_driver_collection')
                    ->latestOfMany();
    }

    /**
     * Get drop point keeper collection transaction (when keeper collects from customer at pickup)
     */
    public function dropPointKeeperCollection(): HasOne
    {
        return $this->hasOne(PaymentTransaction::class)
                    ->where('transaction_type', 'drop_point_keeper_collection')
                    ->latestOfMany();
    }

    /**
     * Get admin settlement transaction (when admin collects from rider/driver/keeper)
     */
    public function adminSettlement(): HasOne
    {
        return $this->hasOne(PaymentTransaction::class)
                    ->where('transaction_type', 'admin_settlement')
                    ->latestOfMany();
    }

    /**
     * Get the complete timeline (assignments + status changes) for display
     */
    public function getCompleteTimeline(): array
    {
        $assignments = $this->assignments()->with(['user', 'assignedBy'])->get();
        $statusHistory = $this->statusHistory()->with('user')->get();

        $timeline = [];

        // Add assignments to timeline
        foreach ($assignments as $assignment) {

            $assignedByName = ($assignment->assigned_by_id && (int)$assignment->assigned_by_id === (int)$assignment->user_id)
                ? 'Self'
                : ($assignment->assignedBy->name ?? 'System');

            $timeline[] = [
                'type' => 'assignment',
                'timestamp' => $assignment->assigned_at,
                'user' => $assignment->user->name ?? 'Unknown',
                'user_id' => $assignment->user_id,
                'role' => $assignment->role,
                'stage' => $assignment->stage,
                'assigned_by' => $assignedByName,
                'status' => $assignment->isCompleted() ? 'completed' : ($assignment->isActive() ? 'active' : 'pending'),
                'started_at' => $assignment->started_at,
                'completed_at' => $assignment->completed_at,
                'notes' => $assignment->notes,
            ];

            // Add a separate event when a user completes their individual delivery part
            // Exclude final delivery stage from individual delivery tracking
            $isFinalDelivery = $assignment->stage === \App\Enums\DeliveryStage::FINAL_DELIVERY->value;
            if ($assignment->completed_at && $assignedByName === 'Self' && !$isFinalDelivery) {
                $timeline[] = [
                    'type' => 'individual_delivery',
                    'timestamp' => $assignment->completed_at,
                    'user' => $assignment->user->name ?? 'Unknown',
                    'user_id' => $assignment->user_id,
                    'role' => $assignment->role,
                    'stage' => $assignment->stage,
                    'duration_minutes' => $assignment->getDurationMinutes(),
                    'notes' => $assignment->notes,
                ];
            }
        }

        // Add status changes to timeline
        foreach ($statusHistory as $history) {
            // Filter out door delivery statuses for drop point delivery modes
            if ($this->delivery_speed === 'indirect' &&
                in_array($this->indirect_delivery_mode, ['door_to_drop_point', 'drop_point_to_drop_point'], true)) {

                // Statuses that should only appear for door delivery modes
                $doorOnlyStatuses = [
                    \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
                    \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
                    \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
                ];

                // Skip door delivery statuses for drop point modes
                if (in_array($history->to_status, $doorOnlyStatuses, true)) {
                    continue;
                }
            }

            // Filter out initial pickup statuses for drop_point_to_* modes
            // Customer brings parcel to drop point, so no rider pickup/transit needed
            if ($this->delivery_speed === 'indirect' &&
                in_array($this->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true)) {

                // Statuses that should only appear for door_to_* modes (rider picks up from sender)
                $pickupOnlyStatuses = [
                    \App\Enums\ShipmentStatus::ASSIGNED->value,
                    \App\Enums\ShipmentStatus::PICKUP->value,
                    \App\Enums\ShipmentStatus::IN_TRANSIT->value,
                    \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
                ];

                // Skip pickup statuses for drop_point_to_* modes
                if (in_array($history->to_status, $pickupOnlyStatuses, true)) {
                    continue;
                }
            }

            $timeline[] = [
                'type' => 'status_change',
                'timestamp' => $history->created_at,
                'user' => $history->user->name ?? 'System',
                'user_id' => $history->user_id,
                'from_status' => $history->from_status,
                'to_status' => $history->to_status,
                'progress_index' => $history->progress_index,
                'location' => $history->hasLocation() ? $history->getLocationCoordinates() : null,
                'location_name' => $history->location_name,
                'notes' => $history->notes,
                'metadata' => $history->metadata,
            ];
        }

        // Sort by timestamp
        usort($timeline, function ($a, $b) {
            return $a['timestamp'] <=> $b['timestamp'];
        });

        return $timeline;
    }

    /**
     * Get active assignments (started but not completed)
     */
    public function activeAssignments(): HasMany
    {
        return $this->hasMany(ShipmentAssignment::class)
                    ->whereNotNull('started_at')
                    ->whereNull('completed_at');
    }

    /**
     * Get pending assignments (not started yet)
     */
    public function pendingAssignments(): HasMany
    {
        return $this->hasMany(ShipmentAssignment::class)
                    ->whereNull('started_at');
    }

    /**
     * Get completed assignments
     */
    public function completedAssignments(): HasMany
    {
        return $this->hasMany(ShipmentAssignment::class)
                    ->whereNotNull('completed_at');
    }

    /**
     * Scope to filter shipments by zone
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param int|array $zoneId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeInZone($query, $zoneId)
    {
        if (is_array($zoneId)) {
            return $query->whereIn('zone_id', $zoneId);
        }
        return $query->where('zone_id', $zoneId);
    }

    /**
     * Scope to filter shipments accessible by a user based on their zone
     * For web platform employees (Admin Portal), filter by their assigned zone
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param \App\Models\User $user
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForUser($query, User $user)
    {
        // Superadmins and customers see all shipments (no zone restriction)
        if ($user->hasRole('superadmin') || $user->hasRole('customer')) {
            return $query;
        }

        // If user has a zone_id and is on Admin Portal, filter by zone
        if ($user->platform === 'Admin Portal') {
            $zoneIds = $user->getAssignedZoneIds();
            if (!empty($zoneIds)) {
                return $query->whereIn('zone_id', $zoneIds);
            }
        }

        // Mobile App users see shipments they're assigned to (existing behavior)
        if ($user->platform === 'Mobile App') {
            return $query->where('rider_id', $user->id);
        }

        return $query;
    }

    /**
     * Scope to filter shipments by multiple zones
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param array $zoneIds
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeInZones($query, array $zoneIds)
    {
        return $query->whereIn('zone_id', $zoneIds);
    }
}
