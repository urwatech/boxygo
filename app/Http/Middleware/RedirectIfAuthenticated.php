<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfAuthenticated
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$guards): Response
    {
        $guards = empty($guards) ? [null] : $guards;

        foreach ($guards as $guard) {
            if (Auth::guard($guard)->check()) {
                $user = Auth::guard($guard)->user();

                // Redirect based on user role
                if ($user->hasRole(Role::SUPERADMIN->value)) {
                    return redirect()->route('admin.dashboard');
                }

                if ($user->hasRole(Role::CUSTOMER->value)) {
                    return redirect('/customer/dashboard');
                }

                // Default fallback (if user has no specific role)
                return redirect('/');
            }
        }

        return $next($request);
    }
}
