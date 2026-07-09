<?php

namespace App\Repositories;

use App\Contracts\ShipmentRepositoryInterface;
use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use App\Support\SortHelper;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

/**
 * Class ShipmentRepository
 *
 * Handles data access for shipments.
 */
class ShipmentRepository implements ShipmentRepositoryInterface
{
    public function __construct(
        private readonly Shipment $model
    ) {}

    /**
     * Get paginated shipments for a specific user.
     *
     * @param int $userId
     * @param int $perPage
     * @return LengthAwarePaginator
     */
    public function getUserShipmentsPaginated(int $userId, int $perPage = 10, bool $isNormal = true, bool $isReturned = false, ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator
    {
        $query = $this->model
            ->with([
                'size',
                'directStatus',
                'indirectStatus',
                'review',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->with(['user:id,name'])->orderBy('created_at', 'asc');
                },
            ]);

        if ($isNormal && !$isReturned) {
            $query->where('booking_type', 'shipment');
        } elseif (!$isNormal && $isReturned) {
            $query->where('booking_type', 'return');
        } elseif ($isNormal && $isReturned) {
            $query->whereIn('booking_type', ['shipment', 'return']);
        }

        $query->where('user_id', $userId);
        $this->applyShipmentFilters($query, $search, $status);
        $this->applyShipmentSorting($query, $sortBy, $sortDir);

        return $query->paginate($perPage)
            ->withQueryString();
    }

    public function getUserAllShipmentsPaginated(int $userId, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator
    {
        $search = trim((string) request()->input('search', ''));
        $status = trim((string) request()->input('status', ''));
        $sortBy = trim((string) request()->input('sort_by', 'created_at'));
        $sortDir = trim((string) request()->input('sort_dir', 'desc'));
 
        if($status == 'pending'){
            $status = null;
        }
 
        $query = $this->model
            ->with([
                'size',
                'directStatus',
                'indirectStatus',
                'review',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('booking_type', $booking_type)
            ->where(function ($query) use ($userId) {
                $query->where('user_id', $userId)
                    ->orWhere(function ($receiverQuery) use ($userId) {
                        $receiverQuery->where('receiver_id', $userId)
                            ->whereNotNull('shipment_id');
                    });
            })
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($searchQuery) use ($search) {
                    $like = '%' . $search . '%';
 
                    // Optional column support for environments where barcode_number may not exist.
                    if (Schema::hasColumn('shipments', 'barcode_number')) {
                        $searchQuery->where('barcode_number', 'like', $like);
                    } else {
                        $searchQuery->where('order_number', 'like', $like);
                    }
 
                    $searchQuery
                        ->orWhere('order_number', 'like', $like)
                        ->orWhere('sender_receive_payment_status', 'like', $like)
                        ->orWhere('sender_name', 'like', $like)
                        ->orWhere('receiver_name', 'like', $like);
 
                    // Relationship-based name search, if relationships exist.
                    if (method_exists($this->model, 'user')) {
                        $searchQuery->orWhereHas('user', function ($senderQuery) use ($like) {
                            $senderQuery->where('name', 'like', $like);
                        });
                    }
 
                    if (method_exists($this->model, 'receiver')) {
                        $searchQuery->orWhereHas('receiver', function ($receiverQuery) use ($like) {
                            $receiverQuery->where('name', 'like', $like);
                        });
                    }
                });
            })
            ->when($status !== '' && strtolower($status) !== 'all', function ($query) use ($status) {
 
                if($status == 'rejected'){
                    $query->where('componsation_status', 'rejected')->orWhere('status', ShipmentStatus::COMPENSATION_REJECTED->value);
                }else if($status == 'approved'){
                    $query->where('componsation_status', 'approved')->orWhere('status', ShipmentStatus::COMPENSATION_APPROVED->value);
                }else if($status == 'compensation'){
                    $query->where('componsation_status', 'pending')->orWhere('status', ShipmentStatus::COMPENSATION_REQEUSTED->value);
                }else{
                    $query->where('sender_receive_payment_status', $status);
 
                    if($status == 'pending'){
                        $query->orWhere('sender_receive_payment_status', 'pending');
                    }
                }
            });

        $this->applyShipmentSorting($query, $sortBy, $sortDir);

        $shipments = $query->paginate($perPage)
            ->withQueryString();
 
        $shipments->getCollection()->transform(function ($shipment) use ($userId) {
            $shipment->role = $shipment->receiver_id == $userId ? 'receiver' : 'sender';
            return $shipment;
        });
 
        return $shipments;
    }

