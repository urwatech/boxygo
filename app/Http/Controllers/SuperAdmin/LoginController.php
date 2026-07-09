<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Contracts\UserServiceInterface;
use App\Http\Controllers\Controller;
use App\Support\AdminRouteResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
     * Display the admin login view.
     */
    public function create(): Response
    {
        return Inertia::render('SuperAdmin/Auth/Login');
    }

    /**
     * Handle an incoming authentication request for superadmin.
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

            $user = $request->user();

            if ($user && $user->status !== 'active') {
                $this->userService->logout();

                throw ValidationException::withMessages([
                    'email' => __('yourAccountIsNotActivePleaseContactAnAdministrator'),
                ]);
            }

            $redirectTo = $user ? AdminRouteResolver::firstAccessibleRouteFor($user) : null;

            if (!$redirectTo) {
                $this->userService->logout();

                throw ValidationException::withMessages([
                    'email' => __('yourRoleDoesNotHaveAccessToAnyAdminModules'),
                ]);
            }

            return redirect()->intended($redirectTo);
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
        $this->userService->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }
}
