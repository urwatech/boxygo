<?php

namespace App\Support;

use App\Models\Shipment;

class ShipmentPaymentHelper
{
    /**
     * Cache for system settings to avoid N+1 queries during bulk shipment processing.
     *
     * @var array
     */
    private static $settingsCache = [];

    /**
     * Helper to get system settings with internal static caching.
     */
    private static function getSystemSetting(string $key)
    {
        if (! array_key_exists($key, self::$settingsCache)) {
            self::$settingsCache[$key] = \App\Models\System::where('key', $key)->value('value');
        }

        return self::$settingsCache[$key];
    }

    /**
     * Calculate insurance fee based on financial settings.
     * If the shipment already has a stored insurance_fee, use that instead of recalculating.
     * This ensures that old orders maintain their original insurance fee even when settings change.
     */
    private static function calculateInsuranceFee(Shipment $shipment): float
    {
        // If shipment already has a stored insurance fee, use it (this preserves the fee at time of creation)
        if ($shipment->insurance_fee !== null) {
            return (float) $shipment->insurance_fee;
        }

        // If insurance is not opted in, return 0
        if (! $shipment->insurance || strtolower(trim($shipment->insurance)) !== 'yes') {
            return 0.0;
        }

        $goodsAmount = $shipment->parcel_amount !== null ? (float) $shipment->parcel_amount : 0.0;

        // If goods amount is invalid, return 0
        if ($goodsAmount <= 0) {
            return 0.0;
        }

        // Get insurance configuration from System table
        $insuranceType = self::getSystemSetting('financial_settings.insurance_type');
        $insuranceValue = self::getSystemSetting('financial_settings.insurance_value');
        $insuranceMinAmount = self::getSystemSetting('financial_settings.insurance_min_amount');
        $insuranceMaxAmount = self::getSystemSetting('financial_settings.insurance_max_amount');

        // Parse min and max amounts (remove commas)
        $minBound = $insuranceMinAmount ? (float) str_replace(',', '', $insuranceMinAmount) : 0;
        $maxBound = $insuranceMaxAmount ? (float) str_replace(',', '', $insuranceMaxAmount) : PHP_FLOAT_MAX;

        // Check if goods amount is within bounds
        if ($goodsAmount < $minBound || $goodsAmount > $maxBound) {
            return 0.0;
        }

        // Calculate insurance fee based on type
        $numericInsuranceValue = is_numeric($insuranceValue) ? (float) $insuranceValue : 0;

        if ($insuranceType && str_contains(strtolower(trim($insuranceType)), 'percentage')) {
            return round($goodsAmount * ($numericInsuranceValue / 100), 2);
        }

        return round($numericInsuranceValue, 2);
    }

    /**
     * Calculate VAT amount from financial settings (matches frontend logic).
     */
    private static function calculateVatFromFinancialSettings(Shipment $shipment, float $baseAmount): float
    {
        $deliverySpeed = $shipment->delivery_speed ?? 'direct';
        $speedKey = strtolower(trim($deliverySpeed)) === 'indirect' ? 'indirect' : 'direct';

        // Get VAT configuration from System table
        $vatTypeKey = "financial_settings.{$speedKey}_vat_type";
        $vatValueKey = "financial_settings.{$speedKey}_vat_value";

        $vatType = self::getSystemSetting($vatTypeKey);
        $vatValue = self::getSystemSetting($vatValueKey);

        // If financial settings specify percentage type
        if ($vatType && strtolower(trim($vatType)) === 'percentage' && $vatValue !== null) {
            $numericValue = is_numeric($vatValue) ? (float) $vatValue : (float) str_replace('%', '', $vatValue);

            return round($baseAmount * ($numericValue / 100), 2);
        }

        // If fixed amount type
        if ($vatType && strtolower(trim($vatType)) !== 'percentage' && is_numeric($vatValue)) {
            return round((float) $vatValue, 2);
        }

        // Fallback to shipment's vat_rate or default
        $fallbackRate = $shipment->vat_rate ?? $shipment->vat_percentage ?? 0.05;
        if (is_numeric($fallbackRate)) {
            $rate = (float) $fallbackRate;
        } else {
            $rateString = (string) $fallbackRate;
            $rate = str_contains($rateString, '%')
                ? (float) str_replace('%', '', $rateString) / 100
                : (float) $rateString;
        }
        if (! is_finite($rate)) {
            $rate = 0.05;
        }

        return round($baseAmount * $rate, 2);
    }

