<?php

namespace App\Services;

use App\Contracts\ShelfServiceInterface;
use App\Contracts\ShipmentRepositoryInterface;
use App\Models\Shelf;
use App\Models\Shipment;
use App\Repositories\ShelfRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ShelfService extends AbstractService implements ShelfServiceInterface
{
    protected ShelfRepository $shelfRepository;

    public function __construct(
        ShelfRepository $repository,
        private readonly ShipmentRepositoryInterface $shipmentRepository
    ) {
        parent::__construct($repository);
        $this->shelfRepository = $repository;
    }

    public function getAvailableShelves(?string $location = null, ?\App\Models\User $user = null): Collection
    {
        return $this->shelfRepository->getAvailableShelves($location, $user);
    }

    public function assignShelfToShipment(int $shelfId, int $shipmentId): array
    {
        return DB::transaction(function () use ($shelfId, $shipmentId) {
            $shelf = $this->shelfRepository->lockForUpdate($shelfId);

            if (!$shelf) {
                throw (new ModelNotFoundException())->setModel(Shelf::class, [$shelfId]);
            }

            if (!$shelf->is_active) {
                throw new RuntimeException('Selected shelf is not active.');
            }

            $shipment = $this->shipmentRepository->find($shipmentId);

            if (!$shipment) {
                throw (new ModelNotFoundException())->setModel(Shipment::class, [$shipmentId]);
            }

            $previousShelfId = $shipment->shelf_id;

            // if ($shelf->occupied_slots >= $shelf->capacity && $previousShelfId !== $shelf->id) {
            //     throw new RuntimeException('Selected shelf has reached its capacity.');
            // }

            if ($previousShelfId === $shelf->id) {
                if (!$shipment->shelf_assigned_at) {
                    $this->shipmentRepository->update($shipment->id, [
                        'shelf_assigned_at' => now(),
                    ]);
                }

                return [
                    'shelf' => $shelf->fresh(),
                    'shipment' => $shipment->fresh(['shelf']),
                ];
            }

            $this->shipmentRepository->update($shipment->id, [
                'shelf_id' => $shelf->id,
                'shelf_assigned_at' => now(),
            ]);

            $this->shelfRepository->incrementOccupiedSlots($shelf->id);

            if ($previousShelfId && $previousShelfId !== $shelf->id) {
                $this->shelfRepository->decrementOccupiedSlots($previousShelfId);
            }

            return [
                'shelf' => $shelf->fresh(),
                'shipment' => $shipment->fresh(['shelf']),
            ];
        });
    }
}
