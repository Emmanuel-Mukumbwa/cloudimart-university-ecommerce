<?php

namespace App\Http\Controllers\Api;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Delivery;
use App\Models\Cart;
use App\Models\Notification;
use Illuminate\Support\Facades\DB; 
use Illuminate\Support\Str;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Payment;
use Exception;
use Illuminate\Support\Facades\Storage;

class PaymentController extends Controller
{
    /**
     * Helper: normalize payment model to array for API responses.
     * Adds proof_url_full and ensures meta is decoded as array.
     */
    protected function paymentToArray(Payment $p): array
    {
        // meta as array
        $meta = $p->meta;
        if (!is_array($meta)) {
            $meta = json_decode($p->meta ?? '[]', true) ?: [];
        }

        // compute proof_url_full
        $proofUrlFull = null;
        if (!empty($p->proof_url)) {
            $raw = $p->proof_url;
            // if absolute already use it
            if (preg_match('#^https?://#i', $raw) || str_starts_with($raw, '//')) {
                $proofUrlFull = $raw;
            } else {
                try {
                    // Use Storage public disk url (works when files stored with store(...,'public'))
                    $proofUrlFull = Storage::disk('public')->url(ltrim($raw, '/'));
                } catch (\Throwable $e) {
                    // Fallback to asset('storage/...')
                    $proofUrlFull = asset('storage/' . ltrim($raw, '/'));
                }
            }
        }

        // include basic user info if loaded or related
        $user = null;
        try {
            if ($p->relationLoaded('user') || $p->user) {
                $u = $p->user;
                if ($u) {
                    $user = [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email ?? null,
                    ];
                }
            }
        } catch (\Throwable $e) {
            $user = null;
        }

        return [
            'id' => $p->id,
            'tx_ref' => $p->tx_ref,
            'provider_ref' => $p->provider_ref ?? null,
            'user_id' => $p->user_id ?? null,
            'user' => $user,
            'mobile' => $p->mobile ?? null,
            'amount' => (float) $p->amount,
            'currency' => $p->currency ?? null,
            'status' => $p->status,
            'created_at' => $p->created_at ? $p->created_at->toDateTimeString() : null,
            'proof_url' => $p->proof_url ?? null,              // stored path or absolute if admin saved absolute
            'proof_url_full' => $proofUrlFull,                 // resolved absolute URL (or null)
            // Include new cart linkage fields
            'cart_id' => $p->cart_id ?? null,
            'cart_updated_at' => $p->cart_updated_at ? ($p->cart_updated_at instanceof \DateTime ? $p->cart_updated_at->format('Y-m-d H:i:s') : (string)$p->cart_updated_at) : null,
            'meta' => $meta,
        ];
    }

