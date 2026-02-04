<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Location;
use App\Services\LocationService;

class LocationController extends Controller
{
    protected LocationService $locationService;

    public function __construct(LocationService $locationService)
    {
        $this->locationService = $locationService;
    }

    /**
     * GET /api/locations
     * Return all locations for dropdown lists.
     */
    public function index()
    {
        $locations = Location::orderBy('name')->get(['id', 'name']);
        return response()->json([
            'success' => true,
            'locations' => $locations,
        ]);
    } 

    /**
     * POST /api/locations/validate
     * Validate a point (lat, lng) to see if it's inside any delivery area polygon,
     * and optionally check if it matches a specific location's polygon.
     */
    public function validatePoint(Request $request)
    {
        $data = $request->validate([
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
            'location_id' => 'nullable|exists:locations,id',
        ]);

        $lat = (float) $data['lat'];
        $lng = (float) $data['lng'];

        // Check if point is within any defined delivery zone
        $insideAny = $this->locationService->isWithinDeliveryZone($lat, $lng);

        // Check if point matches the selected location (if provided)
        $matchesSelected = null;
        if (!empty($data['location_id'])) {
            $loc = Location::find($data['location_id']);
            if ($loc && $loc->polygon_coordinates) {
                $polygon = json_decode($loc->polygon_coordinates, true);
                $matchesSelected = $this->locationService->pointInPolygon($lat, $lng, $polygon);
            }
        }

        return response()->json([
            'success' => true,
            'inside_any_area' => $insideAny,
            'matches_selected' => $matchesSelected,
        ]);
    }
}
