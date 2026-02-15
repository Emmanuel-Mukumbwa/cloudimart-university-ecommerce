<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\Payment;
use Illuminate\Support\Facades\Auth;

class CartController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $cart = Cart::firstOrCreate(['user_id' => $user->id]);
        $items = $cart->items()->with('product')->get();

        // return the cart object (including id and updated_at) plus items
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

        // --- NEW: prevent adding items while user has pending, non-ordered payment ---
        $hasPending = Payment::where('user_id', $user->id)
            ->where('status', 'pending')
            ->whereRaw("JSON_EXTRACT(meta, '$.order_id') IS NULL")
            ->exists();

        if ($hasPending) {
            $pending = Payment::where('user_id', $user->id)
                ->where('status', 'pending')
                ->whereRaw("JSON_EXTRACT(meta, '$.order_id') IS NULL")
                ->orderBy('created_at', 'desc')
                ->first();

            $pendingHash = null;
            if ($pending) {
                $meta = $pending->meta;
                if (!is_array($meta)) {
                    try {
                        $meta = json_decode($meta ?? '[]', true) ?: [];
                    } catch (\Throwable $e) {
                        $meta = [];
                    }
                }
                $pendingHash = $meta['cart_hash'] ?? null;
            }

            return response()->json([
                'success' => false,
                'message' => 'You have a pending payment. Please wait for admin approval or cancel it before adding items.',
                'pending_cart_hash' => $pendingHash
            ], 409);
        }
        // --- end guard ---

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

        // touch cart so cart_updated_at changes (important to disambiguate carts)
        try {
            $cart->touch();
        } catch (\Throwable $e) {
            // non-fatal; continue
        }

        return response()->json([
            'success' => true,
            'message' => 'Added to cart',
            'cart' => $cart,
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

        // touch cart so cart_updated_at changes
        try {
            $item->cart->touch();
        } catch (\Throwable $e) {
            // ignore
        }

        return response()->json(['success' => true, 'message' => 'Updated', 'cart_item' => $item, 'cart' => $item->cart]);
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
            $cart = $item->cart;
            $item->delete();
            // touch cart after delete
            try {
                if ($cart) $cart->touch();
            } catch (\Throwable $e) {
                // ignore
            }
            return response()->json(['success' => true, 'message' => 'Item removed', 'cart' => $cart]);
        }

        $newQty = $currentQty - 1;

        // Ensure not exceeding stock (shouldn't happen, but check)
        if ($product && $newQty > $product->stock) {
            return response()->json(['success' => false, 'message' => "Only {$product->stock} items available in stock."], 400);
        }

        $item->quantity = $newQty;
        $item->save();

        // touch cart
        try {
            $item->cart->touch();
        } catch (\Throwable $e) {
            // ignore
        }

        return response()->json(['success' => true, 'message' => 'Quantity decremented', 'cart_item' => $item, 'cart' => $item->cart]);
    }

    public function remove(Request $request, $itemId)
    {
        $item = CartItem::findOrFail($itemId);
        $this->authorizeCartItem($request->user(), $item);
        $cart = $item->cart;
        $item->delete();

        // touch cart after removal
        try {
            if ($cart) $cart->touch();
        } catch (\Throwable $e) {
            // ignore
        }

        return response()->json(['success' => true, 'message' => 'Removed', 'cart' => $cart]);
    }

    private function authorizeCartItem($user, $item)
    {
        if ($item->cart->user_id !== $user->id) abort(403);
    }
}
