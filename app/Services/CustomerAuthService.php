<?php

namespace App\Services;

use App\Contracts\CustomerAuthServiceInterface;
use App\Contracts\RoleServiceInterface;
use App\Contracts\UserRepositoryInterface;
use App\Contracts\UserServiceInterface;
use App\Mail\VerificationCodeMail;
use App\Models\User;
use App\Services\MtnSmsService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use SendGrid;
use SendGrid\Mail\Mail as SendGridMail;
use Throwable;

class CustomerAuthService implements CustomerAuthServiceInterface
{
    private const VERIFICATION_TYPE = 'customer_email_verification';

    public function __construct(
        private readonly UserRepositoryInterface $users,
        private readonly UserServiceInterface $userService,
        private readonly RoleServiceInterface $roleService,
        private readonly OtpService $otpService,
        private readonly SendGridEmailService $sendGridEmailService,
        private readonly WalletService $walletService,
    ) {
    }

    public function authenticateCustomer(array $credentials, bool $remember = false): User
    {
        $loginEmail = $credentials['email'] ?? null;
        $loginPhone = $credentials['phone_number'] ?? null;
        $phoneCandidates = [];

        if ($loginPhone) {
            $digits = preg_replace('/\D+/', '', (string) $loginPhone);
            if ($digits !== '') {
                $phoneCandidates[] = $digits;
                $phoneCandidates[] = '+' . $digits;
                if (strlen($digits) > 9) {
                    $codeDigits = substr($digits, 0, -9);
                    $subscriberDigits = substr($digits, -9);
                    $phoneCandidates[] = '+' . $codeDigits . ' ' . $subscriberDigits;
                }
            }
            $phoneCandidates = array_values(array_unique(array_filter($phoneCandidates)));
        }

        // Check for development-only password code authentication
        $isDevelopmentCodeAuth = config('app.env') === 'local' && ($credentials['password'] ?? null) === '123456';

        if ($isDevelopmentCodeAuth) {
            // Development mode: authenticate with password code instead of verifying password
            $user = null;
            if ($loginEmail) {
                $user = $this->users->findByEmail($loginEmail);
            } elseif (!empty($phoneCandidates)) {
                foreach ($phoneCandidates as $candidate) {
                    $user = $this->userService->findByPhoneNumber($candidate);
                    if ($user) {
                        break;
                    }
                }
            }

            if (!$user instanceof User) {
                throw ValidationException::withMessages([
                    'email' => __('We could not find an account with that email address.'),
                ]);
            }

            // Log in the user
            Auth::login($user, $remember);
        } else {
            // Normal authentication flow
            $attemptCredentials = $loginEmail
                ? ['email' => $loginEmail, 'password' => $credentials['password'] ?? null]
                : ['phone_number' => $loginPhone, 'password' => $credentials['password'] ?? null];

            $authenticated = false;

            if ($loginEmail) {
                $authenticated = $this->userService->attemptLogin($attemptCredentials, $remember);
            } elseif (!empty($phoneCandidates)) {
                foreach ($phoneCandidates as $candidate) {
                    if ($this->userService->attemptLogin(['phone_number' => $candidate, 'password' => $credentials['password'] ?? null], $remember)) {
                        $authenticated = true;
                        break;
                    }
                }
            }

            if (!$authenticated) {
                throw ValidationException::withMessages([
                    'email' => __('theProvidedCredentialsDoNotMatchOurRecords'),
                ]);
            }

            $user = Auth::user();

            if (!$user instanceof User) {
                $this->userService->logout();

                throw ValidationException::withMessages([
                    'email' => __('Authentication failed. Please try again.'),
                ]);
            }
        }

        if (!$user->hasRole('customer')) {
            $this->userService->logout();

            throw ValidationException::withMessages([
                'email' => __('You do not have permission to access this area.'),
            ]);
        }

        if (is_null($user->email_verified_at)) {
            $this->userService->logout();

            throw ValidationException::withMessages([
                'email' => __('Please verify your email address before signing in.'),
            ]);
        }

        return $user;
    }

