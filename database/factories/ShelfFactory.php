<?php

namespace Database\Factories;

use App\Models\Shelf;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Shelf>
 */
class ShelfFactory extends Factory
{
    protected $model = Shelf::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $capacity = fake()->numberBetween(10, 100);
        $occupiedSlots = fake()->numberBetween(0, $capacity);

        return [
            'code' => 'SHF-' . fake()->unique()->bothify('??###'),
            'location' => fake()->randomElement(['Zone A', 'Zone B', 'Zone C']) . ' - Row ' . fake()->numberBetween(1, 10),
            'capacity' => $capacity,
            'occupied_slots' => $occupiedSlots,
            'is_active' => fake()->boolean(90),
        ];
    }

    /**
     * Indicate the shelf is currently full.
     */
    public function full(): static
    {
        return $this->state(fn (array $attributes) => [
            'occupied_slots' => $attributes['capacity'] ?? fake()->numberBetween(10, 100),
        ]);
    }

    /**
     * Indicate the shelf is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
