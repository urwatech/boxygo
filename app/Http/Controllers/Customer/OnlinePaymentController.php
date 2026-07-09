<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\ShipmentServiceInterface;
use App\Http\Controllers\Controller;
use App\Models\Shipment;
use App\Models\User;
use App\Notifications\ShipmentCreatedNotification;
use App\Services\MtnPaymentService;
use App\Services\MtnSmsService;
use App\Services\PaymeraPaymentService;
use App\Services\SyriatelPaymentService;
use App\Services\UserService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Notifications\GenericNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class OnlinePaymentController extends Controller
{
    private const PAYMENT_TYPE_NEW_SHIPMENT = 'new_shipment';
    private const PAYMENT_TYPE_EXISTING_SHIPMENT = 'existing_shipment';
    private const PAYMENT_TYPE_RETURN_SHIPMENT = 'return_shipment';
    private const PAYER_TYPE_SENDER = 'sender';
    private const PAYER_TYPE_RECIEVER = 'reciever';

    public function __construct(
        private readonly ShipmentServiceInterface $shipmentService,
        private readonly WalletService $walletService,
        private readonly UserService $userService,
    ) {}

    /**
     * Common shipment validation rules.
     */
    private function shipmentRules(): array
    {
        return [
            'delivery_speed' => 'nullable|string',
            'indirect_delivery_mode' => 'nullable|string|in:door_to_door,door_to_drop_point,drop_point_to_door,drop_point_to_drop_point',
            'consignment_type' => 'nullable|string',
            'size' => 'nullable|string',
            'size_id' => 'nullable|integer|exists:parcels,id',
            'custom_length' => 'nullable|integer|min:1',
            'custom_width' => 'nullable|integer|min:1',
            'custom_height' => 'nullable|integer|min:1',
            'weight' => 'nullable|string',
            'parcel_amount' => 'nullable|numeric',
            'service_fee' => 'nullable|numeric',
            'insurance' => 'nullable|string',
            'insurance_fee' => 'nullable|numeric',
            'schedule_time' => 'nullable|string',
            'handover_address' => 'nullable|string',
            'handover_latitude' => 'nullable|numeric',
            'handover_longitude' => 'nullable|numeric',
            'delivery_address' => 'nullable|string',
            'delivery_latitude' => 'nullable|numeric',
            'delivery_longitude' => 'nullable|numeric',
            'sender_name' => 'nullable|string',
            'sender_phone' => 'nullable|string',
            'sender_email' => 'nullable|email',
            'sender_landmark' => 'nullable|string',
            'sender_building' => 'nullable|string',
            'receiver_name' => 'nullable|string',
            'receiver_phone' => 'nullable|string',
            'receiver_email' => 'nullable|email',
            'receiver_landmark' => 'nullable|string',
            'receiver_building' => 'nullable|string',
            'sender_zone_delivery_fee' => 'nullable|numeric',
            'reciever_zone_delivery_fee' => 'nullable|numeric',
            'accept_returns' => 'boolean',
            'special_instruction' => 'nullable|string',
            'return_window' => 'nullable|integer|required_if:accept_returns,true',
            'delivery_fee_payer' => 'required|string|in:sender,receiver',
            'return_delivery_fee_payer' => 'nullable|string|in:sender,receiver|required_if:accept_returns,true',
            'rdf_amount' => 'required|numeric',
            'sender_amount' => 'required|numeric',
            'reciever_amount' => 'required|numeric',
            'from_city_id' => 'required|exists:cities,id',
            'to_city_id' => 'required|exists:cities,id',
            'photos' => 'array',
            'photos.*' => 'string',
            'additional_docs' => 'array',
            'additional_docs.*' => 'string',
            'payment_method' => 'required|string|in:online',
            'total_fee' => 'nullable|numeric',
            'payment_amount' => 'required|numeric|min:1',
        ];
    }

    /**
     * Create a shipment with pending online payment status.
     */
    private function createPendingShipment(
        array $data,
        int $userId,
        string $gateway,
        string $payerType = self::PAYER_TYPE_SENDER
    ): Shipment {
        // Remove non-DB fields before creating shipment
        unset($data['payment_amount'], $data['payment_phone'], $data['payment_type'], $data['payer_type'], $data['shipment_id']);

        if (($data['delivery_speed'] ?? null) !== 'indirect') {
            $data['indirect_delivery_mode'] = null;
        }

        $data['payment_status'] = 'pending';
        $data['payment_gateway'] = $gateway;
        $data['booking_type'] = 'shipment';
        $data['sender_payment_status'] = 'pending';

        if ($this->normalizePayerType($payerType) === self::PAYER_TYPE_RECIEVER) {
            $data['reciever_payment_status'] = 'pending';
            $data['reciever_payment_gateway'] = $gateway;
        }


        $handoverZone = \App\Services\ZoneHelper::findZoneByCoordinates(
            (float) $data['handover_latitude'],
            (float) $data['handover_longitude']
        );

        $deliveryZone = \App\Services\ZoneHelper::findZoneByCoordinates(
            (float) $data['delivery_latitude'],
            (float) $data['delivery_longitude']
        );

        if ($handoverZone) {
            $data['zone_id'] = $handoverZone->id;
        }

        if ($deliveryZone) {
            $data['delivery_zone_id'] = $deliveryZone->id;
        }

        if ($data['from_city_id'] == $data['to_city_id']) {
            $data['is_diff_city'] = false;
        } else {
            $data['is_diff_city'] = true;
        }

        $receiver = $this->userService->findByEmailOrMobile($data['receiver_email'] ?? '', $data['receiver_phone'] ?? '');

        if ($receiver) {
            $data['receiver_id'] = $receiver->id;
        }

        $shipment = $this->shipmentService->createShipment($data, $userId);

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

        return $shipment;
    }

    private function findAuthorizedShipment(int $shipmentId, int $userId, ?string $payerType = null): ?Shipment
    {
        $query = Shipment::where('id', $shipmentId);

        if ($payerType !== null) {
            $payerType = $this->normalizePayerType($payerType);

            if ($payerType === self::PAYER_TYPE_SENDER) {
                $query->where('user_id', $userId);
            } else {
                $query->where('receiver_id', $userId);
            }
        } else {
            $query->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->orWhere('receiver_id', $userId);
            });
        }

        return $query->first();
    }

    private function normalizePaymentType(?string $value): string
    {
        $normalized = strtolower(trim((string) $value));

        if ($normalized === self::PAYMENT_TYPE_EXISTING_SHIPMENT) {
            return self::PAYMENT_TYPE_EXISTING_SHIPMENT;
        }

        if ($normalized === self::PAYMENT_TYPE_RETURN_SHIPMENT) {
            return self::PAYMENT_TYPE_RETURN_SHIPMENT;
        }

        return self::PAYMENT_TYPE_NEW_SHIPMENT;
    }

    private function normalizePayerType(?string $value): string
    {
        $normalized = strtolower(trim((string) $value));

        if ($normalized === 'receiver') {
            $normalized = self::PAYER_TYPE_RECIEVER;
        }

        return $normalized === self::PAYER_TYPE_SENDER
            ? self::PAYER_TYPE_SENDER
            : self::PAYER_TYPE_RECIEVER;
    }

    private function paymentColumnsFor(string $payerType): array
    {
        if ($payerType === self::PAYER_TYPE_SENDER) {
            return [
                'gateway' => 'payment_gateway',
                'invoice' => 'payment_invoice_number',
                'guid' => 'payment_guid',
                'operation' => 'payment_operation_number',
                'response' => 'payment_gateway_response',
            ];
        }

        return [
            'gateway' => 'reciever_payment_gateway',
            'invoice' => 'reciever_payment_invoice_number',
            'guid' => 'reciever_payment_guid',
            'operation' => null,
            'response' => 'reciever_payment_gateway_response',
        ];
    }

    private function isLegacyReceiverContext(Shipment $shipment): bool
    {
        $holder = data_get($shipment->payment_gateway_response, 'context.payer_type')
            ?? data_get($shipment->payment_gateway_response, 'context.payment_holder');

        if (!$holder) {
            return false;
        }

        return $this->normalizePayerType((string) $holder) === self::PAYER_TYPE_RECIEVER;
    }

    private function getPayerGatewayResponse(Shipment $shipment, string $payerType): array
    {
        $payerType = $this->normalizePayerType($payerType);
        $columns = $this->paymentColumnsFor($payerType);
        $response = (array) ($shipment->{$columns['response']} ?? []);

        if ($payerType === self::PAYER_TYPE_RECIEVER && empty($response) && $this->isLegacyReceiverContext($shipment)) {
            return (array) ($shipment->payment_gateway_response ?? []);
        }

        return $response;
    }

    private function persistPayerGatewayResponse(Shipment $shipment, string $payerType, array $gatewayResponse): void
    {
        $payerType = $this->normalizePayerType($payerType);
        $columns = $this->paymentColumnsFor($payerType);
        $updates = [
            $columns['response'] => $gatewayResponse,
        ];

        if ($payerType === self::PAYER_TYPE_RECIEVER && $this->isLegacyReceiverContext($shipment) && empty($shipment->reciever_payment_gateway_response)) {
            $updates['payment_gateway_response'] = $gatewayResponse;
        }

        $shipment->forceFill($updates)->save();
    }

    private function getPayerInvoiceNumber(Shipment $shipment, string $payerType): ?string
    {
        $payerType = $this->normalizePayerType($payerType);
        $columns = $this->paymentColumnsFor($payerType);
        $invoice = $shipment->{$columns['invoice']} ?? null;

        if ($payerType === self::PAYER_TYPE_RECIEVER && !$invoice && $this->isLegacyReceiverContext($shipment)) {
            return $shipment->payment_invoice_number;
        }

        return $invoice;
    }

    private function getPayerGateway(Shipment $shipment, string $payerType): ?string
    {
        $payerType = $this->normalizePayerType($payerType);
        $columns = $this->paymentColumnsFor($payerType);
        $gateway = $shipment->{$columns['gateway']} ?? null;

        if ($payerType === self::PAYER_TYPE_RECIEVER && !$gateway && $this->isLegacyReceiverContext($shipment)) {
            return $shipment->payment_gateway;
        }

        return $gateway;
    }

    private function resolvePayerTypeFromGatewayResponse(array $gatewayResponse): string
    {
        $holder = data_get($gatewayResponse, 'context.payer_type')
            ?? data_get($gatewayResponse, 'context.payment_holder');

        if (!$holder) {
            return self::PAYER_TYPE_SENDER;
        }

        return $this->normalizePayerType((string) $holder);
    }

    private function resolvePayerTypeFromShipment(Shipment $shipment, ?string $requestedPayerType = null): string
    {
        if ($requestedPayerType !== null) {
            return $this->normalizePayerType($requestedPayerType);
        }

        $senderContext = data_get($shipment->payment_gateway_response, 'context');
        if (!empty($senderContext)) {
            return $this->resolvePayerTypeFromGatewayResponse(['context' => $senderContext]);
        }

        $receiverContext = data_get($shipment->reciever_payment_gateway_response, 'context');
        if (!empty($receiverContext)) {
            return $this->resolvePayerTypeFromGatewayResponse(['context' => $receiverContext]);
        }

        if ($shipment->reciever_payment_invoice_number && !$shipment->payment_invoice_number) {
            return self::PAYER_TYPE_RECIEVER;
        }

        return self::PAYER_TYPE_SENDER;
    }

    private function isAuthorizedPayer(Shipment $shipment, int $userId, string $payerType): bool
    {
        $payerType = $this->normalizePayerType($payerType);

        if ($payerType === self::PAYER_TYPE_SENDER) {
            return (int) $shipment->user_id === $userId;
        }

        return (int) ($shipment->receiver_id ?? 0) === $userId;
    }

    private function prepareExistingShipmentForPayment(
        Shipment $shipment,
        string $gateway,
        string $payerType = self::PAYER_TYPE_RECIEVER
    ): Shipment {
        $updates = [
            'payment_method' => 'online',
        ];

        $payerType = $this->normalizePayerType($payerType);

        if ($payerType === self::PAYER_TYPE_SENDER) {
            $updates['payment_gateway'] = $gateway;
            $updates['sender_payment_status'] = 'pending';

            if (strtolower((string) $shipment->return_delivery_fee_payer) === 'sender') {
                $updates['rdf_payment_status'] = 'pending';
            }
        } else {
            $updates['reciever_payment_gateway'] = $gateway;
            $updates['reciever_payment_status'] = 'pending';
            // Backward compatibility for old shipment-level pending consumers.
            $updates['payment_status'] = 'pending';
        }

        $shipment->forceFill($updates)->save();

        return $shipment->fresh();
    }

    private function resolvePaymentAmount(
        array $data,
        Shipment $shipment,
        ?string $payerType = null
    ): float {
        $payerType = $this->normalizePayerType($payerType);
        $rdfPayer = strtolower((string) ($data['return_delivery_fee_payer'] ?? $shipment->return_delivery_fee_payer ?? ''));

        if ($payerType === self::PAYER_TYPE_SENDER) {
            $senderAmount = is_numeric($data['sender_amount'] ?? null)
                ? (float) $data['sender_amount']
                : (float) ($shipment->sender_amount ?? 0);

            $rdfAmount = 0.0;
            if ($rdfPayer === 'sender') {
                $rdfAmount = is_numeric($data['rdf_amount'] ?? null)
                    ? (float) $data['rdf_amount']
                    : (float) ($shipment->rdf_amount ?? 0);
            }

            return $senderAmount + $rdfAmount;
        }

        return is_numeric($data['reciever_amount'] ?? null)
            ? (float) $data['reciever_amount']
            : (float) ($shipment->reciever_amount ?? 0);
    }

    private function buildPaymentContext(array $data, bool $isExistingShipmentPayment, float $amount, ?int $initiatedBy): array
    {
        $paymentType = $this->normalizePaymentType(
            $data['payment_type'] ?? ($isExistingShipmentPayment ? self::PAYMENT_TYPE_EXISTING_SHIPMENT : self::PAYMENT_TYPE_NEW_SHIPMENT)
        );
        $payerType = $this->normalizePayerType($data['payer_type'] ?? self::PAYER_TYPE_SENDER);

        return [
            'type' => $paymentType,
            'payment_type' => $paymentType,
            'payer_type' => $payerType,
            'amount' => $amount,
            'payment_holder' => $payerType,
            'initiated_by' => $initiatedBy,
            'initiated_at' => now()->toIso8601String(),
        ];
    }

    private function paymentContext(Shipment $shipment, ?string $payerType = null): array
    {
        if ($payerType !== null) {
            $gatewayResponse = $this->getPayerGatewayResponse($shipment, $this->normalizePayerType($payerType));
            return (array) data_get($gatewayResponse, 'context', []);
        }

        $senderContext = (array) data_get($shipment->payment_gateway_response, 'context', []);
        $senderContextHolder = data_get($senderContext, 'payer_type') ?? data_get($senderContext, 'payment_holder');
        if ($senderContextHolder && $this->normalizePayerType((string) $senderContextHolder) === self::PAYER_TYPE_SENDER) {
            return $senderContext;
        }

        $receiverContext = (array) data_get($shipment->reciever_payment_gateway_response, 'context', []);
        if (!empty($receiverContext)) {
            return $receiverContext;
        }

        return $senderContext;
    }

    private function resolvePaymentTypeFromShipment(Shipment $shipment, ?string $payerType = null): string
    {
        $context = $this->paymentContext($shipment, $payerType);

        return $this->normalizePaymentType($context['type'] ?? $context['payment_type'] ?? null);
    }

    private function isExistingShipmentPayment(Shipment $shipment, ?string $payerType = null): bool
    {
        return in_array(
            $this->resolvePaymentTypeFromShipment($shipment, $payerType),
            [self::PAYMENT_TYPE_EXISTING_SHIPMENT, self::PAYMENT_TYPE_RETURN_SHIPMENT],
            true
        );
    }

    private function isShipmentReferencePaymentType(string $paymentType): bool
    {
        return in_array($paymentType, [
            self::PAYMENT_TYPE_EXISTING_SHIPMENT,
            self::PAYMENT_TYPE_RETURN_SHIPMENT,
        ], true);
    }

    private function isReturnShipmentPaymentType(string $paymentType): bool
    {
        return $this->normalizePaymentType($paymentType) === self::PAYMENT_TYPE_RETURN_SHIPMENT;
    }

    private function isReturnDeliveryFeeAlreadyPaid(Shipment $shipment): bool
    {
        return strtolower((string) ($shipment->rdf_payment_status ?? 'pending')) === 'paid';
    }

    private function isPaymentAlreadyPaidForType(
        Shipment $shipment,
        string $paymentType,
        ?string $payerType = null
    ): bool {
        if ($this->isReturnShipmentPaymentType($paymentType)) {
            return $this->isReturnDeliveryFeeAlreadyPaid($shipment);
        }

        return $this->isShipmentPaymentAlreadyPaid($shipment, $payerType);
    }

    private function isPaymentAlreadyPaidByContext(Shipment $shipment, ?string $payerType = null): bool
    {
        return $this->isPaymentAlreadyPaidForType(
            $shipment,
            $this->resolvePaymentTypeFromShipment($shipment, $payerType),
            $payerType
        );
    }

    private function getPayerPaymentStatus(Shipment $shipment, string $payerType): string
    {
        $payerType = $this->normalizePayerType($payerType);

        if ($payerType === self::PAYER_TYPE_SENDER) {
            return strtolower((string) ($shipment->sender_payment_status ?? 'pending'));
        }

        return strtolower((string) ($shipment->reciever_payment_status ?? 'pending'));
    }

    private function currentShipmentPaymentStatus(Shipment $shipment, ?string $payerType = null): string
    {
        $resolvedPayerType = $this->resolvePayerTypeFromShipment($shipment, $payerType);

        return $this->getPayerPaymentStatus($shipment, $resolvedPayerType);
    }

    private function isShipmentPaymentAlreadyPaid(Shipment $shipment, ?string $payerType = null): bool
    {
        return $this->currentShipmentPaymentStatus($shipment, $payerType) === 'paid';
    }

    private function markShipmentPaidByContext(
        Shipment $shipment,
        ?array $gatewayResponse = null,
        ?string $payerType = null
    ): void {
        $resolvedPayerType = $this->normalizePayerType($payerType ?? self::PAYER_TYPE_SENDER);
        if ($gatewayResponse === null) {
            $gatewayResponse = $this->getPayerGatewayResponse($shipment, $resolvedPayerType);
        } elseif ($payerType === null) {
            $resolvedPayerType = $this->resolvePayerTypeFromGatewayResponse($gatewayResponse);
        }

        $paymentType = $this->normalizePaymentType(
            data_get($gatewayResponse, 'context.type')
                ?? data_get($gatewayResponse, 'context.payment_type')
                ?? $this->resolvePaymentTypeFromShipment($shipment, $resolvedPayerType)
        );
        $rdfPaidBy = strtolower((string) ($shipment->return_delivery_fee_payer ?? ''));
        $columns = $this->paymentColumnsFor($resolvedPayerType);
        $updates = [
            $columns['response'] => $gatewayResponse,
        ];

        if ($resolvedPayerType === self::PAYER_TYPE_SENDER) {
            $updates['sender_payment_status'] = 'paid';

            if ($rdfPaidBy === 'sender') {
                $updates['rdf_payment_status'] = 'paid';
                $updates['rdf_paid_at'] = now();
            }
        } else {
            $updates['payment_status'] = 'paid';
            $updates['receiver_payment_method'] = 'online';
            $updates['reciever_payment_status'] = 'paid';
            $updates['reciever_paid_at'] = now();

            $updates['sender_receive_payment_status'] = 'released';

            // if ($this->isLegacyReceiverContext($shipment) && empty($shipment->reciever_payment_gateway_response)) {
            //     $updates['payment_gateway_response'] = $gatewayResponse;
            // }
        }

        if ($paymentType === self::PAYMENT_TYPE_RETURN_SHIPMENT) {
            $updates['rdf_payment_status'] = 'paid';
        }

        $shipment->forceFill($updates)->save();
    }

    /**
     * Apply the same post-payment wallet/receiver processing used by Paymera, once.
     */
    private function applyPostPaymentWalletProcessing(
        Shipment $shipment,
        ?array $gatewayResponse = null,
        ?string $payerType = null
    ): array {
        $resolvedPayerType = $this->normalizePayerType($payerType ?? self::PAYER_TYPE_SENDER);
        if ($gatewayResponse === null) {
            $gatewayResponse = $this->getPayerGatewayResponse($shipment, $resolvedPayerType);
        } elseif ($payerType === null) {
            $resolvedPayerType = $this->resolvePayerTypeFromGatewayResponse($gatewayResponse);
        }

        if (data_get($gatewayResponse, 'post_payment.processed') === true) {
            return $gatewayResponse;
        }

        $meta = [
            'context' => [
                'type' => 'post_payment',
                'payment_type' => 'shipment',
                'payer_type' => $resolvedPayerType,
                'shipment_id' => $shipment->id,
                'order_number' => $shipment->order_number,
                'initiated_by' => auth()->id() ?? null,
                'initiated_at' => now()->toIso8601String(),
            ],
            'gateway' => [
                'name' => data_get($gatewayResponse, ['create.local_invoice.payment_name', 'start.local_invoice.payment_name']),
                'payment_id' => data_get($gatewayResponse, ['payment_id', 'create.local_invoice.invoice_id', 'start.local_invoice.invoice_id']),
                'url' => data_get($gatewayResponse, 'create.paymera_response.Data.url'),
            ],
            'amounts' => [
                'sender_amount' => $shipment->sender_amount,
                'receiver_amount' => $shipment->reciever_amount,
                'parcel_amount' => $shipment->parcel_amount,
                'rdf_amount' => $shipment->rdf_amount,
            ],
        ];

        $rdfPaidBy = strtolower((string) (
            data_get($gatewayResponse, 'context.rdf_paid_by')
            ?? ($shipment->return_delivery_fee_payer ?? '')
        ));

        if ($resolvedPayerType === self::PAYER_TYPE_SENDER) {
            $this->walletService->credit(
                $shipment->user_id,
                (float) $shipment->sender_amount,
                __('amountCreditedToYourWalletForOrderNumber', ['orderNumber' => $shipment->order_number]),
                $meta
            );

            $this->walletService->debit(
                $shipment->user_id,
                (float) $shipment->sender_amount,
                __('amountDeductedForOrderNumber', ['orderNumber' => $shipment->order_number]),
                $meta
            );

            if ($rdfPaidBy === 'sender') {
                $this->walletService->creditAndHold(
                    $shipment->user_id,
                    (float) $shipment->rdf_amount,
                    __('amountPlacedOnHoldForOrderNumber', ['orderNumber' => $shipment->order_number]),
                    $meta
                );
            }
        } else {
            if ($shipment->receiver_id) {
                $this->walletService->credit(
                    $shipment->receiver_id,
                    (float) $shipment->reciever_amount,
                    __('amountCreditedToYourWalletForOrderNumber', ['orderNumber' => $shipment->order_number]),
                    $meta
                );

                $this->walletService->debit(
                    $shipment->receiver_id,
                    (float) $shipment->reciever_amount,
                    __('amountDeductedForOrderNumber', ['orderNumber' => $shipment->order_number]),
                    $meta
                );
            }

            $this->walletService->credit(
                $shipment->user_id,
                (float) $shipment->parcel_amount,
                __('amountCreditedToYourWalletForOrderNumber', ['orderNumber' => $shipment->order_number]),
                $meta
            );
        }

        $gatewayResponse['post_payment'] = [
            'processed' => true,
            'processed_at' => now()->toIso8601String(),
        ];

        return $gatewayResponse;
    }

    private function persistPaymentInitiationMetadata(
        Shipment $shipment,
        string $payerType,
        string $gateway,
        string $invoiceId,
        ?string $guid,
        ?string $operationNumber,
        array $gatewayResponse
    ): void {
        $payerType = $this->normalizePayerType($payerType);
        $columns = $this->paymentColumnsFor($payerType);

        $updates = [
            $columns['gateway'] => $gateway,
            $columns['invoice'] => $invoiceId,
            $columns['guid'] => $guid,
            $columns['response'] => $gatewayResponse,
        ];

        if ($columns['operation']) {
            $updates[$columns['operation']] = $operationNumber;
        }

        if ($payerType === self::PAYER_TYPE_RECIEVER) {
            $updates['reciever_payment_status'] = 'pending';
        } else {
            $updates['sender_payment_status'] = 'pending';
        }

        $shipment->forceFill($updates)->save();
    }

    // ─── MTN Payment ────────────────────────────────────────────────────

    /**
     * Initiate MTN payment: create shipment + MTN invoice + send OTP.
     */
    public function initiate(Request $request): JsonResponse
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $rules = [
                    'payment_type' => 'required|string|in:new_shipment,existing_shipment,return_shipment',
                    'payer_type' => 'required|string|in:sender,reciever,receiver',
                    'payment_method' => 'required|string|in:online',
                    'shipment_id' => 'nullable|integer|exists:shipments,id|required_if:payment_type,existing_shipment,return_shipment',
                    'payment_phone' => 'required|string',
                ];

                if ($this->normalizePaymentType($request->input('payment_type')) === self::PAYMENT_TYPE_NEW_SHIPMENT) {
                    $rules = array_merge($this->shipmentRules(), $rules);
                }

                $validator = Validator::make($request->all(), $rules);

                if ($validator->fails()) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('validationFailed'),
                        'errors' => $validator->errors(),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $user = $request->user();
                if (!$user) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('unauthorized'),
                    ], JsonResponse::HTTP_UNAUTHORIZED);
                }

                $data = $validator->validated();
                $data['payment_type'] = $this->normalizePaymentType($data['payment_type']);
                $data['payer_type'] = $this->normalizePayerType($data['payer_type']);
                $data['payment_method'] = 'online';
                $isExistingShipmentPayment = $this->isShipmentReferencePaymentType($data['payment_type']);
                $paymentPhone = (string) $data['payment_phone'];
                unset($data['payment_phone']);

                if ($isExistingShipmentPayment) {
                    $shipment = $this->findAuthorizedShipment((int) $data['shipment_id'], $user->id, $data['payer_type']);
                    if (!$shipment) {
                        return response()->json([
                            'ok' => false,
                            'message' => __('commonShipmentNotFound'),
                        ], JsonResponse::HTTP_NOT_FOUND);
                    }

                    if (!$this->isAuthorizedPayer($shipment, (int) $user->id, $data['payer_type'])) {
                        return response()->json([
                            'ok' => false,
                            'message' => __('youAreNotAllowedToPayThisShipment'),
                        ], JsonResponse::HTTP_FORBIDDEN);
                    }

                    if ($this->isPaymentAlreadyPaidForType($shipment, $data['payment_type'], $data['payer_type'])) {
                        return response()->json([
                            'ok' => true,
                            'message' => __('paymentAlreadyConfirmed'),
                            'shipment_id' => $shipment->id,
                            'payment_type' => $data['payment_type'],
                            'payer_type' => $data['payer_type'],
                        ]);
                    }

                    $shipment = $this->prepareExistingShipmentForPayment($shipment, 'mtn', $data['payer_type']);
                } else {
                    $shipment = $this->createPendingShipment($data, (int) $user->id, 'mtn', $data['payer_type']);
                }

                // Create MTN invoice
                $paymentService = app(MtnPaymentService::class);
                $invoiceNumber = (int) $shipment->id;
                $amount = $this->resolvePaymentAmount($data, $shipment, $data['payer_type']);

                if ($amount <= 0) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('invalidPaymentAmount'),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $invoiceResult = $paymentService->createInvoice($invoiceNumber, $amount, $paymentPhone);

                if (!$invoiceResult || !($invoiceResult['success'] ?? false)) {
                    Log::error('MTN Payment: Failed to create invoice', [
                        'shipment_id' => $shipment->id,
                        'result' => $invoiceResult,
                    ]);
                    return response()->json([
                        'ok' => false,
                        'message' => $invoiceResult['message'] ?? __('failedToCreatePaymentInvoicePleaseTryAgain'),
                    ], JsonResponse::HTTP_BAD_REQUEST);
                }

                $guid = $invoiceResult['data']['local_invoice']['guid']
                    ?? $invoiceResult['data']['mtn_response']['Guid']
                    ?? ('MP-' . $shipment->id . '-' . Str::random(8));

                // Initiate payment (sends OTP)
                $initiateResult = $paymentService->initiatePayment($invoiceNumber, $paymentPhone, $guid);

                if (!$initiateResult || !($initiateResult['success'] ?? false)) {
                    Log::error('MTN Payment: Failed to initiate payment', [
                        'shipment_id' => $shipment->id,
                        'result' => $initiateResult,
                    ]);
                    return response()->json([
                        'ok' => false,
                        'message' => $initiateResult['message'] ?? __('commonPaymentInitiateError'),
                    ], JsonResponse::HTTP_BAD_REQUEST);
                }

                $operationNumber = $initiateResult['data']['OperationNumber']
                    ?? $initiateResult['data']['mtn_response']['OperationNumber']
                    ?? $initiateResult['data']['operation_number']
                    ?? null;

                $gatewayResponse = $this->getPayerGatewayResponse($shipment, $data['payer_type']);
                $gatewayResponse['context'] = $this->buildPaymentContext(
                    $data,
                    $isExistingShipmentPayment,
                    $amount,
                    $user->id
                );
                $gatewayResponse['invoice'] = $invoiceResult['data'] ?? null;
                $gatewayResponse['initiate'] = $initiateResult['data'] ?? null;

                $this->persistPaymentInitiationMetadata(
                    $shipment,
                    $data['payer_type'],
                    'mtn',
                    (string) $invoiceNumber,
                    $guid,
                    $operationNumber ? (string) $operationNumber : null,
                    $gatewayResponse
                );

                // if (!$isExistingShipmentPayment) {
                //     $this->sendShipmentNotifications($shipment, $data, $user);
                // }

                return response()->json([
                    'ok' => true,
                    'shipment_id' => $shipment->id,
                    'payment_type' => $data['payment_type'],
                    'payer_type' => $data['payer_type'],
                    'payment' => [
                        'shipment_id' => $shipment->id,
                        'invoice' => $invoiceNumber,
                        'guid' => $guid,
                        'operation_number' => $operationNumber,
                        'phone' => $paymentPhone,
                    ],
                ]);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Confirm MTN payment with OTP code.
     */
    public function confirm(Request $request): JsonResponse
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $validator = Validator::make($request->all(), [
                    'shipment_id' => 'required|integer|exists:shipments,id',
                    'phone' => 'required|string',
                    'guid' => 'required|string',
                    'operation_number' => 'required',
                    'invoice' => 'required|integer',
                    'code' => 'required|string',
                ]);

                if ($validator->fails()) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('validationFailed'),
                        'errors' => $validator->errors(),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $data = $validator->validated();

                $shipment = $this->findAuthorizedShipment((int) $data['shipment_id'], $request->user()->id);

                if (!$shipment) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('commonShipmentNotFound'),
                    ], JsonResponse::HTTP_NOT_FOUND);
                }

                $payerType = $this->resolvePayerTypeForInvoice($shipment, $data['invoice']);
                if ($this->isPaymentAlreadyPaidByContext($shipment, $payerType)) {
                    return response()->json([
                        'ok' => true,
                        'message' => __('paymentAlreadyConfirmed'),
                        'shipment_id' => $shipment->id,
                    ]);
                }

                $paymentService = app(MtnPaymentService::class);

                $confirmResult = $paymentService->confirmPayment(
                    $data['phone'],
                    $data['guid'],
                    (int) $data['operation_number'],
                    $data['invoice'],
                    $data['code']
                );

                if (!$confirmResult || !($confirmResult['success'] ?? false)) {
                    $errorMessage = $confirmResult['message'] ?? __('paymentConfirmationFailed');

                    $errno = $confirmResult['data']['Errno'] ?? $confirmResult['errors']['Errno'] ?? null;
                    if ($errno === 662) {
                        $errorMessage = __('incorrectVerificationCodePleaseTryAgain');
                    } elseif ($errno === 661) {
                        $errorMessage = __('verificationCodeExpiredPleaseRequestANewCode');
                    } elseif ($errno === 660) {
                        $errorMessage = __('tooManyAttemptsPleaseTryAgainLater');
                    }

                    $this->sendShipmentNotifications($shipment, 'MTN Cash', auth()->user(), 'cancel', $payerType);

                    return response()->json([
                        'ok' => false,
                        'message' => $errorMessage,
                        'errno' => $errno,
                    ], JsonResponse::HTTP_BAD_REQUEST);
                }

                $gatewayResponse = $this->getPayerGatewayResponse($shipment, $payerType);
                $gatewayResponse['confirm'] = $confirmResult['data'] ?? null;
                $gatewayResponse = $this->applyPostPaymentWalletProcessing($shipment, $gatewayResponse, $payerType);
                $this->markShipmentPaidByContext($shipment, $gatewayResponse, $payerType);
                $this->sendShipmentNotifications($shipment, 'MTN Cash', auth()->user(), 'complete', $payerType);

                return response()->json([
                    'ok' => true,
                    'shipment_id' => $shipment->id,
                ]);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    private function resolvePaymeraShipmentContext(
        ?string $invoice,
        ?string $paymentId,
        ?string $requestedPayerType = null
    ): ?array {
        $invoice = $invoice !== null ? trim($invoice) : null;
        $paymentId = $paymentId !== null ? trim($paymentId) : null;
        $payerType = $requestedPayerType !== null ? $this->normalizePayerType($requestedPayerType) : null;
        $invoicePayerType = $this->extractPayerTypeFromPaymeraInvoice($invoice);

        if ($payerType === null && $invoicePayerType !== null) {
            $payerType = $invoicePayerType;
        }

        if ($invoice) {
            if ($payerType === null || $payerType === self::PAYER_TYPE_SENDER) {
                $shipment = Shipment::where('payment_invoice_number', $invoice)->first();
                if ($shipment) {
                    return [
                        'shipment' => $shipment,
                        'payer_type' => self::PAYER_TYPE_SENDER,
                        'invoice' => $invoice,
                    ];
                }
            }

            if ($payerType === null || $payerType === self::PAYER_TYPE_RECIEVER) {
                $shipment = Shipment::where('reciever_payment_invoice_number', $invoice)->first();
                if ($shipment) {
                    return [
                        'shipment' => $shipment,
                        'payer_type' => self::PAYER_TYPE_RECIEVER,
                        'invoice' => $invoice,
                    ];
                }
            }
        }

        foreach ([$invoice, $paymentId] as $candidate) {
            if (!$candidate || !preg_match('/^BG-(\d+)/', (string) $candidate, $matches)) {
                continue;
            }

            $shipment = Shipment::find((int) ($matches[1] ?? 0));
            if (!$shipment) {
                continue;
            }

            $resolvedPayerType = $payerType;
            if ($resolvedPayerType === null) {
                $candidatePayerType = $this->extractPayerTypeFromPaymeraInvoice((string) $candidate);
                if ($candidatePayerType !== null) {
                    $resolvedPayerType = $candidatePayerType;
                }

                $senderResponse = $this->getPayerGatewayResponse($shipment, self::PAYER_TYPE_SENDER);
                $receiverResponse = $this->getPayerGatewayResponse($shipment, self::PAYER_TYPE_RECIEVER);

                if ($resolvedPayerType !== null) {
                    // resolved by explicit invoice token (SND/RCV)
                } elseif ($shipment->reciever_payment_invoice_number && $invoice === $shipment->reciever_payment_invoice_number) {
                    $resolvedPayerType = self::PAYER_TYPE_RECIEVER;
                } elseif ($shipment->payment_invoice_number && $invoice === $shipment->payment_invoice_number) {
                    $resolvedPayerType = self::PAYER_TYPE_SENDER;
                } elseif ($paymentId && data_get($senderResponse, 'payment_id') === $paymentId) {
                    $resolvedPayerType = self::PAYER_TYPE_SENDER;
                } elseif ($paymentId && data_get($receiverResponse, 'payment_id') === $paymentId) {
                    $resolvedPayerType = self::PAYER_TYPE_RECIEVER;
                } elseif ($this->isLegacyReceiverContext($shipment)) {
                    $resolvedPayerType = self::PAYER_TYPE_RECIEVER;
                } else {
                    $resolvedPayerType = self::PAYER_TYPE_SENDER;
                }
            }

            return [
                'shipment' => $shipment,
                'payer_type' => $resolvedPayerType,
                'invoice' => $invoice ?: $this->getPayerInvoiceNumber($shipment, $resolvedPayerType),
            ];
        }

        return null;
    }

    private function extractPayerTypeFromPaymeraInvoice(?string $invoice): ?string
    {
        if (!$invoice) {
            return null;
        }

        if (preg_match('/^BG-\d+-SND-/i', $invoice)) {
            return self::PAYER_TYPE_SENDER;
        }

        if (preg_match('/^BG-\d+-RCV-/i', $invoice)) {
            return self::PAYER_TYPE_RECIEVER;
        }

        return null;
    }

    private function resolvePayerTypeForInvoice(Shipment $shipment, mixed $invoice): string
    {
        $invoice = $invoice !== null ? (string) $invoice : null;

        if ($invoice !== null && $shipment->reciever_payment_invoice_number !== null && (string) $shipment->reciever_payment_invoice_number === $invoice) {
            return self::PAYER_TYPE_RECIEVER;
        }

        if ($invoice !== null && $shipment->payment_invoice_number !== null && (string) $shipment->payment_invoice_number === $invoice) {
            return self::PAYER_TYPE_SENDER;
        }

        return $this->resolvePayerTypeFromShipment($shipment);
    }

    private function redirectAfterPaymera(Shipment $shipment, string $payerType, bool $useShowRouteForNewShipment = false, $paymentStatusPayload)
    {
        if ($paymentStatusPayload['type'] === 'success') {
            $this->sendShipmentNotifications($shipment, 'Paymera', auth()->user(), 'complete', $payerType);
        } else {
            $this->sendShipmentNotifications($shipment, 'Paymera', auth()->user(), 'cancel', $payerType);
        }
        if ($this->isExistingShipmentPayment($shipment, $payerType)) {
            if (Auth::user()) {
                if ($this->normalizePayerType($payerType) === self::PAYER_TYPE_SENDER) {
                    return redirect()->route('customer.shipments.sending_parcels_show', [
                        'shipment' => $shipment->id,
                    ]);
                }
                return redirect()->route('customer.shipments.receiving_parcels_show', [
                    'shipment' => $shipment->id,
                ]);
            }
            return redirect()->route('customer.shipments.track', [
                'trackingNumber' => $this->getTrackShipmentId($shipment->id),
            ]);
        }

        if (Auth::user()) {
            if ($useShowRouteForNewShipment) {
                return redirect()->route('customer.shipments.show', $shipment->id);
            }
            return redirect()->route('customer.shipments.sending_parcels_show', [
                'shipment' => $shipment->id,
            ]);
        }

        return redirect()->route('customer.shipments.track', [
            'trackingNumber' => $this->getTrackShipmentId($shipment->id),
        ]);
    }

    private function isSuccessfulPaymentStatus(?string $status): bool
    {
        $normalized = strtolower(trim((string) $status));

        return in_array($normalized, ['paid', 'success', 'successful', 'completed'], true);
    }

    private function buildPaymentStatusPayload(?string $status, ?string $message = null): array
    {
        $normalized = strtolower(trim((string) $status));
        $resolvedMessage = trim((string) ($message ?? ''));
        $isSuccess = $this->isSuccessfulPaymentStatus($normalized);
        $isCancelled = Str::contains($normalized, 'cancel')
            || Str::contains(strtolower($resolvedMessage), 'cancel');

        if ($isSuccess) {
            return [
                'type' => 'success',
                'title' => __('notificationPaymentSuccessTitle'),
                'description' => $resolvedMessage !== '' ? $resolvedMessage : __('yourPaymentWasCompletedSuccessfully'),
            ];
        }

        if ($isCancelled) {
            return [
                'type' => 'error',
                'title' => __('commonPaymentCancelled'),
                'description' => $resolvedMessage !== '' ? $resolvedMessage : __('yourPaymentWasCancelled'),
            ];
        }

        return [
            'type' => 'error',
            'title' => __('notificationPaymentFailedTitle'),
            'description' => $resolvedMessage !== ''
                ? $resolvedMessage
                : __('yourPaymentCouldNotBeCompletedPleaseTryAgain'),
        ];
    }

    // ─── Paymera (Card) Payment ─────────────────────────────────────────

    /**
     * Initiate Paymera card payment: create shipment + get redirect URL.
     */
    public function initiatePaymera(Request $request): JsonResponse
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $rules = [
                    'payment_type' => 'required|string|in:new_shipment,existing_shipment,return_shipment',
                    'payer_type' => 'required|string|in:sender,reciever,receiver',
                    'payment_method' => 'required|string|in:online',
                    'shipment_id' => 'nullable|integer|exists:shipments,id|required_if:payment_type,existing_shipment,return_shipment',
                ];

                if ($this->normalizePaymentType($request->input('payment_type')) === self::PAYMENT_TYPE_NEW_SHIPMENT) {
                    $rules = array_merge($this->shipmentRules(), $rules);
                }

                $validator = Validator::make($request->all(), $rules);

                if ($validator->fails()) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('validationFailed'),
                        'errors' => $validator->errors(),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $user = $request->user();
                if (!$user) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('unauthorized'),
                    ], JsonResponse::HTTP_UNAUTHORIZED);
                }

                $data = $validator->validated();
                return $this->createPaymeraPayment($data, $user);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function createPaymeraPayment(array $data, $user)
    {
        $data['payment_type'] = $this->normalizePaymentType($data['payment_type']);
        $data['payer_type'] = $this->normalizePayerType($data['payer_type']);
        $data['payment_method'] = 'online';
        $isExistingShipmentPayment = $this->isShipmentReferencePaymentType($data['payment_type']);

        if ($isExistingShipmentPayment) {
            $shipment = $this->findAuthorizedShipment((int) $data['shipment_id'], $user->id, $data['payer_type']);
            if (!$shipment) {
                return response()->json([
                    'ok' => false,
                    'message' => __('commonShipmentNotFound'),
                ], JsonResponse::HTTP_NOT_FOUND);
            }

            if (!$this->isAuthorizedPayer($shipment, (int) $user->id, $data['payer_type'])) {
                return response()->json([
                    'ok' => false,
                    'message' => __('youAreNotAllowedToPayThisShipment'),
                ], JsonResponse::HTTP_FORBIDDEN);
            }

            if ($this->isPaymentAlreadyPaidForType($shipment, $data['payment_type'], $data['payer_type'])) {
                return response()->json([
                    'ok' => true,
                    'message' => __('paymentAlreadyConfirmed'),
                    'shipment_id' => $shipment->id,
                    'payment_type' => $data['payment_type'],
                    'payer_type' => $data['payer_type'],
                ]);
            }

            $shipment = $this->prepareExistingShipmentForPayment($shipment, 'paymera', $data['payer_type']);
        } else {
            $shipment = $this->createPendingShipment($data, (int) $user->id, 'paymera', $data['payer_type']);
        }

        $amount = $this->resolvePaymentAmount($data, $shipment, $data['payer_type']);
        if ($amount <= 0) {
            return response()->json([
                'ok' => false,
                'message' => __('invalidPaymentAmount'),
            ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
        }

        $payerCode = $data['payer_type'] === self::PAYER_TYPE_SENDER ? 'SND' : 'RCV';
        $paymentTypeCode = $isExistingShipmentPayment ? 'EX' : 'NEW';
        $invoiceId = sprintf('BG-%d-%s-%s-%d', $shipment->id, $payerCode, $paymentTypeCode, now()->timestamp);
        $callbackUrl = route('customer.payments.paymera.callback', [
            'shipment_id' => $shipment->id,
            'payer_type' => $data['payer_type'],
            'app' => 'boxygo'
        ]);
        $locale = strtolower((string) ($user->language ?? 'en'));
        $lang = $locale === 'ar' ? 'ar' : 'en';

        $paymeraService = app(PaymeraPaymentService::class);
        $createResult = $paymeraService->createPayment(
            invoice: $invoiceId,
            amount: $amount,
            callbackUrl: $callbackUrl,
            lang: $lang,
            appUser: (string) $user->id,
            notes: 'Shipment #' . $shipment->order_number,
            ttl: 60
        );

        if (!$createResult || !($createResult['success'] ?? false)) {
            Log::error('Paymera: Failed to create payment', [
                'shipment_id' => $shipment->id,
                'result' => $createResult,
            ]);
            return response()->json([
                'ok' => false,
                'message' => $createResult['message'] ?? __('failedToCreateCardPaymentPleaseTryAgain'),
            ], JsonResponse::HTTP_BAD_REQUEST);
        }

        $paymentUrl = PaymeraPaymentService::extractPaymentUrl($createResult);
        $paymentId = PaymeraPaymentService::extractPaymentId($createResult);
        $guid = $createResult['data']['local_invoice']['guid'] ?? null;

        $gatewayResponse = $this->getPayerGatewayResponse($shipment, $data['payer_type']);
        $gatewayResponse['context'] = $this->buildPaymentContext(
            $data,
            $isExistingShipmentPayment,
            $amount,
            $user->id
        );
        $gatewayResponse['create'] = $createResult['data'] ?? null;
        $gatewayResponse['payment_id'] = $paymentId;

        $this->persistPaymentInitiationMetadata(
            $shipment,
            $data['payer_type'],
            'paymera',
            $invoiceId,
            $guid ?? $paymentId,
            null,
            $gatewayResponse
        );

        // if (!$isExistingShipmentPayment) {
        //     $this->sendShipmentNotifications($shipment, $data, $user);
        // }

        return response()->json([
            'ok' => true,
            'shipment_id' => $shipment->id,
            'payment_type' => $data['payment_type'],
            'payer_type' => $data['payer_type'],
            'payment_url' => $paymentUrl,
            'payment_id' => $paymentId,
        ]);
    }

    /**
     * Paymera callback — called by Paymera after payment completion.
     */
    public function paymeraCallback(Request $request)
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                Log::info('Paymera callback received', [
                    'method' => $request->method(),
                    'data' => $request->all(),
                ]);

                $invoice = $request->input('invoice_id')
                    ?? $request->input('Invoice')
                    ?? $request->input('payment_id');
                $paymentId = $request->input('payment_id')
                    ?? $request->input('Invoice')
                    ?? $request->input('invoice_id');
                $resolved = $this->resolvePaymeraShipmentContext(
                    is_scalar($invoice) ? (string) $invoice : null,
                    is_scalar($paymentId) ? (string) $paymentId : null,
                    $request->filled('payer_type') ? (string) $request->input('payer_type') : null
                );

                if (!$resolved && $request->filled('shipment_id')) {
                    $shipment = Shipment::find((int) $request->input('shipment_id'));
                    if ($shipment) {
                        $payerType = $this->resolvePayerTypeFromShipment(
                            $shipment,
                            $request->filled('payer_type') ? (string) $request->input('payer_type') : null
                        );
                        $resolved = [
                            'shipment' => $shipment,
                            'payer_type' => $payerType,
                            'invoice' => $this->getPayerInvoiceNumber($shipment, $payerType),
                        ];
                    }
                }

                if (!$resolved) {
                    return redirect()->route('home');
                }

                /** @var Shipment $shipment */
                $shipment = $resolved['shipment'];
                $payerType = $resolved['payer_type'];
                $invoiceToCheck = $resolved['invoice'] ?? null;
                if (!$invoiceToCheck) {
                    return redirect()->route('home');
                }

                $paymeraService = app(PaymeraPaymentService::class);
                $statusResult = $paymeraService->getInvoiceStatus($invoiceToCheck);
                $paymentStatus = strtolower((string) data_get($statusResult, 'data.invoice.status', ''));
                $paymentStatusPayload = $this->buildPaymentStatusPayload(
                    $paymentStatus,
                    data_get($statusResult, 'message')
                );

                $gatewayResponse = $this->getPayerGatewayResponse($shipment, $payerType);
                $gatewayResponse['callback'] = $request->all();
                $gatewayResponse['status_check'] = $statusResult['data'] ?? null;

                $alreadyPaid = $this->isPaymentAlreadyPaidByContext($shipment, $payerType);
                if ($paymentStatus === 'paid' && !$alreadyPaid) {
                    $gatewayResponse = $this->applyPostPaymentWalletProcessing($shipment, $gatewayResponse, $payerType);

                    if (!$this->isExistingShipmentPayment($shipment, $payerType)) {
                        $this->shipmentService->autoAssign($shipment->id);
                    }

                    $this->markShipmentPaidByContext($shipment, $gatewayResponse, $payerType);

                    Log::info('Paymera: Payment confirmed via callback', [
                        'shipment_id' => $shipment->id,
                        'payer_type' => $payerType,
                    ]);
                } else {
                    $this->persistPayerGatewayResponse($shipment, $payerType, $gatewayResponse);
                }

                return $this->redirectAfterPaymera($shipment, $payerType, false, $paymentStatusPayload)
                    ->with('paymentStatus', $paymentStatusPayload);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Customer return page after Paymera payment — checks status and redirects.
     */
    public function paymeraReturn(Request $request)
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $shipmentId = $request->query('shipment_id');
                $invoice = $request->query('invoice_id')
                    ?? $request->query('Invoice')
                    ?? $request->query('payment_id');
                $paymentId = $request->query('payment_id')
                    ?? $request->query('Invoice')
                    ?? $request->query('invoice_id');

                $resolved = null;
                if ($shipmentId) {
                    $shipment = Shipment::find($shipmentId);
                    if ($shipment) {
                        $payerType = $this->resolvePayerTypeFromShipment(
                            $shipment,
                            $request->filled('payer_type') ? (string) $request->query('payer_type') : null
                        );

                        if (is_string($invoice) && $shipment->reciever_payment_invoice_number === $invoice) {
                            $payerType = self::PAYER_TYPE_RECIEVER;
                        } elseif (is_string($invoice) && $shipment->payment_invoice_number === $invoice) {
                            $payerType = self::PAYER_TYPE_SENDER;
                        }

                        $resolved = [
                            'shipment' => $shipment,
                            'payer_type' => $payerType,
                            'invoice' => (is_scalar($invoice) ? (string) $invoice : null)
                                ?: $this->getPayerInvoiceNumber($shipment, $payerType),
                        ];
                    }
                } else {
                    $resolved = $this->resolvePaymeraShipmentContext(
                        is_scalar($invoice) ? (string) $invoice : null,
                        is_scalar($paymentId) ? (string) $paymentId : null,
                        $request->filled('payer_type') ? (string) $request->query('payer_type') : null
                    );
                }

                if (!$resolved) {
                    $this->sendShipmentNotifications($shipment, 'Paymera', auth()->user(), 'cancel', $payerType);
                    return redirect()->route('customer.shipments.index');
                }

                /** @var Shipment $shipment */
                $shipment = $resolved['shipment'];
                $payerType = $resolved['payer_type'];
                $invoiceToCheck = $resolved['invoice'] ?? null;
                $paymentStatus = '';
                $paymentStatusMessage = null;

                $alreadyPaid = $this->isPaymentAlreadyPaidByContext($shipment, $payerType);
                if ($invoiceToCheck && !$alreadyPaid) {
                    // Poll Paymera for final status
                    $paymeraService = app(PaymeraPaymentService::class);
                    $statusResult = $paymeraService->getInvoiceStatus($invoiceToCheck);
                    $paymentStatus = strtolower((string) data_get($statusResult, 'data.invoice.status', ''));
                    $paymentStatusMessage = data_get($statusResult, 'message');
                    $gatewayResponse = $this->getPayerGatewayResponse($shipment, $payerType);
                    $gatewayResponse['return_status_check'] = $statusResult['data'] ?? null;

                    if ($paymentStatus === 'paid' && !$alreadyPaid) {
                        $gatewayResponse = $this->applyPostPaymentWalletProcessing($shipment, $gatewayResponse, $payerType);

                        if (!$this->isExistingShipmentPayment($shipment, $payerType)) {
                            $this->shipmentService->autoAssign($shipment->id);
                        }

                        $this->markShipmentPaidByContext($shipment, $gatewayResponse, $payerType);
                    } else {
                        $this->persistPayerGatewayResponse($shipment, $payerType, $gatewayResponse);
                    }
                }

                $refreshedShipment = $shipment->fresh();
                $statusForFeedback = $paymentStatus !== ''
                    ? $paymentStatus
                    : $this->currentShipmentPaymentStatus($refreshedShipment, $payerType);
                $paymentStatusPayload = $this->buildPaymentStatusPayload($statusForFeedback, $paymentStatusMessage);

                return $this->redirectAfterPaymera($shipment, $payerType, true)
                    ->with('paymentStatus', $paymentStatusPayload);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // ─── Syriatel Payment ──────────────────────────────────────────────

    /**
     * Initiate Syriatel payment: create shipment + start payment (sends OTP).
     */
    public function initiateSyriatel(Request $request): JsonResponse
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $rules = [
                    'payment_type' => 'required|string|in:new_shipment,existing_shipment,return_shipment',
                    'payer_type' => 'required|string|in:sender,reciever,receiver',
                    'payment_method' => 'required|string|in:online',
                    'shipment_id' => 'nullable|integer|exists:shipments,id|required_if:payment_type,existing_shipment,return_shipment',
                    'payment_phone' => 'required|string',
                ];

                if ($this->normalizePaymentType($request->input('payment_type')) === self::PAYMENT_TYPE_NEW_SHIPMENT) {
                    $rules = array_merge($this->shipmentRules(), $rules);
                }

                $validator = Validator::make($request->all(), $rules);

                if ($validator->fails()) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('validationFailed'),
                        'errors' => $validator->errors(),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $user = $request->user();
                if (!$user) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('unauthorized'),
                    ], JsonResponse::HTTP_UNAUTHORIZED);
                }

                $data = $validator->validated();
                $data['payment_type'] = $this->normalizePaymentType($data['payment_type']);
                $data['payer_type'] = $this->normalizePayerType($data['payer_type']);
                $data['payment_method'] = 'online';
                $isExistingShipmentPayment = $this->isShipmentReferencePaymentType($data['payment_type']);
                $paymentPhone = (string) $data['payment_phone'];
                unset($data['payment_phone']);

                if ($isExistingShipmentPayment) {
                    $shipment = $this->findAuthorizedShipment((int) $data['shipment_id'], $user->id, $data['payer_type']);
                    if (!$shipment) {
                        return response()->json([
                            'ok' => false,
                            'message' => __('commonShipmentNotFound'),
                        ], JsonResponse::HTTP_NOT_FOUND);
                    }

                    if (!$this->isAuthorizedPayer($shipment, (int) $user->id, $data['payer_type'])) {
                        return response()->json([
                            'ok' => false,
                            'message' => __('youAreNotAllowedToPayThisShipment'),
                        ], JsonResponse::HTTP_FORBIDDEN);
                    }

                    if ($this->isPaymentAlreadyPaidForType($shipment, $data['payment_type'], $data['payer_type'])) {
                        return response()->json([
                            'ok' => true,
                            'message' => __('paymentAlreadyConfirmed'),
                            'shipment_id' => $shipment->id,
                            'payment_type' => $data['payment_type'],
                            'payer_type' => $data['payer_type'],
                        ]);
                    }

                    $shipment = $this->prepareExistingShipmentForPayment($shipment, 'syriatel', $data['payer_type']);
                } else {
                    $shipment = $this->createPendingShipment($data, (int) $user->id, 'syriatel', $data['payer_type']);
                }

                $paymentService = app(SyriatelPaymentService::class);
                $payerCode = $data['payer_type'] === self::PAYER_TYPE_SENDER ? 'SND' : 'RCV';
                $paymentTypeCode = $isExistingShipmentPayment ? 'EX' : 'NEW';
                $invoiceId = sprintf('BG-%d-%s-%s-%d', $shipment->id, $payerCode, $paymentTypeCode, now()->timestamp);
                // $invoiceId = 'SYR-' . $shipment->id;
                $amount = $this->resolvePaymentAmount($data, $shipment, $data['payer_type']);

                if ($amount <= 0) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('invalidPaymentAmount'),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $startResult = $paymentService->startPayment(
                    $invoiceId,
                    $amount,
                    $paymentPhone,
                    'Shipment #' . $shipment->order_number
                );

                if (!$startResult || !($startResult['success'] ?? false)) {
                    Log::error('Syriatel Payment: Failed to start payment', [
                        'shipment_id' => $shipment->id,
                        'result' => $startResult,
                    ]);
                    return response()->json([
                        'ok' => false,
                        'message' => $startResult['message'] ?? __('failedToInitiateSyriatelPaymentPleaseTryAgain'),
                    ], JsonResponse::HTTP_BAD_REQUEST);
                }

                $gatewayResponse = $this->getPayerGatewayResponse($shipment, $data['payer_type']);
                $gatewayResponse['context'] = $this->buildPaymentContext(
                    $data,
                    $isExistingShipmentPayment,
                    $amount,
                    $user->id
                );
                $gatewayResponse['start'] = $startResult['data'] ?? null;

                $this->persistPaymentInitiationMetadata(
                    $shipment,
                    $data['payer_type'],
                    'syriatel',
                    $invoiceId,
                    null,
                    null,
                    $gatewayResponse
                );

                // if (!$isExistingShipmentPayment) {
                //     $this->sendShipmentNotifications($shipment, $data, $user);
                // }

                return response()->json([
                    'ok' => true,
                    'shipment_id' => $shipment->id,
                    'payment_type' => $data['payment_type'],
                    'payer_type' => $data['payer_type'],
                    'payment' => [
                        'shipment_id' => $shipment->id,
                        'invoice' => $invoiceId,
                        'phone' => $paymentPhone,
                    ],
                ]);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Confirm Syriatel payment with OTP code.
     */
    public function confirmSyriatel(Request $request): JsonResponse
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $validator = Validator::make($request->all(), [
                    'shipment_id' => 'required|integer|exists:shipments,id',
                    'invoice' => 'required|string',
                    'otp' => 'required|string',
                ]);

                if ($validator->fails()) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('validationFailed'),
                        'errors' => $validator->errors(),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $data = $validator->validated();

                $shipment = $this->findAuthorizedShipment((int) $data['shipment_id'], $request->user()->id);

                if (!$shipment) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('commonShipmentNotFound'),
                    ], JsonResponse::HTTP_NOT_FOUND);
                }

                $payerType = $this->resolvePayerTypeForInvoice($shipment, $data['invoice']);
                if ($this->isPaymentAlreadyPaidByContext($shipment, $payerType)) {
                    return response()->json([
                        'ok' => true,
                        'message' => __('paymentAlreadyConfirmed'),
                        'shipment_id' => $shipment->id,
                    ]);
                }

                $paymentService = app(SyriatelPaymentService::class);
                $confirmResult = $paymentService->confirmPayment($data['invoice'], $data['otp']);

                if (!$confirmResult || !($confirmResult['success'] ?? false)) {
                    $errorMessage = $confirmResult['message'] ?? __('paymentConfirmationFailed');

                    $this->sendShipmentNotifications($shipment, 'Syriatel', auth()->user(), 'cancel', $payerType);

                    return response()->json([
                        'ok' => false,
                        'message' => $errorMessage,
                    ], JsonResponse::HTTP_BAD_REQUEST);
                }

                $gatewayResponse = $this->getPayerGatewayResponse($shipment, $payerType);
                $gatewayResponse['confirm'] = $confirmResult['data'] ?? null;
                $gatewayResponse = $this->applyPostPaymentWalletProcessing($shipment, $gatewayResponse, $payerType);
                $this->markShipmentPaidByContext($shipment, $gatewayResponse, $payerType);
                $this->sendShipmentNotifications($shipment, 'Syriatel', auth()->user(), 'complete', $payerType);
                return response()->json([
                    'ok' => true,
                    'shipment_id' => $shipment->id,
                ]);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    private function getTrackShipmentId($trackno): string
    {
        $fallbackId = $trackno ?? '';

        return $fallbackId
            ? 'SHIP-' . str_pad((string) $fallbackId, 8, '0', STR_PAD_LEFT)
            : '';
    }

    /**
     * Resend OTP for Syriatel payment.
     */
    public function resendSyriatel(Request $request): JsonResponse
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $validator = Validator::make($request->all(), [
                    'shipment_id' => 'required|integer|exists:shipments,id',
                    'invoice' => 'required|string',
                ]);

                if ($validator->fails()) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('validationFailed'),
                        'errors' => $validator->errors(),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $data = $validator->validated();

                $shipment = $this->findAuthorizedShipment((int) $data['shipment_id'], $request->user()->id);

                if (!$shipment) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('commonShipmentNotFound'),
                    ], JsonResponse::HTTP_NOT_FOUND);
                }

                $paymentService = app(SyriatelPaymentService::class);
                $resendResult = $paymentService->resendOtp($data['invoice']);

                if (!$resendResult || !($resendResult['success'] ?? false)) {
                    return response()->json([
                        'ok' => false,
                        'message' => $resendResult['message'] ?? __('failedToResendOtp'),
                    ], JsonResponse::HTTP_BAD_REQUEST);
                }

                return response()->json([
                    'ok' => true,
                    'message' => __('otpResentSuccessfully'),
                ]);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // ─── Status Check (works for MTN, Paymera, and Syriatel) ─────────

    /**
     * Check payment/invoice status.
     */
    public function status(Request $request): JsonResponse
    {
        DB::beginTransaction();
        try {
            $response = (function () use ($request) {
                $validator = Validator::make($request->all(), [
                    'shipment_id' => 'required|integer|exists:shipments,id',
                    'payer_type' => 'nullable|string|in:sender,reciever,receiver',
                ]);

                if ($validator->fails()) {
                    return response()->json([
                        'ok' => false,
                        'errors' => $validator->errors(),
                    ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
                }

                $user = $request->user();
                if (!$user) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('unauthorized'),
                    ], JsonResponse::HTTP_UNAUTHORIZED);
                }

                $shipment = $this->findAuthorizedShipment((int) $request->input('shipment_id'), $user->id);
                if (!$shipment) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('shipmentOrPaymentNotFound'),
                    ], JsonResponse::HTTP_NOT_FOUND);
                }

                $payerType = $request->filled('payer_type')
                    ? $this->normalizePayerType((string) $request->input('payer_type'))
                    : ((int) $shipment->user_id === (int) $user->id ? self::PAYER_TYPE_SENDER : self::PAYER_TYPE_RECIEVER);

                if (!$this->isAuthorizedPayer($shipment, (int) $user->id, $payerType)) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('youAreNotAllowedToCheckThisPaymentStatus'),
                    ], JsonResponse::HTTP_FORBIDDEN);
                }

                $invoiceNumber = $this->getPayerInvoiceNumber($shipment, $payerType);
                $gateway = $this->getPayerGateway($shipment, $payerType);

                if (!$invoiceNumber || !$gateway) {
                    return response()->json([
                        'ok' => false,
                        'message' => __('shipmentOrPaymentNotFound'),
                    ], JsonResponse::HTTP_NOT_FOUND);
                }

                $status = 'unknown';

                $result = null;
                if ($gateway === 'mtn') {
                    $paymentService = app(MtnPaymentService::class);
                    $result = $paymentService->getInvoice((int) $invoiceNumber);
                    $status = $result['data']['local_invoice']['status']
                        ?? $result['data']['mtn_response']['Status']
                        ?? 'unknown';
                } elseif ($gateway === 'paymera') {
                    $paymeraService = app(PaymeraPaymentService::class);
                    $result = $paymeraService->getInvoiceStatus($invoiceNumber);
                    $status = $result['data']['invoice']['status'] ?? 'unknown';
                } elseif ($gateway === 'syriatel') {
                    $syriatelService = app(SyriatelPaymentService::class);
                    $result = $syriatelService->checkStatus($invoiceNumber);
                    $status = $result['data']['status'] ?? 'unknown';
                }

                $gatewayStatus = strtolower((string) $status);
                $status = $gatewayStatus;
                if ($status === 'paid' && !$this->isPaymentAlreadyPaidByContext($shipment, $payerType)) {
                    $gatewayResponse = $this->getPayerGatewayResponse($shipment, $payerType);
                    $gatewayResponse['status_check'] = $result['data'] ?? $result;
                    $gatewayResponse = $this->applyPostPaymentWalletProcessing($shipment, $gatewayResponse, $payerType);
                    $this->markShipmentPaidByContext($shipment, $gatewayResponse, $payerType);
                } elseif (!empty($result)) {
                    $gatewayResponse = $this->getPayerGatewayResponse($shipment, $payerType);
                    $gatewayResponse['status_check'] = $result['data'] ?? $result;
                    $this->persistPayerGatewayResponse($shipment, $payerType, $gatewayResponse);
                }

                $refreshedShipment = $shipment->fresh();

                return response()->json([
                    'ok' => true,
                    'payment_type' => $this->resolvePaymentTypeFromShipment($refreshedShipment, $payerType),
                    'payer_type' => $payerType,
                    'payment_status' => $this->currentShipmentPaymentStatus($refreshedShipment, $payerType),
                    'gateway_payment_status' => $gatewayStatus,
                    'shipment_payment_status' => $this->currentShipmentPaymentStatus($refreshedShipment, $payerType),
                    'sender_payment_status' => strtolower((string) ($refreshedShipment->sender_payment_status ?? 'pending')),
                    'reciever_payment_status' => strtolower((string) ($refreshedShipment->reciever_payment_status ?? 'pending')),
                ]);
            })();
            if (method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
                DB::rollBack();
                return $response;
            }

            DB::commit();

            return $response;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // ─── Notifications ──────────────────────────────────────────────────

    private function sendShipmentNotifications(Shipment $shipment, $payment_type, $user, $type, $user_type): void
    {
        try {
            $smsService = app(MtnSmsService::class);
            $locale = strtolower((string) ($user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

            if ($type == 'complete') {
                if ($user_type == 'sender') {

                    $sender = User::where('email', $shipment->sender_email)->first();
                    if ($sender) {
                        $sender->notify(new GenericNotification(
                            shipmentId: $shipment->id,
                            trackingNumber: $shipment->order_number ?? '-',
                            title: 'dbTitlePaymentComplete',
                            description: 'dbBodyPaymentComplete',
                            type: 'shipment',
                            icon: 'payment',
                            extraDataDescription: [
                                'payment_gateway' => $payment_type ?? '-',
                            ]
                        ));
                    }

                    if ($shipment->sender_phone) {
                        $smsService->sendLocalized($shipment->sender_phone, 'smsPaymentComplete', [
                            'payment_gateway' => $payment_type ?? '-',
                        ], $locale);
                    }
                }

                if ($user_type == 'reciever') {

                    $reciever = User::where('email', $shipment->receiver_email)->first();
                    if ($reciever) {
                        $reciever->notify(new GenericNotification(
                            shipmentId: $shipment->id,
                            trackingNumber: $shipment->order_number ?? '-',
                            title: 'dbTitlePaymentComplete',
                            description: 'dbBodyPaymentComplete',
                            type: 'shipment',
                            icon: 'payment',
                            extraDataDescription: [
                                'payment_gateway' => $payment_type ?? '-',
                            ]
                        ));
                    }

                    if ($shipment->sender_phone) {
                        $smsService->sendLocalized($shipment->receiver_phone, 'smsPaymentComplete', [
                            'payment_gateway' => $payment_type ?? '-',
                        ], $locale);
                    }
                }
            } else {
                if ($user_type == 'sender') {

                    $sender = User::where('email', $shipment->sender_email)->first();
                    if ($sender) {
                        $sender->notify(new GenericNotification(
                            shipmentId: $shipment->id,
                            trackingNumber: $shipment->order_number ?? '-',
                            title: 'dbTitlePaymentFailed',
                            description: 'dbBodyPaymentFailed',
                            type: 'shipment',
                            icon: 'payment',
                            extraDataDescription: [
                                'payment_gateway' => $payment_type ?? '-',
                            ]
                        ));
                    }

                    if ($shipment->sender_phone) {
                        $smsService->sendLocalized($shipment->sender_phone, 'smsPaymentFailed', [
                            'payment_gateway' => $payment_type ?? '-',
                        ], $locale);
                    }
                }

                if ($user_type == 'reciever') {

                    $reciever = User::where('email', $shipment->receiver_email)->first();
                    if ($reciever) {
                        $reciever->notify(new GenericNotification(
                            shipmentId: $shipment->id,
                            trackingNumber: $shipment->order_number ?? '-',
                            title: 'dbTitlePaymentFailed',
                            description: 'dbBodyPaymentFailed',
                            type: 'shipment',
                            icon: 'payment',
                            extraDataDescription: [
                                'payment_gateway' => $payment_type ?? '-',
                            ]
                        ));
                    }

                    if ($shipment->sender_phone) {
                        $smsService->sendLocalized($shipment->receiver_phone, 'smsPaymentFailed', [
                            'payment_gateway' => $payment_type ?? '-',
                        ], $locale);
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Online Payment: Failed to send SMS', [
                'shipment_id' => $shipment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
