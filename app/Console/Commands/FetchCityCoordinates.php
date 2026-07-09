<?php

namespace App\Console\Commands;

use App\Models\City;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class FetchCityCoordinates extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:fetch-city-coordinates';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch latitude and longitude for all cities using OpenStreetMap Nominatim API';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $cities = City::whereNull('latitude')->orWhereNull('longitude')->get();

        if ($cities->isEmpty()) {
            $this->info('All cities already have coordinates.');
            return Command::SUCCESS;
        }

        $this->info("Found {$cities->count()} cities to geocode.");
        $bar = $this->output->createProgressBar($cities->count());
        $bar->start();

        foreach ($cities as $city) {
            try {
                $coords = $this->getCoordinates($city->name, $city->governate?->name);

                if ($coords) {
                    $city->update([
                        'latitude' => $coords['lat'],
                        'longitude' => $coords['lon'],
                    ]);
                    $this->line("\n✓ {$city->name}: ({$coords['lat']}, {$coords['lon']})");
                } else {
                    $this->line("\n✗ {$city->name}: No coordinates found");
                }
            } catch (\Exception $e) {
                $this->line("\n✗ {$city->name}: {$e->getMessage()}");
            }

            $bar->advance();
            usleep(1000000); // 1s delay to respect API rate limits
        }

        $bar->finish();
        $this->newLine();
        $this->info('City coordinates updated successfully.');

        return Command::SUCCESS;
    }

    /**
     * Get coordinates from Google Maps Geocoding API
     */
    private function getCoordinates(?string $cityName, ?string $governateName): ?array
    {
        if (!$cityName) {
            return null;
        }

        $apiKey = config('services.google.maps_api_key');
        if (!$apiKey) {
            $this->warn('Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY in .env');
            return null;
        }

        $query = $cityName;
        if ($governateName) {
            $query .= ", {$governateName}";
        }
        $query .= ", Syria";

        try {
            $response = Http::timeout(10)->get('https://maps.googleapis.com/maps/api/geocode/json', [
                'address' => $query,
                'key' => $apiKey,
            ]);

            $data = $response->json();

            if ($data['status'] === 'OK' && !empty($data['results'])) {
                $location = $data['results'][0]['geometry']['location'];
                return [
                    'lat' => (float) $location['lat'],
                    'lon' => (float) $location['lng'],
                ];
            } elseif ($data['status'] !== 'OK') {
                $this->warn("API Status: {$data['status']} for {$cityName}");
            }
        } catch (\Exception $e) {
            $this->warn("API Error for {$cityName}: " . $e->getMessage());
        }

        return null;
    }
}
