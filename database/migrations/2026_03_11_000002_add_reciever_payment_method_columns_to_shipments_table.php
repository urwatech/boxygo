<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('payment_method')->default('cash')->after('total_fee');
            // $table->string('receiver_payment_method')->default('cash')->after('total_fee');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['payment_method']);
            // $table->dropColumn(['receiver_payment_method']);
        });
    }
};