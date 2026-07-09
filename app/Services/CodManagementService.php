<?php

namespace App\Services;

use App\Contracts\CodManagementServiceInterface;
use App\Http\Resources\UserResource;
use App\Models\PaymentTransaction;
use App\Models\Shipment;
use App\Notifications\PaymentCollectedNotification;
use App\Support\ShipmentPaymentHelper;
use App\Support\SortHelper;
use Illuminate\Support\Facades\Log;

class CodManagementService implements CodManagementServiceInterface
{
    public function getStatistics(): array
    {
        $user = auth()->user();
        $today = now()->startOfDay();

        // Total COD Amount - sum of today's collections (rider, car driver, and drop point keeper)
        // Filter by zone if applicable
        $todayQuery = PaymentTransaction::whereIn('transaction_type', ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'])
            ->where('payment_method', 'cash')
            ->whereDate('created_at', $today);

        if ($user && ! $user->hasRole('superadmin') && $user->platform === 'Admin Portal') {
            $zoneIds = $user->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $todayQuery->whereHas('shipment', function ($q) use ($zoneIds) {
                    $q->whereIn('zone_id', $zoneIds);
                });
            }
        }
        $totalCodAmount = $todayQuery->sum('amount');

        // Total Collected Amount - sum of all admin settlements (what admin has collected)
        $collectedQuery = PaymentTransaction::where('transaction_type', 'admin_settlement')
            ->where('payment_method', 'cash');

        if ($user && ! $user->hasRole('superadmin') && $user->platform === 'Admin Portal') {
            $zoneIds = $user->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $collectedQuery->whereHas('shipment', function ($q) use ($zoneIds) {
                    $q->whereIn('zone_id', $zoneIds);
                });
            }
        }
        $totalCollectedAmount = $collectedQuery->sum('amount');

        // Receivable Amount - sum of collections not yet settled with admin
        $receivableQuery = PaymentTransaction::whereIn('transaction_type', ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'])
            ->where('payment_method', 'cash')
            ->where('status', 'completed')
            ->whereNull('settled_at');

        if ($user && ! $user->hasRole('superadmin') && $user->platform === 'Admin Portal') {
            $zoneIds = $user->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $receivableQuery->whereHas('shipment', function ($q) use ($zoneIds) {
                    $q->whereIn('zone_id', $zoneIds);
                });
            }
        }
        $receivableAmount = $receivableQuery->sum('amount');

        // Overdue Amount - collections more than 7 days old not settled
        $sevenDaysAgo = now()->subDays(7);
        $overdueQuery = PaymentTransaction::whereIn('transaction_type', ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'])
            ->where('payment_method', 'cash')
            ->where('status', 'completed')
            ->whereNull('settled_at')
            ->where('collected_at', '<=', $sevenDaysAgo);

        if ($user && ! $user->hasRole('superadmin') && $user->platform === 'Admin Portal') {
            $zoneIds = $user->getAssignedZoneIds();
            if (! empty($zoneIds)) {
                $overdueQuery->whereHas('shipment', function ($q) use ($zoneIds) {
                    $q->whereIn('zone_id', $zoneIds);
                });
            }
        }
        $overdueAmount = $overdueQuery->sum('amount');

        return [
            'total_cod_amount' => $this->formatAmount($totalCodAmount),
            'total_collected_amount' => $this->formatAmount($totalCollectedAmount),
            'receivable_amount' => $this->formatAmount($receivableAmount),
            'overdue_amount' => $this->formatAmount($overdueAmount),
        ];
    }

    /**
     * Format amount to display in K format
     */
    private function formatAmount(float $amount): string
    {
        if ($amount >= 1000) {
            return number_format($amount / 1000, 1).'k';
        }

        return number_format($amount, 0);
    }

