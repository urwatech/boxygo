<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MockPaymentController extends Controller
{
    /**
     * Show the mock payment page.
     */
    public function show(Shipment $shipment): Response
    {
        return Inertia::render('Customer/MockPayment', [
            'shipment' => $shipment->load('size'),
        ]);
    }

    /**
     * Process the mock payment.
     */
    public function process(Request $request, Shipment $shipment)
    {
        $updates = [
            'rdf_payment_status' => 'paid',
            'rdf_paid_at' => now(),
        ];

        if ($shipment->delivery_fee_payer === 'receiver' && $shipment->payment_method === 'online') {
            $updates['payment_status'] = 'paid';
        }

        $shipment->update($updates);

        return redirect()->route('customer.shipments.index', ['role' => 'receiver'])
            ->with('success', __('returnDeliveryFeePaidSuccessfully'));
    }
}
