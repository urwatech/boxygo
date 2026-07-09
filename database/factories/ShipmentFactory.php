<?php

namespace Database\Factories;

use App\Enums\DeliveryStage;
use App\Enums\Role;
use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use App\Models\ShipmentAssignment;
use App\Models\ShipmentStatusDirect;
use App\Models\ShipmentStatusIndirect;
use App\Models\ShipmentStatusHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Shipment>
 */
class ShipmentFactory extends Factory
{
    protected $model = Shipment::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $deliverySpeed = fake()->randomElement(['direct', 'indirect']);
        $size = fake()->randomElement(['small', 'medium', 'large', 'custom']);
        $paymentMethod = fake()->randomElement(['cash', 'online']);

        // Pick status based on delivery type using Enum definitions
        if ($deliverySpeed === 'direct') {
            // Merge PENDING (general) with direct timeline statuses
            $directStatuses = array_map(fn ($s) => $s->value, ShipmentStatus::directStatuses());
            $status = fake()->randomElement(array_merge([
                ShipmentStatus::PENDING->value,
            ], $directStatuses));
        } else {
            // Indirect shipment statuses (timeline only for now)
            $indirectStatuses = array_map(fn ($s) => $s->value, ShipmentStatus::indirectStatuses());
            $status = fake()->randomElement($indirectStatuses);
        }

        // Damascus coordinates
        $pickupLat = fake()->randomFloat(6, 33.48, 33.56);
        $pickupLng = fake()->randomFloat(6, 36.24, 36.36);
        $deliveryLat = fake()->randomFloat(6, 33.48, 33.56);
        $deliveryLng = fake()->randomFloat(6, 36.24, 36.36);

