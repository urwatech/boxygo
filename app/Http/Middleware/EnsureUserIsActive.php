<?php

namespace App\Http\Middleware;

use App\Http\ApiResponse;
use Closure;
use Illuminate\Http\Request;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->status !== 'active') {
            // Revoke API access immediately for blocked users
            $user->tokens()->delete();

            return ApiResponse::unauthorized('Your account is inactive or blocked. Please contact support.');
        }

        return $next($request);
    }
}
