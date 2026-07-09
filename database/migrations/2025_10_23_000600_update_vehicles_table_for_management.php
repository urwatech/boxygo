<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('vehicles', 'user_id')) {
            Schema::table('vehicles', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            });
        }

        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('code')->unique()->after('id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete()->after('code');
            $table->date('permit_expires_at')->nullable()->after('license_plate');
            $table->date('insurance_expires_at')->nullable()->after('permit_expires_at');
            $table->string('status', 32)->default('active')->after('insurance_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['code', 'permit_expires_at', 'insurance_expires_at', 'status']);
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->after('id');
        });
    }
};

