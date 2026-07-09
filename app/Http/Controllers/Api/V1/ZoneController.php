<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ZoneHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ZoneController extends Controller
{
    /**
     * Check if coordinates fall within any active zone.
     */
    public function check(Request $request): JsonResponse
    {
        $latitude = $request->query('lat');
        $longitude = $request->query('lon');

        if (! is_numeric($latitude) || ! is_numeric($longitude)) {
            return response()->json([
                'exists' => false,
                'data' => null,
                'error' => __('missingOrInvalidLatitudeLongitudeParameters'),
            ], 422);
        }

        $zone = ZoneHelper::findZoneByCoordinates((float) $latitude, (float) $longitude);

        if ($zone) {
            return response()->json([
                'exists' => true,
                'data' => [
                    'id' => $zone->id,
                    'code' => $zone->code,
                    'name' => $zone->name,
                    'city' => $zone->city,
                    'status' => $zone->status,
                ],
            ]);
        }

        return response()->json([
            'exists' => false,
            'data' => null,
            'message' => __('noActiveZoneFoundForTheProvidedCoordinates'),
        ]);
    }
}
