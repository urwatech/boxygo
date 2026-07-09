<?php

namespace App\Services;

use App\Models\Zone;
use Illuminate\Support\Collection;

class ZoneHelper
{
    /**
     * Check if a point (latitude, longitude) is inside a polygon zone
     * Uses ray-casting algorithm for point-in-polygon test
     *
     * @param float $latitude
     * @param float $longitude
     * @param array $polygon Array of ['lat' => float, 'lng' => float]
     * @return bool
     */
    public static function isPointInPolygon(float $latitude, float $longitude, array $polygon): bool
    {
        $vertices_count = count($polygon);

        if ($vertices_count < 3) {
            return false; // Not a valid polygon
        }

        $intersections = 0;
        $j = $vertices_count - 1;

        for ($i = 0; $i < $vertices_count; $i++) {
            $vertex1 = $polygon[$i];
            $vertex2 = $polygon[$j];

            // Check if point is on the same latitude as a horizontal edge
            if (($vertex1['lat'] > $latitude) !== ($vertex2['lat'] > $latitude)) {
                // Calculate the x-coordinate of the intersection
                $slope = ($vertex2['lng'] - $vertex1['lng']) / ($vertex2['lat'] - $vertex1['lat']);
                $x_intersection = $vertex1['lng'] + ($latitude - $vertex1['lat']) * $slope;

                if ($longitude < $x_intersection) {
                    $intersections++;
                }
            }

            $j = $i;
        }

        // Point is inside if number of intersections is odd
        return ($intersections % 2) !== 0;
    }

    /**
     * Find which zone contains the given coordinates
     *
     * @param float $latitude
     * @param float $longitude
     * @param bool $onlyActive
     * @return Zone|null
     */
    public static function findZoneByCoordinates(float $latitude, float $longitude, bool $onlyActive = true): ?Zone
    {
        // Use bounding box logic to significantly reduce candidate zones.
        // Fallback to all active zones if bound limits are not set.
        $query = Zone::query();
        $query->notDeleted();

        if ($onlyActive) {
            $query->where('status', Zone::STATUS_ACTIVE);
        }

        $zones = $query->where(function ($query) use ($latitude, $longitude) {
                // If the bounds exist, MUST match bounds
                $query->where(function ($boundQuery) use ($latitude, $longitude) {
                    $boundQuery->whereNotNull('bound_min_lat')
                        ->where('bound_min_lat', '<=', $latitude)
                        ->where('bound_max_lat', '>=', $latitude)
                        ->where('bound_min_lng', '<=', $longitude)
                        ->where('bound_max_lng', '>=', $longitude);
                })
                // Fallback: If bounding box wasn't calculated, still evaluate it dynamically in PHP
                ->orWhereNull('bound_min_lat');
            })
            ->get();

        foreach ($zones as $zone) {
            if (!empty($zone->drawn_paths) && is_array($zone->drawn_paths)) {
                // Handle nested array structure from database: [[{lat, lng}, ...]]
                // The drawn_paths can be nested, so we need to check each polygon
                foreach ($zone->drawn_paths as $polygon) {
                    if (is_array($polygon) && self::isPointInPolygon($latitude, $longitude, $polygon)) {
                        return $zone;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Get all employees within a specific zone
     *
     * @param int $zoneId
     * @param string|null $role Filter by role (e.g., 'rider', 'car driver')
     * @return Collection
     */
    public static function getEmployeesInZone(int $zoneId, ?string $role = null): Collection
    {
        $query = \App\Models\User::where('zone_id', $zoneId)
            ->where('platform', 'Mobile App')
            ->where('status', 'active');

        if ($role) {
            $query->role($role);
        }

        return $query->with(['roles', 'vehicles'])->get();
    }

    /**
     * Get available employees for a shipment based on pickup location
     *
     * @param float $pickupLatitude
     * @param float $pickupLongitude
     * @param string $role Role needed (rider, car driver, etc.)
     * @param array $excludeUserIds User IDs to exclude
     * @return Collection
     */
    public static function getAvailableEmployeesForLocation(
        float $pickupLatitude,
        float $pickupLongitude,
        string $role,
        array $excludeUserIds = []
    ): Collection {
        // Find the zone containing this location
        $zone = self::findZoneByCoordinates($pickupLatitude, $pickupLongitude);

        if (!$zone) {
            // If no zone found, return all employees with the role
            $query = \App\Models\User::query()
                ->where('platform', 'Mobile App')
                ->where('status', 'active')
                ->role($role);

            if (!empty($excludeUserIds)) {
                $query->whereNotIn('id', $excludeUserIds);
            }

            return $query->with(['roles', 'vehicles'])->get();
        }

        // Return employees assigned to this zone with the specific role
        $query = \App\Models\User::where('zone_id', $zone->id)
            ->where('platform', 'Mobile App')
            ->where('status', 'active')
            ->role($role);

        if (!empty($excludeUserIds)) {
            $query->whereNotIn('id', $excludeUserIds);
        }

        return $query->with(['roles', 'vehicles'])->get();
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     *
     * @param float $lat1
     * @param float $lng1
     * @param float $lat2
     * @param float $lng2
     * @return float Distance in kilometers
     */
    public static function calculateDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371; // Earth's radius in kilometers

        $latDiff = deg2rad($lat2 - $lat1);
        $lngDiff = deg2rad($lng2 - $lng1);

        $a = sin($latDiff / 2) * sin($latDiff / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($lngDiff / 2) * sin($lngDiff / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * Find nearest employees to a location within the same zone
     *
     * @param float $latitude
     * @param float $longitude
     * @param string $role
     * @param int $limit
     * @return Collection
     */
    public static function findNearestEmployees(
        float $latitude,
        float $longitude,
        string $role,
        int $limit = 10
    ): Collection {
        $employees = self::getAvailableEmployeesForLocation($latitude, $longitude, $role);

        // Calculate distances and sort
        $employeesWithDistance = $employees->map(function ($employee) use ($latitude, $longitude) {
            if ($employee->latitude && $employee->longitude) {
                $employee->distance = self::calculateDistance(
                    $latitude,
                    $longitude,
                    $employee->latitude,
                    $employee->longitude
                );
            } else {
                $employee->distance = PHP_FLOAT_MAX; // No location set
            }
            return $employee;
        });

        return $employeesWithDistance
            ->sortBy('distance')
            ->take($limit)
            ->values();
    }

    /**
     * Auto-assign zone to an employee based on their coordinates
     *
     * @param \App\Models\User $user
     * @return Zone|null
     */
    public static function autoAssignZoneToEmployee(\App\Models\User $user): ?Zone
    {
        if (!$user->latitude || !$user->longitude) {
            return null;
        }

        $zone = self::findZoneByCoordinates($user->latitude, $user->longitude);

        if ($zone) {
            $user->zone_id = $zone->id;
            $user->save();
        }

        return $zone;
    }

    /**
     * Validate if a zone assignment is valid for an employee's location
     *
     * @param int $zoneId
     * @param float|null $latitude
     * @param float|null $longitude
     * @return bool
     */
    public static function validateZoneAssignment(int $zoneId, ?float $latitude, ?float $longitude): bool
    {
        if (!$latitude || !$longitude) {
            return true; // Allow assignment if no coordinates
        }

        $zone = Zone::query()
            ->notDeleted()
            ->find($zoneId);

        if (!$zone || empty($zone->drawn_paths)) {
            return true; // Allow if zone has no boundaries
        }

        return self::isPointInPolygon($latitude, $longitude, $zone->drawn_paths);
    }
}
