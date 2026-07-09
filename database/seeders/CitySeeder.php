<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class CitySeeder extends Seeder
{
    public function run(): void
    {
        $cities = [
            ['governate' => 'Damascus', 'name' => 'Damascus',        'short' => 'DAM', 'arabic' => 'دمشق'],
            ['governate' => 'Damascus', 'name' => 'Artouz',          'short' => 'ART', 'arabic' => 'عرطوز'],
            ['governate' => 'Damascus', 'name' => 'Deir Atieh',      'short' => 'DAT', 'arabic' => 'دير عطية'],
            ['governate' => 'Damascus', 'name' => 'Al-Dimas',        'short' => 'DMS', 'arabic' => 'الديماس'],
            ['governate' => 'Damascus', 'name' => 'Darayya',         'short' => 'DRY', 'arabic' => 'داريا'],
            ['governate' => 'Damascus', 'name' => 'Douma',           'short' => 'DUM', 'arabic' => 'دوما'],
            ['governate' => 'Damascus', 'name' => 'Al-Hameh',        'short' => 'HME', 'arabic' => 'الهامة'],
            ['governate' => 'Damascus', 'name' => 'An-Nabk',         'short' => 'NBK', 'arabic' => 'النبك'],
            ['governate' => 'Damascus', 'name' => 'Qarah',           'short' => 'QAR', 'arabic' => 'قارة'],
            ['governate' => 'Damascus', 'name' => 'Qudssaya',        'short' => 'QDS', 'arabic' => 'قدسيا'],
            ['governate' => 'Damascus', 'name' => 'Qudssaya Sub',    'short' => 'QSS', 'arabic' => 'ضاحية قدسيا'],
            ['governate' => 'Damascus', 'name' => 'Al-Tall',         'short' => 'TAL', 'arabic' => 'التل'],

            ['governate' => 'Daraa',    'name' => 'Daraa',           'short' => 'DAR', 'arabic' => 'درعا'],
            ['governate' => 'Daraa',    'name' => 'Busra',           'short' => 'BUS', 'arabic' => 'صرى'],
            ['governate' => 'Daraa',    'name' => 'Izra',            'short' => 'IZR', 'arabic' => 'إزرع'],

            ['governate' => 'As-Suwayda', 'name' => 'As-Suwayda',    'short' => 'SUW', 'arabic' => 'السويداء'],

            ['governate' => 'Aleppo',   'name' => 'Aleppo',          'short' => 'ALP', 'arabic' => 'حلب'],
            ['governate' => 'Aleppo',   'name' => 'Afrin',           'short' => 'AFR', 'arabic' => 'عفرين'],
            ['governate' => 'Aleppo',   'name' => 'Al-Bab',          'short' => 'BAB', 'arabic' => 'الباب'],
            ['governate' => 'Aleppo',   'name' => 'Jarabulus',       'short' => 'JAR', 'arabic' => 'جرابلس'],
            ['governate' => 'Aleppo',   'name' => 'Manbij',          'short' => 'MNJ', 'arabic' => 'منبج'],
            ['governate' => 'Aleppo',   'name' => 'As-Safira',       'short' => 'SAF', 'arabic' => 'السفيرة'],

            ['governate' => 'Raqqa',    'name' => 'Raqqa',           'short' => 'RAQ', 'arabic' => 'الرقة'],

            ['governate' => 'Idlib',    'name' => 'Idlib',           'short' => 'IDL', 'arabic' => 'إدلب'],
            ['governate' => 'Idlib',    'name' => 'Ariha',           'short' => 'ARH', 'arabic' => 'أريحا'],
            ['governate' => 'Idlib',    'name' => 'Maarret alNuman', 'short' => 'MAA', 'arabic' => 'معرة النعمان'],
            ['governate' => 'Idlib',    'name' => 'Saboura',         'short' => 'SAB', 'arabic' => 'الصبورة - إدلب'],

            ['governate' => 'Homs',     'name' => 'Homs',            'short' => 'HOM', 'arabic' => 'حمص'],
            ['governate' => 'Homs',     'name' => 'Tadmur',          'short' => 'TAD', 'arabic' => 'تدمر'],

            ['governate' => 'Hama',     'name' => 'Hama',            'short' => 'HAM', 'arabic' => 'حماة'],

            ['governate' => 'Latakia',  'name' => 'Latakia',         'short' => 'LAT', 'arabic' => 'اللاذقية'],
            ['governate' => 'Latakia',  'name' => 'Al-Haffah',       'short' => 'HAF', 'arabic' => 'الحفة'],
            ['governate' => 'Latakia',  'name' => 'Jableh',          'short' => 'JBL', 'arabic' => 'جبلة'],

            ['governate' => 'Tartus',   'name' => 'Tartus',          'short' => 'TAR', 'arabic' => 'طرطوس'],
            ['governate' => 'Tartus',   'name' => 'Baniyas',         'short' => 'BAN', 'arabic' => 'بانياس'],

            ['governate' => 'Deir ez-Zor', 'name' => 'Deir ez-Zor',  'short' => 'DEZ', 'arabic' => 'دير الزور'],
            ['governate' => 'Deir ez-Zor', 'name' => 'Al-Bukamal',   'short' => 'BUK', 'arabic' => 'البوكمال'],

            ['governate' => 'Al-Hasakah',  'name' => 'Al-Hasakah',   'short' => 'HAS', 'arabic' => 'الحسكة'],
            ['governate' => 'Al-Hasakah',  'name' => 'Al-Qamishli',  'short' => 'QAM', 'arabic' => 'القامشلي'],
        ];

       foreach ($cities as $city) {
            $governateId = DB::table('governates')->where('name', $city['governate'])->value('id');

            DB::table('cities')->insert([
                'governate_id' => $governateId,
                'name'         => $city['name'],
                'short_code'   => $city['short'],
                'name_arabic'  => $city['arabic'],
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }
}
