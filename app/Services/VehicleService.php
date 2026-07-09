<?php

namespace App\Services;

use App\Contracts\VehicleServiceInterface;
use App\Models\Vehicle;
use App\Repositories\VehicleRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;

class VehicleService extends AbstractService implements VehicleServiceInterface
{
    private VehicleRepository $vehicleRepository;

    public function __construct(VehicleRepository $repository)
    {
        parent::__construct($repository);
        $this->vehicleRepository = $repository;
    }

    public function create(array $data): Model
    {
        if (empty($data['code'])) {
            $data['code'] = Vehicle::generateCode();
        }

        if (empty($data['status'])) {
            $data['status'] = Vehicle::STATUS_PENDING;
        }

        return parent::create($data);
    }

    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        return $this->vehicleRepository->paginateWithFilters($search, $filters, $perPage);
    }

    public function getStatistics(): array
    {
        $total = $this->vehicleRepository->countAll();
        $active = $this->vehicleRepository->countByStatus(Vehicle::STATUS_ACTIVE);
        $pendingRenewal = $this->vehicleRepository->countByStatus(Vehicle::STATUS_PENDING_RENEWAL);
        $inactive = $this->vehicleRepository->countByStatus(Vehicle::STATUS_INACTIVE);
        $assigned = $this->vehicleRepository->countAssigned(true);
        $unassigned = $this->vehicleRepository->countAssigned(false);
        $bikes = $this->vehicleRepository->countByType('Bike');
        $vans = $this->vehicleRepository->countByType('Van');
        $miniVans = $this->vehicleRepository->countByType('Mini Van');

        return [
            'total' => $total,
            'active' => $active,
            'pending_renewal' => $pendingRenewal,
            'inactive' => $inactive,
            'assigned' => $assigned,
            'unassigned' => $unassigned,
            'bikes' => $bikes,
            'vans' => $vans,
            'mini_vans' => $miniVans,
        ];
    }

    public function assignToUser(int|string $vehicleId, int $userId): bool
    {
        $vehicle = $this->find($vehicleId);

        if (!$vehicle) {
            return false;
        }

        return $vehicle->forceFill(['user_id' => $userId])->save();
    }

    public function detachFromUser(int|string $vehicleId): bool
    {
        $vehicle = $this->find($vehicleId);

        if (!$vehicle) {
            return false;
        }

        return $vehicle->forceFill(['user_id' => null])->save();
    }

    public function distinctTypes(): array
    {
        return $this->vehicleRepository->distinctTypes();
    }

}
