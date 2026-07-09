<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update city types based on Excel pricing matrix
        // Only the main city of each governorate should be 'M', others should be 'CS'

        $mainCities = [
            'Damascus',
            'Daraa',
            'As-Suwayda',
            'Aleppo',
            'Raqqa',
            'Idlib',
            'Homs',
            'Hama',
            'Latakia',
            'Tartus',
            'Deir ez-Zor',
            'Al-Hasakah',
        ];

        // Set all cities to CS first
        DB::table('cities')->update(['type' => 'CS']);

        // Then set only main cities to M
        DB::table('cities')
            ->whereIn('name', $mainCities)
            ->update(['type' => 'M']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert all cities back to M
        DB::table('cities')->update(['type' => 'M']);
    }
};