    public function paginateShipments(?string $search = '', array $filters = [], int $perPage = 10): mixed
    {
        $user = auth()->user();

        // Get individual COD shipments without grouping, filtered by zone if applicable
        $query = Shipment::query()
            ->forUser($user)
            ->where(function ($q) {
                $q->where('payment_method', 'cash')->orWhere('receiver_payment_method', 'cash');
            })
            ->with([
                'rider:id,name,member_since,avatar_path',
                'riderCollection',
                'adminSettlement',
                'assignments.user:id,name,member_since,avatar_path',
                'paymentTransactions.rider:id,name,member_since,avatar_path',
            ]);

        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('rider', function ($subQ) use ($search) {
                    $subQ->where('name', 'like', "%{$search}%");
                })->orWhere(function ($subQ) use ($search) {
                    // Allow searching for "unassigned"
                    if (stripos('unassigned', $search) !== false) {
                        $subQ->whereNull('rider_id');
                    }
                });
            });
        }

        // Apply rider filter (by rider name) if provided
        $riderName = trim((string) ($filters['rider'] ?? ''));
        if ($riderName !== '' && strtolower($riderName) !== 'all') {
            $query->whereHas('rider', function ($q) use ($riderName) {
                $q->where('name', $riderName);
            });
        }

        $this->applyCodStatusFilter($query, trim((string) ($filters['status'] ?? '')));
        $this->applyCodSorting($query, $filters);

        $paginator = $query->paginate($perPage);

        // Transform the data for the frontend
        $paginator->getCollection()->transform(function ($shipment) {
            // For individual shipment, orders delivered/pending is either 1 or 0
            // Check if delivered OR if admin has settled (which means it was delivered and collected)
            $isDelivered = in_array($shipment->status, ['delivered', 'Delivered', 'Pending Handover', 'Picked up by Receiver']);
            $hasAdminSettlement = $shipment->adminSettlement && $shipment->adminSettlement->isSettled();

            $ordersDelivered = ($isDelivered || $hasAdminSettlement) ? 1 : 0;
            $ordersPending = ! in_array($shipment->status, ['delivered', 'Delivered', 'cancelled', 'Pending Handover', 'Picked up by Receiver']) && ! $hasAdminSettlement ? 1 : 0;

            // Get the employee who collected the COD amount
            $collector = $this->getPaymentCollector($shipment);

            return [
                'id' => $shipment->id,
                'date' => $shipment->created_at->format('Y-m-d'),
                'rider' => $collector['name'],
                'rider_id' => $collector['id'],
                'rider_avatar' => $collector['avatar'],
                'rider_role' => $collector['role'],
                'rider_role_key' => $collector['role_key'],
                'member_since' => $collector['member_since'],
                'orders_delivered' => $ordersDelivered,
                'orders_pending' => $ordersPending,
                'good_amount' => 'SYP '.number_format($shipment->parcel_amount ?? 0, 0),
                'shipment_amount' => 'SYP '.number_format($shipment->total_fee ?? 0, 0),
                'status' => $this->determineCodStatusFromShipment($shipment),
            ];
        });

        return $paginator;
    }

    private function applyCodStatusFilter($query, string $status): void
    {
        $statusKey = strtolower(trim((string) preg_replace('/[\s-]+/', '_', $status)));

        if ($statusKey === '' || $statusKey === 'all') {
            return;
        }

        $collectionTypes = ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'];
        $deliveredStatuses = ['delivered', 'Delivered', 'Pending Handover', 'Picked up by Receiver'];
        $sevenDaysAgo = now()->subDays(7);

        match ($statusKey) {
            'settled', 'paid' => $query->whereHas('adminSettlement', function ($settlementQuery) {
                $settlementQuery->whereNotNull('settled_at');
            }),
            'overdue' => $query
                ->whereDoesntHave('adminSettlement', function ($settlementQuery) {
                    $settlementQuery->whereNotNull('settled_at');
                })
                ->whereHas('paymentTransactions', function ($transactionQuery) use ($collectionTypes, $sevenDaysAgo) {
                    $transactionQuery->whereIn('transaction_type', $collectionTypes)
                        ->where('status', 'completed')
                        ->whereNotNull('collected_at')
                        ->where('collected_at', '<=', $sevenDaysAgo);
                }),
            'collected' => $query
                ->whereDoesntHave('adminSettlement', function ($settlementQuery) {
                    $settlementQuery->whereNotNull('settled_at');
                })
                ->whereHas('paymentTransactions', function ($transactionQuery) use ($collectionTypes, $sevenDaysAgo) {
                    $transactionQuery->whereIn('transaction_type', $collectionTypes)
                        ->where('status', 'completed')
                        ->whereNotNull('collected_at')
                        ->where('collected_at', '>', $sevenDaysAgo);
                }),
            'pending_collection' => $query
                ->whereDoesntHave('adminSettlement', function ($settlementQuery) {
                    $settlementQuery->whereNotNull('settled_at');
                })
                ->whereDoesntHave('paymentTransactions', function ($transactionQuery) use ($collectionTypes) {
                    $transactionQuery->whereIn('transaction_type', $collectionTypes)
                        ->where('status', 'completed')
                        ->whereNotNull('collected_at');
                })
                ->whereIn('status', $deliveredStatuses),
            'pending' => $query
                ->whereDoesntHave('adminSettlement', function ($settlementQuery) {
                    $settlementQuery->whereNotNull('settled_at');
                })
                ->whereDoesntHave('paymentTransactions', function ($transactionQuery) use ($collectionTypes) {
                    $transactionQuery->whereIn('transaction_type', $collectionTypes)
                        ->where('status', 'completed')
                        ->whereNotNull('collected_at');
                })
                ->whereNotIn('status', $deliveredStatuses),
            default => $query->whereRaw('LOWER(TRIM(status)) = ?', [str_replace('_', ' ', $statusKey)]),
        };
    }

    private function applyCodSorting($query, array $filters): void
    {
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortDir = SortHelper::direction((string) ($filters['sort_dir'] ?? ''), 'desc');
        $sortKey = SortHelper::key($sortBy);

        if ($sortKey === 'rider') {
            $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = shipments.rider_id LIMIT 1), '') {$sortDir}");
        } else {
            $query->orderBy(SortHelper::column($sortBy, [
                'id' => 'shipments.id',
                'date' => 'shipments.created_at',
                'created_at' => 'shipments.created_at',
                'order_number' => 'shipments.order_number',
                'good_amount' => 'shipments.parcel_amount',
                'parcel_amount' => 'shipments.parcel_amount',
                'shipment_amount' => 'shipments.total_fee',
                'total_fee' => 'shipments.total_fee',
                'status' => 'shipments.status',
                'payment_status' => 'shipments.payment_status',
                'updated_at' => 'shipments.updated_at',
            ], 'shipments.created_at'), $sortDir);
        }

        $query->orderByDesc('shipments.id');
    }

    public function markAsCollected(int $shipmentId): bool
    {
        $shipment = Shipment::where(function ($q) {
            $q->where('payment_method', 'cash')->orWhere('receiver_payment_method', 'cash');
        })
            ->where('id', $shipmentId)
            ->first();

        if (! $shipment) {
            throw new \Exception('Shipment not found or is not a COD shipment.');
        }

        // Validate shipment must be delivered before collecting payment
        if ($shipment->status !== 'delivered' && ! in_array($shipment->status, ['Delivered', 'Picked up by Receiver', 'Pending Handover'])) {
            throw new \Exception('Cannot mark as collected. Shipment must be delivered first. Current status: '.$shipment->status);
        }

        // Find the collection transaction (rider, car driver, or drop point keeper)
        $collectionTransaction = $shipment->paymentTransactions()
            ->whereIn('transaction_type', ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'])
            ->where('status', 'completed')
            ->whereNotNull('collected_at')
            ->latest('collected_at')
            ->first();

        if (! $collectionTransaction) {
            throw new \Exception('Payment has not been collected from customer yet. No collection record exists.');
        }

        // Validate collector has deposited the money to admin
        if (! $collectionTransaction->rider_deposited_at) {
            throw new \Exception('Cannot mark as collected. The collector has not deposited the payment to admin yet. The collector must physically hand over the cash before it can be marked as collected.');
        }

        // Check if already settled with admin
        if ($collectionTransaction->settled_at) {
            throw new \Exception('Payment has already been settled with admin on '.$collectionTransaction->settled_at?->format('Y-m-d H:i:s').'.');
        }

        // Get the collector's user ID from the transaction
        $collectorId = $collectionTransaction->rider_id; // Note: misleading column name, but stores collector user_id

        // Determine settlement amount using the same total shown on customer/admin views
        $collectableTotal = ShipmentPaymentHelper::getCollectableTotal($shipment);
        if ($collectableTotal <= 0) {
            throw new \Exception('Cannot mark as collected. Invalid or zero payment amount.');
        }

        // Create admin settlement transaction
        \App\Models\PaymentTransaction::create([
            'shipment_id' => $shipmentId,
            'rider_id' => $collectorId,
            'transaction_type' => 'admin_settlement',
            'amount' => $collectableTotal,
            'payment_method' => 'cash',
            'status' => 'completed',
            'settled_at' => now(),
            'collected_by' => auth()->user()?->id,
            'notes' => 'Cash collected from '.str_replace('_', ' ', $collectionTransaction->transaction_type).' by admin',
        ]);

        // Update collection transaction record
        $collectionTransaction->update([
            'settled_at' => now(),
            'collected_by' => auth()->user()?->id,
        ]);

        // Send notification to customer about payment collection
        if ($shipment->user) {
            try {
                Log::info('📤 Attempting to send payment collected notification', [
                    'shipment_id' => $shipment->id,
                    'order_number' => $shipment->order_number,
                    'customer_id' => $shipment->user->id,
                    'customer_name' => $shipment->user->name,
                    'amount' => $collectableTotal,
                ]);

                $shipment->user->notify(new PaymentCollectedNotification(
                    shipmentId: (string) $shipment->id,
                    trackingNumber: $shipment->order_number,
                    amount: $collectableTotal,
                    collectedAt: now()->toDateTimeString()
                ));

                Log::info('✅ Payment collected notification sent successfully', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id,
                ]);
            } catch (\Exception $e) {
                Log::error('❌ Failed to send payment collected notification', [
                    'shipment_id' => $shipment->id,
                    'customer_id' => $shipment->user->id ?? null,
                    'error' => $e->getMessage(),
                ]);
            }

            // SR4: Send SMS - Delivery Charges paid
            try {
                $smsService = app(MtnSmsService::class);
                $locale = strtolower((string) ($shipment->user->language ?? 'en')) === 'ar' ? 'ar' : 'en';

                if ($shipment->sender_phone) {
                    $smsService->sendLocalized($shipment->sender_phone, 'smsDeliveryChargesPaid', [
                        'trackingNumber' => $shipment->order_number,
                        'amount' => number_format($collectableTotal, 0),
                    ], $locale);
                }

                if ($shipment->receiver_phone) {
                    $smsService->sendLocalized($shipment->receiver_phone, 'smsDeliveryChargesPaid', [
                        'trackingNumber' => $shipment->order_number,
                        'amount' => number_format($collectableTotal, 0),
                    ], $locale);
                }
            } catch (\Exception $e) {
                Log::error('❌ Failed to send delivery charges paid SMS', [
                    'shipment_id' => $shipment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return true;
    }

    public function getShipmentDetails(int $shipmentId): array
    {
        $shipment = Shipment::where('payment_method', 'cash')
            ->with([
                'user:id,name',
                'rider:id,name,member_since,avatar_path',
                'riderCollection',
                'assignments.user:id,name,member_since,avatar_path',
                'paymentTransactions.rider:id,name,member_since,avatar_path',
            ])
            ->findOrFail($shipmentId);

        $paymentDetails = ShipmentPaymentHelper::calculatePaymentDetails($shipment);
        $collectableTotal = $paymentDetails['collectable_total'] ?? 0;

        // Only show this specific shipment, not all rider shipments
        $shipments = collect([[
            'ship_id' => 'MP'.str_pad($shipment->id, 7, '0', STR_PAD_LEFT),
            'order_number' => $shipment->order_number,
            'sender' => $shipment->sender_name ?? $shipment->user?->name ?? 'N/A',
            'receiver' => $shipment->receiver_name ?? 'N/A',
            'shipment_type' => $this->getShipmentType($shipment),
            'shipment_payment' => 'SYP '.number_format($shipment->parcel_amount ?? 0, 0),
        ]]);

        // Stats for this specific shipment only
        $totalCodAmount = $collectableTotal;

        // Check if payment has been collected by any role (rider, car driver, or drop point keeper)
        $collectionTransaction = $shipment->paymentTransactions()
            ->whereIn('transaction_type', ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'])
            ->where('status', 'completed')
            ->whereNotNull('collected_at')
            ->latest('collected_at')
            ->first();

        $completedOrders = $collectionTransaction ? 1 : 0;

        $sevenDaysAgo = now()->subDays(7);
        $overdueOrders = ($shipment->payment_status === 'pending'
            && $shipment->status === 'delivered'
            && $shipment->updated_at?->lte($sevenDaysAgo)) ? 1 : 0;

        // Get the employee who collected the COD amount
        $collector = $this->getPaymentCollector($shipment);

        return [
            'ship_id' => 'MP'.str_pad($shipment->id, 7, '0', STR_PAD_LEFT),
            'order_number' => $shipment->order_number,
            'date' => $shipment->created_at->format('Y-m-d'),
            'rider' => $collector['name'],
            'rider_id' => $collector['id'],
            'rider_avatar' => $collector['avatar'],
            'rider_role' => $collector['role'],
            'rider_role_key' => $collector['role_key'],
            'member_since' => $collector['member_since'],
            'rider_profile' => $collector['user'] ? new UserResource($collector['user']) : null,
            'sender' => $shipment->sender_name ?? $shipment->user?->name ?? 'N/A',
            'receiver' => $shipment->receiver_name ?? 'N/A',
            'sender_phone' => $shipment->sender_phone ?? 'N/A',
            'receiver_phone' => $shipment->receiver_phone ?? 'N/A',
            'pickup_address' => $shipment->pickup_address ?? 'N/A',
            'delivery_address' => $shipment->delivery_address ?? 'N/A',
            'shipment_type' => $this->getShipmentType($shipment),
            'parcel_amount' => 'SYP '.number_format($shipment->parcel_amount ?? 0, 0),
            'total_fee' => 'SYP '.number_format($collectableTotal, 0),
            'collectable_total' => $collectableTotal,
            'payment' => $paymentDetails,
            'status' => $shipment->status,
            'payment_status' => $shipment->payment_status,
            'cod_status' => $this->determineCodStatusFromShipment($shipment),
            'stats' => [
                'total_cod_amount' => $this->formatAmount($totalCodAmount),
                'completed_orders' => $completedOrders,
                'overdue' => $overdueOrders,
            ],
            'shipments' => $shipments,
        ];
    }

    private function determineCodStatusFromShipment(Shipment $shipment): string
    {
        // Check if admin has settled
        if ($shipment->adminSettlement && $shipment->adminSettlement->isSettled()) {
            return 'settled';
        }

        // Check for any collection transaction (rider, car driver, or drop point keeper)
        $collectionTransaction = $shipment->paymentTransactions()
            ->whereIn('transaction_type', ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'])
            ->where('status', 'completed')
            ->whereNotNull('collected_at')
            ->latest('collected_at')
            ->first();

        if ($collectionTransaction) {
            // Check if overdue for settlement (collected more than 7 days ago)
            $sevenDaysAgo = now()->subDays(7);
            if ($collectionTransaction->collected_at->lte($sevenDaysAgo)) {
                return 'overdue';
            }

            return 'collected';
        }

        // Check if shipment is delivered but not collected
        if (in_array($shipment->status, ['delivered', 'Delivered', 'Pending Handover'])) {
            return 'pending_collection';
        }

        // Default to pending
        return 'pending';
    }

    private function getShipmentType(Shipment $shipment): string
    {
        if ($shipment->delivery_speed === 'direct') {
            return 'Direct/DD';
        }

        return 'In-Direct/DP';
    }

    /**
     * Get the employee responsible for collecting the COD amount.
     * When no one has collected yet, mark as unassigned.
     */
    private function getPaymentCollector(Shipment $shipment): array
    {
        $transactions = $shipment->relationLoaded('paymentTransactions')
            ? $shipment->paymentTransactions
            : $shipment->paymentTransactions()->with('rider')->get();

        $collectionTransaction = $transactions
            ->filter(fn ($transaction) => in_array(
                $transaction->transaction_type,
                ['rider_collection', 'car_driver_collection', 'drop_point_keeper_collection'],
                true
            ))
            ->sortByDesc(function ($transaction) {
                return $transaction->collected_at ?? $transaction->created_at;
            })
            ->first();

        if ($collectionTransaction && $collectionTransaction->rider) {
            $user = $collectionTransaction->rider;

            return [
                'id' => $user->id,
                'name' => $user->name ?? 'Unknown',
                'avatar' => media_url($user->avatar_path),
                'member_since' => $user->member_since,
                'user' => $user,
                'role' => $this->mapCollectorRoleLabel($collectionTransaction->transaction_type),
                'role_key' => $this->mapCollectorRoleKey($collectionTransaction->transaction_type),
            ];
        }

        // For Direct deliveries: if rider is assigned, they are responsible for payment collection
        if ($shipment->delivery_speed === 'direct' && $shipment->rider_id) {
            $user = $shipment->relationLoaded('rider') ? $shipment->rider : $shipment->rider()->first();

            if ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name ?? 'Unknown',
                    'avatar' => media_url($user->avatar_path),
                    'member_since' => $user->member_since,
                    'user' => $user,
                    'role' => 'Rider',
                    'role_key' => 'rider',
                ];
            }
        }

        return [
            'id' => null,
            'name' => 'Unassigned',
            'avatar' => null,
            'member_since' => null,
            'user' => null,
            'role' => 'Unassigned',
            'role_key' => 'unassigned',
        ];
    }

    private function mapCollectorRoleLabel(?string $transactionType): string
    {
        return match ($transactionType) {
            'rider_collection' => 'Rider',
            'car_driver_collection' => 'Car Driver',
            'drop_point_keeper_collection' => 'Drop Point Keeper',
            default => 'Employee',
        };
    }

    private function mapCollectorRoleKey(?string $transactionType): string
    {
        return match ($transactionType) {
            'rider_collection' => 'rider',
            'car_driver_collection' => 'car_driver',
            'drop_point_keeper_collection' => 'drop_point_keeper',
            default => 'employee',
        };
    }
}
