<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\ShipmentStatus;
use App\Models\RiderMileageLog;
use App\Models\Shipment;
use App\Models\ShipmentAssignment;
use App\Models\ShipmentStatusHistory;
use App\Models\User;
use App\Notifications\CustomerRiderAssignedNotification;
use App\Notifications\DeliveryAssignedNotification;
use App\Notifications\DeliveryRiderRequiredNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ShipmentTrackingService
{
    /**
     * Record a new user assignment for a shipment stage
     *
     * @param  Shipment  $shipment  The shipment
     * @param  User  $user  The user being assigned
     * @param  string  $role  The role (from Role enum: rider, car_driver, drop_point_keeper, warehouse_keeper)
     * @param  string  $stage  The delivery stage (from DeliveryStage enum)
     * @param  User|null  $assignedBy  Who made the assignment (null for system)
     * @param  string|null  $notes  Optional notes
     */
    public function assignUser(
        Shipment $shipment,
        User $user,
        string $role,
        string $stage,
        ?User $assignedBy = null,
        ?string $notes = null,
        bool $sendRiderSms = true
    ): ShipmentAssignment {
        // Do not allow reassigning a job/stage to another user if it already has an assignee
        $existingUnfinished = $shipment->assignments()
            ->where('stage', $stage)
            ->whereNull('completed_at')
            ->orderBy('assigned_at', 'desc')
            ->first();

        if ($existingUnfinished && (int) $existingUnfinished->user_id !== (int) $user->id) {
            throw new \Exception('This job has already been assigned for this stage and cannot be reassigned to another user.');
        }

        $assignment = ShipmentAssignment::create([
            'shipment_id' => $shipment->id,
            'user_id' => $user->id,
            'assigned_by_id' => $assignedBy?->id,
            'role' => $role,
            'stage' => $stage,
            'assigned_at' => now(),
            'notes' => $notes,
        ]);

        // Send push notification to the assigned user (rider)
        try {
            // Log notification attempt
            Log::info('📤 Attempting to send delivery assigned notification', [
                'shipment_id' => $shipment->id,
                'order_number' => $shipment->order_number,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_email' => $user->email,
                'has_fcm_token' => ! empty($user->fcm_token),
                'fcm_token_preview' => $user->fcm_token ? substr($user->fcm_token, 0, 30).'...' : null,
                'push_notifications_enabled' => $user->push_notifications,
                'device_type' => $user->device_type,
                'assigned_by' => $assignedBy?->name ?? 'System',
                'stage' => $stage,
                'role' => $role,
                'timestamp' => now()->toDateTimeString(),
            ]);

            $user->notify(new DeliveryAssignedNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                assignedBy: $assignedBy?->name
            ));

            // Log successful notification
            Log::info('✅ Delivery assigned notification sent successfully', [
                'shipment_id' => $shipment->id,
                'order_number' => $shipment->order_number,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'notification_channels' => ['database', 'fcm'],
            ]);

        } catch (\Exception $e) {
            // Log error but don't fail the assignment
            Log::error('❌ Failed to send delivery assigned notification', [
                'shipment_id' => $shipment->id,
                'order_number' => $shipment->order_number,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_email' => $user->email,
                'error' => $e->getMessage(),
                'error_class' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        // Optional: Send SMS to the assigned rider
        if ($sendRiderSms) {
            try {
                if (! empty($user->phone_number)) {
                    $smsService = app(MtnSmsService::class);
                    $message = sprintf(
                        'New order assigned. Tracking number: %s.',
                        $shipment->order_number ?? $shipment->id
                    );
                    $smsService->send($user->phone_number, $message, 'assignment');
                }
            } catch (\Exception $e) {
                Log::error('Failed to send assignment SMS to rider', [
                    'shipment_id' => $shipment->id,
                    'rider_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Send notification to the customer (if shipment has a user)
        if ($shipment->user) {
            try {
                Log::info('📤 Attempting to send customer notification for rider assignment', [
                    'shipment_id' => $shipment->id,
                    'order_number' => $shipment->order_number,
                    'customer_id' => $shipment->user->id,
                    'customer_name' => $shipment->user->name,
                    'rider_name' => $user->name,
                    'rider_phone' => $user->phone,
                ]);

                $shipment->user->notify(new CustomerRiderAssignedNotification(
                    shipmentId: (string) $shipment->id,
                    trackingNumber: $shipment->order_number,
                    riderName: $user->name,
                    riderPhone: $user->phone,
                ));

                Log::info('✅ Customer notification sent successfully', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id,
                ]);

            } catch (\Exception $e) {
                Log::error('❌ Failed to send customer notification', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id ?? null,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }

            // SR2: Send SMS to sender - Rider is on the way
            try {
                if ($shipment->sender_phone) {
                    $smsService = app(MtnSmsService::class);
                    $locale = strtolower((string) ($shipment->user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

                    $smsService->sendLocalized($shipment->sender_phone, 'smsRiderAssigned', [
                        'riderName' => $user->name,
                        'trackingNumber' => $shipment->order_number,
                        'riderPhone' => $user->phone ?? '',
                    ], $locale);
                }
            } catch (\Exception $e) {
                Log::error('❌ Failed to send rider assigned SMS', [
                    'shipment_id' => $shipment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $assignment;
    }

    /**
     * Mark an assignment as started
     */
    public function startAssignment(ShipmentAssignment $assignment): ShipmentAssignment
    {
        $assignment->update([
            'started_at' => now(),
        ]);

        return $assignment->fresh();
    }

    /**
     * Mark an assignment as completed
     *
     * @param  string|null  $notes  Optional completion notes
     */
    public function completeAssignment(ShipmentAssignment $assignment, ?string $notes = null): ShipmentAssignment
    {
        $updateData = ['completed_at' => now()];

        if ($notes) {
            $updateData['notes'] = $assignment->notes
                ? $assignment->notes."\n\nCompletion notes: ".$notes
                : $notes;
        }

        $assignment->update($updateData);

        return $assignment->fresh();
    }

    /**
     * Record a status change with full audit trail
     *
     * @param  Shipment  $shipment  The shipment
     * @param  string  $newStatus  The new status
     * @param  User|null  $user  Who made the change (null for system)
     * @param  int|null  $progressIndex  Current progress index
     * @param  array  $options  Additional options [latitude, longitude, location_name, notes, metadata]
     */
    public function recordStatusChange(
        Shipment $shipment,
        string $newStatus,
        ?User $user = null,
        ?int $progressIndex = null,
        array $options = [],
        bool $updateShipment = true
    ): ShipmentStatusHistory {
        $oldStatus = $shipment->status;

        // Create history record
        $history = ShipmentStatusHistory::create([
            'shipment_id' => $shipment->id,
            'user_id' => $user?->id,
            'from_status' => $oldStatus,
            'to_status' => $newStatus,
            'progress_index' => $progressIndex,
            'latitude' => $options['latitude'] ?? null,
            'longitude' => $options['longitude'] ?? null,
            'location_name' => $options['location_name'] ?? null,
            'notes' => $options['notes'] ?? null,
            'metadata' => $options['metadata'] ?? null,
        ]);

        // Update the shipment's current status unless caller opts out
        if ($updateShipment) {
            $shipment->update(['status' => $newStatus]);

            if ($shipment->booking_type == 'return') {
                $shipment->update(['return_status' => $newStatus]);
            }
        }

        // Log mileage if user exists and GPS coordinates are provided
        if ($user && isset($options['latitude']) && isset($options['longitude'])) {
            $this->logRiderMileage($shipment, $user, $history);
        }

        // Notify all admins when a door_to_door or drop_point_to_door shipment
        // arrives at Drop Point 2 and still needs a delivery rider assigned
        if (
            $newStatus === ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value
            && in_array($shipment->indirect_delivery_mode, ['door_to_door', 'drop_point_to_door'], true)
            && ! $shipment->delivery_rider_id
        ) {
            $admins = User::whereHas('roles', fn ($q) => $q->where('name', Role::SUPERADMIN->value))->get();
            $notification = new DeliveryRiderRequiredNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->tracking_number ?? (string) $shipment->id,
                deliveryMode: $shipment->indirect_delivery_mode,
            );
            foreach ($admins as $admin) {
                $admin->notify($notification);
            }
        }

        return $history;
    }

    /**
     * Calculate and log mileage for a rider based on their movement
     *
     * @param  Shipment  $shipment  The shipment being tracked
     * @param  User  $user  The rider/driver
     * @param  ShipmentStatusHistory  $currentHistory  Current status history with GPS coordinates
     */
    protected function logRiderMileage(
        Shipment $shipment,
        User $user,
        ShipmentStatusHistory $currentHistory
    ): ?RiderMileageLog {
        // Only track mileage for riders, car drivers, and drop point keepers
        $trackableRoles = ['rider', 'car_driver', 'drop_point_keeper'];
        $userRoles = $user->roles->pluck('name')->toArray();

        if (empty(array_intersect($trackableRoles, $userRoles))) {
            return null;
        }

        // Get the previous location for this user on this shipment
        $previousHistory = ShipmentStatusHistory::where('shipment_id', $shipment->id)
            ->where('user_id', $user->id)
            ->where('id', '<', $currentHistory->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderBy('created_at', 'desc')
            ->first();

        // If no previous location, nothing to calculate
        if (! $previousHistory) {
            return null;
        }

        // Log the distance traveled between the two points
        return RiderMileageLog::logDistance(
            userId: $user->id,
            shipmentId: $shipment->id,
            startLat: $previousHistory->latitude,
            startLon: $previousHistory->longitude,
            endLat: $currentHistory->latitude,
            endLon: $currentHistory->longitude,
            statusFrom: $previousHistory->to_status,
            statusTo: $currentHistory->to_status,
            startedAt: $previousHistory->created_at,
            endedAt: $currentHistory->created_at
        );
    }

    /**
     * Record status change and start assignment in one transaction
     * Useful when scanning parcels or picking up
     *
     * @return array ['assignment' => ShipmentAssignment, 'history' => ShipmentStatusHistory]
     */
    public function assignAndUpdateStatus(
        Shipment $shipment,
        User $user,
        string $newStatus,
        string $role,
        string $stage,
        array $options = []
    ): array {
        return DB::transaction(function () use ($shipment, $user, $newStatus, $role, $stage, $options) {
            // Create assignment
            $assignment = $this->assignUser(
                $shipment,
                $user,
                $role,
                $stage,
                $options['assigned_by'] ?? null,
                $options['assignment_notes'] ?? null
            );

            // Start the assignment immediately
            $this->startAssignment($assignment);

            // Record status change
            $history = $this->recordStatusChange(
                $shipment,
                $newStatus,
                $user,
                $options['progress_index'] ?? null,
                [
                    'latitude' => $options['latitude'] ?? null,
                    'longitude' => $options['longitude'] ?? null,
                    'location_name' => $options['location_name'] ?? null,
                    'notes' => $options['status_notes'] ?? null,
                    'metadata' => $options['metadata'] ?? null,
                ]
            );

            return [
                'assignment' => $assignment,
                'history' => $history,
            ];
        });
    }

    /**
     * Complete current stage and prepare for next stage
     * Useful for handoffs between users (e.g., drop point keeper to car driver)
     *
     * @param  User  $completingUser  User completing current stage
     * @param  string  $newStatus  Status after completion
     */
    public function completeCurrentStage(
        Shipment $shipment,
        User $completingUser,
        string $newStatus,
        array $options = []
    ): ShipmentStatusHistory {
        return DB::transaction(function () use ($shipment, $completingUser, $newStatus, $options) {
            // Find and complete the current active assignment for this user
            $activeAssignment = $shipment->assignments()
                ->where('user_id', $completingUser->id)
                ->whereNotNull('started_at')
                ->whereNull('completed_at')
                ->first();

            if ($activeAssignment) {
                $this->completeAssignment(
                    $activeAssignment,
                    $options['completion_notes'] ?? null
                );
            }

            // Record status change
            return $this->recordStatusChange(
                $shipment,
                $newStatus,
                $completingUser,
                $options['progress_index'] ?? null,
                [
                    'latitude' => $options['latitude'] ?? null,
                    'longitude' => $options['longitude'] ?? null,
                    'location_name' => $options['location_name'] ?? null,
                    'notes' => $options['status_notes'] ?? null,
                    'metadata' => $options['metadata'] ?? null,
                ],
                $options['update_shipment'] ?? true
            );
        });
    }

    /**
     * Get the current active user(s) for a shipment
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getCurrentActiveUsers(Shipment $shipment)
    {
        return $shipment->activeAssignments()->with('user')->get();
    }

    /**
     * Get the complete audit trail for a shipment
     *
     * @return array Combined timeline of assignments and status changes
     */
    public function getAuditTrail(Shipment $shipment): array
    {
        return $shipment->getCompleteTimeline();
    }

    /**
     * Get summary of who handled the shipment at each stage
     *
     * @return array Stage-wise summary
     */
    public function getStageWiseSummary(Shipment $shipment): array
    {
        $assignments = $shipment->assignments()
            ->with(['user', 'assignedBy'])
            ->orderBy('assigned_at', 'asc')
            ->get();

        $summary = [];

        foreach ($assignments as $assignment) {
            if (! isset($summary[$assignment->stage])) {
                $summary[$assignment->stage] = [];
            }

            $summary[$assignment->stage][] = [
                'user' => $assignment->user->name ?? 'Unknown',
                'user_id' => $assignment->user_id,
                'role' => $assignment->role,
                'assigned_at' => $assignment->assigned_at,
                'assigned_by' => $assignment->assignedBy->name ?? 'System',
                'started_at' => $assignment->started_at,
                'completed_at' => $assignment->completed_at,
                'duration_minutes' => $assignment->getDurationMinutes(),
                'status' => $assignment->isCompleted() ? 'completed' :
                           ($assignment->isActive() ? 'active' : 'pending'),
            ];
        }

        return $summary;
    }

    /**
     * Check if a user has an active assignment for a shipment
     */
    public function userHasActiveAssignment(Shipment $shipment, User $user): bool
    {
        return $shipment->activeAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Get the assignment for a specific user and stage
     */
    public function getAssignmentForUserAndStage(Shipment $shipment, User $user, string $stage): ?ShipmentAssignment
    {
        return $shipment->assignments()
            ->where('user_id', $user->id)
            ->where('stage', $stage)
            ->first();
    }
}
