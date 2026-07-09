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
            if (! Schema::hasColumn('shipments', 'incomplete_status')) {
                $table->string('incomplete_status', 100)->nullable()->after('status');
            }

            if (! Schema::hasColumn('shipments', 'incomplete_reason')) {
                $table->longText('incomplete_reason')->nullable()->after('incomplete_status');
            }

            if (! Schema::hasColumn('shipments', 'incomplete_create_by')) {
                $table->string('incomplete_create_by', 100)->nullable()->after('incomplete_reason');
            }

            if (! Schema::hasColumn('shipments', 'sender_receive_payment_status')) {
                $table->string('sender_receive_payment_status', 100)->nullable()->after('incomplete_create_by');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $columnsToDrop = [];

        foreach ([
            'incomplete_status',
            'incomplete_reason',
            'incomplete_create_by',
            'sender_receive_payment_status',
        ] as $column) {
            if (Schema::hasColumn('shipments', $column)) {
                $columnsToDrop[] = $column;
            }
        }

        if (! empty($columnsToDrop)) {
            Schema::table('shipments', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn($columnsToDrop);
            });
        }
    }
};
