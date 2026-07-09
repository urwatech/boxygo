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
            $table->foreignId('rider_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            // $table->timestamp('collected_at')->nullable()->after('rider_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropForeign(['rider_id']);
            // $table->dropColumn(['rider_id','collected_at']);
        });
    }
};
