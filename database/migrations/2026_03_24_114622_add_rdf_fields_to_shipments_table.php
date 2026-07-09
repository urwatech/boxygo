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
            $table->decimal('rdf_amount', 12, 2)->nullable()->after('return_delivery_fee_payer');
            $table->string('rdf_payment_status')->default('pending')->after('rdf_amount');
            $table->timestamp('rdf_paid_at')->nullable()->after('rdf_payment_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['rdf_amount', 'rdf_payment_status', 'rdf_paid_at']);
        });
    }
};
