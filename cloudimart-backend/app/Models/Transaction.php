<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'type',
        'amount',
        'currency',
        'status',
        'meta',
    ];

    protected $casts = [
        'amount' => 'float',
        'meta' => 'array',
    ];

    /** Each transaction belongs to an order */
    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
