<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ==== Controllers ==== //
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\OrdersController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\AdminController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| These routes handle authentication, payments, orders, deliveries, and
| admin functionality for Cloudimart. Sanctum authentication ensures
| secure access. Role middleware limits routes to specific roles.
|--------------------------------------------------------------------------
*/

// ============================
// 📍 PUBLIC ROUTES
// ============================

// Locations (for dropdown + GPS validation)
Route::get('/locations', [LocationController::class, 'index']);
Route::get('/locations/{id}', [LocationController::class, 'show']);
Route::post('/locations/validate', [LocationController::class, 'validatePoint']);

// Authentication
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Products & Categories (public browsing)
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{id}', [ProductController::class, 'show']);

// Public webhook (PayChangu callback)
/// Route::post('/payment/callback', [PaymentController::class, 'callback'])->name('payment.callback');

// ============================
// 🔒 PROTECTED ROUTES (Require Login)
// ============================
Route::middleware('auth:sanctum')->group(function () {

    // --- 👤 Get logged-in user --- //
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // --- 🛒 Cart Management --- //
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/add', [CartController::class, 'add']);
    Route::put('/cart/item/{id}', [CartController::class, 'update']);
    Route::delete('/cart/item/{id}', [CartController::class, 'remove']);
    Route::get('/cart/count', [CartController::class, 'count']); // optional

    // --- 💳 Payments --- //
    Route::post('/payment/initiate', [PaymentController::class, 'initiate']);
    Route::get('/payment/status', [PaymentController::class, 'status']);

    // --- 🧾 Checkout + Orders --- //
    Route::post('/checkout/validate-location', [CheckoutController::class, 'validateLocation']);
    Route::post('/checkout/place-order', [CheckoutController::class, 'placeOrder']);
    Route::post('/orders', [CheckoutController::class, 'placeOrder']); // alias
    Route::get('/orders', [OrdersController::class, 'index']);
    Route::get('/orders/count', [OrdersController::class, 'count']);

    // --- 🔔 Notifications (in-app) --- //
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);

    // --- 🚚 Delivery Verification (Accessible by logged-in delivery role) --- //
    Route::post('/delivery/verify', [DeliveryController::class, 'verify']);
});

// ============================
// 🧑‍💼 ADMIN ROUTES
// ============================
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/orders', [AdminController::class, 'orders']);
    Route::post('/admin/orders/{id}/status', [AdminController::class, 'updateOrderStatus']);
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
    // add more admin features here later (user management, reports, etc.)
});

// ============================
// 🚚 DELIVERY ROUTES
// ============================
Route::middleware(['auth:sanctum', 'role:delivery'])->group(function () {
    Route::get('/delivery/dashboard', [DeliveryController::class, 'dashboard']);
    Route::post('/delivery/orders/{id}/complete', [DeliveryController::class, 'completeOrder']);
    // Reuse verify endpoint from above or override behavior if needed
});
