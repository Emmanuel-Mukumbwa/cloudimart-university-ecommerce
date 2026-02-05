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

    DB::beginTransaction();
    try {
        // generate unique order id
        $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));

        $total = 0;
        foreach ($cart->items as $ci) {
            $total += ($ci->product->price * $ci->quantity);
        }

        $order = Order::create([
            'order_id' => $orderId,
            'user_id' => $user->id,
            'total' => $total,
            'delivery_address' => $data['delivery_address'],
            'status' => 'pending'
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

        // send notification (simulate)
        $this->notificationService->sendOrderConfirmation($order);

        DB::commit();

        return response()->json(['success' => true, 'order_id' => $order->order_id, 'order' => $order]);
    } catch (\Throwable $e) {
        DB::rollBack();
        return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
    }
}
}
