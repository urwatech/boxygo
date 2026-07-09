<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\ShipmentStatus;
use App\Models\PaymentTransaction;
use App\Models\Shipment;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Support\SortHelper;
use Illuminate\Support\Facades\DB;

class WalletService
{
    /**
     * Get or create a wallet for a user.
     */
    public function getOrCreateWallet(int $userId): Wallet
    {
        return Wallet::firstOrCreate(
            ['user_id' => $userId],
            ['balance' => 0]
        );
    }

    /**
     * Get or create a wallet for a user.
     */
    public function paginateWallets(string $search = '', int $perPage = 10, ?string $sortBy = null, ?string $sortDir = null): mixed
    {
        $completedStatuses = $this->getCompletionStatuses();
        $query = Wallet::query()->with(['user']);

        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($subQ) use ($search) {
                        $subQ->where('name', 'like', "%{$search}%");
                    })
                    ->orWhere('balance', 'like', "%{$search}%");
            });
        }

        $this->applyWalletSorting($query, $sortBy, $sortDir);

        $paginator = $query->paginate($perPage);

        $paginator->getCollection()->transform(function ($wallet) use ($completedStatuses) {
            $user = $wallet->user;
            $roleNames = array_map('strtolower', $user->getRoleNames()->toArray());
            $isRider = in_array(strtolower(Role::RIDER->value), $roleNames, true);
            $isCarDriver = in_array(strtolower(Role::CAR_DRIVER->value), $roleNames, true);
            $isDropPointKeeper = in_array(strtolower(Role::DROP_POINT_KEEPER->value), $roleNames, true);

            $completedShipmentsQuery = function () use ($user, $completedStatuses, $isRider, $isCarDriver, $isDropPointKeeper) {
                $query = Shipment::query()
                    ->where(function ($q) use ($user, $isRider, $isCarDriver, $isDropPointKeeper) {
                        if ($isRider) {
                            $q->where('rider_id', $user->id);
                        }

                        // Also check assignments for car drivers and keepers
                        if ($isCarDriver) {
                            $q->orWhereHas('assignments', function ($assignmentQuery) use ($user) {
                                $assignmentQuery->where('user_id', $user->id)
                                    ->where('role', Role::CAR_DRIVER->value)
                                    ->whereNotNull('completed_at');
                            });
                        }

                        if ($isDropPointKeeper) {
                            $q->orWhereHas('assignments', function ($assignmentQuery) use ($user) {
                                $assignmentQuery->where('user_id', $user->id)
                                    ->where('role', Role::DROP_POINT_KEEPER->value)
                                    ->whereNotNull('completed_at');
                            });
                        }
                    })
                    ->where(function ($query) use ($completedStatuses) {
                        $query->whereHas('latestStatusHistory', function ($history) use ($completedStatuses) {
                            $history->whereIn('to_status', $completedStatuses);
                        })->orWhereIn('status', $completedStatuses);
                    });

                return $query;
            };

            $totalAmount = (int) $completedShipmentsQuery()->sum('total_fee');

            $cashCollectedQuery = PaymentTransaction::where('rider_id', $user->id)
                ->where('payment_method', 'cash')
                ->where('status', 'completed')
                ->whereNotNull('collected_at');

            if ($isRider) {
                $cashCollectedQuery->where('transaction_type', 'rider_collection');
            } elseif ($isCarDriver) {
                $cashCollectedQuery->where('transaction_type', 'car_driver_collection');
            } elseif ($isDropPointKeeper) {
                $cashCollectedQuery->where('transaction_type', 'drop_point_keeper_collection');
            } else {
                // If user has multiple roles, get all their collections
                $cashCollectedQuery->whereIn('transaction_type', [
                    'rider_collection',
                    'car_driver_collection',
                    'drop_point_keeper_collection',
                ]);
            }

            $cashCollected = $cashCollectedQuery->sum('amount');

            return [
                'id' => $wallet->id,
                'user_id' => $user->id,
                'name' => $user->name,
                'type' => $user->roles()->first()->name == 'customer' ? 'Customer' : 'Employee',
                'role' => $user->roles()->first()->name,
                'balance' => (float) $wallet->balance,
                'held_balance' => (float) $wallet->held_balance,
                'today_cod_collect' => $user->roles()->first()->name == 'customer' ? 0 : $cashCollected,
                'total_cod_collect' => $user->roles()->first()->name == 'customer' ? 0 : $totalAmount,
                'created_at' => $wallet->created_at->toDateTimeString(),
            ];
        });

        return $paginator;
    }

    public function paginateWalletTransactions(string $walletId, int $perPage = 10, string $search = '', string $status = '', ?string $sortBy = null, ?string $sortDir = null): mixed
    {
        $query = WalletTransaction::where('wallet_id', $walletId)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($searchQuery) use ($search) {
                    $like = "%{$search}%";

                    $searchQuery
                        ->where('id', 'like', $like)
                        ->orWhere('type', 'like', $like)
                        ->orWhere('amount', 'like', $like)
                        ->orWhere('status', 'like', $like)
                        ->orWhere('description', 'like', $like);
                });
            })
            ->when($status !== '' && strtolower($status) !== 'all', function ($query) use ($status) {
                $query->whereRaw('LOWER(TRIM(status)) = ?', [strtolower($status)]);
            });

        $query->orderBy(SortHelper::column($sortBy, [
            'id' => 'id',
            'type' => 'type',
            'amount' => 'amount',
            'status' => 'status',
            'description' => 'description',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ], 'created_at'), SortHelper::direction($sortDir, 'desc'));

        $query->orderByDesc('id');

        $query = $query->paginate($perPage);

        return $query;
    }

    private function applyWalletSorting($query, ?string $sortBy = null, ?string $sortDir = null): void
    {
        $sortKey = SortHelper::key($sortBy);
        $direction = SortHelper::direction($sortDir, 'desc');

        if ($sortKey === 'name' || $sortKey === 'user') {
            $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = wallets.user_id LIMIT 1), '') {$direction}");
        } else {
            $query->orderBy(SortHelper::column($sortBy, [
                'id' => 'wallets.id',
                'balance' => 'wallets.balance',
                'held_balance' => 'wallets.held_balance',
                'created_at' => 'wallets.created_at',
                'updated_at' => 'wallets.updated_at',
            ], 'wallets.created_at'), $direction);
        }

        $query->orderByDesc('wallets.id');
    }

    private function getCompletionStatuses(): array
    {
        return [
            ShipmentStatus::DELIVERED->value,
            ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            ShipmentStatus::PENDING_HANDOVER->value,
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
            ShipmentStatus::READY_FOR_PICKUP->value,
            ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];
    }

    /**
     * Get the balance details of a user's wallet.
     */
    public function getBalanceDetails(int $userId): array
    {
        $wallet = $this->getOrCreateWallet($userId);

        return [
            'total' => (float) $wallet->balance,
            'held' => (float) $wallet->held_balance,
            'available' => (float) ($wallet->balance - $wallet->held_balance),
        ];
    }

    /**
     * Get the available balance of a user's wallet.
     */
    public function getBalance(int $userId): float
    {
        $wallet = $this->getOrCreateWallet($userId);

        return (float) ($wallet->balance - $wallet->held_balance);
    }

    /**
     * Credit an amount to a user's wallet.
     */
    public function credit(int $userId, float $amount, ?string $description = null, ?array $metadata = null): WalletTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Credit amount must be positive.');
        }

        return DB::transaction(function () use ($userId, $amount, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId);

            $wallet->increment('balance', $amount);

            return $wallet->transactions()->create([
                'type' => 'credit',
                'amount' => $amount,
                'status' => 'completed',
                'description' => $description,
                'metadata' => $metadata,
            ]);
        });
    }

    /**
     * Debit an amount from a user's wallet.
     */
    public function debit(int $userId, float $amount, ?string $description = null, ?array $metadata = null): WalletTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Debit amount must be positive.');
        }

        return DB::transaction(function () use ($userId, $amount, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId);

            $available = $wallet->balance;
            if ($available < $amount) {
                throw new \RuntimeException('Insufficient available wallet balance.');
            }

            $wallet->decrement('balance', $amount);

            return $wallet->transactions()->create([
                'type' => 'debit',
                'amount' => $amount,
                'status' => 'completed',
                'description' => $description,
                'metadata' => $metadata,
            ]);
        });
    }

    /**
     * Hold an amount in a user's wallet.
     */
    public function hold(int $userId, float $amount, ?string $description = null, ?array $metadata = null): WalletTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Hold amount must be positive.');
        }

        return DB::transaction(function () use ($userId, $amount, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId);

            // $available = $wallet->held_balance;
            // if ($available < $amount) {
            //     throw new \RuntimeException('Insufficient available wallet balance for hold.');
            // }

            $wallet->increment('held_balance', $amount);

            return $wallet->transactions()->create([
                'type' => 'debit',
                'amount' => $amount,
                'status' => 'held',
                'description' => $description,
                'metadata' => $metadata,
            ]);
        });
    }

    /**
     * Debit and Hold an amount in a user's wallet.
     */
    public function debitAndHold(int $userId, float $amount, ?string $description = null, ?array $metadata = null): WalletTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Hold amount must be positive.');
        }

        return DB::transaction(function () use ($userId, $amount, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId);

            $wallet->increment('held_balance', $amount);
            $wallet->decrement('balance', $amount);

            return $wallet->transactions()->create([
                'type' => 'debit',
                'amount' => $amount,
                'status' => 'held',
                'description' => $description,
                'metadata' => $metadata,
            ]);
        });
    }

    /**
     * Hold an amount in a user's wallet.
     */
    public function creditAndHold(int $userId, float $amount, ?string $description = null, ?array $metadata = null): WalletTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Hold amount must be positive.');
        }

        return DB::transaction(function () use ($userId, $amount, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId);

            $wallet->increment('held_balance', $amount);

            $wallet->transactions()->create([
                'type' => 'credit',
                'amount' => $amount,
                'status' => 'completed',
                'description' => $description,
                'metadata' => $metadata,
            ]);

            return $wallet->transactions()->create([
                'type' => 'debit',
                'amount' => $amount,
                'status' => 'held',
                'description' => $description,
                'metadata' => $metadata,
            ]);
        });
    }

    /**
     * Hold an amount in a user's wallet.
     */
    public function creditHold(int $userId, float $amount, ?string $description = null, ?array $metadata = null): WalletTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Hold amount must be positive.');
        }

        return DB::transaction(function () use ($userId, $amount, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId);

            // $available = $wallet->held_balance;
            // if ($available < $amount) {
            //     throw new \RuntimeException('Insufficient available wallet balance for hold.');
            // }

            $wallet->increment('held_balance', $amount);
            $wallet->decrement('balance', $amount);

            return $wallet->transactions()->create([
                'type' => 'credit',
                'amount' => $amount,
                'status' => 'held',
                'description' => $description,
                'metadata' => $metadata,
            ]);
        });
    }

    /**
     * Release a held amount back to the user's available balance.
     */
    public function releaseHold(int $transactionId): bool
    {
        return DB::transaction(function () use ($transactionId) {
            $transaction = WalletTransaction::lockForUpdate()->find($transactionId);

            if (! $transaction || $transaction->status !== 'held') {
                return false;
            }

            $wallet = Wallet::lockForUpdate()->find($transaction->wallet_id);

            $wallet->decrement('held_balance', $transaction->amount);

            $transaction->update(['status' => 'released']);

            return true;
        });
    }

    /**
     * Release a held amount has deduct.
     */
    public function deductHold(int $userId, float $amount, ?string $description = null, ?array $metadata = null): bool
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Debit amount must be positive.');
        }

        return DB::transaction(function () use ($userId, $amount, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId);

            $available = $wallet->held_balance;
            if ($available < $amount) {
                throw new \RuntimeException('Insufficient available wallet held balance.');
            }

            $wallet->decrement('held_balance', $amount);

            $wallet->transactions()->create([
                'type' => 'debit',
                'amount' => $amount,
                'status' => 'completed',
                'description' => $description,
                'metadata' => $metadata,
            ]);

            return true;
        });
    }

    /**
     * Confirm a held amount (permanent debit).
     */
    public function pendingHold(?int $transactionId = null, ?int $userId = null, $amount = 0): bool
    {
        if ($userId) {
            return DB::transaction(function () use ($userId) {
                $wallet = Wallet::lockForUpdate()->where('user_id', $userId)->first();

                $wallet->increament('held_balance', $transaction->amount);

                $wallet->transactions()->create([
                    'type' => 'credit',
                    'amount' => $amount || 0,
                    'status' => 'pending',
                    'description' => ' - Pending Confirmation',
                    'metadata' => null,
                ]);

                return true;
            });
        } else {
            return DB::transaction(function () use ($transactionId) {
                $transaction = WalletTransaction::lockForUpdate()->find($transactionId);

                if (! $transaction || $transaction->status !== 'held') {
                    return false;
                }

                $wallet = Wallet::lockForUpdate()->find($transaction->wallet_id);

                $wallet->decrement('balance', $transaction->amount);
                $wallet->decrement('held_balance', $transaction->amount);

                $wallet->transactions()->create([
                    'type' => 'credit',
                    'amount' => $transaction->amount,
                    'status' => 'pending',
                    'description' => $transaction->description.' - Pending Confirmation',
                    'metadata' => $transaction->metadata,
                ]);

                return true;
            });
        }
    }

    /**
     * Confirm a held amount (permanent debit).
     */
    public function confirmHold(int $transactionId): bool
    {
        return DB::transaction(function () use ($transactionId) {
            $transaction = WalletTransaction::lockForUpdate()->find($transactionId);

            if (! $transaction || $transaction->status !== 'held') {
                return false;
            }

            $wallet = Wallet::lockForUpdate()->find($transaction->wallet_id);

            $wallet->decrement('balance', $transaction->amount);
            $wallet->decrement('held_balance', $transaction->amount);

            $transaction->update(['status' => 'completed']);

            return true;
        });
    }

    /**
     * Get transaction history for a user's wallet.
     */
    public function getTransactions(int $userId, int $limit = 50): \Illuminate\Database\Eloquent\Collection
    {
        $wallet = $this->getOrCreateWallet($userId);

        return $wallet->transactions()->orderBy('created_at', 'desc')->limit($limit)->get();
    }
}