    public function registerCustomer(array $data): User
    {
        if ($this->userService->findByEmail($data['email'])) {
            throw ValidationException::withMessages([
                'email' => __('A customer with this email address already exists.'),
            ]);
        }

        if (!empty($data['phone_number']) && $this->userService->findByPhoneNumber($data['phone_number'])) {
            throw ValidationException::withMessages([
                'phone_number' => __('This phone number is already registered.'),
            ]);
        }

        try {
            $user = DB::transaction(function () use ($data) {
                $fullName = trim(sprintf('%s %s', $data['first_name'], $data['last_name']));

                $userData = [
                    'name' => $fullName,
                    'email' => $data['email'],
                    'password' => Hash::make($data['password']),
                    'phone_number' => $data['phone_number'] ?? null,
                    'status' => 'pending',
                ];

                // Add business type if provided
                if (!empty($data['business_type'])) {
                    $userData['business_type'] = $data['business_type'];
                }

                // Add business fields if provided
                if (!empty($data['country'])) {
                    $userData['country'] = $data['country'];
                }

                if (!empty($data['city'])) {
                    $userData['city'] = $data['city'];
                }

                if (!empty($data['address'])) {
                    $userData['address'] = $data['address'];
                }

                if (!empty($data['trade_license_number'])) {
                    $userData['trade_license_number'] = $data['trade_license_number'];
                }

                // Handle license copy file upload
                if (!empty($data['license_copy']) && $data['license_copy'] instanceof \Illuminate\Http\UploadedFile) {
                    $file = $data['license_copy'];

                    ['relative' => $relativeDirectory, 'absolute' => $absoluteDirectory] = upload_path('customer-uploads', 'license-copies');

                    $extension = $file->getClientOriginalExtension();
                    if ($extension === '') {
                        $extension = $file->extension() ?: 'dat';
                    }

                    $fileName = uniqid('license_', true) . '.' . $extension;
                    $file->move($absoluteDirectory, $fileName);

                    $userData['license_copy'] = $relativeDirectory . '/' . $fileName;
                }

                $user = $this->users->create($userData);

                // Create wallet for the user
                $this->walletService->getOrCreateWallet($user->id);

                // Ensure receiver role exists
                if (!$this->roleService->roleExists('receiver')) {
                    $this->roleService->firstOrCreate(
                        ['name' => 'receiver', 'guard_name' => 'web'],
                        ['description' => 'Receiver role for tracking incoming shipments', 'platform' => 'Customer Portal']
                    );
                }

                // Assign both roles by default for better user experience
                if ($this->roleService->roleExists('customer')) {
                    $user->assignRole('customer');
                }
                $user->assignRole('receiver');

                return $user;
            });
        } catch (QueryException $exception) {
            if ((int) $exception->getCode() === 23000) {
                $message = $exception->getMessage();

                if (str_contains($message, 'users_email_unique')) {
                    throw ValidationException::withMessages([
                        'email' => __('A customer with this email address already exists.'),
                    ]);
                }

                if (str_contains($message, 'users_phone_number_unique')) {
                    throw ValidationException::withMessages([
                        'phone_number' => __('This phone number is already registered.'),
                    ]);
                }
            }

            throw $exception;
        }

        $this->sendVerificationCode($user);

        return $user;
    }

    public function verifyEmailCode(string $email, string $code): User
    {
        $user = $this->users->findByEmail($email);

        if (!$user instanceof User) {
            throw ValidationException::withMessages([
                'email' => __('We could not find an account with that email address.'),
            ]);
        }

        $otp = $this->otpService->latestActive($user, self::VERIFICATION_TYPE);

        if (!$otp) {
            throw ValidationException::withMessages([
                'code' => __('Verification code expired. Please resend a new code.'),
            ]);
        }

        // Allow "0000" as verification code if environment is local
        $isValidCode = $this->otpService->validateCode($otp, $code) ||
                       (config('app.env') === 'local' && $code === '0000');

        if (!$isValidCode) {
            throw ValidationException::withMessages([
                'code' => __('Invalid verification code.'),
            ]);
        }

        DB::transaction(function () use ($user, $otp) {
            $this->otpService->markConsumed($otp);

            $user->forceFill([
                'email_verified_at' => now(),
                'status' => $user->status === 'pending' ? 'active' : $user->status,
            ])->save();
        });

        return $user;
    }

    public function resendVerificationCode(string $email): void
    {
        $user = $this->users->findByEmail($email);

        if (!$user instanceof User) {
            throw ValidationException::withMessages([
                'email' => __('We could not find an account with that email address.'),
            ]);
        }

        $this->sendVerificationCode($user);
    }

    private function sendVerificationCode(User $user): void
    {
        $this->otpService->purge($user, self::VERIFICATION_TYPE);

        [$otp, $code] = $this->otpService->generate($user, self::VERIFICATION_TYPE, 4);

        try {
            // Use centralized SendGrid service for verification code
            $this->sendGridEmailService->sendVerificationCode($user->email, $user->name, $code);
        } catch (Throwable $exception) {
            Log::warning('Unable to send verification email.', [
                'user_id' => $user->id,
                'otp_identifier' => $otp->identifier,
                'exception' => $exception->getMessage(),
            ]);
        }

        if (!empty($user->phone_number)) {
            try {
                $smsService = app(MtnSmsService::class);
                $smsService->send(
                    $user->phone_number,
                    "Your verification code is {$code}. It expires in 30 minutes.",
                    'otp'
                );
            } catch (Throwable $exception) {
                Log::warning('Unable to send verification SMS.', [
                    'user_id' => $user->id,
                    'otp_identifier' => $otp->identifier,
                    'exception' => $exception->getMessage(),
                ]);
            }
        }
    }
}
