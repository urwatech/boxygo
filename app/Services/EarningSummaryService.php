<?php

namespace App\Services;

use App\Contracts\EarningSummaryServiceInterface;
use App\Helpers\helpers;
use App\Models\Parcel;
use App\Models\Shipment;
use App\Models\PaymentTransaction;
use Illuminate\Support\Facades\DB;

class EarningSummaryService implements EarningSummaryServiceInterface
{
    public function getStatistics(): array
    {
        $user = auth()->user();

        // Total earning from all completed shipments (delivery fees)
        // Apply zone filtering for non-superadmin employees
        $query = Shipment::forUser($user)
            ->whereIn('status', ['delivered', 'completed']);

        $totalEarning = $query->sum('total_fee') + $query->sum('platform_fee') + $query->sum('vat_amount');

        $overduequery = Shipment::forUser($user)
            ->whereNotIn('status', ['delivered', 'completed']);

        $overdue = $overduequery->sum('total_fee') + $overduequery->sum('platform_fee') + $overduequery->sum('vat_amount');

        // Total COD collected by riders (filtered by zone if applicable)
        $codQuery = PaymentTransaction::riderCollections()
            ->completed()
            ->where('payment_method', 'cash');

        // Filter by zone through shipments relationship if applicable
        if ($user && !$user->hasRole('superadmin') && $user->zone_id && $user->platform === 'Admin Portal') {
            $codQuery->whereHas('shipment', function ($q) use ($user) {
                $q->where('zone_id', $user->zone_id);
            });
        }
        $totalCodCollected = $codQuery->sum('amount');

        // Total online payments (filtered by zone)
        $totalOnlinePaymentquery = Shipment::forUser($user);

        $senderAmountOnlinePayment = $totalOnlinePaymentquery->clone()
            ->where('payment_method', 'online')
            ->where('sender_payment_status', 'paid')
            ->sum(
                DB::raw("
                    sender_amount 
                    + platform_fee 
                    + vat_amount
                    + (CASE 
                        WHEN delivery_fee_payer = 'sender' 
                        THEN total_fee + (CASE
                            WHEN return_delivery_fee_payer = 'sender'
                            THEN rdf_amount
                            ELSE 0
                        END) 
                        ELSE 0 
                    END)
                ")
            );

        $receiverAmountOnlinePayment = $totalOnlinePaymentquery->clone()
            ->where('receiver_payment_method', 'online')
            ->where('payment_status', 'paid')
            ->sum(
                DB::raw("
                    parcel_amount 
                    + (CASE 
                        WHEN delivery_fee_payer = 'receiver' 
                        THEN total_fee 
                        ELSE 0 
                    END)
                ")
            );

        $totalOnlinePayments = $senderAmountOnlinePayment + $receiverAmountOnlinePayment;

        // Available to withdraw (COD collected but not settled with admin, filtered by zone)
        $availableQuery = PaymentTransaction::riderCollections()
            ->completed()
            ->whereNull('settled_at');

        if ($user && !$user->hasRole('superadmin') && $user->zone_id && $user->platform === 'Admin Portal') {
            $availableQuery->whereHas('shipment', function ($q) use ($user) {
                $q->where('zone_id', $user->zone_id);
            });
        }
        $availableToWithdraw = $availableQuery->sum('amount');

        // Overdue settlements (collected more than 7 days ago but not settled, filtered by zone)
        $sevenDaysAgo = now()->subDays(7);
        $overdueQuery = PaymentTransaction::riderCollections()
            ->completed()
            ->whereNull('settled_at')
            ->where('collected_at', '<=', $sevenDaysAgo);

        if ($user && !$user->hasRole('superadmin') && $user->zone_id && $user->platform === 'Admin Portal') {
            $overdueQuery->whereHas('shipment', function ($q) use ($user) {
                $q->where('zone_id', $user->zone_id);
            });
        }
        $overdueSettlements = $overdueQuery->sum('amount');

        // Unassigned shipments (door-to-door shipments without a rider that are pending)
        $unassignedCount = Shipment::forUser($user)
            ->whereNull('rider_id')
            ->where(function ($query) {
                $query->where('delivery_speed', 'direct')
                    ->orWhere(function ($subQuery) {
                        $subQuery->where('delivery_speed', 'indirect')
                            ->whereIn('indirect_delivery_mode', ['door_to_door', 'door_to_drop_point']);
                    });
            })
            ->whereIn('status', ['pending', 'created'])
            ->count();

        return [
            'total_earning' => $this->formatAmount($totalEarning),
            'available_to_withdraw' => $this->formatAmount($availableToWithdraw),
            'total_cod_collected' => $this->formatAmount($totalCodCollected),
            'total_online_payments' => $this->formatAmount($totalOnlinePayments),
            'overdue_settlements' => $this->formatAmount($overdue),
            'unassigned' => $unassignedCount,
        ];
    }

    /**
     * Format amount to display in K format
     */
    private function formatAmount(float $amount): string
    {
        if ($amount >= 1000) {
            return number_format($amount / 1000, 1) . 'k';
        }

        return number_format($amount, 0);
    }

    public function paginateJobs(string $search = '', array $filters = [], int $perPage = 10): mixed
    {
        $user = auth()->user();

        $query = Shipment::query()
            ->forUser($user)
            ->with([
                'rider:id,name,avatar_path,phone_number',
                'rider.roles:id,name',
                'rider.vehicles:id,user_id,type,status',
                'user:id,name',
                'size',
                'directStatus:id,shipment_id,current_index',
                'indirectStatus:id,shipment_id,current_index',
                'latestStatusHistory',
                'statusHistory:id,shipment_id,to_status,progress_index,created_at',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'review',
            ])
            ->orderBy('created_at', 'desc');

        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                    ->orWhereHas('rider', function ($subQ) use ($search) {
                        $subQ->where('name', 'like', "%{$search}%");
                    })
                    ->orWhere('order_number', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($subQ) use ($search) {
                        $subQ->where('name', 'like', "%{$search}%");
                    })
                    ->orWhere('sender_name', 'like', "%{$search}%");
            });
        }

