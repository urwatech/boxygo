<?php

namespace Database\Seeders;

use App\Models\City;
use Illuminate\Database\Seeder;

class UpdateCityCoordinatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $coordinates = [
            'Damascus' => ['lat' => 33.5138, 'lon' => 36.2765],
            'Artouz' => ['lat' => 33.6058, 'lon' => 36.3408],
            'Deir Atieh' => ['lat' => 33.6333, 'lon' => 36.6833],
            'Al-Dimas' => ['lat' => 33.8167, 'lon' => 36.3667],
            'Darayya' => ['lat' => 33.5017, 'lon' => 36.2450],
            'Douma' => ['lat' => 33.5833, 'lon' => 36.2833],
            'Al-Hameh' => ['lat' => 33.8500, 'lon' => 36.5667],
            'An-Nabk' => ['lat' => 34.3667, 'lon' => 36.6667],
            'Qarah' => ['lat' => 33.7667, 'lon' => 36.7667],
            'Qudssaya' => ['lat' => 33.6208, 'lon' => 36.2367],
            'Qudssaya Sub' => ['lat' => 33.6208, 'lon' => 36.2367],
            'Al-Tall' => ['lat' => 33.8667, 'lon' => 36.4500],
            'Daraa' => ['lat' => 32.6150, 'lon' => 36.1020],
            'Busra' => ['lat' => 32.4889, 'lon' => 36.0844],
            'Izra' => ['lat' => 32.7422, 'lon' => 36.1356],
            'As-Suwayda' => ['lat' => 32.7156, 'lon' => 36.5667],
            'Aleppo' => ['lat' => 36.2037, 'lon' => 37.1592],
            'Afrin' => ['lat' => 36.4367, 'lon' => 36.5100],
            'Al-Bab' => ['lat' => 36.1961, 'lon' => 37.5078],
            'Jarabulus' => ['lat' => 36.8008, 'lon' => 38.0047],
            'Manbij' => ['lat' => 36.5225, 'lon' => 37.9544],
            'As-Safira' => ['lat' => 35.9667, 'lon' => 37.5333],
            'Raqqa' => ['lat' => 35.9451, 'lon' => 39.0155],
            'Idlib' => ['lat' => 35.9276, 'lon' => 36.6489],
            'Ariha' => ['lat' => 35.9147, 'lon' => 36.1122],
            'Maarret alNuman' => ['lat' => 35.7603, 'lon' => 36.5961],
            'Saboura' => ['lat' => 35.8833, 'lon' => 36.7000],
            'Homs' => ['lat' => 34.7258, 'lon' => 36.7392],
            'Tadmur' => ['lat' => 34.5639, 'lon' => 38.2764],
            'Hama' => ['lat' => 34.7330, 'lon' => 36.7540],
            'Latakia' => ['lat' => 35.5289, 'lon' => 35.7795],
            'Al-Haffah' => ['lat' => 35.3244, 'lon' => 35.9392],
            'Jableh' => ['lat' => 35.3786, 'lon' => 35.9522],
            'Tartus' => ['lat' => 34.8871, 'lon' => 35.8852],
            'Baniyas' => ['lat' => 34.9083, 'lon' => 35.9597],
            'Deir ez-Zor' => ['lat' => 35.3193, 'lon' => 40.1470],
            'Al-Bukamal' => ['lat' => 34.5889, 'lon' => 40.8778],
            'Al-Hasakah' => ['lat' => 36.5053, 'lon' => 40.7466],
            'Al-Qamishli' => ['lat' => 37.0502, 'lon' => 41.5323],
        ];

        foreach ($coordinates as $cityName => $coords) {
            City::where('name', $cityName)->update([
                'latitude' => $coords['lat'],
                'longitude' => $coords['lon'],
            ]);
        }

        $this->command->info('City coordinates updated successfully.');
    }
}