    /**
     * Calculate payment details for a shipment.
     * Returns a complete payment breakdown including collectable_total.
     */
    public static function calculatePaymentDetails(Shipment $shipment): array
    {
        // Shipment fee (delivery cost)
        $shipmentFee = (float) ($shipment->total_fee ?? $shipment->parcel_amount ?? 0);

        $deliverySpeed = $shipment->delivery_speed ?? 'direct';
        $platformFeeKey = 'financial_settings.platform_fee';

        $configuredPlatformFee = self::getSystemSetting($platformFeeKey);
        if ($configuredPlatformFee === null) {
            $configuredPlatformFee = self::getSystemSetting('financial_settings.direct_platform_fee')
                ?? self::getSystemSetting('financial_settings.indirect_platform_fee');
        }

        $platformFeeRaw = $shipment->platform_fee
            ?? $shipment->platform_fee_amount
            ?? ($configuredPlatformFee !== null ? floatval(str_replace(',', '', $configuredPlatformFee)) : config('pricing.platform_fee', 5));
        $platformFee = (float) $platformFeeRaw;

        // Calculate amounts
        $goodsAmount = $shipment->parcel_amount !== null ? (float) $shipment->parcel_amount : 0.0;
        $serviceFee = $shipment->service_fee !== null ? (float) $shipment->service_fee : 0.0;

        // Calculate insurance fee
        $insuranceFee = self::calculateInsuranceFee($shipment);

        $subtotal = round($shipmentFee + $goodsAmount + $insuranceFee + $serviceFee, 2);

        $taxableSubtotal = round($shipmentFee + $platformFee + $insuranceFee + $serviceFee, 2);

        // Calculate VAT using stored value or financial settings
        $vatAmount = $shipment->vat_amount !== null
            ? (float) $shipment->vat_amount
            : self::calculateVatFromFinancialSettings($shipment, $taxableSubtotal);

        // Calculate VAT rate percentage for display
        $vatRatePercentage = $taxableSubtotal > 0 ? round(($vatAmount / $taxableSubtotal) * 100) : 0;

        $totalDue = round($subtotal + $platformFee + $vatAmount, 2);
        $collectableTotal = $totalDue;

        $formatAmount = static function ($value) {
            if ($value === null) {
                return null;
            }

            return (int) round((float) $value);
        };

        return [
            'method' => $shipment->payment_method,
            'status' => $shipment->payment_status,
            'shipment_fee' => $formatAmount($shipmentFee),
            'sender_zone_delivery_fee' => $formatAmount($shipment->sender_zone_delivery_fee),
            'reciever_zone_delivery_fee' => $formatAmount($shipment->reciever_zone_delivery_fee),
            'service_fee' => $formatAmount($serviceFee),
            'platform_fee' => $formatAmount($platformFee),
            'insurance_fee' => $formatAmount($insuranceFee),
            'vat_rate' => (int) $vatRatePercentage,
            'vat_amount' => $formatAmount($vatAmount),
            'total_due' => $formatAmount($totalDue),
            'goods_amount' => $formatAmount($goodsAmount),
            'subtotal' => $formatAmount($subtotal),
            'collectable_total' => $formatAmount($collectableTotal),
            'total_fee' => $formatAmount($collectableTotal),
            'parcel_amount' => $shipment->parcel_amount !== null ? $formatAmount($shipment->parcel_amount) : null,
            'requires_receiver_payment' => $shipment->requiresReceiverPaymentConfirmation(),
        ];
    }

    /**
     * Get the collectable total amount for a shipment.
     */
    public static function getCollectableTotal(Shipment $shipment): int
    {
        $details = self::calculatePaymentDetails($shipment);

        return $details['collectable_total'] ?? 0;
    }

    /**
     * Get goods amount (parcel value) for a shipment.
     */
    public static function getGoodsAmount(Shipment $shipment): int
    {
        $details = self::calculatePaymentDetails($shipment);

        return $details['goods_amount'] ?? 0;
    }
}
