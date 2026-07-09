<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'rider_id',
        'transaction_type',
        'amount',
        'payment_method',
        'status',
        'notes',
        'collected_at',
        'rider_deposited_at',
        'settled_at',
        'collected_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'collected_at' => 'datetime',
        'rider_deposited_at' => 'datetime',
        'settled_at' => 'datetime',
    ];

    /**
     * Get the shipment for this transaction
     */
    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    /**
     * Get the rider who collected the payment
     */
    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    /**
     * Get the admin who collected from rider
     */
    public function collectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }

    /**
     * Scope for rider collections (from customer)
     */
    public function scopeRiderCollections($query)
    {
        return $query->where('transaction_type', 'rider_collection');
    }

    /**
     * Scope for admin settlements (from rider to admin)
     */
    public function scopeAdminSettlements($query)
    {
        return $query->where('transaction_type', 'admin_settlement');
    }

    /**
     * Scope for pending transactions
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for completed transactions
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Check if transaction is COD
     */
    public function isCod(): bool
    {
        return $this->payment_method === 'cash';
    }

    /**
     * Check if transaction is online payment
     */
    public function isOnline(): bool
    {
        return $this->payment_method === 'online';
    }

    /**
     * Check if payment has been collected from customer
     */
    public function isCollected(): bool
    {
        return !is_null($this->collected_at);
    }

    /**
     * Check if rider has deposited the payment to admin
     */
    public function isDeposited(): bool
    {
        return !is_null($this->rider_deposited_at);
    }

    /**
     * Check if payment has been settled with admin
     */
    public function isSettled(): bool
    {
        return !is_null($this->settled_at);
    }
}
