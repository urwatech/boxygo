<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Services\UserService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class WarehouseKeeperSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $userService = app(UserService::class);

        // Check if warehouse keeper already exists
        $existingUser = \App\Models\User::where('email', 'warehouse@example.com')->first();

        if ($existingUser) {
            $this->command->info('Warehouse keeper already exists: warehouse@example.com');
            return;
        }

        // Create warehouse keeper with lat/long
        $warehouseKeeper = $userService->create([
            'name' => 'Warehouse Keeper',
            'email' => 'warehouse@example.com',
            'phone_number' => '+963911000004',
            'password' => Hash::make('123456'),
            'address' => 'Central Warehouse, Industrial Area, Damascus',
            'latitude' => 33.5138,
            'longitude' => 36.2765,
            'status' => 'active',
            'is_approved' => true,
            'email_verified_at' => now(),
        ]);

        $warehouseKeeper->assignRole(Role::WAREHOUSE_KEEPER->value);

        $this->command->info('Warehouse keeper created successfully!');
        $this->command->info('Email: warehouse@example.com');
        $this->command->info('Password: 123456');
        $this->command->info('Coordinates: 33.5138, 36.2765');
    }
}
