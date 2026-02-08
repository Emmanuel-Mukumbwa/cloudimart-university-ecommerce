<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddDeliveryVerifiedColumnsToUsers extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            // If these columns might already exist (old runs), guard them:
            if (!Schema::hasColumn('users', 'delivery_verified_at')) {
                $table->timestamp('delivery_verified_at')->nullable()->after('remember_token');
            }
            if (!Schema::hasColumn('users', 'delivery_verified_meta')) {
                $table->json('delivery_verified_meta')->nullable()->after('delivery_verified_at');
            }

            // Index only if not present
            // Note: schema builder does not have a portable "hasIndex" helper — we create index safely
            // using raw SQL could be DB-specific; usually creating an index twice will throw,
            // so ensure duplicate migration classes are removed instead of re-running.
            $table->index('delivery_verified_at');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            // Dropping index - dropIndex accepts array of columns
            // If the index does not exist this may fail; remove duplicate migrations instead of relying on this.
            try {
                $table->dropIndex(['delivery_verified_at']);
            } catch (\Throwable $e) {
                // ignore if index not present
            }

            if (Schema::hasColumn('users', 'delivery_verified_meta')) {
                $table->dropColumn('delivery_verified_meta');
            }
            if (Schema::hasColumn('users', 'delivery_verified_at')) {
                $table->dropColumn('delivery_verified_at');
            }
        });
    }
}
