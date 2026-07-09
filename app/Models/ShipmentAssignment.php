<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShipmentAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'user_id',
        'assigned_by_id',
        'role',
        'stage',
        'assigned_at',
        'started_at',
        'completed_at',
        'notes',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /**
     * Get the shipment this assignment belongs to
     */
    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    /**
     * Get the user assigned to this stage
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the user who made this assignment
     */
    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by_id');
    }

    /**
     * Check if this assignment is active (started but not completed)
     */
    public function isActive(): bool
    {
        return $this->started_at !== null && $this->completed_at === null;
    }

    /**
     * Check if this assignment is pending (not started)
     */
    public function isPending(): bool
    {
        return $this->started_at === null;
    }

    /**
     * Check if this assignment is completed
     */
    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    /**
     * Get the duration in minutes (if completed)
     */
    public function getDurationMinutes(): ?int
    {
        if ($this->started_at && $this->completed_at) {
            return $this->started_at->diffInMinutes($this->completed_at);
        }

        return null;
    }

    /**
     * Scope to get active assignments
     */
    public function scopeActive($query)
    {
        return $query->whereNotNull('started_at')
            ->whereNull('completed_at');
    }

    /**
     * Scope to get completed assignments
     */
    public function scopeCompleted($query)
    {
        return $query->whereNotNull('completed_at');
    }

    /**
     * Scope to get pending assignments
     */
    public function scopePending($query)
    {
        return $query->whereNull('started_at');
    }

    /**
     * Scope to filter by stage
     */
    public function scopeForStage($query, string $stage)
    {
        return $query->where('stage', $stage);
    }

    /**
     * Scope to filter by user
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }
}
