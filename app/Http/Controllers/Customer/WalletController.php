<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\ShipmentServiceInterface;
use App\Http\Controllers\Controller;
use App\Services\WalletService;
use App\Support\ShipmentPaymentHelper;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WalletController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly ShipmentServiceInterface $shipmentService,
    ) {}

    /**
     * Display the customer wallet page.
     */
    public function index(Request $request): Response
    {
        $perPage = (int) ($request->integer('per_page') ?: 10);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 10;
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));

        $user = $request->user();
        $wallet = $this->walletService->getOrCreateWallet($user->id);

        // Summary card values
        $totalBalance = (float) $wallet->balance;
        $onHold = (float) $wallet->held_balance;

        $pending = 0;

        $compensation = 0;

        $shipments = $this->shipmentService->getUserAllShipments($user->id, $perPage, 'shipment');

        $shipments->setCollection(
            $shipments->getCollection()
                ->map(function ($shipment) use (&$compensation, &$pending) {

                    $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);

                    $shipment->returned_shipment = $shipment->shipment_id !== null
                        ? $this->shipmentService->find($shipment->shipment_id)
                        : null;

                    if ($shipment->role == 'sender') {

                        $shipment['rdf_payment_status'] =
                            ($shipment->return_delivery_fee_payer == 'sender' && $shipment->sender_payment_status == 'paid')
                            ? 'paid'
                            : (($shipment->return_delivery_fee_payer == 'sender' && $shipment->sender_payment_status == 'pending')
                                ? 'pending'
                                : null);

                        $shipment['sender_receive_payment_status'] = $shipment->sender_receive_payment_status;

                        $shipment['rdf_amount'] = $shipment->return_delivery_fee_payer != 'sender' ? null : $shipment->rdf_amount;
                        $shipment['rdf_payment_status'] = $shipment->return_delivery_fee_payer != 'sender' ? null : $shipment->rdf_payment_status;

                        if ($shipment->sender_receive_payment_status != 'released' && $shipment->sender_receive_payment_status != 'held') {
                            $pending += $shipment->parcel_amount;
                        }

                        if ($shipment->payment_method == 'online' && $shipment->sender_receive_payment_status != 'released') {
                            $compensation += $shipment->componsation_amount;
                        }
                    } else {
                        if ($shipment->sender_receive_payment_status != 'released' && $shipment->componsation_status != 'draft') {
                            $compensation += (($shipment->parcel_amount) - $shipment->componsation_amount);
                        }

                        $shipment['rdf_payment_status'] =
                            ($shipment->return_delivery_fee_payer == 'sender' && $shipment->sender_payment_status == 'paid')
                            ? 'paid'
                            : (($shipment->return_delivery_fee_payer == 'sender' && $shipment->sender_payment_status == 'pending')
                                ? 'pending'
                                : null);
                        $shipment['rdf_amount'] = $shipment->return_delivery_fee_payer == 'sender' ? null : $shipment->rdf_amount;
                        $shipment['rdf_payment_status'] = $shipment->return_delivery_fee_payer == 'sender' ? null : $shipment->rdf_payment_status;

                        $shipment['sender_receive_payment_status'] =
                            $shipment->sender_receive_payment_status == 'released'
                            ? 'released'
                            : ($shipment->sender_receive_payment_status == 'held'
                                ? 'pending'
                                : 'released');

                        if ($shipment->sender_receive_payment_status != 'released') {
                            $pending += $shipment->parcel_amount;
                        }
                    }

                    return $shipment;
                })
                ->values()
        );

        return Inertia::render('Customer/Wallet', [
            'totalBalance' => $totalBalance,
            'onHold' => $onHold,
            'pending' => $pending,
            'compensation' => $compensation,
            'shipments' => $shipments,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', 'all'),
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }
}
