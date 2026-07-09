<?php

namespace App\Enums;

enum DeliveryStage: string
{
    // Initial pickup from sender
    case PICKUP = 'pickup';

    // First drop point (for indirect delivery)
    case FIRST_DROP_POINT = 'first_drop_point';

    // Transport from first drop point to warehouse
    case TO_WAREHOUSE = 'to_warehouse';

    // Warehouse processing
    case WAREHOUSE = 'warehouse';

    // Transport from warehouse 1 to warehouse 2
    case TO_WAREHOUSE_2 = 'to_warehouse_2';

    // Warehouse 2 processing
    case WAREHOUSE_2 = 'warehouse_2';

    // Transport from warehouse to second drop point
    case TO_SECOND_DROP_POINT = 'to_second_drop_point';

    // Second drop point
    case SECOND_DROP_POINT = 'second_drop_point';

    // Final delivery to receiver
    case FINAL_DELIVERY = 'final_delivery';

    /**
     * Get human-readable label for the stage
     */
    public function label(): string
    {
        return match($this) {
            self::PICKUP => 'Pickup from Sender',
            self::FIRST_DROP_POINT => 'First Drop Point',
            self::TO_WAREHOUSE => 'Transit to Warehouse',
            self::WAREHOUSE => 'Warehouse',
            self::TO_WAREHOUSE_2 => 'Transit to Warehouse 2',
            self::WAREHOUSE_2 => 'Warehouse 2',
            self::TO_SECOND_DROP_POINT => 'Transit to Second Drop Point',
            self::SECOND_DROP_POINT => 'Second Drop Point',
            self::FINAL_DELIVERY => 'Final Delivery',
        };
    }

    /**
     * Get all stages for direct delivery
     */
    public static function directDeliveryStages(): array
    {
        return [
            self::PICKUP,
            self::FINAL_DELIVERY,
        ];
    }

    /**
     * Get all stages for indirect delivery (door-to-door)
     */
    public static function indirectDeliveryStages(): array
    {
        return [
            self::PICKUP,
            self::FIRST_DROP_POINT,
            self::TO_WAREHOUSE,
            self::WAREHOUSE,
            self::TO_WAREHOUSE_2,
            self::WAREHOUSE_2,
            self::TO_SECOND_DROP_POINT,
            self::SECOND_DROP_POINT,
            self::FINAL_DELIVERY,
        ];
    }
}
