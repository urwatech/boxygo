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
            $table->string('barcode_number')->nullable()->after('order_number');
            $table->foreignId('barcode_rider_id')->nullable()->after('barcode_number')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropForeign(['barcode_rider_id']);
            $table->dropColumn(['barcode_number', 'barcode_rider_id']);
        });
    }
};
