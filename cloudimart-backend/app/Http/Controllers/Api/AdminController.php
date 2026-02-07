<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Product;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Delivery;
use App\Models\Transaction;
use App\Models\Notification;
use App\Models\Location;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

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
     *  - pagination
     */
    public function users(Request $request)
    {
        $this->ensureAdmin($request->user());

        $role = $request->query('role', null);
        $isActive = $request->query('is_active', null);

        $q = User::query()->select('id','name','email','phone_number','role','is_active','created_at');

        if ($role) {
            $q->where('role', $role);
        }

        if (!is_null($isActive)) {
            $q->where('is_active', intval($isActive));
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
     */
    public function saveProduct(Request $request)
    {
        $this->ensureAdmin($request->user());

        $data = $request->validate([
            'id' => 'nullable|exists:products,id',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'price' => 'required|numeric',
            'category_id' => 'required|exists:categories,id',
            'stock' => 'required|integer|min:0',
            'image_url' => 'nullable|string',
        ]);

        if (!empty($data['id'])) {
            $prod = Product::findOrFail($data['id']);
            $prod->update($data);
            return response()->json(['success'=>true,'product'=>$prod]);
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
     * Payments listing
     */
    public function payments(Request $request)
    {
        $this->ensureAdmin($request->user());

        $q = Payment::orderBy('created_at','desc');
        if ($request->has('status')) $q->where('status', $request->get('status'));
        $payments = $q->paginate(25);
        return response()->json($payments);
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
