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
        Schema::table('addresses', function (Blueprint $table) {
            if (! Schema::hasColumn('addresses', 'name')) {
                $table->string('name')->nullable()->after('user_id');
            }

            if (! Schema::hasColumn('addresses', 'email')) {
                $table->string('email')->nullable()->after('name');
            }

            if (! Schema::hasColumn('addresses', 'mobile')) {
                $table->string('mobile')->nullable()->after('email');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            $columns = [];

            if (Schema::hasColumn('addresses', 'name')) {
                $columns[] = 'name';
            }

            if (Schema::hasColumn('addresses', 'email')) {
                $columns[] = 'email';
            }

            if (Schema::hasColumn('addresses', 'mobile')) {
                $columns[] = 'mobile';
            }

            if (! empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
