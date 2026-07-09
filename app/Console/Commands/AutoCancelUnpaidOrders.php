<?php

namespace App\Console\Commands;

use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class AutoCancelUnpaidOrders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'shipments:auto-cancel-unpaid';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automatically cancel shipments where the receiver failed to pay within 48 hours.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $cutoff = Carbon::now()->subHours(48);

        $shipments = Shipment::where('delivery_fee_payer', 'receiver')
            ->where('payment_method', 'online')
            ->where('payment_status', 'pending')
            ->whereNotIn('status', [
                ShipmentStatus::CANCELLED->value,
                ShipmentStatus::DELIVERED->value,
                ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
                ShipmentStatus::RETURNED->value,
                ShipmentStatus::FAILED->value,
            ])
            ->where('created_at', '<=', $cutoff)
            ->get();

        $count = $shipments->count();

        if ($count === 0) {
            $this->info('No unpaid shipments found to cancel.');

            return;
        }

        $this->info("Found {$count} unpaid shipments to cancel.");

        foreach ($shipments as $shipment) {
            try {
                $shipment->update([
                    'status' => ShipmentStatus::CANCELLED->value,
                    'incomplete_status' => $shipment->status,
                    'incomplete_reason' => 'Auto-cancelled due to non-payment within 48 hours.',
                    'incomplete_create_by' => null,
                ]);

                // Record status change in history
                $shipment->statusHistory()->create([
                    'from_status' => $shipment->getOriginal('status'),
                    'to_status' => ShipmentStatus::CANCELLED->value,
                    'notes' => 'Auto-cancelled due to non-payment within 48 hours.',
                ]);

                $this->line("Cancelled shipment: {$shipment->order_number}");

                Log::info("Shipment {$shipment->order_number} auto-cancelled due to non-payment.", [
                    'shipment_id' => $shipment->id,
                    'created_at' => $shipment->created_at,
                ]);
            } catch (\Exception $e) {
                $this->error("Failed to cancel shipment {$shipment->order_number}: ".$e->getMessage());
                Log::error("Failed to auto-cancel shipment {$shipment->id}", [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info('Auto-cancellation process completed.');
    }
}
