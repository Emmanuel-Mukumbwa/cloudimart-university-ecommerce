<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
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
     * Resolves:
     * - absolute URLs (http/https or protocol-relative) => returned as-is
     * - stored public disk paths (e.g. "payments/abc.jpg") => Storage::disk('public')->url(...)
     * - fallback to asset('storage/...') if Storage disk url fails for any reason
     *
     * @return string|null
     */
    public function getProofUrlFullAttribute()
    {
        $raw = $this->proof_url;

        if (empty($raw)) {
            return null;
        }

        // If already absolute return as-is
        if (preg_match('#^https?://#i', $raw) || str_starts_with($raw, '//')) {
            return $raw;
        }

        // If it looks like a storage path (no scheme), attempt to resolve via public disk
        try {
            // If stored with store('payments', 'public'), this will produce a full URL.
            $url = Storage::disk('public')->url(ltrim($raw, '/'));
            if ($url) {
                return $url;
            }
        } catch (\Throwable $e) {
            // ignore and fallback below
        }

        // Fallback: asset('storage/...')
        return asset('storage/' . ltrim($raw, '/'));
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

    /**
     * Booted model events
     * - When a payment is deleted, attempt to remove the associated proof file from storage
     */
    protected static function booted()
    {
        static::deleting(function (Payment $payment) {
            try {
                $path = $payment->proof_url;
                if (!empty($path)) {
                    // only delete if it looks like a local storage path (not external URL)
                    if (!preg_match('#^https?://#i', $path) && !str_starts_with($path, '//')) {
                        Storage::disk('public')->delete(ltrim($path, '/'));
                    }
                }
            } catch (\Throwable $e) {
                // deliberately non-fatal: log if you want, but don't block deletion
                // Log::warning('Failed to delete payment proof: ' . $e->getMessage());
            }
        });
    }

    /**
     * Helper: returns normalized meta array (never null)
     *
     * @return array
     */
    public function getNormalizedMeta(): array
    {
        return is_array($this->meta) ? $this->meta : (json_decode($this->meta ?? '[]', true) ?: []);
    }

    /**
     * Short human readable summary (useful in logs/UI)
     *
     * @return string
     */
    public function summary(): string
    {
        $tx = $this->tx_ref ?? '—';
        $amt = number_format((float)$this->amount, 2);
        $st = $this->status ?? 'unknown';
        $u = $this->user ? ($this->user->name ?? "ID{$this->user->id}") : "UID:{$this->user_id}";
        return "{$tx} — MK {$amt} — {$st} — {$u}";
    }
}
