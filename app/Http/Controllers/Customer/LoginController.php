<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\CustomerAuthServiceInterface;
use App\Contracts\UserServiceInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function __construct(
        private readonly CustomerAuthServiceInterface $authService,
        private readonly UserServiceInterface $userService
    ) {
    }

    /**
     * Display the customer login view.
     */
    public function create(): Response
    {
        return Inertia::render('Customer/Auth/Login');
    }

    /**
     * Handle an incoming authentication request for customers.
     */
    public function store(LoginRequest $request): \Symfony\Component\HttpFoundation\Response
    {
        $payload = $request->validated();

        $this->authService->authenticateCustomer($payload, $payload['remember'] ?? false);

        $request->session()->regenerate();

        // Force a full page reload to refresh the dashboard
        return Inertia::location('/customer/dashboard');
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->user()?->forceFill([
            'fcm_token' => null,
            'device_type' => null,
        ])->save();

        $this->userService->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
