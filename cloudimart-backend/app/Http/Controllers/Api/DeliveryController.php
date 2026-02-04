<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Delivery;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class DeliveryController extends Controller
{
    public function verify(Request $request)
    {
        $data = $request->validate([
            'order_id' => 'required|string',
            'phone' => 'required|string',
            'delivery_person' => 'nullable|string'
        ]);

        $order = Order::where('order_id', $data['order_id'])->first();
        if (!$order) return response()->json(['message'=>'Order not found'], 404);

        // Only allow verf if phone matches order user's phone (simple check)
        if ($order->user->phone_number !== $data['phone']) {
            return response()->json(['message'=>'Phone number does not match customer'], 403);
        }

        return DB::transaction(function() use($order, $data) {
            $delivery = Delivery::create([
                'order_id' => $order->id,
                'delivery_person' => $data['delivery_person'] ?? null,
                'status' => 'completed',
                'verification_code' => null
            ]);
            $order->update(['status' => 'delivered']);

            // Log transaction status update (optional)
            Transaction::create([
                'order_id' => $order->id,
                'type' => 'delivery',
                'amount' => $order->total,
                'currency' => 'MK',
                'status' => 'completed',
                'meta' => json_encode(['delivered_by' => $delivery->delivery_person ?? 'unknown'])
            ]);

            return response()->json(['success'=>true, 'message'=>'Delivery confirmed', 'order_id' => $order->order_id]);
        });
    }
}
