<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<\App\Models\Vehicle> */
class VehicleFactory extends Factory
{
    protected $model = Vehicle::class;

    // Static counter for unique codes
    private static int $codeSequence = 0;

    // Realistic vehicle models by type
    private static array $bikeModels = [
        'Honda CB125F',
        'Suzuki GN125',
        'Yamaha YBR125',
        'Honda Wave 125',
        'Suzuki Hayate',
        'Bajaj Pulsar 125',
        'Hero Splendor',
    ];

    private static array $vanModels = [
        'Toyota Hiace',
        'Nissan Urvan',
        'Mercedes Sprinter',
        'Ford Transit',
        'Hyundai H350',
        'Kia K2500',
    ];

    private static array $miniVanModels = [
        'Suzuki APV',
        'Daihatsu Gran Max',
        'Mitsubishi L300',
        'Suzuki Every',
        'Toyota Town Ace',
    ];

    private static array $colors = [
        'White',
        'Black',
        'Silver',
        'Blue',
        'Red',
        'Gray',
        'Green',
        'Yellow',
    ];

    public function definition(): array
    {
        $type = $this->faker->randomElement(['Bike', 'Van', 'Mini Van']);

        // Select model based on type
        $model = match ($type) {
            'Bike' => $this->faker->randomElement(self::$bikeModels),
            'Van' => $this->faker->randomElement(self::$vanModels),
            'Mini Van' => $this->faker->randomElement(self::$miniVanModels),
            default => 'Unknown Model',
        };

        $statuses = [
            Vehicle::STATUS_ACTIVE,
            Vehicle::STATUS_PENDING_RENEWAL,
            Vehicle::STATUS_INACTIVE,
        ];

        // 70% chance of active status
        $status = $this->faker->boolean(70)
            ? Vehicle::STATUS_ACTIVE
            : $this->faker->randomElement([Vehicle::STATUS_PENDING_RENEWAL, Vehicle::STATUS_INACTIVE]);

        // More realistic expiry dates
        $permitExpiry = $this->faker->dateTimeBetween('now', '+2 years')->format('Y-m-d');
        $insuranceExpiry = $this->faker->dateTimeBetween('now', '+18 months')->format('Y-m-d');

        return [
            'code' => $this->generateVehicleCode(),
            'user_id' => null,
            'type' => $type,
            'model' => $model,
            'model_year' => $this->faker->numberBetween(2015, 2024),
            'color' => $this->faker->randomElement(self::$colors),
            'license_plate' => $this->generateSyrianLicensePlate(),
            'photo_path' => null,
            'permit_expires_at' => $permitExpiry,
            'insurance_expires_at' => $insuranceExpiry,
            'status' => $status,
            'vehicle_registration_path' => null,
            'car_insurance_path' => null,
            'operating_permit_path' => null,
            'additional_documents' => null,
        ];
    }

    /**
     * Generate a unique vehicle code using static counter.
     */
    private function generateVehicleCode(): string
    {
        // Increment and use static counter for unique codes
        self::$codeSequence++;

        return sprintf('VHC-%04d', self::$codeSequence);
    }

    /**
     * Generate a realistic Syrian license plate.
     */
    private function generateSyrianLicensePlate(): string
    {
        $cities = ['DAM', 'ALP', 'HMS', 'LTK', 'HMA', 'TAR', 'DER', 'RAQ'];
        $city = $this->faker->randomElement($cities);
        $letters = strtoupper($this->faker->lexify('???'));
        $numbers = $this->faker->numerify('####');

        return sprintf('SY-%s-%s', $city, $numbers);
    }

    /**
     * Assign this vehicle to a specific user.
     */
    public function assignedTo(User $user): self
    {
        return $this->state(fn () => ['user_id' => $user->id]);
    }

    /**
     * Create an active vehicle.
     */
    public function active(): self
    {
        return $this->state(fn () => [
            'status' => Vehicle::STATUS_ACTIVE,
            'permit_expires_at' => $this->faker->dateTimeBetween('+3 months', '+2 years')->format('Y-m-d'),
            'insurance_expires_at' => $this->faker->dateTimeBetween('+3 months', '+18 months')->format('Y-m-d'),
        ]);
    }

    /**
     * Create a pending renewal vehicle.
     */
    public function pendingRenewal(): self
    {
        return $this->state(fn () => [
            'status' => Vehicle::STATUS_PENDING_RENEWAL,
            'permit_expires_at' => $this->faker->dateTimeBetween('-1 month', '+1 month')->format('Y-m-d'),
        ]);
    }

    /**
     * Create an inactive vehicle.
     */
    public function inactive(): self
    {
        return $this->state(fn () => [
            'status' => Vehicle::STATUS_INACTIVE,
        ]);
    }

    /**
     * Create a pending vehicle.
     */
    public function pending(): self
    {
        return $this->state(fn () => [
            'status' => Vehicle::STATUS_PENDING,
        ]);
    }

    /**
     * Create a bike vehicle.
     */
    public function bike(): self
    {
        return $this->state(fn () => [
            'type' => 'Bike',
            'model' => $this->faker->randomElement(self::$bikeModels),
        ]);
    }

    /**
     * Create a van vehicle.
     */
    public function van(): self
    {
        return $this->state(fn () => [
            'type' => 'Van',
            'model' => $this->faker->randomElement(self::$vanModels),
        ]);
    }

    /**
     * Create a mini van vehicle.
     */
    public function miniVan(): self
    {
        return $this->state(fn () => [
            'type' => 'Mini Van',
            'model' => $this->faker->randomElement(self::$miniVanModels),
        ]);
    }
}
