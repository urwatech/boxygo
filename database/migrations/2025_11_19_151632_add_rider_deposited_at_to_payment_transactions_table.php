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
        Schema::table('payment_transactions', function (Blueprint $table) {
            // Add rider_deposited_at column to track when rider marks cash as deposited
            // This is different from settled_at which is when admin confirms collection
            if (!Schema::hasColumn('payment_transactions', 'rider_deposited_at')) {
                $table->timestamp('rider_deposited_at')->nullable()->after('collected_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropColumn('rider_deposited_at');
        });
    }
};
