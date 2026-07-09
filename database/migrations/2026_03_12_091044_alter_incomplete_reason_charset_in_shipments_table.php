<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('
            ALTER TABLE shipments
            MODIFY incomplete_reason TEXT
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_unicode_ci
        ');
    }

    public function down()
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('
            ALTER TABLE shipments
            MODIFY incomplete_reason TEXT
            CHARACTER SET utf8
            COLLATE utf8_unicode_ci
        ');
    }
};
