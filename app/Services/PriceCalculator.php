<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * PriceCalculator Service
 *
 * Calculates shipment prices between cities based on governorate and city type.
 * Pricing logic is driven by configuration values in config/pricing.php.
 */
class PriceCalculator
{
    /**
     * City type constants
     */
    public const TYPE_MAIN_CITY = 'M';

    public const TYPE_COUNTRYSIDE = 'CS';

    /**
     * Valid city types
     */
    private const VALID_TYPES = [self::TYPE_MAIN_CITY, self::TYPE_COUNTRYSIDE];

    /**
     * Pricing configuration values
     */
    private array $config;

    /**
     * Constructor - loads pricing configuration
     */
    public function __construct()
    {
        $this->config = config('pricing', []);
        $this->validateConfig();
    }

    /**
     * Calculate shipment price between two locations
     *
     * Business Rules (from Excel):
     * 1. If governorates differ, add "different_gov"
     * 2. If city types differ, add "m_cs"
     * 3. If both are countryside (CS) but different governorates, add "cs"
     * 4. Always add "inside_city" (base charge)
     *
     * @param  string|int  $fromGov  Sender's governorate ID or short code
     * @param  string  $fromType  Sender's city type (M or CS)
     * @param  string|int  $toGov  Receiver's governorate ID or short code
     * @param  string  $toType  Receiver's city type (M or CS)
     * @return float The calculated shipment price
     *
     * @throws InvalidArgumentException If invalid parameters provided
     */
    public function calculate(
        string|int $fromGov,
        string $fromType,
        string|int $toGov,
        string $toType
    ): float {
        // Validate inputs
        $this->validateCityType($fromType, 'fromType');
        $this->validateCityType($toType, 'toType');

        // Initialize price with base "inside_city" charge (always included)
        $price = $this->config['inside_city'];

        // Normalize governorate values for comparison
        $fromGovNormalized = $this->normalizeGovernorate($fromGov);
        $toGovNormalized = $this->normalizeGovernorate($toGov);

        // Check if governorates are different
        $isDifferentGovernorate = $fromGovNormalized !== $toGovNormalized;

        // Check if city types are different
        $isDifferentCityType = $fromType !== $toType;

        // Check if both are countryside
        $isBothCountryside = $fromType === self::TYPE_COUNTRYSIDE && $toType === self::TYPE_COUNTRYSIDE;

        // Rule 1: If governorates differ, add "different_gov"
        if ($isDifferentGovernorate) {
            $price += $this->config['different_gov'];
        }

        // Rule 2: If city types differ, add "m_cs"
        if ($isDifferentCityType) {
            $price += $this->config['m_cs'];
        }

        // Rule 3: If both are countryside (CS) but different governorates, add "cs"
        if ($isBothCountryside && $isDifferentGovernorate) {
            $price += $this->config['cs'];
        }

        return $price;
    }

    /**
     * Calculate with breakdown showing how the price was calculated
     *
     * @return array ['total' => float, 'breakdown' => array]
     */
    public function calculateWithBreakdown(
        string|int $fromGov,
        string $fromType,
        string|int $toGov,
        string $toType
    ): array {
        // Validate inputs
        $this->validateCityType($fromType, 'fromType');
        $this->validateCityType($toType, 'toType');

        $breakdown = [];

        // Base charge (always included)
        $breakdown[] = [
            'label' => 'Base Charge (Inside City)',
            'amount' => $this->config['inside_city'],
            'applied' => true,
        ];

        // Normalize governorate values for comparison
        $fromGovNormalized = $this->normalizeGovernorate($fromGov);
        $toGovNormalized = $this->normalizeGovernorate($toGov);

        // Check conditions
        $isDifferentGovernorate = $fromGovNormalized !== $toGovNormalized;
        $isDifferentCityType = $fromType !== $toType;
        $isBothCountryside = $fromType === self::TYPE_COUNTRYSIDE && $toType === self::TYPE_COUNTRYSIDE;

        // Different governorate charge
        $breakdown[] = [
            'label' => 'Different Governorate',
            'amount' => $this->config['different_gov'],
            'applied' => $isDifferentGovernorate,
        ];

        // Different city type charge
        $breakdown[] = [
            'label' => 'Main City to Countryside (or vice versa)',
            'amount' => $this->config['m_cs'],
            'applied' => $isDifferentCityType,
        ];

        // Both countryside in different governorates
        $breakdown[] = [
            'label' => 'Both Countryside (Different Governorates)',
            'amount' => $this->config['cs'],
            'applied' => $isBothCountryside && $isDifferentGovernorate,
        ];

        // Calculate total
        $total = array_sum(
            array_column(
                array_filter($breakdown, fn ($item) => $item['applied']),
                'amount'
            )
        );

        return [
            'total' => $total,
            'breakdown' => $breakdown,
            'from' => [
                'governorate' => $fromGov,
                'type' => $fromType,
                'type_label' => $this->getCityTypeLabel($fromType),
            ],
            'to' => [
                'governorate' => $toGov,
                'type' => $toType,
                'type_label' => $this->getCityTypeLabel($toType),
            ],
        ];
    }

    /**
     * Get pricing configuration
     */
    public function getConfig(): array
    {
        return $this->config;
    }

    /**
     * Validate that all required config values are present
     *
     * @throws InvalidArgumentException
     */
    private function validateConfig(): void
    {
        $requiredKeys = ['different_gov', 'm_cs', 'inside_city', 'cs'];

        foreach ($requiredKeys as $key) {
            if (! isset($this->config[$key])) {
                throw new InvalidArgumentException(
                    "Missing required pricing configuration key: {$key}. ".
                    'Please check config/pricing.php'
                );
            }

            if (! is_numeric($this->config[$key])) {
                throw new InvalidArgumentException(
                    "Pricing configuration key '{$key}' must be numeric. ".
                    'Please check config/pricing.php'
                );
            }
        }
    }

    /**
     * Validate city type
     *
     * @throws InvalidArgumentException
     */
    private function validateCityType(string $type, string $paramName): void
    {
        if (! in_array($type, self::VALID_TYPES, true)) {
            throw new InvalidArgumentException(
                "Invalid city type '{$type}' for parameter '{$paramName}'. ".
                "Expected 'M' (Main City) or 'CS' (Countryside)."
            );
        }
    }

    /**
     * Normalize governorate value for comparison
     * Converts to string and trims whitespace
     */
    private function normalizeGovernorate(string|int $governorate): string
    {
        return trim((string) $governorate);
    }

    /**
     * Get human-readable label for city type
     */
    private function getCityTypeLabel(string $type): string
    {
        return match ($type) {
            self::TYPE_MAIN_CITY => 'Main City',
            self::TYPE_COUNTRYSIDE => 'Countryside',
            default => 'Unknown',
        };
    }
}
