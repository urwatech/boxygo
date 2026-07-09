<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (! Schema::hasColumn('shipments', 'booking_type')) {
                $table->enum('booking_type', ['shipment', 'return'])->default('shipment')->after('verification_code_verified_at');
            }
            if (! Schema::hasColumn('shipments', 'sender_payment_status')) {
                $table->enum('sender_payment_status', ['pending', 'paid'])->default('pending')->after('delivery_fee_payer');
            }
            if (! Schema::hasColumn('shipments', 'is_return_created')) {
                $table->boolean('is_return_created')->default(false)->after('return_delivery_fee_payer');
            }
            if (! Schema::hasColumn('shipments', 'return_expire_date')) {
                $table->timestamp('return_expire_date')->nullable()->after('is_return_created');
            }
            if (! Schema::hasColumn('shipments', 'sender_amount')) {
                $table->decimal('sender_amount', 12, 2)->default(0)->after('total_fee');
            }
            if (! Schema::hasColumn('shipments', 'reciever_amount')) {
                $table->decimal('reciever_amount', 12, 2)->default(0)->after('sender_amount');
            }
            if (! Schema::hasColumn('shipments', 'incomplete_status')) {
                $table->string('incomplete_status')->nullable()->after('return_images');
            }
            if (! Schema::hasColumn('shipments', 'incomplete_reason')) {
                $table->text('incomplete_reason')->nullable()->after('incomplete_status');
            }
            if (! Schema::hasColumn('shipments', 'incomplete_create_by')) {
                $table->unsignedBigInteger('incomplete_create_by')->nullable()->after('incomplete_reason');
            }
            if (! Schema::hasColumn('shipments', 'sender_receive_payment_status')) {
                $table->string('sender_receive_payment_status')->nullable()->after('incomplete_create_by');
            }
        });
    }

    public function down(): void
    {
        // Down migration can be empty as this is a reconciliation step
    }
};
