<?php

namespace App\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Interfaces\BaseRepositoryInterface;

interface VehicleRepositoryInterface extends BaseRepositoryInterface
{
    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator;

    public function countAll(): int;

    public function countByStatus(string $status): int;

    public function countAssigned(bool $assigned = true): int;

    public function distinctTypes(): array;

    public function countByType(string $type): int;
}
