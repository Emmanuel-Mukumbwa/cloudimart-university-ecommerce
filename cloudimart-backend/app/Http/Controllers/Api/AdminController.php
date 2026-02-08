<?php

namespace App\Http\Controllers\Api;

use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Product;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem; 
use App\Models\Payment;
use App\Models\Delivery;
use App\Models\Cart;
use App\Models\Transaction;
use App\Models\Notification;
use App\Models\Location;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Exception;

class AdminController extends Controller
{
    /**
     * Basic admin guard inside controller (we're not using route middleware).
     */
    protected function ensureAdmin($user)
    {
        if (! $user || $user->role !== 'admin') {
            abort(response()->json(['message' => 'Forbidden — admin only'], 403));
        }
    }

    /**
     * GET /api/admin/dashboard
     * Returns dashboard metrics:
     * - user counts by role
     * - orders summary (total, pending, pending_delivery, delivered)
     * - payments summary (sum of successful payments)
     * - top selling products (top 5)
     * - recent orders (5 latest)
     * - pending deliveries
     * - recent failed payments
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();
        $this->ensureAdmin($user);

        try {
            // users by role
            $usersByRole = User::select('role', DB::raw('count(*) as count'))
                ->groupBy('role')
                ->pluck('count', 'role')
                ->toArray();

            // orders summary
            $ordersTotal = Order::count();
            $ordersPending = Order::where('status', 'pending')->count();
            $ordersPendingDelivery = Order::where('status', 'pending_delivery')->count();
            $ordersDelivered = Order::where('status', 'delivered')->count();

            // payments summary
            $paymentsTotalCollected = (float) Payment::where('status', 'success')->sum('amount');

            // top selling products
            $topProducts = DB::table('order_items')
                ->select('products.id','products.name', DB::raw('SUM(order_items.quantity) as total_qty'))
                ->join('products', 'order_items.product_id', '=', 'products.id')
                ->groupBy('products.id','products.name')
                ->orderByDesc('total_qty')
                ->limit(5)
                ->get();

            // recent orders (5)
            $recentOrders = Order::with(['user:id,name,phone_number','items.product:id,name,price'])
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get();

            // pending deliveries
            $pendingDeliveries = Order::whereIn('status', ['pending', 'pending_delivery'])
                ->with(['user:id,name,phone_number','items.product:id,name,price'])
                ->orderBy('created_at', 'asc')
                ->get();

            // failed payments (recent 10)
            $failedPayments = Payment::where('status', 'failed')
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get();

            return response()->json([
                'users_by_role' => $usersByRole,
                'orders' => [
                    'total' => $ordersTotal,
                    'pending' => $ordersPending,
                    'pending_delivery' => $ordersPendingDelivery,
                    'delivered' => $ordersDelivered,
                ],
                'payments' => [
                    'collected' => $paymentsTotalCollected,
                ],
                'top_products' => $topProducts,
                'recent_orders' => $recentOrders,
                'pending_deliveries' => $pendingDeliveries,
                'failed_payments' => $failedPayments,
            ]);
        } catch (\Throwable $e) {
            Log::error('Admin.dashboard error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Failed to load admin dashboard'], 500);
        }
    }

    /**
     * GET /api/admin/users
     * Users listing (admin). Supports:
     *  - ?role=admin|user|delivery (filters by role)
     *  - ?is_active=1|0 (filters by active state)
     *  - ?exclude_admin=1 (exclude admin accounts from results)
     *  - pagination
     */
    public function users(Request $request)
    {
        $this->ensureAdmin($request->user());

        $role = $request->query('role', null);
        $isActive = $request->query('is_active', null);
        $excludeAdmin = $request->query('exclude_admin', false);

        // Select fields useful for the admin UI and include orders_count as a subquery
        $q = User::query()
            ->select(
                'users.id',
                'users.name',
                'users.email',
                'users.phone_number',
                'users.role',
                'users.is_active',
                'users.created_at',
                'users.updated_at',
                'users.location_id',
                'users.latitude',
                'users.longitude',
                'users.location_verified_at',
                DB::raw('(SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) as orders_count')
            )
            ->with(['location:id,name']); // eager-load location name

        if ($role) {
            $q->where('role', $role);
        }

        if (!is_null($isActive)) {
            $q->where('is_active', intval($isActive));
        }

        if ($excludeAdmin) {
            $q->where('role', '!=', 'admin');
        }

        $users = $q->orderBy('created_at','desc')->paginate(20);
        return response()->json($users);
    }

