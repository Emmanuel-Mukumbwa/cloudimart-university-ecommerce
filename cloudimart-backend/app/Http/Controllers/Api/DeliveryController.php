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
     * GET /api/delivery/dashboard
     * Returns list of active (not delivered) orders for delivery personnel.
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        // For now return all non-delivered orders; in future we can filter by assigned delivery person.
        $orders = Order::where('status', '!=', 'delivered')
            ->with(['user:id,name,phone_number', 'orderItems.product:id,name,price'])
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json(['orders' => $orders]);
    }

    /**
     * POST /api/delivery/orders/{id}/complete
     * Mark order as delivered (by DB id).
     */
    public function completeOrder(Request $request, $id)
    {
        $deliveryPerson = $request->user();

        DB::beginTransaction();
        try {
            $order = Order::with('user')->findOrFail($id);

            // Idempotent: if already delivered, return success with existing data
            if ($order->status === 'delivered') {
                return response()->json([
                    'success' => true,
                    'message' => 'Order already marked delivered',
                    'order_id' => $order->order_id,
                ]);
            }

            // Create or update delivery record
            $delivery = Delivery::where('order_id', $order->id)->first();
            if (! $delivery) {
                $delivery = Delivery::create([
                    'order_id' => $order->id,
                    'delivery_person' => $deliveryPerson->name ?? null,
                    'status' => 'completed',
                    'verification_code' => null,
                ]);
            } else {
                $delivery->update([
                    'delivery_person' => $deliveryPerson->name ?? $delivery->delivery_person,
                    'status' => 'completed',
                    'verification_code' => null,
                ]);
            }

            // Update order status
            $order->update(['status' => 'delivered']);

            // Create transaction record (log)
            Transaction::create([
                'order_id' => $order->id,
                'type' => 'delivery',
                'amount' => $order->total,
                'currency' => 'MWK',
                'status' => 'completed',
                'meta' => json_encode(['delivered_by' => $delivery->delivery_person ?? 'unknown']),
            ]);

            // Create in-app notification for the buyer
            Notification::create([
                'user_id' => $order->user_id,
                'title' => 'Order Delivered',
                'message' => "Your order #{$order->order_id} has been delivered by {$delivery->delivery_person}.",
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Order marked as delivered',
                'order_id' => $order->order_id,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Delivery.completeOrder error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Failed to mark delivered'], 500);
        }
    }

    /**
     * POST /api/delivery/verify
     * Existing verification via order external id + phone. We'll also create transaction + notification here.
     * Payload: { order_id: "ORD-20260206-XXXXXX", phone: "...", delivery_person?: "Name" }
     */
    public function verify(Request $request)
    {
        $data = $request->validate([
            'order_id' => 'required|string',
            'phone' => 'required|string',
            'delivery_person' => 'nullable|string'
        ]);

        $order = Order::where('order_id', $data['order_id'])->with('user')->first();
        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        // Phone check (simple normalization not implemented — compare raw)
        if (($order->user->phone_number ?? '') !== $data['phone']) {
            return response()->json(['message' => 'Phone number does not match customer'], 403);
        }

        DB::beginTransaction();
        try {
            // Create or update delivery record
            $delivery = Delivery::where('order_id', $order->id)->first();
            if (! $delivery) {
                $delivery = Delivery::create([
                    'order_id' => $order->id,
                    'delivery_person' => $data['delivery_person'] ?? null,
                    'status' => 'completed',
                    'verification_code' => null
                ]);
            } else {
                $delivery->update([
                    'delivery_person' => $data['delivery_person'] ?? $delivery->delivery_person,
                    'status' => 'completed',
                    'verification_code' => null
                ]);
            }

            // Update order
            $order->update(['status' => 'delivered']);

            // Log transaction
            Transaction::create([
                'order_id' => $order->id,
                'type' => 'delivery',
                'amount' => $order->total,
                'currency' => 'MWK',
                'status' => 'completed',
                'meta' => json_encode(['delivered_by' => $delivery->delivery_person ?? 'unknown']),
            ]);

            // Notification to customer
            Notification::create([
                'user_id' => $order->user_id,
                'title' => 'Order Delivered',
                'message' => "Your order #{$order->order_id} has been delivered. Thank you for shopping with Cloudimart.",
            ]);

            DB::commit();

            return response()->json(['success' => true, 'message' => 'Delivery confirmed', 'order_id' => $order->order_id]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Delivery.verify error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Failed to confirm delivery'], 500);
        }
    }
}
