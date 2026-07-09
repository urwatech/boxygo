<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Enums\ShipmentStatus;
use App\Models\PaymentTransaction;
use App\Models\Shelf;
use App\Models\Shipment;
use App\Models\User;
use App\Notifications\DeliveryAssignedNotification;
use App\Notifications\DeliveryCompletedNotification;
use App\Notifications\EarningsUpdateNotification;
use App\Services\UserService;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed roles and permissions first
        $this->call([
            RolesAndPermissionsSeeder::class,
        ]);

        $userService = app(UserService::class);

        // ==================== FIXED TEST USERS ====================

        // 1. Create superadmin user
        $admin = $userService->create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'status' => 'active',
        ]);
        $admin->assignRole(Role::SUPERADMIN->value);

        // 2. Create customer user
        $customer = $userService->create([
            'name' => 'Customer User',
            'email' => 'customer@example.com',
            'password' => bcrypt('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'status' => 'active',
        ]);
        $customer->assignRole(Role::CUSTOMER->value);

        // 3. Create specific rider user: driver@example.com
        $mainRider = $userService->create([
            'name' => 'Main Driver',
            'email' => 'driver@example.com',
            'phone_number' => '+963911000001',
            'password' => bcrypt('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'status' => 'active',
            'employee_id' => 'RDR-0001',
            'shipment_type' => 'bike',
            'employment_type' => 'full_time',
            'governorate' => 'Damascus',
            'dob' => '1990-05-15',
            'gender' => 'male',
            'license_expiry' => now()->addYears(3)->format('Y-m-d'),
            'completed_jobs' => 150,
            'cancel_rate' => 2.5,
            'avg_eta_minutes' => 25,
            'cod_collection_limit' => 5000.00,
            'working_hours' => [
                'monday' => '09:00-17:00',
                'tuesday' => '09:00-17:00',
                'wednesday' => '09:00-17:00',
                'thursday' => '09:00-17:00',
                'friday' => '09:00-13:00',
            ],
            'email_notifications' => true,
            'push_notifications' => true,
            'member_since' => now()->subYear(),
        ]);
        $mainRider->assignRole(Role::RIDER->value);

        // 4. Create drop point keeper user: keeper@example.com
        $dropPointKeeper = $userService->create([
            'name' => 'Drop Point Keeper',
            'email' => 'keeper@example.com',
            'phone_number' => '+963911000002',
            'password' => bcrypt('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'status' => 'active',
            'employee_id' => 'DPK-0001',
            'governorate' => 'Damascus',
            'address' => 'Drop Point 1, Mazzeh District, Damascus',
            'latitude' => 33.5024,  // Damascus drop point location
            'longitude' => 36.2518,
            'dob' => '1992-08-20',
            'gender' => 'male',
            'working_hours' => [
                'monday' => '08:00-16:00',
                'tuesday' => '08:00-16:00',
                'wednesday' => '08:00-16:00',
                'thursday' => '08:00-16:00',
                'friday' => '08:00-14:00',
            ],
            'email_notifications' => true,
            'push_notifications' => true,
            'member_since' => now()->subMonths(6),
        ]);
        $dropPointKeeper->assignRole(Role::DROP_POINT_KEEPER->value);

        // Create shipments visible to Drop Point Keeper
        // Note: Keeper views shipments by status at the first drop point
        // regardless of customer. Setting user_id to keeper is not required.
        // We explicitly seed indirect shipments at the expected statuses.

        // Assigned to keeper stage (Arrived at Drop Point 1)
        Shipment::factory()
            ->count(5)
            ->indirect()
            ->state([
                'status' => ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
            ])
            ->withStatusTracking(4) // index 4 => Arrived at Drop Point 1
            ->create();

        // Completed by keeper stage (Dispatched to Warehouse)
        Shipment::factory()
            ->count(5)
            ->indirect()
            ->state([
                'status' => ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            ])
            ->withStatusTracking(6) // index 6 => Dispatched to Warehouse
            ->create();
        // 5. Create car driver user: cardriver@example.com
        $carDriver = $userService->create([
            'name' => 'Car Driver',
            'email' => 'cardriver@example.com',
            'phone_number' => '+963911000003',
            'password' => bcrypt('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'status' => 'active',
            'employee_id' => 'CAR-0001',
            'shipment_type' => 'car',
            'employment_type' => 'full_time',
            'governorate' => 'Damascus',
            'dob' => '1988-03-10',
            'gender' => 'male',
            'license_expiry' => now()->addYears(4)->format('Y-m-d'),
            'completed_jobs' => 200,
            'cancel_rate' => 1.8,
            'avg_eta_minutes' => 30,
            'cod_collection_limit' => 8000.00,
            'working_hours' => [
                'monday' => '08:00-18:00',
                'tuesday' => '08:00-18:00',
                'wednesday' => '08:00-18:00',
                'thursday' => '08:00-18:00',
                'friday' => '08:00-14:00',
                'saturday' => '10:00-16:00',
            ],
            'email_notifications' => true,
            'push_notifications' => true,
            'member_since' => now()->subMonths(14),
        ]);
        $carDriver->assignRole(Role::CAR_DRIVER->value);

        // 6. Create warehouse keeper user: warehouse@example.com
        $warehouseKeeper = $userService->create([
            'name' => 'Warehouse Keeper',
            'email' => 'warehouse@example.com',
            'phone_number' => '+963911000004',
            'password' => bcrypt('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'status' => 'active',
            'employee_id' => 'WHK-0001',
            'governorate' => 'Damascus',
            'address' => 'Central Warehouse, Industrial Area, Damascus',
            'latitude' => 33.5138,  // Damascus warehouse location
            'longitude' => 36.2765,
            'dob' => '1985-11-25',
            'gender' => 'male',
            'working_hours' => [
                'monday' => '07:00-19:00',
                'tuesday' => '07:00-19:00',
                'wednesday' => '07:00-19:00',
                'thursday' => '07:00-19:00',
                'friday' => '07:00-15:00',
                'saturday' => '08:00-14:00',
            ],
            'email_notifications' => true,
            'push_notifications' => true,
            'member_since' => now()->subMonths(18),
        ]);
        $warehouseKeeper->assignRole(Role::WAREHOUSE_KEEPER->value);

        // ==================== DYNAMIC TEST USERS ====================

        // Create 10 random riders
        $riders = User::factory()
            ->count(10)
            ->rider()
            ->create();

        foreach ($riders as $rider) {
            $rider->assignRole(Role::RIDER->value);
        }

        // Create 15 random customers
        $customers = User::factory()
            ->count(15)
            ->customer()
            ->create();

        foreach ($customers as $customerUser) {
            $customerUser->assignRole(Role::CUSTOMER->value);
        }

        // ==================== CREATE TEST SHELVES ====================

        $shelves = Shelf::factory()
            ->count(12)
            ->create();

        $shelves = $shelves
            ->merge(Shelf::factory()->count(2)->full()->create())
            ->merge(Shelf::factory()->count(2)->inactive()->create());

        // ==================== CREATE TEST SHIPMENTS ====================

        // All riders (including main driver)
        $allRiders = collect([$mainRider])->merge($riders);
        $allCustomers = collect([$customer])->merge($customers);

        // 1. Create 5 pending shipments (not assigned to any rider)
        Shipment::factory()
            ->count(5)
            ->pending()
            ->create([
                'user_id' => $allCustomers->random()->id,
            ]);

        // 2. Create comprehensive test shipments for the main rider (driver@example.com)
        // This creates shipments with all statuses and payment types for easy testing
        // Mix of both direct and indirect shipments

        // ASSIGNED - 3 shipments (2 direct, 1 indirect)
        Shipment::factory()
            ->assigned()
            ->cod()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => 250.00,
            ]);

        Shipment::factory()
            ->assigned()
            ->online()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->assigned()
            ->cod()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => 180.00,
            ]);

        // PICKED UP - 4 shipments (2 direct COD, 1 direct Online, 1 indirect)
        Shipment::factory()
            ->pickedUp()
            ->cod()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 100, 500),
            ]);

        Shipment::factory()
            ->pickedUp()
            ->online()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->pickedUp()
            ->cod()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 100, 400),
            ]);

        Shipment::factory()
            ->pickedUp()
            ->online()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // IN TRANSIT - 5 shipments (2 direct COD, 1 direct Online, 2 indirect)
        Shipment::factory()
            ->inTransit()
            ->cod()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 150, 600),
            ]);

        Shipment::factory()
            ->inTransit()
            ->online()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->count(2)
            ->inTransit()
            ->cod()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 120, 550),
            ]);

        Shipment::factory()
            ->inTransit()
            ->online()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // OUT FOR DELIVERY - 4 shipments (2 direct, 2 indirect)
        Shipment::factory()
            ->outForDelivery()
            ->cod()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 200, 700),
            ]);

        Shipment::factory()
            ->outForDelivery()
            ->online()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->outForDelivery()
            ->cod()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 180, 650),
            ]);

        Shipment::factory()
            ->outForDelivery()
            ->online()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // DELIVERED - 8 shipments (3 direct COD, 2 direct Online, 2 indirect COD, 1 indirect Online)
        Shipment::factory()
            ->count(3)
            ->delivered()
            ->cod()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 300, 1000),
                'payment_status' => 'paid', // Cash collected
            ]);

        Shipment::factory()
            ->count(2)
            ->delivered()
            ->online()
            ->direct()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->count(2)
            ->delivered()
            ->cod()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 250, 900),
                'payment_status' => 'paid', // Cash collected
            ]);

        Shipment::factory()
            ->delivered()
            ->online()
            ->indirect()
            ->forRider($mainRider)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // 3. Create comprehensive test shipments for car driver (cardriver@example.com)
        // Mix of both direct and indirect shipments, similar to main rider

        // ASSIGNED - 3 shipments (2 direct, 1 indirect)
        Shipment::factory()
            ->assigned()
            ->cod()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => 320.00,
            ]);

        Shipment::factory()
            ->assigned()
            ->online()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->assigned()
            ->cod()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => 220.00,
            ]);

        // PICKED UP - 4 shipments (2 direct, 2 indirect)
        Shipment::factory()
            ->pickedUp()
            ->cod()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 150, 600),
            ]);

        Shipment::factory()
            ->pickedUp()
            ->online()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->pickedUp()
            ->cod()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 120, 500),
            ]);

        Shipment::factory()
            ->pickedUp()
            ->online()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // IN TRANSIT - 5 shipments (3 direct, 2 indirect)
        Shipment::factory()
            ->count(2)
            ->inTransit()
            ->cod()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 180, 700),
            ]);

        Shipment::factory()
            ->inTransit()
            ->online()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->inTransit()
            ->cod()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 140, 600),
            ]);

        Shipment::factory()
            ->inTransit()
            ->online()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // OUT FOR DELIVERY - 4 shipments (2 direct, 2 indirect)
        Shipment::factory()
            ->outForDelivery()
            ->cod()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 250, 800),
            ]);

        Shipment::factory()
            ->outForDelivery()
            ->online()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->outForDelivery()
            ->cod()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 200, 750),
            ]);

        Shipment::factory()
            ->outForDelivery()
            ->online()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // DELIVERED - 8 shipments (4 direct, 4 indirect)
        Shipment::factory()
            ->count(2)
            ->delivered()
            ->cod()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 350, 1200),
                'payment_status' => 'paid', // Cash collected
            ]);

        Shipment::factory()
            ->count(2)
            ->delivered()
            ->online()
            ->direct()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        Shipment::factory()
            ->count(2)
            ->delivered()
            ->cod()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'parcel_amount' => fake()->randomFloat(2, 300, 1000),
                'payment_status' => 'paid', // Cash collected
            ]);

        Shipment::factory()
            ->count(2)
            ->delivered()
            ->online()
            ->indirect()
            ->forRider($carDriver)
            ->create([
                'user_id' => $allCustomers->random()->id,
                'payment_status' => 'paid',
            ]);

        // Map ShipmentStatus to factory method names (used for random shipments)
        $statusToMethod = [
            ShipmentStatus::ASSIGNED->value => 'assigned',
            ShipmentStatus::PICKUP->value => 'pickedUp',
            ShipmentStatus::IN_TRANSIT->value => 'inTransit',
            ShipmentStatus::OUT_FOR_DELIVERY->value => 'outForDelivery',
            ShipmentStatus::DELIVERED->value => 'delivered',
        ];

        // Additional 10-20 random shipments for car driver with mixed delivery speeds
        $additionalShipmentsCount = rand(10, 20);

        for ($i = 0; $i < $additionalShipmentsCount; $i++) {
            $deliverySpeed = fake()->randomElement(['direct', 'indirect']);

            // Pick a random status from ShipmentStatus enum
            $availableStatuses = [
                ShipmentStatus::ASSIGNED,
                ShipmentStatus::PICKUP,
                ShipmentStatus::IN_TRANSIT,
                ShipmentStatus::OUT_FOR_DELIVERY,
                ShipmentStatus::DELIVERED,
            ];
            $randomStatusEnum = $availableStatuses[array_rand($availableStatuses)];
            $factoryMethod = $statusToMethod[$randomStatusEnum->value];

            $paymentMethod = fake()->randomElement(['cod', 'online']);

            $factory = Shipment::factory()
                ->$factoryMethod()
                ->$paymentMethod();

            if ($deliverySpeed === 'direct') {
                $factory = $factory->direct();
            } else {
                $factory = $factory->indirect();
            }

            $factory->forRider($carDriver)
                ->create([
                    'user_id' => $allCustomers->random()->id,
                    'parcel_amount' => fake()->randomFloat(2, 100, 1500),
                ]);
        }

        // 4. Create shipments for other riders with various statuses
        foreach ($allRiders->skip(1)->take(5) as $rider) {
            // Pick a random status from ShipmentStatus enum
            $availableStatuses = [
                ShipmentStatus::ASSIGNED,
                ShipmentStatus::PICKUP,
                ShipmentStatus::IN_TRANSIT,
                ShipmentStatus::OUT_FOR_DELIVERY,
                ShipmentStatus::DELIVERED,
            ];
            $randomStatusEnum = $availableStatuses[array_rand($availableStatuses)];
            $factoryMethod = $statusToMethod[$randomStatusEnum->value];

            Shipment::factory()
                ->count(rand(2, 4))
                ->$factoryMethod()
                ->forRider($rider)
                ->create([
                    'user_id' => $allCustomers->random()->id,
                ]);
        }

        // 4. Create 10 COD shipments for testing payment collection
        Shipment::factory()
            ->count(10)
            ->cod()
            ->inTransit()
            ->forRider($allRiders->random())
            ->create([
                'user_id' => $allCustomers->random()->id,
            ]);

        // 5. Create 5 online payment shipments
        Shipment::factory()
            ->count(5)
            ->online()
            ->delivered()
            ->forRider($allRiders->random())
            ->create([
                'user_id' => $allCustomers->random()->id,
            ]);

        // ==================== CREATE PAYMENT TRANSACTIONS ====================

        // Get all delivered COD shipments
        $deliveredCodShipments = Shipment::where('payment_method', 'cash')
            ->where('status', 'delivered')
            ->whereNotNull('rider_id')
            ->get();

        foreach ($deliveredCodShipments as $shipment) {
            // Create rider collection transaction (rider collected from customer)
            $riderCollection = PaymentTransaction::factory()
                ->riderCollection()
                ->create([
                    'shipment_id' => $shipment->id,
                    'rider_id' => $shipment->rider_id,
                    'amount' => $shipment->parcel_amount,
                    'payment_method' => 'cash',
                ]);

            // 60% chance that admin has also collected from rider (settled)
            if (fake()->boolean(60)) {
                $riderCollection->update([
                    'settled_at' => fake()->dateTimeBetween($riderCollection->collected_at, 'now'),
                    'collected_by' => $admin->id,
                ]);

                // Create admin settlement transaction
                PaymentTransaction::factory()
                    ->adminSettlement()
                    ->create([
                        'shipment_id' => $shipment->id,
                        'rider_id' => $shipment->rider_id,
                        'amount' => $shipment->parcel_amount,
                        'payment_method' => 'cash',
                        'collected_at' => $riderCollection->collected_at,
                        'settled_at' => $riderCollection->settled_at,
                        'collected_by' => $admin->id,
                    ]);
            }
        }

        // Create some overdue transactions (collected more than 7 days ago, not settled)
        $oldCodShipments = Shipment::where('payment_method', 'cash')
            ->where('status', 'delivered')
            ->whereNotNull('rider_id')
            ->where('created_at', '<=', now()->subDays(8))
            ->inRandomOrder()
            ->take(3)
            ->get();

        foreach ($oldCodShipments as $shipment) {
            // Only create if transaction doesn't exist
            if (! $shipment->riderCollection) {
                PaymentTransaction::factory()
                    ->overdue()
                    ->create([
                        'shipment_id' => $shipment->id,
                        'rider_id' => $shipment->rider_id,
                        'amount' => $shipment->parcel_amount,
                        'payment_method' => 'cash',
                    ]);
            }
        }

        // Create online payment transactions for online payment shipments
        $onlineShipments = Shipment::where('payment_method', 'online')
            ->where('payment_status', 'paid')
            ->whereNotNull('rider_id')
            ->get();

        foreach ($onlineShipments as $shipment) {
            PaymentTransaction::factory()
                ->online()
                ->create([
                    'shipment_id' => $shipment->id,
                    'rider_id' => $shipment->rider_id,
                    'amount' => $shipment->parcel_amount,
                ]);
        }

        // ==================== ASSIGN SHIPMENTS TO SHELVES ====================

        $assignableShelves = $shelves
            ->filter(fn (Shelf $shelf) => $shelf->is_active && $shelf->occupied_slots < $shelf->capacity)
            ->values();

        $availableSlots = $assignableShelves
            ->sum(fn (Shelf $shelf) => $shelf->capacity - $shelf->occupied_slots);

        if ($availableSlots > 0) {
            $shipmentsToAssign = Shipment::query()
                ->whereNull('shelf_id')
                ->inRandomOrder()
                ->take(min(20, $availableSlots))
                ->get();

            foreach ($shipmentsToAssign as $shipment) {
                $availableShelves = $assignableShelves
                    ->filter(fn (Shelf $shelf) => $shelf->occupied_slots < $shelf->capacity);

                if ($availableShelves->isEmpty()) {
                    break;
                }

                /** @var Shelf $shelf */
                $shelf = $availableShelves->random();

                $shipment->forceFill([
                    'shelf_id' => $shelf->id,
                    'shelf_assigned_at' => now()->subHours(rand(1, 168)),
                ])->save();

                $shelf->increment('occupied_slots');
                $shelf->refresh();
            }
        }

        // ==================== CREATE TEST NOTIFICATIONS ====================

        // Create sample notifications for the main rider
        $mainRider->notify(new DeliveryAssignedNotification(
            shipmentId: 'SHIP-001',
            trackingNumber: 'TRK-123456',
            assignedBy: $admin->id
        ));

        $mainRider->notify(new DeliveryCompletedNotification(
            shipmentId: 'SHIP-002',
            trackingNumber: 'TRK-123457'
        ));

        $mainRider->notify(new EarningsUpdateNotification(
            amount: 1500.00,
            period: 'recent'
        ));

        // Create older notifications (from yesterday and earlier)
        $yesterdayNotification = new DeliveryAssignedNotification(
            shipmentId: 'SHIP-003',
            trackingNumber: 'TRK-123458'
        );
        $mainRider->notify($yesterdayNotification);
        $mainRider->notifications()
            ->where('id', $yesterdayNotification->id)
            ->update(['created_at' => now()->subDay()]);

        $olderEarningsNotification = new EarningsUpdateNotification(
            amount: 3000.00,
            period: 'recent'
        );
        $mainRider->notify($olderEarningsNotification);
        $mainRider->notifications()
            ->where('id', $olderEarningsNotification->id)
            ->update(['created_at' => now()->subDays(3)]);

        // Create notifications for customer
        $customer->notify(new DeliveryAssignedNotification(
            shipmentId: 'SHIP-100',
            trackingNumber: 'TRK-200001'
        ));

        $customer->notify(new DeliveryCompletedNotification(
            shipmentId: 'SHIP-101',
            trackingNumber: 'TRK-200002'
        ));

        // Create notifications for random riders
        foreach ($riders->take(5) as $rider) {
            $rider->notify(new DeliveryAssignedNotification(
                shipmentId: 'SHIP-'.rand(1000, 9999),
                trackingNumber: 'TRK-'.rand(100000, 999999)
            ));

            if (rand(0, 1)) {
                $rider->notify(new EarningsUpdateNotification(
                    amount: rand(500, 2000) / 10,
                    period: 'recent'
                ));
            }
        }

        // ==================== CREATE VEHICLES ====================

        // Now that riders exist, create vehicles
        $this->call([
            VehicleSeeder::class,
        ]);

        $this->command->info('');
        $this->command->info('✅ Database seeded successfully!');
        $this->command->info('');
        $this->command->info('🔑 Test Accounts (All passwords: 123456):');
        $this->command->info('   Admin:              admin@example.com');
        $this->command->info('   Customer:           customer@example.com');
        $this->command->info('   Main Rider:         driver@example.com');
        $this->command->info('   Car Driver:         cardriver@example.com');
        $this->command->info('   Drop Point Keeper:  keeper@example.com');
        $this->command->info('   Warehouse Keeper:   warehouse@example.com');
        $this->command->info('');
        $this->command->info('📊 Statistics:');
        $this->command->info('   - Riders:                '.(1 + $riders->count()));
        $this->command->info('   - Customers:             '.(1 + $customers->count()));
        $this->command->info('   - Shelves:               '.Shelf::count());
        $this->command->info('   - Shipments:             '.Shipment::count());
        $this->command->info('   - Payment Transactions:  '.PaymentTransaction::count());
        $this->command->info('   - Vehicles:              '.\App\Models\Vehicle::count());
        $this->command->info('   - Notifications:         '.\Illuminate\Notifications\DatabaseNotification::count());
        $this->command->info('');
        $this->command->info('💰 Payment Statistics:');
        $this->command->info('   - COD Collections:       '.PaymentTransaction::where('transaction_type', 'rider_collection')->where('payment_method', 'cash')->count());
        $this->command->info('   - Admin Settlements:     '.PaymentTransaction::where('transaction_type', 'admin_settlement')->count());
        $this->command->info('   - Pending Settlements:   '.PaymentTransaction::whereNull('settled_at')->where('transaction_type', 'rider_collection')->count());
        $this->command->info('   - Online Payments:       '.PaymentTransaction::where('payment_method', 'online')->count());

        // ==================== CREATE GOVERNATES ====================
        $this->call([
            GovernateSeeder::class,
        ]);

        // ==================== CREATE Parcels ====================
        $this->call([
            ParcelSeeder::class,
        ]);

        // ==================== CREATE CITIES ====================
        $this->call([
            CitySeeder::class,
        ]);
    }
}
