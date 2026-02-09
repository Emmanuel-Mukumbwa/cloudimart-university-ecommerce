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
        return response()->json(['success' => true, 'data' => ['cart' => $cart, 'items' => $items]]);
    }

    public function add(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity'   => 'required|integer|min:1',
        ]);

        $user = $request->user();
        $cart = Cart::firstOrCreate(['user_id' => $user->id]);

        $product = Product::findOrFail($data['product_id']);

        // ✅ Stock check
        if ($product->stock <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'This product is out of stock.',
            ], 400);
        }

        $requestedQty = $data['quantity'];

        // If already in cart, merge quantities
        $item = $cart->items()->where('product_id', $product->id)->first();
        $currentQty = $item ? $item->quantity : 0;
        $newQty = $currentQty + $requestedQty;

        // ✅ Quantity validation vs stock
        if ($newQty > $product->stock) {
            return response()->json([
                'success' => false,
                'message' => "Only {$product->stock} items available in stock.",
            ], 400);
        }

        if ($item) {
            $item->quantity = $newQty;
            $item->save();
        } else {
            $item = $cart->items()->create([
                'product_id' => $product->id,
                'quantity'   => $requestedQty,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Added to cart',
            'cart_item' => [
                'id' => $item->id,
                'product_id' => $product->id,
                'quantity'   => $newQty,
            ]
        ]);
    }

    public function update(Request $request, $itemId)
    {
        $data = $request->validate(['quantity' => 'required|integer|min:1']);
        $item = CartItem::findOrFail($itemId);
        $this->authorizeCartItem($request->user(), $item);

        // Validate against product stock
        $product = $item->product;
        if ($product && $data['quantity'] > $product->stock) {
            return response()->json(['success' => false, 'message' => "Only {$product->stock} items available in stock."], 400);
        }

        $item->quantity = $data['quantity'];
        $item->save();
        return response()->json(['success' => true, 'message' => 'Updated', 'cart_item' => $item]);
    }

    /**
     * Decrement quantity by 1 (if qty>1), otherwise delete the item.
     * POST /api/cart/item/{id}/decrement
     */
    public function decrement(Request $request, $itemId)
    {
        $item = CartItem::findOrFail($itemId);
        $this->authorizeCartItem($request->user(), $item);

        $product = $item->product;
        $currentQty = intval($item->quantity ?? 0);

        if ($currentQty <= 1) {
            // delete
            $item->delete();
            return response()->json(['success' => true, 'message' => 'Item removed']);
        }

        $newQty = $currentQty - 1;

        // Ensure not exceeding stock (shouldn't happen, but check)
        if ($product && $newQty > $product->stock) {
            return response()->json(['success' => false, 'message' => "Only {$product->stock} items available in stock."], 400);
        }

        $item->quantity = $newQty;
        $item->save();

        return response()->json(['success' => true, 'message' => 'Quantity decremented', 'cart_item' => $item]);
    }

    public function remove(Request $request, $itemId)
    {
        $item = CartItem::findOrFail($itemId);
        $this->authorizeCartItem($request->user(), $item);
        $item->delete();
        return response()->json(['success' => true, 'message' => 'Removed']);
    }

    private function authorizeCartItem($user, $item)
    {
        if ($item->cart->user_id !== $user->id) abort(403);
    }
}
