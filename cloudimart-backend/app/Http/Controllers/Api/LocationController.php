<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Location;
use App\Services\LocationService;
use Illuminate\Support\Facades\Log;

class LocationController extends Controller
{
    protected LocationService $locationService;

    public function __construct(LocationService $locationService)
    {
        $this->locationService = $locationService;
    }

    /**
     * GET /api/locations
     * Return locations for dropdown lists (only active ones by default).
     * Now includes coordinates so frontend can use fallback without extra fetch.
     */
    public function index()
    {
        // include more fields (id, name, latitude, longitude, radius_km) for fallback usage
        $locations = Location::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'latitude', 'longitude', 'radius_km']);

        return response()->json([
            'success' => true,
            'locations' => $locations,
        ]);
    }

    /**
     * GET /api/locations/{id}
     * Return full single location details (404 if not found).
     */
    public function show($id)
    {
        $loc = Location::find($id);

        if (! $loc) {
            return response()->json([
                'success' => false,
                'message' => 'Location not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'location' => $loc,
        ]);
    }

    /**
     * POST /api/locations/validate
     * Validate a point (lat, lng) to see if it's inside any delivery area (polygon or radius),
     * optionally persist a server-trusted verification for the authenticated user,
     * and return the specific detected location.
     */
    public function validatePoint(Request $request)
    {
        $data = $request->validate([
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
            'location_id' => 'nullable|exists:locations,id',
            'cart_hash' => 'nullable|string',
        ]);

        $lat = (float) $data['lat'];
        $lng = (float) $data['lng'];

        // Check if point is within any defined delivery zone
        $insideAny = $this->locationService->isWithinDeliveryZone($lat, $lng);

        // Attempt to find the specific detected area (if any)
        $detected = null;
        $areas = Location::where('is_active', true)->get();
        foreach ($areas as $area) {
            // polygon first
            $poly = $area->polygon_coordinates ? json_decode($area->polygon_coordinates, true) : null;
            $inside = false;
            if (!empty($poly) && is_array($poly)) {
                $inside = $this->locationService->pointInPolygon($lat, $lng, $poly);
            } elseif (!is_null($area->latitude) && !is_null($area->longitude) && !is_null($area->radius_km)) {
                $dist = $this->locationService->haversineDistance($lat, $lng, (float)$area->latitude, (float)$area->longitude);
                $inside = $dist <= (float)$area->radius_km;
            }
            if ($inside) {
                $detected = ['id' => $area->id, 'name' => $area->name];
                break;
            }
        }

        // Check if point matches the selected location (if provided)
        $matchesSelected = null;
        if (!empty($data['location_id'])) {
            $loc = Location::find($data['location_id']);
            if ($loc) {
                $poly = $loc->polygon_coordinates ? json_decode($loc->polygon_coordinates, true) : null;
                if (!empty($poly) && is_array($poly)) {
                    $matchesSelected = $this->locationService->pointInPolygon($lat, $lng, $poly);
                } elseif (!is_null($loc->latitude) && !is_null($loc->longitude) && !is_null($loc->radius_km)) {
                    $dist = $this->locationService->haversineDistance($lat, $lng, (float)$loc->latitude, (float)$loc->longitude);
                    $matchesSelected = $dist <= (float)$loc->radius_km;
                } else {
                    $matchesSelected = false;
                }
            } 
        }

        // If insideAny and user authenticated, persist server-trusted verification
        if ($insideAny && $request->user()) {
            try {
                $user = $request->user();

                $meta = [
                    'lat' => $lat,
                    'lng' => $lng,
                    'detected_location' => $detected,
                    'cart_hash' => $data['cart_hash'] ?? null,
                ];

                $user->delivery_verified_at = now();
                $user->delivery_verified_meta = $meta;
                $user->save();
            } catch (\Throwable $e) {
                // Don't fail the whole validation if persisting the user verification fails;
                // log for later debugging.
                Log::warning('Failed to persist delivery verification for user ID ' . optional($request->user())->id . ': ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'inside_any_area' => $insideAny,
            'matches_selected' => $matchesSelected,
            'detected_location' => $detected,
            // include the user's persisted verification values (if any)
            'delivery_verified_at' => optional($request->user())->delivery_verified_at,
            'delivery_verified_meta' => optional($request->user())->delivery_verified_meta,
        ]);
    }
}
