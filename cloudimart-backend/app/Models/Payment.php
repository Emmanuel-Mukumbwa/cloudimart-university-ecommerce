<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\Cart;
use Illuminate\Support\Facades\Log;

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
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Booted model events
     */
    protected static function booted()
    {
        // preserve your existing deleting behavior
        static::deleting(function (Payment $payment) {
            try {
                $path = $payment->proof_url;
                if (!empty($path)) {
                    if (!preg_match('#^https?://#i', $path) && !str_starts_with($path, '//')) {
                        Storage::disk('public')->delete(ltrim($path, '/'));
                    }
                }
            } catch (\Throwable $e) {
                // non-fatal
            }
        });

        /**
         * Ensure every Payment has meta.cart_hash and meta.cart_snapshot.
         * We only add them if missing — so we won't overwrite anything your controllers/gateway already set.
         */
        static::creating(function (Payment $payment) {
            try {
                // Normalize existing meta (never null)
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $hasCartHash = isset($meta['cart_hash']) && $meta['cart_hash'] !== null && $meta['cart_hash'] !== '';
                $hasSnapshot = isset($meta['cart_snapshot']) && is_array($meta['cart_snapshot']) && count($meta['cart_snapshot']) > 0;

                // If both present, nothing to do
                if ($hasCartHash && $hasSnapshot) {
                    $payment->meta = $meta;
                    return;
                }

                // Attempt to build server-side snapshot from user's cart (if user_id present)
                $snapshot = [];
                if (!empty($payment->user_id)) {
                    try {
                        $cart = Cart::where('user_id', $payment->user_id)->with('items.product')->first();
                        if ($cart && $cart->items) {
                            foreach ($cart->items as $ci) {
                                $snapshot[] = [
                                    'product_id' => (int)($ci->product_id ?? 0),
                                    'name' => $ci->product->name ?? null,
                                    'price' => (float)($ci->product->price ?? 0),
                                    'quantity' => (int)($ci->quantity ?? 0),
                                ];
                            }
                        }
                    } catch (\Throwable $e) {
                        Log::warning('Failed to build cart snapshot for payment creating: ' . $e->getMessage());
                    }
                }

                // If we still have no snapshot (e.g. no user/cart), ensure snapshot is an array (possibly empty)
                $metaSnapshot = is_array($meta['cart_snapshot'] ?? null) ? $meta['cart_snapshot'] : $snapshot;

                // If there's still no snapshot, use empty array (so hash will still be deterministic)
                if (!is_array($metaSnapshot)) {
                    $metaSnapshot = [];
                }

                // Compute cart hash if missing — use same lightweight algorithm as the frontend (djb2-like)
                if (empty($meta['cart_hash'])) {
                    $meta['cart_hash'] = self::computeCartHash($metaSnapshot);
                }

                // Ensure cart_snapshot is present
                if (!isset($meta['cart_snapshot']) || !is_array($meta['cart_snapshot']) || count($meta['cart_snapshot']) === 0) {
                    $meta['cart_snapshot'] = $metaSnapshot;
                }

                // Also optionally preserve delivery_address/location_id if present in model fields (some controllers may set them separately)
                if (empty($meta['delivery_address']) && !empty($payment->meta['delivery_address'])) {
                    $meta['delivery_address'] = $payment->meta['delivery_address'];
                }

                $payment->meta = $meta;
            } catch (\Throwable $e) {
                // If anything goes wrong, do not block payment creation — just log
                Log::warning('Payment model creating hook failed: ' . $e->getMessage());
                // Ensure meta is at least an array
                $payment->meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            }
        });
    }

    /**
     * Helper: returns normalized meta array (never null)
     */
    public function getNormalizedMeta(): array
    {
        return is_array($this->meta) ? $this->meta : (json_decode($this->meta ?? '[]', true) ?: []);
    }

    /**
     * Short human readable summary (useful in logs/UI)
     */
    public function summary(): string
    {
        $tx = $this->tx_ref ?? '—';
        $amt = number_format((float)$this->amount, 2);
        $st = $this->status ?? 'unknown';
        $u = $this->user ? ($this->user->name ?? "ID{$this->user->id}") : "UID:{$this->user_id}";
        return "{$tx} — MK {$amt} — {$st} — {$u}";
    }

    /**
     * Compute the lightweight cart hash (djb2-like then >>>0 then base36) to match the client.
     * Accepts an array of snapshot items (each item includes product_id, quantity, price).
     */
    protected static function computeCartHash(array $items): string
    {
        try {
            // Build the normalized array like client: [{id, q, p}, ...]
            $arr = [];
            foreach ($items as $it) {
                $arr[] = [
                    'id' => (int)($it['product_id'] ?? $it['id'] ?? 0),
                    'q' => (int)($it['quantity'] ?? $it['qty'] ?? 0),
                    'p' => (float)($it['price'] ?? 0),
                ];
            }
            $s = json_encode($arr, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            // djb2-like
            $h = 5381;
            $len = strlen($s);
            for ($i = 0; $i < $len; $i++) {
                $h = ($h * 33) ^ ord($s[$i]);
                // keep $h within PHP int range (but we'll mask later)
            }

            // emulate JS >>> 0 by masking to unsigned 32-bit
            $unsigned = $h & 0xFFFFFFFF;
            if ($unsigned < 0) {
                // ensure positive
                $unsigned = $unsigned + 0x100000000;
            }

            return 'ch_' . base_convert((string)$unsigned, 10, 36);
        } catch (\Throwable $e) {
            Log::warning('computeCartHash failed: ' . $e->getMessage());
            return 'ch_0';
        }
    }
}
