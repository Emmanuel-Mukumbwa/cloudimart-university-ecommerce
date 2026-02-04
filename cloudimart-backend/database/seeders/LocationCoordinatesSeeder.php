<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class LocationCoordinatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        $locations = [
            [
                'name' => 'Mzuzu University',
                'slug' => 'mzuzu-university',
                'type' => 'university',
                'latitude' => -11.421870,
                'longitude' => 33.995417,
                'radius_km' => 1.50,
                'description' => 'Main Mzuzu University campus area including student hostels and academic buildings',
                'address' => 'Luwinga, Mzuzu',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Mzuzu Central Hospital',
                'slug' => 'mzuzu-central-hospital',
                'type' => 'hospital',
                'latitude' => -11.429124,
                'longitude' => 33.996213,
                'radius_km' => 1.20,
                'description' => 'Mzuzu Central Hospital and surrounding residential areas',
                'address' => 'Mzuzu Central Hospital Area, Lubinga Rd, Mzuzu',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Luwinga',
                'slug' => 'luwinga-market',
                'type' => 'commercial',
                'latitude' => -11.425029,
                'longitude' => 34.002883,
                'radius_km' => 1.80,
                'description' => 'Luwinga commercial area including market, shops, and residential zones',
                'address' => 'Luwinga (near Post Office), Mzuzu',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Area 1B',
                'slug' => 'area-1b',
                'type' => 'residential',
                'latitude' => -11.403866,
                'longitude' => 33.995187,
                'radius_km' => 1.30,
                'description' => 'Area 1B residential zone including SDA Church and surrounding residences',
                'address' => 'Area 1B, Mzuzu',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'KAKA',
                'slug' => 'kaka-area',
                'type' => 'commercial',
                'latitude' => -11.415642,
                'longitude' => 33.992237,
                'radius_km' => 1.00,
                'description' => 'KAKA commercial and residential area along M1 Road',
                'address' => 'M1 Road, Mzuzu (KAKA corridor)',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($locations as $loc) {
            // If the row already exists by name, update; otherwise insert.
            $existing = DB::table('locations')->where('name', $loc['name'])->first();
            if ($existing) {
                DB::table('locations')->where('id', $existing->id)->update([
                    'slug' => $loc['slug'],
                    'type' => $loc['type'],
                    'latitude' => $loc['latitude'],
                    'longitude' => $loc['longitude'],
                    'radius_km' => $loc['radius_km'],
                    'description' => $loc['description'],
                    'address' => $loc['address'],
                    'is_active' => $loc['is_active'],
                    'updated_at' => $now,
                ]);
            } else {
                DB::table('locations')->insert($loc);
            }
        }

        $this->command->info('✓ Location coordinates seeded/updated successfully');
    }
}
