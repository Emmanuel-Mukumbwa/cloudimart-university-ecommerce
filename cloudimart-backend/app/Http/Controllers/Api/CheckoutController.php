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
           'payment_method' => 'nullable|string' // default COD if not provided
       ]);

       $user = $request->user();

       // validate delivery zone
       $inside = $this->locationService->isWithinDeliveryZone($data['delivery_lat'], $data['delivery_lng']);
       if (!$inside) {
           return response()->json(['success' => false, 'message' => 'Delivery address is outside our service area.'], 400);
       }

       // fetch cart
       $cart = Cart::where('user_id', $user->id)->with('items.product')->first();
       if (!$cart || $cart->items->isEmpty()) {
           return response()->json(['success' => false, 'message' => 'Cart is empty'], 400);
       }

       // compute cart total on server-side (definitive)
       $total = 0;
       foreach ($cart->items as $ci) {
           $total += ($ci->product->price * $ci->quantity);
       }

       // Validate payment tx_ref and ensure success + amount match
       $payment = Payment::where('tx_ref', $data['tx_ref'])->where('user_id', $user->id)->first();
       if (!$payment) {
           return response()->json(['success' => false, 'message' => 'Payment not found.'], 400);
       }

       if ($payment->status !== 'success') {
           return response()->json(['success' => false, 'message' => 'Payment not confirmed yet.'], 400);
       }

       // amount check (use numeric cast)
       // NOTE: round/normalize same way as stored prices (float precision aware)
       if (floatval($payment->amount) != floatval($total)) {
           return response()->json([
               'success' => false,
               'message' => 'Payment amount mismatch. Please contact support.'
           ], 400);
       }

       DB::beginTransaction();
       try {
           // generate unique order id
           $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));

           $order = Order::create([
               // keep existing schema fields (order_id used in your codebase)
               'order_id' => $orderId,
               'user_id' => $user->id,
               'total' => $total,
               'delivery_address' => $data['delivery_address'],
               'status' => 'paid',
               // `payment_ref` field: if your orders table has it, this will set it.
               // If you don't have the column yet, add it in a migration. If you prefer
               // not to use it, remove this line.
               'payment_ref' => $payment->tx_ref,
           ]);

           // create order items
           foreach ($cart->items as $ci) {
               OrderItem::create([
                   'order_id' => $order->id,
                   'product_id' => $ci->product_id,
                   'quantity' => $ci->quantity,
                   'price' => $ci->product->price
               ]);
           }

           // create delivery entry with verification code
           $verificationCode = strtoupper(Str::random(6));
           Delivery::create([
               'order_id' => $order->id,
               'delivery_person' => null,
               'status' => 'pending',
               'verification_code' => $verificationCode
           ]);

           // clear cart items
           $cart->items()->delete();

           // create in-app notification (we're not sending SMS/email for now)
           Notification::create([
               'user_id' => $user->id,
               'title' => 'Order Placed',
               'message' => "Your order #{$order->order_id} has been placed successfully and is being processed."
           ]);

           DB::commit();

           return response()->json(['success' => true, 'order_id' => $order->order_id, 'order' => $order]);
       } catch (\Throwable $e) {
           DB::rollBack();
           return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
       }
   }
}
