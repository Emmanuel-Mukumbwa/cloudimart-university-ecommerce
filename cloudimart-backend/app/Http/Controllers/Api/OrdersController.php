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
        $orders = Order::where('user_id', $user->id)->orderBy('created_at', 'desc')->paginate(10);
        return response()->json($orders);
    }

    // GET /api/orders/count
    public function count(Request $request)
    {
        $user = $request->user();
        $count = Order::where('user_id', $user->id)->whereIn('status', ['pending', 'delivered', 'completed'])->count();
        return response()->json(['count' => $count]);
    }
}