        // Apply status filter
        if (isset($filters['status']) && $filters['status'] !== 'All') {
            $query->where('status', strtolower($filters['status']));
        }

        $paginator = $query->paginate($perPage);

        // Transform the data
        $paginator->getCollection()->transform(function ($shipment) {
            $sizeRelation = $shipment->getRelation('size');
            $sizeModel = $sizeRelation instanceof Parcel ? $sizeRelation : null;

            $sizeName = $sizeModel?->name;
            if (!$sizeName) {
                $rawSize = $shipment->getAttribute('size');
                $sizeName = is_string($rawSize) && $rawSize !== '' ? $rawSize : null;
            }

            $sizeDetails = $sizeModel
                ? $sizeModel->only([
                    'id',
                    'name',
                    'description',
                    'length_cm',
                    'width_cm',
                    'height_cm',
                    'min_weight_kg',
                    'max_weight_kg',
                ])
                : ($sizeName ? ['id' => null, 'name' => $sizeName] : null);

            // Get the latest status from status history (same logic as ShipmentService)
            $latestStatus = $shipment->latestStatusHistory?->to_status ?? $shipment->status;

            // Format the status for display (handles "Pending Handover" -> "Delivered" conversion)
            $formattedStatus = $this->formatStatus($shipment, $latestStatus);

            $roleMeta = $this->resolveEmployeeRoleMeta($shipment->rider);

            return [
                'id' => $shipment->id,
                'ship_id' => 'MP' . str_pad($shipment->id, 7, '0', STR_PAD_LEFT),
                'order_number' => $shipment->order_number,
                'rider' => $shipment->rider?->name ?? 'Unassigned',
                'rider_role' => $roleMeta['label'],
                'rider_role_key' => $roleMeta['key'],
                'rider_avatar' => $shipment->rider?->avatar_path ? media_url($shipment->rider->avatar_path) : null,
                'rider_phone' => $shipment->rider?->phone_number,
                'sender' => $shipment->sender_name ?? $shipment->user?->name ?? 'N/A',
                'pickup_location' => $shipment->handover_address ?? null,
                'dropoff_location' => $shipment->delivery_address ?? null,
                'parcel_type' => $sizeName ?? 'N/A',
                'receiver_city' => $this->extractCity($shipment->delivery_address),
                'shipment_type' => $this->getShipmentType($shipment),
                'mode' => $this->getDeliveryMode($shipment),
                'vehicle_type' => $this->resolveVehicleType($shipment),
                'status' => $formattedStatus, // Use formatted status
                'delivery_speed' => $shipment->delivery_speed,
                'indirect_delivery_mode' => $shipment->indirect_delivery_mode,
                'consignment_type' => $shipment->consignment_type,
                'size' => $sizeDetails,
                'weight' => $shipment->weight,
                'parcel_amount' => $shipment->parcel_amount,
                'total_fee' => $shipment->total_fee,
                'booking_type' => $shipment->booking_type,
                'insurance' => $shipment->insurance,
                'payment_status' => $shipment->payment_status,
                'payment_method' => $shipment->payment_method,
                'payment' => \App\Support\ShipmentPaymentHelper::calculatePaymentDetails($shipment),
                'photos' => $shipment->photos ?? [],
                'additional_docs' => $shipment->additional_docs ?? [],
                'notes' => $shipment->special_instruction ?? null,
                'direct_status' => $shipment->directStatus
                    ? [
                        'current_index' => $shipment->directStatus->current_index,
                    ]
                    : null,
                'indirect_status' => $shipment->indirectStatus
                    ? [
                        'current_index' => $shipment->indirectStatus->current_index,
                    ]
                    : null,
                'status_history' => $shipment->statusHistory
                    ? $shipment->statusHistory
                    ->filter(function ($history) use ($shipment) {
                        // Filter out door delivery statuses for drop point delivery modes
                        if (
                            $shipment->delivery_speed === 'indirect' &&
                            in_array($shipment->indirect_delivery_mode, ['door_to_drop_point', 'drop_point_to_drop_point'], true)
                        ) {
                            $doorOnlyStatuses = [
                                \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
                                \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
                                \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
                            ];
                            if (in_array($history->to_status, $doorOnlyStatuses, true)) {
                                return false;
                            }
                        }

                        // Filter out initial pickup statuses for drop_point_to_* modes
                        if (
                            $shipment->delivery_speed === 'indirect' &&
                            in_array($shipment->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true)
                        ) {
                            $pickupOnlyStatuses = [
                                \App\Enums\ShipmentStatus::ASSIGNED->value,
                                \App\Enums\ShipmentStatus::PICKUP->value,
                                \App\Enums\ShipmentStatus::IN_TRANSIT->value,
                                \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
                            ];
                            if (in_array($history->to_status, $pickupOnlyStatuses, true)) {
                                return false;
                            }
                        }

                        return true;
                    })
                    ->map(static function ($history) {
                        return [
                            'to_status' => $history->to_status,
                            'progress_index' => $history->progress_index,
                            'created_at' => optional($history->created_at)->toIso8601String(),
                        ];
                    })
                    ->values()
                    ->all()
                    : [],
                'rider_collection' => $shipment->riderCollection ? [
                    'rider_deposited_at' => $shipment->riderCollection->rider_deposited_at,
                    'settled_at' => $shipment->riderCollection->settled_at,
                    'status' => $shipment->riderCollection->status,
                ] : null,
                'car_driver_collection' => $shipment->carDriverCollection ? [
                    'rider_deposited_at' => $shipment->carDriverCollection->rider_deposited_at,
                    'settled_at' => $shipment->carDriverCollection->settled_at,
                    'status' => $shipment->carDriverCollection->status,
                ] : null,
                'drop_point_keeper_collection' => $shipment->dropPointKeeperCollection ? [
                    'rider_deposited_at' => $shipment->dropPointKeeperCollection->rider_deposited_at,
                    'settled_at' => $shipment->dropPointKeeperCollection->settled_at,
                    'status' => $shipment->dropPointKeeperCollection->status,
                ] : null,
                'admin_settlement' => $shipment->adminSettlement ? [
                    'settled_at' => $shipment->adminSettlement->settled_at,
                    'collected_by' => $shipment->adminSettlement->collected_by,
                    'status' => $shipment->adminSettlement->status,
                ] : null,
                'review' => helpers::getShipmentUsers($shipment->id)
            ];
        });

