<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Modify enum to include pending_delivery
        DB::statement("ALTER TABLE `orders` CHANGE `status` `status` ENUM('pending','pending_delivery','delivered') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        // Revert back to original enum (note: if any rows have pending_delivery this will fail)
        DB::statement("ALTER TABLE `orders` CHANGE `status` `status` ENUM('pending','completed','delivered') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending'");
    }
};
