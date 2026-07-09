<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('parcels', function (Blueprint $table) {
            $table->string('api_mapping_key')->nullable()->after('status')->comment('Used to map dynamic package names to external API pricing fields (e.g., price1, price2, etc.)');
        });
    }

    public function down(): void
    {
        Schema::table('parcels', function (Blueprint $table) {
            $table->dropColumn('api_mapping_key');
        });
    }
};