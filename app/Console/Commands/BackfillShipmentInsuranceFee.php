<?php

namespace App\Console\Commands;

use App\Models\Shipment;
use App\Support\ShipmentPaymentHelper;
use Illuminate\Console\Command;

class BackfillShipmentInsuranceFee extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'shipments:backfill-insurance-fee';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Backfill insurance_fee for existing shipments based on current payment calculations';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting to backfill insurance_fee for existing shipments...');

        // Get all shipments that don't have insurance_fee set
        $shipments = Shipment::whereNull('insurance_fee')->get();

        if ($shipments->isEmpty()) {
            $this->info('No shipments found that need backfilling.');
            return Command::SUCCESS;
        }

        $this->info("Found {$shipments->count()} shipments to update.");

        $bar = $this->output->createProgressBar($shipments->count());
        $bar->start();

        $updated = 0;
        $skipped = 0;

        foreach ($shipments as $shipment) {
            try {
                // Calculate payment details to get the insurance fee
                $paymentDetails = ShipmentPaymentHelper::calculatePaymentDetails($shipment);

                // Update the shipment with the calculated insurance fee
                $shipment->insurance_fee = $paymentDetails['insurance_fee'] ?? 0;
                $shipment->save();

                $updated++;
            } catch (\Exception $e) {
                $this->error("\nError updating shipment {$shipment->id}: " . $e->getMessage());
                $skipped++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();

        $this->info("Backfill complete!");
        $this->info("Updated: {$updated} shipments");

        if ($skipped > 0) {
            $this->warn("Skipped: {$skipped} shipments due to errors");
        }

        return Command::SUCCESS;
    }
}
