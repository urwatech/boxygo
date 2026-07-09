<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone_number' => fake()->phoneNumber(),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'password' => static::$password ??= Hash::make('123456'),
            'status' => 'active',
            'availability' => fake()->randomElement(['online', 'offline', 'busy']),
            'delivery_speed_mode' => 'direct',
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);
    }

    /**
     * Create a rider user with full profile.
     */
    public function rider(): static
    {
        return $this->state(fn (array $attributes) => [
            'employee_id' => 'RDR-'.fake()->unique()->numberBetween(1000, 9999),
            'shipment_type' => fake()->randomElement(['bike', 'van', 'car']),
            'delivery_speed_mode' => fake()->randomElement(['direct', 'indirect']),
            'employment_type' => fake()->randomElement(['full_time', 'part_time', 'contract']),
            'governorate' => fake()->randomElement(['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama']),
            'dob' => fake()->date('Y-m-d', '-25 years'),
            'gender' => fake()->randomElement(['male', 'female']),
            'license_expiry' => fake()->dateTimeBetween('+1 year', '+5 years')->format('Y-m-d'),
            'completed_jobs' => fake()->numberBetween(0, 500),
            'cancel_rate' => fake()->randomFloat(2, 0, 10),
            'avg_eta_minutes' => fake()->numberBetween(15, 45),
            'cod_collection_limit' => fake()->randomFloat(2, 1000, 10000),
            'working_hours' => [
                'monday' => '09:00-17:00',
                'tuesday' => '09:00-17:00',
                'wednesday' => '09:00-17:00',
                'thursday' => '09:00-17:00',
                'friday' => '09:00-13:00',
            ],
            'availability' => fake()->boolean(70) ? 'online' : fake()->randomElement(['offline', 'busy']),
            'email_notifications' => true,
            'push_notifications' => true,
            'member_since' => fake()->dateTimeBetween('-2 years', '-1 month'),
        ]);
    }

    /**
     * Create a customer user.
     */
    public function customer(): static
    {
        return $this->state(fn (array $attributes) => [
            'governorate' => fake()->randomElement(['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama']),
            'email_notifications' => fake()->boolean(70),
            'push_notifications' => fake()->boolean(50),
            'member_since' => fake()->dateTimeBetween('-1 year', '-1 week'),
        ]);
    }

    /**
     * Create a superadmin user.
     */
    public function superadmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_notifications' => true,
            'push_notifications' => true,
            'member_since' => fake()->dateTimeBetween('-3 years', '-2 years'),
        ]);
    }
}
