<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // find or create categories
        $stationery = DB::table('categories')->where('slug', 'stationery')->first();
        $dairy = DB::table('categories')->where('slug', 'dairy')->first();

        $stationeryId = $stationery ? $stationery->id : DB::table('categories')->insertGetId([
            'name' => 'Stationery',
            'slug' => 'stationery',
            'type' => 'stationery',
            'created_at' => $now,
            'updated_at' => $now
        ]);

        $dairyId = $dairy ? $dairy->id : DB::table('categories')->insertGetId([
            'name' => 'Dairy',
            'slug' => 'dairy',
            'type' => 'dairy',
            'created_at' => $now,
            'updated_at' => $now
        ]);

        // Prices are in Malawi Kwacha (MK)
        $products = [
            ['name' => 'A4 Notebooks (Pack of 5)', 'description' => '80 pages A4 ruled notebooks', 'price' => 2500.00, 'category_id' => $stationeryId, 'image_url' => '/images/notebooks.jpg', 'stock' => 50],
            ['name' => 'Ballpoint Pens (Box of 12)', 'description' => 'Smooth gel pens', 'price' => 1200.00, 'category_id' => $stationeryId, 'image_url' => '/images/pens.jpg', 'stock' => 100],
            ['name' => 'Stapler', 'description' => 'Standard office stapler with staples', 'price' => 1800.00, 'category_id' => $stationeryId, 'image_url' => '/images/stapler.jpg', 'stock' => 20],
            ['name' => 'Milk 1L (Fresh)', 'description' => 'Local fresh milk 1-litre', 'price' => 1350.00, 'category_id' => $dairyId, 'image_url' => '/images/milk1l.jpg', 'stock' => 200],
            ['name' => 'Yoghurt (250g)', 'description' => 'Plain yoghurt', 'price' => 1500.00, 'category_id' => $dairyId, 'image_url' => '/images/yoghurt.jpg', 'stock' => 150],
        ];

        foreach ($products as $p) {
            DB::table('products')->insert(array_merge($p, ['created_at' => $now, 'updated_at' => $now]));
        }
    }
}
