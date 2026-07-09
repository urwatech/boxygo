<?php

namespace App\Repositories;

use App\Contracts\AddressRepositoryInterface;
use App\Models\Address;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Class AddressRepository
 *
 * Handles data access for addresses.
 */
class AddressRepository implements AddressRepositoryInterface
{
    public function __construct(
        private readonly Address $model
    ) {}

    /**
     * Get all addresses for a specific user.
     */
    public function getByUserId(int $userId): Collection
    {
        return $this->model
            ->where('user_id', $userId)
            ->latest('id')
            ->get();
    }

    /**
     * Create a new address for a user.
     */
    public function create(array $data): Model
    {
        return $this->model->create($data);
    }

    /**
     * Update an address.
     *
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public function update(int|string $id, array $data): bool
    {
        return $this->model
            ->where($this->model->getKeyName(), $id)
            ->update($data) > 0;
    }
    // public function update(int|string $id, array $data): ?\Illuminate\Database\Eloquent\Model
    // {
    //     $model = $this->model->where($this->model->getKeyName(), $id)->first();

    //     if (!$model) {
    //         return null;
    //     }

    //     $model->update($data);

    //     return $model->fresh();
    // }

    /**
     * Delete an address.
     */
    public function delete(int|string $id): bool
    {
        return $this->model
            ->where($this->model->getKeyName(), $id)
            ->delete() > 0;
    }

    /**
     * Find an address by ID.
     */
    public function find(int|string $id): ?Model
    {
        return $this->model->find($id);
    }

    /**
     * Check if address belongs to user.
     */
    public function belongsToUser(int|string $addressId, int $userId): bool
    {
        return $this->model
            ->where('id', $addressId)
            ->where('user_id', $userId)
            ->exists();
    }
}
