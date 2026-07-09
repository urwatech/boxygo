<?php

namespace App\Services;

use App\Contracts\ShipmentRepositoryInterface;
use App\Contracts\ShipmentServiceInterface;
use App\Enums\DeliveryStage;
use App\Enums\Role;
use App\Enums\ShipmentStatus;
use App\Helpers\helpers;
use App\Http\Controllers\Customer\OnlinePaymentController;
use App\Models\PaymentTransaction;
use App\Models\Shipment;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Notifications\ShipmentDeliveredNotification;
use App\Notifications\ShipmentIncompleteCreateNotification;
use App\Notifications\ShipmentIncompleteCreateRecieverNotification;
use App\Notifications\ShipmentIncompleteDroppointNotification;
use App\Notifications\ShipmentIncompletePickUpNotification;
use App\Notifications\ShipmentPickedUpNotification;
use App\Notifications\ShipmentReadyForPickupNotification;
use App\Support\FinancialSettings;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Service layer for shipment-related business logic.
 */
class ShipmentService implements ShipmentServiceInterface
{
    public function __construct(
        private readonly ShipmentRepositoryInterface $repository,
        private readonly ShipmentTrackingService $trackingService,
        private readonly SendGridEmailService $sendGridEmailService,
        private readonly UserService $userService,
        private readonly WalletService $walletService,
    ) {}

