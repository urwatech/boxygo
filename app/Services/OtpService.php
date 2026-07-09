<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserOtp;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class OtpService
{
    private int $ttlMinutes;

    public function __construct(?int $ttlMinutes = null)
    {
        $configured = config('auth.otp_ttl_minutes');
        $resolved = $ttlMinutes ?? (is_numeric($configured) ? (int) $configured : 30);
        $this->ttlMinutes = max(1, $resolved);
    }

    /**
     * Generate an OTP for the user and return the model alongside the raw code.
     */
    public function generate(User $user, string $type = 'registration', int $digits = 6, ?string $context = null): array
    {
        $digits = max(4, min($digits, 10));
        $maxValue = (10 ** $digits) - 1;
        $code = str_pad((string) random_int(0, $maxValue), $digits, '0', STR_PAD_LEFT);

        $otp = $user->otps()->create([
            'identifier' => (string) Str::uuid(),
            'code_hash' => Hash::make($code),
            'type' => $type,
            'expires_at' => Carbon::now()->addMinutes($this->ttlMinutes),
        ]);

        // Get caller context for better logging
        $callerInfo = $this->getCallerContext($context);

        Log::info('OTP generated for user', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'user_name' => $user->name,
            'identifier' => $otp->identifier,
            'type' => $type,
            'digits' => $digits,
            'expires_at' => $otp->expires_at->toDateTimeString(),
            'ttl_minutes' => $this->ttlMinutes,
            'context' => $callerInfo['context'],
            'caller' => $callerInfo['caller'],
            // The code is logged for development visibility; replace with SMS/email dispatch in production.
            'code' => $code,
        ]);

        return [$otp, $code];
    }

    public function markConsumed(UserOtp $otp, ?string $context = null): void
    {
        $callerInfo = $this->getCallerContext($context);

        Log::info('OTP marked as consumed', [
            'otp_id' => $otp->id,
            'identifier' => $otp->identifier,
            'user_id' => $otp->user_id,
            'type' => $otp->type,
            'context' => $callerInfo['context'],
            'caller' => $callerInfo['caller'],
        ]);

        $otp->forceFill(['consumed_at' => Carbon::now()])->save();
    }

    public function validateCode(UserOtp $otp, string $code, ?string $context = null): bool
    {
        $callerInfo = $this->getCallerContext($context);

        if ($otp->isConsumed() || $otp->isExpired()) {
            Log::warning('OTP validation failed - OTP is consumed or expired', [
                'otp_id' => $otp->id,
                'identifier' => $otp->identifier,
                'user_id' => $otp->user_id,
                'type' => $otp->type,
                'is_consumed' => $otp->isConsumed(),
                'is_expired' => $otp->isExpired(),
                'expires_at' => $otp->expires_at?->toDateTimeString(),
                'context' => $callerInfo['context'],
                'caller' => $callerInfo['caller'],
            ]);

            return false;
        }

        $isValid = Hash::check($code, $otp->code_hash);

        if ($isValid) {
            Log::info('OTP validation successful', [
                'otp_id' => $otp->id,
                'identifier' => $otp->identifier,
                'user_id' => $otp->user_id,
                'type' => $otp->type,
                'context' => $callerInfo['context'],
                'caller' => $callerInfo['caller'],
            ]);
        } else {
            Log::warning('OTP validation failed - Invalid code', [
                'otp_id' => $otp->id,
                'identifier' => $otp->identifier,
                'user_id' => $otp->user_id,
                'type' => $otp->type,
                'context' => $callerInfo['context'],
                'caller' => $callerInfo['caller'],
            ]);
        }

        return $isValid;
    }

    public function findLatestByIdentifier(string $identifier): ?UserOtp
    {
        return UserOtp::where('identifier', $identifier)
            ->orderByDesc('created_at')
            ->first();
    }

    public function regenerate(User $user, string $type = 'registration', int $digits = 6, ?string $context = null): array
    {
        $callerInfo = $this->getCallerContext($context);

        Log::info('OTP regeneration requested', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'type' => $type,
            'context' => $callerInfo['context'],
            'caller' => $callerInfo['caller'],
        ]);

        return $this->generate($user, $type, $digits, $context);
    }

    public function purge(User $user, string $type, ?string $context = null): void
    {
        $callerInfo = $this->getCallerContext($context);

        $count = $user->otps()->where('type', $type)->count();

        Log::info('Purging OTPs for user', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'type' => $type,
            'count' => $count,
            'context' => $callerInfo['context'],
            'caller' => $callerInfo['caller'],
        ]);

        $user->otps()->where('type', $type)->delete();
    }

    public function latestActive(User $user, string $type): ?UserOtp
    {
        return $user->otps()
            ->where('type', $type)
            ->whereNull('consumed_at')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', Carbon::now());
            })
            ->latest()
            ->first();
    }

    /**
     * Get caller context for better logging
     */
    private function getCallerContext(?string $context = null): array
    {
        if ($context) {
            return [
                'context' => $context,
                'caller' => 'explicit',
            ];
        }

        // Try to determine the caller from the backtrace
        $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 4);

        // Skip OtpService methods and find the actual caller
        foreach ($trace as $call) {
            if (isset($call['class']) && $call['class'] !== self::class) {
                $callerClass = $call['class'];
                $callerMethod = $call['function'] ?? 'unknown';

                // Map known classes to friendly context names
                $contextMap = [
                    'App\Http\Controllers\Api\V1\Auth\RegistrationController' => 'API Registration',
                    'App\Http\Controllers\Api\V1\Auth\OtpVerificationController' => 'API OTP Verification/Resend',
                    'App\Http\Controllers\Api\V1\Auth\PasswordResetController' => 'API Password Reset',
                    'App\Http\Controllers\Api\V1\Auth\LoginController' => 'API Login',
                    'App\Services\CustomerAuthService' => 'Web Customer Registration/Verification',
                    'App\Http\Controllers\Customer\ForgotPasswordController' => 'Web Password Reset',
                ];

                $friendlyContext = $contextMap[$callerClass] ?? class_basename($callerClass);

                return [
                    'context' => $friendlyContext,
                    'caller' => $callerClass.'::'.$callerMethod,
                ];
            }
        }

        return [
            'context' => 'Unknown',
            'caller' => 'Unknown',
        ];
    }
}
