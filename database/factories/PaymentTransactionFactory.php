<?php

namespace Database\Factories;

use App\Models\PaymentTransaction;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PaymentTransaction>
 */
class PaymentTransactionFactory extends Factory
{
    protected $model = PaymentTransaction::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $transactionType = fake()->randomElement(['rider_collection', 'admin_settlement']);
        $collectedAt = fake()->dateTimeBetween('-30 days', 'now');

        return [
            'shipment_id' => Shipment::factory(),
            'rider_id' => User::factory(),
            'transaction_type' => $transactionType,
            'amount' => fake()->randomFloat(2, 50, 5000),
            'payment_method' => 'cash',
            'status' => 'completed',
            'notes' => $transactionType === 'rider_collection'
                ? 'Cash collected from customer'
                : 'Cash collected from rider by admin',
            'collected_at' => $collectedAt,
            'settled_at' => $transactionType === 'admin_settlement'
                ? fake()->dateTimeBetween($collectedAt, 'now')
                : null,
            'collected_by' => $transactionType === 'admin_settlement'
                ? User::factory()
                : null,
        ];
    }

    /**
     * Create a rider collection transaction (rider collects from customer).
     */
    public function riderCollection(): static
    {
        return $this->state(fn (array $attributes) => [
            'transaction_type' => 'rider_collection',
            'notes' => 'Cash collected from customer',
            'collected_at' => fake()->dateTimeBetween('-30 days', 'now'),
            'settled_at' => null,
            'collected_by' => null,
        ]);
    }

    /**
     * Create an admin settlement transaction (admin collects from rider).
     */
    public function adminSettlement(): static
    {
        $collectedAt = fake()->dateTimeBetween('-30 days', '-1 day');

        return $this->state(fn (array $attributes) => [
            'transaction_type' => 'admin_settlement',
            'notes' => 'Cash collected from rider by admin',
            'collected_at' => $collectedAt,
            'settled_at' => fake()->dateTimeBetween($collectedAt, 'now'),
        ]);
    }

    /**
     * Create a pending transaction (not yet settled with admin).
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'transaction_type' => 'rider_collection',
            'status' => 'completed',
            'collected_at' => fake()->dateTimeBetween('-7 days', 'now'),
            'settled_at' => null,
            'collected_by' => null,
        ]);
    }

    /**
     * Create an overdue transaction (collected more than 7 days ago, not settled).
     */
    public function overdue(): static
    {
        return $this->state(fn (array $attributes) => [
            'transaction_type' => 'rider_collection',
            'status' => 'completed',
            'collected_at' => fake()->dateTimeBetween('-30 days', '-8 days'),
            'settled_at' => null,
            'collected_by' => null,
        ]);
    }

    /**
     * Create a settled transaction (rider collected and admin settled).
     */
    public function settled(): static
    {
        $collectedAt = fake()->dateTimeBetween('-30 days', '-1 day');

        return $this->state(fn (array $attributes) => [
            'transaction_type' => 'rider_collection',
            'status' => 'completed',
            'collected_at' => $collectedAt,
            'settled_at' => fake()->dateTimeBetween($collectedAt, 'now'),
        ]);
    }

    /**
     * Create an online payment transaction.
     */
    public function online(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_method' => 'online',
            'transaction_type' => 'rider_collection',
            'notes' => 'Online payment processed',
            'status' => 'completed',
        ]);
    }
}
