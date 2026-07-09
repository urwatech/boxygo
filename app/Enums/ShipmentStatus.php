<?php

namespace App\Enums;

enum ShipmentStatus: string
{
    // General statuses
    case PENDING = 'Pending';

    // Direct delivery statuses (5 stages)
    case ASSIGNED = 'Assigned';
    case PICKUP = 'Pickup';
    case IN_TRANSIT = 'In Transit';
    // Label changed as per product copy, slug remains 'out_for_delivery'
    case OUT_FOR_DELIVERY = 'Arrived at Drop Point';
    case DELIVERED = 'Delivered';
    case COMPLETED = 'completed';
    case COMPENSATION_REQEUSTED = 'Compensation requesting';
    case COMPENSATION_APPROVED = 'Compensation approved';
    case COMPENSATION_REJECTED = 'Compensation rejected';

    // Indirect delivery statuses
    case ARRIVED_AT_DROP_POINT_1 = 'Arrived at Drop Point 1';
    case DELIVERED_TO_DROP_POINT_1 = 'Delivered to Drop Point 1';
    case PICKUP_FROM_DROP_POINT_1 = 'Pickup from Drop Point 1';
    case IN_TRANSIT_TO_WAREHOUSE = 'In Transit to Warehouse';
    case DISPATCHED_TO_WAREHOUSE = 'Dispatched to Warehouse';
    case ARRIVED_AT_WAREHOUSE = 'Arrived at Warehouse';
    case PICKUP_FROM_WAREHOUSE = 'Pickup from Warehouse';
    case IN_TRANSIT_TO_WAREHOUSE_2 = 'In Transit to Warehouse 2';
    case ARRIVED_AT_WAREHOUSE_2 = 'Arrived at Warehouse 2';
    case DISPATCHED_FROM_WAREHOUSE_2 = 'Dispatched from Warehouse 2';
    case PICKUP_FROM_WAREHOUSE_2 = 'Pickup from Warehouse 2';
    case IN_TRANSIT_TO_DROP_POINT_2 = 'In Transit to Drop Point 2';
    case DISPATCHED_FROM_WAREHOUSE = 'Dispatched from Warehouse';
    case ARRIVED_AT_DROP_POINT_2 = 'Arrived at Drop Point 2';
    case DISPATCHED_FROM_DROP_POINT_2 = 'Dispatched from Drop Point 2';
    case PICKUP_FROM_DROP_POINT_2 = 'Pickup from Drop Point 2';
    case IN_TRANSIT_TO_CUSTOMER = 'In Transit to Customer';
    case READY_FOR_PICKUP = 'Ready for Pickup';
    case PICKED_UP_BY_RECEIVER = 'Picked up by Receiver';
    case PENDING_HANDOVER = 'Pending Handover';
    case INCOMPLETE_COLLECTED = 'Incomplete Collected';

    // Additional general statuses used by APIs (not part of indexed timelines)
    case PICKED_UP = 'Picked up';

    // Failure statuses
    case CANCELLED = 'Cancelled';
    case INCOMPLETE = 'Incomplete';
    case CANCELLED_DRIVER = 'Cancelled Driver';
    case CANCELLED_KEEPER = 'Cancelled Keeper';
    case FAILED = 'Failed';
    case RETURNED = 'Returned';
    case NOT_RETURNED = 'Not Returned';

    /**
     * Get all statuses for direct delivery in order
     *
     * @return array<int, self>
     */
    public static function directStatuses(): array
    {
        return [
            1 => self::ASSIGNED,
            2 => self::PICKUP,
            3 => self::IN_TRANSIT,
            4 => self::OUT_FOR_DELIVERY,
            5 => self::DELIVERED,
        ];
    }

