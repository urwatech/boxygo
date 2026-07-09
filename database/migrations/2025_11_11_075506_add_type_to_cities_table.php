<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('cities', function (Blueprint $table) {
            if (! Schema::hasColumn('cities', 'type')) {
                $table->enum('type', ['M', 'CS'])->default('M')->after('governate_id');
            }
        });

        // Ensure existing rows have a type
        try {
            DB::table('cities')->whereNull('type')->update(['type' => 'M']);
        } catch (\Throwable $e) {
            // ignore if enum/backfill not necessary
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cities', function (Blueprint $table) {
            if (Schema::hasColumn('cities', 'type')) {
                $table->dropColumn('type');
            }
        });
    }
};
