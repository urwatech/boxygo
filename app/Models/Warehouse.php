<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $location
 * @property string $city
 * @property float|null $latitude
 * @property float|null $longitude
 * @property array|null $drawn_paths
 * @property int|null $zone_id
 * @property string $status
 */
class Warehouse extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'code',
        'name',
        'location',
        'city',
        'latitude',
        'longitude',
        'zone_id',
        'status',
        'drawn_paths',
    ];

    protected $casts = [
        'drawn_paths' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    protected static function booted(): void
    {
        static::creating(function (Warehouse $warehouse) {
            if (empty($warehouse->code)) {
                $warehouse->code = self::generateNextCode();
            }

            if (empty($warehouse->status)) {
                $warehouse->status = self::STATUS_ACTIVE;
            }
        });
    }

    /**
     * Generate a sequential warehouse code.
     */
    protected static function generateNextCode(): string
    {
        $lastId = (int) self::query()->max('id');

        return sprintf('WH-%03d', $lastId + 1);
    }

    /**
     * Get the zone that this warehouse is assigned to.
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    /**
     * Get all shelves that belong to this warehouse.
     */
    public function shelves(): HasMany
    {
        return $this->hasMany(Shelf::class);
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class, 'warehouse_id');
    }
}
