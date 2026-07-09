<?php

namespace Tests\Feature\Admin;

use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_superadmin_can_view_vehicle_management_page(): void
    {
        $superadmin = $this->makeSuperAdmin();
        $rider = $this->makeRider();

        Vehicle::factory()->create([
            'code' => 'VHC-999',
            'license_plate' => 'SY-XYZ-9999',
            'user_id' => $rider->id,
        ]);

        $response = $this->actingAs($superadmin)
            ->get(route('admin.vehicles.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('SuperAdmin/Vehicles/Index')
            ->where('vehicles.data.0.code', 'VHC-999')
            ->where('vehicles.data.0.assigned_rider.name', $rider->name));
    }

    public function test_superadmin_can_store_vehicle(): void
    {
        $superadmin = $this->makeSuperAdmin();
        $rider = $this->makeRider();

        $payload = [
            'code' => 'VHC-123',
            'type' => 'Bike',
            'make' => 'Yamaha',
            'model' => 'X-2025',
            'color' => 'Black',
            'license_plate' => 'SY-NEW-0001',
            'permit_expires_at' => now()->addYear()->toDateString(),
            'insurance_expires_at' => now()->addMonths(8)->toDateString(),
            'status' => Vehicle::STATUS_ACTIVE,
            'assigned_rider_id' => $rider->id,
        ];

        $response = $this->actingAs($superadmin)
            ->from(route('admin.vehicles.index'))
            ->post(route('admin.vehicles.store'), $payload);

        $response->assertRedirect(route('admin.vehicles.index'));

        $this->assertDatabaseHas('vehicles', [
            'license_plate' => 'SY-NEW-0001',
            'user_id' => $rider->id,
        ]);
    }

    public function test_superadmin_can_assign_vehicle_to_rider(): void
    {
        $superadmin = $this->makeSuperAdmin();
        $rider = $this->makeRider();
        $vehicle = Vehicle::factory()->create([
            'user_id' => null,
            'license_plate' => 'SY-ASS-1234',
        ]);

        $response = $this->actingAs($superadmin)
            ->from(route('admin.vehicles.index'))
            ->patch(route('admin.vehicles.assign', $vehicle), [
                'user_id' => $rider->id,
            ]);

        $response->assertRedirect(route('admin.vehicles.index'));
        $this->assertDatabaseHas('vehicles', [
            'id' => $vehicle->id,
            'user_id' => $rider->id,
        ]);

        $this->actingAs($superadmin)
            ->patch(route('admin.vehicles.assign', $vehicle), ['user_id' => null])
            ->assertRedirect(route('admin.vehicles.index'));

        $this->assertDatabaseHas('vehicles', [
            'id' => $vehicle->id,
            'user_id' => null,
        ]);
    }

    private function makeSuperAdmin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('superadmin');

        return $user;
    }

    private function makeRider(): User
    {
        $role = Role::firstOrCreate(
            ['name' => 'rider'],
            [
                'description' => 'Delivery rider',
                'platform' => 'Admin Portal',
                'country' => 'Damascus',
                'is_protected' => false,
                'guard_name' => 'web',
            ],
        );

        // $user = User::factory()->create([
        //     'employment_type' => 'rider',
        // ]);

        $user->assignRole($role);

        return $user;
    }
}
