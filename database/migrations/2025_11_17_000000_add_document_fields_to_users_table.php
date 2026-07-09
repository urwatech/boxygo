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
            $table->string('national_id')->nullable()->after('employee_id');
            $table->string('national_id_front')->nullable()->after('national_id');
            $table->string('national_id_back')->nullable()->after('national_id_front');
            $table->string('driving_license_front')->nullable()->after('driving_license');
            $table->string('driving_license_back')->nullable()->after('driving_license_front');
            $table->date('date_of_birth')->nullable()->after('dob');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'national_id',
                'national_id_front',
                'national_id_back',
                'driving_license_front',
                'driving_license_back',
                'date_of_birth',
            ]);
        });
    }
};
