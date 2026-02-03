<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;

class LocationController extends Controller
{
    public function index()
    {
        $locations = Location::all(['id', 'name']);
        return response()->json([
            'success' => true,
            'locations' => $locations
        ]);
    }
}