    /**
     * POST /api/admin/users
     * Create user (admin). Accepts role: admin|user|delivery
     */
    public function createUser(Request $request)
    {
        $this->ensureAdmin($request->user());

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'phone_number' => 'nullable|string|max:50',
            'role' => ['required', Rule::in(['admin','user','delivery'])],
            'location_id' => 'nullable|exists:locations,id',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone_number' => $data['phone_number'] ?? null,
            'role' => $data['role'],
            'location_id' => $data['location_id'] ?? null,
            'is_active' => true,
        ]);

        return response()->json(['success'=>true,'user'=>$user], 201);
    }

    /**
     * POST /api/admin/users/{id}/deactivate
     * Deactivate user (is_active = false)
     */
    public function deactivateUser(Request $request, $id)
    {
        $this->ensureAdmin($request->user());
        $user = User::findOrFail($id);
        $user->update(['is_active' => false]);
        return response()->json(['success' => true, 'message' => 'User deactivated', 'user' => $user]);
    }

    /**
     * POST /api/admin/users/{id}/activate
     * Activate user (is_active = true)
     */
    public function activateUser(Request $request, $id)
    {
        $this->ensureAdmin($request->user());
        $user = User::findOrFail($id);
        $user->update(['is_active' => true]);
        return response()->json(['success' => true, 'message' => 'User activated', 'user' => $user]);
    }

    /**
     * POST /api/admin/users/{id}/suspend
     * Compatibility helper: suspend user (sets is_active=false and role='suspended').
     * Prefer using deactivate/activate endpoints and the is_active flag.
     */
    public function suspendUser(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        $user = User::findOrFail($id);
        $user->update([
            'is_active' => false,
            'role' => 'suspended',
        ]);

        return response()->json(['success' => true, 'message' => 'User suspended', 'user' => $user]);
    }

        /**
     * GET /api/admin/products
     * Products listing (paginated)
     */
    public function products(Request $request)
    {
        $this->ensureAdmin($request->user());

        $q = Product::with('category')->orderBy('created_at','desc');
        if ($request->has('category_id')) $q->where('category_id', $request->get('category_id'));
        $products = $q->paginate(20);

        return response()->json($products);
    }

    /**
     * POST /api/admin/products
     * Create / update product
     * Accepts multipart/form-data (optional image file named 'image') or JSON (image_url string)
     */
    public function saveProduct(Request $request)
    {
        $this->ensureAdmin($request->user());

        // allow both multipart and json: validation will adapt
        $rules = [
            'id' => 'nullable|exists:products,id',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'price' => 'required|numeric',
            'category_id' => 'required|exists:categories,id',
            'stock' => 'required|integer|min:0',
            'image_url' => 'nullable|string',
            'image' => 'nullable|image|max:5120', // 5MB
        ];

        $data = $request->validate($rules);

        // If file uploaded, store it
        $storedPath = null;
        if ($request->hasFile('image')) {
            try {
                $storedPath = $request->file('image')->store('products', 'public'); // returns e.g. products/xxx.png
            } catch (Exception $e) {
                Log::error('Product image store failed: ' . $e->getMessage());
                return response()->json(['message' => 'Failed to store image'], 500);
            }
        }

        // If updating
        if (!empty($data['id'])) {
            $prod = Product::findOrFail($data['id']);

            // If new image uploaded, delete old image file (if exists)
            if ($storedPath) {
                if (!empty($prod->image_url)) {
                    try {
                        Storage::disk('public')->delete($prod->image_url);
                    } catch (\Exception $e) {
                        Log::warning('Failed to delete old product image: ' . $e->getMessage());
                    }
                }
                $data['image_url'] = $storedPath;
            } else {
                // If no new file but image_url present in payload (string), keep it; otherwise leave existing image_url
                if (!array_key_exists('image_url', $data) || $data['image_url'] === null) {
                    // preserve existing
                    unset($data['image_url']);
                }
            }

            $prod->update($data);
            return response()->json(['success' => true, 'product' => $prod->fresh()], 200);
        }

        // Create new product
        if ($storedPath) {
            $data['image_url'] = $storedPath;
        } else {
            // allow creating without an image_url
            $data['image_url'] = $data['image_url'] ?? null;
        }

        $prod = Product::create($data);

        return response()->json(['success'=>true,'product'=>$prod], 201);
    }

    /**
     * DELETE /api/admin/products/{id}
     */
    public function deleteProduct(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        $prod = Product::findOrFail($id);

        // delete image file if present
        if (!empty($prod->image_url)) {
            try {
                Storage::disk('public')->delete($prod->image_url);
            } catch (\Exception $e) {
                Log::warning('Failed to delete product image on product delete: ' . $e->getMessage());
            }
        }

        $prod->delete();
        return response()->json(['success'=>true,'message'=>'Product deleted']);
    }

    /**
     * GET /api/admin/orders
     * Orders listing with filters (status)
     */
    public function orders(Request $request)
    {
        $this->ensureAdmin($request->user());

        $q = Order::with(['user:id,name,phone_number','items.product']);
        if ($request->has('status')) $q->where('status', $request->get('status'));
        $orders = $q->orderBy('created_at','desc')->paginate(20);
        return response()->json($orders);
    }

    /**
     * POST /api/admin/orders/{id}/status
     * Update order status (admin)
     */
    public function updateOrderStatus(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        $data = $request->validate([
            'status' => ['required', Rule::in(['pending','pending_delivery','delivered','completed'])]
        ]);
        $order = Order::findOrFail($id);
        $order->update(['status' => $data['status']]);

        return response()->json(['success' => true, 'order' => $order]);
    }

    /**
     * GET /api/admin/payments
     * Payments listing (admin). Includes user relation for UI convenience.
     */
    public function payments(Request $request)
    {
        $this->ensureAdmin($request->user());

        $q = Payment::with(['user:id,name,email'])->orderBy('created_at','desc');
        if ($request->has('status')) $q->where('status', $request->get('status'));
        $payments = $q->paginate(25);

        return response()->json($payments);
    }

    /**
     * POST /api/admin/payments/{id}/approve
     * Admin approves a payment (manual proof). This:
     *  - marks payment.status => 'success'
     *  - idempotently attempts to auto-create an order for the payment->user using their cart
     *  - if successful, sets payment.meta.order_id and returns the created order
     *
     * WARNING: this endpoint must be protected by admin auth (we check here).
     */
    public function approvePayment(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        $payment = Payment::find($id);
        if (! $payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        // If already approved, return the payment (idempotent)
        if ($payment->status === 'success') {
            return response()->json(['message' => 'Payment already approved', 'payment' => $payment], 200);
        }

        DB::beginTransaction();
        try {
            // 1) Mark payment as success
            $payment->status = 'success';
            $payment->save();

            // 2) Auto-place order for the user based on their cart (idempotent)
            $user = $payment->user;
            if (! $user) {
                DB::commit();
                return response()->json(['message' => 'Payment approved but payment has no associated user'], 200);
            }

            // If an order already exists for this payment, attach and return
            $existing = Order::where('payment_ref', $payment->tx_ref)->first();
            if ($existing) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                if (empty($meta['order_id'])) {
                    $meta['order_id'] = $existing->order_id;
                    $payment->meta = $meta;
                    $payment->save();
                }
                DB::commit();
                return response()->json(['message' => 'Payment approved; existing order found', 'order' => $existing], 200);
            }

            // fetch cart for user
            $cart = Cart::where('user_id', $user->id)->with('items.product')->first();
            if (! $cart || $cart->items->isEmpty()) {
                // no cart — still mark payment success but cannot auto-place
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['note'] = ($meta['note'] ?? '') . ' | No cart found to auto-place order';
                $payment->meta = $meta;
                $payment->save();
                DB::commit();
                return response()->json(['message' => 'Payment marked success but user cart empty; manual placement required.'], 200);
            }

            // verify amount matches cart total
            $total = 0;
            foreach ($cart->items as $ci) {
                $total += ($ci->product->price * $ci->quantity);
            }

            if (floatval($payment->amount) != floatval($total)) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['amount_mismatch'] = ['payment' => $payment->amount, 'cart_total' => $total];
                $payment->meta = $meta;
                $payment->save();

                DB::rollBack();
                return response()->json(['message' => 'Amount mismatch between payment and cart total. Auto-place aborted.', 'meta' => $meta], 422);
            }

            // stock checks (with locks)
            $insufficient = [];
            foreach ($cart->items as $ci) {
                $productRow = DB::table('products')->where('id', $ci->product_id)->lockForUpdate()->first();
                if (! $productRow) {
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => "Product (ID {$ci->product_id}) not found"], 400);
                }

                $currentStock = intval($productRow->stock ?? 0);
                if ($currentStock < intval($ci->quantity)) {
                    $insufficient[] = [
                        'product_id' => $ci->product_id,
                        'available' => $currentStock,
                        'requested' => intval($ci->quantity),
                    ];
                }
            }

            if (!empty($insufficient)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Some items are out of stock',
                    'items' => $insufficient
                ], 409);
            }

            // Create order id & record
            $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));

            $order = Order::create([
                'order_id' => $orderId,
                'user_id' => $user->id,
                'total' => $total,
                'delivery_address' => data_get($payment->meta, 'delivery_address') ?? null,
                'status' => 'pending_delivery',
                'payment_ref' => $payment->tx_ref,
            ]);

            // create order items & decrement stock
            foreach ($cart->items as $ci) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $ci->product_id,
                    'quantity' => $ci->quantity,
                    'price' => $ci->product->price,
                ]);

                DB::table('products')->where('id', $ci->product_id)->decrement('stock', $ci->quantity);
            }

            // create delivery record
            $verificationCode = strtoupper(Str::random(6));
            Delivery::create([
                'order_id' => $order->id,
                'delivery_person' => null,
                'status' => 'pending',
                'verification_code' => $verificationCode
            ]);

            // clear cart items
            $cart->items()->delete();

            // notify user (in-app)
            Notification::create([
                'user_id' => $user->id,
                'title' => 'Order Placed',
                'message' => "Your order #{$order->order_id} has been placed (admin-approved payment)."
            ]);

            // attach order_id to payment.meta
            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            $meta['order_id'] = $order->order_id;
            $payment->meta = $meta;
            $payment->save();

            DB::commit();

            return response()->json(['message' => 'Payment approved and order created', 'order' => $order], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('admin.approvePayment error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to approve payment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/admin/notify
     * Send notification (global or per user)
     * payload: { user_id: optional, title: required, message: required }
     */
    public function notify(Request $request)
    {
        $this->ensureAdmin($request->user());

        $data = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'title' => 'required|string|max:255',
            'message' => 'required|string',
        ]);

        if (!empty($data['user_id'])) {
            Notification::create([
                'user_id' => $data['user_id'],
                'title' => $data['title'],
                'message' => $data['message'],
            ]);
        } else {
            // broadcast to all users (for large datasets, queue this job)
            $users = User::all(['id']);
            foreach ($users as $u) {
                Notification::create([
                    'user_id' => $u->id,
                    'title' => $data['title'],
                    'message' => $data['message'],
                ]);
            }
        }

        return response()->json(['success' => true]);
    }

    /**
     * GET /api/admin/locations
     * Locations management (list)
     */
    public function locations(Request $request)
    {
        $this->ensureAdmin($request->user());
        $locations = Location::orderBy('name','asc')->paginate(30);
        return response()->json($locations);
    }
}

