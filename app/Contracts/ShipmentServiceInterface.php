<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;

interface ShipmentServiceInterface
{
    /**
     * Get paginated shipments for a user.
     */
    public function getUserShipments(int $userId, int $perPage = 10, bool $isNormal = true, bool $isReturned = false, ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator;

    public function getUserAllShipments(int $userId, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator;

    public function getReceivedShipments(int $userId, int $perPage = 10, string $booking_type = 'shipment', ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator;

    /**
     * Get paginated shipments received by a user (matched by phone or email).
     */
    public function getReceiverShipments(string $phone, string $email, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator;

    /**
     * Create a new shipment for a user.
     */
    public function createShipment(array $data, int $userId): Model;

    /**
     * Find a shipment by ID.
     */
    public function find(int|string $id): ?Model;

    /**
     * Get jobs for a rider with optional filter.
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getRiderJobs(int $riderId, ?string $filter = 'assigned');

    /**
     * Find a job for a specific rider.
     */
    public function findJobForRider(int $shipmentId, int $riderId): ?Model;

    /**
     * Update shipment status.
     */
    public function updateJobStatus(int $shipmentId, int $riderId, array $data): Model;

    /**
     * Collect COD payment for a shipment.
     */
    public function collectPayment(int $shipmentId, int $riderId, string $collectedFrom = 'receiver'): Model;

    /**
     * Scan and assign parcel to rider.
     */
    public function scanParcel(int $shipmentId, int $riderId): Model;

    public function autoAssign(int $shipmentId): JsonResponse;

    public function autoAssignDeliveryRider(int $shipmentId, string $deliveryStage): JsonResponse;

    /**
     * Request a cancellation for a shipment.
     */
    public function requestCancellation(int $shipmentId, int $userId, string $reason): Model;
}
