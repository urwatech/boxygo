<?php

namespace App\Contracts;

use App\Models\User;
use Interfaces\BaseRepositoryInterface;

/**
 * Interface for user repository.
 */
interface UserRepositoryInterface extends BaseRepositoryInterface
{
    public function findByEmail(string $email): ?User;
}
