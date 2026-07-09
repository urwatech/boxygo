# Factory Usage Guide

This document provides examples and usage patterns for all available factories in the application.

---

## UserFactory

### Basic Usage

```php
use App\Models\User;

// Create a basic user
User::factory()->create();

// Create multiple users
User::factory()->count(10)->create();
```

### State Methods

#### `->rider()`
Creates a rider with full profile including employee_id, shipment_type, license, stats, etc.

```php
User::factory()->rider()->create();

User::factory()
    ->count(5)
    ->rider()
    ->create();
```

#### `->customer()`
Creates a customer user.

```php
User::factory()->customer()->create();
```

#### `->superadmin()`
Creates a superadmin user.

```php
User::factory()->superadmin()->create();
```

#### `->unverified()`
Creates a user with unverified email and phone.

```php
User::factory()->rider()->unverified()->create();
```

### Custom Attributes

```php
User::factory()->rider()->create([
    'name' => 'John Doe',
    'email' => 'john@example.com',
    'phone_number' => '+963911000001',
]);
```

---

## ShipmentFactory

### Basic Usage

```php
use App\Models\Shipment;

// Create a basic shipment
Shipment::factory()->create();

// Create multiple shipments
Shipment::factory()->count(10)->create();
```

### Status State Methods

#### `->pending()`
Creates a pending shipment (not assigned to any rider).

```php
Shipment::factory()->pending()->create();
```

#### `->assigned()`
Creates an assigned shipment (assigned to a rider but not picked up).

```php
Shipment::factory()->assigned()->create();
```

#### `->pickedUp()`
Creates a picked-up shipment (rider has collected it).

```php
Shipment::factory()->pickedUp()->create();
```

#### `->inTransit()`
Creates an in-transit shipment.

```php
Shipment::factory()->inTransit()->create();
```

#### `->delivered()`
Creates a delivered shipment.

```php
Shipment::factory()->delivered()->create();
```

### Payment State Methods

#### `->cod()`
Creates a cash on delivery shipment.

```php
Shipment::factory()->cod()->create();

// Combine with status
Shipment::factory()->cod()->inTransit()->create();
```

#### `->online()`
Creates an online payment shipment.

```php
Shipment::factory()->online()->create();
```

### Delivery Speed Methods

#### `->direct()`
Creates a direct delivery shipment.

```php
Shipment::factory()->direct()->create();
```

#### `->indirect()`
Creates an indirect delivery shipment.

```php
Shipment::factory()->indirect()->create();
```

### Assignment Methods

#### `->forRider($rider)`
Assigns the shipment to a specific rider.

```php
$rider = User::factory()->rider()->create();

Shipment::factory()
    ->forRider($rider)
    ->inTransit()
    ->create();
```

#### `->forCustomer($customer)`
Assigns the shipment to a specific customer.

```php
$customer = User::factory()->customer()->create();

Shipment::factory()
    ->forCustomer($customer)
    ->create();
```

### Complex Examples

```php
// Create 10 COD shipments in transit for a specific rider
$rider = User::find(1);

Shipment::factory()
    ->count(10)
    ->cod()
    ->inTransit()
    ->forRider($rider)
    ->create();

// Create 5 delivered online payment shipments
Shipment::factory()
    ->count(5)
    ->online()
    ->delivered()
    ->direct()
    ->create();

// Create shipments for multiple riders
$riders = User::role('rider')->get();

$riders->each(function ($rider) {
    Shipment::factory()
        ->count(rand(3, 7))
        ->forRider($rider)
        ->create();
});
```

---

## VehicleFactory

### Basic Usage

```php
use App\Models\Vehicle;

// Create a basic vehicle
Vehicle::factory()->create();

// Create multiple vehicles
Vehicle::factory()->count(10)->create();
```

### Vehicle Type Methods

#### `->bike()`
Creates a bike vehicle with realistic bike models.

```php
Vehicle::factory()->bike()->create();

// Models: Honda CB125F, Suzuki GN125, Yamaha YBR125, etc.
```

#### `->van()`
Creates a van vehicle with realistic van models.

```php
Vehicle::factory()->van()->create();

// Models: Toyota Hiace, Nissan Urvan, Mercedes Sprinter, etc.
```

#### `->miniVan()`
Creates a mini van vehicle.

```php
Vehicle::factory()->miniVan()->create();

// Models: Suzuki APV, Daihatsu Gran Max, Mitsubishi L300, etc.
```

### Status State Methods

#### `->active()`
Creates an active vehicle with valid permits and insurance.

```php
Vehicle::factory()->active()->create();
```

#### `->pendingRenewal()`
Creates a vehicle with expiring documents (within 1 month).

```php
Vehicle::factory()->pendingRenewal()->create();
```

