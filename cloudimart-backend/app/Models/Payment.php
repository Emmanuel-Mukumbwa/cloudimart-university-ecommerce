<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    /**
     * Table name
     *
     * @var string
     */
    protected $table = 'payments';

    /**
     * Mass assignable attributes
     *
     * @var array
     */
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
        'proof_url',
    ];

    /**
     * Casts
     *
     * @var array
     */
    protected $casts = [
        'meta' => 'array',
        'amount' => 'decimal:2',
    ];

    /**
     * Append derived attributes to JSON
     *
     * @var array
     */
    protected $appends = [
        'proof_url_full',
    ];

    /**
     * Accessor: absolute URL for proof image (or null)
     *
     * Uses asset('storage/...') which relies on APP_URL in your backend .env.
     *
     * @return string|null
     */
    public function getProofUrlFullAttribute()
    {
        if (empty($this->proof_url)) {
            return null;
        }

        return asset('storage/' . ltrim($this->proof_url, '/'));
    }

    /**
     * Payment belongs to a user.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
