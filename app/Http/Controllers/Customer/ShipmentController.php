<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\ShipmentServiceInterface;
use App\Enums\ShipmentStatus;
use App\Helpers\helpers;
use App\Services\WalletService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\Shipment\CompensationStatusRequest;
use App\Http\Requests\Customer\Shipment\CompensationStoreRequest;
use App\Http\Requests\Customer\Shipment\CreateShipmentStoreRequest;
use App\Http\Requests\Customer\Shipment\ShipmentReturnStoreRequest;
use App\Models\City;
use App\Models\Shipment;
use App\Support\FinancialSettings;
use App\Notifications\ShipmentCreatedNotification;
use App\Services\MtnSmsService;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Notifications\ShipmentCompensationAcceptedNotification;
use App\Notifications\ShipmentCompensationRejectedNotification;
use App\Notifications\ShipmentCompensationRequestNotification;
use App\Notifications\ShipmentCompensationReturnedSuccessNotification;
use App\Notifications\ShipmentReturnCreatedNotification;
use App\Notifications\ShipmentReturnRDFDeductNotification;
use App\Services\UserService;
use App\Support\ShipmentPaymentHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class ShipmentController extends Controller
{
    public function __construct(
        private readonly ShipmentServiceInterface $shipmentService,
        private readonly WalletService $walletService,
        private readonly UserService $userService,
    ) {}

    /**
     * Display a listing of shipments.
     *
     * @param Request $request
     * @return Response
     */
    public function index(Request $request): Response
    {
        $perPage = (int) ($request->integer('per_page') ?: 10);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 10;
        $role = $request->query('role');
        $booking_type = 'shipment';
        $user = $request->user();

        if ($role === 'receiver') {
            $phone = $user->phone_number ?? '';
            $email = $user->email ?? '';
            $shipments = $this->shipmentService->getReceiverShipments(
                $phone,
                $email,
                $perPage,
                $booking_type
            );
        } else {
            $shipments = $this->shipmentService->getUserShipments($user->id, $perPage, false);
        }

        // Add payment details and RDF link to each shipment
        foreach ($shipments as $shipment) {
            $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);

            // Add RDF payment link for receiver if pending
            if (
                $role === 'receiver' &&
                $shipment->accept_returns &&
                $shipment->return_delivery_fee_payer === 'receiver' &&
                ($shipment->rdf_payment_status ?? 'pending') === 'pending'
            ) {
                $shipment->rdf_payment_link = route('customer.mock-payment.show', $shipment);
            }
        }

        return Inertia::render('Customer/SendingParcels', [
            'shipments' => $shipments,
            'filters' => [
                'search' => $request->query('search'),
                'status' => $request->query('status'),
                'role' => $role,
                'per_page' => $perPage,
            ],
            'receiverMode' => $role === 'receiver',
            'financialSettings' => $this->getFinancialSettings(),
            'cities' => City::select('name', 'short_code', 'latitude', 'longitude')->get(),
            'paymentStatus' => $this->resolvePaymentStatus($request),
        ]);
    }

    public function sending_parcels(Request $request): Response
    {
        $perPage = (int) ($request->integer('per_page') ?: 10);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 10;
        $booking_type = 'shipment';
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));
        $user = $request->user();

        $shipments = $this->shipmentService->getUserShipments($user->id, $perPage, true, true, $search, $status, $sortBy, $sortDir);

        // Add payment details and RDF link to each shipment
        foreach ($shipments as $shipment) {
            $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);
        }

        return Inertia::render('Customer/SendingParcels', [
            'shipments' => $shipments,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
                'role' => 'sender',
                'per_page' => $perPage,
            ],
            'receiverMode' => false,
            'financialSettings' => $this->getFinancialSettings(),
            'cities' => City::select('name', 'short_code', 'latitude', 'longitude')->get(),
            'paymentStatus' => $this->resolvePaymentStatus($request),
        ]);
    }

    public function receiving_parcels(Request $request): Response
    {
        $perPage = (int) ($request->integer('per_page') ?: 10);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 10;
        $booking_type = 'shipment';
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));
        $user = $request->user();

        $shipments = $this->shipmentService->getReceivedShipments($user->id, $perPage, $booking_type, $search, $status, $sortBy, $sortDir);
        // Add payment details and RDF link to each shipment
        foreach ($shipments as $shipment) {
            $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);
            $shipment->employees = helpers::getShipmentUsers($shipment->id);
            // Add RDF payment link for receiver if pending
            if (
                $shipment->accept_returns &&
                $shipment->return_delivery_fee_payer === 'receiver' &&
                ($shipment->rdf_payment_status ?? 'pending') === 'pending'
            ) {
                $shipment->rdf_payment_link = route('customer.mock-payment.show', $shipment);
            }
        }

        return Inertia::render('Customer/ReceivingParcels', [
            'shipments' => $shipments,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
                'role' => 'receiver',
                'per_page' => $perPage,
            ],
            'receiverMode' => true,
            'financialSettings' => $this->getFinancialSettings(),
            'cities' => City::select('name', 'short_code', 'latitude', 'longitude')->get(),
            'paymentStatus' => $this->resolvePaymentStatus($request),
        ]);
    }

    public function sending_parcels_show(Request $request, Shipment $shipment): Response
    {
        $user = $request->user();
        abort_unless($user && (int) $shipment->user_id === (int) $user->id, 404);

        // Eager-load relationships used by the React detail view
        $shipment->load([
            'size',
            'directStatus',
            'indirectStatus',
            'review',
            'statusHistory' => fn($q) => $q->with(['user:id,name'])->orderBy('created_at', 'asc'),
        ]);

        // Add payment details to selected shipment
        $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);
        $shipment->employees = helpers::getShipmentUsers($shipment->id);
        $shipment->returned_shipment = $shipment->shipment_id !== null ? $this->shipmentService->find($shipment->shipment_id)->load([
            'size',
            'directStatus',
            'indirectStatus',
            'review',
            'statusHistory' => fn($q) => $q->with(['user:id,name'])->orderBy('created_at', 'asc'),
        ]) : null;
        return Inertia::render('Customer/SendingParcels', [
            'shipments' => [],
            'filters' => [
                'search' => $request->query('search'),
                'status' => $request->query('status'),
                'per_page' => 0,
            ],
            'selectedShipment' => $shipment,
            'financialSettings' => $this->getFinancialSettings(),
            'cities' => City::select('name', 'short_code', 'latitude', 'longitude')->get(),
            'paymentStatus' => $this->resolvePaymentStatus($request),
        ]);
    }

    public function receiving_parcels_show(Request $request, Shipment $shipment): Response
    {
        $user = $request->user();
        abort_unless($user && (int) $shipment->receiver_id === (int) $user->id, 404);

        // Eager-load relationships used by the React detail view
        $shipment->load([
            'size',
            'directStatus',
            'indirectStatus',
            'review',
            'statusHistory' => fn($q) => $q->with(['user:id,name'])->orderBy('created_at', 'asc'),
        ]);

        // Add payment details to selected shipment
        $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);

        $shipment->returned_shipment = $shipment->shipment_id !== null ? $this->shipmentService->find($shipment->shipment_id)->load([
            'size',
            'directStatus',
            'indirectStatus',
            'review',
            'statusHistory' => fn($q) => $q->with(['user:id,name'])->orderBy('created_at', 'asc'),
        ]) : null;
        return Inertia::render('Customer/ReceivingParcels', [
            'shipments' => [],
            'filters' => [
                'search' => $request->query('search'),
                'status' => $request->query('status'),
                'per_page' => 0,
            ],
            'selectedShipment' => $shipment,
            'financialSettings' => $this->getFinancialSettings(),
            'cities' => City::select('name', 'short_code', 'latitude', 'longitude')->get(),
            'paymentStatus' => $this->resolvePaymentStatus($request),
        ]);
    }

    public function shipment_paynow(Request $request)
    {
        $request->validate([
            'shipment_id' => 'required|integer|exists:shipments,id',
            'from' => 'required|in:receiver,reciever,sender',
            'payment_method' => 'nullable|string|in:cash,online',
            'payment_for' => 'nullable|string|in:receiver_delivery,return_delivery',
        ]);

        $shipment = $this->shipmentService->find((int) $request->shipment_id);
        if (!$shipment) {
            return response()->json([
                'success' => false,
                'message' => __('commonShipmentNotFound'),
            ], JsonResponse::HTTP_NOT_FOUND);
        }

        $from = strtolower((string) $request->input('from'));
        if ($from === 'reciever') {
            $from = 'receiver';
        }
        $paymentFor = $request->input('payment_for') === 'return_delivery'
            ? 'return_delivery'
            : 'receiver_delivery';
        $paymentMethod = strtolower((string) $request->input('payment_method', ''));

        $smsService = app(MtnSmsService::class);
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => __('unauthorized'),
            ], JsonResponse::HTTP_FORBIDDEN);
        }

        $locale = strtolower((string) ($user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

        if ($from === 'sender') {
            if ((int) $shipment->user_id !== (int) $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => __('youAreNotAllowedToPayThisShipmentAsSender'),
                ], JsonResponse::HTTP_FORBIDDEN);
            }

            $alreadyPaid = strtolower((string) $shipment->sender_payment_status) === 'paid';
            if (!$alreadyPaid) {
                $shipment->sender_payment_status = 'paid';
                $shipment->save();

                $receiver = User::find($shipment->receiver_id);
                if ($receiver) {
                    $receiver->notify(new GenericNotification(
                        shipmentId: $shipment->id,
                        trackingNumber: $shipment->order_number ?? '-',
                        title: 'dbTitleShipmentRecieveRecieverPayment',
                        description: 'dbBodyShipmentRecieveRecieverPayment',
                        type: 'shipment',
                        icon: 'payment',
                        extraData: [
                            'role' => 'sender'
                        ]
                    ));
                }
                if ($shipment->receiver_phone) {
                    $smsService->sendLocalized($shipment->receiver_phone, 'shipmentReceiveRecieverPayment', [], $locale);
                }
            }

            return response()->json([
                'success' => true,
                'already_paid' => $alreadyPaid,
                'message' => $alreadyPaid
                    ? __('shipmentSenderPaymentIsAlreadyPaid')
                    : __('shipmentSenderPaymentHasBeenPaid'),
            ]);
        }

        $isReceiverAuthorized = (int) $shipment->receiver_id === (int) $user->id
            || (int) $shipment->user_id === (int) $user->id;
        if (!$isReceiverAuthorized) {
            return response()->json([
                'success' => false,
                'message' => __('youAreNotAllowedToPayThisShipmentAsReceiver'),
            ], JsonResponse::HTTP_FORBIDDEN);
        }

        if (!in_array($paymentMethod, ['cash', 'online'], true)) {
            return response()->json([
                'success' => false,
                'message' => __('validationFailed'),
                'errors' => [
                    'payment_method' => [__('paymentMethodFieldIsRequiredAndMustBeCashOrOnline')],
                ],
            ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
        }

        $alreadyPaid = $paymentFor === 'return_delivery'
            ? strtolower((string) $shipment->rdf_payment_status) === 'paid'
            : strtolower((string) $shipment->payment_status) === 'paid';

        if (!$alreadyPaid) {
            if ($paymentFor === 'return_delivery') {
                $shipment->rdf_payment_status = 'paid';
                $shipment->rdf_paid_at = now();
                $shipment->payment_method = $paymentMethod;
                $shipment->save();
            } else {
                $shipment->payment_status = 'paid';
                $shipment->payment_method = $paymentMethod;
                $shipment->save();

                $sender = User::find($shipment->user_id);
                if ($sender) {
                    $sender->notify(new GenericNotification(
                        shipmentId: $shipment->id,
                        trackingNumber: $shipment->order_number ?? '-',
                        title: 'dbTitleShipmentRecieveSenderPayment',
                        description: 'dbBodyShipmentRecieveSenderPayment',
                        type: 'shipment',
                        icon: 'payment',
                        extraData: [
                            'role' => 'sender'
                        ]
                    ));
                }
                if ($shipment->sender_phone) {
                    $smsService->sendLocalized($shipment->sender_phone, 'shipmentReceiveSenderPayment', [], $locale);
                }

                $superadmin = User::whereHas('roles', function ($q) {
                    $q->where('name', 'superadmin');
                })->first();

                if ($superadmin) {
                    $superadmin->notify(new GenericNotification(
                        shipmentId: $shipment->id,
                        trackingNumber: $shipment->order_number ?? '-',
                        title: 'dbTitleShipmentRecieveAdminPayment',
                        description: 'dbBodyShipmentRecieveAdminPayment',
                        type: 'shipment',
                        icon: 'payment'
                    ));
                }

                $this->walletService->credit(
                    $shipment->user_id,
                    max((float) $shipment->parcel_amount, 0.01),
                    __('paymentReceivedBookingOrderNumber', ['orderNumber' => $shipment->order_number]),
                    [
                        'shipment_id' => $shipment->id,
                        'shipment_order_number' => $shipment->order_number,
                        'reason' => 'Shipment Payment Recieved',
                        'status' => 'completed',
                        'parcel_amount' => $shipment->parcel_amount,
                    ]
                );
            }
        } elseif ($shipment->payment_method !== $paymentMethod) {
            $shipment->payment_method = $paymentMethod;
            $shipment->save();
        }

        if ($paymentFor === 'return_delivery') {
            return response()->json([
                'success' => true,
                'already_paid' => $alreadyPaid,
                'message' => $alreadyPaid
                    ? __('returnDeliveryPaymentIsAlreadyPaid')
                    : __('returnDeliveryPaymentHasBeenPaid'),
                'payment_method' => $shipment->payment_method,
            ]);
        }

        return response()->json([
            'success' => true,
            'already_paid' => $alreadyPaid,
            'message' => $alreadyPaid
                ? __('shipmentPaymentIsAlreadyPaid')
                : __('shipmentPaymentHasBeenPaid'),
            'payment_status' => $shipment->payment_status,
            'rdf_payment_status' => $shipment->rdf_payment_status,
            'payment_method' => $shipment->payment_method,
        ]);
    }

    /**
     * Store a newly created shipment.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(CreateShipmentStoreRequest $request): JsonResponse
    {
        $data = $request->all();
        // $splitAmounts = $this->calculateSenderReceiverAmounts($data);
        $data['parcel_amount'] = floor($data['parcel_amount']);
        $data['service_fee'] = floor($data['service_fee'] ?? 0);
        $data['total_fee'] = floor($data['total_fee']);
        $data['reciever_amount'] = floor($data['reciever_amount']);
        $data['rdf_amount'] = floor($data['rdf_amount']);
        $data['sender_amount'] = floor($data['sender_amount']);
        $data['booking_type'] = 'shipment';
        $userId = auth()->id();
        $wallet = $this->walletService->getOrCreateWallet($userId);
        // Summary card values
        $totalBalance = (float) $wallet->balance;

        if($data['sender_amount'] == 0){
            $data['sender_payment_status'] = 'paid';
        }

        if ($data['payment_method'] !== 'cash') {

            $totalShipmentAmount = 0;

            $deliveryFee = (float) ($data['total_fee'] ?? $shipment->total_fee ?? 0);

            if (
                ($data['accept_returns'] ?? false) &&
                ($data['return_delivery_fee_payer'] ?? '') === 'sender'
            ) {
                $totalShipmentAmount += $deliveryFee;
            }

            if (($data['delivery_fee_payer'] ?? 'sender') === 'sender') {

                $fee = (float) ($data['total_fee'] ?? $data['rdf_amount'] ?? 0);

                $totalShipmentAmount += $fee;
            }

            if ($totalBalance < $totalShipmentAmount) {

                return response()->json([
                    'ok' => false,
                    'message' => __('shipmentCouldNotBeCreatedBecauseYourWalletBalanceIsInsufficient'),
                    'errors' => [
                        __('completeThePaymentFirstToCreateTheShipment'),
                    ],
                ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
            } else {
                $data['sender_payment_status'] = 'paid';
            }
        }

        // Ensure indirect_delivery_mode only persists for indirect speed
        if (($data['delivery_speed'] ?? null) !== 'indirect') {
            $data['indirect_delivery_mode'] = null;
        }

        $shipment = $this->shipmentService->createShipment($data, $request->user()->id);

        // Initialize tracking status row based on delivery speed
        // Starting at index 0 (Assigned stage)
        $speed = strtolower((string)($data['delivery_speed'] ?? 'direct'));
        if (str_starts_with($speed, 'direct')) {
            \App\Models\ShipmentStatusDirect::create([
                'shipment_id' => $shipment->id,
                'current_index' => 0,
            ]);
        } else {
            \App\Models\ShipmentStatusIndirect::create([
                'shipment_id' => $shipment->id,
                'current_index' => 0,
            ]);
        }

        if ($data['from_city_id'] == $data['to_city_id']) {
            $shipment->is_diff_city = false;
        } else {
            $shipment->is_diff_city = true;
        }

        $receiver = $this->userService->findByEmailOrMobile($data['receiver_email'] ?? '', $data['receiver_phone'] ?? '');

        if ($receiver) {
            $shipment->receiver_id = $receiver->id;
        }

        $handoverZone = \App\Services\ZoneHelper::findZoneByCoordinates(
            (float) $shipment->handover_latitude,
            (float) $shipment->handover_longitude
        );

        $deliveryZone = \App\Services\ZoneHelper::findZoneByCoordinates(
            (float) $shipment->delivery_latitude,
            (float) $shipment->delivery_longitude
        );

        if($handoverZone){
            $shipment->zone_id = $handoverZone->id;
        }

        if($deliveryZone){
            $shipment->delivery_zone_id = $deliveryZone->id;
        }

        $shipment->save();

        // Send notification to customer about shipment creation
        try {
            $request->user()->notify(new ShipmentCreatedNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                pickupAddress: $data['handover_address'] ?? null,
                deliveryAddress: $data['delivery_address'] ?? null,
                role: 'sender'
            ));
        } catch (\Exception $e) {
            Log::error('❌ Failed to send shipment created notification', [
                'shipment_id' => $shipment->id,
                'customer_id' => $request->user()->id,
                'error' => $e->getMessage(),
            ]);
        }

        // SR1: Send SMS to sender (New Order)
        try {
            $smsService = app(MtnSmsService::class);
            $user = $request->user();
            $locale = strtolower((string) ($user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

            if ($shipment->sender_phone) {
                $smsService->sendLocalized($shipment->sender_phone, 'smsNewOrderSender', [
                    'trackingNumber' => $shipment->order_number,
                    'senderName' => $shipment->sender_name ?? '',
                    'receiverName' => $shipment->receiver_name ?? '',
                ], $locale);
            }

            // SMS to receiver
            if ($shipment->receiver_phone) {
                $smsService->sendLocalized($shipment->receiver_phone, 'smsNewOrderReceiver', [
                    'trackingNumber' => $shipment->order_number,
                    'senderName' => $shipment->sender_name ?? '',
                ], $locale);
            }

            $shipmentType = 'direct_dd'; // default
            if ($speed === 'indirect') {
                $mode = $data['indirect_delivery_mode'] ?? 'door_to_drop_point';
                $modeMap = [
                    'door_to_door' => 'indirect_dd',
                    'door_to_drop_point' => 'indirect_dp',
                    'drop_point_to_door' => 'indirect_dd',
                    'drop_point_to_drop_point' => 'indirect_dp',
                ];
                $shipmentType = $modeMap[$mode] ?? 'indirect_dp';
            } else {
                $shipmentType = 'direct_dd';
            }

            // Extract receiver city from delivery address
            $deliveryAddress = $data['delivery_address'] ?? '';
            $receiverCity = '';
            if ($deliveryAddress) {
                // Try to extract the first meaningful part (city name)
                $parts = array_map('trim', explode(',', $deliveryAddress));
                $receiverCity = $parts[0] ?? '';
            }

            $deliveryFee = (float) ($data['total_fee'] ?? $shipment->total_fee ?? 0);
            $rdfAmount = $deliveryFee; // Assume RDF is same as forward fee

            $senderPaysDelivery = ($data['delivery_fee_payer'] ?? 'sender') === 'sender';
            $recieverPaysDelivery = ($data['delivery_fee_payer'] ?? 'receiver') === 'receiver';
            $senderPaysRdf = ($data['accept_returns'] ?? false) && ($data['return_delivery_fee_payer'] ?? '') === 'sender';

            $totalSenderPaid = 0;
            if ($senderPaysDelivery) {
                $totalSenderPaid += $deliveryFee;
            }
            if ($senderPaysRdf) {
                $totalSenderPaid += $rdfAmount;
            }

            if ($totalSenderPaid > 0 && $data['payment_method'] !== 'cash') {
                $this->walletService->debit(
                    $request->user()->id,
                    max($totalSenderPaid, 0.01), // ensure positive amount
                    'Booking created - ' . $shipment->order_number,
                    [
                        'shipment_id' => $shipment->id,
                        'shipment_order_number' => $shipment->order_number,
                        'sender_name' => $data['sender_name'] ?? $request->user()->name ?? '',
                        'receiver_city' => $receiverCity,
                        'shipment_type' => $shipmentType,
                        'reason' => 'Booking created',
                        'status' => 'completed',
                        'consignment_type' => $data['consignment_type'] ?? '',
                        'parcel_amount' => $totalSenderPaid,
                        'delivery_fee' => $senderPaysDelivery ? $deliveryFee : 0,
                        'rdf_fee' => $senderPaysRdf ? $rdfAmount : 0,
                        'return_reason' => '',
                        'photos' => $data['photos'] ?? [],
                    ]
                );

                // RDF Hold Logic
                if ($senderPaysRdf) {
                    $this->walletService->hold(
                        $request->user()->id,
                        $rdfAmount,
                        'RDF Hold - ' . $shipment->order_number,
                        [
                            'shipment_id' => $shipment->id,
                            'shipment_order_number' => $shipment->order_number,
                            'type' => 'rdf_hold',
                            'reason' => 'Return Delivery Fee Hold',
                        ]
                    );
                }
            }

            if ($recieverPaysDelivery && $data['payment_method'] !== 'cash') {
                if ($receiver) {
                    $receiver->notify(new GenericNotification(
                        shipmentId: $shipment->id,
                        trackingNumber: $shipment->order_number ?? '-',
                        title: 'dbTitleShipmentCreateReceiverPayment',
                        description: 'dbBodyShipmentCreateReceiverPayment',
                        type: 'shipment',
                        icon: 'payment',
                        extraData: [
                            "role" => 'reciever'
                        ]
                    ));
                }
                $smsService->sendLocalized($shipment->receiver_phone, 'shipmentCreateReceiverPayment', [
                    'orderNumber' => $shipment->order_number,
                ], $locale);
            } else {
                if ($receiver) {
                    $receiver->notify(new GenericNotification(
                        shipmentId: $shipment->id,
                        trackingNumber: $shipment->order_number ?? '-',
                        title: 'dbTitleShipmentCreateReceiverCashPayment',
                        description: 'dbBodyShipmentCreateReceiverCashPayment',
                        type: 'shipment',
                        icon: 'payment',
                        extraData: [
                            "role" => 'reciever'
                        ]
                    ));
                }
                $smsService->sendLocalized($shipment->receiver_phone, 'shipmentCreateReceiverPayment', [
                    'orderNumber' => $shipment->order_number,
                ], $locale);
            }

            if ($data['payment_method'] == 'cash' && $data['indirect_delivery_mode'] != 'drop_point_to_door' && $data['indirect_delivery_mode'] != 'drop_point_to_drop_point' && $data['delivery_fee_payer'] != 'receiver') {
                $this->shipmentService->autoAssign($shipment->id);
            }

            // If receiver pays RDF, update shipment with the calculated RDF amount
            if (($data['accept_returns'] ?? false) && ($data['return_delivery_fee_payer'] ?? '') === 'receiver') {
                $shipment->update([
                    'rdf_amount' => $rdfAmount,
                    'rdf_payment_status' => 'pending'
                ]);
            }
        } catch (\Exception $e) {
            Log::error('❌ Failed to send new order SMS', [
                'shipment_id' => $shipment->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'ok' => true,
            'shipment_id' => $shipment->id,
        ]);
    }

    public function store_return(ShipmentReturnStoreRequest $request): JsonResponse
    {
        $data = $request->all();

        $originalShipment = Shipment::findOrFail($data['shipment_id']);

        $newShipmentData = $originalShipment->toArray();
        unset(
            $newShipmentData['id'],
            $newShipmentData['return_expire_date'],
            // $newShipmentData['user_id'],
            $newShipmentData['delivery_rider_id'],
            $newShipmentData['parcel_amount'],
            $newShipmentData['vat_amount'],
            $newShipmentData['platform_fee'],
            $newShipmentData['rider_id'],
            $newShipmentData['barcode_number'],
            $newShipmentData['shelf_id'],
            $newShipmentData['shelf_assigned_at'],
            $newShipmentData['accept_returns'],
            $newShipmentData['return_window'],
            $newShipmentData['return_delivery_fee_payer'],
            $newShipmentData['is_return_created'],
            $newShipmentData['rdf_amount'],
            $newShipmentData['rdf_payment_status'],
            $newShipmentData['rdf_paid_at'],
            $newShipmentData['created_at'],
            $newShipmentData['updated_at'],
            $newShipmentData['total_fee'],
            $newShipmentData['order_number'],
        );

        $senderFields = [
            'sender_name',
            'sender_phone',
            'sender_email',
            'sender_landmark',
            'sender_building',
            'handover_address',
            'handover_latitude',
            'handover_longitude'
        ];
        $receiverFields = [
            'receiver_name',
            'receiver_phone',
            'receiver_email',
            'receiver_landmark',
            'receiver_building',
            'delivery_address',
            'delivery_latitude',
            'delivery_longitude'
        ];

        foreach ($senderFields as $index => $field) {
            $newShipmentData[$field] = $originalShipment[$receiverFields[$index]] ?? null;
        }

        foreach ($receiverFields as $index => $field) {
            $newShipmentData[$field] = $originalShipment[$senderFields[$index]] ?? null;
        }
        $smsService = app(MtnSmsService::class);
        $user = $request->user();
        $locale = strtolower((string) ($user->language ?? 'en')) === 'ar' ? 'ar' : 'en';
        // $newShipmentData['user_id'] = $request->user()->id;
        $newShipmentData['booking_type'] = 'return';
        $newShipmentData['photos'] = $data['photos'] ?? null;
        $newShipmentData['return_images'] = $data['photos'] ?? null;
        $newShipmentData['return_reason'] = $data['remarks'] ?? null;
        $newShipmentData['shipment_id'] = $originalShipment->id;
        $newShipmentData['payment_method'] = $data['payment_method'];
        $newShipmentData['payment_status'] = $originalShipment->return_delivery_fee_payer == 'sender' ? 'paid' : 'pending';
        $newShipmentData['total_amount'] = $originalShipment->rdf_amount ?? 0;

        // Ensure indirect_delivery_mode only persists for indirect speed
        if (($newShipmentData['delivery_speed'] ?? null) !== 'indirect') {
            $newShipmentData['indirect_delivery_mode'] = null;
        }

        $shipment = $this->shipmentService->createShipment($newShipmentData, $request->user()->id);

        $originalShipment->is_return_created = true;
        $originalShipment->return_status = ShipmentStatus::PENDING;
        $originalShipment->shipment_id = $shipment->id;
        $originalShipment->sender_receive_payment_status = 'held';
        $originalShipment->return_images = $data['photos'] ?? null;
        $originalShipment->return_reason = $data['remarks'] ?? null;
        $originalShipment->save();
        // Initialize tracking status row based on delivery speed
        // Starting at index 0 (Assigned stage)
        $speed = strtolower((string)($newShipmentData['delivery_speed'] ?? 'direct'));
        if (str_starts_with($speed, 'direct')) {
            \App\Models\ShipmentStatusDirect::create([
                'shipment_id' => $shipment->id,
                'current_index' => 0,
            ]);
        } else {
            \App\Models\ShipmentStatusIndirect::create([
                'shipment_id' => $shipment->id,
                'current_index' => 0,
            ]);
        }

        // Create wallet transaction entry for this booking
        try {
            // Derive shipment type label for wallet metadata
            $sender = User::find($originalShipment->user_id);
            $sender->notify(new ShipmentReturnCreatedNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number
            ));

            $shipmentType = 'direct_dd'; // default
            if ($speed === 'indirect') {
                $mode = $newShipmentData['indirect_delivery_mode'] ?? 'door_to_drop_point';
                $modeMap = [
                    'door_to_door' => 'indirect_dd',
                    'door_to_drop_point' => 'indirect_dp',
                    'drop_point_to_door' => 'indirect_dd',
                    'drop_point_to_drop_point' => 'indirect_dp',
                ];
                $shipmentType = $modeMap[$mode] ?? 'indirect_dp';
            } else {
                $shipmentType = 'direct_dd';
            }

            $deliveryFee = (float) $originalShipment->rdf_amount ?? 0;

            $senderPaysDelivery = ($originalShipment->return_delivery_fee_payer ?? 'sender') == 'sender';

            $totalSenderPaid = 0;
            if ($senderPaysDelivery) {
                $totalSenderPaid += $deliveryFee;
            }

            $this->walletService->creditHold(
                $originalShipment->user_id,
                max($originalShipment->parcel_amount, 0.01), // ensure positive amount
                'Return Develivery Fee Deduct on Shipment - ' . $shipment->order_number,
                [
                    'shipment_id' => $shipment->id,
                    'shipment_order_number' => $shipment->order_number,
                    'shipment_type' => $shipmentType,
                    'reason' => 'Shipment Returned',
                    'status' => 'completed',
                    'amount' => $originalShipment->parcel_amount,
                    'return_reason' => $data['remarks'] ?? '-',
                ]
            );

            if ($originalShipment->return_delivery_fee_payer == 'sender') {
                $this->walletService->deductHold(
                    $originalShipment->user_id,
                    max($totalSenderPaid, 0.01), // ensure positive amount
                    'Return Develivery Fee Deduct on Shipment - ' . $shipment->order_number,
                    [
                        'shipment_id' => $shipment->id,
                        'shipment_order_number' => $shipment->order_number,
                        'shipment_type' => $shipmentType,
                        'reason' => 'Shipment Returned',
                        'status' => 'completed',
                        'delivery_fee' => $totalSenderPaid,
                        'return_reason' => $data['remarks'] ?? '-',
                    ]
                );

                $sender->notify(new ShipmentReturnRDFDeductNotification(
                    shipmentId: (string) $shipment->id,
                    trackingNumber: $shipment->order_number,
                    amount: max($totalSenderPaid, 0.01)
                ));

                if ($shipment->sender_phone) {
                    $smsService->sendLocalized($shipment->sender_phone, 'dbBodyShipmentReturnedRDFDeduct', [
                        'trackingNumber' => $shipment->order_number,
                        'senderName' => $shipment->sender_name ?? '',
                        'receiverName' => $shipment->receiver_name ?? '',
                    ], $locale);
                }
            }
        } catch (\Throwable $e) {
            // Don't fail the booking if wallet entry fails — log it
            \Illuminate\Support\Facades\Log::warning('Wallet transaction creation failed for shipment: ' . $shipment->order_number, [
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'ok' => true,
            'shipment_id' => $shipment->id,
        ]);
    }

    public function compensation_request(CompensationStoreRequest $request): JsonResponse
    {
        $data = $request->all();

        $shipment = Shipment::findOrFail($data['shipment_id']);
        $reciever = User::find($shipment->user_id);
        $sender = User::find($shipment->reciever_id);

        $shipment->componsation_amount = $data['amount'];
        $shipment->componsation_remarks_sender = $data['remarks'];
        $shipment->componsation_images = $data['photos'] ?? [];

        if ($data['amount'] == $shipment->parcel_amount) {

            if ($shipment->receiver_id) {
                $reciever_amount = ($shipment->componsation_amount ?? 0) - $shipment->percel_amount;
                $this->walletService->credit(
                    $shipment->receiver_id,
                    max($reciever_amount, 0.01),
                    'Booking return - ' . $shipment->order_number,
                    [
                        'shipment_id' => $shipment->id,
                        'shipment_order_number' => $shipment->order_number,
                        'reason' => 'Booking returned',
                        'status' => 'completed',
                        'componsation_amount' => $shipment->componsation_amount,
                        'recieved_amount' => $reciever_amount,
                        'parcel_amount' => $shipment->componsation_amount ?? 0,
                    ]
                );
            }

            // $this->walletService->deductHold(
            //     $shipment->user_id,
            //     max($shipment->parcel_amount, 0.01)
            // );

            // $this->walletService->credit(
            //     $shipment->user_id,
            //     max($shipment->componsation_amount, 0.01),
            //     'Booking return - ' . $shipment->order_number,
            //     [
            //         'shipment_id' => $shipment->id,
            //         'shipment_order_number' => $shipment->order_number,
            //         'reason' => 'Booking returned',
            //         'status' => 'completed',
            //         'componsation_amount' => $shipment->componsation_amount,
            //         'parcel_amount' => $shipment->componsation_amount ?? 0,
            //     ]
            // );

            $shipment->componsation_status = 'approved';
            $shipment->componsation_payment = 'paid';
            $shipment->return_status = ShipmentStatus::COMPENSATION_REQEUSTED;

            $sender->notify(new ShipmentCompensationAcceptedNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                amount: (int) $data['amount'],
            ));
        } else {
            $shipment->componsation_status = 'pending';
            $shipment->return_status = ShipmentStatus::COMPENSATION_REQEUSTED;

            // $this->walletService->debitAndHold(
            //     $shipment->user_id,
            //     (float) $shipment->parcel_amount,
            //     'Amount deducted for Order #' . $shipment->order_number . ' against componsation request'
            // );
        }
        $shipment->save();

        $reciever->notify(new ShipmentCompensationRequestNotification(
            shipmentId: (string) $shipment->id,
            trackingNumber: $shipment->order_number,
            amount: (int) $data['amount'],
            remarks: $data['remarks'],
            role: 'reciever'
        ));

        return response()->json([
            'ok' => true,
            'message' => __('componsationRequestCreatedSuccessfully'),
            'shipment' => $shipment,
        ]);
    }

    public function compensation_status(CompensationStatusRequest $request): JsonResponse
    {
        $data = $request->all();

        $shipment = Shipment::findOrFail($data['shipment_id']);

        $shipment->componsation_remarks_receiver = $data['remarks'];

        // $originalShipment = Shipment::where('shipment_id', $shipment->id)->first();
        $sender = User::find($shipment->user_id);

        if ($data['status'] === 'approved') {
            if ($shipment->receiver_id) {
                $reciever_amount = $shipment->parcel_amount - ($shipment->componsation_amount ?? 0);
                $this->walletService->credit(
                    $shipment->receiver_id,
                    max($reciever_amount, 0.01),
                    'Booking return - ' . $shipment->order_number,
                    [
                        'shipment_id' => $shipment->id,
                        'shipment_order_number' => $shipment->order_number,
                        'reason' => 'Booking returned',
                        'status' => 'completed',
                        'componsation_amount' => $shipment->componsation_amount,
                        'recieved_amount' => $reciever_amount,
                        'parcel_amount' => $shipment->componsation_amount ?? 0,
                    ]
                );
            }

            $this->walletService->deductHold(
                $shipment->user_id,
                max($shipment->parcel_amount, 0.01)
            );

            $this->walletService->credit(
                $shipment->user_id,
                max($shipment->componsation_amount, 0.01),
                'Booking return - ' . $shipment->order_number,
                [
                    'shipment_id' => $shipment->id,
                    'shipment_order_number' => $shipment->order_number,
                    'reason' => 'Booking returned',
                    'status' => 'completed',
                    'componsation_amount' => $shipment->componsation_amount,
                    'parcel_amount' => $shipment->componsation_amount ?? 0,
                ]
            );
            $shipment->sender_receive_payment_status = 'released';
            $shipment->componsation_status = 'approved';
            $shipment->componsation_payment = 'paid';
            $shipment->return_status = ShipmentStatus::COMPENSATION_APPROVED;

            $sender->notify(new ShipmentCompensationAcceptedNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                amount: (int) $shipment->parcel_amount,
            ));
        } else {
            $shipment->sender_receive_payment_status = $data['status'];
            $shipment->componsation_status = $data['status'];
            $shipment->return_status = ShipmentStatus::COMPENSATION_REJECTED;

            $sender->notify(new ShipmentCompensationRejectedNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
                amount: (int) $shipment->parcel_amount,
            ));
        }
        $shipment->save();

        return response()->json([
            'ok' => true,
            'message' => __('componsationRequestUpdatedSuccessfully'),
            'shipment' => $shipment,
        ]);
    }

    public function return_status(Request $request): JsonResponse
    {
        $data = $request->all();

        $shipment = Shipment::findOrFail($data['shipment_id']);
        $sender = User::find($shipment->user_id);

        if ($data['return_status'] === 'approved') {
            if ($shipment->receiver_id) {
                $reciever_amount = ($shipment->componsation_amount ?? 0) - $shipment->percel_amount;
                $this->walletService->credit(
                    $shipment->receiver_id,
                    max($reciever_amount, 0.01),
                    'Booking return - ' . $shipment->order_number,
                    [
                        'shipment_id' => $shipment->id,
                        'shipment_order_number' => $shipment->order_number,
                        'reason' => 'Booking returned',
                        'status' => 'completed',
                        'componsation_amount' => $shipment->componsation_amount,
                        'recieved_amount' => $reciever_amount,
                        'parcel_amount' => $shipment->componsation_amount ?? 0,
                    ]
                );
            }

            $this->walletService->deductHold(
                $shipment->user_id,
                max($shipment->parcel_amount, 0.01)
            );

            $this->walletService->credit(
                $shipment->user_id,
                max($shipment->componsation_amount, 0.01),
                'Booking return - ' . $shipment->order_number,
                [
                    'shipment_id' => $shipment->id,
                    'shipment_order_number' => $shipment->order_number,
                    'reason' => 'Booking returned',
                    'status' => 'completed',
                    'componsation_amount' => $shipment->componsation_amount,
                    'parcel_amount' => $shipment->componsation_amount ?? 0,
                ]
            );
            $shipment->sender_receive_payment_status = 'released';
            $shipment->return_status = ShipmentStatus::RETURNED;
            $shipment->status = ShipmentStatus::COMPLETED;
            $sender->notify(new ShipmentCompensationReturnedSuccessNotification(
                shipmentId: (string) $shipment->id,
                trackingNumber: $shipment->order_number,
            ));
        } else {
            // $shipment->return_status = $data['return_status'];
            $shipment->return_status = ShipmentStatus::COMPENSATION_REJECTED;
        }
        $shipment->save();

        return response()->json([
            'ok' => true,
            'message' => __('returnStatusUpdatedSuccessfully'),
            'shipment' => $shipment,
        ]);
    }

    /**
     * Display a specific shipment and open details view.
     *
     * @param Request $request
     * @param Shipment $shipment
     * @return Response
     */
    public function show(Request $request, Shipment $shipment): Response
    {
        $user = $request->user();
        abort_unless($user && (int) $shipment->user_id === (int) $user->id, 404);

        // Eager-load relationships used by the React detail view
        $shipment->load([
            'size',
            'directStatus',
            'indirectStatus',
            'review',
            'statusHistory' => fn($q) => $q->orderBy('created_at', 'asc'),
        ]);

        // Add payment details to selected shipment
        $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);

        $shipment->returned_shipment = $shipment->shipment_id !== null ? $this->shipmentService->find($shipment->shipment_id)->load([
            'size',
            'directStatus',
            'indirectStatus',
            'review',
            'statusHistory' => fn($q) => $q->orderBy('created_at', 'asc'),
        ]) : null;
        return Inertia::render('Customer/Shipments', [
            'shipments' => [],
            'filters' => [
                'search' => $request->query('search'),
                'status' => $request->query('status'),
                'per_page' => 0,
            ],
            'selectedShipment' => $shipment,
            'financialSettings' => $this->getFinancialSettings(),
            'cities' => City::select('name', 'short_code', 'latitude', 'longitude')->get(),
        ]);
    }

    /**
     * Display a shipment tracking page without requiring login.
     *
     * @param Request $request
     * @param string $trackingNumber
     * @return Response
     */
    public function track(Request $request, string $trackingNumber): Response
    {
        $shipment = $this->findShipmentForTracking($trackingNumber);

        // Eager-load relationships used by the React detail view
        $shipment->load([
            'size',
            'directStatus',
            'indirectStatus',
            'review',
            'statusHistory' => fn($q) => $q->orderBy('created_at', 'asc'),
        ]);

        // Add payment details to selected shipment
        $shipment->payment = ShipmentPaymentHelper::calculatePaymentDetails($shipment);

        return Inertia::render('Customer/ReceivingParcels', [
            'shipments' => [],
            'filters' => [
                'search' => null,
                'status' => null,
                'per_page' => 10,
            ],
            'selectedShipment' => $shipment,
            'financialSettings' => $this->getFinancialSettings(),
            'cities' => City::select('name', 'short_code', 'latitude', 'longitude')->get(),
            'publicView' => true,
            'paymentStatus' => $this->resolvePaymentStatus($request),
        ]);
    }

    public function updateStatus(Request $request, Shipment $shipment)
    {
        $user = $request->user();
        if (!$user || $shipment->user_id !== $user->id) {
            abort(403);
        }

        $index = (int) $request->integer('index');
        $index = $index > 0 ? $index : 1;

        $speed = strtolower((string) $shipment->delivery_speed);
        if (str_starts_with($speed, 'direct')) {
            $record = $shipment->directStatus()->firstOrCreate(['shipment_id' => $shipment->id]);
            // Direct stages: 0=Assigned, 1=Pickup, 2=In Transit, 3=Arrived at Drop Point, 4=Delivered
            $record->current_index = min($index, 4);
            $record->save();
        } else {
            $record = $shipment->indirectStatus()->firstOrCreate(['shipment_id' => $shipment->id]);
            // Indirect stages: 0=Assigned, 1=Pickup, 2=In Transit, 3=Arrived Drop Point 1, 4=Dispatched, 5=Arrived Drop Point 2, 6=Ready for Pickup, 7=Picked up by Receiver
            $record->current_index = min($index, 7);
            $record->save();
        }

        return response()->json(['ok' => true, 'current_index' => $record->current_index]);
    }

    private function findShipmentForTracking(string $trackingNumber): Shipment
    {
        $normalized = strtoupper(trim($trackingNumber));
        $shipment = null;

        if (Schema::hasColumn('shipments', 'tracking_number')) {
            $shipment = Shipment::where('tracking_number', $normalized)->first();
        }

        if (!$shipment && preg_match('/(\d+)/', $normalized, $matches)) {
            $id = (int) ltrim($matches[1], '0');
            if ($id > 0) {
                $shipment = Shipment::find($id);
            }
        }

        if (!$shipment) {
            abort(404);
        }

        return $shipment;
    }

    private function getFinancialSettings(): array
    {
        return FinancialSettings::get();
    }

    private function resolvePaymentStatus(Request $request): ?array
    {
        $status = $request->session()->get('paymentStatus');
        if (!is_array($status)) {
            return null;
        }

        $type = strtolower((string) ($status['type'] ?? ''));
        if (!in_array($type, ['success', 'error'], true)) {
            return null;
        }

        $title = trim((string) ($status['title'] ?? ''));
        $description = trim((string) ($status['description'] ?? ''));

        if ($title === '' && $description === '') {
            return null;
        }

        return [
            'type' => $type,
            'title' => $title,
            'description' => $description,
        ];
    }

    private function calculateSenderReceiverAmounts(array $data): array
    {
        $settings = FinancialSettings::get();
        $shipmentFee = $this->normalizeDecimalValue($data['total_fee'] ?? 0);
        $serviceFee = $this->normalizeDecimalValue($data['service_fee'] ?? 0);
        $insuranceFee = $this->normalizeDecimalValue($data['insurance_fee'] ?? 0);
        $goodsAmount = $this->normalizeDecimalValue($data['parcel_amount'] ?? 0);
        $platformFee = $this->normalizeDecimalValue($settings['platform_fee'] ?? 0);

        $vatType = strtolower(trim((string) ($settings['vat_type'] ?? 'Fixed Amount')));
        $vatValue = $this->normalizeDecimalValue($settings['vat_value'] ?? 0);
        $taxableSubtotal = $insuranceFee + $serviceFee + $shipmentFee + $platformFee;
        $vat = $vatType === 'percentage'
            ? round($taxableSubtotal * ($vatValue / 100), 2)
            : round($vatValue, 2);

        $deliveryFeePayer = strtolower(trim((string) ($data['delivery_fee_payer'] ?? 'sender')));
        $acceptReturns = filter_var($data['accept_returns'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $returnDeliveryFeePayer = strtolower(trim((string) ($data['return_delivery_fee_payer'] ?? 'sender')));

        $senderShipmentFee = $deliveryFeePayer === 'sender' ? $shipmentFee : 0;
        $senderRdfFee = $acceptReturns && $returnDeliveryFeePayer === 'sender' ? $shipmentFee : 0;
        $receiverShipmentFee = $deliveryFeePayer === 'receiver' ? $shipmentFee : 0;
        $receiverRdfFee = $acceptReturns && $returnDeliveryFeePayer === 'receiver' ? $shipmentFee : 0;

        $senderPaysAmount = $platformFee + $vat + $serviceFee + $senderShipmentFee + $senderRdfFee;
        $receiverPaysAmount = $goodsAmount + $insuranceFee + $serviceFee + $receiverShipmentFee + $receiverRdfFee;

        return [
            'sender_amount' => round(max($senderPaysAmount, 0), 2),
            'reciever_amount' => round(max($receiverPaysAmount, 0), 2),
            'rdf_amount' => round(max($shipmentFee, 0), 2),
        ];
    }

    private function normalizeDecimalValue($value): float
    {
        if ($value === null) {
            return 0.0;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        $clean = str_replace([',', ' '], '', (string) $value);
        $clean = preg_replace('/[^0-9.-]/', '', $clean);

        return is_numeric($clean) ? (float) $clean : 0.0;
    }
    public function requestReturn(Request $request, Shipment $shipment): JsonResponse
    {
        // 1. Validate ownership or public access logic if needed

        // 2. Initial Checks
        if (!$shipment->accept_returns) {
            return response()->json(['ok' => false, 'message' => __('returnsAreNotAcceptedForThisShipment')], 400);
        }

        // Validate Status
        $currentStatus = strtolower($shipment->status ?? '');
        $allowed = ['delivered', 'completed', 'pending handover']; // Expanded allowed statuses

        if (!in_array($currentStatus, $allowed)) {
            // Check history just in case
            $latest = $shipment->statusHistory()->latest()->first();
            $status = strtolower($latest ? $latest->status : '');
            $found = false;
            foreach ($allowed as $a) {
                if (str_contains($status, $a)) {
                    $found = true;
                    break;
                }
            }

            if (!$found) {
                return response()->json(['ok' => false, 'message' => __('shipmentMustBeDeliveredBeforeRequestingAReturn')], 400);
            }
        }

        // Check Return Window
        $deliveredAt = $shipment->statusHistory()
            ->where('to_status', 'like', '%Delivered%')
            ->latest()
            ->value('created_at');

        if ($deliveredAt && $shipment->return_window) {
            $deadline = $deliveredAt->copy()->addDays($shipment->return_window);
            if (now()->gt($deadline)) {
                return response()->json(['ok' => false, 'message' => __('returnWindowHasExpired')], 400);
            }
        }

        // Check if already requested
        if ($shipment->return_status) {
            return response()->json(['ok' => false, 'message' => __('returnAlreadyRequestedOrProcessed')], 400);
        }

        // 3. Validate Inputs
        $validator = Validator::make($request->all(), [
            'return_reason' => 'required|string|in:Other,Damaged Item,Wrong Item',
            'instruction' => 'nullable|string',
            'images' => 'nullable|array|max:5',
            'images.*' => 'image|mimes:jpeg,png,webp|max:5120', // 5MB max
        ], [
            'return_reason.in' => __('invalidReturnReasonSelected'),
            'images.max' => __('youCanUploadMaximumOf5Images'),
            'images.*.max' => __('eachImageMustNotExceed5Mb'),
        ]);

        if ($validator->fails()) {
            return response()->json(['ok' => false, 'message' => $validator->errors()->first()], 422);
        }

        // Additional Logic: Require images for Damaged/Wrong Item
        $reason = $request->input('return_reason');
        if (in_array($reason, ['Damaged Item', 'Wrong Item']) && !$request->hasFile('images')) {
            return response()->json(['ok' => false, 'message' => __('imagesAreRequiredForThisReturnReason')], 422);
        }

        // 4. Handle Image Uploads
        $imagePaths = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                $path = $file->store('assets/customer-uploads/return-evidence', 'public_uploads');
                // Check if public_uploads disk is configured, otherwise fallback to public
                if (!$path) {
                    $name = uniqid('return_') . '.' . $file->getClientOriginalExtension();
                    $file->move(public_path('assets/customer-uploads/return-evidence'), $name);
                    $path = 'assets/customer-uploads/return-evidence/' . $name;
                }
                $imagePaths[] = $path;
            }
        }

        // 5. Update Shipment
        $instruction = $request->input('instruction', '');
        $note = "\n[RETURN REQUEST]\nReason: $reason";
        if ($instruction) {
            $note .= "\nInstruction: $instruction";
        }
        $note .= "\nRequested At: " . now()->toDateTimeString();

        $shipment->admin_notes .= $note;
        $shipment->return_status = 'requested';
        $shipment->return_reason = $reason;
        $shipment->return_images = $imagePaths;
        $shipment->save();

        // 6. Sync to Wallet Transaction
        try {
            \Illuminate\Support\Facades\Log::info("Attempting to sync wallet status for Shipment Return. Shipment ID: {$shipment->id}, Order: {$shipment->order_number}, User ID: {$shipment->user_id}");

            // Get Wallet ID
            $wallet_id = \App\Models\Wallet::where('user_id', $shipment->user_id)->value('id');

            if ($wallet_id) {
                // Search for transaction
                $transaction = \App\Models\WalletTransaction::where('wallet_id', $wallet_id)
                    ->where(function ($q) use ($shipment) {
                        $q->whereJsonContains('metadata->shipment_id', $shipment->id)
                            ->orWhereJsonContains('metadata->shipment_id', (string) $shipment->id)
                            ->orWhere('description', 'like', '%' . $shipment->order_number . '%');
                    })
                    ->latest()
                    ->first();

                if ($transaction) {
                    $meta = $transaction->metadata ?? [];

                    // Update Status
                    if (($meta['status'] ?? '') !== 'Returned') {
                        $meta['status'] = 'Returned';
                    }

                    // Update Return Details in Metadata
                    $meta['return_reason'] = $reason;
                    // Map local paths to full URLs for the frontend
                    $meta['photos'] = array_map(fn($path) => asset($path), $imagePaths);

                    $transaction->metadata = $meta;
                    $transaction->save();

                    \Illuminate\Support\Facades\Log::info("Wallet Transaction Updated with Return Details. ID: {$transaction->id}");
                } else {
                    \Illuminate\Support\Facades\Log::warning("Wallet transaction NOT found for Shipment ID: {$shipment->id}");
                }
            } else {
                \Illuminate\Support\Facades\Log::warning("No wallet found for User ID: {$shipment->user_id}");
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to update wallet status for shipment {$shipment->id}: " . $e->getMessage());
        }

        return response()->json(['ok' => true]);
    }

    public function cancel(Request $request, Shipment $shipment): JsonResponse
    {
        try {
            $reason = $request->input('reason', 'Cancelled by sender.');
            $this->shipmentService->requestCancellation($shipment->id, $request->user()->id, $reason);

            return response()->json(['ok' => true, 'message' => __('shipmentCancelledSuccessfully')]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 400);
        }
    }
}
