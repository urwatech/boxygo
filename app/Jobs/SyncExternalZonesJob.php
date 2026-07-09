<?php

namespace App\Jobs;

use App\Models\CityShipmentPrice;
use App\Models\DropPoint;
use App\Models\Zone;
use App\Services\AssatexApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncExternalZonesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // Allow 10 minutes for full sync

    public function __construct()
    {
        //
    }

    public function handle(AssatexApiService $apiService): void
    {
        Log::info('SyncExternalZonesJob started.');
        $this->updateProgress('starting', 0, 0, 'Initializing sync...');

        try {
            // 1. Zones
            Log::info('Fetching Zones from API...');
            $this->updateProgress('fetching', 0, 0, 'Fetching Zones...');
            $zones = $apiService->getZones();

            DB::beginTransaction();
            $this->processZones($zones);
            DB::commit();

            // 2. Drop Points
            Log::info('Fetching Drop Points from API...');
            $this->updateProgress('fetching', 0, 0, 'Fetching Drop Points...');
            $dropPoints = $apiService->getDropPoints();

            DB::beginTransaction();
            $this->processDropPoints($dropPoints);
            DB::commit();

            // 3. City Shipment Prices (Paginated)
            Log::info('Fetching City Shipment Prices from API...');
            $offset = 0;
            $maxSize = 200;
            $totalSynced = 0;

            do {
                $response = $apiService->getCityShipmentPrices($offset, $maxSize);
                $batch = $response['list'] ?? [];
                $totalCount = $response['total'] ?? 0;

                $this->updateProgress('fetching', $totalSynced, $totalCount, "Fetching Prices ($totalSynced / $totalCount)...");

                if (!empty($batch)) {
                    DB::beginTransaction();
                    $this->processPrices($batch);
                    DB::commit();
                    $totalSynced += count($batch);
                }

                $offset += count($batch);
            } while ($offset < $totalCount && count($batch) > 0);

            $this->updateProgress('completed', $totalCount, $totalCount, 'Sync completed successfully.');
            Log::info('SyncExternalZonesJob completed successfully.');
        } catch (\Exception $e) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            $this->updateProgress('failed', 0, 0, 'Sync failed: ' . $e->getMessage());
            Log::error('SyncExternalZonesJob failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    protected function updateProgress(string $status, int $current, int $total, string $message): void
    {
        Cache::put('sync_external_zones_progress', [
            'status' => $status,
            'current' => $current,
            'total' => $total,
            'percentage' => $total > 0 ? round(($current / $total) * 100) : 0,
            'message' => $message,
            'updated_at' => now()->toDateTimeString(),
        ], 3600); // Keep for 1 hour
    }

    protected function processZones(array $zones): void
    {
        if (empty($zones)) {
            Log::warning('No zones returned from API.');
            return;
        }

        // Optional: Soft delete existing manually created zones if they don't have an ext_id
        Zone::query()
            ->notDeleted()
            ->whereNull('ext_id')
            ->where('status', Zone::STATUS_ACTIVE)
            ->update(['status' => Zone::STATUS_INACTIVE]);

        foreach ($zones as $zoneData) {
            $externalId = $this->normalizeExternalId($zoneData['id'] ?? null);
            $externalCode = $this->extractExternalZoneCode($zoneData, $externalId);

            if ($externalCode === '') {
                Log::warning('Skipping zone sync row because code could not be resolved.', [
                    'zone_payload' => $zoneData,
                ]);
                continue;
            }

            $attributes = array_merge(
                $this->buildZoneSyncAttributes($zoneData),
                ['is_deleted' => false],
            );

            // $zoneByCode = Zone::query()
            //     ->where('code', $externalCode)
            //     ->first();

            // // If code exists but is marked deleted, preserve the deleted row and create a fresh copy with "-0".
            // if ($zoneByCode && (bool) $zoneByCode->is_deleted) {
            //     $this->releaseExternalIdFromDeletedRows($externalId);

            //     Zone::updateOrCreate(
            //         ['ext_id' => $externalId],
            //         array_merge($attributes, [
            //             'code' => $externalCode,
            //             'is_deleted' => false,
            //         ])
            //     );

            //     continue;
            // }

            $existingByExtId = Zone::where('ext_id', $externalId)->first();

            if ($existingByExtId) {

                if ($existingByExtId->is_deleted) {

                    $existingByExtId->update(['ext_id' => null]);

                    $newCode = Zone::where('name', $externalCode)->exists()
                        ? $this->generateRefetchedCode($externalCode)
                        : $externalCode;

                    Zone::create([
                        ...$attributes,
                        'ext_id' => $externalId,
                        'name' => $newCode,
                        'is_deleted' => false,
                    ]);

                    continue;
                }

                $existingByExtId->update([
                    ...$attributes,
                    'name' => $externalCode,
                ]);

                continue;
            }

            // Normal behavior: existing active zone with same code should be updated.
            // if ($zoneByCode) {
            //     $this->releaseExternalIdFromDeletedRows($externalId);

            //     $updateData = $attributes;
            //     if ($externalId !== null) {
            //         $updateData['ext_id'] = $externalId;
            //     }

            //     $zoneByCode->update($updateData);

            //     continue;
            // }

            // Keep old ext_id based matching as fallback to avoid breaking existing sync behavior.
            $zoneByExternalId = null;
            if ($externalId !== null) {
                $zoneByExternalId = Zone::query()
                    ->where('ext_id', $externalId)
                    ->where('is_deleted', false)
                    ->first();
            }

            if ($zoneByExternalId) {
                $zoneByExternalId->update(array_merge(
                    $attributes,
                    [
                        'ext_id' => $externalId,
                        'name' => $externalCode,
                    ],
                ));

                continue;
            }

            $this->releaseExternalIdFromDeletedRows($externalId);

            $insertCode = Zone::query()->where('name', $externalCode)->exists()
                ? $this->generateRefetchedCode($externalCode)
                : $externalCode;

            Zone::create(array_merge(
                $attributes,
                [
                    'ext_id' => $externalId,
                    'code' => $insertCode,
                ],
            ));
        }

        Log::info('Zones synced: ' . count($zones));
    }

    protected function normalizeExternalId(mixed $externalId): ?string
    {
        if ($externalId === null) {
            return null;
        }

        $value = trim((string) $externalId);

        return $value === '' ? null : $value;
    }

    protected function extractExternalZoneCode(array $zoneData, ?string $fallback): string
    {
        $candidates = [
            $zoneData['code'] ?? null,
            $zoneData['name'] ?? null,
            $zoneData['zoneCode'] ?? null,
            $zoneData['zone_code'] ?? null,
            $zoneData['subDistrictCode'] ?? null,
            $zoneData['sDNo'] ?? null,
            $zoneData['sdNo'] ?? null,
            $fallback,
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) ($candidate ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    protected function releaseExternalIdFromDeletedRows(?string $externalId): void
    {
        if ($externalId === null) {
            return;
        }

        Zone::query()
            ->where('ext_id', $externalId)
            ->where('is_deleted', true)
            ->update(['ext_id' => null]);
    }

    protected function generateRefetchedCode(string $baseCode): string
    {
        $trimmedBaseCode = trim($baseCode);
        $trimmedBaseCode = mb_substr($trimmedBaseCode, 0, 250);

        $suffix = 0;
        $candidate = "{$trimmedBaseCode}-{$suffix}";

        while (Zone::query()->where('name', $candidate)->exists()) {
            $suffix++;
            $candidate = "{$trimmedBaseCode}-{$suffix}";
        }

        return $candidate;
    }

    protected function buildZoneSyncAttributes(array $zoneData): array
    {
        $drawnPaths = null;
        $minLat = null;
        $maxLat = null;
        $minLng = null;
        $maxLng = null;

        if (!empty($zoneData['zoneDrawing'])) {
            $rawDrawing = is_string($zoneData['zoneDrawing'])
                ? json_decode($zoneData['zoneDrawing'], true)
                : $zoneData['zoneDrawing'];

            // API format: zoneDrawing is an array of polygon objects, each with a 'coords' key:
            // [{ "id": "...", "name": "...", "coords": [{ "lat": ..., "lng": ... }, ...] }]
            if (is_array($rawDrawing)) {
                $normalizedPolygons = [];
                foreach ($rawDrawing as $drawingObj) {
                    $coordsArr = $drawingObj['coords'] ?? null;

                    if (!is_array($coordsArr) || empty($coordsArr)) {
                        continue;
                    }

                    $normalizedPoints = [];
                    foreach ($coordsArr as $point) {
                        $latVal = $point['lat'] ?? $point['Lat'] ?? $point['latitude'] ?? null;
                        $lngVal = $point['lng'] ?? $point['Lng'] ?? $point['longitude'] ?? null;

                        if ($latVal === null || $lngVal === null) {
                            continue;
                        }

                        $lat = (float) $latVal;
                        $lng = (float) $lngVal;

                        if ($minLat === null || $lat < $minLat) {
                            $minLat = $lat;
                        }

                        if ($maxLat === null || $lat > $maxLat) {
                            $maxLat = $lat;
                        }

                        if ($minLng === null || $lng < $minLng) {
                            $minLng = $lng;
                        }

                        if ($maxLng === null || $lng > $maxLng) {
                            $maxLng = $lng;
                        }

                        $normalizedPoints[] = ['lat' => $lat, 'lng' => $lng];
                    }

                    if (!empty($normalizedPoints)) {
                        $normalizedPolygons[] = $normalizedPoints;
                    }
                }

                $drawnPaths = !empty($normalizedPolygons) ? $normalizedPolygons : null;
            }
        }

        return [
            'name' => $zoneData['name'] ?? null,
            'door_delivery' => $zoneData['doorDelivery'] ?? false,
            'door_service_fees' => $zoneData['doorServiceFees'] ?? 0,
            'direct_delivery' => $zoneData['directDelivery'] ?? false,
            'direct_srv_fees' => $zoneData['directSrvFees'] ?? 0,
            'city' => $zoneData['zoneCity'] ?? null,
            'sub_district_name' => $zoneData['sDNo'] ?? null,
            'drawn_paths' => $drawnPaths,
            'bound_min_lat' => $minLat,
            'bound_max_lat' => $maxLat,
            'bound_min_lng' => $minLng,
            'bound_max_lng' => $maxLng,
            'status' => ($zoneData['status'] ?? true) ? Zone::STATUS_ACTIVE : Zone::STATUS_INACTIVE,
        ];
    }

    protected function processDropPoints(array $dropPoints): void
    {
        if (empty($dropPoints)) {
            Log::warning('No drop points returned from API.');
            return;
        }

        foreach ($dropPoints as $dpData) {
            // Find mapping zone
            $zoneId = null;
            if (!empty($dpData['zoneId'])) {
                $zone = Zone::query()
                    ->notDeleted()
                    ->where('ext_id', $dpData['zoneId'])
                    ->first();
                if ($zone) {
                    $zoneId = $zone->id;
                }
            }

            $drawingPoint = collect($dpData['locationDrawing'] ?? [])
                ->first(function ($item) {
                    return is_array($item) && !empty($item['coords']) && is_array($item['coords']);
                });
            $coords = is_array($drawingPoint) ? ($drawingPoint['coords'][0] ?? null) : null;
            $latitude = $dpData['locationLat']
                ?? $dpData['lat']
                ?? $dpData['latitude']
                ?? (is_array($coords) ? ($coords['lat'] ?? null) : null);
            $longitude = $dpData['locationLng']
                ?? $dpData['lng']
                ?? $dpData['longitude']
                ?? (is_array($coords) ? ($coords['lng'] ?? null) : null);

            DropPoint::updateOrCreate(
                ['ext_id' => $dpData['id']],
                [
                    'name' => $dpData['name'] ?? 'Unknown Drop Point',
                    'icon' => $dpData['icon'] ?? null,
                    'serial_no' => $dpData['serialNo'] ?? null,
                    'dp_no' => $dpData['dPNo'] ?? $dpData['dP_No'] ?? null,
                    'open_hours' => $dpData['openHours'] ?? $dpData['open_Hours'] ?? null,
                    'zone_ext_id' => $dpData['zoneId'] ?? null,
                    'zone_id' => $zoneId,
                    'address' => $dpData['address'] ?? $dpData['locationStreet'] ?? $dpData['zoneAddressStreet'] ?? null,
                    'city' => $dpData['locationCity'] ?? $dpData['zoneAddressCity'] ?? $dpData['city'] ?? null,
                    'latitude' => $latitude !== null ? (float) $latitude : 0,
                    'longitude' => $longitude !== null ? (float) $longitude : 0,
                ]
            );
        }

        Log::info('Drop Points synced: ' . count($dropPoints));
    }

    protected function processPrices(array $prices): void
    {
        if (empty($prices)) {
            Log::warning('No City Shipment Prices returned from API.');
            return;
        }

        $upsertData = [];
        foreach ($prices as $priceData) {
            $upsertData[] = [
                'ext_id' => $priceData['id'],
                'name' => $priceData['name'] ?? null,
                'sender_sub_district_id' => $priceData['subDNoForm'] ?? null,
                'sender_sub_district_name' => $priceData['senderSubDistrictName'] ?? null,
                'receiver_sub_district_id' => $priceData['subDNoTo'] ?? null,
                'receiver_sub_district_name' => $priceData['receiverSubDistrictName'] ?? null,
                'price' => $priceData['price'] ?? 0,
                'direct_price' => $priceData['directPrice'] ?? null,
                'price1' => $priceData['price1'] ?? null,
                'price2' => $priceData['price2'] ?? null,
                'price3' => $priceData['price3'] ?? null,
                'price4' => $priceData['price4'] ?? null,
                'price5' => $priceData['price5'] ?? null,
                'price6' => $priceData['price6'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        CityShipmentPrice::upsert(
            $upsertData,
            ['ext_id'],
            [
                'name',
                'sender_sub_district_id',
                'sender_sub_district_name',
                'receiver_sub_district_id',
                'receiver_sub_district_name',
                'price',
                'direct_price',
                'price1',
                'price2',
                'price3',
                'price4',
                'price5',
                'price6',
                'updated_at'
            ]
        );
    }
}
