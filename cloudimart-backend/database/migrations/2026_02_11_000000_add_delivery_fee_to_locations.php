<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddDeliveryFeeToLocations extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds a delivery_fee column (decimal) to locations so you can set zone fees.
     */
    public function up()
    {
        Schema::table('locations', function (Blueprint $table) {
            // delivery fee stored in MWK; two decimals for consistency
            $table->decimal('delivery_fee', 10, 2)->default(0.00)->after('radius_km')->comment('Delivery fee for this location in MWK');
            // optional: human label if you want (uncomment if needed)
            // $table->string('delivery_fee_label', 100)->nullable()->after('delivery_fee');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('locations', function (Blueprint $table) {
            // remove added column(s)
            if (Schema::hasColumn('locations', 'delivery_fee')) {
                $table->dropColumn('delivery_fee');
            }
            // if you added delivery_fee_label, drop it here too
            // if (Schema::hasColumn('locations', 'delivery_fee_label')) {
            //     $table->dropColumn('delivery_fee_label');
            // }
        });
    }
}
