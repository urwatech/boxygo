<?php

namespace App\Contracts;

use App\Models\User;

interface CustomerAuthServiceInterface
{
    /**
     * Attempt to authenticate a customer user with the given credentials.
     */
    public function authenticateCustomer(array $credentials, bool $remember = false): User;

    /**
     * Register a new customer account and trigger verification.
     */
    public function registerCustomer(array $data): User;

    /**
     * Verify an email verification code for the provided email address.
     */
    public function verifyEmailCode(string $email, string $code): User;

    /**
     * Resend the email verification code to the given email address.
     */
    public function resendVerificationCode(string $email): void;
}
