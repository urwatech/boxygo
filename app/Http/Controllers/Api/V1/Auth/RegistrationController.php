<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\Role;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\OtpService;
use App\Services\RoleService;
use App\Services\SendGridEmailService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Throwable;

class RegistrationController extends Controller
{
    public function __construct(
        private OtpService $otpService,
        private UserService $userService,
        private RoleService $roleService,
        private SendGridEmailService $sendGridEmailService
    ) {}

    public function store(RegisterRequest $request): JsonResponse
    {
        $payload = $request->validated();

        $user = DB::transaction(function () use ($payload) {
            $user = $this->userService->create([
                'name' => $payload['name'],
                'email' => $payload['email'],
                'password' => Hash::make($payload['password']),
                'phone_number' => $payload['phone_number'],
                'emergency_phone_number' => $payload['emergency_phone_number'] ?? null,
                'blood_type' => $payload['blood_type'] ?? null,
                'status' => 'pending',
            ]);

            // Assign the role specified in the registration request
            $user->assignRole($payload['role']);

            return $user;
        });

        $this->sendWelcomeEmail($user);

        [$otp, $code] = $this->otpService->generate($user);

        // Send OTP via SendGrid template
        try {
            $this->sendGridEmailService->sendVerificationCode($user->email, $user->name, $code);
        } catch (Throwable $exception) {
            Log::error('Failed to send OTP via SendGrid', [
                'user_id' => $user->id,
                'otp_identifier' => $otp->identifier,
                'exception' => $exception->getMessage(),
            ]);
        }

        $responseData = [
            'user' => new UserResource($user),
            'verification_token' => $otp->identifier,
            'expires_at' => $otp->expires_at->toIso8601String(),
        ];

        if (config('app.debug')) {
            $responseData['debug'] = [
                'otp_code' => $code,
            ];
        }

        return ApiResponse::created(
            $responseData,
            __('registrationSuccessfulPleaseVerifyOtpSentToYou')
        );
    }

    private function sendWelcomeEmail(User $user): void
    {
        if (! $this->shouldSendWelcomeEmail()) {
            return;
        }

        try {
            // Use SendGrid template for welcome email
            $this->sendGridEmailService->sendWelcomeEmail($user->email, $user->name);
        } catch (Throwable $exception) {
            Log::warning('Unable to send welcome email.', [
                'user_id' => $user->id,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    private function shouldSendWelcomeEmail(): bool
    {
        if (config('mail.default') !== 'smtp') {
            return false;
        }

        $smtpConfig = config('mail.mailers.smtp');

        if (! is_array($smtpConfig)) {
            return false;
        }

        return ! empty($smtpConfig['host']) && ! empty($smtpConfig['port']);
    }
}
