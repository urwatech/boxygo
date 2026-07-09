<?php

namespace App\Services;

use App\Contracts\AddressRepositoryInterface;
use App\Contracts\AddressServiceInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Service layer for address-related business logic.
 */
class AddressService implements AddressServiceInterface
{
    public function __construct(
        private readonly AddressRepositoryInterface $repository
    ) {}

    /**
     * Get all addresses for the authenticated user.
     */
    public function getUserAddresses(int $userId): Collection
    {
        return $this->repository->getByUserId($userId);
    }

    /**
     * Create a new address for the authenticated user.
     */
    public function createAddress(array $data, int $userId): Model
    {
        $data['user_id'] = $userId;

        return $this->repository->create($data);
    }

    /**
     * Update an existing address.
     */
    public function updateAddress(int|string $id, array $data, int $userId): bool
    {
        // Verify ownership
        if (! $this->repository->belongsToUser($id, $userId)) {
            abort(403, 'Unauthorized action.');
        }

        $result = $this->repository->update($id, $data);

        return $result !== null;
    }

    /**
     * Delete an address.
     */
    public function deleteAddress(int|string $id, int $userId): bool
    {
        // Verify ownership
        if (! $this->repository->belongsToUser($id, $userId)) {
            abort(403, 'Unauthorized action.');
        }

        return $this->repository->delete($id);
    }

    /**
     * Find an address by ID.
     */
    public function find(int|string $id): ?Model
    {
        return $this->repository->find($id);
    }
}
