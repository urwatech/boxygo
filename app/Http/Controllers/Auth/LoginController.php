<?php

namespace App\Http\Controllers\Auth;

use App\Contracts\UserServiceInterface;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Support\AdminRouteResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    protected UserServiceInterface $userService;

    public function __construct(UserServiceInterface $userService)
    {
        $this->userService = $userService;
    }

    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login');
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $credentials = $request->only('email', 'password');
        $remember = $request->boolean('remember');

        if ($this->userService->attemptLogin($credentials, $remember)) {
            $request->session()->regenerate();

            // Redirect based on user role
            $user = $request->user();
            if ($user->hasRole(Role::SUPERADMIN->value)) {
                $redirectTo = AdminRouteResolver::firstAccessibleRouteFor($user);

                if ($redirectTo) {
                    return redirect()->intended($redirectTo);
                }
            }

            // Default redirect for customers or other roles
            return redirect()->intended('/');
        }

        throw ValidationException::withMessages([
            'email' => __('theProvidedCredentialsDoNotMatchOurRecords'),
        ]);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $isAdmin = $request->user()?->hasRole(Role::SUPERADMIN->value);

        $this->userService->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // Redirect to appropriate login page
        return $isAdmin
            ? redirect()->route('admin.login')
            : redirect('/');
    }
}
