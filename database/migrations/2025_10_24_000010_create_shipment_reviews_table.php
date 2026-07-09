<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipment_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating'); // 1..5
            $table->unsignedTinyInteger('rider_behavior')->default(0);
            $table->unsignedTinyInteger('on_time_delivery')->default(0);
            $table->unsignedTinyInteger('affordability')->default(0);
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->unique(['shipment_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_reviews');
    }
};