    /**
     * Get paginated shipments received by a specific user (matched by userId).
     *
     * @param int $userId
     * @param int $perPage
     * @return LengthAwarePaginator
     */
    public function getReceivedShipmentsPaginated(int $userId, int $perPage = 10, string $booking_type = 'shipment', ?string $search = null, ?string $status = null, ?string $sortBy = null, ?string $sortDir = null): LengthAwarePaginator
    {
        $query = $this->model
            ->with([
                'size',
                'directStatus',
                'indirectStatus',
                'review',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('booking_type', $booking_type)
            ->where('receiver_id', $userId)
            ->where(function ($query) {
                $query->where('payment_method', '!=', 'online')
                    ->orWhere(function ($q) {
                        $q->where('payment_method', 'online')
                            ->where('sender_payment_status', 'paid');
                    });
            });

        $this->applyShipmentFilters($query, $search, $status);
        $this->applyShipmentSorting($query, $sortBy, $sortDir);

        return $query->paginate($perPage)
            ->withQueryString();
    }

    /**
     * Get paginated shipments received by a user (matched by phone or email).
     */
    public function getReceiverShipmentsPaginated(string $phone, string $email, int $perPage = 10, string $booking_type = 'shipment'): LengthAwarePaginator
    {
        // Normalize phone number (get last 9 digits for robust matching)
        $normalizedPhone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($normalizedPhone) > 9) {
            $normalizedPhone = substr($normalizedPhone, -9);
        }

        return $this->model
            ->with([
                'size',
                'directStatus',
                'indirectStatus',
                'review',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where(function ($q) use ($normalizedPhone, $email) {
                if ($normalizedPhone) {
                    $q->orWhere('receiver_phone', 'LIKE', '%' . $normalizedPhone);
                }
                if ($email) {
                    $q->orWhere('receiver_email', $email);
                }
            })
            ->where('booking_type', $booking_type)
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    private function applyShipmentFilters(Builder $query, ?string $search = null, ?string $status = null): Builder
    {
        $this->applyShipmentSearch($query, $search);
        $this->applyShipmentStatusFilter($query, $status);

        return $query;
    }

    private function applyShipmentSorting(Builder $query, ?string $sortBy = null, ?string $sortDir = null): void
    {
        $sortColumn = SortHelper::column($sortBy, [
            'id' => 'shipments.id',
            'date' => 'shipments.created_at',
            'created_at' => 'shipments.created_at',
            'updated_at' => 'shipments.updated_at',
            'order_number' => 'shipments.order_number',
            'tracking_number' => 'shipments.order_number',
            'sender' => 'shipments.sender_name',
            'sender_name' => 'shipments.sender_name',
            'receiver' => 'shipments.receiver_name',
            'receiver_name' => 'shipments.receiver_name',
            'status' => 'shipments.status',
            'payment_status' => 'shipments.payment_status',
            'sender_payment_status' => 'shipments.sender_payment_status',
            'sender_receive_payment_status' => 'shipments.sender_receive_payment_status',
            'rdf_payment_status' => 'shipments.rdf_payment_status',
            'delivery_speed' => 'shipments.delivery_speed',
            'booking_type' => 'shipments.booking_type',
            'total_fee' => 'shipments.total_fee',
            'parcel_amount' => 'shipments.parcel_amount',
        ], 'shipments.id');

        $query->orderBy($sortColumn, SortHelper::direction($sortDir, 'desc'));

        if ($sortColumn !== 'shipments.id') {
            $query->orderByDesc('shipments.id');
        }
    }

    private function applyShipmentSearch(Builder $query, ?string $search): void
    {
        $search = trim((string) $search);

        if ($search === '') {
            return;
        }

        $query->where(function (Builder $searchQuery) use ($search) {
            $like = '%' . $search . '%';
            $columns = [
                'order_number',
                'barcode_number',
                'sender_name',
                'sender_phone',
                'sender_email',
                'handover_address',
                'receiver_name',
                'receiver_phone',
                'receiver_email',
                'delivery_address',
                'delivery_speed',
                'indirect_delivery_mode',
                'booking_type',
                'status',
                'return_status',
                'payment_status',
                'sender_payment_status',
                'sender_receive_payment_status',
                'rdf_payment_status',
                'special_instruction',
                'admin_notes',
            ];

            $hasCondition = false;
            foreach ($columns as $column) {
                if (!Schema::hasColumn('shipments', $column)) {
                    continue;
                }

                $method = $hasCondition ? 'orWhere' : 'where';
                $searchQuery->{$method}($column, 'like', $like);
                $hasCondition = true;
            }

            if (is_numeric($search)) {
                $method = $hasCondition ? 'orWhere' : 'where';
                $searchQuery->{$method}('id', (int) $search);
                $hasCondition = true;
            }

            if (method_exists($this->model, 'size')) {
                $method = $hasCondition ? 'orWhereHas' : 'whereHas';
                $searchQuery->{$method}('size', function (Builder $sizeQuery) use ($like) {
                    $sizeQuery->where('name', 'like', $like);
                });
                $hasCondition = true;
            }

            if (method_exists($this->model, 'user')) {
                $method = $hasCondition ? 'orWhereHas' : 'whereHas';
                $searchQuery->{$method}('user', function (Builder $senderQuery) use ($like) {
                    $senderQuery->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('phone_number', 'like', $like);
                });
            }
        });
    }

    private function applyShipmentStatusFilter(Builder $query, ?string $status): void
    {
        $status = trim((string) $status);
        $statusKey = $this->normalizeShipmentStatusFilter($status);

        if ($statusKey === null) {
            return;
        }

        $query->where(function (Builder $statusQuery) use ($statusKey, $status) {
            match ($statusKey) {
                'pending' => $this->whereLowerStatusIn($statusQuery, [
                    ShipmentStatus::PENDING->value,
                    'new',
                    'created',
                ], true),
                'in_progress' => $this->whereLowerStatusIn($statusQuery, $this->inProgressStatusValues()),
                'completed' => $this->whereLowerStatusIn($statusQuery, [
                    ShipmentStatus::COMPLETED->value,
                    ShipmentStatus::DELIVERED->value,
                    ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
                ]),
                'cancelled' => $this->whereLowerStatusIn($statusQuery, [
                    ShipmentStatus::CANCELLED->value,
                    ShipmentStatus::CANCELLED_DRIVER->value,
                    ShipmentStatus::CANCELLED_KEEPER->value,
                    ShipmentStatus::FAILED->value,
                    ShipmentStatus::INCOMPLETE->value,
                ]),
                default => $statusQuery->whereRaw('LOWER(TRIM(status)) = ?', [strtolower($statusKey)]),
            };
        });
    }

    private function normalizeShipmentStatusFilter(string $status): ?string
    {
        if ($status === '') {
            return null;
        }

        $lower = strtolower($status);
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '_', $lower), '_');
        $map = [
            'all' => null,
            'الكل' => null,
            'in progress' => 'in_progress',
            'in_progress' => 'in_progress',
            'progress' => 'in_progress',
            'قيد التنفيذ' => 'in_progress',
            'pending' => 'pending',
            'قيد الانتظار' => 'pending',
            'completed' => 'completed',
            'complete' => 'completed',
            'delivered' => 'completed',
            'مكتمل' => 'completed',
            'cancelled' => 'cancelled',
            'canceled' => 'cancelled',
            'ملغى' => 'cancelled',
        ];

        return $map[$lower] ?? $map[$slug] ?? $lower;
    }

    private function whereLowerStatusIn(Builder $query, array $statuses, bool $includeEmpty = false): void
    {
        $normalizedStatuses = array_values(array_unique(array_filter(array_map(
            fn($status) => strtolower(trim((string) $status)),
            $statuses
        ))));

        if ($normalizedStatuses === []) {
            return;
        }

        $placeholders = implode(', ', array_fill(0, count($normalizedStatuses), '?'));

        if ($includeEmpty) {
            $query->whereNull('status')
                ->orWhereRaw("LOWER(TRIM(status)) IN ({$placeholders})", $normalizedStatuses)
                ->orWhereRaw("TRIM(status) = ''");
            return;
        }

        $query->whereRaw("LOWER(TRIM(status)) IN ({$placeholders})", $normalizedStatuses);
    }

    private function inProgressStatusValues(): array
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
            fn(ShipmentStatus $status) => $status->value,
            array_merge(ShipmentStatus::directStatuses(), ShipmentStatus::indirectStatuses(), [
                ShipmentStatus::PENDING_HANDOVER,
                ShipmentStatus::INCOMPLETE_COLLECTED,
            ])
        );

        return array_values(array_diff($statuses, $finalStatuses));
    }

