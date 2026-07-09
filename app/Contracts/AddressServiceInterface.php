<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

interface AddressServiceInterface
{
    /**
     * Get all addresses for the authenticated user.
     */
    public function getUserAddresses(int $userId): Collection;

    /**
     * Create a new address for the authenticated user.
     */
    public function createAddress(array $data, int $userId): Model;

    /**
     * Update an existing address.
     */
    public function updateAddress(int|string $id, array $data, int $userId): bool;

    /**
     * Delete an address.
     */
    public function deleteAddress(int|string $id, int $userId): bool;

    /**
     * Find an address by ID.
     */
    public function find(int|string $id): ?Model;
}
