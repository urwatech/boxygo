<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Contracts\UserRepositoryInterface;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Models\User;
use App\Services\MtnSmsService;
use App\Services\OtpService;
use App\Services\SendGridEmailService;
use App\Services\UserService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Throwable;

class PasswordResetController extends Controller
{
    private const PASSWORD_RESET_TYPE = 'password_reset';

    public function __construct(
        private readonly OtpService $otpService,
        private readonly UserRepositoryInterface $users,
        private readonly UserService $userService,
        private readonly SendGridEmailService $sendGridEmailService
    ) {}

    /**
     * Send password reset code via email
     */
    public function sendResetLink(ForgotPasswordRequest $request): JsonResponse
    {
        $data = $request->all();
        // Email is already normalized by ForgotPasswordRequest
        $user = $this->userService->findByEmailOrMobile($data['email'], $data['phone_number']);

        if (! $user instanceof User) {
            return ApiResponse::validationError(
                ['email' => [__('errorAccountNotFoundByEmail')]],
                __('userNotFound')
            );
        }

        $this->sendPasswordResetCode($user);

        return ApiResponse::success(
            null,
            __('verificationCodeSentToEmail')
        );
    }

    /**
     * Verify the reset code
     */
    public function verifyCode(Request $request): JsonResponse
    {
        // Normalize email before validation
        $email = strtolower(trim($request->input('email', '')));
        $request->merge(['email' => $email]);

        $validated = $request->validate([
            'email' => ['nullable', 'email', 'exists:users,email', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
            'code' => ['required', 'string', 'size:4'],
        ], [
            'email.email' => __('validationEmailInvalid'),
            'email.exists' => __('noAccountFoundWithEmailAddress'),
            'code.required' => __('verificationCodeIsRequired'),
            'code.size' => __('verificationCodeMustBeExactly4Characters'),
        ]);

        $user = $this->userService->findByEmailOrMobile($validated['email'], $validated['phone_number']);

        if (! $user instanceof User) {
            return ApiResponse::validationError(
                ['email' => [__('accountNotFoundByEmailOrMobile')]],
                __('userNotFound')
            );
        }

        $otp = $this->otpService->latestActive($user, self::PASSWORD_RESET_TYPE);

        if (! $otp) {
            return ApiResponse::validationError(
                ['code' => [__('verificationCodeExpiredPleaseRequestANewCode')]],
                __('codeExpired')
            );
        }

        // Allow "0000" as verification code if environment is local
        $isValidCode = $this->otpService->validateCode($otp, $request->input('code')) ||
            (config('app.env') === 'local' && $request->input('code') === '0000');

        if (! $isValidCode) {
            return ApiResponse::validationError(
                ['code' => [__('invalidVerificationCode')]],
                __('invalidCode')
            );
        }

        // Mark OTP as consumed
        $this->otpService->markConsumed($otp);

        return ApiResponse::success(
            null,
            __('codeVerifiedYouCanNowResetYourPassword')
        );
    }

    /**
     * Reset password using verified email
     */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'exists:users,email', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
            'password' => [
                'required',
                'confirmed',
                PasswordRule::min(6),
            ],
        ]);

        $user = $this->userService->findByEmailOrMobile($data['email'], $data['phone_number']);

        if (! $user instanceof User) {
            return ApiResponse::validationError(
                ['email' => [__('errorAccountNotFoundByEmail')]],
                __('userNotFound')
            );
        }

        // Verify that user has completed OTP verification
        // Check if there's a consumed OTP for this user
        $hasConsumedOtp = $user->otps()
            ->where('type', self::PASSWORD_RESET_TYPE)
            ->whereNotNull('consumed_at')
            ->where('consumed_at', '>=', now()->subMinutes(10))
            ->exists();

        if (! $hasConsumedOtp) {
            return ApiResponse::validationError(
                ['email' => [__('pleaseVerifyEmailBeforeResettingPassword')]],
                __('verificationRequired')
            );
        }

        // Update password and verify email if not already verified
        // Since they proved they have access to their email via OTP
        $user->forceFill([
            'password' => Hash::make($request->input('password')),
            'email_verified_at' => $user->email_verified_at ?? now(),
            'remember_token' => Str::random(60),
        ])->save();

        // Revoke all tokens
        $user->tokens()->delete();

        // Clean up used OTPs
        $this->otpService->purge($user, self::PASSWORD_RESET_TYPE);

        event(new PasswordReset($user));

        return ApiResponse::success(
            null,
            __('passwordResetSuccessfullyYouCanNowLogInWithYourNewPassword')
        );
    }

    /**
     * Resend password reset code
     */
    public function resendCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'exists:users,email', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
        ]);

        $user = $this->userService->findByEmailOrMobile($data['email'], $data['phone_number']);

        if (! $user instanceof User) {
            return ApiResponse::validationError(
                ['email' => [__('errorAccountNotFoundByEmail')]],
                __('userNotFound')
            );
        }

        $this->sendPasswordResetCode($user);

        return ApiResponse::success(
            null,
            __('verificationCodeResentToYourEmail')
        );
    }

    /**
     * Send password reset code via email
     */
    private function sendPasswordResetCode(User $user): void
    {
        $this->otpService->purge($user, self::PASSWORD_RESET_TYPE);

        [$otp, $code] = $this->otpService->generate($user, self::PASSWORD_RESET_TYPE, 4);

        try {
            // Use centralized SendGrid service for password reset code
            $smsService = app(MtnSmsService::class);
            $locale = strtolower((string) ($user->language ?? 'en')) === 'ar' ? 'ar' : 'en';
            $smsService->sendLocalized($user->phone_number, 'smsPasswordReset', [
                'code' => $code,
            ], $locale);
            $this->sendGridEmailService->sendPasswordResetCode($user->email, $user->name, $code);
        } catch (Throwable $exception) {
            Log::warning('Unable to send password reset email.', [
                'user_id' => $user->id,
                'otp_identifier' => $otp->identifier,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * Change password internally for authenticated user (no email/token required).
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => [
                'required',
                'string',
                PasswordRule::min(6),
                'confirmed',
            ],
            'password_confirmation' => ['required_with:password', 'string'],
        ]);

        $user = $request->user();

        // Verify current password
        if (! Hash::check($request->input('current_password'), $user->password)) {
            return ApiResponse::validationError(
                ['current_password' => [__('currentPasswordIsIncorrect')]],
                __('currentPasswordIsIncorrect')
            );
        }

        // Update password
        $user->forceFill([
            'password' => Hash::make((string) $request->input('password')),
            'remember_token' => Str::random(60),
        ])->save();

        // Revoke all tokens except the current one
        $currentTokenId = $user->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        event(new PasswordReset($user));

        return ApiResponse::success(null, __('passwordChangedSuccessfully'));
    }
}
