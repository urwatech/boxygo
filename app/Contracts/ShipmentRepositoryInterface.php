<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;

interface ShipmentRepositoryInterface
{
    /**
     * Get paginated shipments for a specific user.
     *
     * @param int $userId
     * @param int $perPage
     * @return LengthAwarePaginator
     */
    public function getUserShipmentsPaginated(int $userId, int $perPage = 10, bool $isNormal = true, bool $isReturned = false, ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator;

    public function getUserAllShipmentsPaginated(int $userId, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator;

    public function getReceivedShipmentsPaginated(int $userId, int $perPage = 10, string $booking_type = 'shipment', ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator;

    /**
     * Get paginated shipments received by a user (matched by phone or email).
     */
    public function getReceiverShipmentsPaginated(string $phone, string $email, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator;

    /**
     * Create a new shipment.
     *
     * @param array $data
     * @return Model
     */
    public function create(array $data): Model;

    /**
     * Find a shipment by ID.
     *
     * @param int|string $id
     * @return Model|null
     */
    public function find(int|string $id): ?Model;

    /**
     * Update a shipment.
     *
     * @param int|string $id
     * @param array $data
     * @return bool
     */
    public function update(int|string $id, array $data): bool;

    /**
     * Delete a shipment.
     *
     * @param int|string $id
     * @return bool
     */
    public function delete(int|string $id): bool;

    /**
     * Get rider's jobs filtered by status.
     *
     * @param int $riderId
     * @param string|null $filter 'assigned', 'completed', 'all'
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getRiderJobs(int $riderId, ?string $filter = 'assigned');

    /**
     * Get rider's jobs filtered by status with pagination.
     */
    public function getRiderJobsPaginated(int $riderId, ?string $filter = 'assigned', int $perPage = 10, int $page = 1): LengthAwarePaginator;

    /**
     * Find a shipment by ID for a specific rider.
     *
     * @param int $shipmentId
     * @param int $riderId
     * @return Model|null
     */
    public function findForRider(int $shipmentId, int $riderId): ?Model;

    /**
     * Get jobs for Drop Point Keeper.
     * Only returns jobs that the keeper has scanned (has an assignment).
     *
     * @param string|null $filter 'assigned', 'completed', 'all'
     * @param int|null $userId Filter by user ID (only show jobs scanned by this user)
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getDropPointKeeperJobs(?string $filter = 'assigned', ?int $userId = null);

    /**
     * Get paginated jobs for Drop Point Keeper.
     */
    public function getDropPointKeeperJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator;

    /**
     * Find a shipment by ID for Drop Point Keeper context.
     *
     * @param int $shipmentId
     * @return Model|null
     */
    public function findForDropPointKeeper(int $shipmentId): ?Model;

    /**
     * Get jobs for Car Driver (transport between drop point and warehouse).
     * Only returns jobs that the driver has scanned (has an assignment).
     *
     * @param string|null $filter 'assigned', 'completed', 'all'
     * @param int|null $userId Filter by user ID (only show jobs scanned by this user)
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getCarDriverJobs(?string $filter = 'assigned', ?int $userId = null);

    /**
     * Get paginated jobs for Car Driver.
     */
    public function getCarDriverJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator;

    /**
     * Find shipment for Car Driver context (no rider constraint).
     *
     * @param int $shipmentId
     * @return Model|null
     */
    public function findForCarDriver(int $shipmentId): ?Model;

    /**
     * Get jobs for Warehouse Keeper at warehouse stage.
     * Only returns jobs that the keeper has scanned (has an assignment).
     *
     * @param string|null $filter 'assigned', 'completed', 'all'
     * @param int|null $userId Filter by user ID (only show jobs scanned by this user)
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getWarehouseKeeperJobs(?string $filter = 'assigned', ?int $userId = null);

    /**
     * Get paginated jobs for Warehouse Keeper.
     */
    public function getWarehouseKeeperJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator;

    /**
     * Find shipment for Warehouse Keeper context.
     *
     * @param int $shipmentId
     * @return Model|null
     */
    public function findForWarehouseKeeper(int $shipmentId): ?Model;

    /**
     * Get the latest shipment for a specific user.
     *
     * @param int $userId
     * @return Model|null
     */
    public function getLatestUserShipment(int $userId): ?Model;
}
