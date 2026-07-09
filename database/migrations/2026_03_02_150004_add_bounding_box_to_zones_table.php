<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->decimal('bound_min_lat', 10, 7)->nullable()->after('drawn_paths')->index();
            $table->decimal('bound_max_lat', 10, 7)->nullable()->after('bound_min_lat')->index();
            $table->decimal('bound_min_lng', 10, 7)->nullable()->after('bound_max_lat')->index();
            $table->decimal('bound_max_lng', 10, 7)->nullable()->after('bound_min_lng')->index();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->dropColumn(['bound_min_lat', 'bound_max_lat', 'bound_min_lng', 'bound_max_lng']);
        });
    }
};
