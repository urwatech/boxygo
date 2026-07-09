<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('shipment_reviews')) {
            return;
        }

        if (! $this->indexExists('shipment_reviews', 'shipment_reviews_shipment_id_index')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->index('shipment_id');
            });
        }

        if (! $this->indexExists('shipment_reviews', 'shipment_reviews_user_id_index')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->index('user_id');
            });
        }

        if ($this->indexExists('shipment_reviews', 'shipment_reviews_shipment_id_user_id_unique')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->dropUnique('shipment_reviews_shipment_id_user_id_unique');
            });
        }

        if (! Schema::hasColumn('shipment_reviews', 'employee_id')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->unsignedBigInteger('employee_id')->nullable()->after('user_id');
            });
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE `shipment_reviews` MODIFY `employee_id` BIGINT UNSIGNED NULL');

            DB::statement(
                'UPDATE `shipment_reviews` sr LEFT JOIN `users` u ON u.id = sr.employee_id SET sr.employee_id = NULL WHERE sr.employee_id IS NOT NULL AND u.id IS NULL'
            );
        }

        if (! $this->foreignKeyExists('shipment_reviews', 'shipment_reviews_employee_id_foreign')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->foreign('employee_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if (! $this->indexExists('shipment_reviews', 'shipment_reviews_shipment_id_user_id_employee_id_unique')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->unique(['shipment_id', 'user_id', 'employee_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('shipment_reviews')) {
            return;
        }

        if ($this->indexExists('shipment_reviews', 'shipment_reviews_shipment_id_user_id_employee_id_unique')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->dropUnique('shipment_reviews_shipment_id_user_id_employee_id_unique');
            });
        }

        if (Schema::hasColumn('shipment_reviews', 'employee_id')) {
            if ($this->foreignKeyExists('shipment_reviews', 'shipment_reviews_employee_id_foreign')) {
                Schema::table('shipment_reviews', function (Blueprint $table) {
                    $table->dropForeign('shipment_reviews_employee_id_foreign');
                });
            }

            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->dropColumn('employee_id');
            });
        }

        if (! $this->indexExists('shipment_reviews', 'shipment_reviews_shipment_id_user_id_unique')) {
            Schema::table('shipment_reviews', function (Blueprint $table) {
                $table->unique(['shipment_id', 'user_id']);
            });
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        return Schema::hasIndex($table, $indexName);
    }

    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        return collect(Schema::getForeignKeys($table))
            ->pluck('name')
            ->contains($constraintName);
    }
};
