<?php

namespace App\Services;

use App\Contracts\ZoneServiceInterface;
use App\Models\Zone;
use App\Repositories\ZoneRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Service layer encapsulating zone business logic.
 */
class ZoneService extends AbstractService implements ZoneServiceInterface
{
    protected ZoneRepository $zoneRepository;

    public function __construct(ZoneRepository $repository)
    {
        parent::__construct($repository);
        $this->zoneRepository = $repository;
    }

    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        return $this->zoneRepository->paginateWithFilters($search, $filters, $perPage);
    }

    public function getWithFilters(?string $search = null, array $filters = [])
    {
        return $this->zoneRepository->getWithFilters($search, $filters);
    }

    public function getStatistics(): array
    {
        $total = $this->zoneRepository->countAll();
        $active = $this->zoneRepository->countByStatus(Zone::STATUS_ACTIVE);
        $inactive = $this->zoneRepository->countByStatus(Zone::STATUS_INACTIVE);
        $assigned = $this->zoneRepository->countAssignedToHub(true);
        $unassigned = $this->zoneRepository->countAssignedToHub(false);
        $assignedToWarehouse = $this->zoneRepository->countAssignedToWarehouse();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'assigned' => $assigned,
            'unassigned' => $unassigned,
            'assigned_to_warehouse' => $assignedToWarehouse,
        ];
    }

    public function toggleStatus(int|string $zoneId): bool
    {
        $zone = $this->find($zoneId);

        if (!$zone) {
            return false;
        }

        $zone->status = $zone->status === Zone::STATUS_ACTIVE
            ? Zone::STATUS_INACTIVE
            : Zone::STATUS_ACTIVE;

        return $zone->save();
    }
}

