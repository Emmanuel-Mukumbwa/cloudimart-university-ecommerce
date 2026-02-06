<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $table = 'payments';

    protected $fillable = [
        'user_id',
        'tx_ref',
        'provider_ref',
        'mobile',
        'network',
        'amount',
        'currency',
        'status',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'amount' => 'decimal:2',
    ];
}
