<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shelves', function (Blueprint $table) {
            $table->foreignId('drop_point_id')
                ->nullable()
                ->after('warehouse_id')
                ->constrained('drop_points')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('shelves', function (Blueprint $table) {
            $table->dropForeign(['drop_point_id']);
            $table->dropColumn('drop_point_id');
        });
    }
};