        return $paginator;
    }

    private function getShipmentType($shipment): string
    {
        if ($shipment->delivery_speed === 'direct') {
            return 'Direct/DD';
        }
        return 'In-Direct/DP';
    }

    private function getDeliveryMode($shipment): string
    {
        // For direct delivery, always door-to-door
        if ($shipment->delivery_speed === 'direct') {
            return 'Door-to-Door';
        }

        // For indirect delivery, check the indirect_delivery_mode
        if ($shipment->delivery_speed === 'indirect' && $shipment->indirect_delivery_mode) {
            return match ($shipment->indirect_delivery_mode) {
                'door_to_door' => 'Door-to-Door',
                'door_to_drop_point' => 'Door-to-DropPoint',
                'drop_point_to_door' => 'DropPoint-to-Door',
                'drop_point_to_drop_point' => 'DropPoint-to-DropPoint',
                default => 'Door-to-Door',
            };
        }

        return 'Door-to-Door';
    }

    private function resolveVehicleType(Shipment $shipment): string
    {
        $rider = $shipment->rider;
        if (!$rider) {
            return 'Unassigned';
        }

        $vehicles = $rider->relationLoaded('vehicles')
            ? $rider->vehicles
            : $rider->vehicles()->get();

        if ($vehicles && $vehicles->count() > 0) {
            $activeVehicle = $vehicles->first(function ($vehicle) {
                return strtolower((string) $vehicle->status) === 'active';
            });
            $vehicle = $activeVehicle ?? $vehicles->first();

            if ($vehicle && $vehicle->type) {
                return $vehicle->type;
            }
        }

        return 'N/A';
    }

    private function extractCity($address): string
    {
        // Extract city from address - simple implementation
        // You might want to improve this based on your address format
        if (!$address) {
            return 'N/A';
        }
        $parts = explode(',', $address);
        return trim(end($parts));
    }

    /**
     * Format status for display.
     * Prefers payment lifecycle (Pending Handover -> Collected -> Settled) for COD shipments,
     * otherwise falls back to shipment timeline statuses.
     */
    private function formatStatus($shipment, string $status): string
    {
        $normalizedStatus = trim($status);

        // Prefer payment-based status for COD shipments
        $financialStatus = $this->determineFinancialStatus($shipment, $normalizedStatus);
        if ($financialStatus !== null) {
            return $financialStatus;
        }

        // For empty or pending status fall back to Pending/Unassigned logic
        if (!$normalizedStatus || strtolower($normalizedStatus) === 'pending') {
            $isDoorDelivery = $shipment->delivery_speed === 'direct' ||
                ($shipment->delivery_speed === 'indirect'
                    && in_array($shipment->indirect_delivery_mode, ['door_to_door', 'door_to_drop_point'], true));

            if ($isDoorDelivery && !$shipment->rider_id) {
                return 'Unassigned';
            }

            return 'Pending';
        }

        if (
            $normalizedStatus === \App\Enums\ShipmentStatus::PENDING_HANDOVER->value ||
            strtolower($normalizedStatus) === 'pending handover'
        ) {
            return 'Pending Handover';
        }

        return $normalizedStatus;
    }

    private function determineFinancialStatus($shipment, string $normalizedStatus): ?string
    {
        $paymentMethod = strtolower((string) $shipment->payment_method);
        if ($paymentMethod !== 'cash') {
            return null;
        }

        if ($this->hasSettlementRecord($shipment)) {
            return 'Settled';
        }

        if ($this->hasCollectedPayment($shipment)) {
            return 'Collected';
        }

        if ($this->hasReachedDeliveryMilestone($shipment, $normalizedStatus)) {
            return 'Pending Handover';
        }

        return null;
    }

    private function hasSettlementRecord($shipment): bool
    {
        if ($shipment->relationLoaded('adminSettlement') && $shipment->adminSettlement?->settled_at) {
            return true;
        }

        foreach (['riderCollection', 'carDriverCollection', 'dropPointKeeperCollection'] as $relation) {
            if ($shipment->relationLoaded($relation) && $shipment->{$relation}?->settled_at) {
                return true;
            }
        }

        return false;
    }

    private function hasCollectedPayment($shipment): bool
    {
        foreach (['riderCollection', 'carDriverCollection', 'dropPointKeeperCollection'] as $relation) {
            if (!$shipment->relationLoaded($relation) || !$shipment->{$relation}) {
                continue;
            }

            $collection = $shipment->{$relation};
            if ($collection->collected_at || $collection->rider_deposited_at) {
                return true;
            }
        }

        return false;
    }

    private function hasReachedDeliveryMilestone($shipment, string $status): bool
    {
        $normalized = strtolower($status);
        $deliveredStatuses = [
            strtolower(\App\Enums\ShipmentStatus::DELIVERED->value),
            strtolower(\App\Enums\ShipmentStatus::PICKED_UP_BY_RECEIVER->value),
            strtolower(\App\Enums\ShipmentStatus::PENDING_HANDOVER->value),
            'completed',
        ];

        if ($normalized && in_array($normalized, $deliveredStatuses, true)) {
            return true;
        }

        if ($shipment->relationLoaded('latestStatusHistory') && $shipment->latestStatusHistory) {
            $latest = strtolower($shipment->latestStatusHistory->to_status ?? '');
            if ($latest && in_array($latest, $deliveredStatuses, true)) {
                return true;
            }
        }

        if ($shipment->relationLoaded('statusHistory') && $shipment->statusHistory) {
            foreach ($shipment->statusHistory as $history) {
                $historyStatus = strtolower($history->to_status ?? '');
                if ($historyStatus && in_array($historyStatus, $deliveredStatuses, true)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function resolveEmployeeRoleMeta(?\App\Models\User $user): array
    {
        if (!$user) {
            return ['label' => 'Unassigned', 'key' => 'unassigned'];
        }

        $roleName = $user->roles?->pluck('name')->first();

        return match ($roleName) {
            \App\Enums\Role::CAR_DRIVER->value => ['label' => 'Car Driver', 'key' => 'car_driver'],
            \App\Enums\Role::DROP_POINT_KEEPER->value => ['label' => 'Drop Point Keeper', 'key' => 'drop_point_keeper'],
            \App\Enums\Role::WAREHOUSE_KEEPER->value => ['label' => 'Warehouse Keeper', 'key' => 'warehouse_keeper'],
            default => ['label' => 'Rider', 'key' => 'rider'],
        };
    }
}
