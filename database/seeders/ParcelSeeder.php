<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ParcelSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('parcels')->insert([
            [
                'id' => 1,
                'name' => 'Bag 4',
                'description' => 'tes',
                'length_cm' => 10.00,
                'width_cm' => 5.00,
                'height_cm' => 20.00,
                'min_weight_kg' => 5.00,
                'max_weight_kg' => 6.00,
                'status' => 'active',
                'api_mapping_key' => null,
                'icon_path' => '/assets/images/Parcel.svg',
                'created_at' => '2025-11-15 18:31:03',
                'updated_at' => '2025-12-31 15:35:08',
            ],
            [
                'id' => 2,
                'name' => 'Bag 5',
                'description' => 'u',
                'length_cm' => 9.00,
                'width_cm' => 8.00,
                'height_cm' => 8.00,
                'min_weight_kg' => 8.00,
                'max_weight_kg' => 9.00,
                'status' => 'active',
                'api_mapping_key' => null,
                'icon_path' => '/assets/images/Parcel.svg',
                'created_at' => '2025-11-20 15:20:48',
                'updated_at' => '2025-12-31 15:35:05',
            ],
            [
                'id' => 3,
                'name' => 'Bag 3',
                'description' => 'Bag 3',
                'length_cm' => 40.00,
                'width_cm' => 30.00,
                'height_cm' => 30.00,
                'min_weight_kg' => 2.00,
                'max_weight_kg' => 4.00,
                'status' => 'active',
                'api_mapping_key' => null,
                'icon_path' => '/assets/images/Parcel.svg',
                'created_at' => '2025-11-20 15:22:36',
                'updated_at' => '2025-12-11 16:29:54',
            ],
            [
                'id' => 4,
                'name' => 'Bag 2',
                'description' => 'Midum Bag',
                'length_cm' => 40.00,
                'width_cm' => 30.00,
                'height_cm' => 10.00,
                'min_weight_kg' => 1.00,
                'max_weight_kg' => 2.00,
                'status' => 'active',
                'api_mapping_key' => null,
                'icon_path' => '/assets/images/Parcel.svg',
                'created_at' => '2025-11-20 15:22:58',
                'updated_at' => '2025-12-11 16:25:27',
            ],
            [
                'id' => 5,
                'name' => 'Bag 1',
                'description' => 'only documents',
                'length_cm' => 33.00,
                'width_cm' => 20.00,
                'height_cm' => 1.50,
                'min_weight_kg' => 0.50,
                'max_weight_kg' => 1.00,
                'status' => 'active',
                'api_mapping_key' => null,
                'icon_path' => '/assets/images/Parcel.svg',
                'created_at' => '2025-11-20 15:23:22',
                'updated_at' => '2025-12-31 15:35:00',
            ],
        ]);
    }
}
