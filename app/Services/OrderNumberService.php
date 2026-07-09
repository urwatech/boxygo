<?php

namespace App\Services;

use App\Helpers\DateHelper;
use App\Models\Shipment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class OrderNumberService
{
    /**
     * Generate a unique order number for a shipment
     *
     * Format: N{SERIAL}{DATE_SUFFIX}
     * - N: Order type (N = Normal)
     * - SERIAL: 4-digit daily serial number (0001-9999)
     * - DATE_SUFFIX: Last 4 digits of Excel serial date
     *
     * Example: N03165850
     * - N: Normal order
     * - 0316: 316th order today
     * - 5850: Last 4 digits of date serial number
     *
     * @return string The generated order number (9 characters)
     */
    public function generateOrderNumber(string $bookingType = 'shipment'): string
    {
        if ($bookingType === 'return') {
            $orderType = 'R'; // R for Return
        } else {
            $orderType = 'N'; // N for Normal
        }
        $today = Carbon::today();

        // Get the last 4 digits of today's Excel serial date
        $dateSuffix = DateHelper::getExcelDateSuffix($today);

        // Get today's serial number (atomic increment)
        $dailySerial = $this->getDailySerialNumber($today);

        // Format: N + 4-digit serial + 4-digit date suffix
        $orderNumber = $orderType.$dailySerial.$dateSuffix;

        return $orderNumber;
    }

    /**
     * Get the next daily serial number for today
     * This uses database locking to ensure uniqueness in concurrent requests
     *
     * @param  Carbon  $date  The date to get the serial for
     * @return string 4-digit zero-padded serial number
     */
    private function getDailySerialNumber(Carbon $date): string
    {
        // Use database transaction with locking to prevent race conditions
        return DB::transaction(function () use ($date) {
            $startOfDay = $date->copy()->startOfDay();
            $endOfDay = $date->copy()->endOfDay();

            // Get the count of orders created today (with row lock)
            // We use FOR UPDATE to lock the rows during counting
            $todayCount = Shipment::whereBetween('created_at', [$startOfDay, $endOfDay])
                ->lockForUpdate()
                ->count();

            // The next serial number is count + 1
            $nextSerial = $todayCount + 1;

            // Ensure it doesn't exceed 9999
            if ($nextSerial > 9999) {
                throw new \RuntimeException('Daily order limit exceeded (max 9999 orders per day)');
            }

            // Return as 4-digit zero-padded string
            return str_pad((string) $nextSerial, 4, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Parse an order number to extract its components
     *
     * @param  string  $orderNumber  The order number to parse
     * @return array{type: string, serial: string, date_suffix: string}
     */
    public function parseOrderNumber(string $orderNumber): array
    {
        if (strlen($orderNumber) !== 9) {
            throw new \InvalidArgumentException('Order number must be exactly 9 characters');
        }

        return [
            'type' => substr($orderNumber, 0, 1),        // First character (N)
            'serial' => substr($orderNumber, 1, 4),      // Next 4 digits
            'date_suffix' => substr($orderNumber, 5, 4), // Last 4 digits
        ];
    }

    /**
     * Get the approximate date from an order number
     * Note: This is approximate because we only have the last 4 digits
     *
     * @param  string  $orderNumber  The order number
     * @return Carbon|null The approximate date, or null if cannot determine
     */
    public function getDateFromOrderNumber(string $orderNumber): ?Carbon
    {
        try {
            $parsed = $this->parseOrderNumber($orderNumber);
            $dateSuffix = $parsed['date_suffix'];

            // Search for dates within a reasonable range (e.g., last 5 years)
            $startDate = Carbon::now()->subYears(5);
            $endDate = Carbon::now()->addYear();

            $current = $startDate->copy();
            while ($current->lte($endDate)) {
                if (DateHelper::getExcelDateSuffix($current) === $dateSuffix) {
                    return $current;
                }
                $current->addDay();
            }

            return null;
        } catch (\Exception $e) {
            return null;
        }
    }
}
