<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShipmentStatusDirect extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'current_index',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }
}
