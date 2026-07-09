<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('vehicle_registration_path')->nullable()->after('photo_path');
            $table->string('car_insurance_path')->nullable()->after('vehicle_registration_path');
            $table->string('operating_permit_path')->nullable()->after('car_insurance_path');
            $table->json('additional_documents')->nullable()->after('operating_permit_path');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'vehicle_registration_path',
                'car_insurance_path',
                'operating_permit_path',
                'additional_documents',
            ]);
        });
    }
};
