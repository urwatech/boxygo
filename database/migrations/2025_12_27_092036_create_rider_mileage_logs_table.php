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
        Schema::create('rider_mileage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // Rider/Driver
            $table->foreignId('shipment_id')->nullable()->constrained()->onDelete('set null'); // Related shipment

            // GPS coordinates for the segment
            $table->decimal('start_latitude', 10, 8)->nullable();
            $table->decimal('start_longitude', 11, 8)->nullable();
            $table->decimal('end_latitude', 10, 8)->nullable();
            $table->decimal('end_longitude', 11, 8)->nullable();

            // Distance calculation
            $table->decimal('distance_km', 10, 2)->default(0); // Distance in kilometers
            $table->decimal('distance_miles', 10, 2)->default(0); // Distance in miles

            // Context information
            $table->string('status_from')->nullable(); // Starting status
            $table->string('status_to')->nullable(); // Ending status
            $table->text('notes')->nullable(); // Additional notes

            // Timestamps
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            // Indexes for better performance
            $table->index('user_id');
            $table->index('shipment_id');
            $table->index('started_at');
            $table->index('ended_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rider_mileage_logs');
    }
};
