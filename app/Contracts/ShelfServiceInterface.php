<?php

namespace App\Contracts;

use Illuminate\Support\Collection;
use Interfaces\BaseServiceInterface;

interface ShelfServiceInterface extends BaseServiceInterface
{
    /**
     * Get shelves that can still accept new shipments.
     */
    public function getAvailableShelves(?string $location = null, ?\App\Models\User $user = null): Collection;

    /**
     * Assign a shelf to a shipment and return the updated models.
     *
     * @return array{shipment: \App\Models\Shipment, shelf: \App\Models\Shelf}
     */
    public function assignShelfToShipment(int $shelfId, int $shipmentId): array;
}
