<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->enum('componsation_status', [
                'draft',
                'pending',
                'approved',
                'rejected'
            ])->default('draft')->after('sender_payment_status');
            $table->longText('componsation_images')->nullable()->after('componsation_status');
            $table->decimal('componsation_amount', 10, 2)->nullable()->after('componsation_images');
            $table->longText('componsation_remarks_sender')->nullable()->after('componsation_amount');
            $table->longText('componsation_remarks_receiver')->nullable()->after('componsation_remarks_sender');
            $table->string('componsation_payment', 50)->nullable()->after('componsation_remarks_receiver');
            $table->bigInteger('receiver_id')->nullable()->after('user_id');

        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {

            $table->dropColumn([
                'componsation_status',
                'componsation_images',
                'componsation_amount',
                'componsation_remarks_sender',
                'componsation_remarks_receiver',
                'componsation_payment',
                'receiver_id',
            ]);

        });
    }
};