<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\OtpService;
use App\Services\SendGridEmailService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class LoginController extends Controller
{
    public function __construct(
        private UserService $userService,
        private OtpService $otpService,
        private SendGridEmailService $sendGridEmailService
    ) {
    }

    public function store(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        /** @var User|null $user */
        $user = null;

        if (!empty($credentials['email'])) {
            $user = $this->userService->findByEmail($credentials['email']);
        } elseif (!empty($credentials['phone_number'])) {
            $user = $this->userService->findByPhoneNumber($credentials['phone_number']);
        }

        if (!$user || (!(config('app.env') === 'local' && $credentials['password'] === '123456') && !Hash::check($credentials['password'], $user->password))) {
            return ApiResponse::validationError(
                ['credentials' => [__('providedCredentialsAreIncorrect')]],
                __('providedCredentialsAreIncorrect')
            );
        }

        // Check if user has any assigned roles
        if ($user->roles->isEmpty()) {
            return ApiResponse::validationError(
                ['role' => [__('noRoleAssignedContactSupport')]],
                __('noRoleAssignedContactSupport')
            );
        }

        // Check if user has any role with Mobile App platform access
        $hasMobileRole = $user->roles()->where('platform', 'Mobile App')->exists();

        if (!$hasMobileRole) {
            return ApiResponse::validationError(
                ['platform' => [__('accountNotAuthorizedForMobileApp')]],
                __('accountNotAuthorizedForMobileApp')
            );
        }

        if ($user->status !== 'active') {
            return ApiResponse::unauthorized(__('accountDeactivatedContactManagement'));
        }

        // Update FCM token and device type if provided
        if ($request->has('fcm_token') || $request->has('token')) {
            $user->update([
                'fcm_token' => $request->input('fcm_token') ?? $request->input('token'),
                'device_type' => $request->input('device_type') ?? $request->input('deviceType'),
            ]);
        }

        $accessToken = $user->createToken('login');

        return ApiResponse::success([
            'user' => new UserResource($user),
            'token' => [
                'access_token' => $accessToken->plainTextToken,
                'token_type' => 'Bearer',
                'expires_at' => null,
            ],
        ], __('loginSuccessful'));
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && $user->currentAccessToken()) {
            $user->fcm_token = null;
            $user->device_type = null;
            $user->save();
            $user->currentAccessToken()->delete();
        }

        return ApiResponse::noContent();
    }
}
