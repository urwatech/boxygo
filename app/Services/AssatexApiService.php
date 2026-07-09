<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AssatexApiService
{
    protected string $baseUrl;

    protected string $apiKey;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.assatex.url');
        $this->apiKey = (string) config('services.assatex.key');
    }

    /**
     * Get the headers required for the API requests
     */
    protected function getHeaders(): array
    {
        return [
            'X-Api-Key' => $this->apiKey,
            'Accept' => 'application/json',
        ];
    }

    /**
     * Fetch Zones from the API
     */
    public function getZones(): array
    {
        try {
            // Note: The Postman collection doesn't show pagination parameters for Zones,
            // but we fetch all returned.
            $response = Http::withHeaders($this->getHeaders())
                ->get("{$this->baseUrl}/api/v1/Zone");

            if ($response->successful()) {
                $data = $response->json();

                return $data['list'] ?? [];
            }

            Log::error('Assatex API - Failed to fetch zones', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [];
        } catch (\Exception $e) {
            Log::error('Assatex API - Exception fetching zones', ['message' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * Fetch Drop Points from the API
     */
    public function getDropPoints(): array
    {
        try {
            $response = Http::withHeaders($this->getHeaders())
                ->get("{$this->baseUrl}/api/v1/Point");

            if ($response->successful()) {
                $data = $response->json();

                return $data['list'] ?? [];
            }

            Log::error('Assatex API - Failed to fetch drop points', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [];
        } catch (\Exception $e) {
            Log::error('Assatex API - Exception fetching drop points', ['message' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * Fetch City Shipment Prices from the API with pagination
     */
    public function getCityShipmentPrices(int $offset = 0, int $maxSize = 200): array
    {
        try {
            $response = Http::withHeaders($this->getHeaders())
                ->get("{$this->baseUrl}/api/v1/CitiesShipmentPrice", [
                    'offset' => $offset,
                    'maxSize' => $maxSize,
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Assatex API - Failed to fetch city shipment prices', [
                'status' => $response->status(),
                'body' => $response->body(),
                'offset' => $offset,
            ]);

            return [];
        } catch (\Exception $e) {
            Log::error('Assatex API - Exception fetching city shipment prices', ['message' => $e->getMessage()]);

            return [];
        }
    }
}
