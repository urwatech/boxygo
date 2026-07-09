<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderMileageLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'shipment_id',
        'start_latitude',
        'start_longitude',
        'end_latitude',
        'end_longitude',
        'distance_km',
        'distance_miles',
        'status_from',
        'status_to',
        'notes',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'start_latitude' => 'decimal:8',
        'start_longitude' => 'decimal:8',
        'end_latitude' => 'decimal:8',
        'end_longitude' => 'decimal:8',
        'distance_km' => 'decimal:2',
        'distance_miles' => 'decimal:2',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    /**
     * Get the user (rider/driver) who traveled this distance.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the shipment associated with this mileage log.
     */
    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    /**
     * Get the duration of this trip segment in minutes.
     */
    public function getDurationMinutes(): ?int
    {
        if (! $this->started_at || ! $this->ended_at) {
            return null;
        }

        return $this->started_at->diffInMinutes($this->ended_at);
    }

    /**
     * Calculate distance between two GPS coordinates using Haversine formula.
     * Returns distance in kilometers.
     */
    public static function calculateDistance(
        ?float $lat1,
        ?float $lon1,
        ?float $lat2,
        ?float $lon2
    ): float {
        if ($lat1 === null || $lon1 === null || $lat2 === null || $lon2 === null) {
            return 0;
        }

        $earthRadius = 6371; // Earth's radius in kilometers

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }

    /**
     * Convert kilometers to miles.
     */
    public static function kmToMiles(float $km): float
    {
        return round($km * 0.621371, 2);
    }

    /**
     * Create a mileage log entry from two coordinates.
     */
    public static function logDistance(
        int $userId,
        ?int $shipmentId,
        ?float $startLat,
        ?float $startLon,
        ?float $endLat,
        ?float $endLon,
        ?string $statusFrom = null,
        ?string $statusTo = null,
        ?\DateTime $startedAt = null,
        ?\DateTime $endedAt = null
    ): ?self {
        $distanceKm = self::calculateDistance($startLat, $startLon, $endLat, $endLon);

        // Only log if there's actual distance traveled (minimum 0.01 km = 10 meters)
        if ($distanceKm < 0.01) {
            return null;
        }

        return self::create([
            'user_id' => $userId,
            'shipment_id' => $shipmentId,
            'start_latitude' => $startLat,
            'start_longitude' => $startLon,
            'end_latitude' => $endLat,
            'end_longitude' => $endLon,
            'distance_km' => $distanceKm,
            'distance_miles' => self::kmToMiles($distanceKm),
            'status_from' => $statusFrom,
            'status_to' => $statusTo,
            'started_at' => $startedAt ?? now(),
            'ended_at' => $endedAt ?? now(),
        ]);
    }
}
