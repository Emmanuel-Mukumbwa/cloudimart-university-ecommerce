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

// ============================
// 📍 PUBLIC ROUTES
// ============================

// Locations (for dropdown + GPS validation)
Route::get('/locations', [LocationController::class, 'index']);
Route::post('/locations/validate', [LocationController::class, 'validatePoint']);

// Authentication
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Products & Categories (public browsing)
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{id}', [ProductController::class, 'show']);

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

    // --- 💳 Checkout + Orders --- //
    Route::post('/checkout/validate-location', [CheckoutController::class, 'validateLocation']);
    Route::post('/orders', [CheckoutController::class, 'placeOrder']);

    // --- 🚚 Delivery Verification --- //
    Route::post('/delivery/verify', [DeliveryController::class, 'verify']);
});


