<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Delivery;

class Order extends Model
{
    use HasFactory; 

    protected $fillable = [
        'order_id',
        'user_id',
        'total',  
        'delivery_address',
        'delivery_lat', 
        'delivery_lng',
        'status',
        'delivery_fee', // NEW
    ];

    protected $casts = [
        'delivery_lat' => 'float',
        'delivery_lng' => 'float',
        'delivery_fee' => 'float', // NEW
    ];

    /** Each order belongs to a user */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Each order has many items */
    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    /** Each order may have one delivery record */
    public function delivery()
    {
        return $this->hasOne(Delivery::class);
    }

    /** Each order can have many transactions */
    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
  