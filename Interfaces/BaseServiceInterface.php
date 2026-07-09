<?php

namespace Interfaces;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Base service contract.
 */
interface BaseServiceInterface
{
    /** Get all resources. */
    public function all(): Collection;

    /** Find a resource by primary key. */
    public function find(int|string $id): ?Model;

    /** Create a resource. */
    public function create(array $data): Model;

    /** Update a resource by primary key. */
    public function update(int|string $id, array $data): bool;

    /** Delete a resource by primary key. */
    public function delete(int|string $id): bool;

    /**
     * Paginate and filter resources.
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator;
}
