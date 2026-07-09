<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->decimal('platform_fee', 12, 2)->default(0)->after('total_fee');
            $table->decimal('vat_amount', 12, 2)->default(0)->after('platform_fee');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['platform_fee', 'vat_amount']);
        });
    }
};
