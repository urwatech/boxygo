<?php

namespace App\Console\Commands;

use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ExpireReturnShipments extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'app:expire-return-shipments';

    /**
     * The console command description.
     */
    protected $description = 'Expire a shipment for extend a date';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $today = Carbon::today();

        $shipments = Shipment::where('booking_type', 'shipment')
            ->where('status', ShipmentStatus::COMPLETED)
            ->where('accept_returns', 1)
            ->where('is_return_created', 0)
            ->where('return_status', '!=', ShipmentStatus::NOT_RETURNED)
            ->whereNotNull('return_expire_date')
            ->whereDate('return_expire_date', '<', $today)
            ->get();

        foreach ($shipments as $shipment) {
            $shipment->update([
                'return_status' => ShipmentStatus::NOT_RETURNED,
            ]);
        }

        Log::info('Total: '.count($shipments).' Shipments status updated');

        return Command::SUCCESS;
    }
}
