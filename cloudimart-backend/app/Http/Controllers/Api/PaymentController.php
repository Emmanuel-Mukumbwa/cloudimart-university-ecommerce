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
     * POST /api/payment/initiate
     * Expects: amount, mobile, network, delivery_lat, delivery_lng, delivery_address, cart_hash
     * Returns: { checkout_url, tx_ref }
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
        ]);

        // create unique merchant tx ref
        $txRef = uniqid('pay_');

        // Create a local payment record
        $payment = Payment::create([
            'user_id' => auth()->id(),
            'tx_ref' => $txRef,
            'amount' => $request->amount,
            'currency' => 'MWK',
            'status' => 'pending',
            'mobile' => $request->mobile,
            'network' => $request->network,
            'meta' => [
                'delivery_lat' => $request->delivery_lat,
                'delivery_lng' => $request->delivery_lng,
                'delivery_address' => $request->delivery_address,
                'cart_hash' => $request->cart_hash ?? null,
            ],
        ]);

        try {
            $secretKey = config('services.paychangu.secret');

            $payload = [
                'amount' => $request->amount,
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
                return response()->json([
                    'checkout_url' => data_get($response->json(), 'data.checkout_url'),
                    'tx_ref' => $txRef,
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
            return response()->json(['status' => $payment->status, 'payment' => $payment], 200);
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
        return response()->json(['status' => $payment->status, 'payment' => $payment], 200);
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
            $meta = array_merge(is_array($meta) ? $meta : json_decode($meta, true) ?? [], ['last_callback' => $request->all()]);
            $payment->update(['meta' => $meta]);
        }

        return response()->json(['message' => 'Payment updated'], 200);
    }

    /**
     * GET /api/payments
     * Supports ?cart_hash=... or ?tx_ref=... and ?exclude_ordered=1 and ?only_pending=1
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        $paymentsQuery = Payment::where('user_id', $user->id)->orderBy('created_at', 'desc');

        $cartHash = $request->query('cart_hash');
        $txRef = $request->query('tx_ref');
        $excludeOrdered = $request->query('exclude_ordered'); // e.g. 1
        $onlyPending = $request->query('only_pending'); // e.g. 1

        if ($txRef) {
            $paymentsQuery->where('tx_ref', $txRef);
        } elseif ($cartHash) {
            // filter by cart_hash in meta (assumes meta is JSON)
            // JSON_EXTRACT returns null when key missing; equality will match exact string
            $paymentsQuery->whereRaw("JSON_EXTRACT(meta, '$.cart_hash') = ?", [$cartHash]);
        }

        if ($excludeOrdered) {
            // exclude payments that already have an order_id in meta
            // JSON_EXTRACT(meta, '$.order_id') IS NULL ensures only unassociated payments
            $paymentsQuery->whereRaw("JSON_EXTRACT(meta, '$.order_id') IS NULL");
        }

        if ($onlyPending) {
            // only include payments still pending (adjust array if you want pending+failed etc)
            $paymentsQuery->where('status', 'pending');
        }

        $payments = $paymentsQuery->get();

        return response()->json(['data' => $payments], 200);
    }

    /**
     * POST /api/payment/upload-proof
     * Fields: file, amount, mobile, network, delivery_lat, delivery_lng, delivery_address, note, cart_hash
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
        ]);

        DB::beginTransaction();
        try {
            $file = $request->file('file');
            $path = $file->store('payments', 'public');

            $txRef = 'proof_' . uniqid();

            $payment = Payment::create([
                'user_id' => $user->id,
                'tx_ref' => $txRef,
                'amount' => $validated['amount'],
                'currency' => 'MWK',
                'status' => 'pending',
                'mobile' => $validated['mobile'],
                'network' => $validated['network'],
                'meta' => [
                    'note' => $validated['note'] ?? null,
                    'delivery_lat' => $validated['delivery_lat'] ?? null,
                    'delivery_lng' => $validated['delivery_lng'] ?? null,
                    'delivery_address' => $validated['delivery_address'] ?? null,
                    'cart_hash' => $validated['cart_hash'] ?? null,
                ],
                'proof_url' => $path,
            ]);

            DB::commit();

            return response()->json(['tx_ref' => $txRef, 'payment' => $payment], 201);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Upload proof error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to upload proof', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Admin approval (unchanged)
     */
    public function adminApprove(Request $request, $id)
    {
        $payment = Payment::find($id);
        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($payment->status === 'success') {
            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            return response()->json(['message' => 'Already approved', 'payment' => $payment, 'meta' => $meta], 200);
        }

        DB::beginTransaction();
        try {
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

            if (floatval($payment->amount) != floatval($total)) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['amount_mismatch'] = ['payment' => $payment->amount, 'cart_total' => $total];
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

            $order = Order::create([
                'order_id' => $orderId,
                'user_id' => $user->id,
                'total' => $total,
                'delivery_address' => data_get($payment->meta, 'delivery_address') ?? null,
                'status' => 'pending_delivery',
                'payment_ref' => $payment->tx_ref,
            ]);

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

            return response()->json(['message' => 'Payment approved and order created', 'order' => $order], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('adminApprove error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to approve payment', 'error' => $e->getMessage()], 500);
        }
    }
}
