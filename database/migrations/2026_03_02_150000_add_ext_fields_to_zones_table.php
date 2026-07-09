<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->string('ext_id')->nullable()->unique()->after('id');
            $table->boolean('door_delivery')->default(false)->after('name');
            $table->decimal('door_service_fees', 10, 2)->nullable()->after('door_delivery');
            $table->boolean('direct_delivery')->default(false)->after('door_service_fees');
            $table->decimal('direct_srv_fees', 10, 2)->nullable()->after('direct_delivery');
            $table->string('sub_district_name')->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->dropColumn([
                'ext_id',
                'door_delivery',
                'door_service_fees',
                'direct_delivery',
                'direct_srv_fees',
                'sub_district_name',
            ]);
        });
    }
};