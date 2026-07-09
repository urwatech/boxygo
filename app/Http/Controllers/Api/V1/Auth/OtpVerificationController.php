<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResendOtpRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\UserOtp;
use App\Services\OtpService;
use App\Services\SendGridEmailService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class OtpVerificationController extends Controller
{
    public function __construct(
        private OtpService $otpService,
        private UserService $userService,
        private SendGridEmailService $sendGridEmailService
    ) {
    }

    public function store(VerifyOtpRequest $request): JsonResponse
    {
        $data = $request->validated();

        /** @var UserOtp|null $otp */
        $otp = $this->otpService->findLatestByIdentifier($data['verification_token']);

        if (!$otp || !$otp->user) {
            return ApiResponse::validationError(
                ['verification_token' => [__('invalidVerificationCode')]],
                __('invalidVerificationCode')
            );
        }

        // Allow bypass code in local environment
        $isLocalBypass = config('app.env') === 'local' && $data['code'] === '000000';

        if (!$isLocalBypass && !$this->otpService->validateCode($otp, $data['code'])) {
            $message = $otp->isExpired()
                ? __('verificationCodeExpiredPleaseRequestANewCode')
                : __('invalidVerificationCode');

            $status = $otp->isExpired() ? JsonResponse::HTTP_GONE : JsonResponse::HTTP_UNPROCESSABLE_ENTITY;

            return ApiResponse::error($message, $status);
        }

        $user = DB::transaction(function () use ($otp) {
            $this->otpService->markConsumed($otp);

            $user = $otp->user;
            $user->forceFill([
                'status' => 'active',
                'email_verified_at' => now(),  // Changed from phone_verified_at since OTP is sent to email
            ])->save();

            return $user->fresh();
        });

        $accessToken = $user->createToken('registration');

        return ApiResponse::success([
            'user' => new UserResource($user),
            'token' => [
                'access_token' => $accessToken->plainTextToken,
                'token_type' => 'Bearer',
                'expires_at' => null,
            ],
        ], __('verificationSuccessful'));
    }

    public function resend(ResendOtpRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = null;
        $previousOtp = null;

        if (!empty($data['verification_token'])) {
            $previousOtp = $this->otpService->findLatestByIdentifier($data['verification_token']);
            $user = $previousOtp?->user;
        } elseif (!empty($data['email'])) {
            $user = $this->userService->findByEmail($data['email']);
        }

        if (!$user) {
            return ApiResponse::notFound(__('userCouldNotBeFound'));
        }

        if ($user->status === 'active') {
            return ApiResponse::badRequest(__('accountAlreadyVerified'));
        }

        if ($previousOtp && !$previousOtp->isConsumed()) {
            $previousOtp->forceFill(['consumed_at' => now()])->save();
        }

        [$otp, $code] = $this->otpService->regenerate($user);

        // Send OTP via SendGrid template
        try {
            $this->sendGridEmailService->sendVerificationCode($user->email, $user->name, $code);
        } catch (Throwable $exception) {
            Log::error('Failed to resend OTP via SendGrid', [
                'user_id' => $user->id,
                'otp_identifier' => $otp->identifier,
                'exception' => $exception->getMessage(),
            ]);
        }

        $responseData = [
            'verification_token' => $otp->identifier,
            'expires_at' => $otp->expires_at->toIso8601String(),
        ];

        if (config('app.debug')) {
            $responseData['debug'] = [
                'otp_code' => $code,
            ];
        }

        return ApiResponse::success($responseData, __('newVerificationCodeSent'));
    }
}
