<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipment_status_directs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('current_index')->default(1); // 1..4
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_status_directs');
    }
};
