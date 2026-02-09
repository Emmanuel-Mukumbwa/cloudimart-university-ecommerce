<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Delivery;
use App\Models\Transaction;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DeliveryController extends Controller
{
    /**
     * Restrict to delivery users only.
     * Return a proper JSON response if not delivery role.
     */
    protected function ensureDeliveryRole($user)
    {
        if (! $user || $user->role !== 'delivery') {
            abort(response()->json(['message' => 'Forbidden – Delivery access only'], 403));
        }
    }

    /**
     * GET /api/delivery/dashboard
     * Returns list of deliveries assigned to the current delivery user.
     * Only returns deliveries with status 'pending' (i.e. action required).
     * Each delivery includes its order, order.user and order.items.product.
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();
        $this->ensureDeliveryRole($user); // internal role check

        try {
            $deliveries = Delivery::where('delivery_person_id', $user->id)
                ->where('status', 'pending')
                ->with([
                    'order' => function ($q) {
                        $q->with(['user:id,name,phone_number','items.product:id,name,price']);
                    }
                ])
                ->orderBy('created_at', 'asc')
                ->get();

            // normalize response: frontend expects deliveries array
            return response()->json(['deliveries' => $deliveries], 200);
        } catch (\Throwable $e) {
            Log::error('Delivery.dashboard error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null,
            ]);
            return response()->json(['message' => 'Failed to load deliveries'], 500);
        }
    }

    /**
     * POST /api/delivery/orders/{id}/complete
     * Mark order as delivered (by internal ID).
     * Safe to call multiple times (idempotent).
     */
    public function completeOrder(Request $request, $id)
    {
        $user = $request->user();
        $this->ensureDeliveryRole($user); // internal role check

        DB::beginTransaction();
        try {
            $order = Order::with('user')->findOrFail($id);

            // Already delivered?
            if ($order->status === 'delivered') {
                return response()->json([
                    'success'  => true,
                    'message'  => 'Order already marked delivered',
                    'order_id' => $order->order_id,
                ]);
            }

            // Create or update delivery record
            $delivery = Delivery::firstOrNew(['order_id' => $order->id]);
            $delivery->delivery_person = $user->name ?? $delivery->delivery_person;
            $delivery->delivery_person_id = $user->id ?? $delivery->delivery_person_id;
            $delivery->status = 'completed';
            $delivery->verification_code = null;
            $delivery->save();

            // Update order
            $order->update(['status' => 'delivered']);

            // Log transaction
            Transaction::create([
                'order_id' => $order->id,
                'type'     => 'delivery',
                'amount'   => $order->total,
                'currency' => 'MWK',
                'status'   => 'completed',
                'meta'     => json_encode([
                    'delivered_by' => $delivery->delivery_person ?? 'unknown'
                ]),
            ]);

            // Notify customer
            Notification::create([
                'user_id' => $order->user_id,
                'title'   => 'Order Delivered',
                'message' => "Your order #{$order->order_id} has been delivered by {$delivery->delivery_person}.",
            ]);

            DB::commit();

            return response()->json([
                'success'  => true,
                'message'  => 'Order marked as delivered',
                'order_id' => $order->order_id,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Delivery.completeOrder error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null,
            ]);
            return response()->json(['success' => false, 'message' => 'Failed to mark delivered'], 500);
        }
    }

    /**
     * POST /api/delivery/verify
     * Verify delivery by order ID + phone number.
     * Creates/updates delivery record, marks order as delivered,
     * logs transaction, and sends notification.
     * Payload: { order_id: "ORD-20260206-XXXXXX", phone: "099...", delivery_person?: "Name" }
     */
    public function verify(Request $request)
    {
        $user = $request->user();
        $this->ensureDeliveryRole($user); // internal role check

        $data = $request->validate([
            'order_id'        => 'required|string',
            'phone'           => 'required|string',
            'delivery_person' => 'nullable|string',
        ]);

        $order = Order::where('order_id', $data['order_id'])
            ->with('user')
            ->first();

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        // Simple phone match check (normalize: remove spaces)
        $provided = preg_replace('/\s+/', '', $data['phone']);
        $stored = preg_replace('/\s+/', '', ($order->user->phone_number ?? ''));

        if ($stored === '') {
            return response()->json(['message' => 'Order has no customer phone recorded'], 422);
        }

        if ($provided !== $stored && $provided !== ('+'.$stored) && $provided !== ltrim($stored, '+')) {
            // allow matching with/without leading +265 etc. If mismatch, reject.
            return response()->json(['message' => 'Phone number does not match customer'], 403);
        }

        DB::beginTransaction();
        try {
            // Create or update delivery record
            $delivery = Delivery::firstOrNew(['order_id' => $order->id]);
            $delivery->delivery_person = $data['delivery_person'] ?? $delivery->delivery_person ?? $user->name;
            $delivery->delivery_person_id = $user->id ?? $delivery->delivery_person_id;
            $delivery->status = 'completed';
            $delivery->verification_code = null;
            $delivery->save();

            // Mark order as delivered
            $order->update(['status' => 'delivered']);

            // Log transaction
            Transaction::create([
                'order_id' => $order->id,
                'type'     => 'delivery',
                'amount'   => $order->total,
                'currency' => 'MWK',
                'status'   => 'completed',
                'meta'     => json_encode([
                    'delivered_by' => $delivery->delivery_person ?? 'unknown'
                ]),
            ]);

            // Notify buyer
            Notification::create([
                'user_id' => $order->user_id,
                'title'   => 'Order Delivered',
                'message' => "Your order #{$order->order_id} has been delivered. Thank you for shopping with Cloudimart.",
            ]);

            DB::commit();

            return response()->json([
                'success'  => true,
                'message'  => 'Delivery confirmed',
                'order_id' => $order->order_id,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Delivery.verify error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to confirm delivery',
            ], 500);
        }
    }
}
