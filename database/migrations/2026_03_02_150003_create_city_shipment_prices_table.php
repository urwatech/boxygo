<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('city_shipment_prices', function (Blueprint $table) {
            $table->id();
            $table->string('ext_id')->unique();
            $table->string('name')->nullable();
            $table->string('sender_sub_district_id')->nullable();
            $table->string('sender_sub_district_name')->nullable();
            $table->string('receiver_sub_district_id')->nullable();
            $table->string('receiver_sub_district_name')->nullable();

            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('direct_price', 10, 2)->nullable();

            $table->decimal('price1', 10, 2)->nullable();
            $table->decimal('price2', 10, 2)->nullable();
            $table->decimal('price3', 10, 2)->nullable();
            $table->decimal('price4', 10, 2)->nullable();
            $table->decimal('price5', 10, 2)->nullable();
            $table->decimal('price6', 10, 2)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('city_shipment_prices');
    }
};
