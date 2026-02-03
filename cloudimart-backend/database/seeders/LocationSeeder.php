<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LocationSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            'Mzuzu University',
            'Mzuzu Central Hospital',
            'Luwinga',
            'Area 1B',
            'KAKA',
        ];

        foreach ($locations as $location) {
            DB::table('locations')->insert([
                'name' => $location,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
