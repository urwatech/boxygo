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
        Schema::table('roles', function (Blueprint $table) {
            $table->text('description')->nullable()->after('name');
            $table->string('platform')->nullable()->after('description');
            $table->string('country')->nullable()->after('platform');
            $table->string('sub_area')->nullable()->after('country');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null')->after('sub_area');
            $table->boolean('is_protected')->default(false)->after('created_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn([
                'description',
                'platform',
                'country',
                'sub_area',
                'created_by',
                'is_protected',
            ]);
        });
    }
};
