<?php

namespace Tests\Unit;

use App\Models\Shipment;
use App\Support\ShipmentPaymentHelper;
use Tests\TestCase;

class ShipmentPaymentHelperTest extends TestCase
{
    public function test_calculate_payment_details_includes_service_fee_in_subtotal_and_total(): void
    {
        $cacheProperty = new \ReflectionProperty(ShipmentPaymentHelper::class, 'settingsCache');
        $cacheProperty->setAccessible(true);
        $cacheProperty->setValue([
            'financial_settings.platform_fee' => '0',
        ]);

        $shipment = new Shipment([
            'payment_method' => 'cash',
            'payment_status' => 'pending',
            'delivery_fee_payer' => 'sender',
            'return_delivery_fee_payer' => 'receiver',
            'total_fee' => 100,
            'parcel_amount' => 50,
            'service_fee' => 20,
            'insurance_fee' => 10,
            'platform_fee' => 5,
            'vat_amount' => 7,
        ]);

        $details = ShipmentPaymentHelper::calculatePaymentDetails($shipment);

        $this->assertSame(20, $details['service_fee']);
        $this->assertSame(180, $details['subtotal']);
        $this->assertSame(192, $details['total_due']);
        $this->assertSame(192, $details['collectable_total']);
        $this->assertSame(192, $details['total_fee']);

        $cacheProperty->setValue([]);
    }
}
