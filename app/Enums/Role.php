<?php

namespace App\Enums;

enum Role: string
{
    case SUPERADMIN = 'superadmin';
    case CUSTOMER = 'customer';
    case RIDER = 'rider';
    case RECEIVER = 'receiver';
    case DROP_POINT_KEEPER = 'drop point keeper';
    case CAR_DRIVER = 'car driver';
    case WAREHOUSE_KEEPER = 'warehouse keeper';

    /**
     * Get all role values as an array
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Get role description
     */
    public function description(): string
    {
        return match ($this) {
            self::SUPERADMIN => 'Full access to all admin panel features and system configuration',
            self::CUSTOMER => 'Basic customer role with access to customer portal features',
            self::RECEIVER => 'Receiver role for tracking incoming shipments',
            self::RIDER => 'Mobile rider with API access only (no admin permissions)',
            self::DROP_POINT_KEEPER => 'Drop point keeper with mobile API access for shelf management',
            self::CAR_DRIVER => 'Car driver for transport between drop points and warehouses',
            self::WAREHOUSE_KEEPER => 'Warehouse keeper for processing parcels at warehouse',
        };
    }

    /**
     * Get role platform
     */
    public function platform(): string
    {
        return match ($this) {
            self::SUPERADMIN => 'Admin Portal',
            self::CUSTOMER => 'Customer Portal',
            self::RECEIVER => 'Customer Portal',
            self::RIDER => 'Mobile App',
            self::DROP_POINT_KEEPER => 'Mobile App',
            self::CAR_DRIVER => 'Mobile App',
            self::WAREHOUSE_KEEPER => 'Mobile App',
        };
    }

    /**
     * Check if a role is protected (cannot be deleted)
     */
    public function isProtected(): bool
    {
        return match ($this) {
            self::SUPERADMIN, self::CUSTOMER, self::RIDER, self::DROP_POINT_KEEPER, self::CAR_DRIVER, self::WAREHOUSE_KEEPER => true,
        };
    }
}
