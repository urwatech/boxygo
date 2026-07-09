<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property string $name
 * @property string $address
 * @property string|null $city
 * @property float $latitude
 * @property float $longitude
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class DropPoint extends Model
{
    protected $fillable = [
        'ext_id',
        'name',
        'icon',
        'serial_no',
        'dp_no',
        'open_hours',
        'zone_ext_id',
        'zone_id',
        'address',
        'city',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    /**
     * Get all shelves that belong to this drop point.
     */
    public function shelves(): HasMany
    {
        return $this->hasMany(Shelf::class);
    }

    /**
     * Get the zone that this drop point belongs to
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class, 'drop_point_id');
    }
}
