<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;

class OrdersController extends Controller
{
    // GET /api/orders (paginated)
    public function index(Request $request)
    {
        $user = $request->user();

        $orders = Order::where('user_id', $user->id)
                       ->with([
                           'items.product',
                           // load delivery and the linked delivery person (user) with only id,name,phone_number
                           'delivery.deliveryPerson:id,name,phone_number'
                       ])
                       ->orderBy('created_at', 'desc')
                       ->paginate(10);

        // Transform the paginated collection to include a simple string for delivery display
        $orders->getCollection()->transform(function ($order) {
            $deliveryDisplay = 'Unassigned';

            if ($order->delivery) {
                $del = $order->delivery;
                $dp = $del->deliveryPerson ?? null;
                if ($dp && ($dp->name || $dp->phone_number)) {
                    $parts = [];
                    if (!empty($dp->name)) $parts[] = $dp->name;
                    if (!empty($dp->phone_number)) $parts[] = $dp->phone_number;
                    $deliveryDisplay = implode(' — ', $parts);
                } elseif (!empty($del->delivery_person)) {
                    // legacy free-text field
                    $deliveryDisplay = $del->delivery_person;
                }
            }

            // Append a simple property (will be preserved in returned JSON)
            $order->delivery_display = $deliveryDisplay;
            return $order;
        });

        return response()->json($orders);
    }

    // GET /api/orders/count
    public function count(Request $request)
    {
        $user = $request->user();

        $count = Order::where('user_id', $user->id)
                      ->where('status', '!=', 'delivered')
                      ->count();

        return response()->json(['count' => $count]);
    }
}
