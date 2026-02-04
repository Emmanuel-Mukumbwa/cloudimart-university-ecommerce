<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('locations', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name')->unique();
            $table->string('type')->nullable()->after('slug');
            $table->decimal('latitude', 10, 7)->nullable()->after('type');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->decimal('radius_km', 5, 2)->nullable()->after('longitude'); // for circle-based areas
            $table->text('description')->nullable()->after('radius_km');
            $table->string('address')->nullable()->after('description');
            $table->boolean('is_active')->default(true)->after('address');
            $table->json('polygon_coordinates')->nullable()->after('is_active'); // keep for future polygon areas
        });
    }

    public function down(): void {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn([
                'slug','type','latitude','longitude','radius_km',
                'description','address','is_active','polygon_coordinates'
            ]);
        });
    }
};
