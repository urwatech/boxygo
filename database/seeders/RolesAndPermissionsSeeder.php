<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Services\RoleService;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $roleService = app(RoleService::class);

        // Define permissions using resource.action format
        // Admin Portal Permissions
        $adminPortalPermissions = [
            // Dashboard Module
            'admin.access', // Required permission to access admin dashboard

            // Employee Management Module
            'employees.manage',    // Module permission
            'employees.view',
            'employees.create',
            'employees.edit',
            'employees.delete',

            // Customer Management Module
            'customers.manage',    // Module permission
            'customers.view',

            // Roles & Permissions Module
            'roles.manage',     // Module permission
            'roles.view',
            'roles.create',
            'roles.edit',
            'roles.delete',

            // Zone Management Module
            'zones.manage',     // Module permission
            'zones.view',
            'zones.create',
            'zones.edit',
            'zones.delete',
            'zones.status',     // Zone status control

            // Drop Points Module
            'drop_points.manage', // Module permission
            'drop_points.view',
            'drop_points.create',
            'drop_points.edit',
            'drop_points.delete',

            // Parcel Management Module
            'parcels.manage',   // Module permission
            'parcels.view',
            'parcels.create',
            'parcels.edit',
            'parcels.delete',
            'parcels.status',   // Parcel status control

            // Shipment Management Module
            'shipments.manage', // Module permission
            'shipments.view',   // View shipments
            'shipments.assign', // Assign riders to shipments
            'shipments.tracking', // Track shipments

            // Vehicle Management Module
            'vehicles.manage',  // Module permission
            'vehicles.view',
            'vehicles.create',
            'vehicles.assign',  // Assign vehicles

            // Earnings Summary Module
            'earnings.manage',  // Module permission
            'earnings.view',

            // COD Management Module
            'cod.manage',       // Module permission
            'cod.view',
            'cod.collect',      // Collect COD

            // Pricing Management Module
            'pricing.manage',   // Module permission
            'pricing.view',

            // Heatmap Module
            'heatmap.view',     // Module permission & view heatmap

            // Settings Module
            'settings.manage',  // Module permission
            'settings.view',
            'settings.profile', // Update profile
            'settings.password', // Update password
        ];

        // Mobile Application Permissions
        $mobileAppPermissions = [
            // Job Management Module
            'jobs.manage',      // Module permission
            'jobs.view',
            'jobs.update',      // Update job status
            'jobs.scan',        // Scan parcels

            // Shelf Management Module
            'shelves.manage',   // Module permission
            'shelves.view',
            'shelves.assign',   // Assign to shelf

            // Mobile Vehicle Management Module
            'mobile.vehicles.manage', // Module permission
            'mobile.vehicles.view',
            'mobile.vehicles.create',

            // Profile Management Module
            'profile.manage',   // Module permission
            'profile.view',
            'profile.update',
            'profile.documents.view',
            'profile.documents.upload',
            'profile.earnings.view',
            'profile.deposit',  // Deposit cash

            // Notifications Module
            'notifications.manage', // Module permission
            'notifications.view',
            'notifications.read',   // Mark as read

            // COD Collection Module
            'cod.collect',          // Module permission (duplicate from admin but for mobile)
            'cod.payment.collect',  // Collect payment
        ];

        // Combine all permissions
        $allPermissions = array_merge($adminPortalPermissions, $mobileAppPermissions);

        // Create permissions if they don't exist
        foreach ($allPermissions as $permission) {
            $roleService->firstOrCreatePermission([
                'name' => $permission,
                'guard_name' => 'web'
            ]);
        }

        // Create superadmin role (cannot be deleted)
        $superadminRole = $roleService->firstOrCreate(
            ['name' => Role::SUPERADMIN->value, 'guard_name' => 'web'],
            [
                'description' => Role::SUPERADMIN->description(),
                'platform' => Role::SUPERADMIN->platform(),
                'country' => 'Damascus',
                'is_protected' => Role::SUPERADMIN->isProtected(),
            ]
        );
        $superadminRole->is_protected = Role::SUPERADMIN->isProtected();
        $superadminRole->save();

        // Create customer role (cannot be deleted)
        $customerRole = $roleService->firstOrCreate(
            ['name' => Role::CUSTOMER->value, 'guard_name' => 'web'],
            [
                'description' => Role::CUSTOMER->description(),
                'platform' => Role::CUSTOMER->platform(),
                'country' => 'Damascus',
                'is_protected' => Role::CUSTOMER->isProtected(),
            ]
        );
        $customerRole->is_protected = Role::CUSTOMER->isProtected();
        $customerRole->save();

        // Create rider role (mobile API access only, no permissions needed)
        $riderRole = $roleService->firstOrCreate(
            ['name' => Role::RIDER->value, 'guard_name' => 'web'],
            [
                'description' => Role::RIDER->description(),
                'platform' => Role::RIDER->platform(),
                'country' => 'Damascus',
                'is_protected' => Role::RIDER->isProtected(),
            ]
        );

        // Create drop point keeper role (mobile API access only, no permissions needed)
        $dropPointKeeperRole = $roleService->firstOrCreate(
            ['name' => Role::DROP_POINT_KEEPER->value, 'guard_name' => 'web'],
            [
                'description' => Role::DROP_POINT_KEEPER->description(),
                'platform' => Role::DROP_POINT_KEEPER->platform(),
                'country' => 'Damascus',
                'is_protected' => Role::DROP_POINT_KEEPER->isProtected(),
            ]
        );

        // Create car driver role (mobile API access only, no permissions needed)
        $carDriverRole = $roleService->firstOrCreate(
            ['name' => Role::CAR_DRIVER->value, 'guard_name' => 'web'],
            [
                'description' => Role::CAR_DRIVER->description(),
                'platform' => Role::CAR_DRIVER->platform(),
                'country' => 'Damascus',
                'is_protected' => Role::CAR_DRIVER->isProtected(),
            ]
        );

        // Create warehouse keeper role (mobile API access only, no permissions needed)
        $warehouseKeeperRole = $roleService->firstOrCreate(
            ['name' => Role::WAREHOUSE_KEEPER->value, 'guard_name' => 'web'],
            [
                'description' => Role::WAREHOUSE_KEEPER->description(),
                'platform' => Role::WAREHOUSE_KEEPER->platform(),
                'country' => 'Damascus',
                'is_protected' => Role::WAREHOUSE_KEEPER->isProtected(),
            ]
        );

        // Assign all permissions to superadmin
        $roleService->syncPermissionsToRole($superadminRole, $roleService->getAllPermissions()->pluck('name')->toArray());

        // Customers, riders, drop point keepers, car drivers, and warehouse keepers get no permissions by default (API access only)
        $roleService->syncPermissionsToRole($customerRole, []);
        $roleService->syncPermissionsToRole($riderRole, []);
        $roleService->syncPermissionsToRole($dropPointKeeperRole, []);
        $roleService->syncPermissionsToRole($carDriverRole, []);
        $roleService->syncPermissionsToRole($warehouseKeeperRole, []);
    }
}
