<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drop_points', function (Blueprint $table) {
            $table->string('ext_id')->nullable()->unique()->after('id');
            $table->string('serial_no')->nullable()->after('name');
            $table->string('dp_no')->nullable()->after('serial_no');
            $table->string('open_hours')->nullable()->after('dp_no');
            $table->string('zone_ext_id')->nullable()->after('open_hours');
            $table->foreignId('zone_id')->nullable()->constrained('zones')->nullOnDelete()->after('zone_ext_id');
        });
    }

    public function down(): void
    {
        Schema::table('drop_points', function (Blueprint $table) {
            $table->dropForeign(['zone_id']);
            $table->dropColumn([
                'ext_id',
                'serial_no',
                'dp_no',
                'open_hours',
                'zone_ext_id',
                'zone_id',
            ]);
        });
    }
};
