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

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
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

// Public webhook (PayChangu will call this)
//Route::post('/payment/callback', [PaymentController::class, 'handleCallback'])->name('api.payment.callback');
//Route::post('/payment/callback', [PaymentController::class, 'callback'])->name('payment.callback');

// ============================
// 🔒 PROTECTED ROUTES (Require Login)
// ============================
Route::middleware('auth:sanctum')->group(function () {

    // Get logged-in user
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // --- 🛒 Cart Management --- //
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/add', [CartController::class, 'add']);
    Route::put('/cart/item/{id}', [CartController::class, 'update']);
    Route::delete('/cart/item/{id}', [CartController::class, 'remove']);
    // optional: cart count endpoint (if implemented in controller)
    Route::get('/cart/count', [CartController::class, 'count']);

    // --- 💳 Payments --- //
    Route::post('/payment/initiate', [PaymentController::class, 'initiate']);
    Route::get('/payment/status', [PaymentController::class, 'status']);

    // --- 💳 Checkout + Orders --- //
    // Validate location (server-side) before placing order
    Route::post('/checkout/validate-location', [CheckoutController::class, 'validateLocation']);

    // Place order (two convenient routes pointing to the same handler)
    Route::post('/checkout/place-order', [CheckoutController::class, 'placeOrder']);
    Route::post('/orders', [CheckoutController::class, 'placeOrder']);

    // Orders listing / count for the logged-in user
    Route::get('/orders', [OrdersController::class, 'index']);
    Route::get('/orders/count', [OrdersController::class, 'count']);

    // --- 🔔 Notifications (in-app) --- //
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    // --- Unread notifications count (for badge) --- //
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);


    // --- 🚚 Delivery Verification --- //
    Route::post('/delivery/verify', [DeliveryController::class, 'verify']);

});
