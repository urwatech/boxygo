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
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->onDelete('cascade');
            $table->foreignId('rider_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('transaction_type'); // 'rider_collection', 'admin_settlement'
            $table->decimal('amount', 10, 2)->nullable();
            $table->string('payment_method'); // 'cash', 'online'
            $table->string('status')->default('pending'); // 'pending', 'completed', 'cancelled'
            $table->text('notes')->nullable();
            $table->timestamp('collected_at')->nullable(); // When rider collected from customer
            $table->timestamp('settled_at')->nullable(); // When rider settled with admin
            $table->foreignId('collected_by')->nullable()->constrained('users')->onDelete('set null'); // Admin who collected
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
