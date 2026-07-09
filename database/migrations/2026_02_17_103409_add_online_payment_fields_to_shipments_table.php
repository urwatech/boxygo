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
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('payment_gateway')->nullable()->after('payment_status');
            $table->string('payment_invoice_number')->nullable()->after('payment_gateway');
            $table->string('payment_guid')->nullable()->after('payment_invoice_number');
            $table->string('payment_operation_number')->nullable()->after('payment_guid');
            $table->json('payment_gateway_response')->nullable()->after('payment_operation_number');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'payment_gateway',
                'payment_invoice_number',
                'payment_guid',
                'payment_operation_number',
                'payment_gateway_response',
            ]);
        });
    }
};
