<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Custom Role model extending Spatie's Role.
 *
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property string|null $platform
 * @property string|null $country
 * @property string|null $sub_area
 * @property int|null $created_by
 * @property bool $is_protected
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Role extends SpatieRole
{
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'description',
        'platform',
        'country',
        'sub_area',
        'created_by',
        'is_protected',
        'guard_name',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_protected' => 'boolean',
    ];

    /**
     * Get the user who created this role.
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