    /**
     * Create a new shipment.
     *
     * @param array $data
     * @return Model
     */
    public function create(array $data): Model
    {
        return $this->model->create($data);
    }

    /**
     * Find a shipment by ID.
     *
     * @param int|string $id
     * @return Model|null
     */
    public function find(int|string $id): ?Model
    {
        return $this->model->find($id);
    }

    /**
     * Update a shipment.
     *
     * @param int|string $id
     * @param array $data
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    // public function update(int|string $id, array $data): ?\Illuminate\Database\Eloquent\Model
    // {
    //     $model = $this->model->where($this->model->getKeyName(), $id)->first();

    //     if (!$model) {
    //         return null;
    //     }

    //     $model->update($data);

    //     return $model->fresh();
    // }

    public function update(int|string $id, array $data): bool
    {
        return $this->model
            ->where($this->model->getKeyName(), $id)
            ->update($data) > 0;
    }

    /**
     * Delete a shipment.
     *
     * @param int|string $id
     * @return bool
     */
    public function delete(int|string $id): bool
    {
        return $this->model
            ->where($this->model->getKeyName(), $id)
            ->delete() > 0;
    }

    /**
     * Get rider's jobs filtered by status.
     *
     * @param int $riderId
     * @param string|null $filter
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getRiderJobs(int $riderId, ?string $filter = 'assigned')
    {
        $query = $this->model
            ->where(function ($q) use ($riderId) {
                $q->where('rider_id', $riderId)
                    ->orWhere('delivery_rider_id', $riderId);
            })
            ->with([
                'user',
                'rider',
                'directStatus',
                'indirectStatus',
                'size',
                'shelf',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ]);

        // Status definitions for pickup rider role
        $pendingStatuses = [
            \App\Enums\ShipmentStatus::PENDING->value,
            \App\Enums\ShipmentStatus::ASSIGNED->value,
        ];

        $inProgressStatuses = [
            \App\Enums\ShipmentStatus::PICKUP->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT->value,
            \App\Enums\ShipmentStatus::OUT_FOR_DELIVERY->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
        ];

        $completedStatuses = [
            \App\Enums\ShipmentStatus::DELIVERED->value,
            \App\Enums\ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            \App\Enums\ShipmentStatus::CANCELLED->value,
            \App\Enums\ShipmentStatus::FAILED->value,
            \App\Enums\ShipmentStatus::RETURNED->value,
            \App\Enums\ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            // Pending handover - rider collected payment and waiting to hand over to admin
            \App\Enums\ShipmentStatus::PENDING_HANDOVER->value,
            // Any downstream statuses are outside the rider's scope and should not linger
            // Downstream statuses (pickup rider's work is done)
            \App\Enums\ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];

        // Status definitions for delivery rider role (door_to_door / drop_point_to_door)
        $deliveryPendingStatuses = [
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::READY_FOR_PICKUP->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
        ];

        $deliveryInProgressStatuses = [
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];

        $deliveryActiveStatuses = array_merge($deliveryPendingStatuses, $deliveryInProgressStatuses);

        // Apply filter
        if ($filter === 'pending') {
            $query->where(function ($q) use ($pendingStatuses, $deliveryPendingStatuses, $riderId) {
                $q->whereHas('latestStatusHistory', function ($sq) use ($pendingStatuses) {
                    $sq->whereIn('to_status', $pendingStatuses);
                })
                    ->orWhere(function ($dq) use ($deliveryPendingStatuses, $riderId) {
                        $dq->where('delivery_rider_id', $riderId)
                            ->whereHas('latestStatusHistory', function ($sq) use ($deliveryPendingStatuses) {
                                $sq->whereIn('to_status', $deliveryPendingStatuses);
                            });
                    });
            });
        } elseif ($filter === 'in_progress') {
            $query->where(function ($q) use ($inProgressStatuses, $deliveryInProgressStatuses, $riderId) {
                $q->whereHas('latestStatusHistory', function ($sq) use ($inProgressStatuses) {
                    $sq->whereIn('to_status', $inProgressStatuses);
                })
                    ->orWhere(function ($dq) use ($deliveryInProgressStatuses, $riderId) {
                        $dq->where('delivery_rider_id', $riderId)
                            ->whereHas('latestStatusHistory', function ($sq) use ($deliveryInProgressStatuses) {
                                $sq->whereIn('to_status', $deliveryInProgressStatuses);
                            });
                    });
            });
        } elseif ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->where(function ($paymentScope) use ($riderId) {
                $paymentScope
                    // Only include cash jobs where this rider collected the payment
                    ->whereHas('paymentTransactions', function ($payment) use ($riderId) {
                        $payment
                            ->where('rider_id', $riderId)
                            ->whereIn('transaction_type', [
                                'rider_collection',
                                'car_driver_collection',
                                'drop_point_keeper_collection',
                            ])
                            ->whereNotNull('collected_at');
                    })
                    // Or include cases where settlement was recorded against this rider
                    ->orWhereHas('adminSettlement', function ($settlement) use ($riderId) {
                        $settlement
                            ->where('collected_by', $riderId)
                            ->whereNotNull('settled_at');
                    });
            });
        } elseif ($filter === 'assigned') {
            $query->where(function ($q) use ($completedStatuses, $deliveryActiveStatuses, $riderId) {
                // Pickup rider jobs that haven't completed yet
                $q->whereHas('latestStatusHistory', function ($sq) use ($completedStatuses) {
                    $sq->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)->whereNotIn('to_status', $completedStatuses);
                })
                    ->orWhere(function ($subQuery) use ($riderId) {
                        $subQuery->where('status', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $riderId)->where('incomplete_status', ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value);
                    })
                    // OR delivery rider jobs actively in the DP2→customer leg
                    ->orWhere(function ($dq) use ($deliveryActiveStatuses, $riderId) {
                        $dq->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)->where('delivery_rider_id', $riderId)
                            ->whereHas('latestStatusHistory', function ($sq) use ($deliveryActiveStatuses) {
                                $sq->whereIn('to_status', $deliveryActiveStatuses);
                            });
                    });
            });
        }
        // 'all' filter - no additional filter needed

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Get rider's jobs filtered by status with pagination.
     */
    public function getRiderJobsPaginated(int $riderId, ?string $filter = 'assigned', int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        $query = $this->model
            ->where(function ($q) use ($riderId) {
                $q->where('rider_id', $riderId)
                    ->orWhere('delivery_rider_id', $riderId);
            })
            ->with([
                'user',
                'rider',
                'directStatus',
                'indirectStatus',
                'size',
                'shelf',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ]);

        $pendingStatuses = [
            \App\Enums\ShipmentStatus::PENDING->value,
            \App\Enums\ShipmentStatus::ASSIGNED->value,
        ];

        $inProgressStatuses = [
            \App\Enums\ShipmentStatus::PICKUP->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT->value,
            \App\Enums\ShipmentStatus::OUT_FOR_DELIVERY->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
        ];

        $completedStatuses = [
            \App\Enums\ShipmentStatus::DELIVERED->value,
            \App\Enums\ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            \App\Enums\ShipmentStatus::CANCELLED->value,
            \App\Enums\ShipmentStatus::FAILED->value,
            \App\Enums\ShipmentStatus::RETURNED->value,
            \App\Enums\ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::PENDING_HANDOVER->value,
            \App\Enums\ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];

        $deliveryPendingStatuses = [
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::READY_FOR_PICKUP->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
        ];

        $deliveryInProgressStatuses = [
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];

        $deliveryActiveStatuses = array_merge($deliveryPendingStatuses, $deliveryInProgressStatuses);

        if ($filter === 'pending') {
            $query->where(function ($q) use ($pendingStatuses, $deliveryPendingStatuses, $riderId) {
                $q->whereHas('latestStatusHistory', function ($sq) use ($pendingStatuses) {
                    $sq->whereIn('to_status', $pendingStatuses);
                })
                    ->orWhere(function ($dq) use ($deliveryPendingStatuses, $riderId) {
                        $dq->where('delivery_rider_id', $riderId)
                            ->whereHas('latestStatusHistory', function ($sq) use ($deliveryPendingStatuses) {
                                $sq->whereIn('to_status', $deliveryPendingStatuses);
                            });
                    });
            });
        } elseif ($filter === 'in_progress') {
            $query->where(function ($q) use ($inProgressStatuses, $deliveryInProgressStatuses, $riderId) {
                $q->whereHas('latestStatusHistory', function ($sq) use ($inProgressStatuses) {
                    $sq->whereIn('to_status', $inProgressStatuses);
                })
                    ->orWhere(function ($dq) use ($deliveryInProgressStatuses, $riderId) {
                        $dq->where('delivery_rider_id', $riderId)
                            ->whereHas('latestStatusHistory', function ($sq) use ($deliveryInProgressStatuses) {
                                $sq->whereIn('to_status', $deliveryInProgressStatuses);
                            });
                    });
            });
        } elseif ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->where(function ($paymentScope) use ($riderId) {
                $paymentScope
                    ->whereHas('paymentTransactions', function ($payment) use ($riderId) {
                        $payment
                            ->where('rider_id', $riderId)
                            ->whereIn('transaction_type', [
                                'rider_collection',
                                'car_driver_collection',
                                'drop_point_keeper_collection',
                            ])
                            ->whereNotNull('collected_at');
                    })
                    ->orWhereHas('adminSettlement', function ($settlement) use ($riderId) {
                        $settlement
                            ->where('collected_by', $riderId)
                            ->whereNotNull('settled_at');
                    });
            });
        } elseif ($filter === 'assigned') {
            $query->where(function ($q) use ($completedStatuses, $deliveryActiveStatuses, $riderId) {
                $q->whereHas('latestStatusHistory', function ($sq) use ($completedStatuses) {
                    $sq->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)->whereNotIn('to_status', $completedStatuses);
                })
                    ->orWhere(function ($subQuery) use ($riderId) {
                        $subQuery->where('status', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $riderId)->where('incomplete_status', ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value);
                    })
                    ->orWhere(function ($dq) use ($deliveryActiveStatuses, $riderId) {
                        $dq->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)->where('delivery_rider_id', $riderId)
                            ->whereHas('latestStatusHistory', function ($sq) use ($deliveryActiveStatuses) {
                                $sq->whereIn('to_status', $deliveryActiveStatuses);
                            });
                    });
            });
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Find a shipment by ID for a specific rider.
     *
     * @param int $shipmentId
     * @param int $riderId
     * @return Model|null
     */
    public function findForRider(int $shipmentId, int $riderId): ?Model
    {
        return $this->model
            ->with([
                'user',
                'rider',
                'directStatus',
                'indirectStatus',
                'review',
                'shelf',
                'size',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('id', $shipmentId)
            ->where(function ($q) use ($riderId) {
                $q->where('rider_id', $riderId)
                    ->orWhere('delivery_rider_id', $riderId);
            })
            ->first();
    }

    /**
     * Get jobs for Drop Point Keeper at first and second drop point stages.
     * Only returns jobs that are either:
     * 1. Available to scan (at the right status but no keeper assignment for the relevant stage)
     * 2. Already assigned to/scanned by the current keeper (via assignment tracking)
     *
     * Note: This method intentionally returns ALL jobs matching the status criteria
     * to show available jobs for scanning. Role-based filtering should be done at
     * the controller level if user-specific assignments are needed.
     */
    public function getDropPointKeeperJobs(?string $filter = 'assigned', ?int $userId = null)
    {
        $assignedStatuses = [
            // At first drop point, awaiting keeper processing
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            // At second drop point, awaiting keeper processing (*_to_droppoint modes)
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            // Ready for pickup - keeper needs to hand over to customer (*_to_droppoint modes)
            \App\Enums\ShipmentStatus::READY_FOR_PICKUP->value,
        ];

        $completedStatuses = [
            // After keeper dispatches from first drop point AND car driver picks up
            \App\Enums\ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            // After keeper hands over to customer at drop point
            \App\Enums\ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            // After keeper dispatches from second drop point for door delivery
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
            // Final delivery completed
            \App\Enums\ShipmentStatus::DELIVERED->value,
            // Pending handover - keeper collected payment and waiting to hand over to admin
            \App\Enums\ShipmentStatus::PENDING_HANDOVER->value,
        ];

        $query = $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'size',
                'riderCollection',
                'carDriverCollection',
                'shelf',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('delivery_speed', 'indirect');

        // Only show jobs that the keeper has scanned (has an assignment)
        if ($userId) {
            $query->whereHas('assignments', function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->where('role', \App\Enums\Role::DROP_POINT_KEEPER->value);
            });
        }

        // Filter by current status from status history, not legacy status column
        if ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->where(function ($paymentScope) use ($userId) {
                $paymentScope
                    ->whereHas('paymentTransactions', function ($payment) use ($userId) {
                        $payment
                            ->where('rider_id', $userId)
                            ->whereIn('transaction_type', [
                                'rider_collection',
                                'car_driver_collection',
                                'drop_point_keeper_collection',
                            ])
                            ->whereNotNull('collected_at');
                    });
            });
        } elseif ($filter === 'assigned') {
            // $query->whereHas('latestStatusHistory', function ($q) use ($assignedStatuses) {
            //     $q->whereIn('to_status', $assignedStatuses);
            // });

            $query->where(function ($q) use ($assignedStatuses, $userId) {

                $q->where(function ($subQuery) use ($assignedStatuses) {
                    $subQuery->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                        ->whereHas('latestStatusHistory', function ($history) use ($assignedStatuses) {
                            $history->whereIn('to_status', $assignedStatuses);
                        });
                })

                    ->orWhere(function ($subQuery) use ($userId) {
                        $subQuery->where('status', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $userId)->where('incomplete_status', ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value);
                    });
            });
        } else {
            // 'all' filter - show all jobs with assignments
            $allStatuses = array_merge($assignedStatuses, $completedStatuses);
            $query->whereHas('latestStatusHistory', function ($q) use ($allStatuses) {
                $q->whereIn('to_status', $allStatuses);
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Get paginated jobs for Drop Point Keeper.
     */
    public function getDropPointKeeperJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        $assignedStatuses = [
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::READY_FOR_PICKUP->value,
        ];

        $completedStatuses = [
            \App\Enums\ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
            \App\Enums\ShipmentStatus::DELIVERED->value,
            \App\Enums\ShipmentStatus::PENDING_HANDOVER->value,
        ];

        $query = $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'size',
                'riderCollection',
                'carDriverCollection',
                'shelf',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('delivery_speed', 'indirect');

        if ($userId) {
            $query->whereHas('assignments', function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->where('role', \App\Enums\Role::DROP_POINT_KEEPER->value);
            });
        }

        if ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->where(function ($paymentScope) use ($userId) {
                $paymentScope
                    ->whereHas('paymentTransactions', function ($payment) use ($userId) {
                        $payment
                            ->where('rider_id', $userId)
                            ->whereIn('transaction_type', [
                                'rider_collection',
                                'car_driver_collection',
                                'drop_point_keeper_collection',
                            ])
                            ->whereNotNull('collected_at');
                    });
            });
        } elseif ($filter === 'assigned') {
            $query->where(function ($q) use ($assignedStatuses, $userId) {
                $q->where(function ($subQuery) use ($assignedStatuses) {
                    $subQuery->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                        ->whereHas('latestStatusHistory', function ($history) use ($assignedStatuses) {
                            $history->whereIn('to_status', $assignedStatuses);
                        });
                })

                    ->orWhere(function ($subQuery) use ($userId) {
                        $subQuery->where('status', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $userId)->where('incomplete_status', ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value);
                    });
            });
        } else {
            $allStatuses = array_merge($assignedStatuses, $completedStatuses);
            $query->whereHas('latestStatusHistory', function ($q) use ($allStatuses) {
                $q->whereIn('to_status', $allStatuses);
            });
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Find shipment for keeper context (no rider constraint).
     */
    public function findForDropPointKeeper(int $shipmentId): ?Model
    {
        return $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'review',
                'size',
                'riderCollection',
                'shelf',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('id', $shipmentId)
            ->first();
    }

    /**
     * Get jobs for Car Driver (between drop point and warehouse, both directions)
     * IMPORTANT: Car drivers should NOT see jobs in DISPATCHED_TO_WAREHOUSE or DISPATCHED_FROM_WAREHOUSE
     * or DISPATCHED_FROM_DROP_POINT_2 status until they scan the parcel.
     * Only jobs that are already picked up (scanned) should appear in their job list.
     */
    public function getCarDriverJobs(?string $filter = 'assigned', ?int $userId = null)
    {
        $assignedStatuses = [
            // Leg 1: Drop Point 1 -> Warehouse (AFTER car driver scans)
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT->value, // Legacy
            // Leg 2: Warehouse -> Drop Point 2 (AFTER car driver scans)
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            // Leg 3: Drop Point 2 -> Customer (AFTER car driver scans)
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];

        $completedStatuses = [
            // Car driver completed delivery to warehouse (Leg 1 done)
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            // Car driver completed delivery to Drop Point 2 (Leg 2 done)
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            // Car driver completed final delivery to customer (Leg 3 done)
            \App\Enums\ShipmentStatus::DELIVERED->value,
            // Pending handover - car driver collected payment and waiting to hand over to admin
            \App\Enums\ShipmentStatus::PENDING_HANDOVER->value,
        ];

        $query = $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'size',
                'riderCollection',
                'carDriverCollection',
                'shelf',
                'dropPointKeeperCollection',
                'paymentTransactions',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('delivery_speed', 'indirect');

        // Only show jobs that the car driver has scanned (has an assignment)
        if ($userId) {
            $query->whereHas('assignments', function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->where('role', \App\Enums\Role::CAR_DRIVER->value);
            });
        }

        // Filter by current status from status history, not legacy status column
        if ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->where(function ($paymentScope) use ($userId) {
                $paymentScope
                    ->whereHas('paymentTransactions', function ($payment) use ($userId) {
                        $payment
                            ->where('rider_id', $userId)
                            ->whereIn('transaction_type', [
                                'rider_collection',
                                'car_driver_collection',
                                'drop_point_keeper_collection',
                            ])
                            ->whereNotNull('collected_at');
                    });
            });
        } elseif ($filter === 'assigned') {
            // $query->whereHas('latestStatusHistory', function ($q) use ($assignedStatuses) {
            //     $q->whereIn('to_status', $assignedStatuses);
            // });

            $query->where(function ($q) use ($assignedStatuses, $userId) {

                $q->where(function ($subQuery) use ($assignedStatuses) {
                    $subQuery->where('status', '!=', ShipmentStatus::INCOMPLETE->value)
                        ->whereHas('latestStatusHistory', function ($history) use ($assignedStatuses) {
                            $history->whereIn('to_status', $assignedStatuses);
                        });
                })

                    ->orWhere(function ($subQuery) use ($userId) {
                        $subQuery->where('status', ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $userId)->whereIn('incomplete_status', [ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value, ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value, ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value]);
                    });
            });
        } else {
            // 'all' filter - show all jobs with assignments
            $allStatuses = array_merge($assignedStatuses, $completedStatuses);
            $query->whereHas('latestStatusHistory', function ($q) use ($allStatuses) {
                $q->whereIn('to_status', $allStatuses);
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Get paginated jobs for Car Driver.
     */
    public function getCarDriverJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        $assignedStatuses = [
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];

        $completedStatuses = [
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::DELIVERED->value,
            \App\Enums\ShipmentStatus::PENDING_HANDOVER->value,
        ];

        $query = $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'size',
                'riderCollection',
                'carDriverCollection',
                'shelf',
                'dropPointKeeperCollection',
                'paymentTransactions',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('delivery_speed', 'indirect');

        if ($userId) {
            $query->whereHas('assignments', function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->where('role', \App\Enums\Role::CAR_DRIVER->value);
            });
        }

        if ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->where(function ($paymentScope) use ($userId) {
                $paymentScope
                    ->whereHas('paymentTransactions', function ($payment) use ($userId) {
                        $payment
                            ->where('rider_id', $userId)
                            ->whereIn('transaction_type', [
                                'rider_collection',
                                'car_driver_collection',
                                'drop_point_keeper_collection',
                            ])
                            ->whereNotNull('collected_at');
                    });
            });
        } elseif ($filter === 'assigned') {
            $query->where(function ($q) use ($assignedStatuses, $userId) {
                $q->where(function ($subQuery) use ($assignedStatuses) {
                    $subQuery->where('status', '!=', ShipmentStatus::INCOMPLETE->value)
                        ->whereHas('latestStatusHistory', function ($history) use ($assignedStatuses) {
                            $history->whereIn('to_status', $assignedStatuses);
                        });
                })

                    ->orWhere(function ($subQuery) use ($userId) {
                        $subQuery->where('status', ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $userId)->whereIn('incomplete_status', [ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value, ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value, ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value]);
                    });
            });
        } else {
            $allStatuses = array_merge($assignedStatuses, $completedStatuses);
            $query->whereHas('latestStatusHistory', function ($q) use ($allStatuses) {
                $q->whereIn('to_status', $allStatuses);
            });
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Get jobs for Warehouse Keeper at warehouse stage.
     */
    public function getWarehouseKeeperJobs(?string $filter = 'assigned', ?int $userId = null)
    {
        $assignedStatuses = [
            // At warehouse, awaiting keeper processing
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
        ];

        $completedStatuses = [
            // After keeper dispatches from warehouse
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::DELIVERED->value,
        ];

        $query = $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'size',
                'riderCollection',
                'carDriverCollection',
                'shelf',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('delivery_speed', 'indirect');

        // Only show jobs that the warehouse keeper has scanned (has an assignment)
        if ($userId) {
            $query->whereHas('assignments', function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->where('role', \App\Enums\Role::WAREHOUSE_KEEPER->value);
            });
        }

        // Filter by current status from status history, not legacy status column
        if ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->whereHas('paymentTransactions', function ($payment) use ($userId) {
                $payment
                    ->where('rider_id', $userId)
                    ->whereIn('transaction_type', [
                        'rider_collection',
                        'car_driver_collection',
                        'drop_point_keeper_collection',
                    ])
                    ->whereNotNull('collected_at');
            });
        } elseif ($filter === 'assigned') {
            // $query->whereHas('latestStatusHistory', function ($q) use ($assignedStatuses) {
            //     $q->whereIn('to_status', $assignedStatuses);
            // });

            $query->where(function ($q) use ($assignedStatuses, $userId) {

                $q->where(function ($subQuery) use ($assignedStatuses) {
                    $subQuery->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                        ->whereHas('latestStatusHistory', function ($history) use ($assignedStatuses) {
                            $history->whereIn('to_status', $assignedStatuses);
                        });
                })

                    ->orWhere(function ($subQuery) use ($userId) {
                        $subQuery->where('status', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $userId)
                            ->whereIn('incomplete_status', [
                                ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
                                ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
                            ]);
                    });
            });
        } else {
            // 'all' filter - show all jobs with assignments
            $allStatuses = array_merge($assignedStatuses, $completedStatuses);
            $query->whereHas('latestStatusHistory', function ($q) use ($allStatuses) {
                $q->whereIn('to_status', $allStatuses);
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Get paginated jobs for Warehouse Keeper.
     */
    public function getWarehouseKeeperJobsPaginated(?string $filter = 'assigned', ?int $userId = null, int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        $assignedStatuses = [
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
        ];

        $completedStatuses = [
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            \App\Enums\ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            \App\Enums\ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            \App\Enums\ShipmentStatus::DELIVERED->value,
        ];

        $query = $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'size',
                'riderCollection',
                'carDriverCollection',
                'shelf',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('delivery_speed', 'indirect');

        if ($userId) {
            $query->whereHas('assignments', function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->where('role', \App\Enums\Role::WAREHOUSE_KEEPER->value);
            });
        }

        if ($filter === 'completed') {
            $query->whereHas('latestStatusHistory', function ($q) use ($completedStatuses) {
                $q->whereIn('to_status', $completedStatuses);
            })->whereHas('paymentTransactions', function ($payment) use ($userId) {
                $payment
                    ->where('rider_id', $userId)
                    ->whereIn('transaction_type', [
                        'rider_collection',
                        'car_driver_collection',
                        'drop_point_keeper_collection',
                    ])
                    ->whereNotNull('collected_at');
            });
        } elseif ($filter === 'assigned') {
            $query->where(function ($q) use ($assignedStatuses, $userId) {
                $q->where(function ($subQuery) use ($assignedStatuses) {
                    $subQuery->where('status', '!=', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                        ->whereHas('latestStatusHistory', function ($history) use ($assignedStatuses) {
                            $history->whereIn('to_status', $assignedStatuses);
                        });
                })

                    ->orWhere(function ($subQuery) use ($userId) {
                        $subQuery->where('status', \App\Enums\ShipmentStatus::INCOMPLETE->value)
                            ->where('incomplete_assign_id', $userId)
                            ->whereIn('incomplete_status', [
                                ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
                                ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
                            ]);
                    });
            });
        } else {
            $allStatuses = array_merge($assignedStatuses, $completedStatuses);
            $query->whereHas('latestStatusHistory', function ($q) use ($allStatuses) {
                $q->whereIn('to_status', $allStatuses);
            });
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    public function findForWarehouseKeeper(int $shipmentId): ?Model
    {
        return $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'review',
                'size',
                'shelf',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('id', $shipmentId)
            ->first();
    }

    public function findForCarDriver(int $shipmentId): ?Model
    {
        return $this->model
            ->with([
                'user',
                'rider',
                'indirectStatus',
                'review',
                'shelf',
                'size',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'paymentTransactions',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
            ])
            ->where('id', $shipmentId)
            ->first();
    }

    /**
     * Get the latest shipment for a specific user.
     *
     * @param int $userId
     * @return Model|null
     */
    public function getLatestUserShipment(int $userId): ?Model
    {
        return $this->model
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();
    }
}
