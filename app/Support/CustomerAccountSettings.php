<?php

namespace App\Support;

use App\Models\System;

class CustomerAccountSettings
{
    private const DELETE_ACCOUNT_ENABLED_KEY = 'customer_settings.delete_account_enabled';

    public static function isDeleteAccountEnabled(): bool
    {
        $value = System::query()
            ->where('key', self::DELETE_ACCOUNT_ENABLED_KEY)
            ->value('value');

        if (is_bool($value)) {
            return $value;
        }

        $normalized = strtolower(trim((string) $value));

        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }

    public static function persistDeleteAccountEnabled(bool $enabled): void
    {
        System::query()->updateOrCreate(
            ['key' => self::DELETE_ACCOUNT_ENABLED_KEY],
            ['value' => $enabled ? '1' : '0']
        );
    }
}
