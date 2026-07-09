<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\DeliveryStage;
use App\Enums\Role as RoleEnum;
use App\Enums\ShipmentStatus;
use App\Helpers\helpers;
use App\Http\Controllers\Controller;
use App\Models\Shipment;
use App\Models\User;
use App\Services\ShipmentService;
use App\Services\ShipmentTrackingService;
use App\Support\AdminRouteResolver;
use App\Support\FinancialSettings;
use App\Support\SortHelper;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display the admin dashboard.
     */
    public function index(Request $request): Response
    {
        $user = auth()->user();

        if (! $user || ! $user->can('admin.access')) {
            abort(401);
        }

        // Get statistics (filtered by zone if applicable)
        $stats = $this->getStatistics($user);

        $allowedPageSizes = [10, 25, 50, 100];
        $perPage = (int) $request->integer('per_page', 100000000);
        // if (!in_array($perPage, $allowedPageSizes, true)) {
        //     $perPage = 10;
        // }

        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $selectedDate = trim((string) $request->query('date', ''));
        $sortBy = trim((string) $request->query('sort_by', 'date'));
        $sortKey = SortHelper::key($sortBy);
        $allowedSorts = ['rider', 'date', 'status', 'location', 'order_number', 'sender', 'receiver', 'total_fee', 'payment_status', 'delivery_speed', 'updated_at'];
        if (! in_array($sortKey, $allowedSorts, true)) {
            $sortKey = 'date';
            $sortBy = 'date';
        }
        $defaultSortDir = $sortKey === 'date' || $sortKey === 'updated_at' || $sortKey === 'total_fee' ? 'desc' : 'asc';
        $sortDir = SortHelper::direction($request->query('sort_dir'), $defaultSortDir);

        // Get all shipments ordered by creation/update date so the newest appear first
        // Apply zone filtering for non-superadmin employees
        $shipmentsQuery = Shipment::query()
            ->forUser($user)
            ->with([
                'user:id,name,avatar_path,phone_number',
                'rider:id,name,avatar_path,phone_number',
                'rider.roles:id,name',
                'rider.vehicles:id,user_id,type',
                'deliveryRider:id,name,avatar_path,phone_number',
                'deliveryRider.roles:id,name',
                'deliveryRider.vehicles:id,user_id,type',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
                'directStatus',
                'indirectStatus',
                'size',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'review' => function ($query) {
                    $query->with(['rider' => function ($q) {
                        $q->select('id', 'name', 'avatar_path', 'phone_number');
                    }]);
                },
            ])
            ->where(function ($query) {
                $query->where('payment_method', '!=', 'online')
                    ->orWhere(function ($q) {
                        $q->where('payment_method', 'online')
                            ->where('sender_payment_status', 'paid');
                    });
            });

        if ($search !== '') {
            $shipmentsQuery->where(function ($query) use ($search) {
                $query->where('shipments.order_number', 'like', "%{$search}%")
                    ->orWhere('shipments.sender_name', 'like', "%{$search}%")
                    ->orWhere('shipments.receiver_name', 'like', "%{$search}%")
                    ->orWhere('shipments.status', 'like', "%{$search}%")
                    ->orWhere('shipments.delivery_speed', 'like', "%{$search}%")
                    ->orWhereHas('rider', function ($riderQuery) use ($search) {
                        $riderQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($selectedDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $selectedDate)) {
            $shipmentsQuery->whereDate('shipments.created_at', $selectedDate);
        }

        $this->applyShipmentStatusFilter($shipmentsQuery, $status);

        match ($sortKey) {
            'rider' => $shipmentsQuery
                ->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = shipments.rider_id LIMIT 1), '') {$sortDir}")
                ->orderBy('shipments.created_at', 'desc'),
            'status' => $shipmentsQuery
                ->orderBy('shipments.status', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'location' => $shipmentsQuery
                ->orderBy('shipments.receiver_name', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'order_number' => $shipmentsQuery
                ->orderBy('shipments.order_number', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'sender' => $shipmentsQuery
                ->orderBy('shipments.sender_name', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'receiver' => $shipmentsQuery
                ->orderBy('shipments.receiver_name', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'total_fee' => $shipmentsQuery
                ->orderBy('shipments.total_fee', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'payment_status' => $shipmentsQuery
                ->orderBy('shipments.payment_status', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'delivery_speed' => $shipmentsQuery
                ->orderBy('shipments.delivery_speed', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            'updated_at' => $shipmentsQuery
                ->orderBy('shipments.updated_at', $sortDir)
                ->orderBy('shipments.created_at', 'desc'),
            default => $shipmentsQuery
                ->orderBy('shipments.created_at', $sortDir)
                ->orderBy('shipments.updated_at', $sortDir),
        };

        $shipments = $shipmentsQuery
            ->paginate($perPage)
            ->withQueryString()
            ->through(function ($shipment) {

                $shipmentUsers = helpers::getShipmentUsers($shipment->id);

                $senderDropPoint = null;
                $receiverDropPoint = null;
                foreach ($shipmentUsers as $user) {
                    if ($user['roles'] === RoleEnum::DROP_POINT_KEEPER->value) {

                        if (! $senderDropPoint) {
                            $senderDropPoint = [
                                'id' => $user['drop_point_id'],
                                'name' => $user['name'],
                            ];
                        } else {
                            $receiverDropPoint = [
                                'id' => $user['drop_point_id'],
                                'name' => $user['name'],
                            ];
                        }
                    }
                }

                $roleMeta = $this->resolveEmployeeRoleMeta($shipment->rider);
                $deliveryRoleMeta = $this->resolveEmployeeRoleMeta($shipment->deliveryRider);
                // Get current status from latest status history
                $currentStatus = $shipment->latestStatusHistory?->to_status ?? $shipment->status ?? 'pending';

                // Format the status for display (this handles "Pending Handover" -> "Delivered" conversion)
                $formattedStatus = $this->formatStatus($shipment, $currentStatus);

                // drop_point_to_drop_point: never needs rider assignment
                $isDropPointToDropPoint = $shipment->delivery_speed === 'indirect'
                    && $shipment->indirect_delivery_mode === 'drop_point_to_drop_point';

                // drop_point_to_door and door_to_door: need a delivery rider assigned at DP2
                $isDoorDelivery = $shipment->delivery_speed === 'indirect'
                    && in_array($shipment->indirect_delivery_mode, ['door_to_door', 'drop_point_to_door'], true);

                // drop_point_to_door: no pickup rider (customer brings to DP1)
                $isDropPointToDoor = $shipment->delivery_speed === 'indirect'
                    && $shipment->indirect_delivery_mode === 'drop_point_to_door';

                $atDP2Statuses = [
                    ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
                    ShipmentStatus::READY_FOR_PICKUP->value,
                    ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
                    ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
                    ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
                ];
                $isAtDP2 = in_array($currentStatus, $atDP2Statuses, true);

                // Determine if the table action should show "Assign" or "View Details"
                if ($isDropPointToDropPoint) {
                    // drop_point_to_drop_point: no rider ever needed from admin table
                    $needsAssignment = false;
                } elseif ($isDoorDelivery && $isAtDP2 && ! $shipment->delivery_rider_id) {
                    // door_to_door or drop_point_to_door at DP2: needs delivery rider
                    $needsAssignment = true;
                } else {
                    // All other modes: show "Assign" only if no pickup rider yet
                    // drop_point_to_door before DP2 has no pickup rider so stays "View Details"
                    $needsAssignment = $isDropPointToDoor ? false : ! $shipment->rider_id;
                }

                return [
                    'id' => $shipment->id,
                    'ship_id' => 'MP'.str_pad($shipment->id, 7, '0', STR_PAD_LEFT),
                    'order_number' => $shipment->order_number,
                    'zone_id' => $shipment->zone_id,
                    'booking_type' => $shipment->booking_type,
                    'handover_latitude' => $shipment->handover_latitude,
                    'handover_longitude' => $shipment->handover_longitude,
                    'rider' => $shipment->rider?->name ?? '--',
                    'rider_id' => $shipment->rider_id,
                    'rider_avatar' => media_url($shipment->rider?->avatar_path),
                    'rider_phone' => $shipment->rider?->phone_number,
                    'rider_role' => $roleMeta['label'],
                    'rider_role_key' => $roleMeta['key'],
                    'delivery_rider' => $shipment->deliveryRider?->name ?? '--',
                    'delivery_rider_id' => $shipment->delivery_rider_id,
                    'delivery_rider_avatar' => media_url($shipment->deliveryRider?->avatar_path),
                    'delivery_rider_phone' => $shipment->deliveryRider?->phone_number,
                    'delivery_rider_role' => $deliveryRoleMeta['label'],
                    'delivery_rider_role_key' => $deliveryRoleMeta['key'],
                    'delivery_fee_payer' => $shipment->delivery_fee_payer,
                    'reciever_zone_delivery_fee' => $shipment->reciever_zone_delivery_fee,
                    'sender_zone_delivery_fee' => $shipment->sender_zone_delivery_fee,
                    'customer_avatar' => media_url($shipment->user?->avatar_path),
                    'reciever_payment_method' => $shipment->payment_method,
                    'customer_name' => $shipment->user?->name,
                    'customer_phone' => $shipment->user?->phone_number,
                    'date' => $shipment->created_at->format('Y-m-d'),
                    'sender' => $shipment->sender_name ?? 'N/A',
                    'sender_phone' => $shipment->sender_phone ?? null,
                    'receiver' => $shipment->receiver_name ?? 'N/A',
                    'receiver_phone' => $shipment->receiver_phone ?? null,
                    'shipment_type' => $this->getShipmentType($shipment),
                    'delivery_speed' => $shipment->delivery_speed,
                    'indirect_delivery_mode' => $shipment->indirect_delivery_mode,
                    'consignment_type' => $shipment->consignment_type,
                    'return_status' => $shipment->return_status,
                    'return_images' => $shipment->return_images,
                    'return_reason' => $shipment->return_reason,
                    'vehicle_type' => $this->getVehicleType($shipment),
                    'status' => $formattedStatus,
                    'status_color' => $this->getStatusColor($formattedStatus),
                    'action' => $needsAssignment ? 'Assign' : 'View Detail',
                    // Drawer extra details
                    'pickup_location' => $shipment->handover_address ?? '--',
                    'dropoff_location' => $shipment->delivery_address ?? '--',
                    'weight' => $shipment->weight,
                    'weight_text' => $shipment->weight ? ($shipment->weight.' kg') : '--',
                    'size' => $shipment->size,
                    'size_text' => $this->formatSize($shipment),
                    'insurance' => $this->formatInsuranceText($shipment->insurance),
                    'value_text' => $shipment->parcel_amount !== null ? (number_format((float) $shipment->parcel_amount).' SYP') : '--',
                    'total_fee' => $shipment->total_fee !== null ? (number_format((float) $shipment->total_fee).' SYP') : '--',
                    'parcel_amount' => $shipment->parcel_amount,
                    'service_fee' => $shipment->service_fee,
                    'platform_fee' => $shipment->platform_fee ?? $shipment->platform_fee_amount ?? config('pricing.platform_fee', 5),
                    'vat_rate' => $shipment->vat_rate ?? $shipment->vat_percentage ?? config('pricing.vat_rate', 0.05),
                    'insurance_text' => $this->formatInsuranceText($shipment->insurance),
                    'payment_status' => $shipment->payment_status ?? '--',
                    'payment_method' => $shipment->payment_method ?? '--',
                    'payment' => \App\Support\ShipmentPaymentHelper::calculatePaymentDetails($shipment),
                    'accept_returns' => $shipment->accept_returns,
                    'photos' => $shipment->photos ?? [],
                    'additional_docs' => $shipment->additional_docs ?? [],
                    'special_instruction' => $shipment->special_instruction ?? '',
                    'admin_notes' => $shipment->admin_notes,
                    'is_diff_city' => $shipment->is_diff_city,
                    'adminSettlement' => $shipment->adminSettlement ? [
                        'id' => $shipment->adminSettlement->id,
                        'collected_by_name' => $shipment->adminSettlement->collectedBy?->name,
                    ] : null,
                    'review' => $shipmentUsers,
                    'sender_drop_point' => $senderDropPoint,
                    'receiver_drop_point' => $receiverDropPoint,
                    // Status tracking data - critical for timeline display
                    'status_history' => $shipment->statusHistory
                        ? $shipment->statusHistory
                            ->filter(function ($history) use ($shipment) {
                                // Filter out door delivery statuses for drop point delivery modes
                                if ($shipment->delivery_speed === 'indirect' &&
                                    in_array($shipment->indirect_delivery_mode, ['door_to_drop_point', 'drop_point_to_drop_point'], true)) {
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
                                if ($shipment->delivery_speed === 'indirect' &&
                                    in_array($shipment->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true)) {
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
                                    'from_status' => $history->from_status,
                                    'progress_index' => $history->progress_index,
                                    'created_at' => optional($history->created_at)->toIso8601String(),
                                ];
                            })
                            ->values()
                            ->all()
                        : [],
                    'direct_status' => $shipment->directStatus ? [
                        'current_index' => $shipment->directStatus->current_index,
                    ] : null,
                    'indirect_status' => $shipment->indirectStatus ? [
                        'current_index' => $shipment->indirectStatus->current_index,
                    ] : null,
                    // Raw shipment data for fallback
                    'raw' => [
                        'id' => $shipment->id,
                        'order_number' => $shipment->order_number,
                        'tracking_number' => 'SHIP-'.str_pad($shipment->id, 8, '0', STR_PAD_LEFT),
                        'zone_id' => $shipment->zone_id,
                        'handover_latitude' => $shipment->handover_latitude,
                        'handover_longitude' => $shipment->handover_longitude,
                        'status' => $shipment->status,
                        'delivery_speed' => $shipment->delivery_speed,
                        'indirect_delivery_mode' => $shipment->indirect_delivery_mode,
                        'consignment_type' => $shipment->consignment_type,
                        'weight' => $shipment->weight,
                        'custom_length' => $shipment->custom_length,
                        'custom_width' => $shipment->custom_width,
                        'custom_height' => $shipment->custom_height,
                        'parcel_amount' => $shipment->parcel_amount,
                        'service_fee' => $shipment->service_fee,
                        'insurance' => $shipment->insurance,
                        'payment_method' => $shipment->payment_method,
                        'payment_status' => $shipment->payment_status,
                        'total_fee' => $shipment->total_fee,
                        'platform_fee' => $shipment->platform_fee ?? $shipment->platform_fee_amount,
                        'vat_rate' => $shipment->vat_rate ?? $shipment->vat_percentage,
                        'payment' => \App\Support\ShipmentPaymentHelper::calculatePaymentDetails($shipment),
                        'accept_returns' => $shipment->accept_returns,
                        'special_instruction' => $shipment->special_instruction,
                        'admin_notes' => $shipment->admin_notes,
                        'size' => $shipment->size ? [
                            'name' => $shipment->size->name ?? null,
                        ] : null,
                        'status_history' => $shipment->statusHistory
                            ? $shipment->statusHistory
                                ->filter(function ($history) use ($shipment) {
                                    // Filter out door delivery statuses for drop point delivery modes
                                    if ($shipment->delivery_speed === 'indirect' &&
                                        in_array($shipment->indirect_delivery_mode, ['door_to_drop_point', 'drop_point_to_drop_point'], true)) {
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
                                    if ($shipment->delivery_speed === 'indirect' &&
                                        in_array($shipment->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true)) {
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
                                        'from_status' => $history->from_status,
                                        'progress_index' => $history->progress_index,
                                        'created_at' => optional($history->created_at)->toIso8601String(),
                                    ];
                                })
                                ->values()
                                ->all()
                            : [],
                        'direct_status' => $shipment->directStatus ? [
                            'current_index' => $shipment->directStatus->current_index,
                        ] : null,
                        'indirect_status' => $shipment->indirectStatus ? [
                            'current_index' => $shipment->indirectStatus->current_index,
                        ] : null,
                    ],
                ];
            });

        return Inertia::render('SuperAdmin/Dashboard', [
            'stats' => $stats,
            'shipments' => $shipments,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'date' => $selectedDate,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
                'per_page' => $perPage,
            ],
            'riders' => $this->getRidersList($user),
            'heatmapShipments' => $this->getHeatmapShipments($user),
            'heatmapRiders' => $this->getHeatmapRiders($user),
            'financialSettings' => $this->getFinancialSettings(),
        ]);
    }

    private function getFinancialSettings(): array
    {
        return FinancialSettings::get();
    }

    private function applyShipmentStatusFilter($query, string $status): void
    {
        $statusKey = $this->normalizeShipmentStatusFilter($status);

        if ($statusKey === null) {
            return;
        }

        $query->where(function ($statusQuery) use ($statusKey) {
            $statuses = match ($statusKey) {
                'pending' => [ShipmentStatus::PENDING->value, 'new', 'created'],
                'in_progress' => $this->dashboardInProgressStatuses(),
                'completed' => [
                    ShipmentStatus::COMPLETED->value,
                    ShipmentStatus::DELIVERED->value,
                    ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
                    ShipmentStatus::PENDING_HANDOVER->value,
                ],
                'cancelled' => [
                    ShipmentStatus::CANCELLED->value,
                    ShipmentStatus::CANCELLED_DRIVER->value,
                    ShipmentStatus::CANCELLED_KEEPER->value,
                    ShipmentStatus::FAILED->value,
                    ShipmentStatus::INCOMPLETE->value,
                ],
                default => [$statusKey],
            };

            $normalizedStatuses = array_values(array_unique(array_filter(array_map(
                fn ($value) => strtolower(trim((string) $value)),
                $statuses
            ))));

            if ($normalizedStatuses === []) {
                return;
            }

            $placeholders = implode(', ', array_fill(0, count($normalizedStatuses), '?'));

            if ($statusKey === 'pending') {
                $statusQuery->whereNull('shipments.status')
                    ->orWhereRaw("LOWER(TRIM(shipments.status)) IN ({$placeholders})", $normalizedStatuses)
                    ->orWhereRaw("TRIM(shipments.status) = ''")
                    ->orWhereHas('latestStatusHistory', function ($historyQuery) use ($placeholders, $normalizedStatuses) {
                        $historyQuery->whereRaw("LOWER(TRIM(to_status)) IN ({$placeholders})", $normalizedStatuses);
                    });

                return;
            }

            $statusQuery
                ->whereRaw("LOWER(TRIM(shipments.status)) IN ({$placeholders})", $normalizedStatuses)
                ->orWhereHas('latestStatusHistory', function ($historyQuery) use ($placeholders, $normalizedStatuses) {
                    $historyQuery->whereRaw("LOWER(TRIM(to_status)) IN ({$placeholders})", $normalizedStatuses);
                });
        });
    }

    private function normalizeShipmentStatusFilter(string $status): ?string
    {
        $status = trim($status);

        if ($status === '') {
            return null;
        }

        $lower = strtolower($status);
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '_', $lower), '_');
        $map = [
            'all' => null,
            'in progress' => 'in_progress',
            'in_progress' => 'in_progress',
            'progress' => 'in_progress',
            'pending' => 'pending',
            'completed' => 'completed',
            'complete' => 'completed',
            'delivered' => 'completed',
            'cancelled' => 'cancelled',
            'canceled' => 'cancelled',
        ];

        return $map[$lower] ?? $map[$slug] ?? $lower;
    }

    private function dashboardInProgressStatuses(): array
    {
        $finalStatuses = [
            ShipmentStatus::PENDING->value,
            ShipmentStatus::COMPLETED->value,
            ShipmentStatus::DELIVERED->value,
            ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            ShipmentStatus::CANCELLED->value,
            ShipmentStatus::CANCELLED_DRIVER->value,
            ShipmentStatus::CANCELLED_KEEPER->value,
            ShipmentStatus::FAILED->value,
            ShipmentStatus::INCOMPLETE->value,
            ShipmentStatus::RETURNED->value,
            ShipmentStatus::NOT_RETURNED->value,
        ];

        $statuses = array_map(
            fn (ShipmentStatus $shipmentStatus) => $shipmentStatus->value,
            array_merge(ShipmentStatus::directStatuses(), ShipmentStatus::indirectStatuses(), [
                ShipmentStatus::PENDING_HANDOVER,
                ShipmentStatus::INCOMPLETE_COLLECTED,
            ])
        );

        return array_values(array_diff($statuses, $finalStatuses));
    }

    private function getStatistics(?User $user = null): array
    {
        // Define status categories for both direct and indirect deliveries

        // In Progress: All active delivery statuses (both direct and indirect)
        $inProgressStatuses = [
            // Direct delivery statuses
            ShipmentStatus::ASSIGNED->value,
            ShipmentStatus::PICKUP->value,
            ShipmentStatus::IN_TRANSIT->value,
            ShipmentStatus::OUT_FOR_DELIVERY->value,
            ShipmentStatus::PICKED_UP->value,

            // Indirect delivery statuses - all intermediate stages
            ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
            ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];

        // Pickup Pending: Newly created shipments waiting to be assigned/picked up
        $pickupPendingStatuses = [
            ShipmentStatus::PENDING->value,
            ShipmentStatus::READY_FOR_PICKUP->value,
        ];

        // Delivered: Final successful delivery statuses
        $deliveredStatuses = [
            ShipmentStatus::DELIVERED->value,
            ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            ShipmentStatus::PENDING_HANDOVER->value, // Delivery complete, just waiting for COD handover
        ];

        // Get shipments with their latest status, filtered by zone if applicable
        $query = Shipment::query()
            ->select('shipments.id', 'shipments.created_at', 'shipments.delivery_speed', 'shipment_status_history.to_status', 'shipment_status_history.created_at as status_changed_at', 'shipment_status_history.id as history_id')
            ->leftJoin('shipment_status_history', function ($join) {
                $join->on('shipments.id', '=', 'shipment_status_history.shipment_id')
                    ->whereRaw('shipment_status_history.created_at = (
                        SELECT MAX(created_at)
                        FROM shipment_status_history ssh
                        WHERE ssh.shipment_id = shipments.id
                    )');
            });

        // Apply zone filtering for non-superadmin employees
        if ($user && ! $user->hasRole('superadmin') && $user->platform === 'Admin Portal') {
            $zoneIds = $user->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $query->whereIn('shipments.zone_id', $zoneIds);
            }
        }

        $shipments = $query->orderBy('shipment_status_history.id', 'desc')
            ->get();

        $inProgress = 0;
        $newBookings = 0;
        $delayed = 0;
        $delivered = 0;
        $now = now();

        // Group by shipment ID and take the first occurrence (which will be the highest ID due to DESC order)
        $shipmentsByIdMap = [];
        foreach ($shipments as $shipment) {
            if (! isset($shipmentsByIdMap[$shipment->id])) {
                $shipmentsByIdMap[$shipment->id] = $shipment;
            }
        }

        foreach ($shipmentsByIdMap as $shipment) {
            $status = $shipment->to_status ?? ShipmentStatus::PENDING->value;

            if (in_array($status, $deliveredStatuses)) {
                $delivered++;
            } elseif (in_array($status, $inProgressStatuses)) {
                $inProgress++;
            } elseif (in_array($status, $pickupPendingStatuses)) {
                // Calculate delay based on when status last changed (or created if no status history)
                $relevantTime = $shipment->status_changed_at ?? $shipment->created_at;
                if (! $relevantTime instanceof \Illuminate\Support\Carbon) {
                    $relevantTime = \Illuminate\Support\Carbon::parse($relevantTime);
                }
                $minutesElapsed = $relevantTime->diffInMinutes($now);

                // Delayed if waiting more than 24 hours (1440 minutes)
                if ($minutesElapsed >= 1440) {
                    $delayed++;
                } else {
                    // New booking if created today and not delayed
                    if ($shipment->created_at->isToday()) {
                        $newBookings++;
                    }
                }
            }
        }

        return [
            'in_progress' => $inProgress,
            'new_bookings' => $newBookings,
            'delayed' => $delayed,
            'delivered' => $delivered,
        ];
    }

    private function getShipmentType($shipment): string
    {
        if ($shipment->delivery_speed === 'direct') {
            return 'Direct D-D';
        } else {
            if ($shipment->indirect_delivery_mode === 'door_to_drop_point') {
                return 'In-Direct D-P';
            } elseif ($shipment->indirect_delivery_mode === 'drop_point_to_drop_point') {
                return 'In-Direct P-P';
            } elseif ($shipment->indirect_delivery_mode === 'drop_point_to_door') {
                return 'In-Direct P-D';
            }

            return 'In-Direct D-D';
        }

    }

    private function getVehicleType($shipment): string
    {
        // For drop point shipments without a rider assigned, don't show vehicle type
        $isDropPointMode = $shipment->delivery_speed === 'indirect'
            && in_array($shipment->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true);

        if ($isDropPointMode && ! $shipment->rider_id) {
            return '--';
        }

        // Try to get vehicle type from rider's vehicle
        if ($shipment->rider && $shipment->rider->vehicles()->exists()) {
            $vehicle = $shipment->rider->vehicles()->first();

            return $vehicle->type ?? 'Bike';
        }

        // For non-drop-point shipments without riders, return default
        return $shipment->rider_id ? 'Bike' : '--';
    }

    private function getStatusColor(string $status): string
    {
        return match ($status) {
            'Unassigned' => 'amber',
            'Completed' => 'green',
            ShipmentStatus::PENDING->value,
            ShipmentStatus::READY_FOR_PICKUP->value => 'yellow',
            ShipmentStatus::ASSIGNED->value,
            ShipmentStatus::PICKUP->value,
            ShipmentStatus::PICKED_UP->value,
            ShipmentStatus::IN_TRANSIT->value,
            ShipmentStatus::OUT_FOR_DELIVERY->value => 'blue',
            ShipmentStatus::DELIVERED->value => 'green',
            ShipmentStatus::CANCELLED->value,
            ShipmentStatus::FAILED->value,
            ShipmentStatus::RETURNED->value => 'red',
            default => 'yellow',
        };
    }

    /**
     * Format status for dashboard display.
     * Shows the latest status from timeline (e.g., Assigned, Pickup, In Transit, Delivered).
     * For COD shipments, checks payment collection status but prioritizes delivery status.
     */
    private function formatStatus($shipment, string $status): string
    {
        // Normalize status for comparison
        $normalizedStatus = trim($status);

        // For empty or pending status
        if (! $normalizedStatus || strtolower($normalizedStatus) === 'pending') {
            // For door-to-door (direct or door_to_* indirect) shipments without a rider, show "Unassigned"
            $isDoorDelivery = $shipment->delivery_speed === 'direct' ||
                ($shipment->delivery_speed === 'indirect' &&
                 in_array($shipment->indirect_delivery_mode, ['door_to_door', 'door_to_drop_point'], true));

            if ($isDoorDelivery && ! $shipment->rider_id) {
                return 'Unassigned';
            }

            return 'Pending';
        }

        // If the status is "Pending Handover", it means payment was collected but not yet deposited to admin
        // Only show as "Delivered" if the cash has been deposited/settled with admin
        if ($normalizedStatus === ShipmentStatus::PENDING_HANDOVER->value ||
            strtolower($normalizedStatus) === 'pending handover') {

            // Check if shipment was actually delivered (has Delivered or Picked up by Receiver status)
            if ($shipment->relationLoaded('statusHistory') && $shipment->statusHistory) {
                $hasDelivered = $shipment->statusHistory->contains(function ($history) {
                    return in_array($history->to_status, [
                        ShipmentStatus::DELIVERED->value,
                        ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
                    ], true);
                });

                if ($hasDelivered) {
                    // Check if cash has been deposited to admin
                    // Only show "Delivered" if either:
                    // 1. Payment is not COD (online payment or no payment method)
                    // 2. Cash has been deposited (rider_deposited_at is set) or settled with admin (settled_at is set)
                    if ($shipment->payment_method !== 'cash') {
                        return 'Delivered';
                    }

                    // For COD payments, check if deposited or settled
                    $isDeposited = false;

                    // Check admin settlement
                    if ($shipment->relationLoaded('adminSettlement') && $shipment->adminSettlement) {
                        $isDeposited = $shipment->adminSettlement->settled_at !== null;
                    }

                    // Check rider collection deposit
                    if (! $isDeposited && $shipment->relationLoaded('riderCollection') && $shipment->riderCollection) {
                        $isDeposited = $shipment->riderCollection->rider_deposited_at !== null ||
                                     $shipment->riderCollection->settled_at !== null;
                    }

                    // Check car driver collection deposit
                    if (! $isDeposited && $shipment->relationLoaded('carDriverCollection') && $shipment->carDriverCollection) {
                        $isDeposited = $shipment->carDriverCollection->rider_deposited_at !== null ||
                                     $shipment->carDriverCollection->settled_at !== null;
                    }

                    // Check drop point keeper collection deposit
                    if (! $isDeposited && $shipment->relationLoaded('dropPointKeeperCollection') && $shipment->dropPointKeeperCollection) {
                        $isDeposited = $shipment->dropPointKeeperCollection->rider_deposited_at !== null ||
                                     $shipment->dropPointKeeperCollection->settled_at !== null;
                    }

                    // Only show "Delivered" if cash has been deposited
                    if ($isDeposited) {
                        return 'Delivered';
                    }

                    // Otherwise, show "Completed" (payment collected, waiting for deposit)
                    return 'Completed';
                }
            }
        }

        // Return the actual timeline status as-is
        // Examples: Assigned, Pickup, Picked up, In Transit, Out for Delivery, Delivered, etc.
        return $normalizedStatus;
    }

    private function resolveEmployeeRoleMeta(?User $user): array
    {
        if (! $user) {
            return ['label' => 'Unassigned', 'key' => 'unassigned'];
        }

        $roleName = $user->roles?->pluck('name')->first();

        return match ($roleName) {
            RoleEnum::CAR_DRIVER->value => ['label' => 'Car Driver', 'key' => 'car_driver'],
            RoleEnum::DROP_POINT_KEEPER->value => ['label' => 'Drop Point Keeper', 'key' => 'drop_point_keeper'],
            RoleEnum::WAREHOUSE_KEEPER->value => ['label' => 'Warehouse Keeper', 'key' => 'warehouse_keeper'],
            default => ['label' => 'Rider', 'key' => 'rider'],
        };
    }

    private function formatSize($shipment): string
    {
        if ($shipment->custom_length && $shipment->custom_width && $shipment->custom_height) {
            return sprintf('%s (%s × %s × %s cm)', ucfirst((string) ($shipment->size ?? 'Custom')), (string) $shipment->custom_length, (string) $shipment->custom_width, (string) $shipment->custom_height);
        }

        return $shipment->size ? ucfirst((string) $shipment->size) : '--';
    }

    /**
     * Normalize the insurance value to a consistent Yes/No string.
     */
    private function formatInsuranceText($insurance): string
    {
        if (is_bool($insurance)) {
            return $insurance ? 'Yes' : 'No';
        }

        if (is_numeric($insurance)) {
            return ((int) $insurance) === 1 ? 'Yes' : 'No';
        }

        $normalized = strtolower(trim((string) $insurance));

        if ($normalized === '' || $insurance === null) {
            return 'No';
        }

        $truthy = ['yes', 'true', '1', 'y', 'insured', 'with insurance'];
        $falsy = ['no', 'false', '0', 'n', 'none', 'not insured', 'without insurance'];

        if (in_array($normalized, $truthy, true)) {
            return 'Yes';
        }

        if (in_array($normalized, $falsy, true)) {
            return 'No';
        }

        // Fallback to "No" for unexpected values to avoid showing "Yes" incorrectly
        return 'No';
    }

    private function getRidersList(?User $currentUser = null)
    {
        // Fetch all users with the 'rider' role and include minimal fields used by the front-end
        $query = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'rider'))
            ->with(['vehicles:id,user_id,type']);

        // Filter riders by zone if the current user is a non-superadmin employee with a zone assigned
        if ($currentUser && ! $currentUser->hasRole('superadmin') && $currentUser->platform === 'Admin Portal') {
            $zoneIds = $currentUser->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $query->where(function ($query) use ($zoneIds) {
                    $query->whereIn('zone_id', $zoneIds);

                    foreach ($zoneIds as $zoneId) {
                        $query->orWhereJsonContains('zone_ids', $zoneId);
                    }
                });
            }
        }

        $riders = $query->orderBy('id', 'desc')
            ->get(['id', 'name', 'employee_id', 'status', 'shipment_type', 'availability', 'zone_id', 'zone_ids', 'delivery_speed_mode']);

        return $riders
            ->map(function (User $user) {
                $vehicleType = ($user->vehicles && $user->vehicles->count() > 0)
                    ? optional($user->vehicles->first())->type ?? 'Bike'
                    : 'Bike';

                $deliverySpeedMode = in_array($user->delivery_speed_mode, ['direct', 'indirect', 'both'], true)
                    ? $user->delivery_speed_mode
                    : null;
                $shipmentTypeKey = $deliverySpeedMode === 'indirect'
                    ? 'in_direct'
                    : ($deliverySpeedMode === 'direct' ? 'direct' : ($deliverySpeedMode === 'both' ? 'both' : null));
                $shipmentTypeLabel = match ($deliverySpeedMode) {
                    'direct' => 'Direct/DD',
                    'indirect' => 'In-Direct/DP',
                    'both' => 'Direct + Indirect',
                    default => '--',
                };

                return [
                    'id' => $user->id,
                    'code' => $user->employee_id ?: ('MP-'.str_pad((string) $user->id, 3, '0', STR_PAD_LEFT)),
                    'name' => $user->name,
                    'zone_id' => $user->zone_id,
                    'zone_ids' => $user->zone_ids ?? [],
                    'shipment_type' => $shipmentTypeLabel,
                    'shipment_type_key' => $shipmentTypeKey,
                    'delivery_speed_mode' => $deliverySpeedMode,
                    'delivery_speed_label' => $shipmentTypeLabel,
                    'vehicle_type' => $vehicleType,
                    'est_free_time' => '--',
                    'est_delivery_time' => '--',
                    'status' => $user->status === 'active' ? 'Available' : 'Not Available',
                    'status_key' => $user->status === 'active' ? 'available' : 'unavailable',
                    'availability' => $user->availability ?? 'offline',
                ];
            });
    }

    private function getHeatmapShipments(?User $currentUser = null)
    {
        $query = Shipment::query()
            ->select([
                'id',
                'status',
                'handover_latitude',
                'handover_longitude',
                'delivery_latitude',
                'delivery_longitude',
                'updated_at',
                'zone_id',
            ])
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhereRaw('LOWER(TRIM(status)) <> ?', ['delivered']);
            })
            ->where(function ($query) {
                $query->whereNotNull('handover_latitude')
                    ->whereNotNull('handover_longitude')
                    ->orWhere(function ($subQuery) {
                        $subQuery->whereNotNull('delivery_latitude')
                            ->whereNotNull('delivery_longitude');
                    });
            });

        // Filter by zone if applicable
        if ($currentUser && ! $currentUser->hasRole('superadmin') && $currentUser->platform === 'Admin Portal') {
            $zoneIds = $currentUser->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $query->whereIn('zone_id', $zoneIds);
            }
        }

        return $query->latest('updated_at')
            ->get()
            ->map(fn ($shipment) => [
                'id' => $shipment->id,
                'status' => $shipment->status,
                'handover' => $shipment->handover_latitude !== null && $shipment->handover_longitude !== null
                    ? [
                        'lat' => (float) $shipment->handover_latitude,
                        'lng' => (float) $shipment->handover_longitude,
                    ]
                    : null,
                'delivery' => $shipment->delivery_latitude !== null && $shipment->delivery_longitude !== null
                    ? [
                        'lat' => (float) $shipment->delivery_latitude,
                        'lng' => (float) $shipment->delivery_longitude,
                    ]
                    : null,
            ])
            ->values();
    }

    private function getHeatmapRiders(?User $currentUser = null)
    {
        $query = User::query()
            ->whereHas('roles', function ($query) {
                $query->where('name', 'rider');
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->select([
                'id',
                'name',
                'latitude',
                'longitude',
                'updated_at',
                'zone_id',
            ]);

        // Filter by zone if applicable
        if ($currentUser && ! $currentUser->hasRole('superadmin') && $currentUser->platform === 'Admin Portal') {
            $zoneIds = $currentUser->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $query->whereIn('zone_id', $zoneIds);
            }
        }

        return $query->get()
            ->map(fn ($rider) => [
                'id' => $rider->id,
                'name' => $rider->name,
                'latitude' => (float) $rider->latitude,
                'longitude' => (float) $rider->longitude,
            ])
            ->values();
    }

    /**
     * Get dashboard statistics as JSON (for dynamic updates).
     */
    public function getStats()
    {
        $user = auth()->user();

        if (! $user || ! $user->can('admin.access')) {
            abort(401);
        }

        return response()->json($this->getStatistics());
    }

    /**
     * Assign a rider to a shipment.
     */
    public function assignRider(Request $request, Shipment $shipment, ShipmentTrackingService $trackingService, ShipmentService $shipmentService): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('shipments.assign'))) {
            abort(401);
        }

        // Check if shipment is a drop point type (indirect delivery starting from drop point)
        $isDropPointMode = $shipment->delivery_speed === 'indirect'
            && in_array($shipment->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true);

        if ($isDropPointMode) {
            return redirect()->route('admin.dashboard')->with('error', __('cannotAssignDropPointDeliveriesToRidersTheseShipmentsMustBeHandledByDropPointKeepers'));
        }

        // Door-to-door: only pickup rider is assigned initially.
        // Delivery rider is assigned separately once shipment reaches Drop Point 2.
        $isDoorToDoor = $shipment->delivery_speed === 'indirect'
            && $shipment->indirect_delivery_mode === 'door_to_door';

        $validationRules = [
            'rider_id' => ['required', 'integer', 'exists:users,id'],
            'send_rider_sms' => ['nullable', 'boolean'],
        ];

        $data = $request->validate($validationRules);
        $sendRiderSms = $request->boolean('send_rider_sms', true);

        $currentStatus = $shipment->latestStatusHistory?->to_status ?? $shipment->status ?? ShipmentStatus::PENDING->value;
        $normalizedStatus = strtolower(trim((string) $currentStatus));
        $allowedStatuses = [
            strtolower(ShipmentStatus::PENDING->value),
            strtolower(ShipmentStatus::ASSIGNED->value),
        ];

        if ($normalizedStatus && ! in_array($normalizedStatus, $allowedStatuses, true)) {
            return redirect()->route('admin.dashboard')->with('error', __('cannotReassignThisShipmentAfterPickupHasStarted'));
        }

        // Validate pickup rider
        $rider = User::query()
            ->where('id', $data['rider_id'])
            ->whereHas('roles', fn ($q) => $q->where('name', 'rider'))
            ->first();

        if (! $rider) {
            return redirect()->route('admin.dashboard')->with('error', __('selectedPickupRiderIsNotARider'));
        }

        if (! $isDoorToDoor && $shipment->rider_id && (int) $shipment->rider_id === (int) $rider->id) {
            return redirect()->route('admin.dashboard')->with('error', __('thisShipmentIsAlreadyAssignedToTheSelectedRider'));
        }

        if (($rider->availability ?? 'offline') !== 'online') {
            return redirect()->route('admin.dashboard')->with('error', __('selectedPickupRiderIsNotAvailable'));
        }

        // Check COD limit for direct deliveries
        if ($shipment->delivery_speed === 'direct') {
            $codCheck = $shipmentService->checkCodLimitForAssignment(
                $rider,
                $shipment,
                'rider',
                DeliveryStage::PICKUP->value
            );

            if (! $codCheck['can_accept']) {
                return back()->withErrors(['rider' => $codCheck['reason']]);
            }
        }

        $previousRiderId = $shipment->rider_id ? (int) $shipment->rider_id : null;

        // Close open pickup assignments for other riders; reuse selected rider assignment if exists
        $openPickupAssignments = $shipment->assignments()
            ->where('stage', DeliveryStage::PICKUP->value)
            ->where('role', 'rider')
            ->whereNull('completed_at')
            ->get();

        $existingPickupAssignment = null;

        foreach ($openPickupAssignments as $openAssignment) {
            if ((int) $openAssignment->user_id === (int) $rider->id) {
                $existingPickupAssignment = $openAssignment;

                continue;
            }

            $notes = trim((string) $openAssignment->notes);
            $suffix = 'Unassigned by admin for reassignment';
            $openAssignment->update([
                'completed_at' => now(),
                'notes' => $notes ? $notes."\n\n".$suffix : $suffix,
            ]);
        }

        // Persist pickup rider on shipment
        $shipment->rider_id = $rider->id;
        $shipment->save();

        if ($existingPickupAssignment) {
            $assignment = $existingPickupAssignment;
            if (! $assignment->started_at) {
                $trackingService->startAssignment($assignment);
                $assignment->refresh();
            }
        } else {
            $assignment = $trackingService->assignUser(
                shipment: $shipment,
                user: $rider,
                role: 'rider',
                stage: DeliveryStage::PICKUP->value,
                assignedBy: $request->user(),
                notes: $isDoorToDoor ? 'Assigned as pickup rider by admin' : 'Assigned by admin from dashboard',
                sendRiderSms: $sendRiderSms
            );
            $trackingService->startAssignment($assignment);
            $assignment->refresh();
        }

        $trackingService->recordStatusChange(
            shipment: $shipment,
            newStatus: ShipmentStatus::ASSIGNED->value,
            user: $rider,
            options: ['notes' => $isDoorToDoor ? 'Pickup rider assigned by admin (delivery rider to be assigned at Drop Point 2)' : 'Rider assigned by admin']
        );

        return redirect()->route('admin.dashboard');
    }

    /**
     * Assign the delivery rider for door-to-door or drop-point-to-door shipments.
     * This is only allowed once the shipment has arrived at Drop Point 2.
     */
    public function assignDeliveryRider(Request $request, Shipment $shipment, ShipmentTrackingService $trackingService): RedirectResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('shipments.assign')) {
            abort(401);
        }

        $isDoorToDoor = $shipment->delivery_speed === 'indirect'
            && $shipment->indirect_delivery_mode === 'door_to_door';
        $isDropPointToDoor = $shipment->delivery_speed === 'indirect'
            && $shipment->indirect_delivery_mode === 'drop_point_to_door';

        if (! $isDoorToDoor && ! $isDropPointToDoor) {
            return redirect()->route('admin.dashboard')->with('error', __('deliveryRiderCanOnlyBeAssignedForDoorToDoorOrDropPointToDoorShipments'));
        }

        // Delivery rider assignment is blocked only for early statuses before the shipment enters the DP2 chain
        $currentStatus = $shipment->latestStatusHistory?->to_status ?? $shipment->status ?? ShipmentStatus::PENDING->value;
        $normalizedStatus = strtolower(trim((string) $currentStatus));

        $tooEarlyStatuses = [
            strtolower(ShipmentStatus::PENDING->value),
            strtolower(ShipmentStatus::ASSIGNED->value),
            strtolower(ShipmentStatus::PICKUP->value),
        ];

        if (in_array($normalizedStatus, $tooEarlyStatuses, true)) {
            return redirect()->route('admin.dashboard')->with('error', __('deliveryRiderCanOnlyBeAssignedOnceTheShipmentHasArrivedAtDropPoint'));
        }

        $data = $request->validate([
            'delivery_rider_id' => ['required', 'integer', 'exists:users,id'],
            'send_rider_sms' => ['nullable', 'boolean'],
        ]);
        $sendRiderSms = $request->boolean('send_rider_sms', true);

        $deliveryRider = User::query()
            ->where('id', $data['delivery_rider_id'])
            ->whereHas('roles', fn ($q) => $q->where('name', 'rider'))
            ->first();

        if (! $deliveryRider) {
            return redirect()->route('admin.dashboard')->with('error', __('selectedDeliveryRiderIsNotAValidRider'));
        }

        if (($deliveryRider->availability ?? 'offline') !== 'online') {
            return redirect()->route('admin.dashboard')->with('error', __('selectedDeliveryRiderIsNotAvailable'));
        }

        // Close any existing open final-delivery assignments and reuse if same rider
        $openFinalAssignments = $shipment->assignments()
            ->where('stage', DeliveryStage::FINAL_DELIVERY->value)
            ->where('role', 'rider')
            ->whereNull('completed_at')
            ->get();

        $existingFinalAssignment = null;
        foreach ($openFinalAssignments as $openAssignment) {
            if ((int) $openAssignment->user_id === (int) $deliveryRider->id) {
                $existingFinalAssignment = $openAssignment;

                continue;
            }
            $notes = trim((string) $openAssignment->notes);
            $suffix = 'Unassigned by admin for reassignment';
            $openAssignment->update([
                'completed_at' => now(),
                'notes' => $notes ? $notes."\n\n".$suffix : $suffix,
            ]);
        }

        $shipment->delivery_rider_id = $deliveryRider->id;
        $shipment->save();

        if ($existingFinalAssignment) {
            if (! $existingFinalAssignment->started_at) {
                $trackingService->startAssignment($existingFinalAssignment);
            }
        } else {
            $deliveryAssignment = $trackingService->assignUser(
                shipment: $shipment,
                user: $deliveryRider,
                role: 'rider',
                stage: DeliveryStage::FINAL_DELIVERY->value,
                assignedBy: $request->user(),
                notes: 'Assigned as delivery rider by admin (shipment at Drop Point 2)',
                sendRiderSms: $sendRiderSms
            );
            $trackingService->startAssignment($deliveryAssignment);
        }

        return redirect()->route('admin.dashboard');
    }

    /**
     * Unassign the delivery rider from a door-to-door or drop-point-to-door shipment.
     */
    public function unassignDeliveryRider(Request $request, Shipment $shipment, ShipmentTrackingService $trackingService): RedirectResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('shipments.assign')) {
            abort(401);
        }

        $isDoorToDoor = $shipment->delivery_speed === 'indirect'
            && $shipment->indirect_delivery_mode === 'door_to_door';
        $isDropPointToDoor = $shipment->delivery_speed === 'indirect'
            && $shipment->indirect_delivery_mode === 'drop_point_to_door';

        if (! $isDoorToDoor && ! $isDropPointToDoor) {
            return redirect()->route('admin.dashboard')->with('error', __('thisActionIsOnlyAvailableForDoorToDoorOrDropPointToDoorShipments'));
        }

        if (! $shipment->delivery_rider_id) {
            return redirect()->route('admin.dashboard')->with('error', __('noDeliveryRiderIsAssignedToThisShipment'));
        }

        $openFinalAssignments = $shipment->assignments()
            ->where('stage', DeliveryStage::FINAL_DELIVERY->value)
            ->where('role', 'rider')
            ->whereNull('completed_at')
            ->get();

        foreach ($openFinalAssignments as $assignment) {
            $notes = trim((string) $assignment->notes);
            $suffix = 'Unassigned by admin';
            $assignment->update([
                'completed_at' => now(),
                'notes' => $notes ? $notes."\n\n".$suffix : $suffix,
            ]);
        }

        $shipment->delivery_rider_id = null;
        $shipment->save();

        return redirect()->route('admin.dashboard')->with('success', __('commonDeliveryRiderUnassigned'));
    }

    /**
     * Unassign the current rider from a shipment.
     */
    public function unassignRider(Request $request, Shipment $shipment, ShipmentTrackingService $trackingService): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('shipments.assign'))) {
            abort(401);
        }

        // Check if shipment is a drop point type (indirect delivery starting from drop point)
        $isDropPointMode = $shipment->delivery_speed === 'indirect'
            && in_array($shipment->indirect_delivery_mode, ['drop_point_to_door', 'drop_point_to_drop_point'], true);

        if ($isDropPointMode) {
            return redirect()->route('admin.dashboard')->with('error', __('cannotUnassignDropPointDeliveriesFromRidersTheseShipmentsMustBeHandledByDropPointKeepers'));
        }

        if (! $shipment->rider_id) {
            return redirect()->route('admin.dashboard')->with('error', __('thisShipmentIsAlreadyUnassigned'));
        }

        $currentStatus = $shipment->latestStatusHistory?->to_status ?? $shipment->status ?? ShipmentStatus::PENDING->value;
        $normalizedStatus = strtolower(trim((string) $currentStatus));
        $allowedStatuses = [
            strtolower(ShipmentStatus::PENDING->value),
            strtolower(ShipmentStatus::ASSIGNED->value),
        ];
        if ($normalizedStatus && ! in_array($normalizedStatus, $allowedStatuses, true)) {
            return redirect()->route('admin.dashboard')->with('error', __('cannotUnassignThisShipmentAfterPickupHasStarted'));
        }

        $previousRiderId = (int) $shipment->rider_id;

        $openAssignments = $shipment->assignments()
            ->where('stage', DeliveryStage::PICKUP->value)
            ->where('role', 'rider')
            ->whereNull('completed_at')
            ->get();

        foreach ($openAssignments as $assignment) {
            $notes = trim((string) $assignment->notes);
            $suffix = 'Unassigned by admin';
            $assignment->update([
                'completed_at' => now(),
                'notes' => $notes ? $notes."\n\n".$suffix : $suffix,
            ]);
        }

        // For door-to-door indirect orders, also clear the delivery rider and their open assignments
        $isDoorToDoor = $shipment->delivery_speed === 'indirect'
            && $shipment->indirect_delivery_mode === 'door_to_door';

        if ($isDoorToDoor && $shipment->delivery_rider_id) {
            $openDeliveryAssignments = $shipment->assignments()
                ->where('stage', DeliveryStage::FINAL_DELIVERY->value)
                ->where('role', 'rider')
                ->whereNull('completed_at')
                ->get();

            foreach ($openDeliveryAssignments as $assignment) {
                $notes = trim((string) $assignment->notes);
                $suffix = 'Unassigned by admin';
                $assignment->update([
                    'completed_at' => now(),
                    'notes' => $notes ? $notes."\n\n".$suffix : $suffix,
                ]);
            }

            $shipment->delivery_rider_id = null;
        }

        $shipment->rider_id = null;
        if ((int) $shipment->barcode_rider_id === $previousRiderId) {
            $shipment->barcode_rider_id = null;
        }
        $shipment->save();

        $trackingService->recordStatusChange(
            shipment: $shipment,
            newStatus: ShipmentStatus::PENDING->value,
            user: $request->user(),
            options: ['notes' => 'Rider unassigned by admin']
        );

        return redirect()->route('admin.dashboard')->with('success', __('commonRiderUnassigned'));
    }

    /**
     * Store or update admin notes for a shipment.
     */
    public function updateAdminNotes(Request $request, Shipment $shipment): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('shipments.manage') && ! $user->can('shipments.tracking'))) {
            abort(401);
        }

        $data = $request->validate([
            'admin_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $shipment->admin_notes = $data['admin_notes'] ?? null;
        $shipment->save();

        return redirect()->route('admin.dashboard');
    }

    /**
     * Redirect authenticated admins to their first accessible module.
     */
    public function landing(): RedirectResponse
    {
        $user = auth()->user();

        if (! $user) {
            abort(401);
        }

        $redirectTo = AdminRouteResolver::firstAccessibleRouteFor($user);

        if (! $redirectTo) {
            abort(401);
        }

        return redirect()->to($redirectTo);
    }
}
