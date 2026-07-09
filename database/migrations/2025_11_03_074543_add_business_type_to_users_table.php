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
        Schema::table('users', function (Blueprint $table) {
            $table->string('business_type')->nullable()->after('name');
            $table->string('country')->nullable()->after('business_type');
            $table->string('city')->nullable()->after('country');
            $table->text('address')->nullable()->after('city');
            $table->string('trade_license_number')->nullable()->after('address');
            $table->string('license_copy')->nullable()->after('trade_license_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'business_type',
                'country',
                'city',
                'address',
                'trade_license_number',
                'license_copy',
            ]);
        });
    }
};
