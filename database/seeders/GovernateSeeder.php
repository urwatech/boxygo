<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class GovernateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $rows = [
            ['name' => 'Damascus', 'short_code' => 'DAM'],
            ['name' => 'Daraa', 'short_code' => 'DAR'],
            ['name' => 'As-Suwayda', 'short_code' => 'SUW'],
            ['name' => 'Aleppo', 'short_code' => 'ALP'],
            ['name' => 'Raqqa', 'short_code' => 'RAQ'],
            ['name' => 'Idlib', 'short_code' => 'IDL'],
            ['name' => 'Homs', 'short_code' => 'HOM'],
            ['name' => 'Hama', 'short_code' => 'HAM'],
            ['name' => 'Latakia', 'short_code' => 'LAT'],
            ['name' => 'Tartus', 'short_code' => 'TAR'],
            ['name' => 'Deir ez-Zor', 'short_code' => 'DEZ'],
            ['name' => 'Al-Hasakah', 'short_code' => 'HAS'],
        ];

        DB::table('governates')->insert($rows);
    }
}
