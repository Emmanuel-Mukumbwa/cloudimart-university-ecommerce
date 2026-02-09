<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Delivery extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * delivery_person_id -> users.id (role = 'delivery')
     */
    protected $fillable = [
        'order_id',
        'delivery_person',     // legacy / optional name field
        'delivery_person_id',  // FK to users table
        'status',              // pending, assigned, completed, failed
        'verification_code',
    ];

    /**
     * Cast attributes.
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Each delivery belongs to an order.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Assigned delivery person (nullable).
     */
    public function deliveryPerson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delivery_person_id');
    }
}
