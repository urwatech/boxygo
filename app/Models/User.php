<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use App\Models\UserOtp;
use App\Models\DropPoint;
use App\Models\Vehicle;
use App\Models\Warehouse;
use App\Models\Zone;
use App\Models\Shipment;
use Illuminate\Database\Eloquent\Relations\HasOne;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'business_type',
        'email',
        'language',
        'password',
        'phone_number',
        'emergency_phone_number',
        'blood_type',
        'status',
        'employee_id',
        'shipment_type',
        'delivery_speed_mode',
        'employment_type',
        'zone_id',
        'zone_ids',
        'warehouse_id',
        'drop_point_id',
        'platform',
        'id_card_front',
        'id_card_back',
        'driving_license',
        'passport',
        'idp',
        'avatar_path',
        'governorate',
        'dob',
        'gender',
        'license_expiry',
        'completed_jobs',
        'cancel_rate',
        'avg_eta_minutes',
        'cod_collection_limit',
        'working_hours',
        'member_since',
        'email_notifications',
        'push_notifications',
        'fcm_token',
        'is_deleted',
        'device_type',
        'availability',
        'country',
        'city',
        'address',
        'latitude',
        'longitude',
        'trade_license_number',
        'license_copy',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'phone_verified_at' => 'datetime',
            'license_expiry' => 'date',
            'dob' => 'date',
            'completed_jobs' => 'integer',
            'cancel_rate' => 'decimal:2',
            'avg_eta_minutes' => 'integer',
            'cod_collection_limit' => 'decimal:2',
            'working_hours' => 'array',
            'member_since' => 'datetime',
            'email_notifications' => 'boolean',
            'push_notifications' => 'boolean',
            'is_deleted' => 'boolean',
            'zone_ids' => 'array',
        ];
    }

    /**
     * One-time passwords issued to the user.
     */
    public function otps(): HasMany
    {
        return $this->hasMany(UserOtp::class);
    }

    /**
     * Vehicles registered by the user.
     */
    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    /**
     * Wallets registered by the user.
     */
    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    /**
     * Shipments created by the customer.
     */
    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    /**
     * Zone assigned to the employee.
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    /**
     * Warehouse assigned to the employee (for warehouse keepers).
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * Drop point assigned to the employee (for drop point keepers).
     */
    public function dropPoint(): BelongsTo
    {
        return $this->belongsTo(DropPoint::class);
    }

    /**
     * Get all assigned zone IDs (primary + additional).
     *
     * @return list<int>
     */
    public function getAssignedZoneIds(): array
    {
        $ids = [];

        if ($this->zone_id) {
            $ids[] = (int) $this->zone_id;
        }

        if (is_array($this->zone_ids)) {
            foreach ($this->zone_ids as $zoneId) {
                if ($zoneId === null || $zoneId === '') {
                    continue;
                }
                $ids[] = (int) $zoneId;
            }
        }

        $ids = array_values(array_unique($ids));
        sort($ids);

        return $ids;
    }

    /**
     * Check if the user is assigned to a zone.
     */
    public function hasZone(int $zoneId): bool
    {
        return in_array((int) $zoneId, $this->getAssignedZoneIds(), true);
    }

    /**
     * Mileage logs for this rider/driver.
     */
    public function mileageLogs(): HasMany
    {
        return $this->hasMany(RiderMileageLog::class);
    }

    /**
     * Get total mileage for this rider in kilometers.
     */
    public function getTotalMileageKm(?string $startDate = null, ?string $endDate = null): float
    {
        $query = $this->mileageLogs();

        if ($startDate) {
            $query->where('started_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('ended_at', '<=', $endDate);
        }

        return (float) $query->sum('distance_km');
    }

    /**
     * Get total mileage for this rider in miles.
     */
    public function getTotalMileageMiles(?string $startDate = null, ?string $endDate = null): float
    {
        $query = $this->mileageLogs();

        if ($startDate) {
            $query->where('started_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('ended_at', '<=', $endDate);
        }

        return (float) $query->sum('distance_miles');
    }

    /**
     * Get mileage statistics for different time periods.
     */
    public function getMileageStats(): array
    {
        $now = now();

        return [
            'total_km' => $this->getTotalMileageKm(),
            'total_miles' => $this->getTotalMileageMiles(),
            'today_km' => $this->getTotalMileageKm($now->copy()->startOfDay(), $now->copy()->endOfDay()),
            'today_miles' => $this->getTotalMileageMiles($now->copy()->startOfDay(), $now->copy()->endOfDay()),
            'this_week_km' => $this->getTotalMileageKm($now->copy()->startOfWeek(), $now->copy()->endOfWeek()),
            'this_week_miles' => $this->getTotalMileageMiles($now->copy()->startOfWeek(), $now->copy()->endOfWeek()),
            'this_month_km' => $this->getTotalMileageKm($now->copy()->startOfMonth(), $now->copy()->endOfMonth()),
            'this_month_miles' => $this->getTotalMileageMiles($now->copy()->startOfMonth(), $now->copy()->endOfMonth()),
        ];
    }
}
