<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

class VehicleSeeder extends Seeder
{
    /**
     * Seed the vehicles table.
     */
    public function run(): void
    {
        // Fetch only users with 'rider' role
        $riders = User::role('rider')->get();

        // If no riders exist, skip vehicle creation
        if ($riders->isEmpty()) {
            $this->command->warn('⚠️  No riders found. Skipping vehicle creation.');
            return;
        }

        $this->command->info('Creating vehicles for ' . $riders->count() . ' riders...');

        // Create different types of vehicles with various statuses
        $vehicleCount = 0;

        // 1. Create 10 active bikes
        Vehicle::factory()
            ->count(10)
            ->bike()
            ->active()
            ->create()
            ->each(function (Vehicle $vehicle) use ($riders, &$vehicleCount) {
                // 70% chance of being assigned to a rider
                if (fake()->boolean(70)) {
                    $vehicle->update(['user_id' => $riders->random()->id]);
                }
                $vehicleCount++;
            });

        // 2. Create 8 active vans
        Vehicle::factory()
            ->count(8)
            ->van()
            ->active()
            ->create()
            ->each(function (Vehicle $vehicle) use ($riders, &$vehicleCount) {
                if (fake()->boolean(70)) {
                    $vehicle->update(['user_id' => $riders->random()->id]);
                }
                $vehicleCount++;
            });

        // 3. Create 6 active mini vans
        Vehicle::factory()
            ->count(6)
            ->miniVan()
            ->active()
            ->create()
            ->each(function (Vehicle $vehicle) use ($riders, &$vehicleCount) {
                if (fake()->boolean(70)) {
                    $vehicle->update(['user_id' => $riders->random()->id]);
                }
                $vehicleCount++;
            });

        // 4. Create 3 vehicles pending renewal
        Vehicle::factory()
            ->count(3)
            ->pendingRenewal()
            ->create()
            ->each(function (Vehicle $vehicle) use ($riders, &$vehicleCount) {
                $vehicle->update(['user_id' => $riders->random()->id]);
                $vehicleCount++;
            });

        // 5. Create 2 inactive vehicles
        Vehicle::factory()
            ->count(2)
            ->inactive()
            ->create()
            ->each(function (Vehicle $vehicle) use ($riders, &$vehicleCount) {
                $vehicle->update(['user_id' => $riders->random()->id]);
                $vehicleCount++;
            });

        // 6. Create 3 pending vehicles (not yet approved)
        Vehicle::factory()
            ->count(3)
            ->pending()
            ->create()
            ->each(function (Vehicle $vehicle) use ($riders, &$vehicleCount) {
                $vehicle->update(['user_id' => $riders->random()->id]);
                $vehicleCount++;
            });

        $assignedCount = Vehicle::whereNotNull('user_id')->count();
        $unassignedCount = Vehicle::whereNull('user_id')->count();

        $this->command->info("✅ Created {$vehicleCount} vehicles");
        $this->command->info("   - Assigned: {$assignedCount}");
        $this->command->info("   - Unassigned: {$unassignedCount}");
    }
}