    /**
     * POST /api/payment/initiate
     * Expects: amount, mobile, network, delivery_lat, delivery_lng, delivery_address, cart_hash, cart_id (optional), location_id (optional)
     * Returns: { checkout_url, tx_ref, payment }
     */
    public function initiate(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
            'mobile' => 'required|string',
            'network' => 'required|string', // e.g. 'mpamba' or 'airtel'
            'delivery_lat' => 'nullable|numeric',
            'delivery_lng' => 'nullable|numeric',
            'delivery_address' => 'nullable|string',
            'cart_hash' => 'nullable|string',
            'cart_id' => 'nullable|integer|exists:carts,id',
            'location_id' => 'nullable|integer',
        ]);

        $userId = auth()->id();

        // build server-side snapshot of user's cart (authoritative)
        $cart = Cart::where('user_id', $userId)->with('items.product')->first();
        $cartSnapshot = [];
        $cartTotal = 0.0;
        if ($cart && $cart->items->isNotEmpty()) {
            foreach ($cart->items as $ci) {
                $prod = $ci->product;
                $price = $prod ? (float)$prod->price : (float)($ci->price ?? 0);
                $qty = (int)($ci->quantity ?? 0);
                $cartSnapshot[] = [
                    'product_id' => $ci->product_id,
                    'name' => $prod ? $prod->name : ($ci->name ?? null),
                    'price' => $price,
                    'quantity' => $qty,
                ];
                $cartTotal += $price * $qty;
            }
        }

        // determine authoritative delivery fee from provided location_id (if any)
        $locationId = $request->input('location_id') ?? null;
        $deliveryFee = 0.0;
        if ($locationId) {
            try {
                $locFee = DB::table('locations')->where('id', $locationId)->value('delivery_fee');
                if ($locFee !== null) {
                    $deliveryFee = floatval($locFee);
                }
            } catch (\Throwable $e) {
                Log::warning('Failed to fetch location delivery_fee: ' . $e->getMessage(), ['location_id' => $locationId]);
                $deliveryFee = 0.0;
            }
        } else {
            // optional: attempt to derive fee from cartHash or user's saved location in future
            $deliveryFee = 0.0;
        }

        // create unique merchant tx ref
        $txRef = uniqid('pay_');

        // Server-authoritative total: items + delivery fee
        $serverTotal = floatval($cartTotal) + floatval($deliveryFee);

        // If client amount differs, prefer server-computed total (authoritative)
        $requestedAmount = (float) $request->amount;
        if (abs($requestedAmount - $serverTotal) > 0.01) {
            Log::info("Payment initiate: client amount mismatch, using server cart total + delivery fee", [
                'user_id' => $userId,
                'requested' => $requestedAmount,
                'cart_total' => $cartTotal,
                'delivery_fee' => $deliveryFee,
                'server_total' => $serverTotal,
            ]);
            $amountToUse = $serverTotal > 0 ? $serverTotal : $requestedAmount;
        } else {
            $amountToUse = $requestedAmount;
        }

        // compute cart linkage fields (new) — prefer server cart if available
        $cartId = $cart ? $cart->id : ($request->input('cart_id') ? intval($request->input('cart_id')) : null);
        $cartUpdatedAt = $cart && $cart->updated_at ? $cart->updated_at->toDateTimeString() : null;

        // Create a local payment record (include snapshot & cart_total & delivery_fee in meta)
        $payment = Payment::create([
            'user_id' => $userId,
            'tx_ref' => $txRef,
            'amount' => $amountToUse,
            'currency' => 'MWK',
            'status' => 'pending',
            'mobile' => $request->mobile,
            'network' => $request->network,
            // new columns
            'cart_id' => $cartId,
            'cart_updated_at' => $cartUpdatedAt,
            'meta' => [
                'delivery_lat' => $request->delivery_lat,
                'delivery_lng' => $request->delivery_lng,
                'delivery_address' => $request->delivery_address,
                'location_id' => $locationId,
                'delivery_fee' => $deliveryFee,
                'cart_hash' => $request->cart_hash ?? null,
                'cart_total' => $cartTotal,
                'cart_snapshot' => $cartSnapshot,
            ],
        ]);

        try {
            $secretKey = config('services.paychangu.secret');

            $payload = [
                'amount' => $payment->amount,
                'currency' => 'MWK',
                'callback_url' => config('app.url') . '/api/payment/callback',
                'return_url' => config('app.url'),
                'tx_ref' => $txRef,
                'first_name' => auth()->user()->name ?? null,
                'last_name' => null,
                'email' => auth()->user()->email ?? null,
                'network' => $request->network,
                'phone_number' => preg_replace('/^0/', '265', $request->mobile),
                'customization' => [
                    'title' => 'Order Payment',
                    'description' => 'Payment for items - ' . $txRef,
                ],
                'meta' => [
                    'source' => 'LaravelApi',
                    'payment_id' => $payment->id,
                    // include delivery_fee & cart_hash to help reconciliation on provider side if needed
                    'delivery_fee' => $deliveryFee,
                    'cart_hash' => $request->cart_hash ?? null,
                    // optionally include cart_id for provider meta
                    'cart_id' => $cartId,
                ],
            ];

            $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $secretKey,
                    'Accept' => 'application/json',
                ])
                ->timeout(60)
                ->post('https://api.paychangu.com/payment', $payload);

            Log::info('PayChangu initiate response', ['response' => $response->json()]);

            if ($response->successful() && data_get($response->json(), 'status') === 'success') {
                // Return checkout_url and tx_ref to frontend
                return response()->json([
                    'checkout_url' => data_get($response->json(), 'data.checkout_url'),
                    'tx_ref' => $txRef,
                    'payment' => $this->paymentToArray($payment),
                ], 200);
            }

            $payment->update(['status' => 'failed']);
            return response()->json(['error' => $response->body()], 500);

        } catch (Exception $e) {
            Log::error('PayChangu initiate error', ['message' => $e->getMessage()]);
            $payment->update(['status' => 'failed']);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/payment/status?tx_ref=...
     */
    public function status(Request $request)
    {
        $txRef = $request->query('tx_ref') ?? $request->input('tx_ref');
        if (empty($txRef)) {
            return response()->json(['message' => 'tx_ref required'], 400);
        }

        $payment = Payment::where('tx_ref', $txRef)->first();
        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if (in_array($payment->status, ['success', 'failed'])) {
            return response()->json(['status' => $payment->status, 'payment' => $this->paymentToArray($payment)], 200);
        }

        try {
            $secretKey = config('services.paychangu.secret');

            $res = Http::withHeaders([
                'Authorization' => 'Bearer ' . $secretKey,
                'Accept' => 'application/json',
            ])->get("https://api.paychangu.com/verify-payment/{$txRef}");

            Log::info('PayChangu verify response', ['tx_ref' => $txRef, 'response' => $res->json()]);

            if ($res->successful() && data_get($res->json(), 'status') === 'success') {
                $remoteStatus = data_get($res->json(), 'data.status');
                $providerRef = data_get($res->json(), 'data.transaction_id') ?? data_get($res->json(), 'data.transactionId');

                if ($remoteStatus === 'success') {
                    $payment->update([
                        'status' => 'success',
                        'provider_ref' => $providerRef,
                    ]);
                } elseif ($remoteStatus === 'failed') {
                    $payment->update(['status' => 'failed']);
                }
            } else {
                return response()->json(['status' => $payment->status, 'remote' => $res->json()], 200);
            }
        } catch (Exception $e) {
            Log::error('PayChangu verify error', ['message' => $e->getMessage(), 'tx_ref' => $txRef]);
            return response()->json(['status' => $payment->status, 'error' => $e->getMessage()], 200);
        }

        $payment->refresh();
        return response()->json(['status' => $payment->status, 'payment' => $this->paymentToArray($payment)], 200);
    }

    /**
     * POST /api/payment/callback
     */
    public function handleCallback(Request $request)
    {
        Log::info('PayChangu callback payload', ['payload' => $request->all()]);

        $txRef = $request->input('tx_ref') ?? $request->input('transaction_reference') ?? null;
        $status = $request->input('status') ?? null;
        $providerRef = $request->input('transaction_id') ?? $request->input('transactionId') ?? null;

        if (!$txRef) {
            return response()->json(['message' => 'tx_ref missing'], 400);
        }

        $payment = Payment::where('tx_ref', $txRef)->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($status === 'success') {
            $payment->update([
                'status' => 'success',
                'provider_ref' => $providerRef,
            ]);
        } elseif ($status === 'failed') {
            $payment->update(['status' => 'failed']);
        } else {
            $meta = $payment->meta ?? [];
            $meta = array_merge(is_array($meta) ? $meta : (json_decode($meta, true) ?: []), ['last_callback' => $request->all()]);
            $payment->update(['meta' => $meta]);
        }

        return response()->json(['message' => 'Payment updated', 'payment' => $this->paymentToArray($payment)], 200);
    }

    /**
     * GET /api/payments
     * Supports ?cart_hash=... or ?cart_id=... or ?tx_ref=... and ?exclude_ordered=1 and ?only_pending=1
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        $paymentsQuery = Payment::where('user_id', $user->id)->orderBy('created_at', 'desc');

        $cartId = $request->query('cart_id'); // prefer cart_id if supplied
        $cartHash = $request->query('cart_hash');
        $txRef = $request->query('tx_ref');
        $excludeOrdered = $request->query('exclude_ordered'); // e.g. 1
        $onlyPending = $request->query('only_pending'); // e.g. 1

        if ($txRef) {
            $paymentsQuery->where('tx_ref', $txRef);
        } elseif ($cartId) {
            // filter by cart_id column (preferred)
            $paymentsQuery->where('cart_id', $cartId);
        } elseif ($cartHash) {
            // fallback: filter by cart_hash in meta (assumes meta is JSON)
            // JSON_EXTRACT returns null when key missing; equality will match exact string
            $paymentsQuery->whereRaw("JSON_EXTRACT(meta, '$.cart_hash') = ?", [$cartHash]);
        }

        if ($excludeOrdered) {
            // exclude payments that already have an order_id in meta
            $paymentsQuery->whereRaw("JSON_EXTRACT(meta, '$.order_id') IS NULL");
        }

        if ($onlyPending) {
            $paymentsQuery->where('status', 'pending');
        }

        $payments = $paymentsQuery->get();

        // Map to arrays and include proof_url_full
        $payload = $payments->map(function ($p) {
            return $this->paymentToArray($p);
        })->all();

        return response()->json(['data' => $payload], 200);
    }

    /**
     * POST /api/payment/upload-proof
     * Fields: file, amount, mobile, network, delivery_lat, delivery_lng, delivery_address, note, cart_hash, cart_id, location_id (optional)
     */
    public function uploadProof(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        $validated = $request->validate([
            'file' => 'required|image|max:5120',
            'amount' => 'required|numeric|min:0.01',
            'mobile' => 'required|string',
            'network' => 'required|string',
            'delivery_lat' => 'nullable|numeric',
            'delivery_lng' => 'nullable|numeric',
            'delivery_address' => 'nullable|string',
            'note' => 'nullable|string',
            'cart_hash' => 'nullable|string',
            'cart_id' => 'nullable|integer|exists:carts,id',
            'location_id' => 'nullable|integer',
        ]);

        DB::beginTransaction();
        try {
            $file = $request->file('file');
            $path = $file->store('payments', 'public');

            // build server-side snapshot of user's cart (authoritative)
            $cart = Cart::where('user_id', $user->id)->with('items.product')->first();
            $cartSnapshot = [];
            $cartTotal = 0.0;
            if ($cart && $cart->items->isNotEmpty()) {
                foreach ($cart->items as $ci) {
                    $prod = $ci->product;
                    $price = $prod ? (float)$prod->price : (float)($ci->price ?? 0);
                    $qty = (int)($ci->quantity ?? 0);
                    $cartSnapshot[] = [
                        'product_id' => $ci->product_id,
                        'name' => $prod ? $prod->name : ($ci->name ?? null),
                        'price' => $price,
                        'quantity' => $qty,
                    ];
                    $cartTotal += $price * $qty;
                }
            }

            // determine delivery fee if location_id present
            $locationId = $validated['location_id'] ?? null;
            $deliveryFee = 0.0;
            if ($locationId) {
                try {
                    $locFee = DB::table('locations')->where('id', $locationId)->value('delivery_fee');
                    if ($locFee !== null) $deliveryFee = floatval($locFee);
                } catch (\Throwable $e) {
                    Log::warning('Failed to fetch location delivery_fee for uploadProof: ' . $e->getMessage(), ['location_id' => $locationId]);
                    $deliveryFee = 0.0;
                }
            }

            $txRef = 'proof_' . uniqid();

            // compute cart linkage fields (new) — prefer actual server cart id if present, otherwise accept provided cart_id
            $cartId = $cart ? $cart->id : (isset($validated['cart_id']) ? intval($validated['cart_id']) : null);
            $cartUpdatedAt = $cart && $cart->updated_at ? $cart->updated_at->toDateTimeString() : null;

            $payment = Payment::create([
                'user_id' => $user->id,
                'tx_ref' => $txRef,
                'amount' => $validated['amount'], // store what user claims to have paid
                'currency' => 'MWK',
                'status' => 'pending',
                'mobile' => $validated['mobile'],
                'network' => $validated['network'],
                // new columns
                'cart_id' => $cartId,
                'cart_updated_at' => $cartUpdatedAt,
                'meta' => [
                    'note' => $validated['note'] ?? null,
                    'delivery_lat' => $validated['delivery_lat'] ?? null,
                    'delivery_lng' => $validated['delivery_lng'] ?? null,
                    'delivery_address' => $validated['delivery_address'] ?? null,
                    'location_id' => $locationId,
                    'delivery_fee' => $deliveryFee,
                    'cart_hash' => $validated['cart_hash'] ?? null,
                    'cart_total' => $cartTotal,
                    'cart_snapshot' => $cartSnapshot,
                ],
                'proof_url' => $path,
            ]);

            DB::commit();

            return response()->json(['tx_ref' => $txRef, 'payment' => $this->paymentToArray($payment)], 201);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Upload proof error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to upload proof', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Admin approval (prefers cart_snapshot when present)
     */
    public function adminApprove(Request $request, $id)
    {
        $payment = Payment::find($id);
        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($payment->status === 'success') {
            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            return response()->json(['message' => 'Already approved', 'payment' => $this->paymentToArray($payment), 'meta' => $meta], 200);
        }

        DB::beginTransaction();
        try {
            // mark success early (keeps parity with previous flow); if later steps fail we roll back
            $payment->status = 'success';
            $payment->save();

            $user = $payment->user;
            if (!$user) {
                DB::rollBack();
                return response()->json(['message' => 'Payment has no associated user'], 400);
            }

            $existing = Order::where('payment_ref', $payment->tx_ref)->first();
            if ($existing) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                if (empty($meta['order_id'])) {
                    $meta['order_id'] = $existing->order_id;
                    $payment->meta = $meta;
                    $payment->save();
                }
                DB::commit();
                return response()->json(['message' => 'Payment approved; existing order found', 'order' => $existing], 200);
            }

            // decode meta safely
            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            $cartSnapshot = $meta['cart_snapshot'] ?? null;
            $cartTotalFromMeta = isset($meta['cart_total']) ? floatval($meta['cart_total']) : null;
            $deliveryFeeFromMeta = isset($meta['delivery_fee']) ? floatval($meta['delivery_fee']) : 0.0;

            if ($cartSnapshot && is_array($cartSnapshot) && count($cartSnapshot) > 0) {
                // Use snapshot to check stock and compute total
                $total = 0;
                $insufficient = [];

                foreach ($cartSnapshot as $ci) {
                    $productRow = DB::table('products')->where('id', $ci['product_id'])->lockForUpdate()->first();
                    if (!$productRow) {
                        DB::rollBack();
                        return response()->json(['success' => false, 'message' => "Product (ID {$ci['product_id']}) not found"], 400);
                    }
                    $currentStock = intval($productRow->stock ?? 0);
                    if ($currentStock < intval($ci['quantity'])) {
                        $insufficient[] = [
                            'product_id' => $ci['product_id'],
                            'available' => $currentStock,
                            'requested' => intval($ci['quantity']),
                        ];
                    }
                    $total += floatval($ci['price']) * intval($ci['quantity']);
                }

                if (!empty($insufficient)) {
                    $meta['approval_issue'] = ['type' => 'stock', 'items' => $insufficient];
                    $payment->meta = $meta;
                    $payment->save();
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => 'Some items are out of stock', 'items' => $insufficient], 409);
                }

                // verify the payment amount matches snapshot total + delivery_fee (if any)
                $expectedTotal = floatval($total) + floatval($deliveryFeeFromMeta);
                if (round(floatval($payment->amount), 2) != round(floatval($expectedTotal), 2)) {
                    $meta['amount_mismatch'] = [
                        'payment' => $payment->amount,
                        'snapshot_total' => $total,
                        'delivery_fee' => $deliveryFeeFromMeta,
                        'expected_total' => $expectedTotal
                    ];
                    $payment->meta = $meta;
                    $payment->save();
                    DB::rollBack();
                    return response()->json(['message' => 'Amount mismatch', 'meta' => $meta], 422);
                }

                // create order from snapshot (include delivery_fee)
                $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));
                $orderData = [
                    'order_id' => $orderId,
                    'user_id' => $user->id,
                    'total' => $expectedTotal,
                    'delivery_address' => data_get($payment->meta, 'delivery_address') ?? null,
                    'status' => 'pending_delivery',
                    'payment_ref' => $payment->tx_ref,
                ];
                // if orders table has delivery_fee column, include it
                $orderData['delivery_fee'] = $deliveryFeeFromMeta;

                $order = Order::create($orderData);

                foreach ($cartSnapshot as $ci) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $ci['product_id'],
                        'quantity' => $ci['quantity'],
                        'price' => $ci['price'],
                    ]);

                    DB::table('products')->where('id', $ci['product_id'])->decrement('stock', $ci['quantity']);
                }

                // If the user's current cart exactly matches the snapshot, clear it. Otherwise preserve it.
                $cart = Cart::where('user_id', $user->id)->with('items')->first();
                $shouldClearCart = false;
                if ($cart && $cart->items->isNotEmpty()) {
                    $currentMap = [];
                    foreach ($cart->items as $ci) {
                        $currentMap[intval($ci->product_id)] = intval($ci->quantity);
                    }
                    // build snapshot map
                    $snapMap = [];
                    foreach ($cartSnapshot as $s) {
                        $snapMap[intval($s['product_id'])] = intval($s['quantity']);
                    }
                    // both must have same keys and same quantities
                    if (count($currentMap) === count($snapMap)) {
                        $allEqual = true;
                        foreach ($snapMap as $pid => $qty) {
                            if (!isset($currentMap[$pid]) || $currentMap[$pid] !== $qty) {
                                $allEqual = false;
                                break;
                            }
                        }
                        if ($allEqual) {
                            $shouldClearCart = true;
                        }
                    }
                }
                if ($shouldClearCart && $cart) {
                    $cart->items()->delete();
                }

                // create delivery record
                $verificationCode = strtoupper(Str::random(6));
                Delivery::create([
                    'order_id' => $order->id,
                    'delivery_person' => null,
                    'status' => 'pending',
                    'verification_code' => $verificationCode
                ]);

                Notification::create([
                    'user_id' => $user->id,
                    'title' => 'Order Placed',
                    'message' => "Your order #{$order->order_id} has been placed (admin-approved payment)."
                ]);

                $meta['order_id'] = $order->order_id;
                $payment->meta = $meta;
                $payment->save();

                DB::commit();

                return response()->json(['message' => 'Payment approved and order created', 'order' => $order, 'payment' => $this->paymentToArray($payment)], 200);
            }

            //
            // Fallback: no snapshot — use user's current cart (legacy behavior)
            //
            $cart = Cart::where('user_id', $user->id)->with('items.product')->first();
            if (!$cart || $cart->items->isEmpty()) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['note'] = ($meta['note'] ?? '') . ' | No cart found to auto-place order';
                $payment->meta = $meta;
                $payment->save();
                DB::commit();
                return response()->json(['message' => 'Payment marked success but user cart empty.'], 200);
            }

            $total = 0;
            foreach ($cart->items as $ci) {
                $total += ($ci->product->price * $ci->quantity);
            }

            $deliveryFeeFromMeta = isset($payment->meta['delivery_fee']) ? floatval($payment->meta['delivery_fee']) : 0.0;
            $expectedTotal = floatval($total) + floatval($deliveryFeeFromMeta);

            if (round(floatval($payment->amount), 2) != round(floatval($expectedTotal), 2)) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['amount_mismatch'] = ['payment' => $payment->amount, 'cart_total' => $total, 'delivery_fee' => $deliveryFeeFromMeta, 'expected_total' => $expectedTotal];
                $payment->meta = $meta;
                $payment->save();

                DB::rollBack();
                return response()->json(['message' => 'Amount mismatch', 'meta' => $meta], 422);
            }

            foreach ($cart->items as $ci) {
                $productRow = DB::table('products')->where('id', $ci->product_id)->lockForUpdate()->first();
                if (!$productRow) {
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => "Product (ID {$ci->product_id}) not found"], 400);
                }

                $currentStock = intval($productRow->stock ?? 0);
                if ($currentStock < intval($ci->quantity)) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Some items are out of stock'
                    ], 409);
                }
            }

            $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));

            $orderData = [
                'order_id' => $orderId,
                'user_id' => $user->id,
                'total' => $expectedTotal,
                'delivery_address' => data_get($payment->meta, 'delivery_address') ?? null,
                'status' => 'pending_delivery',
                'payment_ref' => $payment->tx_ref,
            ];
            $orderData['delivery_fee'] = $deliveryFeeFromMeta;

            $order = Order::create($orderData);

            foreach ($cart->items as $ci) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $ci->product_id,
                    'quantity' => $ci->quantity,
                    'price' => $ci->product->price,
                ]);

                DB::table('products')->where('id', $ci->product_id)->decrement('stock', $ci->quantity);
            }

            $verificationCode = strtoupper(Str::random(6));
            Delivery::create([
                'order_id' => $order->id,
                'delivery_person' => null,
                'status' => 'pending',
                'verification_code' => $verificationCode
            ]);

            $cart->items()->delete();

            Notification::create([
                'user_id' => $user->id,
                'title' => 'Order Placed',
                'message' => "Your order #{$order->order_id} has been placed (admin-approved payment)."
            ]);

            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            $meta['order_id'] = $order->order_id;
            $payment->meta = $meta;
            $payment->save();

            DB::commit();

            return response()->json(['message' => 'Payment approved and order created', 'order' => $order, 'payment' => $this->paymentToArray($payment)], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('adminApprove error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to approve payment', 'error' => $e->getMessage()], 500);
        }
    }
}
