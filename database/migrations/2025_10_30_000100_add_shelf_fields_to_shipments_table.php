<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->foreignId('shelf_id')
                ->nullable()
                ->after('rider_id')
                ->constrained('shelves')
                ->nullOnDelete();
            $table->timestamp('shelf_assigned_at')->nullable()->after('shelf_id');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropForeign(['shelf_id']);
            $table->dropColumn(['shelf_id', 'shelf_assigned_at']);
        });
    }
};
