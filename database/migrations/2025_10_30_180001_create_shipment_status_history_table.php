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
        if (Schema::hasTable('shipment_status_history')) {
            return; // Table already exists, skip creation
        }

        Schema::create('shipment_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');

            // Status transition
            $table->string('from_status')->nullable(); // null for initial status
            $table->string('to_status');
            $table->integer('progress_index')->nullable(); // Current progress index at time of change

            // Location information (optional)
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('location_name')->nullable();

            // Additional context
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable(); // For photos, signatures, QR scan info, etc.

            $table->timestamp('created_at'); // When this status change occurred

            // Indexes for performance
            $table->index(['shipment_id', 'created_at']);
            $table->index('user_id');
            $table->index('to_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shipment_status_history');
    }
};
