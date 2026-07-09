<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Parcel extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'name',
        'description',
        'length_cm',
        'width_cm',
        'height_cm',
        'min_weight_kg',
        'max_weight_kg',
        'status',
        'icon_path',
        'api_mapping_key',
    ];

    protected $casts = [
        'length_cm' => 'float',
        'width_cm' => 'float',
        'height_cm' => 'float',
        'min_weight_kg' => 'float',
        'max_weight_kg' => 'float',
    ];

    protected static function booted(): void
    {
        static::creating(function (Parcel $parcel): void {
            if (empty($parcel->status)) {
                $parcel->status = self::STATUS_ACTIVE;
            }
        });
    }
}
