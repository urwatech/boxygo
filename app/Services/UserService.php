<?php

namespace App\Services;

use App\Contracts\UserServiceInterface;
use App\Models\User;
use App\Repositories\UserRepository;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Collection;

/**
 * Service layer for user-related logic.
 */
class UserService extends AbstractService implements UserServiceInterface
{
    private UserRepository $userRepository;

    public function __construct(UserRepository $repository)
    {
        parent::__construct($repository);
        $this->userRepository = $repository;
    }

    /**
     * Attempt to authenticate a user with the given credentials.
     *
     * @param array $credentials
     * @param bool $remember
     * @return bool
     */
    public function attemptLogin(array $credentials, bool $remember = false): bool
    {
        return Auth::attempt(array_merge($credentials, [
            'is_deleted' => false,
        ]), $remember);
    }

    /**
     * Log the user out of the application.
     *
     * @return void
     */
    public function logout(): void
    {
        Auth::logout();
    }

    /**
     * Find a user by email address.
     */
    public function findByEmail(string $email): ?User
    {
        return $this->userRepository
            ->getModel()
            ->newQuery()
            ->where('email', $email)
            ->where('is_deleted', false)
            ->first();
    }

    /**
     * Find a user by phone number.
     */
    public function findByPhoneNumber(string $phoneNumber): ?User
    {
        $phoneNumber = str_replace(' ', '', $phoneNumber);

        return $this->userRepository
            ->getModel()
            ->newQuery()
            ->whereRaw("REPLACE(phone_number, ' ', '') = ?", [$phoneNumber])
            ->where('is_deleted', false)
            ->first();
    }

    /**
     * Find a user by phone number.
     */
    public function findByEmailOrMobile(?string $email, ?string $phoneNumber): ?User
    {
        $phoneNumber = str_replace([' ', '+'], '', $phoneNumber);

        if (blank($email) && blank($phoneNumber)) {
            return null;
        }

        return $this->userRepository
            ->getModel()
            ->newQuery()
            ->where('is_deleted', false)
            ->where(function ($query) use ($email, $phoneNumber) {
                $hasEmail = filled($email);

                if (filled($email)) {
                    $query->where('email', $email);
                }

                if (filled($phoneNumber)) {
                    $phoneNumberQuery = "REPLACE(REPLACE(phone_number, ' ', ''), '+', '') = ?";

                    if ($hasEmail) {
                        $query->orWhereRaw(
                            $phoneNumberQuery,
                            [$phoneNumber]
                        );
                    } else {
                        $query->whereRaw(
                            $phoneNumberQuery,
                            [$phoneNumber]
                        );
                    }
                }
            })
            ->first();
    }

    /**
     * Get users who have one or more vehicles assigned.
     */
    public function usersWithVehicles(): Collection
    {
        return $this->userRepository
            ->getModel()
            ->newQuery()
            ->whereHas('vehicles')
            ->withCount('vehicles')
            ->get();
    }
}
