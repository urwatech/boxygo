<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

interface AddressServiceInterface
{
    /**
     * Get all addresses for the authenticated user.
     *
     * @param int $userId
     * @return Collection
     */
    public function getUserAddresses(int $userId): Collection;

    /**
     * Create a new address for the authenticated user.
     *
     * @param array $data
     * @param int $userId
     * @return Model
     */
    public function createAddress(array $data, int $userId): Model;

    /**
     * Update an existing address.
     *
     * @param int|string $id
     * @param array $data
     * @param int $userId
     * @return bool
     */
    public function updateAddress(int|string $id, array $data, int $userId): bool;

    /**
     * Delete an address.
     *
     * @param int|string $id
     * @param int $userId
     * @return bool
     */
    public function deleteAddress(int|string $id, int $userId): bool;

    /**
     * Find an address by ID.
     *
     * @param int|string $id
     * @return Model|null
     */
    public function find(int|string $id): ?Model;
}
