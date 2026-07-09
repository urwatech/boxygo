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
        Schema::table('wallets', function (Blueprint $table) {
            $table->decimal('held_balance', 15, 2)->default(0)->after('balance');
        });

        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->enum('status', ['completed', 'held', 'released', 'voided'])->default('completed')->after('amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropColumn('held_balance');
        });
    }
};