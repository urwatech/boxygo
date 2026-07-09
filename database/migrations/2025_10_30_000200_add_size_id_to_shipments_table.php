<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (! Schema::hasColumn('shipments', 'size_id')) {
                $table->foreignId('size_id')->nullable()->after('size')->constrained('parcels')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (Schema::hasColumn('shipments', 'size_id')) {
                $table->dropConstrainedForeignId('size_id');
            }
        });
    }
};
