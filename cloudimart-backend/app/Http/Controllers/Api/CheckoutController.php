<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\LocationService;
use App\Services\OrderService;
use App\Models\Cart;

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
            'delivery_lat'=>'required|numeric',
            'delivery_lng'=>'required|numeric',
            'delivery_address'=>'required|string'
        ]);

        $user = $request->user();
        $cart = Cart::where('user_id', $user->id)->with('items.product')->first();
        if (!$cart || $cart->items->isEmpty()) {
            return response()->json(['message'=>'Cart is empty'], 400);
        }

        $items = [];
        $total = 0;
        foreach ($cart->items as $ci) {
            $items[] = [
                'product_id' => $ci->product_id,
                'unit_price' => $ci->product->price,
                'quantity' => $ci->quantity
            ];
            $total += $ci->product->price * $ci->quantity;
        }

        try {
            $order = $this->orderService->processOrder($user, ['items'=>$items,'total'=>$total], $data['delivery_lat'], $data['delivery_lng'], $data['delivery_address']);

            // clear cart
            $cart->items()->delete();

            return response()->json(['success'=>true, 'order_id'=>$order->order_id, 'order' => $order]);
        } catch (\Exception $e) {
            return response()->json(['success'=>false,'message'=>$e->getMessage()], 400);
        }
    }
}
