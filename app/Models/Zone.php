<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $city
 * @property string $status
 * @property bool $is_assigned_to_hub
 * @property string|null $assigned_hub_name
 */
class Zone extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'ext_id',
        'code',
        'name',
        'door_delivery',
        'door_service_fees',
        'direct_delivery',
        'direct_srv_fees',
        'city',
        'sub_district_name',
        'drawn_paths',
        'status',
        'is_deleted',
        'is_assigned_to_hub',
        'assigned_hub_name',
        'bound_min_lat',
        'bound_max_lat',
        'bound_min_lng',
        'bound_max_lng',
    ];

    protected $casts = [
        'is_assigned_to_hub' => 'boolean',
        'door_delivery' => 'boolean',
        'direct_delivery' => 'boolean',
        'door_service_fees' => 'float',
        'direct_srv_fees' => 'float',
        'drawn_paths' => 'array',
        'is_deleted' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (Zone $zone) {
            if (empty($zone->code)) {
                $zone->code = self::generateNextCode();
            }

            if (empty($zone->status)) {
                $zone->status = self::STATUS_ACTIVE;
            }
        });
    }

    /**
     * Generate a sequential zone code.
     */
    protected static function generateNextCode(): string
    {
        $lastId = (int) self::query()->max('id');

        return sprintf('ZN-%03d', $lastId + 1);
    }

    /**
     * Employees assigned to this zone.
     */
    public function employees(): HasMany
    {
        return $this->hasMany(User::class)->where('platform', 'Mobile App');
    }

    /**
     * Active employees in this zone.
     */
    public function activeEmployees(): HasMany
    {
        return $this->hasMany(User::class)
            ->where('platform', 'Mobile App')
            ->where('status', 'active');
    }

    /**
     * Shipments assigned to this zone.
     */
    public function shipments(): HasMany
    {
        return $this->hasMany(\App\Models\Shipment::class);
    }

    /**
     * Warehouses assigned to this zone.
     */
    public function warehouses(): HasMany
    {
        return $this->hasMany(\App\Models\Warehouse::class);
    }

    /**
     * Scope query to exclude custom soft-deleted zones.
     */
    public function scopeNotDeleted(Builder $query): Builder
    {
        return $query->where('is_deleted', false);
    }
}
