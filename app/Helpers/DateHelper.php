<?php

namespace App\Helpers;

use Carbon\Carbon;

class DateHelper
{
    /**
     * Convert a date to Excel serial number (days since 1900-01-01)
     * This matches Excel's date numbering system where 1900-01-01 = 1
     *
     * Note: Excel has a bug where it treats 1900 as a leap year (it wasn't).
     * This implementation replicates Excel's behavior for compatibility.
     *
     * @param  Carbon|null  $date  The date to convert (defaults to today)
     * @return int The Excel serial number
     */
    public static function toExcelSerialDate(?Carbon $date = null): int
    {
        if ($date === null) {
            $date = Carbon::today();
        }

        // Excel's epoch is 1900-01-01 (which equals serial number 1)
        $excelEpoch = Carbon::create(1900, 1, 1, 0, 0, 0);

        // Calculate days difference
        $daysDifference = $excelEpoch->diffInDays($date, false);

        // Excel serial number starts at 1, not 0
        // Add 1 to account for the epoch day itself
        $serialNumber = abs($daysDifference) + 1;

        // Excel incorrectly treats 1900 as a leap year
        // So dates after Feb 28, 1900 need to be incremented by 1
        if ($date->greaterThan(Carbon::create(1900, 2, 28))) {
            $serialNumber++;
        }

        return $serialNumber;
    }

    /**
     * Get the last 4 digits of the Excel serial date number
     *
     * @param  Carbon|null  $date  The date to convert (defaults to today)
     * @return string The last 4 digits as a zero-padded string
     */
    public static function getExcelDateSuffix(?Carbon $date = null): string
    {
        $serialNumber = self::toExcelSerialDate($date);

        // Get last 4 digits
        $lastFourDigits = $serialNumber % 10000;

        // Return as 4-character string with leading zeros
        return str_pad((string) $lastFourDigits, 4, '0', STR_PAD_LEFT);
    }
}
