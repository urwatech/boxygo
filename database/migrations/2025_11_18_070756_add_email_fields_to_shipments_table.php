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
            if (! Schema::hasColumn('shipments', 'sender_email')) {
                $table->string('sender_email')->nullable()->after('sender_phone');
            }
            if (! Schema::hasColumn('shipments', 'receiver_email')) {
                $table->string('receiver_email')->nullable()->after('receiver_phone');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['sender_email', 'receiver_email']);
        });
    }
};
