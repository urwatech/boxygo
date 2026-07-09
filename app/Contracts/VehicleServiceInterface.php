<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Interfaces\BaseServiceInterface;

interface VehicleServiceInterface extends BaseServiceInterface
{
    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator;

    public function getStatistics(): array;

    public function assignToUser(int|string $vehicleId, int $userId): bool;

    public function detachFromUser(int|string $vehicleId): bool;

    public function distinctTypes(): array;
}