    /**
     * Get all statuses for indirect delivery in order
     *
     * Correct flow:
     * 1. Rider: Pickup → In Transit → Arrives at Drop Point 1
     * 2. Keeper: Dispatches to Warehouse
     * 3. Car Driver: Picks up from DP1 → In Transit → Arrives at Warehouse
     * 4. Warehouse Keeper: Dispatches from Warehouse
     * 5. Car Driver: Picks up from Warehouse → In Transit → Arrives at Drop Point 2
     * 6. Keeper: Ready for Pickup → Picked up by Receiver
     * 7. Optional Door-to-Door: DP2 Keeper Dispatches → Driver picks up → In Transit to Customer → Delivered
     *
     * @return array<int, self>
     */
    public static function indirectStatuses(): array
    {
        return [
            1 => self::ASSIGNED,
            2 => self::PICKUP,                      // Rider picks up from sender
            3 => self::IN_TRANSIT,                  // Rider in transit to drop point 1
            4 => self::ARRIVED_AT_DROP_POINT_1,     // Rider arrives at drop point 1
            5 => self::DELIVERED_TO_DROP_POINT_1,   // Rider confirms handoff to drop point 1
            6 => self::DISPATCHED_TO_WAREHOUSE,     // Keeper dispatches to warehouse
            7 => self::PICKUP_FROM_DROP_POINT_1,    // Car driver picks up from drop point 1
            8 => self::IN_TRANSIT_TO_WAREHOUSE,     // Car driver in transit to warehouse
            9 => self::ARRIVED_AT_WAREHOUSE,        // Car driver arrives at warehouse
            10 => self::DISPATCHED_FROM_WAREHOUSE,  // Warehouse keeper dispatches
            11 => self::PICKUP_FROM_WAREHOUSE,      // Car driver picks up from warehouse
            12 => self::IN_TRANSIT_TO_WAREHOUSE_2,  // Car driver 2 in transit to warehouse 2
            13 => self::ARRIVED_AT_WAREHOUSE_2,     // Car driver 2 arrives at warehouse 2
            14 => self::DISPATCHED_FROM_WAREHOUSE_2, // Warehouse keeper 2 dispatches
            15 => self::PICKUP_FROM_WAREHOUSE_2,    // Car driver 3 picks up from warehouse 2
            16 => self::IN_TRANSIT_TO_DROP_POINT_2, // Car driver 3 in transit to drop point 2
            17 => self::ARRIVED_AT_DROP_POINT_2,    // Car driver arrives at drop point 2
            18 => self::READY_FOR_PICKUP,           // Keeper marks ready for receiver
            19 => self::PICKED_UP_BY_RECEIVER,      // Receiver picks up (final for pickup flow)
            20 => self::DISPATCHED_FROM_DROP_POINT_2, // Keeper dispatches for door delivery
            21 => self::PICKUP_FROM_DROP_POINT_2,   // Car driver picks up from drop point 2
            22 => self::IN_TRANSIT_TO_CUSTOMER,     // Car driver en route to customer
            23 => self::DELIVERED,                  // Delivered to receiver (door to door)
        ];
    }

    /**
     * Get the status at a specific index for direct delivery
     *
     * @param int $index
     * @return self|null
     */
    public static function getDirectStatusByIndex(int $index): ?self
    {
        return self::directStatuses()[$index] ?? null;
    }

    /**
     * Get the status at a specific index for indirect delivery
     *
     * @param int $index
     * @return self|null
     */
    public static function getIndirectStatusByIndex(int $index): ?self
    {
        return self::indirectStatuses()[$index] ?? null;
    }

    /**
     * Get the index of a status in direct delivery flow
     *
     * @return int|null
     */
    public function getDirectIndex(): ?int
    {
        $statuses = self::directStatuses();
        return array_search($this, $statuses, true) ?: null;
    }

    /**
     * Get the index of a status in indirect delivery flow
     *
     * @return int|null
     */
    public function getIndirectIndex(): ?int
    {
        $statuses = self::indirectStatuses();
        return array_search($this, $statuses, true) ?: null;
    }

    /**
     * Check if this is a final status
     *
     * @return bool
     */
    public function isFinal(): bool
    {
        return in_array($this, [
            self::DELIVERED,
            self::PICKED_UP_BY_RECEIVER,
            self::CANCELLED,
            self::FAILED,
            self::RETURNED,
        ], true);
    }

    /**
     * Check if this is a failure status
     *
     * @return bool
     */
    public function isFailure(): bool
    {
        return in_array($this, [
            self::CANCELLED,
            self::FAILED,
            self::RETURNED,
        ], true);
    }

    /**
     * Check if this status is part of direct delivery flow
     *
     * @return bool
     */
    public function isDirectStatus(): bool
    {
        return in_array($this, self::directStatuses(), true);
    }

    /**
     * Check if this status is part of indirect delivery flow
     *
     * @return bool
     */
    public function isIndirectStatus(): bool
    {
        return in_array($this, self::indirectStatuses(), true);
    }

    /**
     * Get the label (same as value for this enum)
     *
     * @return string
     */
    public function label(): string
    {
        return $this->value;
    }

    /**
     * Get a slug version (lowercase with underscores)
     * Useful for matching with old database values
     *
     * @return string
     */
    public function slug(): string
    {
        // Canonical slug for this status set
        if ($this === self::OUT_FOR_DELIVERY) {
            // New canonical slug
            return 'arrived_at_drop_point';
        }
        return strtolower(str_replace(' ', '_', $this->value));
    }

    /**
     * Get status from slug
     *
     * @param string $slug
     * @return self|null
     */
    public static function fromSlug(string $slug): ?self
    {
        $slug = strtolower($slug);
        // Backward compatibility for historical slug
        if ($slug === 'out_for_delivery') {
            return self::OUT_FOR_DELIVERY;
        }
        foreach (self::cases() as $status) {
            if ($status->slug() === $slug) {
                return $status;
            }
        }
        return null;
    }
}
