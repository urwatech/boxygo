<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shelf extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'location',
        'capacity',
        'occupied_slots',
        'drop_point_id',
        'is_active',
        'warehouse_id'
    ];

    protected $casts = [
        'capacity' => 'integer',
        'occupied_slots' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Shipments currently stored on this shelf.
     */
    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    /**
     * Calculate available capacity on the shelf.
     */
    public function getAvailableCapacityAttribute(): int
    {
        return max(0, $this->capacity - $this->occupied_slots);
    }
}
