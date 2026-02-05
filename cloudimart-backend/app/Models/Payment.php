<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'tx_ref', 'provider_ref', 'mobile',
        'network', 'amount', 'currency', 'status', 'meta'
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function user() {
        return $this->belongsTo(User::class);
    }
}
