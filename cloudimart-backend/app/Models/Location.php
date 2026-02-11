<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Location extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'type',
        'latitude',
        'longitude',
        'radius_km',
        'description',
        'address',
        'is_active',
        'is_deliverable',
        'polygon_coordinates',
        'delivery_fee', // added
    ];

    // Casts
    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'radius_km' => 'float',
        'is_active' => 'boolean',
        'is_deliverable' => 'boolean',
        'polygon_coordinates' => 'array',
        'delivery_fee' => 'float', // added
    ];
}
