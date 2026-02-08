<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\LocationService;
use App\Services\OrderService;
use App\Models\Cart;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Delivery;
use App\Models\Payment;
use App\Models\Notification;
use Illuminate\Support\Facades\Log;

class CheckoutController extends Controller
{
    protected $locationService;
    protected $orderService;

    public function __construct(LocationService $locationService, OrderService $orderService)
    {
        $this->locationService = $locationService;
        $this->orderService = $orderService;
    }

    public function validateLocation(Request $request)
    {
        $data = $request->validate(['lat'=>'required|numeric','lng'=>'required|numeric']);
        $valid = $this->locationService->isWithinDeliveryZone($data['lat'], $data['lng']);
        return response()->json(['success'=>true,'valid'=>$valid]);
    }

    public function placeOrder(Request $request)
    {
        $data = $request->validate([
            'tx_ref' => 'required|string',
            'delivery_lat' => 'required|numeric',
            'delivery_lng' => 'required|numeric',
            'delivery_address' => 'required|string',
            'payment_method' => 'nullable|string'
        ]);

        $user = $request->user();

        // validate delivery zone
        $inside = $this->locationService->isWithinDeliveryZone($data['delivery_lat'], $data['delivery_lng']);
        if (!$inside) {
            return response()->json(['success' => false, 'message' => 'Delivery address is outside our service area.'], 400);
        }

        // fetch cart with product relation
        $cart = Cart::where('user_id', $user->id)->with('items.product')->first();
        if (!$cart || $cart->items->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'Cart is empty'], 400);
        }

        // Validate payment tx_ref and ensure success + amount match
        $payment = Payment::where('tx_ref', $data['tx_ref'])->where('user_id', $user->id)->first();
        if (!$payment) {
            return response()->json(['success' => false, 'message' => 'Payment not found.'], 400);
        }
        if ($payment->status !== 'success') {
            return response()->json(['success' => false, 'message' => 'Payment not confirmed yet.'], 400);
        }

        // compute cart total on server-side (definitive)
        $total = 0;
        foreach ($cart->items as $ci) {
            $total += ($ci->product->price * $ci->quantity);
        }

        // amount check (normalize floats)
        if (floatval($payment->amount) != floatval($total)) {
            return response()->json([
                'success' => false,
                'message' => 'Payment amount mismatch. Please contact support.'
            ], 400);
        }

        // Idempotency: if order already created for this payment_ref, return it
        $existing = Order::where('payment_ref', $payment->tx_ref)->first();
        if ($existing) {
            return response()->json(['success' => true, 'order_id' => $existing->order_id, 'order' => $existing]);
        }

        DB::beginTransaction();
        try {
            // 1) Check stock for each product using SELECT ... FOR UPDATE
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

            // 2) Create order (use your order_id format)
            $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));

            $order = Order::create([
                'order_id' => $orderId,
                'user_id' => $user->id,
                'total' => $total,
                'delivery_address' => $data['delivery_address'],
                'status' => 'pending_delivery',
                'payment_ref' => $payment->tx_ref,
            ]);

            // 3) Create order items & decrement product stock
            foreach ($cart->items as $ci) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $ci->product_id,
                    'quantity' => $ci->quantity,
                    'price' => $ci->product->price
                ]);

                // decrement stock (row is locked)
                DB::table('products')->where('id', $ci->product_id)->decrement('stock', $ci->quantity);
            }

            // 4) create delivery entry with verification code
            $verificationCode = strtoupper(Str::random(6));
            Delivery::create([
                'order_id' => $order->id,
                'delivery_person' => null,
                'status' => 'pending',
                'verification_code' => $verificationCode
            ]);

            // 5) clear cart items
            $cart->items()->delete();

            // 6) create in-app notification
            Notification::create([
                'user_id' => $user->id,
                'title' => 'Order Placed',
                'message' => "Your order #{$order->order_id} has been placed successfully and is being processed."
            ]);

            // 7) Clear server-trusted delivery verification for this user (only if cart_hash matches)
            try {
                // Payment may store meta as JSON or array
                $paymentMeta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $cartHashFromPayment = $paymentMeta['cart_hash'] ?? null;

                $userMeta = is_array($user->delivery_verified_meta) ? $user->delivery_verified_meta : (json_decode($user->delivery_verified_meta ?? '[]', true) ?: []);
                $userCartHash = $userMeta['cart_hash'] ?? null;

                // Clear only if we can reasonably match (or clear always if you prefer)
                if ($cartHashFromPayment && $userCartHash && $cartHashFromPayment === $userCartHash) {
                    $user->delivery_verified_at = null;
                    $user->delivery_verified_meta = null;
                    $user->save();
                } elseif (!$userCartHash) {
                    // if user had no cart hash recorded (legacy), clear anyway to avoid stale state
                    $user->delivery_verified_at = null;
                    $user->delivery_verified_meta = null;
                    $user->save();
                }
            } catch (\Throwable $e) {
                // Log but don't fail the entire flow
                Log::warning('Failed to clear delivery verification for user ID ' . $user->id . ': ' . $e->getMessage());
            }

            DB::commit();

            return response()->json(['success' => true, 'order_id' => $order->order_id, 'order' => $order]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('placeOrder error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