    /**
     * Get paginated shipments for a user.
     */
    public function getUserShipments(int $userId, int $perPage = 10, bool $isNormal = true, bool $isReturned = false, ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator
    {
        return $this->repository->getUserShipmentsPaginated($userId, $perPage, $isNormal, $isReturned, $search, $status, $sortBy, $sortDir);
    }

    public function getUserAllShipments(int $userId, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator
    {
        return $this->repository->getUserAllShipmentsPaginated($userId, $perPage, $booking_type);
    }

    public function getReceivedShipments(int $userId, int $perPage = 10, string $booking_type = 'shipment', ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator
    {
        return $this->repository->getReceivedShipmentsPaginated($userId, $perPage, $booking_type, $search, $status, $sortBy, $sortDir);
    }

    public function getReceiverShipments(string $phone, string $email, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator
    {
        return $this->repository->getReceiverShipmentsPaginated($phone, $email, $perPage, $booking_type);
    }

    /**
     * Get available employees for a shipment based on zone and role.
     * Filters out employees who have reached their COD collection limit.
     *
     * @param  string  $role  Role needed (rider, car driver, etc.)
     */
    public function getAvailableEmployeesForShipment(Shipment $shipment, string $role): Collection
    {
        // Use pickup location to find appropriate zone
        $latitude = $shipment->handover_latitude;
        $longitude = $shipment->handover_longitude;

        if (! $latitude || ! $longitude) {
            // Fallback to all active employees with the role if no coordinates
            $employees = User::where('platform', 'Mobile App')
                ->where('status', 'active')
                ->role($role)
                ->with(['roles', 'vehicles', 'zone'])
                ->get();
        } else {
            $employees = ZoneHelper::getAvailableEmployeesForLocation(
                $latitude,
                $longitude,
                $role
            );
        }

        // Filter out employees who have reached their COD limit
        // Determine the stage based on role for COD check
        $stage = match ($role) {
            'rider' => DeliveryStage::PICKUP->value,
            'car_driver' => DeliveryStage::FINAL_DELIVERY->value,
            'drop_point_keeper' => DeliveryStage::SECOND_DROP_POINT->value,
            default => null,
        };

        return $employees->filter(function ($employee) use ($shipment, $role, $stage) {
            $codCheck = $this->checkCodLimitForAssignment($employee, $shipment, $role, $stage);

            return $codCheck['can_accept'];
        });
    }

    /**
     * Get nearest employees for a shipment within the same zone.
     * Filters out employees who have reached their COD collection limit.
     */
    public function getNearestEmployeesForShipment(Shipment $shipment, string $role, int $limit = 10): Collection
    {
        $latitude = $shipment->handover_latitude;
        $longitude = $shipment->handover_longitude;

        if (! $latitude || ! $longitude) {
            // Fallback to all active employees with the role if no coordinates
            $employees = User::where('platform', 'Mobile App')
                ->where('status', 'active')
                ->role($role)
                ->with(['roles', 'vehicles', 'zone'])
                ->get();
        } else {
            $employees = ZoneHelper::findNearestEmployees(
                $latitude,
                $longitude,
                $role,
                $limit
            );
        }

        // Filter out employees who have reached their COD limit
        // Determine the stage based on role for COD check
        $stage = match ($role) {
            'rider' => DeliveryStage::PICKUP->value,
            'car_driver' => DeliveryStage::FINAL_DELIVERY->value,
            'drop_point_keeper' => DeliveryStage::SECOND_DROP_POINT->value,
            default => null,
        };

        $filteredEmployees = $employees->filter(function ($employee) use ($shipment, $role, $stage) {
            $codCheck = $this->checkCodLimitForAssignment($employee, $shipment, $role, $stage);

            return $codCheck['can_accept'];
        });

        // Return the limited set based on the original limit parameter
        return $filteredEmployees->take($limit);
    }

    /**
     * Create a new shipment for a user.
     */
    public function createShipment(array $data, int $userId): Model
    {
        $data['user_id'] = $userId;
        $data['payment_status'] = $data['payment_method'] === 'online' ? 'pending' : 'pending';

        // Set initial status based on delivery mode
        // For drop_point_to_* modes, customer will bring parcel to DP1, keeper scans to confirm receipt
        // For door_to_* modes, rider needs to be assigned first
        $indirectMode = $data['indirect_delivery_mode'] ?? null;
        $deliverySpeed = $data['delivery_speed'] ?? 'direct';

        if ($deliverySpeed === 'indirect') {
            if (in_array($indirectMode, ['drop_point_to_door', 'drop_point_to_drop_point'], true)) {
                // Customer will bring parcel to Drop Point 1, waiting for keeper to scan and confirm receipt
                $data['status'] = ShipmentStatus::PENDING->value;
            } else {
                // door_to_door or door_to_drop_point: Rider needs to pick up from sender
                // Start as Pending until a rider is assigned
                $data['status'] = ShipmentStatus::PENDING->value;
            }
        } else {
            // Direct delivery - start as Pending until a rider is assigned
            $data['status'] = ShipmentStatus::PENDING->value;
        }

        $data['verification_code'] = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Zone auto-detection disabled — zone is assigned manually by admin
        if (! isset($data['zone_id'])) {
            $data['zone_id'] = null;
        }

        // Calculate and store insurance fee at time of creation
        // This ensures the fee doesn't change when insurance settings are updated
        // If frontend already calculated and sent insurance_fee, use that (preserves the exact fee shown to user)
        // Otherwise, calculate it server-side
        if (! isset($data['insurance_fee']) || $data['insurance_fee'] === null) {
            $data['insurance_fee'] = $this->calculateInsuranceFeeForNewShipment($data);
        }

        $financials = $this->resolvePlatformAndVat($data);
        $data['platform_fee'] = $financials['platform_fee'];
        $data['vat_amount'] = $financials['vat_amount'];

        try {
            $shipment = $this->repository->create($data);

            $receiver = $this->userService->findByEmailOrMobile($data['receiver_email'] ?? '', $data['receiver_phone'] ?? '');
            if ($receiver) {
                $shipment->receiver_id = $receiver->id;
                $shipment->save();
            }

            Log::info('createShipment: shipment created', [
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->user_id,
            ]);
        } catch (\Throwable $e) {
            Log::error('createShipment: failed to create shipment', [
                'user_id' => $userId,
                'payload' => $data,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }

        if (! empty($shipment->receiver_email)) {
            try {
                $this->sendGridEmailService->sendShipmentVerificationCode(
                    $shipment->receiver_email,
                    $shipment->receiver_name,
                    $shipment->verification_code,
                    $shipment->id,
                    $shipment->receiver_name
                );

                Log::info('createShipment: verification email sent', [
                    'shipment_id' => $shipment->id,
                    'email' => $shipment->user->email,
                ]);
            } catch (\Throwable $e) {
                Log::error('createShipment: email failed', [
                    'shipment_id' => $shipment->id,
                    'email' => $shipment->user->email,
                ]);
            } catch (\Throwable $e) {
                \Log::error('createShipment: email failed', [
                    'shipment_id' => $shipment->id,
                    'email' => $shipment->user->email,
                    'error' => $e->getMessage(),
                ]);
            }
        } else {
            Log::warning('createShipment: user email missing', [
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->user_id,
            ]);
        }

        return $shipment;
    }

    public function cancelShipment(array $data): Model
    {
        $shipment = $this->repository->find($data['shipment_id']);
        $shipment->status = ShipmentStatus::INCOMPLETE->value;
        $shipment->incomplete_status = $data['cancelled_by'] == 'driver' ? ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value : ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value;
        $shipment->incomplete_create_by = $data['cancelled_by_user_id'] ?? null;
        $shipment->incomplete_reason = $data['reason'];
        $shipment->incomplete_assign_id = $data['cancelled_by_user_id'];
        $shipment->verification_code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $shipment->save();

        $sender = User::find($shipment->user_id);
        $reciever = $shipment->receiver_id != null ? User::find($shipment->receiver_id) : null;
        $sender->notify(new ShipmentIncompleteCreateNotification(
            shipmentId: (string) $shipment->id,
            trackingNumber: $shipment->order_number,
            initiateBy: $data['cancelled_by'],
            remarks: $data['reason']
        ));

        $superadmin = User::whereHas('roles', function ($q) {
            $q->where('name', 'superadmin');
        })->first();

        if ($superadmin) {
            $superadmin->notify(new ShipmentIncompleteCreateNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                initiateBy: $data['cancelled_by'],
                remarks: $data['reason']
            ));
        }

        if ($reciever) {
            $reciever->notify(new ShipmentIncompleteCreateRecieverNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                initiateBy: $data['cancelled_by'],
                remarks: $data['reason'],
            ));
        }

        if ($shipment->payment_method === 'online') {

            if ($shipment->payment_status == 'paid' && $shipment->receiver_id != null) {
                $this->walletService->credit(
                    $shipment->receiver_id,
                    (float) $shipment->reciever_amount,
                    'Payment refunded as the shipment has been cancelled by the '.$data['cancelled_by'].'. Order #'.$shipment->order_number
                );
            }

            if ($shipment->sender_payment_status == 'paid') {
                $sender_amount = $shipment->sender_amount;

                if ($shipment->return_delivery_fee_payer == 'sender') {
                    $sender_amount += $shipment->rdf_amount;

                    $this->walletService->deductHold(
                        $shipment->user_id,
                        (float) $shipment->rdf_amount,
                        'Held amount released due to shipment cancellation. Order #'.$shipment->order_number
                    );
                    $shipment->rdf_payment_status = 'refunded';
                }

                $this->walletService->credit(
                    $shipment->user_id,
                    (float) $sender_amount,
                    'Payment refunded as the shipment has been cancelled. Order #'.$shipment->order_number
                );

                if ($shipment->sender_receive_payment_status == 'released') {
                    $shipment->sender_receive_payment_status = 'refunded';
                    $shipment->save();
                }
            }
        }

        if (! empty($shipment->sender_email)) {
            try {
                $this->sendGridEmailService->sendShipmentVerificationCode(
                    $shipment->sender_email,
                    $shipment->sender_name,
                    $shipment->verification_code,
                    $shipment->id,
                    $shipment->sender_name
                );

                Log::info('createShipment: verification email sent', [
                    'shipment_id' => $shipment->id,
                    'email' => $shipment->user->email,
                ]);
            } catch (\Throwable $e) {
                Log::error('createShipment: email failed', [
                    'shipment_id' => $shipment->id,
                    'email' => $shipment->user->email,
                ]);
            } catch (\Throwable $e) {
                \Log::error('createShipment: email failed', [
                    'shipment_id' => $shipment->id,
                    'email' => $shipment->user->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $shipment;
    }

    /**
     * Auto-assign the first available rider for a shipment using dashboard rules.
     */
    public function autoAssign($shipmentId): JsonResponse
    {
        $user = User::role(Role::SUPERADMIN->value)->first();

        $shipment = Shipment::query()
            ->with(['latestStatusHistory'])
            ->find($shipmentId);

        if (! $shipment) {
            return response()->json([
                'ok' => false,
                'message' => 'Shipment not found or inaccessible.',
            ], JsonResponse::HTTP_NOT_FOUND);
        }

        $normalizeZoneId = static function ($value): ?string {
            return ($value === null || $value === '') ? null : (string) $value;
        };

        $resolvedZoneId = $normalizeZoneId($shipment->zone_id);

        if (! $resolvedZoneId) {

            $zone = \App\Services\ZoneHelper::findZoneByCoordinates(
                (float) $shipment->handover_latitude,
                (float) $shipment->handover_longitude
            );

            if (! $zone) {

                return response()->json([
                    'ok' => false,
                    'message' => 'No active zone found for the provided coordinates.',
                ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
            }

            $resolvedZoneId = (string) $zone->id;
        }

        $ridersQuery = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'rider'))
            ->orderBy('id', 'desc');

        $zoneIds = $user->getAssignedZoneIds();

        if (! empty($zoneIds)) {
            $ridersQuery->where(function ($query) use ($zoneIds) {
                $query->whereIn('zone_id', $zoneIds);

                foreach ($zoneIds as $zoneId) {
                    $query->orWhereJsonContains('zone_ids', $zoneId);
                }
            });
        }

        $riders = $ridersQuery->get([
            'id',
            'status',
            'availability',
            'zone_id',
            'zone_ids',
            'delivery_speed_mode',
            'shipment_type',
        ]);

        $availableRider = $riders->first(function ($rider) use ($resolvedZoneId) {

            if (! ($rider->status === 'active' && ($rider->availability ?? 'offline') === 'online')) {
                return false;
            }

            $zoneIds = is_array($rider->zone_ids)
                ? $rider->zone_ids
                : json_decode($rider->zone_ids, true);

            if (! in_array((int) $resolvedZoneId, array_map('intval', $zoneIds ?? []))) {
                return false;
            }

            return true;
        });

        if (! $availableRider) {

            return response()->json([
                'ok' => false,
                'message' => 'No available riders in this zone at this moment',
            ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {

            $shipment->rider_id = $availableRider->id;
            $shipment->save();

            // Validate pickup rider
            $rider = User::query()
                ->where('id', $shipment->rider_id)
                ->first();

            $isDoorToDoor = $shipment->delivery_speed === 'indirect'
                && $shipment->indirect_delivery_mode === 'door_to_door';

            // Close open pickup assignments for other riders; reuse selected rider assignment if exists
            $openPickupAssignments = $shipment->assignments()
                ->where('stage', DeliveryStage::PICKUP->value)
                ->where('role', 'rider')
                ->whereNull('completed_at')
                ->get();

            $existingPickupAssignment = null;

            foreach ($openPickupAssignments as $openAssignment) {
                if ((int) $openAssignment->user_id === (int) $rider->id) {
                    $existingPickupAssignment = $openAssignment;

                    continue;
                }

                $notes = trim((string) $openAssignment->notes);
                $suffix = 'Unassigned by admin for reassignment';
                $openAssignment->update([
                    'completed_at' => now(),
                    'notes' => $notes ? $notes."\n\n".$suffix : $suffix,
                ]);
            }

            // Persist pickup rider on shipment
            $shipment->rider_id = $rider->id;
            $shipment->save();

            if ($existingPickupAssignment) {
                $assignment = $existingPickupAssignment;
                if (! $assignment->started_at) {
                    $this->trackingService->startAssignment($assignment);
                    $assignment->refresh();
                }
            } else {
                $assignment = $this->trackingService->assignUser(
                    shipment: $shipment,
                    user: $rider,
                    role: 'rider',
                    stage: DeliveryStage::PICKUP->value,
                    assignedBy: $user,
                    notes: $isDoorToDoor ? 'Assigned as pickup rider by admin' : 'Assigned by admin from dashboard',
                    sendRiderSms: true
                );
                $this->trackingService->startAssignment($assignment);
                $assignment->refresh();
            }

            $this->trackingService->recordStatusChange(
                shipment: $shipment,
                newStatus: ShipmentStatus::ASSIGNED->value,
                user: $rider,
                options: ['notes' => $isDoorToDoor ? 'Pickup rider assigned by admin (delivery rider to be assigned at Drop Point 2)' : 'Rider assigned by admin']
            );

            return response()->json([
                'ok' => true,
                'message' => 'Rider assigned successfully.',
                'data' => [
                    'shipment_id' => $shipment->id,
                    'rider_id' => $availableRider->id,
                    'zone_id' => $resolvedZoneId,
                ],
            ]);
        } catch (\Throwable $exception) {

            return response()->json([
                'ok' => false,
                'message' => 'Failed to assign rider. Please try again.',
            ], JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Auto-assign the first available rider for a shipment using dashboard rules.
     */
    public function autoAssignDeliveryRider($shipmentId, $deliveryStage): JsonResponse
    {
        $user = User::role(Role::SUPERADMIN->value)->first();

        $shipment = Shipment::query()
            ->with(['latestStatusHistory'])
            ->find($shipmentId);

        if (! $shipment) {
            return response()->json([
                'ok' => false,
                'message' => 'Shipment not found or inaccessible.',
            ], JsonResponse::HTTP_NOT_FOUND);
        }

        $normalizeZoneId = static function ($value): ?string {
            return ($value === null || $value === '') ? null : (string) $value;
        };

        $resolvedZoneId = $normalizeZoneId($shipment->zone_id);

        if (! $resolvedZoneId) {

            $zone = \App\Services\ZoneHelper::findZoneByCoordinates(
                (float) $shipment->delivery_latitude,
                (float) $shipment->delivery_longitude
            );

            if (! $zone) {

                return response()->json([
                    'ok' => false,
                    'message' => 'No active zone found for the provided coordinates.',
                ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
            }

            $resolvedZoneId = (string) $zone->id;
        }

        $ridersQuery = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'rider'))
            ->orderBy('id', 'desc');

        $zoneIds = $user->getAssignedZoneIds();

        if (! empty($zoneIds)) {
            $ridersQuery->where(function ($query) use ($zoneIds) {
                $query->whereIn('zone_id', $zoneIds);

                foreach ($zoneIds as $zoneId) {
                    $query->orWhereJsonContains('zone_ids', $zoneId);
                }
            });
        }

        $riders = $ridersQuery->get([
            'id',
            'status',
            'availability',
            'zone_id',
            'zone_ids',
            'delivery_speed_mode',
            'shipment_type',
        ]);

        $availableRider = $riders->first(function ($rider) use ($resolvedZoneId) {

            if (! ($rider->status === 'active' && ($rider->availability ?? 'offline') === 'online')) {
                return false;
            }

            $zoneIds = is_array($rider->zone_ids)
                ? $rider->zone_ids
                : json_decode($rider->zone_ids, true);

            if (! in_array((int) $resolvedZoneId, array_map('intval', $zoneIds ?? []))) {
                return false;
            }

            return true;
        });

        if (! $availableRider) {

            return response()->json([
                'ok' => false,
                'message' => 'No available riders in this zone at this moment',
            ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {

            $shipment->delivery_rider_id = $availableRider->id;
            $shipment->save();

            $assignment = $this->trackingService->assignUser(
                shipment: $shipment,
                user: $availableRider,
                role: 'rider',
                stage: $deliveryStage,
                assignedBy: $user,
                notes: 'Auto Assigned by System',
                sendRiderSms: true
            );
            $this->trackingService->startAssignment($assignment);
            $assignment->refresh();

            return response()->json([
                'ok' => true,
                'message' => 'Rider assigned successfully.',
                'data' => [
                    'shipment_id' => $shipment->id,
                    'rider_id' => $availableRider->id,
                    'zone_id' => $resolvedZoneId,
                ],
            ]);
        } catch (\Throwable $exception) {

            return response()->json([
                'ok' => false,
                'message' => 'Failed to assign rider. Please try again.',
            ], JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Request a cancellation for a shipment with specific business rules.
     *
     * @throws \Exception
     */
    public function requestCancellation(int $shipmentId, int $userId, string $reason): Model
    {
        $shipment = $this->repository->find($shipmentId);
        if (! $shipment) {
            throw new \Exception('Shipment not found.');
        }

        // Check if user is the sender
        if ((int) $shipment->user_id !== $userId) {
            throw new \Exception('Only the sender can cancel this shipment.');
        }

        // Scenario 3: Indirect Delivery + Before Handover
        if ($shipment->delivery_speed === 'indirect') {
            $indirectStatus = $shipment->indirectStatus;
            // index 4 = Arrived at Drop Point 1. Handover occurs at this point.
            if ($indirectStatus && $indirectStatus->current_index >= 4) {
                throw new \Exception('Indirect delivery shipments cannot be cancelled after handover to drop point.');
            }
        }

        // Scenario 4: Door Delivery (Direct) + Before Assignment
        if ($shipment->delivery_speed === 'direct') {
            // If rider_id is set, it's considered assigned.
            if ($shipment->rider_id !== null) {
                throw new \Exception('Shipment cannot be cancelled after rider assignment for door delivery.');
            }

            // Refund sender paid fees if online and paid
            if ($shipment->payment_method === 'online' && $shipment->sender_payment_status === 'paid') {
                $this->processCancellationRefund($shipment);
            }
        }

        // Perform cancellation
        $shipment->update([
            'status' => ShipmentStatus::CANCELLED->value,
            'incomplete_status' => $shipment->status,
            'incomplete_reason' => $reason,
            'incomplete_create_by' => $userId,
        ]);

        if ($shipment->payment_method === 'online') {

            if ($shipment->payment_status == 'paid' && $shipment->receiver_id != null) {
                $this->walletService->credit(
                    $shipment->receiver_id,
                    (float) $shipment->reciever_amount,
                    'Payment refunded as the shipment has been cancelled by the sender. Order #'.$shipment->order_number
                );
            }

            if ($shipment->sender_payment_status == 'paid') {
                $sender_amount = $shipment->sender_amount;

                if ($shipment->return_delivery_fee_payer == 'sender') {
                    $sender_amount += $shipment->rdf_amount;

                    $this->walletService->deductHold(
                        $shipment->user_id,
                        (float) $shipment->rdf_amount,
                        'Held amount released due to shipment cancellation. Order #'.$shipment->order_number
                    );
                    $shipment->rdf_payment_status = 'refunded';
                }

                $this->walletService->credit(
                    $shipment->user_id,
                    (float) $sender_amount,
                    'Payment refunded as the shipment has been cancelled. Order #'.$shipment->order_number
                );

                if ($shipment->sender_receive_payment_status == 'released') {
                    $shipment->sender_receive_payment_status = 'refunded';
                    $shipment->save();
                }
            }
        }

        // Record status change in history
        $this->trackingService->recordStatusChange(
            $shipment,
            ShipmentStatus::CANCELLED->value,
            User::find($userId),
            null,
            ['notes' => $reason],
            false // No need to update shipment status again
        );

        $sender = User::find($shipment->user_id);
        $reciever = $shipment->receiver_id != null ? User::find($shipment->receiver_id) : null;
        $sender->notify(new ShipmentIncompleteCreateNotification(
            shipmentId: (string) $shipment->id,
            trackingNumber: $shipment->order_number,
            initiateBy: 'sender',
            remarks: $reason
        ));

        $superadmin = User::whereHas('roles', function ($q) {
            $q->where('name', 'superadmin');
        })->first();

        if ($superadmin) {
            $superadmin->notify(new ShipmentIncompleteCreateNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                initiateBy: 'sender',
                remarks: $reason
            ));
        }

        if ($reciever) {
            $reciever->notify(new ShipmentIncompleteCreateRecieverNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                initiateBy: 'sender',
                remarks: $reason
            ));
        }

        return $shipment;
    }

    /**
     * Process refund for a cancelled shipment.
     */
    protected function processCancellationRefund(Shipment $shipment): void
    {
        try {
            // Find the sender's wallet transactions for this shipment
            $deliveryFee = (float) $shipment->total_fee;
            $rdfFee = $shipment->accept_returns && $shipment->return_delivery_fee_payer === 'sender' ? $deliveryFee : 0;
            $totalRefund = $deliveryFee + $rdfFee;

            if ($totalRefund > 0) {
                $this->walletService->credit(
                    $shipment->user_id,
                    $totalRefund,
                    'Refund for cancelled shipment - '.$shipment->order_number,
                    [
                        'shipment_id' => $shipment->id,
                        'shipment_order_number' => $shipment->order_number,
                        'reason' => 'Cancellation refund',
                        'type' => 'refund',
                    ]
                );

                Log::info("Refunded {$totalRefund} to user {$shipment->user_id} for cancelled shipment {$shipment->order_number}");
            }
        } catch (\Exception $e) {
            Log::error("Failed to process refund for shipment {$shipment->id}: ".$e->getMessage());
        }
    }

    /**
     * Find a shipment by ID.
     */
    public function find(int|string $id): ?Model
    {
        return $this->repository->find($id);
    }

    /**
     * Get jobs for a rider with optional filter.
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getRiderJobs(int $riderId, ?string $filter = 'assigned', ?string $search = null)
    {
        return $this->repository->getRiderJobs($riderId, $filter, $search);
    }

    /**
     * Get paginated jobs for a rider with optional filter.
     */
    public function getRiderJobsPaginated(int $riderId, ?string $filter = 'assigned', int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        return $this->repository->getRiderJobsPaginated($riderId, $filter, $perPage, $page);
    }

    /**
     * Get jobs for Drop Point Keeper at first drop point stage.
     * Only returns jobs that the keeper has scanned.
     */
    public function getDropPointKeeperJobs(?string $filter = 'assigned', ?int $userId = null, ?string $search = null)
    {
        return $this->repository->getDropPointKeeperJobs($filter, $userId, $search);
    }

    /**
     * Get paginated jobs for Drop Point Keeper.
     */
    public function getDropPointKeeperJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        return $this->repository->getDropPointKeeperJobsPaginated($filter, $userId, $perPage, $page);
    }

    /**
     * Get jobs for Car Driver between drop point and warehouse.
     * Only returns jobs that the driver has scanned.
     */
    public function getCarDriverJobs(?string $filter = 'assigned', ?int $userId = null, ?string $search = null)
    {
        return $this->repository->getCarDriverJobs($filter, $userId, $search);
    }

    /**
     * Get paginated jobs for Car Driver.
     */
    public function getCarDriverJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        return $this->repository->getCarDriverJobsPaginated($filter, $userId, $perPage, $page);
    }

    /**
     * Get jobs for Warehouse Keeper at warehouse.
     * Only returns jobs that the keeper has scanned.
     */
    public function getWarehouseKeeperJobs(?string $filter = 'assigned', ?int $userId = null, ?string $search = null)
    {
        return $this->repository->getWarehouseKeeperJobs($filter, $userId, $search);
    }

    /**
     * Get paginated jobs for Warehouse Keeper.
     */
    public function getWarehouseKeeperJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        return $this->repository->getWarehouseKeeperJobsPaginated($filter, $userId, $perPage, $page);
    }

    /**
     * Find a job for a specific rider.
     */
    public function findJobForRider(int $shipmentId, int $riderId): ?Model
    {
        return $this->repository->findForRider($shipmentId, $riderId);
    }

    /**
     * Find a job for Drop Point Keeper context.
     */
    public function findJobForDropPointKeeper(int $shipmentId): ?Model
    {
        return $this->repository->findForDropPointKeeper($shipmentId);
    }

    /**
     * Find a job for Car Driver context.
     */
    public function findJobForCarDriver(int $shipmentId): ?Model
    {
        return $this->repository->findForCarDriver($shipmentId);
    }

    /**
     * Find a job for Warehouse Keeper context.
     */
    public function findJobForWarehouseKeeper(int $shipmentId): ?Model
    {
        return $this->repository->findForWarehouseKeeper($shipmentId);
    }

    /**
     * Update shipment status with business logic.
     *
     * @throws \Exception
     */
    public function updateJobStatus(int $shipmentId, int $riderId, array $data): Model
    {
        // Determine acting user and role
        $actor = User::find($riderId);
        if (! $actor) {
            throw new \Exception('User not found.');
        }

        // Helper for case-insensitive role checks (covers custom-cased role names)
        $hasRole = function (User $user, string $role): bool {
            $names = array_map('strtolower', $user->getRoleNames()->toArray());

            return in_array(strtolower($role), $names, true);
        };

        // Resolve shipment according to actor role
        if ($hasRole($actor, Role::RIDER->value)) {
            $shipment = $this->repository->findForRider($shipmentId, $riderId);
        } else {
            // For non-rider operational roles (e.g., drop point keeper, car driver, warehouse keeper)
            $shipment = $this->repository->find($shipmentId);
        }

        if ($data['status'] == ShipmentStatus::INCOMPLETE_COLLECTED->value) {
            if (empty($data['verification_code'])) {
                throw new \Exception('Verification code is required to complete the delivery.');
            }

            // Allow 000000 as verification code in local environment
            $isLocalBypass = config('app.env') === 'local' && $data['verification_code'] === '000000';

            if (! $isLocalBypass && $shipment->verification_code != $data['verification_code']) {
                throw new \Exception('Invalid verification code. Please check with the customer.');
            }

            // Mark as verified if not already
            if (! $shipment->verification_code_verified_at) {
                $this->repository->update($shipmentId, ['verification_code_verified_at' => now()]);
            }

            $shipment->incomplete_status = ShipmentStatus::INCOMPLETE_COLLECTED->value;
            $shipment->save();

            return $shipment;
        }

        if (! $shipment) {
            throw new \Exception('Job not found or not assigned to you.');
        }

        $this->ensureUserMatchesShipmentZone($shipment, $actor);

        // For indirect shipments, enforce scanning requirement for non-rider roles
        // Drop Point Keepers, Car Drivers, and Warehouse Keepers must scan before updating status
        if ($shipment->delivery_speed === 'indirect' && ! $hasRole($actor, Role::RIDER->value)) {
            $hasActiveAssignment = $shipment->assignments()
                ->where('user_id', $actor->id)
                ->where(function ($query) {
                    $query->whereNotNull('started_at')
                        ->orWhereNotNull('assigned_at');
                })
                ->exists();

            if (! $hasActiveAssignment) {
                throw new \Exception('You must scan this parcel before you can update its status. Please use the scan parcel endpoint first.');
            }
        }

        // Enforce role-based status transitions for indirect flow (phase 1)
        if ($shipment->delivery_speed === 'indirect') {
            $status = $data['status'];
            $isDiffCity = $this->shouldRouteViaWarehouse2($shipment);
            $warehouse2Statuses = [
                ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
                ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
                ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
                ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ];

            // Keep legacy behavior unchanged for local-city shipments.
            if (! $isDiffCity && in_array($status, $warehouse2Statuses, true)) {
                throw new \Exception('Warehouse 2 statuses are only allowed when shipment is marked as different-city.');
            }

            // Rider is only allowed up to first drop point arrival
            if ($hasRole($actor, Role::RIDER->value)) {
                // Rider may set Pickup, In Transit, and Arrived at Drop Point 1 in indirect flow
                $riderAllowed = [
                    ShipmentStatus::PICKUP->value,
                    ShipmentStatus::IN_TRANSIT->value,
                    ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
                    ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
                    ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
                    ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
                    ShipmentStatus::DELIVERED->value,
                ];

                if (! in_array($status, $riderAllowed, true)) {
                    throw new \Exception('Rider can only update to Pickup, In Transit, Arrived at Drop Point 1, Delivered to Drop Point 1, Pickup from Drop Point 2, In Transit to Customer, or Delivered for indirect deliveries.');
                }

                // When rider pick up, lock to nearest drop point keeper based on job pickup location
                if ($status === ShipmentStatus::PICKUP->value) {
                    // Compare nearest drop point keeper using shipment PICKUP location (handover_*).
                    // Fall back to driver's saved coordinates, then request payload if pickup is missing.
                    $lat = $shipment->handover_latitude ?? $actor->latitude ?? $data['latitude'] ?? null;
                    $lon = $shipment->handover_longitude ?? $actor->longitude ?? $data['longitude'] ?? null;
                    if ($lat === null || $lon === null) {
                        throw new \Exception('Pickup location is missing and no fallback location available.');
                    }

                    // Find nearest drop point keeper with known coordinates
                    $nearestKeeper = \App\Models\User::query()
                        ->whereHas('roles', function ($q) {
                            $q->whereRaw("LOWER(REPLACE(name, '-', ' ')) LIKE ?", ['%drop%point%keeper%']);
                        })
                        ->whereNotNull('latitude')
                        ->whereNotNull('longitude')
                        ->selectRaw(
                            'users.*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) as distance_km',
                            [$lat, $lon, $lat]
                        )
                        ->orderBy('distance_km', 'asc')
                        ->first();

                    if (! $nearestKeeper) {
                        throw new \Exception('No drop point keeper with a valid location is configured.');
                    }

                    // Attach keeper details to metadata for auditability
                    $meta = $data['metadata'] ?? [];
                    if (! is_array($meta)) {
                        $meta = ['raw' => $meta];
                    }
                    $meta['nearest_drop_point_keeper'] = [
                        'id' => $nearestKeeper->id,
                        'name' => $nearestKeeper->name,
                        'address' => $nearestKeeper->address,
                        'latitude' => $nearestKeeper->latitude,
                        'longitude' => $nearestKeeper->longitude,
                        'distance_km' => isset($nearestKeeper->distance_km) ? round((float) $nearestKeeper->distance_km, 3) : null,
                    ];
                    $data['metadata'] = $meta;

                    // Create a pending assignment for this keeper at the first drop point stage if not exists
                    $existing = $this->trackingService->getAssignmentForUserAndStage(
                        shipment: $shipment,
                        user: $nearestKeeper,
                        stage: DeliveryStage::FIRST_DROP_POINT->value
                    );
                    // if (!$existing) {
                    //     $this->trackingService->assignUser(
                    //         shipment: $shipment,
                    //         user: $nearestKeeper,
                    //         role: Role::DROP_POINT_KEEPER->value,
                    //         stage: DeliveryStage::FIRST_DROP_POINT->value,
                    //         assignedBy: $actor,
                    //         notes: 'Auto-assigned to nearest drop point keeper based on rider location'
                    //     );
                    // }
                }
            }

            // Drop Point Keeper allowed statuses across both drop points
            if ($hasRole($actor, Role::DROP_POINT_KEEPER->value)) {
                $keeperAllowed = [
                    // First drop point
                    ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
                    ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
                    // Second drop point
                    ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
                    ShipmentStatus::READY_FOR_PICKUP->value,
                    ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
                    ShipmentStatus::DELIVERED->value,
                ];

                if (! in_array($status, $keeperAllowed, true)) {
                    throw new \Exception('Drop point keeper can only update Delivered to Drop Point 1, Dispatched to Warehouse, Dispatched from Drop Point 2, Ready for Pickup, Picked up by Receiver, or Delivered.');
                }
            }

            // "Dispatched to Warehouse" must be done by Drop Point Keeper
            if (
                $status === ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value &&
                ! $hasRole($actor, Role::DROP_POINT_KEEPER->value)
            ) {
                throw new \Exception('Only the drop point keeper can dispatch to warehouse.');
            }

            // Warehouse Keeper allowed statuses
            if ($hasRole($actor, Role::WAREHOUSE_KEEPER->value)) {
                $warehouseAllowed = [
                    ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
                    ShipmentStatus::DELIVERED->value,
                ];

                if ($isDiffCity) {
                    $warehouseAllowed[] = ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value;
                }

                if (! in_array($status, $warehouseAllowed, true)) {
                    throw new \Exception(
                        $isDiffCity
                            ? 'Warehouse keeper can only update Dispatched from Warehouse, Dispatched from Warehouse 2, or Delivered.'
                            : 'Warehouse keeper can only update Dispatched from Warehouse or Delivered.'
                    );
                }
            }

            // Car Driver is allowed statuses for both legs (to and from warehouse)
            if ($hasRole($actor, Role::CAR_DRIVER->value)) {
                $driverAllowed = [
                    ShipmentStatus::PICKUP->value,                        // Pickup (legacy)
                    ShipmentStatus::IN_TRANSIT->value,                    // In transit (legacy)
                    ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,      // Pickup from drop point 1
                    ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,       // In transit to warehouse
                    ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,          // Arrived at warehouse
                    ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,         // Pickup from warehouse
                    ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,    // In transit to drop point 2
                    ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,       // Arrived at second drop point
                    ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,      // Pickup from drop point 2 (door delivery)
                    ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,        // In transit to customer (door delivery)
                    ShipmentStatus::DELIVERED->value,                     // Delivered (for *_to_door modes)
                ];

                if ($isDiffCity) {
                    $driverAllowed = array_merge($driverAllowed, [
                        ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value, // In transit to warehouse 2
                        ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,    // Arrived at warehouse 2
                        ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,   // Pickup from warehouse 2
                    ]);
                }

                if (! in_array($status, $driverAllowed, true)) {
                    throw new \Exception(
                        $isDiffCity
                            ? 'Car driver can only update Pickup from Drop Point 1, In Transit to Warehouse, Arrived at Warehouse, Pickup from Warehouse, In Transit to Warehouse 2, Arrived at Warehouse 2, Pickup from Warehouse 2, In Transit to Drop Point 2, Arrived at Drop Point 2, Pickup from Drop Point 2, In Transit to Customer, or Delivered.'
                            : 'Car driver can only update Pickup from Drop Point 1, In Transit to Warehouse, Arrived at Warehouse, Pickup from Warehouse, In Transit to Drop Point 2, Arrived at Drop Point 2, Pickup from Drop Point 2, In Transit to Customer, or Delivered.'
                    );
                }
            }
        }

        // For DIRECT shipments only: If status is Pickup or In Transit, allow it to be set only once
        // For INDIRECT shipments: Skip this check as each actor can set their own stage-specific statuses
        if ($shipment->delivery_speed === 'direct') {
            $oneTimeStatuses = [ShipmentStatus::PICKUP->value, ShipmentStatus::IN_TRANSIT->value];
            if (in_array($data['status'], $oneTimeStatuses, true)) {
                $alreadyExistsGlobally = $shipment->statusHistory()
                    ->where('to_status', $data['status'])
                    ->exists();
                if ($alreadyExistsGlobally) {
                    // Return the contextual shipment without recording duplicate history
                    if ($actor->hasRole(Role::RIDER->value)) {
                        return $this->repository->findForRider($shipmentId, $riderId) ?? $this->repository->find($shipmentId);
                    }

                    return $this->repository->find($shipmentId);
                }
            }
        }

        // Prevent the same user from setting the same status repeatedly
        // Exception: For indirect drop point modes, allow DP keeper to set Delivered when transitioning from Ready for Pickup
        // This is the final handover to receiver at the drop point
        $statusAlreadySetByUser = $shipment->statusHistory()
            ->where('user_id', $riderId)
            ->where('to_status', $data['status'])
            ->exists();

        // Allow exception for drop point keeper delivering from Ready for Pickup status
        $isKeeperFinalHandover = (
            $shipment->delivery_speed === 'indirect' &&
            in_array($shipment->indirect_delivery_mode, ['door_to_drop_point', 'drop_point_to_drop_point'], true) &&
            $data['status'] === ShipmentStatus::DELIVERED->value &&
            $hasRole($actor, Role::DROP_POINT_KEEPER->value) &&
            $shipment->status === ShipmentStatus::READY_FOR_PICKUP->value
        );

        if ($statusAlreadySetByUser && ! $isKeeperFinalHandover) {
            throw new \Exception('You have already set this status for this shipment.');
        }

        // Verify code when marking as delivered (final handover to receiver)
        // For direct delivery: verification required at DELIVERED status
        // For indirect *_to_door modes: verification required at DELIVERED status (car driver delivers to door)
        // For indirect *_to_droppoint modes: verification required at DELIVERED status (keeper hands over at drop point)
        $requiresVerification = false;

        if ($shipment->delivery_speed === 'direct' && $data['status'] === ShipmentStatus::DELIVERED->value) {
            $requiresVerification = true;
        } elseif ($shipment->delivery_speed === 'indirect' && $data['status'] === ShipmentStatus::PICKED_UP_BY_RECEIVER->value) {
            // Legacy support for PICKED_UP_BY_RECEIVER status
            $requiresVerification = true;
        } elseif ($shipment->delivery_speed === 'indirect' && $data['status'] === ShipmentStatus::DELIVERED->value) {
            // All indirect modes end with DELIVERED status
            $requiresVerification = true;
        }

        if ($requiresVerification) {
            if (empty($data['verification_code'])) {
                throw new \Exception('Verification code is required to complete the delivery.');
            }

            // Allow 000000 as verification code in local environment
            $isLocalBypass = config('app.env') === 'local' && $data['verification_code'] === '000000';

            if (! $isLocalBypass && $shipment->verification_code != $data['verification_code']) {
                throw new \Exception('Invalid verification code. Please check with the customer.');
            }

            // Mark as verified if not already
            if (! $shipment->verification_code_verified_at) {
                $this->repository->update($shipmentId, ['verification_code_verified_at' => now()]);
            }
        }

        // Note: COD payments should not be marked as paid until rider collects payment
        // Payment status will be updated in the collectPayment method

        // Build options; for car driver completion, mark delivery_type=individual in history metadata
        // For history location, prefer pickup coordinates at first drop point arrival
        $effectiveLat = $data['latitude'] ?? ($shipment->handover_latitude ?? $actor->latitude ?? null);
        $effectiveLon = $data['longitude'] ?? ($shipment->handover_longitude ?? $actor->longitude ?? null);
        $options = [
            'latitude' => $effectiveLat,
            'longitude' => $effectiveLon,
            'location_name' => $data['location_name'] ?? null,
            'notes' => $data['notes'] ?? null,
            'metadata' => $data['metadata'] ?? null,
        ];

        if (
            $shipment->delivery_speed === 'indirect'
            && $actor->hasRole(Role::CAR_DRIVER->value)
            && in_array(($data['status'] ?? null), [
                ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
                ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            ], true)
        ) {
            $meta = $options['metadata'] ?? [];
            if (! is_array($meta)) {
                $meta = ['raw' => $meta];
            }
            $meta['delivery_type'] = 'individual';
            $options['metadata'] = $meta;
        }

        // Record status change in tracking system
        // Special handling for Delivered: handled below to avoid double-history and to control shipment.status update
        if ($data['status'] !== ShipmentStatus::DELIVERED->value) {
            if ($shipment->accept_returns) {
                $returnDate = Carbon::now()->add('days', $shipment->return_window);
                $shipment->return_expire_date = $returnDate;
                $shipment->save();
            }
            $this->trackingService->recordStatusChange(
                shipment: $shipment,
                newStatus: $data['status'],
                // Attribute change to the acting user (rider/keeper/driver)
                user: $actor,
                progressIndex: $data['current_index'] ?? null,
                options: $options
            );
        }

        // Update progress index if provided (for backward compatibility)
        if (isset($data['current_index'])) {
            if ($shipment->delivery_speed === 'direct' && $shipment->directStatus) {
                $shipment->directStatus->update(['current_index' => $data['current_index']]);
            } elseif ($shipment->delivery_speed === 'indirect' && $shipment->indirectStatus) {
                $shipment->indirectStatus->update(['current_index' => $data['current_index']]);
            }
        }

        // If status is pickup, notify customer that the journey has started
        if ($data['status'] === ShipmentStatus::PICKUP->value && $shipment->user) {
            try {
                Log::info('📤 Attempting to send shipment picked up notification', [
                    'shipment_id' => $shipment->id,
                    'order_number' => $shipment->order_number,
                    'customer_id' => $shipment->user->id,
                    'customer_name' => $shipment->user->name,
                    'picked_up_by' => $actor->name,
                ]);

                $shipment->user->notify(new ShipmentPickedUpNotification(
                    shipmentId: (string) $shipment->id,
                    trackingNumber: $shipment->order_number,
                    riderName: $actor->name,
                    riderPhone: $actor->phone,
                    pickedUpAt: now()->toDateTimeString()
                ));

                Log::info('✅ Shipment picked up notification sent successfully', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id,
                ]);
            } catch (\Exception $e) {
                Log::error('❌ Failed to send shipment picked up notification', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id ?? null,
                    'error' => $e->getMessage(),
                ]);
            }

            // SR5: Send SMS - Parcel Journey started (to sender, receiver, rider)
            try {
                $smsService = app(MtnSmsService::class);
                $locale = strtolower((string) ($shipment->user->language ?? 'en')) === 'ar' ? 'ar' : 'en';
                $smsParams = [
                    'trackingNumber' => $shipment->order_number,
                    'riderName' => $actor->name,
                ];

                if ($shipment->sender_phone) {
                    $smsService->sendLocalized($shipment->sender_phone, 'smsParcelJourneyStarted', $smsParams, $locale);
                }
                if ($shipment->receiver_phone) {
                    $smsService->sendLocalized($shipment->receiver_phone, 'smsParcelJourneyStarted', $smsParams, $locale);
                }
            } catch (\Exception $e) {
                Log::error('❌ Failed to send parcel journey started SMS', [
                    'shipment_id' => $shipment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // If status is ready for pickup, notify customer that parcel is ready for collection
        if ($data['status'] === ShipmentStatus::READY_FOR_PICKUP->value && $shipment->user) {
            try {
                Log::info('📤 Attempting to send ready for pickup notification', [
                    'shipment_id' => $shipment->id,
                    'order_number' => $shipment->order_number,
                    'customer_id' => $shipment->user->id,
                    'customer_name' => $shipment->user->name,
                    'updated_by' => $actor->name,
                ]);

                // Get pickup location info (could be drop point address or actor's location)
                $pickupLocation = $actor->address ?? null;
                $pickupAddress = $shipment->delivery_address ?? null;

                $shipment->user->notify(new ShipmentReadyForPickupNotification(
                    shipmentId: (string) $shipment->id,
                    trackingNumber: $shipment->order_number,
                    pickupLocation: $pickupLocation,
                    pickupAddress: $pickupAddress
                ));

                Log::info('✅ Ready for pickup notification sent successfully', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id,
                ]);
            } catch (\Exception $e) {
                Log::error('❌ Failed to send ready for pickup notification', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id ?? null,
                    'error' => $e->getMessage(),
                ]);
            }

            // SR6: Send SMS to receiver - Ready at drop point
            try {
                if ($shipment->receiver_phone) {
                    $smsService = app(MtnSmsService::class);
                    $locale = strtolower((string) ($shipment->user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

                    $smsService->sendLocalized($shipment->receiver_phone, 'smsReadyForPickupDropPoint', [
                        'trackingNumber' => $shipment->order_number,
                        'dropPointName' => $pickupLocation ?? '',
                        'dropPointPhone' => $actor->phone ?? '',
                    ], $locale);
                }
            } catch (\Exception $e) {
                Log::error('❌ Failed to send ready for pickup SMS', [
                    'shipment_id' => $shipment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // If status is delivered, complete the current assignment
        if ($data['status'] === ShipmentStatus::DELIVERED->value) {
            // Always update shipment.status to Delivered for both direct and indirect
            $this->trackingService->completeCurrentStage(
                shipment: $shipment,
                completingUser: $actor,
                newStatus: $data['status'],
                options: [
                    'completion_notes' => 'Delivery completed',
                    'progress_index' => $data['current_index'] ?? null,
                    'update_shipment' => true, // Always update shipment status to Delivered
                ]
            );

            // When delivery is completed by rider or car driver, mark them available again
            if ($actor->hasRole(Role::RIDER->value) || $actor->hasRole(Role::CAR_DRIVER->value)) {
                $actor->availability = 'online';
                $actor->save();
            }

            // Send notification to customer about successful delivery
            if ($shipment->user) {
                try {
                    Log::info('📤 Attempting to send shipment delivered notification', [
                        'shipment_id' => $shipment->id,
                        'order_number' => $shipment->order_number,
                        'customer_id' => $shipment->user->id,
                        'customer_name' => $shipment->user->name,
                        'delivered_by' => $actor->name,
                    ]);

                    $shipment->user->notify(new ShipmentDeliveredNotification(
                        shipmentId: (string) $shipment->id,
                        trackingNumber: $shipment->order_number,
                        riderName: $actor->name,
                        deliveredAt: now()->toDateTimeString()
                    ));

                    Log::info('✅ Shipment delivered notification sent successfully', [
                        'shipment_id' => $shipment->id,
                        'customer_id' => $shipment->user->id,
                    ]);
                } catch (\Exception $e) {
                    Log::error('❌ Failed to send shipment delivered notification', [
                        'shipment_id' => $shipment->id,
                        'customer_id' => $shipment->user->id ?? null,
                        'error' => $e->getMessage(),
                    ]);
                }

                // SR9: Send SMS - Parcel received (to sender, receiver, rider)
                try {
                    $smsService = app(MtnSmsService::class);
                    $locale = strtolower((string) ($shipment->user->language ?? 'en')) === 'ar' ? 'ar' : 'en';
                    $smsParams = ['trackingNumber' => $shipment->order_number];

                    if ($shipment->sender_phone) {
                        $smsService->sendLocalized($shipment->sender_phone, 'smsParcelReceived', $smsParams, $locale);
                    }
                    if ($shipment->receiver_phone) {
                        $smsService->sendLocalized($shipment->receiver_phone, 'smsParcelReceived', $smsParams, $locale);
                    }
                } catch (\Exception $e) {
                    Log::error('❌ Failed to send parcel received SMS', [
                        'shipment_id' => $shipment->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        // Return updated shipment contextually with fresh data
        if ($actor->hasRole(Role::RIDER->value)) {
            return $this->repository->findForRider($shipmentId, $riderId);
        }

        // Refresh the shipment to get the latest status after update
        return Shipment::with(['user', 'rider', 'latestStatusHistory'])->find($shipmentId);
    }

    /**
     * Collect COD payment for a shipment.
     * Supports riders (direct delivery), car drivers (indirect *_to_door modes),
     * and drop point keepers (*_to_drop_point modes).
     *
     * @param  int  $userId  User ID (rider, car driver, or drop point keeper)
     * @param  string  $collectedFrom  'sender' or 'receiver' to determine which party paid
     *
     * @throws \Exception
     */
    public function collectPayment(int $shipmentId, int $userId, string $collectedFrom = 'receiver'): Model
    {
        $user = User::find($userId);
        if (! $user) {
            throw new \Exception('User not found.');
        }

        // Helper for case-insensitive role checks
        $hasRole = function (User $user, string $role): bool {
            $names = array_map('strtolower', $user->getRoleNames()->toArray());

            return in_array(strtolower($role), $names, true);
        };

        // Try to find shipment based on user role
        if ($hasRole($user, Role::RIDER->value)) {
            $shipment = $this->repository->findForRider($shipmentId, $userId);
        } elseif ($hasRole($user, Role::CAR_DRIVER->value)) {
            // For car drivers, check if they have any assignment OR if they delivered the shipment
            // Car drivers can be involved in multiple stages: TO_WAREHOUSE, TO_SECOND_DROP_POINT, FINAL_DELIVERY
            $shipment = $this->repository->find($shipmentId);
            if ($shipment) {
                // Check if car driver has a started assignment
                $hasAssignment = $shipment->assignments()
                    ->where('user_id', $userId)
                    ->where('role', Role::CAR_DRIVER->value)
                    ->whereNotNull('started_at')
                    ->exists();

                // If no assignment, check if they recorded the delivery in status history
                if (! $hasAssignment) {
                    $deliveredByUser = $shipment->statusHistory()
                        ->where('user_id', $userId)
                        ->where('to_status', ShipmentStatus::DELIVERED->value)
                        ->exists();

                    if (! $deliveredByUser) {
                        // Debug: Check what assignments and status history exist
                        $anyAssignment = $shipment->assignments()
                            ->where('user_id', $userId)
                            ->exists();

                        $anyStatusByUser = $shipment->statusHistory()
                            ->where('user_id', $userId)
                            ->exists();

                        $message = 'You are not authorized to collect payment for this shipment. ';
                        if (! $anyAssignment && ! $anyStatusByUser) {
                            $message .= 'You have no assignments or status updates for this shipment.';
                        } elseif ($anyAssignment && ! $hasAssignment) {
                            $message .= 'Your assignment has not been started. Please scan the parcel first.';
                        } elseif ($anyStatusByUser && ! $deliveredByUser) {
                            $message .= 'You did not record the DELIVERED status for this shipment.';
                        }

                        throw new \Exception($message);
                    }
                }
            }
        } elseif ($hasRole($user, Role::DROP_POINT_KEEPER->value)) {
            // For drop point keepers, check if they have an assignment for final delivery or second drop point
            // This applies to *_to_drop_point modes where customer picks up at drop point
            $shipment = $this->repository->find($shipmentId);
            if ($shipment) {
                $hasAssignment = $shipment->assignments()
                    ->where('user_id', $userId)
                    ->whereIn('stage', [
                        \App\Enums\DeliveryStage::FINAL_DELIVERY->value,
                        \App\Enums\DeliveryStage::SECOND_DROP_POINT->value,
                        \App\Enums\DeliveryStage::FIRST_DROP_POINT->value, // For drop_point_to_* modes
                    ])
                    ->where('role', Role::DROP_POINT_KEEPER->value)
                    ->whereNotNull('started_at')
                    ->exists();

                if (! $hasAssignment) {
                    $shipment = null;
                }
            }
        } else {
            throw new \Exception('Only riders, car drivers, or drop point keepers can collect payments.');
        }

        if (! $shipment) {
            throw new \Exception('Job not found or not assigned to you.');
        }

        // Verify this is a COD shipment
        // if ($shipment->payment_method !== 'cash') {
        //     throw new \Exception('This shipment is not a cash on delivery order.');
        // }

        // Verify shipment has been delivered before collecting payment
        // Check delivery status from history instead of status column
        $isDelivered = $shipment->statusHistory()
            ->where('to_status', ShipmentStatus::DELIVERED->value)
            ->exists();

        if ($collectedFrom === 'receiver' && ! $isDelivered) {
            throw new \Exception('Payment can only be collected after the shipment has been delivered.');
        }

        // Verify payment not already collected
        $collectedFromNormalized = in_array(strtolower(trim($collectedFrom)), ['sender', 'receiver'], true)
            ? strtolower(trim($collectedFrom))
            : 'receiver';

        if ($collectedFromNormalized === 'sender' && strtolower($shipment->sender_payment_status ?? 'pending') === 'paid') {
            throw new \Exception('Sender payment has already been collected for this shipment.');
        }

        if ($collectedFromNormalized === 'receiver' && strtolower($shipment->payment_status ?? 'pending') === 'paid') {
            throw new \Exception('Payment has already been collected for this shipment.');
        }

        // Determine transaction type based on role
        if ($hasRole($user, Role::CAR_DRIVER->value)) {
            $transactionType = 'car_driver_collection';
            $collectorLabel = 'car driver';
        } elseif ($hasRole($user, Role::DROP_POINT_KEEPER->value)) {
            $transactionType = 'drop_point_keeper_collection';
            $collectorLabel = 'drop point keeper';
        } else {
            $transactionType = 'rider_collection';
            $collectorLabel = 'rider';
        }

        // Determine collection amount: use parcel_amount if available, otherwise use total_fee
        $collectionAmount = $shipment->parcel_amount ?? $shipment->total_fee ?? 0;

        // Check if user has a COD collection limit set
        if ($user->cod_collection_limit && $user->cod_collection_limit > 0) {
            // Calculate total COD collected today by this user
            $todayCollected = PaymentTransaction::where('rider_id', $userId)
                ->where('payment_method', 'cash')
                ->where('status', 'completed')
                ->whereNotNull('collected_at')
                ->whereDate('collected_at', today())
                ->sum('amount');

            // Check if collecting this amount would exceed the daily limit
            $totalAfterCollection = $todayCollected + $collectionAmount;
            if ($totalAfterCollection > $user->cod_collection_limit) {
                $formattedLimit = number_format($user->cod_collection_limit, 0);
                $formattedCollected = number_format($todayCollected, 0);
                $formattedAmount = number_format($collectionAmount, 0);
                throw new \Exception("Cannot collect this payment. Your daily COD collection limit is SYP {$formattedLimit}. You have already collected SYP {$formattedCollected} today. Collecting this payment (SYP {$formattedAmount}) would exceed your limit.");
            }
        }

        // Create payment transaction record
        PaymentTransaction::create([
            'shipment_id' => $shipmentId,
            'rider_id' => $userId, // Note: This column name is misleading, it actually stores user_id for any collector
            'transaction_type' => $transactionType,
            'amount' => $collectionAmount,
            'payment_method' => 'cash',
            'status' => 'completed',
            'collected_at' => now(),
            'notes' => "Cash collected from customer by {$collectorLabel} (collected from: {$collectedFromNormalized})",
        ]);

        // Mark payment as collected and update status to Pending Handover
        if (! $hasRole($user, Role::DROP_POINT_KEEPER->value)) {
            $statusUpdate = [
                'status' => ShipmentStatus::PENDING_HANDOVER->value,
            ];
        }

        if ($collectedFromNormalized === 'sender') {
            $statusUpdate['sender_payment_status'] = 'paid';
        } else {
            $statusUpdate['payment_status'] = 'paid';
        }
        $this->repository->update($shipmentId, $statusUpdate);

        // Record status change in tracking system
        $this->trackingService->recordStatusChange(
            shipment: $shipment,
            newStatus: $hasRole($user, Role::DROP_POINT_KEEPER->value) ? $shipment->status : ShipmentStatus::PENDING_HANDOVER->value,
            user: $user,
            options: [
                'notes' => 'Payment collected, pending handover',
                'metadata' => [
                    'payment_collected_by' => $collectorLabel,
                    'collected_from' => $collectedFromNormalized,
                ],
            ]
        );

        // Return shipment based on role
        if ($hasRole($user, Role::RIDER->value)) {
            return $this->repository->findForRider($shipmentId, $userId);
        }

        // For car drivers and drop point keepers, return the full shipment
        return $this->repository->find($shipmentId);
    }

    /**
     * Scan and assign parcel to user (supports all roles and stages).
     * For indirect shipments, automatically detects the stage and creates self-assignment.
     *
     * @throws \Exception
     */
    public function scanParcel(int $shipmentId, int $userId): Model
    {
        $shipment = $this->repository->find($shipmentId);

        if (! $shipment) {
            throw new \Exception('Shipment not found.');
        }

        $user = User::find($userId);

        if (! $user) {
            throw new \Exception('User not found.');
        }

        $this->ensureUserMatchesShipmentZone($shipment, $user);

        if ($shipment->status == ShipmentStatus::INCOMPLETE->value) {
            return $this->cancelScanParcel($shipment);
        }

        // Ensure we have the freshest status from history before blocking scans
        $shipment->loadMissing(['latestStatusHistory', 'statusHistory']);
        $currentStatus = $this->getCurrentWorkflowStatus($shipment);

        // Check if shipment is already in a final status
        if ($this->isFinalStatus($currentStatus, $shipment->delivery_speed)) {
            throw new \Exception('This shipment has already been completed with status: '.$currentStatus);
        }

        // Helper for case-insensitive role checks
        $hasRole = function (User $user, string $role): bool {
            $names = array_map('strtolower', $user->getRoleNames()->toArray());

            return in_array(strtolower($role), $names, true);
        };

        // Determine if this is an indirect shipment
        $isIndirect = $shipment->delivery_speed === 'indirect';

        // Check if this is initial assignment (pending/created/Assigned status)
        // Note: DISPATCHED_TO_WAREHOUSE is NOT initial assignment for droppoint_to_* modes
        $isInitialAssignment = in_array($shipment->status, ['pending', 'created', 'Assigned', 'Pending'], true);

        // For initial assignment (both direct and indirect door_to_* modes), use original logic
        if ($isInitialAssignment) {
            // For drop_point_to_* modes, drop point keeper can scan for initial receipt from customer
            // For other modes, only riders can scan for initial pickup
            $isDropPointMode = $isIndirect && in_array($shipment->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true);

            if ($isDropPointMode && ! $hasRole($user, Role::DROP_POINT_KEEPER->value)) {
                throw new \Exception('Only drop point keepers can scan parcels for drop point deliveries.');
            } elseif (! $isDropPointMode && ! $hasRole($user, Role::RIDER->value)) {
                throw new \Exception('Only riders can scan parcels for initial pickup.');
            }

            // Handle drop point keeper scanning for drop_point_to_* modes
            if ($isDropPointMode) {
                // Check if already scanned by this keeper
                $existingAssignment = $this->trackingService->getAssignmentForUserAndStage(
                    shipment: $shipment,
                    user: $user,
                    stage: DeliveryStage::FIRST_DROP_POINT->value
                );

                if ($existingAssignment) {
                    // Already scanned, just return the shipment
                    return $this->repository->find($shipmentId);
                }

                // Check COD limit for drop point keepers only if they will collect payment
                // For drop_point_to_drop_point mode, DP keeper at DP2 will collect payment
                if ($shipment->indirect_delivery_mode === 'drop_point_to_drop_point') {
                    $codCheck = $this->checkCodLimitForAssignment(
                        $user,
                        $shipment,
                        Role::DROP_POINT_KEEPER->value,
                        DeliveryStage::FIRST_DROP_POINT->value
                    );
                    if (! $codCheck['can_accept']) {
                        throw new \Exception($codCheck['reason']);
                    }
                }

                // Create assignment for drop point keeper and update status to DELIVERED_TO_DROP_POINT_1
                // This confirms customer has delivered the parcel to the drop point
                $this->trackingService->assignAndUpdateStatus(
                    shipment: $shipment,
                    user: $user,
                    newStatus: ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
                    role: Role::DROP_POINT_KEEPER->value,
                    stage: DeliveryStage::FIRST_DROP_POINT->value,
                    options: [
                        'assignment_notes' => 'Customer dropped off parcel at drop point',
                        'status_notes' => 'Drop point keeper confirmed receipt from customer',
                        'metadata' => ['scan_method' => 'qr_code', 'drop_point_mode' => true],
                    ]
                );

                return $this->repository->find($shipmentId);
            }

            // Handle rider scanning for door_to_* modes and direct deliveries
            // Check if shipment is already assigned to another rider
            if ($shipment->rider_id && $shipment->rider_id !== $userId) {
                throw new \Exception('This parcel is already assigned to another rider.');
            }

            $isNewAssignment = ! $shipment->rider_id;

            // Update shipment rider_id (for backward compatibility)
            $this->repository->update($shipmentId, ['rider_id' => $userId]);

            // Refresh shipment
            $shipment = $this->repository->find($shipmentId);

            $stage = DeliveryStage::PICKUP->value;
            $role = 'rider';

            // If this is a new assignment, create assignment and record "Assigned" status first
            if ($isNewAssignment) {
                // Check COD limit before allowing assignment
                $codCheck = $this->checkCodLimitForAssignment($user, $shipment, $role, $stage);
                if (! $codCheck['can_accept']) {
                    throw new \Exception($codCheck['reason']);
                }

                // Always record "Assigned" status when a new rider is assigned via scan
                $this->trackingService->assignAndUpdateStatus(
                    shipment: $shipment,
                    user: $user,
                    newStatus: 'Assigned',
                    role: $role,
                    stage: $stage,
                    options: [
                        'assignment_notes' => 'Self-assigned via QR scan',
                        'status_notes' => 'Rider scanned and accepted the job',
                        'metadata' => ['scan_method' => 'qr_code'],
                    ]
                );
            } else {
                // Just update the status if already assigned
                $this->trackingService->recordStatusChange(
                    shipment: $shipment,
                    newStatus: $shipment->status, // Keep current status
                    user: $user,
                    options: [
                        'notes' => 'Parcel re-scanned',
                        'metadata' => ['scan_method' => 'qr_code'],
                    ]
                );
            }

            return $this->repository->findForRider($shipmentId, $userId);
        }

        // For direct shipments after initial assignment, scanning is not typically used
        // Direct flow uses status update API instead
        if (! $isIndirect) {
            throw new \Exception('Direct shipments should use status update API after initial pickup. Current status: '.$shipment->status);
        }

        // Handle indirect shipment scanning - determine stage and role based on current status
        // Incomplete is treated as cancelled flow and resolved from incomplete_status.
        $scanStatus = $this->resolveScanStatus($shipment);
        $stageInfo = $this->determineIndirectStageFromStatus($scanStatus, $user, $hasRole, $shipment);

        if (! $stageInfo) {
            throw new \Exception('Cannot scan parcel at current status: '.$shipment->status);
        }

        if ($hasRole($user, Role::CAR_DRIVER->value) || $hasRole($user, Role::RIDER->value)) {
            $shipment->shelf_id = null;
            $shipment->save();
        }

        if ($stageInfo['stage'] == 'second_drop_point') {
            $this->autoAssignDeliveryRider($shipment->id, ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value);

            if ($shipment->receiver_id) {
                $reciever = User::find($shipment->receiver_id);
                $reciever->notify(new GenericNotification(
                    shipmentId: $shipment->id,
                    trackingNumber: $shipment->order_number ?? '-',
                    title: 'dbTitleRecieverOrderReady',
                    description: 'dbBodyRecieverOrderReady',
                    type: 'shipment',
                    icon: 'payment',
                    extraDataDescription: [
                        'paymentLink' => route('customer.shipments.receiving_parcels_show', $shipment->id) ?? '',
                    ]
                ));
            }

            if ($shipment->receiver_id && $shipment->receiver_phone) {
                $paymeraPaymentService = app(OnlinePaymentController::class);

                $smsService = app(MtnSmsService::class);
                $locale = strtolower((string) ($user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

                $link = $shipment->receiver_id ? route('customer.shipments.receiving_parcels_show', $shipment->id) : route('customer.shipments.show', helpers::getTrackShipmentId($shipment->id));

                if ($paymeraPaymentService) {
                    $data = [
                        'payment_type' => 'existing_shipment',
                        'payer_type' => 'receiver',
                        'shipment_id' => $shipment->id,
                        'payment_method' => 'online',
                    ];
                    $res = $paymeraPaymentService->createPaymeraPayment($data, $reciever);
                    $link = $res['payment_url'] ?? $link;
                }

                $smsService->sendLocalized($shipment->receiver_phone, 'smsRecieverOrderReady', [
                    'paymentLink' => $link,
                    'orderNumber' => $shipment->order_number ?? '',
                    'price' => $shipment->reciever_amount ?? 0,
                ], $locale);
            }
        }

        // // Validate user role matches expected role for this stage
        // if (!$hasRole($user, $stageInfo['expected_role'])) {
        //     throw new \Exception(
        //         "Only {$stageInfo['expected_role']} can scan parcels at this stage. Current status: {$shipment->status}"
        //     );
        // }

        // Check if user already has an assignment for this stage
        $existingAssignment = $this->trackingService->getAssignmentForUserAndStage(
            shipment: $shipment,
            user: $user,
            stage: $stageInfo['stage']
        );

        if ($existingAssignment) {
            // If already assigned, just start it if not started
            if (! $existingAssignment->started_at) {
                $this->trackingService->startAssignment($existingAssignment);

                // Auto-update status for car drivers (they scan and immediately take possession)
                // Also auto-update for drop point keepers when marking parcel as READY_FOR_PICKUP
                $shouldAutoUpdate = ($hasRole($user, Role::CAR_DRIVER->value) && isset($stageInfo['next_status']))
                    || ($hasRole($user, Role::DROP_POINT_KEEPER->value) && isset($stageInfo['next_status']) && $stageInfo['next_status'] === ShipmentStatus::READY_FOR_PICKUP->value);

                if ($shouldAutoUpdate) {
                    $this->trackingService->recordStatusChange(
                        shipment: $shipment,
                        newStatus: $stageInfo['next_status'],
                        user: $user,
                        options: [
                            'notes' => 'Status updated automatically on scan',
                            'metadata' => ['scan_method' => 'qr_code', 'auto_updated' => true],
                        ]
                    );
                }
            }

            return $this->repository->find($shipmentId);
        }

        // Check COD limit before creating assignment
        $codCheck = $this->checkCodLimitForAssignment(
            $user,
            $shipment,
            $stageInfo['expected_role'],
            $stageInfo['stage']
        );
        if (! $codCheck['can_accept']) {
            throw new \Exception($codCheck['reason']);
        }

        // Create self-assigned assignment for individual delivery tracking
        // assigned_by_id = user_id indicates self-assignment
        $assignment = \App\Models\ShipmentAssignment::create([
            'shipment_id' => $shipment->id,
            'user_id' => $user->id,
            'assigned_by_id' => $user->id, // Self-assignment for individual delivery
            'role' => $stageInfo['expected_role'],
            'stage' => $stageInfo['stage'],
            'assigned_at' => now(),
            'started_at' => now(), // Auto-start on scan
            'notes' => 'Self-assigned via QR scan for individual delivery',
        ]);

        // Auto-update status for car drivers (they scan and immediately take possession)
        // Also auto-update for drop point keepers when marking parcel as READY_FOR_PICKUP
        $shouldAutoUpdate = ($hasRole($user, Role::CAR_DRIVER->value) && isset($stageInfo['next_status']))
            || ($hasRole($user, Role::DROP_POINT_KEEPER->value) && isset($stageInfo['next_status']) && $stageInfo['next_status'] === ShipmentStatus::READY_FOR_PICKUP->value);

        if ($shouldAutoUpdate) {
            $this->trackingService->recordStatusChange(
                shipment: $shipment,
                newStatus: $stageInfo['next_status'],
                user: $user,
                options: [
                    'notes' => 'Status updated automatically on scan',
                    'metadata' => ['scan_method' => 'qr_code', 'auto_updated' => true],
                ]
            );
        }

        $shipment = $this->repository->find($shipmentId);

        // Add suggested next status as metadata for the response (for roles that don't auto-update)
        // Exclude if status was already auto-updated (car drivers and DP keepers marking READY_FOR_PICKUP)
        $wasAutoUpdated = ($hasRole($user, Role::CAR_DRIVER->value) && isset($stageInfo['next_status']))
            || ($hasRole($user, Role::DROP_POINT_KEEPER->value) && isset($stageInfo['next_status']) && $stageInfo['next_status'] === ShipmentStatus::READY_FOR_PICKUP->value);

        if ($shipment && $stageInfo && isset($stageInfo['next_status']) && ! $wasAutoUpdated) {
            $shipment->suggested_next_status = $stageInfo['next_status'];
        }

        return $shipment;
    }

    private function cancelScanParcel($shipment)
    {
        if ($shipment->delivery_speed == 'direct') {
            $this->determineCancelIndirectStageFromStatus($shipment->incomplete_status, $shipment);
        } else {
            $this->determineCancelIndirectStageFromStatus($shipment->incomplete_status, $shipment);
        }

        return $shipment;
    }

    private function determineCancelIndirectStageFromStatus(string $currentStatus, Shipment $shipment)
    {
        if ($shipment->incomplete_assign_id == auth()->user()->id) {
            return $shipment;
        }

        if ($currentStatus == ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value) {
            $shipment->incomplete_status = ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value;
            $shipment->incomplete_assign_id = auth()->user()->id;
            $shipment->save();

            $sender = User::find($shipment->user_id);
            $superadmin = User::whereHas('roles', function ($q) {
                $q->where('name', 'superadmin');
            })->first();

            if ($superadmin) {
                $superadmin->notify(new ShipmentIncompleteDroppointNotification(
                    shipmentId: (string) $shipment->id,
                    trackingNumber: $shipment->order_number,
                ));
            }
            $sender->notify(new ShipmentIncompleteDroppointNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
            ));
        }

        if ($currentStatus == ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value) {
            $shipment->incomplete_status = $shipment->is_diff_city ? ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value : ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value;
            $shipment->incomplete_assign_id = auth()->user()->id;
            $shipment->save();
        }

        if ($currentStatus == ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value) {
            $shipment->incomplete_status = ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value;
            $shipment->incomplete_assign_id = auth()->user()->id;
            $shipment->save();
        }

        if ($currentStatus == ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value) {
            $shipment->incomplete_status = ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value;
            $shipment->incomplete_assign_id = auth()->user()->id;
            $shipment->save();
        }

        if ($currentStatus == ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value) {
            $shipment->incomplete_status = ShipmentStatus::ARRIVED_AT_WAREHOUSE->value;
            $shipment->incomplete_assign_id = auth()->user()->id;
            $shipment->save();

            $sender = User::find($shipment->user_id);
            $superadmin = User::whereHas('roles', function ($q) {
                $q->where('name', 'superadmin');
            })->first();

            if ($superadmin) {
                $superadmin->notify(new ShipmentIncompletePickUpNotification(
                    shipmentId: (string) $shipment->id,
                    trackingNumber: $shipment->order_number,
                    title: 'dbTitleShipmentIncompleteWareHouseAdmin',
                    description: 'dbBodyShipmentIncompleteWareHouseAdmin'
                ));
            }

            $sender->notify(new ShipmentIncompletePickUpNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                title: 'dbTitleShipmentIncompleteWareHouseSender',
                description: 'dbBodyShipmentIncompleteWareHouseSender'
            ));
        }
    }

    /**
     * Determine the stage, role, and next status for scanning based on current shipment status.
     * This is used for indirect shipments to intelligently handle scanning at various stages.
     *
     * @return array|null ['stage' => string, 'expected_role' => string, 'next_status' => string|null]
     */
    private function determineIndirectStageFromStatus(string $currentStatus, User $user, callable $hasRole, Shipment $shipment): ?array
    {
        $isIncompleteCancellationFlow = $this->isIncompleteCancellationFlow($shipment);

        // Incomplete is business-equivalent to cancelled. Start reverse processing from the stored prior status.
        if ($isIncompleteCancellationFlow && $currentStatus === ShipmentStatus::INCOMPLETE->value) {
            $currentStatus = $shipment->incomplete_status ?: ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value;
        }

        // Reverse flow override for cancelled/incomplete shipments:
        // from DP2 keeper, next step should be dispatch back to warehouse (not receiver flow).
        if (
            $isIncompleteCancellationFlow
            && in_array($currentStatus, [
                ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
                ShipmentStatus::READY_FOR_PICKUP->value,
            ], true)
        ) {
            return [
                'stage' => DeliveryStage::SECOND_DROP_POINT->value,
                'expected_role' => Role::DROP_POINT_KEEPER->value,
                'next_status' => ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            ];
        }

        // Flow switch based on shipment flag:
        // - is_diff_city=false => legacy Warehouse -> Drop Point 2 flow
        // - is_diff_city=true  => Warehouse 2 flow
        $useWarehouse2Flow = $this->shouldRouteViaWarehouse2($shipment);
        $pickupFromWarehouseNextStatus = $useWarehouse2Flow
            ? ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value
            : ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value;

        // Safety guard: local-city shipments cannot scan Warehouse 2-only statuses.
        if (
            ! $useWarehouse2Flow &&
            in_array($currentStatus, [
                ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
                ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
                ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
                ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ], true)
        ) {
            return null;
        }

        // Map current status to expected scanning stage info
        $stageMap = [
            // After rider arrives at drop point 1, drop point keeper should scan
            ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value => [
                'stage' => DeliveryStage::FIRST_DROP_POINT->value,
                'expected_role' => Role::DROP_POINT_KEEPER->value,
                'next_status' => null, // Keep status, keeper will dispatch when ready
            ],
            ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value => [
                'stage' => DeliveryStage::FIRST_DROP_POINT->value,
                'expected_role' => Role::DROP_POINT_KEEPER->value,
                'next_status' => null,
            ],

            // After dispatch to warehouse, car driver should scan to start transit
            ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value => [
                'stage' => DeliveryStage::TO_WAREHOUSE->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            ],

            // After car driver picks up from drop point 1, they can continue scanning
            ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value => [
                'stage' => DeliveryStage::TO_WAREHOUSE->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            ],

            // In transit to warehouse - car driver continues
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value => [
                'stage' => DeliveryStage::TO_WAREHOUSE->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            ],

            // After car driver arrives at warehouse, warehouse keeper can scan
            ShipmentStatus::ARRIVED_AT_WAREHOUSE->value => [
                'stage' => DeliveryStage::WAREHOUSE->value,
                'expected_role' => Role::WAREHOUSE_KEEPER->value,
                'next_status' => null, // Warehouse will process and dispatch when ready
            ],

            // After dispatch from warehouse, car driver should scan for return trip
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value => [
                'stage' => DeliveryStage::TO_SECOND_DROP_POINT->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            ],

            // After car driver picks up from warehouse
            ShipmentStatus::PICKUP_FROM_WAREHOUSE->value => [
                'stage' => DeliveryStage::TO_SECOND_DROP_POINT->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => $pickupFromWarehouseNextStatus,
            ],

            // Optional Warehouse 2 leg (car driver 2)
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value => [
                'stage' => DeliveryStage::TO_WAREHOUSE_2->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            ],

            // Warehouse 2 receiving/processing (warehouse keeper 2)
            ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value => [
                'stage' => DeliveryStage::WAREHOUSE_2->value,
                'expected_role' => Role::WAREHOUSE_KEEPER->value,
                'next_status' => null,
            ],

            // Warehouse 2 dispatch to final drop point
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value => [
                'stage' => DeliveryStage::TO_SECOND_DROP_POINT->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ],

            ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value => [
                'stage' => DeliveryStage::TO_SECOND_DROP_POINT->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            ],

            // In transit to drop point 2
            ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value => [
                'stage' => DeliveryStage::TO_SECOND_DROP_POINT->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            ],

            // After car driver arrives at drop point 2
            // For door_to_door: keeper scans and manually dispatches for car driver final delivery
            // For drop_point_to_door: keeper scans and manually dispatches for car driver final delivery
            // For *_to_drop_point modes: keeper processes the parcel for customer pickup
            ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value => [
                'stage' => DeliveryStage::SECOND_DROP_POINT->value,
                'expected_role' => match ($shipment->indirect_delivery_mode) {
                    'door_to_door' => Role::DROP_POINT_KEEPER->value, // Keeper scans and dispatches for car driver
                    'drop_point_to_door' => Role::DROP_POINT_KEEPER->value, // Keeper scans and dispatches for car driver
                    'door_to_drop_point', 'drop_point_to_drop_point' => Role::DROP_POINT_KEEPER->value, // Keeper marks ready for pickup
                    default => Role::DROP_POINT_KEEPER->value,
                },
                'next_status' => match ($shipment->indirect_delivery_mode) {
                    'door_to_door' => null, // Keeper manually dispatches (status stays at ARRIVED_AT_DROP_POINT_2)
                    'drop_point_to_door' => null, // Keeper manually dispatches (status stays at ARRIVED_AT_DROP_POINT_2)
                    'door_to_drop_point', 'drop_point_to_drop_point' => ShipmentStatus::READY_FOR_PICKUP->value, // Auto-ready for customer
                    default => ShipmentStatus::READY_FOR_PICKUP->value,
                },
            ],

            // After keeper dispatches from drop point 2 for door delivery (*_to_door modes)
            // Car driver scans to pick up and deliver to customer's door
            ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value => [
                'stage' => DeliveryStage::FINAL_DELIVERY->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            ],

            // After ready for pickup, customer picks up (no rider for *_to_droppoint modes)
            // Drop Point Keeper will mark as DELIVERED when handing over to customer
            ShipmentStatus::READY_FOR_PICKUP->value => [
                'stage' => DeliveryStage::FINAL_DELIVERY->value,
                'expected_role' => Role::DROP_POINT_KEEPER->value,
                'next_status' => ShipmentStatus::DELIVERED->value, // Keeper marks delivered when customer picks up
            ],
            ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value => [
                'stage' => DeliveryStage::FINAL_DELIVERY->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
            ],
            ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value => [
                'stage' => DeliveryStage::FINAL_DELIVERY->value,
                'expected_role' => Role::CAR_DRIVER->value,
                'next_status' => ShipmentStatus::DELIVERED->value,
            ],

            // Legacy status mapping - these need special handling based on user role
            // The expected_role will be validated dynamically below
        ];

        // For legacy statuses (Pickup, In Transit), we need to determine the expected role
        // based on the user's actual role since these can be set by multiple actors
        $legacyStatuses = [
            ShipmentStatus::PICKUP->value,
            ShipmentStatus::IN_TRANSIT->value,
        ];

        if (in_array($currentStatus, $legacyStatuses, true)) {
            // Determine role and next status based on who is scanning
            // Check in order of priority: rider first, then car driver
            if ($hasRole($user, Role::RIDER->value)) {
                return [
                    'stage' => DeliveryStage::PICKUP->value,
                    'expected_role' => Role::RIDER->value,
                    'next_status' => $currentStatus === ShipmentStatus::PICKUP->value
                        ? ShipmentStatus::IN_TRANSIT->value
                        : ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
                ];
            } elseif ($hasRole($user, Role::CAR_DRIVER->value)) {
                return [
                    'stage' => DeliveryStage::TO_WAREHOUSE->value,
                    'expected_role' => Role::CAR_DRIVER->value,
                    'next_status' => $currentStatus === ShipmentStatus::PICKUP->value
                        ? ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value
                        : ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
                ];
            } elseif ($hasRole($user, Role::DROP_POINT_KEEPER->value)) {
                // Allow keeper to scan at these legacy statuses too
                return [
                    'stage' => DeliveryStage::FIRST_DROP_POINT->value,
                    'expected_role' => Role::DROP_POINT_KEEPER->value,
                    'next_status' => ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
                ];
            } elseif ($hasRole($user, Role::WAREHOUSE_KEEPER->value)) {
                // Allow warehouse keeper to scan at these legacy statuses too
                return [
                    'stage' => DeliveryStage::WAREHOUSE->value,
                    'expected_role' => Role::WAREHOUSE_KEEPER->value,
                    'next_status' => ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
                ];
            }
        }

        // Delivered status - no more scanning needed
        if ($currentStatus === ShipmentStatus::DELIVERED->value) {
            return [
                'stage' => DeliveryStage::FINAL_DELIVERY->value,
                'expected_role' => Role::RIDER->value,
                'next_status' => null, // Delivery completed
            ];
        }

        return $stageMap[$currentStatus] ?? null;
    }

    /**
     * Decide whether shipment should use Warehouse 2 flow.
     * When `is_diff_city` is false (or missing), legacy flow remains unchanged.
     */
    private function shouldRouteViaWarehouse2(Shipment $shipment): bool
    {
        return (bool) ($shipment->is_diff_city ?? false);
    }

    /**
     * Resolve the status to use for scan-stage calculations.
     * Incomplete is treated as cancelled and resumed from incomplete_status.
     */
    private function resolveScanStatus(Shipment $shipment): string
    {
        if (($shipment->status ?? null) === ShipmentStatus::INCOMPLETE->value) {
            return $shipment->incomplete_status ?: ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value;
        }

        return $shipment->status ?? ShipmentStatus::PENDING->value;
    }

    /**
     * Detect whether this shipment should follow the cancelled reverse flow.
     */
    private function isIncompleteCancellationFlow(Shipment $shipment): bool
    {
        if (($shipment->status ?? null) === ShipmentStatus::INCOMPLETE->value) {
            return true;
        }

        if (empty($shipment->incomplete_status)) {
            return false;
        }

        $reverseStatuses = [
            ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
        ];

        return in_array($shipment->incomplete_status, $reverseStatuses, true);
    }

    /**
     * Final statuses differ between direct and indirect flows.
     */
    private function finalStatusesForFlow(?string $deliverySpeed): array
    {
        $statuses = [
            ShipmentStatus::DELIVERED->value,
            ShipmentStatus::CANCELLED->value,
            ShipmentStatus::FAILED->value,
            ShipmentStatus::RETURNED->value,
        ];

        if ($deliverySpeed === 'indirect') {
            $statuses[] = ShipmentStatus::PICKED_UP_BY_RECEIVER->value;
        }

        return $statuses;
    }

    /**
     * Determine the latest workflow status for a shipment.
     */
    private function getCurrentWorkflowStatus(Shipment $shipment): string
    {
        if ($shipment->relationLoaded('latestStatusHistory') && $shipment->latestStatusHistory) {
            return $shipment->latestStatusHistory->to_status;
        }

        if ($shipment->relationLoaded('statusHistory') && $shipment->statusHistory?->isNotEmpty()) {
            return $shipment->statusHistory->last()->to_status;
        }

        return $shipment->status ?? 'Pending';
    }

    /**
     * Determine if the provided status should be treated as a final state for the current flow.
     */
    private function isFinalStatus(?string $status, ?string $deliverySpeed): bool
    {
        if (! $status) {
            return false;
        }

        $finalStatuses = array_map('strtolower', $this->finalStatusesForFlow($deliverySpeed));

        return in_array(strtolower($status), $finalStatuses, true);
    }

    /**
     * Ensure the authenticated operational user matches the shipment's zone.
     *
     * @throws \Exception
     */
    private function ensureUserMatchesShipmentZone(Shipment $shipment, User $user): void
    {
        if (($shipment->zone_id !== null && ! $user->hasZone((int) $shipment->zone_id)) && ($shipment->delivery_zone_id !== null && ! $user->hasZone((int) $shipment->delivery_zone_id))) {
            throw new \Exception('This shipment belongs to a different zone. Please contact your supervisor for reassignment.');
        }
    }

    /**
     * Check if a user can accept a new shipment based on their COD collection limit.
     * For direct deliveries: Check the rider's limit.
     * For indirect deliveries: Check based on who will collect payment (usually final delivery employee).
     *
     * @param  User  $user  The employee to check
     * @param  Shipment  $shipment  The shipment being assigned
     * @param  string|null  $role  The role of the employee for this assignment
     * @param  string|null  $stage  The delivery stage being assigned
     * @return array ['can_accept' => bool, 'reason' => string|null, 'collected_today' => float, 'pending_cod' => float, 'limit' => float]
     */
    public function checkCodLimitForAssignment(User $user, Shipment $shipment, ?string $role = null, ?string $stage = null): array
    {
        // If user has no COD limit set, they can accept unlimited shipments
        if (! $user->cod_collection_limit || $user->cod_collection_limit <= 0) {
            return [
                'can_accept' => true,
                'reason' => null,
                'collected_today' => 0,
                'pending_cod' => 0,
                'limit' => 0,
            ];
        }

        // If payment method is not cash, COD limit doesn't apply
        if ($shipment->payment_method !== 'cash') {
            return [
                'can_accept' => true,
                'reason' => null,
                'collected_today' => 0,
                'pending_cod' => 0,
                'limit' => $user->cod_collection_limit,
            ];
        }

        // Determine if this user will be responsible for collecting payment
        $willCollectPayment = $this->willUserCollectPayment($user, $shipment, $role, $stage);

        // If user won't collect payment for this shipment, COD limit doesn't apply
        if (! $willCollectPayment) {
            return [
                'can_accept' => true,
                'reason' => null,
                'collected_today' => 0,
                'pending_cod' => 0,
                'limit' => $user->cod_collection_limit,
            ];
        }

        // Calculate total COD already collected today by this user
        $todayCollected = PaymentTransaction::where('rider_id', $user->id)
            ->where('payment_method', 'cash')
            ->where('status', 'completed')
            ->whereNotNull('collected_at')
            ->whereDate('collected_at', today())
            ->sum('amount');

        // Calculate pending COD (assigned shipments not yet collected)
        $pendingCod = $this->calculatePendingCod($user);

        // Determine the COD amount for this shipment
        $shipmentCodAmount = $shipment->parcel_amount ?? $shipment->total_fee ?? 0;

        // Calculate total after accepting this shipment
        $totalAfterAssignment = $todayCollected + $pendingCod + $shipmentCodAmount;

        // Check if accepting this shipment would exceed the limit
        if ($totalAfterAssignment > $user->cod_collection_limit) {
            $formattedLimit = number_format($user->cod_collection_limit, 0);
            $formattedCollected = number_format($todayCollected, 0);
            $formattedPending = number_format($pendingCod, 0);
            $formattedAmount = number_format($shipmentCodAmount, 0);

            return [
                'can_accept' => false,
                'reason' => "Cannot assign this shipment. Employee's daily COD limit is SYP {$formattedLimit}. Already collected: SYP {$formattedCollected}, Pending collections: SYP {$formattedPending}. This shipment (SYP {$formattedAmount}) would exceed the limit.",
                'collected_today' => $todayCollected,
                'pending_cod' => $pendingCod,
                'limit' => $user->cod_collection_limit,
            ];
        }

        return [
            'can_accept' => true,
            'reason' => null,
            'collected_today' => $todayCollected,
            'pending_cod' => $pendingCod,
            'limit' => $user->cod_collection_limit,
        ];
    }

    /**
     * Determine if a user will be responsible for collecting payment for a shipment.
     */
    private function willUserCollectPayment(User $user, Shipment $shipment, ?string $role = null, ?string $stage = null): bool
    {
        // Direct delivery: Rider collects payment
        if ($shipment->delivery_speed === 'direct') {
            return $user->hasRole(Role::RIDER->value);
        }

        // Indirect delivery: Determine based on indirect_delivery_mode
        if ($shipment->delivery_speed === 'indirect') {
            $mode = $shipment->indirect_delivery_mode;

            // For door_to_door and drop_point_to_door: Car driver delivers to customer's door and collects payment
            if (in_array($mode, ['door_to_door', 'drop_point_to_door'])) {
                return $user->hasRole(Role::CAR_DRIVER->value) &&
                    ($stage === DeliveryStage::FINAL_DELIVERY->value || $stage === null);
            }

            // For door_to_drop_point and drop_point_to_drop_point: Drop point keeper at DP2 collects when customer picks up
            if (in_array($mode, ['door_to_drop_point', 'drop_point_to_drop_point'])) {
                return $user->hasRole(Role::DROP_POINT_KEEPER->value) &&
                    ($stage === DeliveryStage::SECOND_DROP_POINT->value || $stage === null);
            }
        }

        // Default: If we can't determine, assume they might collect (safer to check limit)
        return true;
    }

    /**
     * Calculate pending COD for a user (shipments assigned but payment not yet collected).
     */
    private function calculatePendingCod(User $user): float
    {
        // Get all shipments assigned to this user that are:
        // - Payment method is cash
        // - Payment status is not 'paid'
        // - Not in a final status (delivered/cancelled/returned)

        // Only exclude cancelled and returned (not delivered, as delivered shipments may still have pending payment)
        $excludedStatuses = [
            ShipmentStatus::CANCELLED->value,
            ShipmentStatus::RETURNED->value,
        ];

        // For direct deliveries assigned to this rider
        // Include delivered shipments that haven't been paid yet (payment_status != 'paid')
        $directPending = Shipment::where('rider_id', $user->id)
            ->where('delivery_speed', 'direct')
            ->where('payment_method', 'cash')
            ->where('payment_status', '!=', 'paid')
            ->whereNotIn('status', $excludedStatuses)
            ->sum('parcel_amount');

        // For indirect deliveries, check assignments based on role
        $indirectPending = 0;

        if ($user->hasRole(Role::CAR_DRIVER->value)) {
            // Car drivers collect for door_to_door and drop_point_to_door modes at final delivery
            $indirectPending += Shipment::where('delivery_speed', 'indirect')
                ->whereIn('indirect_delivery_mode', ['door_to_door', 'drop_point_to_door'])
                ->where('payment_method', 'cash')
                ->where('payment_status', '!=', 'paid')
                ->whereNotIn('status', $excludedStatuses)
                ->whereHas('assignments', function ($query) use ($user) {
                    $query->where('user_id', $user->id)
                        ->where('stage', DeliveryStage::FINAL_DELIVERY->value)
                        ->whereNull('completed_at');
                })
                ->sum('parcel_amount');
        }

        if ($user->hasRole(Role::DROP_POINT_KEEPER->value)) {
            // Drop point keepers collect for *_to_drop_point modes at DP2
            $indirectPending += Shipment::where('delivery_speed', 'indirect')
                ->whereIn('indirect_delivery_mode', ['door_to_drop_point', 'drop_point_to_drop_point'])
                ->where('payment_method', 'cash')
                ->where('payment_status', '!=', 'paid')
                ->whereNotIn('status', $excludedStatuses)
                ->whereHas('assignments', function ($query) use ($user) {
                    $query->where('user_id', $user->id)
                        ->where('stage', DeliveryStage::SECOND_DROP_POINT->value)
                        ->whereNull('completed_at');
                })
                ->sum('parcel_amount');
        }

        return $directPending + $indirectPending;
    }

    /**
     * Update barcode information for a shipment.
     *
     * @param  int  $userId  The ID of the rider/user submitting the barcode
     * @param  string  $barcodeNumber  The barcode number to set
     */
    public function updateBarcode(int $shipmentId, int $userId, string $barcodeNumber): ?Model
    {
        $shipment = $this->repository->find($shipmentId);

        if (! $shipment) {
            return null;
        }

        $this->repository->update($shipmentId, [
            'barcode_number' => $barcodeNumber,
            'barcode_rider_id' => $userId,
        ]);

        // Return shipment with fresh data including barcodeRider relationship
        return Shipment::with(['user', 'rider', 'barcodeRider', 'latestStatusHistory'])->find($shipmentId);
    }

    /**
     * Calculate insurance fee for a new shipment based on current financial settings.
     * This method reads from the raw data array (before the Shipment model is created).
     *
     * @param  array  $data  The shipment data
     * @return float The calculated insurance fee
     */
    private function calculateInsuranceFeeForNewShipment(array $data): float
    {
        // If insurance is not opted in, return 0
        if (! isset($data['insurance']) || strtolower(trim($data['insurance'])) !== 'yes') {
            return 0.0;
        }

        $goodsAmount = isset($data['parcel_amount']) ? (float) $data['parcel_amount'] : 0.0;

        // If goods amount is invalid, return 0
        if ($goodsAmount <= 0) {
            return 0.0;
        }

        // Get insurance configuration from System table
        $insuranceType = \App\Models\System::where('key', 'financial_settings.insurance_type')->value('value');
        $insuranceValue = \App\Models\System::where('key', 'financial_settings.insurance_value')->value('value');
        $insuranceMinAmount = \App\Models\System::where('key', 'financial_settings.insurance_min_amount')->value('value');
        $insuranceMaxAmount = \App\Models\System::where('key', 'financial_settings.insurance_max_amount')->value('value');

        // Parse min and max amounts (remove commas)
        $minBound = $insuranceMinAmount ? (float) str_replace(',', '', $insuranceMinAmount) : 0;
        $maxBound = $insuranceMaxAmount ? (float) str_replace(',', '', $insuranceMaxAmount) : PHP_FLOAT_MAX;

        // Check if goods amount is within bounds
        if ($goodsAmount < $minBound || $goodsAmount > $maxBound) {
            return 0.0;
        }

        // Calculate insurance fee based on type
        $numericInsuranceValue = is_numeric($insuranceValue) ? (float) $insuranceValue : 0;

        if ($insuranceType && str_contains(strtolower(trim($insuranceType)), 'percentage')) {
            return round($goodsAmount * ($numericInsuranceValue / 100), 2);
        }

        return round($numericInsuranceValue, 2);
    }

    /**
     * Resolve the platform fee and VAT amount for a shipment using current financial settings.
     */
    private function resolvePlatformAndVat(array $data): array
    {
        $settings = FinancialSettings::get();
        $platformFee = $this->normalizeDecimalValue($settings['platform_fee'] ?? 0);
        $shipmentFee = $this->normalizeDecimalValue($data['total_fee'] ?? 0);
        $serviceFee = $this->normalizeDecimalValue($data['service_fee'] ?? 0);
        $insuranceFee = $this->normalizeDecimalValue($data['insurance_fee'] ?? 0);

        $vatType = strtolower(trim((string) ($settings['vat_type'] ?? 'Fixed Amount')));
        $vatValue = $this->normalizeDecimalValue($settings['vat_value'] ?? 0);

        $taxableSubtotal = $insuranceFee + $serviceFee + $shipmentFee + $platformFee;
        $vatAmount = $vatType === 'percentage'
            ? round($taxableSubtotal * ($vatValue / 100), 2)
            : round($vatValue, 2);

        return [
            'platform_fee' => round($platformFee, 2),
            'vat_amount' => round(max($vatAmount, 0), 2),
        ];
    }

    private function normalizeDecimalValue(mixed $value): float
    {
        if ($value === null) {
            return 0.0;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }
        $clean = str_replace([',', ' '], '', (string) $value);
        $clean = preg_replace('/[^0-9.-]/', '', $clean);

        return is_numeric($clean) ? (float) $clean : 0.0;
    }
}
