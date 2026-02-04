<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product; 
use Illuminate\Support\Facades\Auth;

class CartController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $cart = Cart::firstOrCreate(['user_id' => $user->id]);
        $items = $cart->items()->with('product')->get();
        return response()->json(['success'=>true, 'data'=>['cart'=>$cart, 'items'=>$items]]);
    }

    public function add(Request $request)
    {
        $data = $request->validate([
            'product_id'=>'required|exists:products,id',
            'quantity'=>'required|integer|min:1'
        ]);
        $user = $request->user();
        $cart = Cart::firstOrCreate(['user_id' => $user->id]);

        $product = Product::findOrFail($data['product_id']);
        $item = $cart->items()->where('product_id', $product->id)->first();
        if ($item) {
            $item->quantity += $data['quantity'];
            $item->save();
        } else {
            $cart->items()->create([
                'product_id' => $product->id,
                'quantity' => $data['quantity']
            ]);
        }
        return response()->json(['success'=>true, 'message'=>'Added to cart']);
    }

    public function update(Request $request, $itemId)
    {
        $data = $request->validate(['quantity'=>'required|integer|min:1']);
        $item = CartItem::findOrFail($itemId);
        $this->authorizeCartItem($request->user(), $item);
        $item->quantity = $data['quantity'];
        $item->save();
        return response()->json(['success'=>true, 'message'=>'Updated']);
    }

    public function remove(Request $request, $itemId)
    {
        $item = CartItem::findOrFail($itemId);
        $this->authorizeCartItem($request->user(), $item);
        $item->delete();
        return response()->json(['success'=>true, 'message'=>'Removed']);
    }

    private function authorizeCartItem($user, $item)
    {
        if ($item->cart->user_id !== $user->id) abort(403);
    }
}
