<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cart extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
    ];

    /** Each cart belongs to a user */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** A cart has many cart items */
    public function items()
    {
        return $this->hasMany(CartItem::class);
    }

    /** Optional helper: get total cost */
    public function getTotalAttribute()
    {
        return $this->items->sum(fn($i) => $i->quantity * $i->product->price);
    }
}