#### `->inactive()`
Creates an inactive vehicle.

```php
Vehicle::factory()->inactive()->create();
```

#### `->pending()`
Creates a pending vehicle (waiting approval).

```php
Vehicle::factory()->pending()->create();
```

### Assignment Methods

#### `->assignedTo($user)`
Assigns the vehicle to a specific user/rider.

```php
$rider = User::factory()->rider()->create();

Vehicle::factory()
    ->bike()
    ->active()
    ->assignedTo($rider)
    ->create();
```

### Complex Examples

```php
// Create 10 active bikes and assign 70% to riders
$riders = User::role('rider')->get();

Vehicle::factory()
    ->count(10)
    ->bike()
    ->active()
    ->create()
    ->each(function ($vehicle) use ($riders) {
        if (fake()->boolean(70)) {
            $vehicle->update(['user_id' => $riders->random()->id]);
        }
    });

// Create a fleet of different vehicle types
Vehicle::factory()->count(5)->bike()->active()->create();
Vehicle::factory()->count(3)->van()->active()->create();
Vehicle::factory()->count(2)->miniVan()->active()->create();
Vehicle::factory()->count(2)->bike()->pendingRenewal()->create();

// Assign specific vehicles to a rider
$rider = User::find(1);

Vehicle::factory()->bike()->active()->assignedTo($rider)->create();
Vehicle::factory()->van()->active()->assignedTo($rider)->create();
```

---

## Realistic Data Features

### UserFactory
- **Realistic names**: Generated using Faker
- **Phone numbers**: Syrian format (+963...)
- **Employee IDs**: RDR-XXXX format
- **Working hours**: JSON with weekly schedule
- **Statistics**: completed_jobs, cancel_rate, avg_eta_minutes
- **Governorates**: Damascus, Aleppo, Homs, Latakia, Hama

### ShipmentFactory
- **Syrian addresses**: Street addresses with Damascus
- **Coordinates**: Realistic Damascus latitude/longitude
- **Phone numbers**: Syrian format (+963...)
- **License plates**: SY-CITY-XXXX format
- **Realistic statuses**: Proper status flow
- **Payment amounts**: Realistic ranges (10-5000)

### VehicleFactory
- **Real models by type**:
  - Bikes: Honda CB125F, Suzuki GN125, Yamaha YBR125
  - Vans: Toyota Hiace, Nissan Urvan, Mercedes Sprinter
  - Mini Vans: Suzuki APV, Daihatsu Gran Max
- **Syrian license plates**: SY-DAM-1234 (city codes: DAM, ALP, HMS, etc.)
- **Realistic colors**: White, Black, Silver, Blue, Red, Gray
- **Model years**: 2015-2024
- **Auto-generated codes**: VHC-01, VHC-02, etc.

---

## Testing Workflows

### Create a complete rider with jobs and vehicle

```php
// 1. Create rider
$rider = User::factory()->rider()->create([
    'name' => 'Test Rider',
    'email' => 'test.rider@example.com',
]);

$rider->assignRole('rider');

// 2. Assign vehicle
$vehicle = Vehicle::factory()
    ->bike()
    ->active()
    ->assignedTo($rider)
    ->create();

// 3. Create shipments for the rider
Shipment::factory()
    ->count(3)
    ->assigned()
    ->forRider($rider)
    ->create();

Shipment::factory()
    ->count(5)
    ->inTransit()
    ->cod()
    ->forRider($rider)
    ->create();

Shipment::factory()
    ->count(2)
    ->delivered()
    ->forRider($rider)
    ->create();
```

### Create a customer with shipments

```php
// 1. Create customer
$customer = User::factory()->customer()->create([
    'email' => 'test.customer@example.com',
]);

$customer->assignRole('customer');

// 2. Create shipments for customer
Shipment::factory()
    ->count(5)
    ->pending()
    ->forCustomer($customer)
    ->create();

Shipment::factory()
    ->count(3)
    ->delivered()
    ->forCustomer($customer)
    ->create();
```

---

## Seeding Commands

### Fresh migration with seed
```bash
php artisan migrate:fresh --seed
```

### Just run seeders
```bash
php artisan db:seed
```

### Run specific seeder
```bash
php artisan db:seed --class=VehicleSeeder
```

---

## Test Data Summary

After running `php artisan migrate:fresh --seed`, you'll have:

| Type | Count | Details |
|------|-------|---------|
| **Riders** | 11 | 1 main (driver@example.com) + 10 random |
| **Customers** | 16 | 1 fixed + 15 random |
| **Admins** | 1 | admin@example.com |
| **Shipments** | ~60+ | Various statuses, COD/online, assigned to riders |
| **Vehicles** | ~32 | Bikes, vans, mini vans with various statuses |

**All passwords**: `password`
