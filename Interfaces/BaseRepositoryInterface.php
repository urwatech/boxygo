<?php

namespace Interfaces;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Base repository contract.
 */
interface BaseRepositoryInterface
{
    /** Get all models. */
    public function all(): Collection;

    /** Find a model by primary key. */
    public function find(int|string $id): ?Model;

    /** Create a model from attributes. */
    public function create(array $data): Model;

    /** Update a model by primary key. */
    public function update(int|string $id, array $data): bool;

    /** Delete a model by primary key. */
    public function delete(int|string $id): bool;

    /**
     * Paginate and filter models.
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator;
}
