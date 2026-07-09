<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\Governate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $country = strtolower((string) $request->query('country', ''));

        if ($country !== '' && $country !== 'syria') {
            return response()->json(['data' => []]);
        }

        $cities = City::query()
            ->with('governate:id,name,short_code')
            ->orderBy('name')
            ->get()
            ->map(static function (City $city) {
                return [
                    'id' => $city->id,
                    'name' => $city->name,
                    'short_code' => $city->short_code,
                    'type' => $city->type,
                    'governate' => optional($city->governate)->name,
                    'governate_id' => $city->governate_id,
                    'latitude' => $city->latitude,
                    'longitude' => $city->longitude,
                ];
            });

        return response()->json([
            'data' => $cities,
        ]);
    }

    public function check(Request $request): JsonResponse
    {
        $latitude = $request->query('lat');
        $longitude = $request->query('lon');
        $radius = (float) $request->query('radius', 15); // Default radius: 15 km
        $cityName = (string) $request->query('city', '');
        $stateName = (string) $request->query('state', '');

        // Primary: Try coordinate-based lookup
        if (is_numeric($latitude) && is_numeric($longitude)) {
            $city = $this->findCityByCoordinates((float) $latitude, (float) $longitude, $radius);
            if ($city) {
                return response()->json([
                    'exists' => true,
                    'data' => [
                        'id' => $city->id,
                        'name' => $city->name,
                        'short_code' => $city->short_code,
                        'type' => $city->type,
                        'governate' => [
                            'id' => optional($city->governate)->id,
                            'name' => optional($city->governate)->name,
                            'short_code' => optional($city->governate)->short_code,
                        ],
                        'distance_km' => round($city->distance ?? 0, 2),
                    ],
                ]);
            }
        }

        // Fallback: Try name-based lookup if coordinates didn't work and names provided
        if (!empty($cityName)) {
            return $this->checkByName($request);
        }

        // Neither coordinates nor city name provided
        return response()->json([
            'exists' => false,
            'data' => null,
            'error' => __('missingOrInvalidParametersProvideEitherLatitudeLongitudeOrCityName'),
        ], 422);
    }

    /**
     * Find city by coordinates using Haversine formula
     */
    private function findCityByCoordinates(float $latitude, float $longitude, float $radius = 15): ?City
    {
        $earthRadius = 6371; // Earth radius in kilometers

        return City::query()
            ->with('governate')
            ->selectRaw(
                'cities.*,
                (? * acos(
                    cos(radians(?)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians(?)) +
                    sin(radians(?)) * sin(radians(latitude))
                )) AS distance',
                [$earthRadius, $latitude, $longitude, $latitude]
            )
            ->whereRaw(
                '(? * acos(
                    cos(radians(?)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians(?)) +
                    sin(radians(?)) * sin(radians(latitude))
                )) <= ?',
                [$earthRadius, $latitude, $longitude, $latitude, $radius]
            )
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderByRaw('distance ASC')
            ->first();
    }

    /**
     * Check city by name (for backwards compatibility)
     */
    private function checkByName(Request $request): JsonResponse
    {
        $cityName = (string) $request->query('city', '');
        $stateName = (string) $request->query('state', '');

        if ($cityName === '') {
            return response()->json([
                'exists' => false,
                'data' => null,
                'error' => __('missingCityParameter'),
            ], 422);
        }

        $query = City::query()->with('governate');

        // Helpers for normalization
        $normalize = static function (string $value): string {
            $v = mb_strtolower(trim($value));
            // Remove common suffixes/prefixes
            $v = preg_replace('/\b(governorate|province|muhafazah|district|subdistrict|municipality)\b/iu', '', $v);
            $v = preg_replace('/\s+/', ' ', $v ?? '');
            return trim($v);
        };

        // Try to resolve governate using relaxed matching
        $gov = null;
        if ($stateName !== '') {
            $stateNorm = $normalize($stateName);
            if ($stateNorm !== '') {
                $gov = Governate::query()
                    ->whereRaw('LOWER(short_code) = ?', [$stateNorm])
                    ->orWhereRaw('LOWER(name) = ?', [$stateNorm])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%' . $stateNorm . '%'])
                    ->first();
            }
        }

        /*if ($gov) {
            $query->where('governate_id', $gov->id);
        }*/

        // City relaxed search: exact, then LIKE
        $cityNorm = $normalize($cityName);
        $city = (clone $query)
            ->where(function ($q) use ($cityName, $cityNorm) {
                $q->whereRaw('LOWER(name) = ?', [mb_strtolower($cityName)])
                  ->orWhereRaw('LOWER(short_code) = ?', [mb_strtolower($cityName)])
                  ->orWhereRaw('LOWER(name) = ?', [$cityNorm])
                  ->orWhereRaw('LOWER(name) LIKE ?', ['%' . $cityNorm . '%']);
            })
            ->first();

        if (!$city) {
            return response()->json([
                'exists' => false,
                'data' => null,
            ]);
        }

        return response()->json([
            'exists' => true,
            'data' => [
                'id' => $city->id,
                'name' => $city->name,
                'short_code' => $city->short_code,
                'type' => $city->type,
                'governate' => [
                    'id' => optional($city->governate)->id,
                    'name' => optional($city->governate)->name,
                    'short_code' => optional($city->governate)->short_code,
                ],
            ],
        ]);
    }
}
