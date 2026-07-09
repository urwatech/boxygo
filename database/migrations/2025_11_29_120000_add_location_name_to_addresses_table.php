<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            if (! Schema::hasColumn('addresses', 'location_name')) {
                $table->string('location_name')->nullable()->after('label');
            }
        });

        // Backfill existing records so they have a friendly default name.
        DB::table('addresses')
            ->whereNull('location_name')
            ->update([
                'location_name' => DB::raw("CONCAT(label, ' Address')"),
            ]);
    }

    public function down(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            if (Schema::hasColumn('addresses', 'location_name')) {
                $table->dropColumn('location_name');
            }
        });
    }
};
