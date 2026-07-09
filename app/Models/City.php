<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class City extends Model
{
    use HasFactory;

    protected $fillable = [
        'governate_id',
        'type',
        'name',
        'short_code',
        'name_arabic',
        'latitude',
        'longitude',
    ];

    public function governate(): BelongsTo
    {
        return $this->belongsTo(Governate::class);
    }
}
