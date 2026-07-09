<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            // Store the route type as an enum
            $table->enum('indirect_delivery_mode', [
                'door_to_door',
                'door_to_drop_point',
                'drop_point_to_door',
                'drop_point_to_drop_point',
            ])->nullable()->after('delivery_speed');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn('indirect_delivery_mode');
        });
    }
};

