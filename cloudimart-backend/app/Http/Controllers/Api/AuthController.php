<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Location;
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
            'postVerificationAction' => 'nullable|string',
        ]);

        try {
            $lat = $request->input('latitude', null);
            $lng = $request->input('longitude', null);
            $selectedLocationId = (int) $request->input('location_id');

            // Require coordinates to be present (frontend should provide them)
            if ($lat === null || $lng === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Coordinates (latitude and longitude) are required to register.',
                ], 422);
            }

            // Load and validate selected location
            $selectedLocation = Location::find($selectedLocationId);
            if (! $selectedLocation || ! $selectedLocation->is_active || ! $selectedLocation->is_deliverable) {
                return response()->json([
                    'success' => false,
                    'message' => 'Selected location is not available for delivery registration.',
                ], 422);
            }

            // Use LocationService to check whether the coordinates match the selected location.
            $locationService = app(LocationService::class);

            $matchesSelected = false;
            $distanceKm = null;

            // 1) If selected location has polygon coordinates, prefer point-in-polygon.
            $poly = null;
            if (!empty($selectedLocation->polygon_coordinates)) {
                // polygon might be stored as JSON string or cast to array — handle both
                if (is_array($selectedLocation->polygon_coordinates)) {
                    $poly = $selectedLocation->polygon_coordinates;
                } else {
                    $poly = json_decode($selectedLocation->polygon_coordinates, true);
                }

                if (!empty($poly) && is_array($poly)) {
                    $matchesSelected = $locationService->pointInPolygon((float)$lat, (float)$lng, $poly);
                }
            }

            // 2) Otherwise check radius (if radius + center exists)
            if (! $matchesSelected) {
                if (!is_null($selectedLocation->latitude) && !is_null($selectedLocation->longitude) && !is_null($selectedLocation->radius_km)) {
                    $distanceKm = $locationService->haversineDistance((float)$lat, (float)$lng, (float)$selectedLocation->latitude, (float)$selectedLocation->longitude);
                    if ($distanceKm <= (float)$selectedLocation->radius_km) {
                        $matchesSelected = true;
                    }
                }
            }

            // If coordinates don't match the selected location - reject registration
            if (! $matchesSelected) {
                $payload = [
                    'success' => false,
                    'message' => 'Your coordinates are outside the configured delivery zone for the selected location.',
                ];
                if ($distanceKm !== null) {
                    $payload['distance_km'] = round($distanceKm, 3);
                    $payload['allowed_radius_km'] = (float) $selectedLocation->radius_km;
                }
                return response()->json($payload, 422);
            }

            // Optional: double-check coordinates fall within at least one active zone (polygon or radius)
            // (useful if you have other zones that might overlap or additional polygons)
            $isWithinAny = $locationService->isWithinDeliveryZone((float)$lat, (float)$lng);
            if (! $isWithinAny) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your coordinates are not within any supported delivery area.',
                ], 422);
            }

            // Create user inside DB transaction and mark as verified
            $user = DB::transaction(function () use ($request, $lat, $lng) {
                return User::create([
                    'name'                 => $request->name,
                    'email'                => $request->email,
                    'password'             => Hash::make($request->password),
                    'phone_number'         => $request->phone_number,
                    'location_id'          => $request->location_id,
                    'latitude'             => $lat,
                    'longitude'            => $lng,
                    'location_verified_at' => now(),
                    'role'                 => 'user',
                ]);
            });

            $token = $user->createToken('api-token')->plainTextToken;

            return response()->json([
                'success'         => true,
                'message'         => 'User registered successfully',
                'user'            => $user,
                'token'           => $token,
                'access_token'    => $token,
                'token_type'      => 'Bearer',
                'redirect_url'    => $this->redirectForRole($user->role),
                'location_status' => 'verified',
                'distance_km'     => $distanceKm !== null ? round($distanceKm, 3) : null,
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
                'email' => ['The provided credentials are incorrect.'],
                'password' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Your account has been deactivated. Contact support to reactivate.',
            ], 403);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'success'         => true,
            'message'         => 'Login successful',
            'user'            => $user,
            'token'           => $token,
            'access_token'    => $token,
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
            default => '/',
        };
    }
}