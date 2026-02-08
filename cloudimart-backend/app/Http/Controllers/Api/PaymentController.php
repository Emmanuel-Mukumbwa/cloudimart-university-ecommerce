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
use Illuminate\Support\Facades\Storage; // optional - for clarity if you want to use Storage facade

class PaymentController extends Controller
{
    /**
     * POST /api/payment/initiate
     * Expects: amount, mobile, network, delivery_lat, delivery_lng, delivery_address
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
                // Return checkout_url and tx_ref to frontend
                return response()->json([
                    'checkout_url' => data_get($response->json(), 'data.checkout_url'),
                    'tx_ref' => $txRef,
                ], 200);
            }

            // mark failed locally
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
     * Single consolidated status method:
     * - returns local status immediately if final
     * - otherwise calls PayChangu verify endpoint to refresh status
     */
    public function status(Request $request)
    {
        $txRef = $request->query('tx_ref') ?? $request->input('tx_ref');
        if (empty($txRef)) {
            return response()->json(['message' => 'tx_ref required'], 400);
        }

        $payment = Payment::where('tx_ref', $txRef)->first();
        if (! $payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        // If already finalised locally, return immediately
        if (in_array($payment->status, ['success', 'failed'])) {
            return response()->json(['status' => $payment->status, 'payment' => $payment], 200);
        }

        // Otherwise call PayChangu verify endpoint and update if necessary
        try {
            $secretKey = config('services.paychangu.secret');

            $res = Http::withHeaders([
                'Authorization' => 'Bearer ' . $secretKey,
                'Accept' => 'application/json',
            ])->get("https://api.paychangu.com/verify-payment/{$txRef}");

            Log::info('PayChangu verify response', ['tx_ref' => $txRef, 'response' => $res->json()]);

            if ($res->successful() && data_get($res->json(), 'status') === 'success') {
                $remoteStatus = data_get($res->json(), 'data.status'); // e.g. 'success' or 'failed'
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
                // if verify failed (non-200) keep pending — but return remote body for debugging
                return response()->json(['status' => $payment->status, 'remote' => $res->json()], 200);
            }
        } catch (Exception $e) {
            Log::error('PayChangu verify error', ['message' => $e->getMessage(), 'tx_ref' => $txRef]);
            // return local status but include error message for diagnostics
            return response()->json(['status' => $payment->status, 'error' => $e->getMessage()], 200);
        }

        $payment->refresh();
        return response()->json(['status' => $payment->status, 'payment' => $payment], 200);
    }

    /**
     * POST /api/payment/callback
     * PayChangu will redirect/call this with tx_ref and status (and maybe transaction_id)
     */
    public function handleCallback(Request $request)
    {
        Log::info('PayChangu callback payload', ['payload' => $request->all()]);

        $txRef = $request->input('tx_ref') ?? $request->input('transaction_reference') ?? null;
        $status = $request->input('status') ?? null;
        $providerRef = $request->input('transaction_id') ?? $request->input('transactionId') ?? null;

        if (! $txRef) {
            return response()->json(['message' => 'tx_ref missing'], 400);
        }

        $payment = Payment::where('tx_ref', $txRef)->first();

        if (! $payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        // Map remote to local statuses (adjust if PayChangu uses different words)
        if ($status === 'success') {
            $payment->update([
                'status' => 'success',
                'provider_ref' => $providerRef,
            ]);
        } elseif ($status === 'failed') {
            $payment->update(['status' => 'failed']);
        } else {
            // unknown status — persist raw payload to meta for later debugging
            $meta = $payment->meta ?? [];
            $meta = array_merge(is_array($meta) ? $meta : json_decode($meta, true) ?? [], ['last_callback' => $request->all()]);
            $payment->update(['meta' => $meta]);
        }

        return response()->json(['message' => 'Payment updated'], 200);
    }

    /**
     * List payments for the authenticated user
     * GET /api/payments
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        $payments = Payment::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        // Return payments as-is; client will read `proof_url` and `meta`
        return response()->json(['data' => $payments], 200);
    }

    /**
     * Upload proof of payment (multipart/form-data)
     * POST /api/payment/upload-proof
     * Fields: file (image), amount, mobile, network, delivery_lat, delivery_lng, delivery_address, note
     */
    public function uploadProof(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        $validated = $request->validate([
            'file' => 'required|image|max:5120', // max 5MB
            'amount' => 'required|numeric|min:0.01',
            'mobile' => 'required|string',
            'network' => 'required|string',
            'delivery_lat' => 'nullable|numeric',
            'delivery_lng' => 'nullable|numeric',
            'delivery_address' => 'nullable|string',
            'note' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $file = $request->file('file');
            // store on public disk under payments/
            $path = $file->store('payments', 'public');

            // unique tx ref for manual proof
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
     * Admin: Approve a manual payment / mark as success and auto-place order
     * POST /api/admin/payments/{id}/approve
     *
     * NOTE: This endpoint must be protected under admin role middleware.
     */
    public function adminApprove(Request $request, $id)
    {
        // ensure admin (middleware should ideally check role); here we assume middleware applied
        $payment = Payment::find($id);
        if (! $payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        // If already success, return idempotent response
        if ($payment->status === 'success') {
            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            return response()->json(['message' => 'Already approved', 'payment' => $payment, 'meta' => $meta], 200);
        }

        DB::beginTransaction();
        try {
            // 1) mark payment success
            $payment->status = 'success';
            $payment->save();

            // 2) try to create order for this payment's user (idempotent)
            $user = $payment->user; // Payment should have user relation defined
            if (! $user) {
                DB::rollBack();
                return response()->json(['message' => 'Payment has no associated user'], 400);
            }

            // Ensure no existing order for this payment tx_ref
            $existing = Order::where('payment_ref', $payment->tx_ref)->first();
            if ($existing) {
                // attach order id into payment meta if missing
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                if (empty($meta['order_id'])) {
                    $meta['order_id'] = $existing->order_id;
                    $payment->meta = $meta;
                    $payment->save();
                }
                DB::commit();
                return response()->json(['message' => 'Payment approved; existing order found', 'order' => $existing], 200);
            }

            // fetch cart for user
            $cart = \App\Models\Cart::where('user_id', $user->id)->with('items.product')->first();
            if (! $cart || $cart->items->isEmpty()) {
                // no cart — still mark payment success but cannot auto-place
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['note'] = ($meta['note'] ?? '') . ' | No cart found to auto-place order';
                $payment->meta = $meta;
                $payment->save();
                DB::commit();
                return response()->json(['message' => 'Payment marked success but user cart empty; manual intervention required.'], 200);
            }

            // compute total server-side and verify amount matches payment.amount
            $total = 0;
            foreach ($cart->items as $ci) {
                $total += ($ci->product->price * $ci->quantity);
            }

            if (floatval($payment->amount) != floatval($total)) {
                // mismatch: still mark payment success but warn
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['amount_mismatch'] = ['payment' => $payment->amount, 'cart_total' => $total];
                $payment->meta = $meta;
                $payment->save();

                DB::rollBack();
                return response()->json(['message' => 'Amount mismatch between payment and cart total. Aborting auto-place.', 'meta' => $meta], 422);
            }

            // 3) stock checks and order creation (very similar to CheckoutController::placeOrder)
            $insufficient = [];
            foreach ($cart->items as $ci) {
                $productRow = DB::table('products')->where('id', $ci->product_id)->lockForUpdate()->first();
                if (!$productRow) {
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => "Product (ID {$ci->product_id}) not found"], 400);
                }

                $currentStock = intval($productRow->stock ?? 0);
                if ($currentStock < intval($ci->quantity)) {
                    $insufficient[] = [
                        'product_id' => $ci->product_id,
                        'available' => $currentStock,
                        'requested' => intval($ci->quantity),
                    ];
                }
            }

            if (!empty($insufficient)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Some items are out of stock',
                    'items' => $insufficient
                ], 409);
            }

            // Create order id
            $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(\Illuminate\Support\Str::random(6));

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

                // decrement stock
                DB::table('products')->where('id', $ci->product_id)->decrement('stock', $ci->quantity);
            }

            // create delivery entry
            $verificationCode = strtoupper(\Illuminate\Support\Str::random(6));
            Delivery::create([
                'order_id' => $order->id,
                'delivery_person' => null,
                'status' => 'pending',
                'verification_code' => $verificationCode
            ]);

            // delete cart items
            $cart->items()->delete();

            // create notification
            Notification::create([
                'user_id' => $user->id,
                'title' => 'Order Placed',
                'message' => "Your order #{$order->order_id} has been placed (admin-approved payment)."
            ]);

            // attach order id to payment.meta so client can detect it
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
