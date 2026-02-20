<?php
namespace App\Services;

use App\Models\Location;

class LocationService
{
    /** 
     * Returns true if (lat,lng) is inside any configured delivery area.
     * Supports:
     *  - latitude/longitude + radius_km (circle)
     */
    public function isWithinDeliveryZone(float $lat, float $lng): bool
    {
        $areas = Location::where('is_active', true)->get();

        foreach ($areas as $area) {
            // 1) If polygon coordinates exist, use point-in-polygon.
            $poly = $area->polygon_coordinates ? json_decode($area->polygon_coordinates, true) : null;
            if (!empty($poly) && is_array($poly)) {
                if ($this->pointInPolygon($lat, $lng, $poly)) {
                    return true;
                }
            }

            // 2) Otherwise if radius is set, use haversine distance.
            if (!is_null($area->latitude) && !is_null($area->longitude) && !is_null($area->radius_km)) {
                $dist = $this->haversineDistance($lat, $lng, (float)$area->latitude, (float)$area->longitude);
                if ($dist <= (float)$area->radius_km) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Same as earlier: point-in-polygon (ray casting).
     * polygon: array of [lat,lng]
     */
    public function pointInPolygon(float $lat, float $lng, array $polygon): bool
    {
        if (empty($polygon)) return false;
        $inside = false;
        $n = count($polygon);
        for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
            $yi = $polygon[$i][0]; $xi = $polygon[$i][1];
            $yj = $polygon[$j][0]; $xj = $polygon[$j][1];
            $intersect = (($xi > $lng) !== ($xj > $lng))
                && ($lat < ($yj - $yi) * ($lng - $xi) / ($xj - $xi) + $yi);
            if ($intersect) $inside = !$inside;
        }
        return $inside;
    }

    /**
     * Haversine distance (km) between two lat/lng points.
     */
    public function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371.0; // km
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }
}
