<?php

namespace App\Support;

final class SortHelper
{
    public static function key(mixed $value): string
    {
        if (is_array($value)) {
            $value = reset($value) ?: '';
        }

        if (is_object($value)) {
            $value = '';
        }

        return trim((string) preg_replace('/[^a-z0-9]+/', '_', strtolower(trim((string) $value))), '_');
    }

    public static function direction(mixed $direction, string $default = 'desc'): string
    {
        $default = strtolower($default) === 'asc' ? 'asc' : 'desc';
        $direction = self::key($direction);

        return match ($direction) {
            'asc', 'ascending' => 'asc',
            'desc', 'descending' => 'desc',
            default => $default,
        };
    }

    /**
     * @param  array<string, string>  $allowed
     */
    public static function column(mixed $sortBy, array $allowed, string $default): string
    {
        return $allowed[self::key($sortBy)] ?? $default;
    }
}
