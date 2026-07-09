<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (! Schema::hasColumn('shipments', 'is_diff_city')) {
                $table->boolean('is_diff_city')->default(false)->after('receiver_building');
            }

            if (! Schema::hasColumn('shipments', 'delivery_zone_id')) {
                $table->bigInteger('delivery_zone_id')->nullable()->after('zone_id');
            }

            if (! Schema::hasColumn('shipments', 'sender_zone_delivery_fee')) {
                $table->decimal('sender_zone_delivery_fee', 12, 2)->nullable()->after('is_diff_city');
            }

            if (! Schema::hasColumn('shipments', 'reciever_zone_delivery_fee')) {
                $table->decimal('reciever_zone_delivery_fee', 12, 2)->nullable()->after('sender_zone_delivery_fee');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $columns = [];

            if (Schema::hasColumn('shipments', 'is_diff_city')) {
                $columns[] = 'is_diff_city';
            }

            if (Schema::hasColumn('shipments', 'delivery_zone_id')) {
                $columns[] = 'delivery_zone_id';
            }

            if (Schema::hasColumn('shipments', 'sender_zone_delivery_fee')) {
                $columns[] = 'sender_zone_delivery_fee';
            }

            if (Schema::hasColumn('shipments', 'reciever_zone_delivery_fee')) {
                $columns[] = 'reciever_zone_delivery_fee';
            }

            if (! empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
