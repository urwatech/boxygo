<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (!Schema::hasColumn('shipments', 'reciever_payment_gateway')) {
                $table->string('reciever_payment_gateway')->nullable()->after('payment_gateway');
            }

            if (!Schema::hasColumn('shipments', 'reciever_payment_invoice_number')) {
                $table->string('reciever_payment_invoice_number')->nullable()->after('payment_invoice_number');
            }

            if (!Schema::hasColumn('shipments', 'reciever_payment_guid')) {
                $table->string('reciever_payment_guid')->nullable()->after('payment_guid');
            }

            if (!Schema::hasColumn('shipments', 'reciever_payment_gateway_response')) {
                $table->json('reciever_payment_gateway_response')->nullable()->after('payment_gateway_response');
            }

            if (!Schema::hasColumn('shipments', 'reciever_payment_status')) {
                $table->enum('reciever_payment_status', ['pending', 'paid'])->default('pending')->after('payment_status');
            }

            if (!Schema::hasColumn('shipments', 'reciever_paid_at')) {
                $table->timestamp('reciever_paid_at')->nullable()->after('reciever_payment_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $columns = [];

            if (Schema::hasColumn('shipments', 'reciever_payment_gateway')) {
                $columns[] = 'reciever_payment_gateway';
            }

            if (Schema::hasColumn('shipments', 'reciever_payment_invoice_number')) {
                $columns[] = 'reciever_payment_invoice_number';
            }

            if (Schema::hasColumn('shipments', 'reciever_payment_guid')) {
                $columns[] = 'reciever_payment_guid';
            }

            if (Schema::hasColumn('shipments', 'reciever_payment_gateway_response')) {
                $columns[] = 'reciever_payment_gateway_response';
            }

            if (Schema::hasColumn('shipments', 'reciever_payment_status')) {
                $columns[] = 'reciever_payment_status';
            }

            if (Schema::hasColumn('shipments', 'reciever_paid_at')) {
                $columns[] = 'reciever_paid_at';
            }

            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
