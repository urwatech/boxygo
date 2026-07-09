<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Core booking fields
            $table->string('delivery_speed')->nullable(); // direct | indirect
            $table->string('consignment_type')->nullable();
            $table->string('size')->nullable(); // small | medium | large | custom
            $table->string('custom_length')->nullable();
            $table->string('custom_width')->nullable();
            $table->string('custom_height')->nullable();
            $table->string('weight')->nullable();
            $table->decimal('parcel_amount', 12, 2)->nullable();
            $table->string('insurance')->nullable(); // Yes | No
            $table->string('schedule_time')->nullable();

            // Locations
            $table->text('handover_address')->nullable();
            $table->decimal('handover_latitude', 10, 7)->nullable();
            $table->decimal('handover_longitude', 10, 7)->nullable();
            $table->text('delivery_address')->nullable();
            $table->decimal('delivery_latitude', 10, 7)->nullable();
            $table->decimal('delivery_longitude', 10, 7)->nullable();

            // Parties
            $table->string('sender_name')->nullable();
            $table->string('sender_phone')->nullable();
            $table->string('sender_landmark')->nullable();
            $table->string('sender_building')->nullable();
            $table->string('receiver_name')->nullable();
            $table->string('receiver_phone')->nullable();
            $table->string('receiver_landmark')->nullable();
            $table->string('receiver_building')->nullable();

            $table->boolean('is_return_created')->default(true);
            $table->date('return_expire_date')->nullable();
            $table->bigInteger('shipment_id')->nullable();
            $table->enum('booking_type', ['shipment', 'return'])->default('shipment');

            // Extras
            $table->boolean('accept_returns')->default(false);
            $table->text('special_instruction')->nullable();
            $table->json('photos')->nullable();
            $table->json('additional_docs')->nullable();

            // Payment
            $table->string('payment_method')->default('cash'); // cash | online
            $table->string('payment_status')->default('pending'); // pending | paid
            $table->decimal('total_fee', 12, 2)->nullable();
            $table->decimal('sender_amount', 10, 2)->default(0.00);
            $table->decimal('reciever_amount', 10, 2)->default(0.00);
            $table->enum('sender_payment_status', ['pending', 'paid'])->default('pending');

            // Status
            $table->string('status')->default('pending');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
