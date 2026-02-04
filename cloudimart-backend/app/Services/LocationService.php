<?php
namespace App\Services;

use App\Models\Location;

class LocationService
{
    public function isWithinDeliveryZone(float $lat, float $lng): bool
    {
        $areas = Location::whereNotNull('polygon_coordinates')->get();
        foreach ($areas as $area) {
            $polygon = json_decode($area->polygon_coordinates, true);
            if ($this->pointInPolygon($lat, $lng, $polygon)) return true;
        }
        return false;
    }

    private function pointInPolygon($lat, $lng, array $polygon): bool
    {
        if (empty($polygon) || !is_array($polygon)) return false;
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
}
