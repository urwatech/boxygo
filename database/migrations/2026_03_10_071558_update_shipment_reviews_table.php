<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipment_reviews', function (Blueprint $table) {

            // new columns
            $table->string('user_type', 50)->nullable()->after('user_id');
            $table->unsignedBigInteger('drop_point_id')->nullable()->after('user_type');

            // modify existing columns
            $table->unsignedTinyInteger('rider_behavior')->nullable()->change();
            $table->unsignedTinyInteger('on_time_delivery')->nullable()->change();
            $table->unsignedTinyInteger('affordability')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('shipment_reviews', function (Blueprint $table) {

            // remove added columns
            $table->dropColumn(['user_type', 'drop_point_id']);

            // revert nullable change
            $table->unsignedTinyInteger('rider_behavior')->default(0)->change();
            $table->unsignedTinyInteger('on_time_delivery')->default(0)->change();
            $table->unsignedTinyInteger('affordability')->default(0)->change();
        });
    }
};
