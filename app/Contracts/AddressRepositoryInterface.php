<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

interface AddressRepositoryInterface
{
    /**
     * Get all addresses for a specific user.
     */
    public function getByUserId(int $userId): Collection;

    /**
     * Create a new address for a user.
     */
    public function create(array $data): Model;

    /**
     * Update an address.
     */
    public function update(int|string $id, array $data): bool;

    /**
     * Delete an address.
     */
    public function delete(int|string $id): bool;

    /**
     * Find an address by ID.
     */
    public function find(int|string $id): ?Model;

    /**
     * Check if address belongs to user.
     */
    public function belongsToUser(int|string $addressId, int $userId): bool;
}
