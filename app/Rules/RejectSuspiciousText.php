<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Log;

class RejectSuspiciousText implements ValidationRule
{
    /**
     * Run the validation rule.
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $normalized = mb_strtolower((string) $value);
        $patterns = [
            '<script',
            'javascript:',
            'onerror=',
            'onload=',
            'union select',
            'select * from',
            'drop table',
            '--',
            '/*',
            '<iframe',
            '<img',
        ];

        foreach ($patterns as $pattern) {
            if (str_contains($normalized, $pattern)) {
                Log::warning('Suspicious text rejected', [
                    'attribute' => $attribute,
                    'ip' => request()->ip(),
                ]);

                $fail('The :attribute contains disallowed content.');

                return;
            }
        }
    }
}
