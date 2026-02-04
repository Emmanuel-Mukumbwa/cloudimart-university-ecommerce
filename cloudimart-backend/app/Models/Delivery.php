<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Delivery extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'delivery_person',
        'status', // pending, completed, failed
        'verification_code',
    ];

    /** Each delivery belongs to an order */
    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
