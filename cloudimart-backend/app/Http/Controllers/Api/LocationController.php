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
     * Return locations for dropdown lists (only active ones by default).
     */
    public function index()
    {
        $locations = Location::where('is_active', true)->orderBy('name')->get(['id', 'name']);
        return response()->json([
            'success' => true,
            'locations' => $locations,
        ]);
    }

    /**
     * POST /api/locations/validate
     * Validate a point (lat, lng) to see if it's inside any delivery area (polygon or radius),
     * and optionally return the specific detected location.
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

        // By default we will attempt to find the specific detected area (if any)
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
                $detected = ['id' => $area->id, 'name' => $area->name, 'is_deliverable' => $area->is_deliverable];
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

        return response()->json([
            'success' => true,
            'inside_any_area' => $insideAny,
            'matches_selected' => $matchesSelected,
            'detected_location' => $detected,
        ]);
    }
}
