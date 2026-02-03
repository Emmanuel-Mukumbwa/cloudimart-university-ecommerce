<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LocationController;

// Public: locations for dropdown
Route::get('/locations', [LocationController::class, 'index']);

// Auth
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Protected example
Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});
