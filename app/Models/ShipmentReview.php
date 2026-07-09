<?php

namespace App\Models;

use App\Enums\Role;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class ShipmentReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'user_id',
        'employee_id',
        'user_type',
        'drop_point_id',
        'rating',
        'rider_behavior',
        'on_time_delivery',
        'affordability',
        'comment',
    ];

    protected $with = ['employee'];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function drop_point()
    {
        return $this->belongsTo(DropPoint::class, 'drop_point_id');
    }

    /**
     * Backward compatibility or specific alias for rider actor
     */
    public function rider()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the rateable type based on rider's role
     */
    public function getRateableTypeAttribute(): ?string
    {
        if (!$this->employee) {
            return null;
        }

        if ($this->employee->hasRole(Role::RIDER->value)) {
            return 'rider';
        }

        if ($this->employee->hasRole(Role::CAR_DRIVER->value)) {
            return 'car_driver';
        }

        if ($this->employee->hasRole(Role::DROP_POINT_KEEPER->value)) {
            return 'drop_point';
        }

        return null;
    }

    /**
     * Scope to filter by rateable type (role)
     */
    public function scopeByRateableType(Builder $query, string $type): Builder
    {
        $roleValue = match ($type) {
            'rider' => Role::RIDER->value,
            'car_driver' => Role::CAR_DRIVER->value,
            'drop_point' => Role::DROP_POINT_KEEPER->value,
            default => null,
        };

        if (!$roleValue) {
            return $query;
        }

        return $query->whereHas('employee', function ($q) use ($roleValue) {
            $q->whereHas('roles', function ($rq) use ($roleValue) {
                $rq->where('name', $roleValue);
            });
        });
    }

    /**
     * Scope to filter by star rating
     */
    public function scopeByStarRating(Builder $query, int $stars): Builder
    {
        return $query->where('rating', $stars);
    }

    /**
     * Scope to order by newest first
     */
    public function scopeNewest(Builder $query): Builder
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Scope to order by oldest first
     */
    public function scopeOldest(Builder $query): Builder
    {
        return $query->orderBy('created_at', 'asc');
    }
}
