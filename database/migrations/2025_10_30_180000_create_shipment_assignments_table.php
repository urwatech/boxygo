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
        if (Schema::hasTable('shipment_assignments')) {
            return; // Table already exists, skip creation
        }

        Schema::create('shipment_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('assigned_by_id')->nullable()->constrained('users')->onDelete('set null');

            // Role at this stage (rider, drop_point_keeper, car_driver, warehouse_keeper, etc.)
            $table->string('role');

            // Stage in the delivery journey
            $table->string('stage'); // pickup, first_drop_point, to_warehouse, warehouse, to_second_drop_point, second_drop_point, final_delivery

            // Timestamps for assignment lifecycle
            $table->timestamp('assigned_at');
            $table->timestamp('started_at')->nullable(); // When user started working on this
            $table->timestamp('completed_at')->nullable(); // When user completed this stage

            // Additional information
            $table->text('notes')->nullable();

            $table->timestamps();

            // Indexes for performance
            $table->index(['shipment_id', 'stage']);
            $table->index(['user_id', 'completed_at']);
            $table->index('assigned_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shipment_assignments');
    }
};
