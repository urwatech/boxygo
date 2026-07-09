<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShipmentStatusHistory extends Model
{
    use HasFactory;

    const UPDATED_AT = null; // We only need created_at for history

    protected $table = 'shipment_status_history';

    protected $fillable = [
        'shipment_id',
        'user_id',
        'from_status',
        'to_status',
        'progress_index',
        'latitude',
        'longitude',
        'location_name',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'created_at' => 'datetime',
    ];

    /**
     * Get the shipment this history entry belongs to
     */
    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    /**
     * Get the user who made this status change
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Check if this is an initial status (first entry)
     */
    public function isInitial(): bool
    {
        return $this->from_status === null;
    }

    /**
     * Get the status change description
     */
    public function getChangeDescription(): string
    {
        if ($this->isInitial()) {
            return "Status set to {$this->to_status}";
        }
        return "Status changed from {$this->from_status} to {$this->to_status}";
    }

    /**
     * Check if location was captured
     */
    public function hasLocation(): bool
    {
        return $this->latitude !== null && $this->longitude !== null;
    }

    /**
     * Get location coordinates as array
     */
    public function getLocationCoordinates(): ?array
    {
        if ($this->hasLocation()) {
            return [
                'lat' => (float) $this->latitude,
                'lng' => (float) $this->longitude,
            ];
        }
        return null;
    }

    /**
     * Scope to get history for a specific shipment
     */
    public function scopeForShipment($query, int $shipmentId)
    {
        return $query->where('shipment_id', $shipmentId);
    }

    /**
     * Scope to get history by a specific user
     */
    public function scopeByUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to get history in chronological order
     */
    public function scopeChronological($query)
    {
        return $query->orderBy('created_at', 'asc');
    }

    /**
     * Scope to get recent history first
     */
    public function scopeRecent($query)
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Scope to filter by status
     */
    public function scopeToStatus($query, string $status)
    {
        return $query->where('to_status', $status);
    }
}