        return [
            'user_id' => User::factory(),
            'rider_id' => null, // Will be assigned later
            'delivery_speed' => $deliverySpeed,
            'consignment_type' => fake()->randomElement(['documents', 'package', 'food', 'electronics', 'clothing']),
            'size' => $size,
            'custom_length' => $size === 'custom' ? fake()->numberBetween(10, 100) : null,
            'custom_width' => $size === 'custom' ? fake()->numberBetween(10, 100) : null,
            'custom_height' => $size === 'custom' ? fake()->numberBetween(10, 100) : null,
            'weight' => fake()->randomFloat(2, 0.5, 25),
            'parcel_amount' => fake()->randomFloat(2, 10, 5000),
            'insurance' => fake()->randomElement(['Yes', 'No']),
            'schedule_time' => fake()->randomElement(['immediate', 'scheduled']),

            // Pickup location
            'handover_address' => fake()->streetAddress() . ', Damascus, Syria',
            'handover_latitude' => $pickupLat,
            'handover_longitude' => $pickupLng,
            'sender_name' => fake()->name(),
            'sender_phone' => '+963' . fake()->numerify('9########'),
            'sender_landmark' => fake()->randomElement(['Near Central Bank', 'Behind Post Office', 'Next to School', 'Opposite Hospital']),
            'sender_building' => 'Building ' . fake()->randomElement(['A', 'B', 'C']) . ', Floor ' . fake()->numberBetween(1, 10),

            // Delivery location
            'delivery_address' => fake()->streetAddress() . ', Damascus, Syria',
            'delivery_latitude' => $deliveryLat,
            'delivery_longitude' => $deliveryLng,
            'receiver_name' => fake()->name(),
            'receiver_phone' => '+963' . fake()->numerify('9########'),
            'receiver_landmark' => fake()->randomElement(['Near City Mall', 'Behind Police Station', 'Next to Pharmacy', 'Opposite Mosque']),
            'receiver_building' => 'Building ' . fake()->randomElement(['1', '2', '3']) . ', Apt ' . fake()->numberBetween(1, 20),

            // Extras
            'accept_returns' => fake()->boolean(30),
            'special_instruction' => fake()->boolean(40) ? fake()->sentence() : null,
            'photos' => fake()->boolean(20) ? ['photo1.jpg', 'photo2.jpg'] : null,
            'additional_docs' => fake()->boolean(10) ? ['doc1.pdf'] : null,

            // Payment
            'payment_method' => $paymentMethod,
            'payment_status' => $status === ShipmentStatus::DELIVERED->value ? 'paid' : 'pending',
            'total_fee' => fake()->randomFloat(2, 5, 100),

            // Status
            'status' => $status,
            'created_at' => fake()->dateTimeBetween('-30 days', 'now'),
        ];
    }

    /**
     * Create a pending shipment (not yet assigned).
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'rider_id' => null,
            'status' => ShipmentStatus::PENDING->value,
            'payment_status' => 'pending',
        ]);
    }

    /**
     * Create an assigned shipment (assigned to a rider but not picked up).
     */
    public function assigned(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ShipmentStatus::ASSIGNED->value,
            'payment_status' => 'pending',
            'delivery_speed' => $attributes['delivery_speed'] ?? 'direct',
        ])->withStatusTracking(1); // Index 1: Assigned
    }

    /**
     * Create a picked up shipment (rider has collected it).
     */
    public function pickedUp(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ShipmentStatus::PICKUP->value,
            'payment_status' => 'pending',
            'delivery_speed' => $attributes['delivery_speed'] ?? 'direct',
        ])->withStatusTracking(2); // Index 2: Pickup
    }

    /**
     * Create an in-transit shipment.
     */
    public function inTransit(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ShipmentStatus::IN_TRANSIT->value,
            'payment_status' => 'pending',
            'delivery_speed' => $attributes['delivery_speed'] ?? 'direct',
        ])->withStatusTracking(3); // Index 3: In Transit
    }

    /**
     * Create an out for delivery shipment.
     */
    public function outForDelivery(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ShipmentStatus::OUT_FOR_DELIVERY->value,
            'payment_status' => 'pending',
            'delivery_speed' => $attributes['delivery_speed'] ?? 'direct',
        ])->withStatusTracking(4); // Index 4: Out for delivery
    }

    /**
     * Create a delivered shipment.
     */
    public function delivered(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ShipmentStatus::DELIVERED->value,
            'payment_status' => $attributes['payment_method'] === 'cash' ? 'paid' : 'paid',
            'delivery_speed' => $attributes['delivery_speed'] ?? 'direct',
        ])->withStatusTracking(5); // Index 5: Delivered
    }

    /**
     * Create a COD (cash on delivery) shipment.
     */
    public function cod(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_method' => 'cash',
            'parcel_amount' => fake()->randomFloat(2, 100, 5000),
        ]);
    }

    /**
     * Create an online payment shipment.
     */
    public function online(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_method' => 'online',
            'payment_status' => fake()->randomElement(['pending', 'paid']),
        ]);
    }

    /**
     * Create a direct delivery shipment.
     */
    public function direct(): static
    {
        return $this->state(fn (array $attributes) => [
            'delivery_speed' => 'direct',
        ]);
    }

    /**
     * Create an indirect delivery shipment.
     */
    public function indirect(): static
    {
        return $this->state(fn (array $attributes) => [
            'delivery_speed' => 'indirect',
        ]);
    }

    /**
     * Assign this shipment to a specific rider.
     */
    public function forRider(User $rider): static
    {
        return $this->state(fn (array $attributes) => [
            'rider_id' => $rider->id,
        ]);
    }

    /**
     * Assign this shipment to a specific customer.
     */
    public function forCustomer(User $customer): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $customer->id,
        ]);
    }

    /**
     * Create status tracking records for direct delivery shipment.
     * This will create ShipmentStatusDirect, ShipmentStatusHistory, and ShipmentAssignment records.
     */
    protected function createDirectStatusTracking(Shipment $shipment, int $targetIndex): void
    {
        // Create the direct status record
        $statusRecord = ShipmentStatusDirect::create([
            'shipment_id' => $shipment->id,
            'current_index' => $targetIndex,
        ]);

        // Create history entries for each stage up to target index
        $baseTime = $shipment->created_at ?? now();
        $directStatuses = ShipmentStatus::directStatuses();

        // Create initial assignment for pickup stage (always created when rider is assigned)
        if ($shipment->rider_id) {
            $pickupAssignment = ShipmentAssignment::create([
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->rider_id,
                'assigned_by_id' => null, // System assignment
                'role' => Role::RIDER->value,
                'stage' => DeliveryStage::PICKUP->value,
                'assigned_at' => $baseTime,
                'started_at' => $targetIndex >= 2 ? $baseTime->copy()->addHours(fake()->numberBetween(0, 2)) : null,
                'completed_at' => $targetIndex >= 2 ? $baseTime->copy()->addHours(fake()->numberBetween(2, 4)) : null,
                'notes' => 'Pickup assignment for direct delivery',
            ]);
        }

        // Create status history entries
        for ($index = 1; $index <= $targetIndex; $index++) {
            $status = $directStatuses[$index];
            $fromStatus = $index > 1 ? $directStatuses[$index - 1]->value : null;

            // Calculate timestamp for this status (staggered timestamps)
            $hoursOffset = ($index - 1) * fake()->numberBetween(1, 4);
            $statusTime = $baseTime->copy()->addHours($hoursOffset);

            ShipmentStatusHistory::create([
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->rider_id,
                'from_status' => $fromStatus,
                'to_status' => $status->value,
                'progress_index' => $index,
                'latitude' => $this->getStatusLatitude($shipment, $index),
                'longitude' => $this->getStatusLongitude($shipment, $index),
                'location_name' => $this->getLocationName($shipment, $index),
                'notes' => $this->getStatusNotes($status),
                'created_at' => $statusTime,
            ]);
        }

        // Create final delivery assignment if delivered
        if ($targetIndex >= 5 && $shipment->rider_id) {
            $deliveryStartTime = $baseTime->copy()->addHours(($targetIndex - 1) * fake()->numberBetween(1, 4));

            ShipmentAssignment::create([
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->rider_id,
                'assigned_by_id' => null,
                'role' => Role::RIDER->value,
                'stage' => DeliveryStage::FINAL_DELIVERY->value,
                'assigned_at' => $deliveryStartTime,
                'started_at' => $deliveryStartTime->copy()->addMinutes(fake()->numberBetween(5, 30)),
                'completed_at' => $deliveryStartTime->copy()->addMinutes(fake()->numberBetween(30, 90)),
                'notes' => 'Final delivery completed successfully',
            ]);
        }
    }

    /**
     * Create status tracking records for indirect delivery shipment.
     * This will create ShipmentStatusIndirect, ShipmentStatusHistory, and ShipmentAssignment records.
     */
    protected function createIndirectStatusTracking(Shipment $shipment, int $targetIndex): void
    {
        // Create the indirect status record
        $statusRecord = ShipmentStatusIndirect::create([
            'shipment_id' => $shipment->id,
            'current_index' => $targetIndex,
        ]);

        // Create history entries for each stage up to target index
        $baseTime = $shipment->created_at ?? now();
        $indirectStatuses = ShipmentStatus::indirectStatuses();

        // Create initial assignment for pickup stage (always created when rider is assigned)
        if ($shipment->rider_id && $targetIndex >= 1) {
            $pickupAssignment = ShipmentAssignment::create([
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->rider_id,
                'assigned_by_id' => null, // System assignment
                'role' => Role::RIDER->value,
                'stage' => DeliveryStage::PICKUP->value,
                'assigned_at' => $baseTime,
                'started_at' => $targetIndex >= 2 ? $baseTime->copy()->addHours(fake()->numberBetween(0, 2)) : null,
                'completed_at' => $targetIndex >= 2 ? $baseTime->copy()->addHours(fake()->numberBetween(2, 4)) : null,
                'notes' => 'Pickup assignment for indirect delivery',
            ]);
        }

        // Create status history entries
        for ($index = 1; $index <= $targetIndex; $index++) {
            $status = $indirectStatuses[$index];
            $fromStatus = $index > 1 ? $indirectStatuses[$index - 1]->value : null;

            // Calculate timestamp for this status (staggered timestamps)
            $hoursOffset = ($index - 1) * fake()->numberBetween(2, 6);
            $statusTime = $baseTime->copy()->addHours($hoursOffset);

            ShipmentStatusHistory::create([
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->rider_id,
                'from_status' => $fromStatus,
                'to_status' => $status->value,
                'progress_index' => $index,
                'latitude' => $this->getIndirectStatusLatitude($shipment, $index),
                'longitude' => $this->getIndirectStatusLongitude($shipment, $index),
                'location_name' => $this->getIndirectLocationName($shipment, $index),
                'notes' => $this->getIndirectStatusNotes($status),
                'created_at' => $statusTime,
            ]);
        }

        // Create final delivery assignment if picked up by receiver
        if ($targetIndex >= 10 && $shipment->rider_id) {
            $deliveryStartTime = $baseTime->copy()->addHours(($targetIndex - 1) * fake()->numberBetween(2, 6));

            ShipmentAssignment::create([
                'shipment_id' => $shipment->id,
                'user_id' => $shipment->rider_id,
                'assigned_by_id' => null,
                'role' => Role::RIDER->value,
                'stage' => DeliveryStage::FINAL_DELIVERY->value,
                'assigned_at' => $deliveryStartTime,
                'started_at' => $deliveryStartTime->copy()->addMinutes(fake()->numberBetween(5, 30)),
                'completed_at' => $deliveryStartTime->copy()->addMinutes(fake()->numberBetween(30, 90)),
                'notes' => 'Package picked up by receiver',
            ]);
        }
    }

    /**
     * Get latitude based on status index for direct delivery
     */
    protected function getStatusLatitude(Shipment $shipment, int $index): ?float
    {
        return match($index) {
            1, 2 => $shipment->handover_latitude, // Assigned, Pickup - at pickup location
            5 => $shipment->delivery_latitude, // Delivered - at delivery location
            default => fake()->randomFloat(6, 33.48, 33.56), // In transit/out for delivery - random
        };
    }

    /**
     * Get longitude based on status index for direct delivery
     */
    protected function getStatusLongitude(Shipment $shipment, int $index): ?float
    {
        return match($index) {
            1, 2 => $shipment->handover_longitude, // Assigned, Pickup - at pickup location
            5 => $shipment->delivery_longitude, // Delivered - at delivery location
            default => fake()->randomFloat(6, 36.24, 36.36), // In transit/out for delivery - random
        };
    }

    /**
     * Get location name based on status index for direct delivery
     */
    protected function getLocationName(Shipment $shipment, int $index): ?string
    {
        return match($index) {
            1 => 'Shipment assigned to rider',
            2 => 'Picked up from sender: ' . $shipment->handover_address,
            3 => 'In transit to delivery location',
            4 => 'Out for delivery in ' . $this->extractCity($shipment->delivery_address),
            5 => 'Delivered to: ' . $shipment->delivery_address,
            default => null,
        };
    }

    /**
     * Get latitude based on status index for indirect delivery
     */
    protected function getIndirectStatusLatitude(Shipment $shipment, int $index): ?float
    {
        $finalIndex = count(ShipmentStatus::indirectStatuses());
        if (in_array($index, [1, 2], true)) {
            return $shipment->handover_latitude;
        }
        if ($index === $finalIndex) {
            return $shipment->delivery_latitude;
        }
        return fake()->randomFloat(6, 33.48, 33.56);
    }

    /**
     * Get longitude based on status index for indirect delivery
     */
    protected function getIndirectStatusLongitude(Shipment $shipment, int $index): ?float
    {
        $finalIndex = count(ShipmentStatus::indirectStatuses());
        if (in_array($index, [1, 2], true)) {
            return $shipment->handover_longitude;
        }
        if ($index === $finalIndex) {
            return $shipment->delivery_longitude;
        }
        return fake()->randomFloat(6, 36.24, 36.36);
    }

    /**
     * Get location name based on status index for indirect delivery
     */
    protected function getIndirectLocationName(Shipment $shipment, int $index): ?string
    {
        return match($index) {
            1 => 'Shipment assigned to rider',
            2 => 'Picked up from sender: ' . $shipment->handover_address,
            3 => 'In transit to first drop point',
            4 => 'Arrived at first drop point',
            5 => 'Delivered to first drop point keeper',
            6 => 'Dispatched to warehouse',
            7 => 'Pickup from drop point 1',
            8 => 'In transit to warehouse',
            9 => 'Arrived at warehouse',
            10 => 'Dispatched from warehouse',
            11 => 'Pickup from warehouse',
            12 => 'In transit to second drop point',
            13 => 'Arrived at second drop point in ' . $this->extractCity($shipment->delivery_address),
            14 => 'Ready for pickup at drop point',
            15 => 'Picked up by receiver',
            default => null,
        };
    }

    /**
     * Extract city from address
     */
    protected function extractCity(string $address): string
    {
        $parts = explode(',', $address);
        return trim($parts[1] ?? 'Damascus');
    }

    /**
     * Get status notes for direct delivery
     */
    protected function getStatusNotes(ShipmentStatus $status): ?string
    {
        return match($status) {
            ShipmentStatus::ASSIGNED => 'Shipment has been assigned to a rider',
            ShipmentStatus::PICKUP => fake()->boolean(70) ? 'Package collected from sender' : null,
            ShipmentStatus::IN_TRANSIT => fake()->boolean(50) ? 'Package is on the way' : null,
            ShipmentStatus::OUT_FOR_DELIVERY => fake()->boolean(60) ? 'Package is out for final delivery' : null,
            ShipmentStatus::DELIVERED => fake()->randomElement([
                'Package delivered successfully',
                'Delivered to receiver',
                'Left at front door',
                'Handed to receiver',
                null
            ]),
            default => null,
        };
    }

    /**
     * Get status notes for indirect delivery
     */
    protected function getIndirectStatusNotes(ShipmentStatus $status): ?string
    {
        return match($status) {
            ShipmentStatus::ASSIGNED => 'Shipment has been assigned to a rider',
            ShipmentStatus::PICKUP => fake()->boolean(70) ? 'Package collected from sender' : null,
            ShipmentStatus::ARRIVED_AT_DROP_POINT_1 => fake()->boolean(60) ? 'Package arrived at first drop point' : null,
            ShipmentStatus::DELIVERED_TO_DROP_POINT_1 => fake()->boolean(60) ? 'Package handed to drop point keeper' : null,
            ShipmentStatus::DISPATCHED_TO_WAREHOUSE => fake()->boolean(50) ? 'Package dispatched to warehouse' : null,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE => fake()->boolean(60) ? 'Package arrived at warehouse' : null,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE => fake()->boolean(50) ? 'Package dispatched from warehouse' : null,
            ShipmentStatus::ARRIVED_AT_DROP_POINT_2 => fake()->boolean(60) ? 'Package arrived at second drop point' : null,
            ShipmentStatus::READY_FOR_PICKUP => fake()->randomElement([
                'Package is ready for pickup',
                'Receiver can collect the package',
                null
            ]),
            ShipmentStatus::PICKED_UP_BY_RECEIVER => fake()->randomElement([
                'Package picked up by receiver',
                'Delivery completed',
                'Receiver collected the package',
                null
            ]),
            ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2 => fake()->boolean(60) ? 'Package dispatched for door delivery' : null,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_2 => fake()->boolean(60) ? 'Car driver picked up from drop point 2' : null,
            ShipmentStatus::IN_TRANSIT_TO_CUSTOMER => fake()->boolean(60) ? 'Driver en route to customer' : null,
            default => null,
        };
    }

    /**
     * Configure this factory to create status tracking after the model is created.
     */
    public function withStatusTracking(int $targetIndex = 1): static
    {
        return $this->afterCreating(function (Shipment $shipment) use ($targetIndex) {
            if ($shipment->delivery_speed === 'direct') {
                $this->createDirectStatusTracking($shipment, $targetIndex);
            } elseif ($shipment->delivery_speed === 'indirect') {
                $this->createIndirectStatusTracking($shipment, $targetIndex);
            }
        });
    }
}
