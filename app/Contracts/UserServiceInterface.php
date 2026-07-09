<?php

namespace App\Contracts;

use App\Models\User;
use Interfaces\BaseServiceInterface;

/**
 * Interface for user service.
 */
interface UserServiceInterface extends BaseServiceInterface
{
    /**
     * Attempt to authenticate a user with the given credentials.
     */
    public function attemptLogin(array $credentials, bool $remember = false): bool;

    /**
     * Log the user out of the application.
     */
    public function logout(): void;

    /**
     * Find a user by email address.
     */
    public function findByEmail(string $email): ?User;

    /**
     * Find a user by phone number.
     */
    public function findByPhoneNumber(string $phoneNumber): ?User;
}
