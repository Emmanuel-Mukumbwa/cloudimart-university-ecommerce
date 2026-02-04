<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\LocationService;

class AuthController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(Request $request)
    {
        $request->validate([
            'name'         => 'required|string|max:255',
            'email'        => 'required|string|email|max:255|unique:users',
            'password'     => 'required|string|min:6|confirmed',
            'phone_number' => 'nullable|string|max:20',
            'location_id'  => 'required|exists:locations,id',
            'latitude'     => 'nullable|numeric',
            'longitude'    => 'nullable|numeric',
        ]);

        try {
            // Determine if the user's provided coordinates are within a valid delivery zone
            $location_verified = false;

            if (
                $request->filled('latitude') &&
                $request->filled('longitude') &&
                $request->filled('location_id')
            ) {
                $locationService = app(LocationService::class);

                // Check if user coordinates are inside any allowed polygon
                $matches = $locationService->isWithinDeliveryZone(
                    (float) $request->latitude,
                    (float) $request->longitude
                );

                // You can optionally refine this to verify against the selected location polygon only
                $location_verified = $matches;
            }

            // Use transaction to ensure data integrity
            $user = DB::transaction(function () use ($request, $location_verified) {
                return User::create([
                    'name'                 => $request->name,
                    'email'                => $request->email,
                    'password'             => Hash::make($request->password),
                    'phone_number'         => $request->phone_number,
                    'location_id'          => $request->location_id,
                    'latitude'             => $request->latitude,
                    'longitude'            => $request->longitude,
                    'location_verified_at' => $location_verified ? now() : null,
                ]);
            });

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'success'        => true,
                'message'        => 'User registered successfully',
                'user'           => $user,
                'access_token'   => $token,
                'token_type'     => 'Bearer',
                'location_status'=> $user->location_verified_at ? 'verified' : 'unverified',
            ], 201);
        } catch (\Throwable $e) {
            Log::error('User registration failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Registration failed. Check server logs.',
            ], 500);
        }
    }

    /**
     * Login an existing user.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required'
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.']
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success'        => true,
            'message'        => 'Login successful',
            'user'           => $user,
            'access_token'   => $token,
            'token_type'     => 'Bearer',
            'location_status'=> $user->location_verified_at ? 'verified' : 'unverified',
        ]);
    }
}
