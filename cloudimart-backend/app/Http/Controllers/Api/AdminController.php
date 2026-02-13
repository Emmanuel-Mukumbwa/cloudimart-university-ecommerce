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
use Illuminate\Support\Facades\Mail;
use App\Mail\OrderPlaced;
use App\Mail\DeliveryAssigned;

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
     * Helper: normalize payment model to array for API responses.
     * Adds proof_url_full and ensures meta is decoded as array.
     */
    protected function paymentToArray(Payment $p): array
    {
        // meta as array
        $meta = $p->meta;
        if (!is_array($meta)) {
            $meta = json_decode($p->meta ?? '[]', true) ?: [];
        }

        // compute proof_url_full
        $proofUrlFull = null;
        if (!empty($p->proof_url)) {
            $raw = $p->proof_url;
            if (preg_match('#^https?://#i', $raw) || str_starts_with($raw, '//')) {
                $proofUrlFull = $raw;
            } else {
                try {
                    $proofUrlFull = Storage::disk('public')->url(ltrim($raw, '/'));
                } catch (\Throwable $e) {
                    $proofUrlFull = asset('storage/' . ltrim($raw, '/'));
                }
            }
        }

        // include basic user info if loaded or related
        $user = null;
        try {
            if ($p->relationLoaded('user') || $p->user) {
                $u = $p->user;
                if ($u) {
                    $user = [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email ?? null,
                    ];
                }
            }
        } catch (\Throwable $e) {
            $user = null;
        }

        return [
            'id' => $p->id,
            'tx_ref' => $p->tx_ref,
            'provider_ref' => $p->provider_ref ?? null,
            'user_id' => $p->user_id ?? null,
            'user' => $user,
            'mobile' => $p->mobile ?? null,
            'amount' => (float) $p->amount,
            'currency' => $p->currency ?? null,
            'status' => $p->status,
            'created_at' => $p->created_at ? $p->created_at->toDateTimeString() : null,
            'proof_url' => $p->proof_url ?? null,
            'proof_url_full' => $proofUrlFull,
            'meta' => $meta,
        ];
    }

    /**
     * GET /api/admin/dashboard
     * Returns dashboard metrics.
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
     */
    public function users(Request $request)
    {
        $this->ensureAdmin($request->user());

        $role = $request->query('role', null);
        $isActive = $request->query('is_active', null);
        $excludeAdmin = $request->query('exclude_admin', false);

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
            ->with(['location:id,name']);

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
     */
    public function saveProduct(Request $request)
    {
        $this->ensureAdmin($request->user());

        $rules = [
            'id' => 'nullable|exists:products,id',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'price' => 'required|numeric',
            'category_id' => 'required|exists:categories,id',
            'stock' => 'required|integer|min:0',
            'image_url' => 'nullable|string',
            'image' => 'nullable|image|max:5120',
        ];

        $data = $request->validate($rules);

        $storedPath = null;
        if ($request->hasFile('image')) {
            try {
                $storedPath = $request->file('image')->store('products', 'public');
            } catch (Exception $e) {
                Log::error('Product image store failed: ' . $e->getMessage());
                return response()->json(['message' => 'Failed to store image'], 500);
            }
        }

        if (!empty($data['id'])) {
            $prod = Product::findOrFail($data['id']);

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
                if (!array_key_exists('image_url', $data) || $data['image_url'] === null) {
                    unset($data['image_url']);
                }
            }

            $prod->update($data);
            return response()->json(['success' => true, 'product' => $prod->fresh()], 200);
        }

        if ($storedPath) {
            $data['image_url'] = $storedPath;
        } else {
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
     */
    public function orders(Request $request)
    {
        $this->ensureAdmin($request->user());

        $q = Order::with(['user:id,name,phone_number','items.product','delivery']);
        if ($request->has('status')) $q->where('status', $request->get('status'));
        $orders = $q->orderBy('created_at','desc')->paginate(20);
        return response()->json($orders);
    }

    /**
     * POST /api/admin/orders/{id}/status
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
 * GET /api/admin/delivery-people
 * Return list of users with role 'delivery'
 */
public function deliveryPeople(Request $request)
{
    $this->ensureAdmin($request->user());
    $people = User::where('role','delivery')
                  ->where('is_active',1)
                  ->select('id','name','phone_number','email')
                  ->orderBy('name','asc')
                  ->get();
    return response()->json(['data' => $people], 200);
}

/**
 * POST /api/admin/deliveries/{id}/assign
 * body: { delivery_person_id: <user id> }
 */
public function assignDelivery(Request $request, $id)
{
    $this->ensureAdmin($request->user());

    $data = $request->validate([
        'delivery_person_id' => 'required|exists:users,id',
    ]);

    $delivery = Delivery::findOrFail($id);
    $deliveryPerson = User::findOrFail($data['delivery_person_id']);

    // ensure selected user is a delivery person
    if ($deliveryPerson->role !== 'delivery' || ! $deliveryPerson->is_active) {
        return response()->json(['message' => 'Selected user is not an active delivery person'], 422);
    }

    // attach person (critical DB save happens first)
    $delivery->delivery_person_id = $deliveryPerson->id;
    $delivery->delivery_person = $deliveryPerson->name;

    // keep existing behaviour for status to avoid breaking other code
    if (in_array($delivery->status, ['pending'])) {
        $delivery->status = 'pending';
    }

    // Save immediately — if this fails Laravel will return an error and nothing else runs
    $delivery->save();

    // Defensive: load order with relations if available (for notifications / email content)
    $order = $delivery->order ?? Order::with('items.product','user')->find($delivery->order_id ?? null);

    // Create in-app notifications (do not allow notification failures to break the response)
    try {
        // Notify delivery person (in-app)
        Notification::create([
            'user_id' => $deliveryPerson->id,
            'title' => 'New Delivery Assigned',
            'message' => 'You have been assigned delivery for order #' . ($order->order_id ?? $delivery->order_id ?? 'N/A'),
        ]);

        // Notify customer (in-app) if order user exists
        $customerId = $order->user_id ?? ($delivery->order->user_id ?? null);
        if ($customerId) {
            Notification::create([
                'user_id' => $customerId,
                'title' => 'Delivery Assigned',
                'message' => 'Your order #' . ($order->order_id ?? $delivery->order_id ?? 'N/A') . ' has been assigned to ' . $deliveryPerson->name . '.',
            ]);
        }
    } catch (\Throwable $notifyEx) {
        Log::warning('Failed to create in-app notifications for delivery assign: ' . $notifyEx->getMessage());
    }

    // Send email to delivery person (non-blocking). IMPORTANT: when queue driver is "sync" we will NOT attempt an SMTP send.
    try {
        // Build the mailable (ensure class exists: App\Mail\DeliveryAssigned)
        $mailable = new \App\Mail\DeliveryAssigned($order, $delivery, $deliveryPerson);

        if ($deliveryPerson && !empty($deliveryPerson->email)) {
            if (config('queue.default') !== 'sync') {
                // Normal path: queue the mail
                Mail::to($deliveryPerson->email)->queue($mailable);
            } else {
                // Dev/local sync mode: avoid SMTP (which can throw). Render and log the email content instead.
                try {
                    // render() will produce the HTML body (may throw if view missing — catch below)
                    $rendered = method_exists($mailable, 'render') ? $mailable->render() : null;
                    Log::info('DeliveryAssigned email suppressed in sync mode', [
                        'to' => $deliveryPerson->email,
                        'subject' => (property_exists($mailable, 'subject') ? $mailable->subject : null),
                        'rendered_html_preview' => $rendered ? substr($rendered, 0, 2000) : null,
                    ]);
                } catch (\Throwable $renderEx) {
                    Log::warning('Failed to render DeliveryAssigned mailable for logging: ' . $renderEx->getMessage());
                }
            }
        }
    } catch (\Throwable $mailEx) {
        // Always catch and log; do not rethrow — email is best-effort
        Log::warning('Failed to queue/send delivery assignment email to user id ' . ($deliveryPerson->id ?? 'n/a') . ': ' . $mailEx->getMessage());
    }

    // Return success and the delivery (include deliveryPerson relationship)
    return response()->json(['success' => true, 'delivery' => $delivery->load('deliveryPerson')], 200);
}

/**
 * POST /api/admin/deliveries/{id}/unassign
 */
public function unassignDelivery(Request $request, $id)
{
    $this->ensureAdmin($request->user());

    $delivery = Delivery::findOrFail($id);
    $delivery->delivery_person_id = null;
    $delivery->delivery_person = null;
    // optionally reset status to pending
    $delivery->status = 'pending';
    $delivery->save();

    return response()->json(['success' => true, 'delivery' => $delivery], 200);
}

/**
 * POST /api/admin/deliveries/{id}/complete
 */
public function completeDelivery(Request $request, $id)
{
    $this->ensureAdmin($request->user());

    $delivery = Delivery::findOrFail($id);
    $delivery->status = 'completed';
    $delivery->save();

    // update order status as well (if you want)
    $order = $delivery->order;
    if ($order) {
        $order->update(['status' => 'delivered']);
    }

    Notification::create([
        'user_id' => $order->user_id,
        'title' => 'Order Delivered',
        'message' => "Your order #{$order->order_id} was delivered.",
    ]);

    return response()->json(['success' => true, 'delivery' => $delivery], 200);
}


    /**
     * GET /api/admin/payments
     * Paginated and normalized for frontend consumption.
     */
    public function payments(Request $request)
    {
        $this->ensureAdmin($request->user());

        $q = Payment::with(['user:id,name,email'])->orderBy('created_at','desc');
        if ($request->has('status')) $q->where('status', $request->get('status'));

        $paymentsPaginated = $q->paginate(25);

        $mapped = $paymentsPaginated->getCollection()->map(function ($p) {
            return $this->paymentToArray($p);
        })->all();

        // preserve pagination meta
        $meta = [
            'current_page' => $paymentsPaginated->currentPage(),
            'last_page' => $paymentsPaginated->lastPage(),
            'per_page' => $paymentsPaginated->perPage(),
            'total' => $paymentsPaginated->total(),
        ];

        return response()->json(['data' => $mapped, 'meta' => $meta], 200);
    }

    /**
     * POST /api/admin/payments/{id}/approve
     * Admin approves a payment (manual proof). Uses payment.meta.cart_snapshot when present.
     */
    public function approvePayment(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        $payment = Payment::find($id);
        if (! $payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($payment->status === 'success') {
            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            return response()->json(['message' => 'Payment already approved', 'payment' => $this->paymentToArray($payment), 'meta' => $meta], 200);
        }

        DB::beginTransaction();
        try {
            // mark success (we will roll back if anything fails)
            $payment->status = 'success';
            $payment->save();

            $user = $payment->user;
            if (! $user) {
                DB::rollBack();
                return response()->json(['message' => 'Payment approved but payment has no associated user'], 400);
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

                // queue/send email to customer for the existing order (non-blocking)
                try {
                    if ($user && !empty($user->email)) {
                        if (config('queue.default') === 'sync') {
                            Mail::to($user->email)->send(new OrderPlaced($existing));
                        } else {
                            Mail::to($user->email)->queue(new OrderPlaced($existing));
                        }
                    }
                } catch (\Throwable $mailEx) {
                    Log::warning('Failed to queue/send order email after admin approve for existing order ' . ($existing->id ?? 'n/a') . ': ' . $mailEx->getMessage());
                }

                return response()->json(['message' => 'Payment approved; existing order found', 'order' => $existing], 200);
            }

            // decode meta safely
            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            $cartSnapshot = $meta['cart_snapshot'] ?? null;
            $cartTotalFromMeta = isset($meta['cart_total']) ? floatval($meta['cart_total']) : null;

            // read delivery_fee from meta (default 0)
            $deliveryFeeFromMeta = isset($meta['delivery_fee']) ? floatval($meta['delivery_fee']) : 0.0;

            if ($cartSnapshot && is_array($cartSnapshot) && count($cartSnapshot) > 0) {
                // Use snapshot to check stock and compute total
                $total = 0;
                $insufficient = [];

                foreach ($cartSnapshot as $ci) {
                    // support both qty and quantity keys in snapshot
                    $qty = isset($ci['qty']) ? intval($ci['qty']) : (isset($ci['quantity']) ? intval($ci['quantity']) : 0);
                    $productRow = DB::table('products')->where('id', $ci['product_id'])->lockForUpdate()->first();
                    if (!$productRow) {
                        DB::rollBack();
                        return response()->json(['success' => false, 'message' => "Product (ID {$ci['product_id']}) not found"], 400);
                    }
                    $currentStock = intval($productRow->stock ?? 0);
                    if ($currentStock < $qty) {
                        $insufficient[] = [
                            'product_id' => $ci['product_id'],
                            'available' => $currentStock,
                            'requested' => $qty,
                        ];
                    }
                    $total += floatval($ci['price']) * $qty;
                }

                if (!empty($insufficient)) {
                    $meta['approval_issue'] = ['type' => 'stock', 'items' => $insufficient];
                    $payment->meta = $meta;
                    $payment->save();
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => 'Some items are out of stock', 'items' => $insufficient], 409);
                }

                // include delivery fee into expected total
                $totalWithFee = floatval($total) + floatval($deliveryFeeFromMeta);

                // verify the payment amount matches snapshot total + fee
                if (floatval($payment->amount) != floatval($totalWithFee)) {
                    $meta['amount_mismatch'] = [
                        'payment' => $payment->amount,
                        'snapshot_total' => $total,
                        'delivery_fee' => $deliveryFeeFromMeta,
                        'expected_total' => $totalWithFee
                    ];
                    $payment->meta = $meta;
                    $payment->save();
                    DB::rollBack();
                    return response()->json(['message' => 'Amount mismatch', 'meta' => $meta], 422);
                }

                // create order from snapshot (include delivery_fee)
                $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));
                $order = Order::create([
                    'order_id' => $orderId,
                    'user_id' => $user->id,
                    'total' => $totalWithFee,
                    'delivery_fee' => $deliveryFeeFromMeta,
                    'delivery_address' => data_get($payment->meta, 'delivery_address') ?? null,
                    'status' => 'pending_delivery',
                    'payment_ref' => $payment->tx_ref,
                ]);

                foreach ($cartSnapshot as $ci) {
                    $qty = isset($ci['qty']) ? intval($ci['qty']) : (isset($ci['quantity']) ? intval($ci['quantity']) : 0);
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $ci['product_id'],
                        'quantity' => $qty,
                        'price' => $ci['price'],
                    ]);

                    DB::table('products')->where('id', $ci['product_id'])->decrement('stock', $qty);
                }

                // If the user's current cart exactly matches the snapshot, clear it. Otherwise preserve it.
                $cart = Cart::where('user_id', $user->id)->with('items')->first();
                $shouldClearCart = false;
                if ($cart && $cart->items->isNotEmpty()) {
                    $currentMap = [];
                    foreach ($cart->items as $ci) {
                        $currentMap[intval($ci->product_id)] = intval($ci->quantity);
                    }
                    $snapMap = [];
                    foreach ($cartSnapshot as $s) {
                        $snapQty = isset($s['qty']) ? intval($s['qty']) : (isset($s['quantity']) ? intval($s['quantity']) : 0);
                        $snapMap[intval($s['product_id'])] = $snapQty;
                    }
                    if (count($currentMap) === count($snapMap)) {
                        $allEqual = true;
                        foreach ($snapMap as $pid => $qty) {
                            if (!isset($currentMap[$pid]) || $currentMap[$pid] !== $qty) {
                                $allEqual = false;
                                break;
                            }
                        }
                        if ($allEqual) {
                            $shouldClearCart = true;
                        }
                    }
                }
                if ($shouldClearCart && $cart) {
                    $cart->items()->delete();
                }

                // create delivery record
                $verificationCode = strtoupper(Str::random(6));
                Delivery::create([
                    'order_id' => $order->id,
                    'delivery_person' => null,
                    'status' => 'pending',
                    'verification_code' => $verificationCode
                ]);

                Notification::create([
                    'user_id' => $user->id,
                    'title' => 'Order Placed',
                    'message' => "Your order #{$order->order_id} has been placed (admin-approved payment)."
                ]);

                $meta['order_id'] = $order->order_id;
                $payment->meta = $meta;
                $payment->save();

                DB::commit();

                // queue/send email to customer for the newly created order (non-blocking)
                try {
                    if ($user && !empty($user->email)) {
                        if (config('queue.default') === 'sync') {
                            Mail::to($user->email)->send(new OrderPlaced($order));
                        } else {
                            Mail::to($user->email)->queue(new OrderPlaced($order));
                        }
                    }
                } catch (\Throwable $mailEx) {
                    Log::warning('Failed to queue/send order email after admin approve (snapshot) for order ' . ($order->id ?? 'n/a') . ': ' . $mailEx->getMessage());
                }

                return response()->json(['message' => 'Payment approved and order created', 'order' => $order, 'payment' => $this->paymentToArray($payment)], 200);
            }

            // Fallback: no snapshot — use user's current cart (legacy behavior)
            $cart = Cart::where('user_id', $user->id)->with('items.product')->first();
            if (! $cart || $cart->items->isEmpty()) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['note'] = ($meta['note'] ?? '') . ' | No cart found to auto-place order';
                $payment->meta = $meta;
                $payment->save();
                DB::commit();
                return response()->json(['message' => 'Payment marked success but user cart empty; manual placement required.'], 200);
            }

            $total = 0;
            foreach ($cart->items as $ci) {
                $total += ($ci->product->price * $ci->quantity);
            }

            // include any delivery fee from payment meta
            $totalWithFee = floatval($total) + floatval($deliveryFeeFromMeta);

            if (floatval($payment->amount) != floatval($totalWithFee)) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
                $meta['amount_mismatch'] = [
                    'payment' => $payment->amount,
                    'cart_total' => $total,
                    'delivery_fee' => $deliveryFeeFromMeta,
                    'expected_total' => $totalWithFee
                ];
                $payment->meta = $meta;
                $payment->save();

                DB::rollBack();
                return response()->json(['message' => 'Amount mismatch between payment and cart total. Auto-place aborted.', 'meta' => $meta], 422);
            }

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

            $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));

            $order = Order::create([
                'order_id' => $orderId,
                'user_id' => $user->id,
                'total' => $totalWithFee,
                'delivery_fee' => $deliveryFeeFromMeta,
                'delivery_address' => data_get($payment->meta, 'delivery_address') ?? null,
                'status' => 'pending_delivery',
                'payment_ref' => $payment->tx_ref,
            ]);

            foreach ($cart->items as $ci) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $ci->product_id,
                    'quantity' => $ci->quantity,
                    'price' => $ci->product->price,
                ]);

                DB::table('products')->where('id', $ci->product_id)->decrement('stock', $ci->quantity);
            }

            $verificationCode = strtoupper(Str::random(6));
            Delivery::create([
                'order_id' => $order->id,
                'delivery_person' => null,
                'status' => 'pending',
                'verification_code' => $verificationCode
            ]);

            $cart->items()->delete();

            Notification::create([
                'user_id' => $user->id,
                'title' => 'Order Placed',
                'message' => "Your order #{$order->order_id} has been placed (admin-approved payment)."
            ]);

            $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
            $meta['order_id'] = $order->order_id;
            $payment->meta = $meta;
            $payment->save();

            DB::commit();

            // queue/send email to customer for the newly created order (non-blocking)
            try {
                if ($user && !empty($user->email)) {
                    if (config('queue.default') === 'sync') {
                        Mail::to($user->email)->send(new OrderPlaced($order));
                    } else {
                        Mail::to($user->email)->queue(new OrderPlaced($order));
                    }
                }
            } catch (\Throwable $mailEx) {
                Log::warning('Failed to queue/send order email after admin approve (cart fallback) for order ' . ($order->id ?? 'n/a') . ': ' . $mailEx->getMessage());
            }

            return response()->json(['message' => 'Payment approved and order created', 'order' => $order, 'payment' => $this->paymentToArray($payment)], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('admin.approvePayment error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to approve payment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
 * POST /api/admin/payments/{id}/reject
 * Admin rejects a payment (manual rejection).
 * Body: { reason?: string }
 */
public function rejectPayment(Request $request, $id)
{
    $this->ensureAdmin($request->user());

    $data = $request->validate([
        'reason' => 'nullable|string|max:1000',
    ]);

    $payment = Payment::find($id);
    if (! $payment) {
        return response()->json(['message' => 'Payment not found'], 404);
    }

    // If already failed, return early
    if ($payment->status === 'failed') {
        $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
        return response()->json(['message' => 'Payment already rejected', 'payment' => $this->paymentToArray($payment), 'meta' => $meta], 200);
    }

    DB::beginTransaction();
    try {
        $payment->status = 'failed';

        // update meta safely
        $meta = is_array($payment->meta) ? $payment->meta : (json_decode($payment->meta ?? '[]', true) ?: []);
        $meta['rejected_by_admin_id'] = $request->user()->id ?? null;
        $meta['rejected_reason'] = $data['reason'] ?? null;
        $meta['rejected_at'] = now()->toDateTimeString();
        $payment->meta = $meta;
        $payment->save();

        // notify user if present
        if ($payment->user_id) {
            Notification::create([
                'user_id' => $payment->user_id,
                'title' => 'Payment rejected',
                'message' => 'Your payment (' . ($payment->tx_ref ?? '') . ') was rejected by admin.' . ($data['reason'] ? ' Reason: ' . $data['reason'] : ''),
            ]);
        }

        DB::commit();

        return response()->json(['success' => true, 'message' => 'Payment rejected', 'payment' => $this->paymentToArray($payment)], 200);
    } catch (\Throwable $e) {
        DB::rollBack();
        Log::error('admin.rejectPayment error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
        return response()->json(['message' => 'Failed to reject payment'], 500);
    }
}


    /**
     * POST /api/admin/notify
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
     * List locations with optional search and filters.
     * Query params:
     *  - q: search by name or address
     *  - is_active: 0|1
     *  - per_page: integer (use per_page=0 for all)
     */
    public function locations(Request $request)
    {
        $this->ensureAdmin($request->user());

        try {
            $q = Location::query();

            if ($request->has('q')) {
                $term = trim($request->get('q'));
                $q->where(function ($sub) use ($term) {
                    $sub->where('name', 'like', "%{$term}%")
                        ->orWhere('address', 'like', "%{$term}%")
                        ->orWhere('slug', 'like', "%{$term}%");
                });
            }

            if ($request->has('is_active')) {
                $isActive = $request->get('is_active') ? 1 : 0;
                $q->where('is_active', $isActive);
            }

            // ordering
            $q->orderBy('name', 'asc');

            $perPage = intval($request->get('per_page', 30));
            if ($perPage <= 0) {
                // return all
                $locations = $q->get();
                return response()->json(['data' => $locations], 200);
            }

            $perPage = min(200, max(5, $perPage)); // clamp
            $paginated = $q->paginate($perPage);

            return response()->json($paginated, 200);
        } catch (\Throwable $e) {
            Log::error('Admin.locations error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load locations'], 500);
        }
    }

    /**
     * GET /api/admin/locations/{id}
     */
    public function showLocation(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        try {
            $loc = Location::findOrFail($id);
            return response()->json(['data' => $loc], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Location not found'], 404);
        } catch (\Throwable $e) {
            Log::error('Admin.showLocation error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load location'], 500);
        }
    }

    /**
     * POST /api/admin/locations
     * Create a new location
     */
    public function createLocation(Request $request)
    {
        $this->ensureAdmin($request->user());

        $data = $request->validate([
            'name' => 'required|string|max:255|unique:locations,name',
            'slug' => 'nullable|string|max:255|unique:locations,slug',
            'type' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'radius_km' => 'nullable|numeric',
            'delivery_fee' => 'nullable|numeric',
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:255', 
            'is_active' => 'nullable|boolean',
            'polygon_coordinates' => ['nullable'], // accept json string or array; validate below
        ]);

        try {
            // Normalize polygon_coordinates: accept array or JSON string
            if ($request->has('polygon_coordinates')) {
                $pc = $request->input('polygon_coordinates');
                if (is_array($pc)) {
                    $data['polygon_coordinates'] = json_encode($pc);
                } elseif (is_string($pc) && strlen(trim($pc)) > 0) {
                    // verify valid JSON
                    $decoded = json_decode($pc, true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        $data['polygon_coordinates'] = json_encode($decoded);
                    } else {
                        return response()->json(['message' => 'polygon_coordinates must be valid JSON or an array'], 422);
                    }
                } else {
                    $data['polygon_coordinates'] = null;
                }
            }

            // coerce numeric defaults
            $data['delivery_fee'] = isset($data['delivery_fee']) ? floatval($data['delivery_fee']) : 0.0;
            $data['radius_km'] = isset($data['radius_km']) ? floatval($data['radius_km']) : null;
            $data['latitude'] = isset($data['latitude']) ? floatval($data['latitude']) : null;
            $data['longitude'] = isset($data['longitude']) ? floatval($data['longitude']) : null;
            $data['is_active'] = isset($data['is_active']) ? boolval($data['is_active']) : true;

            $loc = Location::create($data);

            return response()->json(['success' => true, 'location' => $loc], 201);
        } catch (\Throwable $e) {
            Log::error('Admin.createLocation error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create location'], 500);
        }
    }

    /**
     * PUT /api/admin/locations/{id}
     * Update an existing location
     */
    public function updateLocation(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        try {
            $loc = Location::findOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Location not found'], 404);
        }

        $data = $request->validate([
            'name' => ['nullable','string','max:255', Rule::unique('locations','name')->ignore($loc->id)],
            'slug' => ['nullable','string','max:255', Rule::unique('locations','slug')->ignore($loc->id)],
            'type' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'radius_km' => 'nullable|numeric',
            'delivery_fee' => 'nullable|numeric',
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
            'polygon_coordinates' => ['nullable'], // validate below
        ]);

        try {
            if ($request->has('polygon_coordinates')) {
                $pc = $request->input('polygon_coordinates');
                if (is_array($pc)) {
                    $data['polygon_coordinates'] = json_encode($pc);
                } elseif (is_string($pc) && strlen(trim($pc)) > 0) {
                    $decoded = json_decode($pc, true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        $data['polygon_coordinates'] = json_encode($decoded);
                    } else {
                        return response()->json(['message' => 'polygon_coordinates must be valid JSON or an array'], 422);
                    }
                } else {
                    $data['polygon_coordinates'] = null;
                }
            }

            if (isset($data['delivery_fee'])) $data['delivery_fee'] = floatval($data['delivery_fee']);
            if (isset($data['radius_km'])) $data['radius_km'] = floatval($data['radius_km']);
            if (isset($data['latitude'])) $data['latitude'] = floatval($data['latitude']);
            if (isset($data['longitude'])) $data['longitude'] = floatval($data['longitude']);
            if (isset($data['is_active'])) $data['is_active'] = boolval($data['is_active']);

            $loc->update($data);

            return response()->json(['success' => true, 'location' => $loc->fresh()], 200);
        } catch (\Throwable $e) {
            Log::error('Admin.updateLocation error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update location'], 500);
        }
    }

    /**
     * DELETE /api/admin/locations/{id}
     */
    public function deleteLocation(Request $request, $id)
    {
        $this->ensureAdmin($request->user());

        try {
            $loc = Location::findOrFail($id);
            $loc->delete();
            return response()->json(['success' => true, 'message' => 'Location deleted'], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Location not found'], 404);
        } catch (\Throwable $e) {
            Log::error('Admin.deleteLocation error: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to delete location'], 500);
        }
    }

    /**
 * GET /api/admin/summary
 * Quick counts for admin badges:
 *  - pending_proofs: payments that are pending and have a proof_url (need admin attention)
 *  - orders_unassigned: orders without an assigned delivery person (needs assignment)
 */
public function summary(Request $request)
{
    $this->ensureAdmin($request->user());

    try {
        // payments: pending + proof uploaded
        $pendingProofs = Payment::where('status', 'pending')
            ->whereNotNull('proof_url')
            ->count();

        // orders without an assigned delivery person:
        // count orders for which there is NOT a delivery with a non-null delivery_person_id
        $ordersUnassigned = Order::whereDoesntHave('delivery', function ($q) {
            $q->whereNotNull('delivery_person_id');
        })->count();

        return response()->json([
            'pending_proofs' => (int) $pendingProofs,
            'orders_unassigned' => (int) $ordersUnassigned,
        ], 200);
    } catch (\Throwable $e) {
        \Log::error('Admin.summary error: ' . $e->getMessage());
        return response()->json(['message' => 'Failed to load admin summary'], 500);
    }
}

}
