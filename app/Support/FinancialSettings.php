<?php

namespace App\Support;

use App\Models\System;

/**
 * Helper for reading and writing shared financial settings.
 */
class FinancialSettings
{
    private const DEFAULTS = [
        'vat_type' => 'Fixed Amount',
        'vat_value' => '10,000',
        'platform_fee' => '5,000',
        'door_service_fee' => '3,000',
        'direct_service_fee' => '20,000',
        'indirect_service_fee' => '10,000',
        'insurance_type' => 'Percentage of declared value',
        'insurance_value' => '2',
        'insurance_compensation_value' => '10,000',
        'insurance_min_amount' => '10,000',
        'insurance_max_amount' => '50,000',
    ];

    private const LEGACY_VAT_FIELDS = [
        'direct_vat_type',
        'indirect_vat_type',
        'direct_vat_value',
        'indirect_vat_value',
    ];

    /**
     * Return the default values that should exist when no configuration is stored.
     */
    public static function defaults(): array
    {
        return self::DEFAULTS;
    }

    /**
     * Retrieve all configured financial settings, falling back to defaults and legacy VAT keys.
     */
    public static function get(): array
    {
        $defaults = self::defaults();
        $keys = array_keys($defaults);
        $prefixedKeys = array_map(fn ($key) => self::systemKey($key), $keys);
        $legacyKeys = array_map(fn ($field) => self::systemKey($field), self::LEGACY_VAT_FIELDS);

        $stored = System::whereIn('key', array_merge($prefixedKeys, $legacyKeys))
            ->get()
            ->keyBy('key');

        foreach ($keys as $field) {
            $systemKey = self::systemKey($field);
            if (isset($stored[$systemKey])) {
                $defaults[$field] = $stored[$systemKey]->value ?? $defaults[$field];
            }
        }

        if (! isset($stored[self::systemKey('vat_type')])) {
            $defaults['vat_type'] = self::getLegacyValue($stored, 'direct_vat_type')
                ?? self::getLegacyValue($stored, 'indirect_vat_type')
                ?? $defaults['vat_type'];
        }

        if (! isset($stored[self::systemKey('vat_value')])) {
            $defaults['vat_value'] = self::getLegacyValue($stored, 'direct_vat_value')
                ?? self::getLegacyValue($stored, 'indirect_vat_value')
                ?? $defaults['vat_value'];
        }

        if (! isset($stored[self::systemKey('platform_fee')])) {
            $legacyPlatformFee = self::getLegacyValue($stored, 'direct_platform_fee')
                ?? self::getLegacyValue($stored, 'indirect_platform_fee');
            if ($legacyPlatformFee !== null && $legacyPlatformFee !== '') {
                $defaults['platform_fee'] = $legacyPlatformFee;
            }
        }

        return $defaults;
    }

    /**
     * Persist individual financial fields.
     */
    public static function persist(array $values): void
    {
        foreach ($values as $field => $value) {
            System::updateOrCreate(
                ['key' => self::systemKey($field)],
                ['value' => $value]
            );
        }
    }

    /**
     * Retrieve VAT-specific configuration only.
     */
    public static function getVatConfig(): array
    {
        $settings = self::get();

        return [
            'vat_type' => $settings['vat_type'],
            'vat_value' => $settings['vat_value'],
        ];
    }

    private static function systemKey(string $field): string
    {
        return "financial_settings.{$field}";
    }

    private static function getLegacyValue($stored, string $field): ?string
    {
        $systemKey = self::systemKey($field);

        return isset($stored[$systemKey]) ? $stored[$systemKey]->value : null;
    }
}
