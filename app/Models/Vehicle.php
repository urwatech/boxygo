<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vehicle extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PENDING_RENEWAL = 'pending_renewal';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'code',
        'user_id',
        'type',
        'model',
        'model_year',
        'color',
        'license_plate',
        'photo_path',
        'permit_expires_at',
        'insurance_expires_at',
        'status',
        'vehicle_registration_path',
        'car_insurance_path',
        'operating_permit_path',
        'additional_documents',
    ];

    protected $casts = [
        'permit_expires_at' => 'date',
        'insurance_expires_at' => 'date',
        'additional_documents' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (Vehicle $vehicle): void {
            if (empty($vehicle->code)) {
                $vehicle->code = static::generateCode();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public static function generateCode(): string
    {
        $maxSequence = (int) static::query()
            ->whereNotNull('code')
            ->selectRaw('MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)) as max_sequence')
            ->value('max_sequence');

        $nextSequence = $maxSequence + 1;

        return sprintf('VHC-%02d', $nextSequence);
    }
}
