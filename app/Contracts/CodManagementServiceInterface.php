<?php

namespace App\Contracts;

interface CodManagementServiceInterface
{
    public function getStatistics(): array;

    public function paginateShipments(?string $search = '', array $filters = [], int $perPage = 10): mixed;

    public function markAsCollected(int $shipmentId): bool;

    public function getShipmentDetails(int $shipmentId): array;
}
