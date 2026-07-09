<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Location\LocationSearchRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class LocationController extends Controller
{
    /**
     * Search locations using Google APIs
     * First tries Places API (New), falls back to Geocoding API
     * Server-side endpoint to avoid CORS issues
     */
    public function searchGoogle(LocationSearchRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $query = $validated['q'];
        $countryCode = $validated['country_code'] ?? 'sy';
        $limit = $validated['limit'] ?? 6;

        $apiKey = config('services.google.places_api_key');
        if (! $apiKey) {
            return response()->json([
                'success' => false,
                'message' => __('googleApiKeyNotConfigured'),
                'results' => [],
            ], 500);
        }

        try {
            // Try using Google Geocoding API (more widely available)
            $results = $this->geocodeLocations($query, $countryCode, $apiKey, $limit);

            if (! empty($results)) {
                return response()->json([
                    'success' => true,
                    'results' => $results,
                ]);
            }

            // Fallback: if geocoding returns no results
            return response()->json([
                'success' => true,
                'results' => [],
            ]);
        } catch (\Exception $e) {
            \Log::warning('Location search error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => __('failedToSearchLocationsMakeSureGeocodingApiIsEnabledInGoogleCloudConsole'),
                'results' => [],
                'debug' => env('APP_DEBUG') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Geocode locations using Google Geocoding API
     * More reliable and commonly available than Places API
     */
    private function geocodeLocations(
        string $query,
        string $countryCode,
        string $apiKey,
        int $limit
    ): array {
        $response = Http::timeout(10)->get('https://maps.googleapis.com/maps/api/geocode/json', [
            'address' => $query,
            'components' => "country:{$countryCode}",
            'key' => $apiKey,
            'language' => 'en',
        ]);

        if (! $response->successful()) {
            throw new \Exception(__('failedToFetchGeocodingResults'));
        }

        $data = $response->json();

        if ($data['status'] !== 'OK' && $data['status'] !== 'ZERO_RESULTS') {
            throw new \Exception($data['error_message'] ?? __('unknownErrorStatus', ['status' => $data['status']]));
        }

        $results = [];
        foreach (array_slice($data['results'] ?? [], 0, $limit) as $result) {
            $components = $this->parseAddressComponents($result['address_components'] ?? []);

            $results[] = [
                'address' => $result['formatted_address'],
                'lat' => $result['geometry']['location']['lat'],
                'lon' => $result['geometry']['location']['lng'],
                'components' => $components,
                'source' => 'google',
            ];
        }

        return $results;
    }

    /**
     * Parse Google address components to match OpenStreetMap structure
     * Also extracts street address and other detailed information
     */
    private function parseAddressComponents(array $components): array
    {
        $result = [];

        foreach ($components as $component) {
            $types = $component['types'] ?? [];
            $longName = $component['long_name'] ?? '';
            $shortName = $component['short_name'] ?? '';

            // Street-level information
            if (in_array('street_number', $types)) {
                $result['street_number'] = $longName;
            }
            if (in_array('route', $types)) {
                $result['street'] = $longName;
            }

            // City/Town/Village
            if (in_array('locality', $types) || in_array('administrative_area_level_3', $types)) {
                $result['city'] = $longName;
            }

            // Administrative divisions (for Syria: Governorate/Province)
            if (in_array('administrative_area_level_1', $types)) {
                $result['state'] = $longName;
            }
            if (in_array('administrative_area_level_2', $types)) {
                $result['governorate'] = $longName;
            }

            // Country
            if (in_array('country', $types)) {
                $result['country'] = $longName;
                $result['country_code'] = $shortName;
            }

            // Postal code
            if (in_array('postal_code', $types)) {
                $result['postal_code'] = $longName;
            }

            // District or area
            if (in_array('administrative_area_level_4', $types) || in_array('neighborhood', $types)) {
                $result['area'] = $longName;
            }
        }

        return $result;
    }

    /**
     * Generate a session token for Google Places API
     */
    private function generateSessionToken(): string
    {
        return sprintf('%d-%s', time(), bin2hex(random_bytes(6)));
    }
}
