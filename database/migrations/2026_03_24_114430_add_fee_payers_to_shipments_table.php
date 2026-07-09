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
            $table->string('delivery_fee_payer')->default('sender')->after('return_window');
            $table->string('return_delivery_fee_payer')->nullable()->after('delivery_fee_payer');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['delivery_fee_payer', 'return_delivery_fee_payer']);
        });
    }
};
