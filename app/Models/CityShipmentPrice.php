<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CityShipmentPrice extends Model
{
    use HasFactory;

    protected $fillable = [
        'ext_id',
        'name',
        'sender_sub_district_id',
        'sender_sub_district_name',
        'receiver_sub_district_id',
        'receiver_sub_district_name',
        'price',
        'direct_price',
        'price1',
        'price2',
        'price3',
        'price4',
        'price5',
        'price6',
    ];

    protected $casts = [
        'price' => 'float',
        'direct_price' => 'float',
        'price1' => 'float',
        'price2' => 'float',
        'price3' => 'float',
        'price4' => 'float',
        'price5' => 'float',
        'price6' => 'float',
    ];
}
