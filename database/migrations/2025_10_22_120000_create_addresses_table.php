<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('label')->nullable()->default('Home'); // Home | Work | Company | Handover | Delivery
            $table->string('building_name')->nullable();
            $table->string('apartment')->nullable();
            $table->string('street')->nullable();
            $table->string('area')->nullable();
            $table->string('city')->nullable();
            $table->string('makaani_number')->nullable();
            $table->string('landmark')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
    }
};
