<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Services\UserService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role as SpatieRole;

class CreateWarehouseKeeper extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'app:create-warehouse-keeper';

    /**
     * The console command description.
     */
    protected $description = 'Create a warehouse keeper test account';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $userService = app(UserService::class);

        // Ensure the warehouse keeper role exists with Mobile App platform
        $roleName = Role::WAREHOUSE_KEEPER->value;
        $existingRole = SpatieRole::where('name', $roleName)->where('guard_name', 'web')->first();

        if (!$existingRole) {
            SpatieRole::create([
                'name' => $roleName,
                'guard_name' => 'web',
                'description' => Role::WAREHOUSE_KEEPER->description(),
                'platform' => Role::WAREHOUSE_KEEPER->platform(), // 'Mobile App'
                'country' => 'Damascus',
                'is_protected' => Role::WAREHOUSE_KEEPER->isProtected(),
            ]);
            $this->info("Created role: {$roleName} with Mobile App platform");
        } elseif ($existingRole->platform !== 'Mobile App') {
            // Update existing role to have Mobile App platform
            $existingRole->platform = Role::WAREHOUSE_KEEPER->platform();
            $existingRole->save();
            $this->info("Updated role platform to: Mobile App");
        }

        // Delete existing warehouse keeper if exists
        $existingUser = \App\Models\User::where('email', 'warehouse@example.com')->first();

        if ($existingUser) {
            $existingUser->delete();
            $this->info('Deleted existing warehouse keeper.');
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

        $this->info('✅ Warehouse keeper created successfully!');
        $this->info('');
        $this->info('📧 Email: warehouse@example.com');
        $this->info('🔑 Password: 123456');
        $this->info('📍 Coordinates: 33.5138, 36.2765');

        return Command::SUCCESS;
    }
}
