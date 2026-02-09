<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request; 
use App\Models\User;
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

                // Optionally refine to match selected location polygon only
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
                    'role'                 => 'user', // ensure default role
                ]);
            });

            // create token
            $token = $user->createToken('api-token')->plainTextToken;

            return response()->json([
                'success'         => true,
                'message'         => 'User registered successfully',
                'user'            => $user,
                'token'           => $token,
                'token_type'      => 'Bearer',
                'redirect_url'    => $this->redirectForRole($user->role),
                'location_status' => $user->location_verified_at ? 'verified' : 'unverified',
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

        // revoke previous tokens optionally (uncomment if you want only single-session)
        // $user->tokens()->delete();

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'success'         => true,
            'message'         => 'Login successful',
            'user'            => $user,
            'token'           => $token,
            'token_type'      => 'Bearer',
            'redirect_url'    => $this->redirectForRole($user->role),
            'location_status' => $user->location_verified_at ? 'verified' : 'unverified',
        ]);
    }

    /**
     * Logout (revoke current token)
     */
    public function logout(Request $request)
    {
        try {
            $user = $request->user();
            if ($user && $request->user()->currentAccessToken()) {
                $request->user()->currentAccessToken()->delete();
            }
            return response()->json(['success' => true, 'message' => 'Logged out']);
        } catch (\Throwable $e) {
            Log::error('Logout error', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Failed to logout'], 500);
        }
    }

    /**
     * Map role to a frontend path
     */
    protected function redirectForRole(string $role): string
    {
        return match ($role) {
            'admin' => '/admin/dashboard',
            'delivery' => '/delivery/dashboard',
            default => '/', // normal user -> home
        };
    }
}
