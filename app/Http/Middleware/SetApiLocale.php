<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;

class SetApiLocale
{
    public function handle(Request $request, Closure $next)
    {
        App::setLocale($this->resolveLocale($request));

        return $next($request);
    }

    protected function resolveLocale(Request $request): string
    {
        $language = null;

        if ($request->user() && $request->user()->language) {
            $language = $request->user()->language;
        }

        if (! $language) {
            $language = $request->header('X-Language')
                ?? $request->header('Accept-Language')
                ?? $request->input('language')
                ?? $request->query('language')
                ?? $request->query('lang');
        }

        $language = strtolower(trim((string) $language));

        if ($language === '') {
            return 'en';
        }

        if (str_contains($language, ',')) {
            $language = trim(explode(',', $language)[0]);
        }

        if (str_contains($language, ';')) {
            $language = trim(explode(';', $language)[0]);
        }

        if (str_starts_with($language, 'ar')) {
            return 'ar';
        }

        return 'en';
    }
}
