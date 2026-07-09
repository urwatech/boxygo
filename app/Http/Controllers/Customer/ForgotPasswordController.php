<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\UserRepositoryInterface;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\MtnSmsService;
use App\Services\OtpService;
use App\Services\SendGridEmailService;
use App\Services\UserService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ForgotPasswordController extends Controller
{
    private const PASSWORD_RESET_TYPE = 'password_reset';

    public function __construct(
        private readonly OtpService $otpService,
        private readonly UserRepositoryInterface $users,
        private readonly UserService $userService,
        private readonly SendGridEmailService $sendGridEmailService
    ) {
    }

    public function create(): Response
    {
        return Inertia::render('Customer/Auth/ForgotPassword');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'exists:users,email', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
        ]);

        $user = $this->userService->findByEmailOrMobile($data['email'], $data['phone_number']);

        if (!$user instanceof User) {
            throw ValidationException::withMessages([
                'email' => __('errorAccountNotFoundByEmail'),
            ]);
        }

        $this->sendPasswordResetCode($user);

        return back()->with('success', __('weHaveSentAVerificationCodeToYourEmailAddressAndYourPhoneNumber'));
    }

    public function showVerify(Request $request): Response
    {
        $email = $request->query('email');
        $mobile = $request->query('phone_number');
        return Inertia::render('Customer/Auth/VerifyResetCode', [
            'email' => $email,
            'phone_number' => $mobile,
        ]);
    }

    public function verifyCode(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'exists:users,email', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
            'code' => ['required', 'string', 'size:4'],
        ]);

        $user = $this->userService->findByEmailOrMobile($data['email'], $data['phone_number']);

        if (!$user instanceof User) {
            throw ValidationException::withMessages([
                'email' => __('errorAccountNotFoundByEmail'),
            ]);
        }

        $otp = $this->otpService->latestActive($user, self::PASSWORD_RESET_TYPE);

        if (!$otp) {
            throw ValidationException::withMessages([
                'code' => __('verificationCodeExpiredPleaseRequestANewCode'),
            ]);
        }

        // Allow "0000" as verification code if environment is local
        $isValidCode = $this->otpService->validateCode($otp, $data['code']) ||
                       (config('app.env') === 'local' && $data['code'] === '0000');

        if (!$isValidCode) {
            throw ValidationException::withMessages([
                'code' => __('invalidVerificationCode'),
            ]);
        }

        // Mark OTP as consumed
        $this->otpService->markConsumed($otp);

        // Redirect to set password page
        return redirect()->route('customer.password.reset.show', ['email' => $user->email])
            ->with('success', __('codeVerifiedPleaseSetYourNewPassword'));
    }

    public function showReset(Request $request): Response
    {
        $email = $request->query('email');
        return Inertia::render('Customer/Auth/SetPassword', [
            'email' => $email,
        ]);
    }

    public function performReset(Request $request): RedirectResponse
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

        if (!$user instanceof User) {
            throw ValidationException::withMessages([
                'email' => __('errorAccountNotFoundByEmail'),
            ]);
        }

        // Verify that user has completed OTP verification
        // Check if there's a consumed OTP for this user
        $hasConsumedOtp = $user->otps()
            ->where('type', self::PASSWORD_RESET_TYPE)
            ->whereNotNull('consumed_at')
            ->where('consumed_at', '>=', now()->subMinutes(10))
            ->exists();

        if (!$hasConsumedOtp) {
            return redirect()->route('customer.password.request')
                ->withErrors(['email' => __('pleaseVerifyEmailBeforeResettingPassword')]);
        }

        // Update password and verify email if not already verified
        // Since they proved they have access to their email via OTP
        $user->forceFill([
            'password' => Hash::make($data['password']),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        // Clean up used OTPs
        $this->otpService->purge($user, self::PASSWORD_RESET_TYPE);

        return redirect()->route('login')
            ->with('success', __('passwordResetSuccessfullyYourPasswordHasBeenUpdatedYouCanNowLogInWithYourNewPassword'));
    }

    public function resendCode(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'exists:users,email', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
        ]);

        $user = $this->userService->findByEmailOrMobile($data['email'], $data['phone_number']);

        if (!$user instanceof User) {
            throw ValidationException::withMessages([
                'email' => __('errorAccountNotFoundByEmail'),
            ]);
        }

        $this->sendPasswordResetCode($user);

        return back()->with('success', __('verificationCodeResentToYourEmail'));
    }

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
}
